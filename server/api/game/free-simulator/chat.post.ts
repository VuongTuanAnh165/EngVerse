import { defineEventHandler, readBody, createError, getRequestHeader } from 'h3';
import { adminAuth, adminDb } from '../../../utils/firebaseAdmin';
import { getTodayDateString } from '../../../utils/cryptoProof';
import {
  buildFreeSimSystemPrompt,
  callFreeSimAiWithFallback,
} from '../../../utils/freeSimAiEngine';
import {
  type FreeSimChatPayload,
  type FreeSimChatResponse,
  MAX_DAILY_FREE_SIM_SESSIONS,
} from '~/types/freeSimulator';

// In-memory fallback rate limiter for guest users (IP/guestId -> { date, count })
const guestDailySessionsMap = new Map<string, { date: string; sessionCount: number }>();

/**
 * POST /api/game/free-simulator/chat
 * Multi-turn AI conversational simulation engine (8-15 turns) with adaptive difficulty,
 * anti-prompt injection, sliding window (4 turns), 6s timeout, and 3-tier smart fallback.
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.4 & Task 4.2
 */
export default defineEventHandler(async (event): Promise<FreeSimChatResponse> => {
  const body = await readBody<FreeSimChatPayload>(event);

  if (!body || !body.playerInput || !body.scenarioTitle) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thiếu dữ liệu đầu vào hoặc thông tin kịch bản giả lập.',
    });
  }

  // 1. Guardrail: Trim and enforce maximum 150 characters per speech turn
  const sanitizedInput = body.playerInput.trim();
  if (sanitizedInput.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Lời thoại không được để trống.',
    });
  }

  if (sanitizedInput.length > 150) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Lời thoại vượt quá giới hạn 150 ký tự cho phép.',
    });
  }

  const todayStr = getTodayDateString();
  const config = useRuntimeConfig();

  // 2. Authentication & 5 Sessions/Day Quota Enforcement (Task 4.6: Premium Gating)
  let uid = '';
  let isGuest = false;
  let isPremium = false;
  let dailySessionsUsed = 0;

  const authHeader = getRequestHeader(event, 'authorization');
  const token = body.idToken || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (token && token !== 'guest') {
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;

      // Check user Daily Sessions in Firestore (1-Doc-Per-User)
      const userRef = adminDb.collection('users').doc(uid);
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        const data = userDoc.data();
        const tier = data?.subscriptionTier;
        const expiresAt = data?.subscriptionExpiresAt;
        if ((tier === 'premium' || tier === 'vip') && (!expiresAt || expiresAt > Date.now())) {
          isPremium = true;
        }

        const freeSimProgress = data?.freeSimulator;
        if (freeSimProgress && freeSimProgress.lastPlayedDate === todayStr) {
          dailySessionsUsed = freeSimProgress.dailySessionsCount || 0;
        } else {
          dailySessionsUsed = 0;
        }

        // Only enforce session quota when starting a new session (turn 1) for non-premium users
        if (!isPremium && body.currentTurn === 1 && dailySessionsUsed >= MAX_DAILY_FREE_SIM_SESSIONS) {
          throw createError({
            statusCode: 429,
            statusMessage: 'Too Many Requests',
            message: 'Bạn đã đạt giới hạn 5 phiên giả lập miễn phí hôm nay! Nâng cấp gói Premium để mở khóa không giới hạn lượt.',
          });
        }
      }
    } catch (err: unknown) {
      if ((err as { statusCode?: number }).statusCode === 429) {
        throw err;
      }
      console.warn('[FreeSimChat] Token verification failed, falling back to guest mode:', err);
      isGuest = true;
      uid = body.guestId || `guest_${Date.now()}`;
    }
  } else {
    isGuest = true;
    uid = body.guestId || `guest_${Date.now()}`;
  }

  // Handle Guest Quota with in-memory tracker
  if (isGuest) {
    const remoteIp =
      getRequestHeader(event, 'cf-connecting-ip') ||
      getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ||
      uid;

    const guestRecord = guestDailySessionsMap.get(remoteIp) || { date: todayStr, sessionCount: 0 };
    if (guestRecord.date !== todayStr) {
      guestRecord.date = todayStr;
      guestRecord.sessionCount = 0;
    }

    if (body.currentTurn === 1 && guestRecord.sessionCount >= MAX_DAILY_FREE_SIM_SESSIONS) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Too Many Requests',
        message: 'Bạn đã đạt giới hạn 5 phiên giả lập miễn phí hôm nay! Hãy quay lại vào ngày mai (00:00 GMT+7).',
      });
    }

    dailySessionsUsed = guestRecord.sessionCount;
    if (body.currentTurn === 1) {
      guestRecord.sessionCount++;
      guestDailySessionsMap.set(remoteIp, guestRecord);
    }
  }

  // 3. Sliding Window: Strictly take the last 4 conversation turns (< 400 tokens)
  const slidingWindow = (body.conversationHistory || []).slice(-4);
  const systemPrompt = buildFreeSimSystemPrompt(body);

  const geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
  const geminiModel = config.geminiModel || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const openrouterApiKey = config.openrouterApiKey || process.env.OPENROUTER_API_KEY;

  // 4. Dispatch with 3-tier smart fallback
  const dispatchResult = await callFreeSimAiWithFallback({
    systemInstruction: systemPrompt,
    slidingWindow,
    playerInput: sanitizedInput,
    payload: body,
    geminiApiKey,
    geminiModel,
    openrouterApiKey,
    timeoutMs: 6000,
  });

  const rawModel = dispatchResult.response;
  const isCompleted = rawModel.isConversationCompleted || body.currentTurn >= body.turnsCount;

  return {
    success: true,
    currentTurn: body.currentTurn,
    maxTurns: body.turnsCount,
    isConversationCompleted: isCompleted,
    npcReply: rawModel.npcReply,
    vietnameseTranslation: rawModel.vietnameseTranslation,
    grammarCorrection: rawModel.grammarCorrection || undefined,
    detectedCefrTurn: rawModel.detectedCefrTurn,
    quickStarterChips: rawModel.quickStarterChips,
    suggestedVocabUsed: rawModel.suggestedVocabUsed,
    turnScore: rawModel.turnScore,
    isPremium,
    remainingSessionsToday: isPremium ? -1 : Math.max(0, MAX_DAILY_FREE_SIM_SESSIONS - dailySessionsUsed),
    usedFallback: dispatchResult.usedFallback,
    providerUsed: dispatchResult.providerUsed,
    latencyMs: dispatchResult.latencyMs,
  };
});

