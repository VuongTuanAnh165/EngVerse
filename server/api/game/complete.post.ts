import { defineEventHandler, readBody, createError, getRequestHeader } from 'h3';
import { adminAuth, adminDb } from '../../utils/firebaseAdmin';
import { validateStageRun, computeUpdatedStreak } from '../../utils/stageValidator';
import type { StageCompletePayload, StageCompleteResponse } from '~/types/game';
import type { UserProfile, WorldTrack } from '~/types/user';

/**
 * POST /api/game/complete
 * Production-ready server-side stage completion and anti-cheat grading API.
 *
 * 5-Step Server Audit:
 * 1. Identity Authentication (adminAuth.verifyIdToken)
 * 2. Speed Hack Detection (min 1.2s per question)
 * 3. Server-side Grading & HMAC Verification (0 client trust)
 * 4. Replay Cap (10% EXP, 0 Gold, max 3 replays/day)
 * 5. Single Atomic Firestore Update (1 userRef.update command)
 *
 * Reference: docs/ke_hoach.md - Sprint 5, Task 1
 */
export default defineEventHandler(async (event): Promise<StageCompleteResponse> => {
  const body = await readBody<StageCompletePayload>(event);

  if (!body || !body.worldTrack || typeof body.stageId !== 'number') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thiếu thông tin thế giới (worldTrack) hoặc chặng thử thách (stageId).',
    });
  }

  const validTracks: WorldTrack[] = ['kids', 'teens', 'adults'];
  if (!validTracks.includes(body.worldTrack)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: `Thế giới không hợp lệ: "${body.worldTrack}".`,
    });
  }

  // 1. Identity Authentication
  const authHeader = getRequestHeader(event, 'authorization');
  const token = body.idToken || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Bạn cần đăng nhập để nộp kết quả chặng thử thách và lưu dữ liệu lên đám mây.',
    });
  }

  let uid = '';
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch (authErr) {
    console.warn('[GameComplete] Token verification failed:', authErr);
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
    });
  }

  const userRef = adminDb.collection('users').doc(uid);
  const userDocSnap = await userRef.get();

  if (!userDocSnap.exists) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Không tìm thấy hồ sơ người chơi trên hệ thống.',
    });
  }

  const userDoc = userDocSnap.data() as UserProfile;
  const config = useRuntimeConfig();
  const hmacSecret = config.hmacSecretKey || process.env.HMAC_SECRET_KEY || '';

  // 2, 3, 4. Validate Speed Hack, HMAC Proof, Answers & Replay Cap
  let validationResult;
  try {
    validationResult = validateStageRun(
      userDoc,
      body.worldTrack,
      body.stageId,
      body.durationSeconds || 0,
      body.answersLog || [],
      body.aiCompletionProof,
      hmacSecret
    );
  } catch (valErr: unknown) {
    const msg = valErr instanceof Error ? valErr.message : 'Dữ liệu chấm điểm không hợp lệ.';
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: msg,
    });
  }

  if (validationResult.isSpeedHack) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: `Phát hiện thao tác bất thường (Speed Hack Detected): ${validationResult.speedError}`,
    });
  }

  // 5. Compute Updated User State & Perform Single Atomic Firestore Write
  const currentExp = userDoc.exp || 0;
  const currentGold = userDoc.gold || 0;
  const updatedExp = currentExp + validationResult.earnedExp;
  const updatedGold = currentGold + validationResult.earnedGold;
  const updatedLevel = Math.floor(updatedExp / 250) + 1;

  // Streak calculation
  const updatedStreak = computeUpdatedStreak(
    userDoc.streak,
    validationResult.updatedReplayCount.date
  );

  // Track Progress calculation
  const trackKey = body.worldTrack;
  const existingTrackProgress = userDoc.progress?.tracks?.[trackKey] || {
    unlockedStage: 1,
    stageStars: {},
  };

  const stageIdStr = String(body.stageId);
  const existingStars = existingTrackProgress.stageStars[stageIdStr] || 0;
  const finalStars = Math.max(existingStars, validationResult.starsEarned);
  const nextStageId = body.stageId + 1;
  const finalUnlocked = Math.max(existingTrackProgress.unlockedStage || 1, nextStageId);

  const updatedTrackProgress = {
    ...existingTrackProgress,
    unlockedStage: finalUnlocked,
    stageStars: {
      ...existingTrackProgress.stageStars,
      [stageIdStr]: finalStars,
    },
  };

  // SRS Boss Queue update: append new mistakes and remove cleared items
  const srsSet = new Set<string>(userDoc.srsBossQueue || []);
  if (body.newWrongIds && body.newWrongIds.length > 0) {
    for (const wId of body.newWrongIds) {
      if (wId) srsSet.add(wId);
    }
  }
  if (body.clearedSrsIds && body.clearedSrsIds.length > 0) {
    for (const cId of body.clearedSrsIds) {
      srsSet.delete(cId);
    }
  }
  const updatedSrsQueue = Array.from(srsSet);

  // Collected Cards update
  const cardSet = new Set<string>(userDoc.collectedCards || []);
  if (validationResult.guaranteedCardId) {
    cardSet.add(validationResult.guaranteedCardId);
  }
  const updatedCollectedCards = Array.from(cardSet);

  // Unlocked Titles milestone check
  const titlesSet = new Set<string>(userDoc.unlockedTitles || ['rookie_explorer']);
  if (updatedLevel >= 3) titlesSet.add('apprentice_linguist');
  if (updatedLevel >= 5) titlesSet.add('grammar_master');
  if (updatedExp >= 1000) titlesSet.add('vocab_alchemist');
  if (finalStars === 3 && body.stageId === 5) titlesSet.add('boss_slayer');
  if (finalStars === 3 && body.stageId === 10) titlesSet.add('multiverse_champion');
  const updatedUnlockedTitles = Array.from(titlesSet);

  const now = Date.now();

  // Execute SINGLE atomic update to Firestore
  await userRef.update({
    gold: updatedGold,
    exp: updatedExp,
    level: updatedLevel,
    streak: updatedStreak,
    [`progress.tracks.${trackKey}`]: updatedTrackProgress,
    'progress.dailyReplayCount': validationResult.updatedReplayCount,
    srsBossQueue: updatedSrsQueue,
    collectedCards: updatedCollectedCards,
    unlockedTitles: updatedUnlockedTitles,
    updatedAt: now,
  });

  // Construct complete updated UserProfile for Client Store
  const updatedUser: UserProfile = {
    ...userDoc,
    gold: updatedGold,
    exp: updatedExp,
    level: updatedLevel,
    streak: updatedStreak,
    progress: {
      ...userDoc.progress,
      tracks: {
        ...userDoc.progress.tracks,
        [trackKey]: updatedTrackProgress,
      },
      dailyReplayCount: validationResult.updatedReplayCount,
    },
    srsBossQueue: updatedSrsQueue,
    collectedCards: updatedCollectedCards,
    unlockedTitles: updatedUnlockedTitles,
    updatedAt: now,
    isGuest: false,
  };

  return {
    success: true,
    starsEarned: validationResult.starsEarned,
    totalExpEarned: validationResult.earnedExp,
    totalGoldEarned: validationResult.earnedGold,
    isReplay: validationResult.isReplay,
    user: updatedUser,
    message: validationResult.isReplay
      ? 'Bạn đã hoàn thành lại chặng thử thách (Cày lại: nhận 10% EXP, 0 Vàng).'
      : 'Chúc mừng bạn đã chinh phục thành công chặng thử thách!',
  };
});

