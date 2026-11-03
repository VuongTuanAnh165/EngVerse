import { defineEventHandler, readBody, createError, getRequestHeader } from 'h3';
import { adminAuth, adminDb } from '../../../utils/firebaseAdmin';
import { generateAiCompletionProof, getTodayDateString } from '../../../utils/cryptoProof';
import { dispatchCefrEvaluation } from '../../../utils/cefrEvaluationEngine';
import {
  type FreeSimEvaluatePayload,
  type FreeSimEvaluateResponse,
  type FreeSimSessionRecord,
  type UserFreeSimulatorProgress,
  MAX_DAILY_FREE_SIM_SESSIONS,
} from '~/types/freeSimulator';
import type { UserProfile } from '~/types/user';

/**
 * POST /api/game/free-simulator/evaluate
 * Evaluates the full conversation transcript against international CEFR standards (4 dimensions),
 * awards EXP/Gold bonuses, and atomically records progress directly inside `users/{uid}.freeSimulator`
 * strictly adhering to the 1-Document-Per-User Firestore rule (0 subcollections).
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.4, IV & Task 4.3
 */
export default defineEventHandler(async (event): Promise<FreeSimEvaluateResponse> => {
  const body = await readBody<FreeSimEvaluatePayload>(event);

  if (!body || !body.sessionId || !body.scenarioTitle || !Array.isArray(body.conversationHistory)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thiếu dữ liệu phiên đàm thoại để đánh giá CEFR Scorecard.',
    });
  }

  const todayStr = getTodayDateString();
  const config = useRuntimeConfig();

  // 1. Dispatch AI CEFR Evaluation (Gemini -> OpenRouter -> Offline Engine)
  const geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
  const geminiModel = config.geminiModel || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const openrouterApiKey = config.openrouterApiKey || process.env.OPENROUTER_API_KEY;

  const evalResult = await dispatchCefrEvaluation(body, {
    geminiApiKey,
    geminiModel,
    openrouterApiKey,
    timeoutMs: 6000,
  });

  const scorecard = evalResult.scorecard;

  // 2. Build Session Record
  const completedRecord: FreeSimSessionRecord = {
    sessionId: body.sessionId,
    scenarioId: body.scenarioId,
    scenarioTitle: body.scenarioTitle,
    category: body.category,
    targetCefr: body.targetCefr === 'auto' ? 'B1' : body.targetCefr,
    achievedCefr: scorecard.overallLevel,
    completedAt: Date.now(),
    turnsCount: body.conversationHistory.filter((m) => m.role === 'user').length,
    scorecard,
  };

  // 3. Compute EXP & Gold Rewards based on CEFR level achieved
  let earnedExp = 120;
  let earnedGold = 60;
  switch (scorecard.overallLevel) {
    case 'B1':
      earnedExp += 20;
      earnedGold += 20;
      break;
    case 'B2':
      earnedExp += 40;
      earnedGold += 35;
      break;
    case 'C1':
      earnedExp += 70;
      earnedGold += 50;
      break;
    case 'C2':
      earnedExp += 100;
      earnedGold += 80;
      break;
    default:
      earnedExp += 10;
      earnedGold += 10;
  }

  // 4. Authentication Check
  let uid = '';
  let isGuest = false;

  const authHeader = getRequestHeader(event, 'authorization');
  const token = body.idToken || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (token && token !== 'guest') {
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      isGuest = true;
      uid = body.guestId || `guest_${Date.now()}`;
    }
  } else {
    isGuest = true;
    uid = body.guestId || `guest_${Date.now()}`;
  }

  let remainingSessionsToday = MAX_DAILY_FREE_SIM_SESSIONS;

  // 5. Update Firestore 1-Doc-Per-User for Authenticated Users
  if (!isGuest && uid) {
    try {
      const userRef = adminDb.collection('users').doc(uid);
      const userDocSnap = await userRef.get();

      if (userDocSnap.exists) {
        const userDoc = userDocSnap.data() as UserProfile;
        const existingSim = userDoc.freeSimulator;

        let dailySessionsCount = 1;
        if (existingSim && existingSim.lastPlayedDate === todayStr) {
          dailySessionsCount = (existingSim.dailySessionsCount || 0) + 1;
        }

        const existingHistory = Array.isArray(existingSim?.history) ? existingSim.history : [];
        // Max 5 recent records embedded in the user doc (0 subcollection)
        const updatedHistory = [completedRecord, ...existingHistory].slice(0, 5);

        const updatedFreeSim: UserFreeSimulatorProgress = {
          dailySessionsCount,
          lastPlayedDate: todayStr,
          totalSessionsCompleted: (existingSim?.totalSessionsCompleted || 0) + 1,
          history: updatedHistory,
        };

        const updatedExp = (userDoc.exp || 0) + earnedExp;
        const updatedGold = (userDoc.gold || 0) + earnedGold;
        const updatedLevel = Math.max(1, Math.floor(updatedExp / 300) + 1);

        // Single atomic Firestore write
        await userRef.update({
          exp: updatedExp,
          gold: updatedGold,
          level: updatedLevel,
          freeSimulator: updatedFreeSim,
          updatedAt: Date.now(),
        });

        remainingSessionsToday = Math.max(0, MAX_DAILY_FREE_SIM_SESSIONS - dailySessionsCount);
      }
    } catch (dbErr) {
      console.error('[FreeSimEvaluate] Failed to update user Firestore document:', dbErr);
    }
  }

  // 6. Generate HMAC Completion Proof
  const hmacSecret = config.hmacSecretKey || process.env.HMAC_SECRET_KEY || '';
  const completionProof = generateAiCompletionProof(
    {
      uid,
      worldTrack: 'adults',
      stageId: 999, // Reserved ID for Free Simulator
      dateStr: todayStr,
    },
    hmacSecret
  );

  return {
    success: true,
    record: completedRecord,
    earnedExp,
    earnedGold,
    completionProof,
    remainingSessionsToday,
    usedFallback: evalResult.usedFallback,
    providerUsed: evalResult.providerUsed,
    latencyMs: evalResult.latencyMs,
  };
});

