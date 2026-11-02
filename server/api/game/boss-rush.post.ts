/**
 * POST /api/game/boss-rush
 * Submits Boss Rush Colosseum results, verifies anti-cheat server-side scoring,
 * awards EXP & Gold, unlocks exclusive badges, frames, and Mythic cards,
 * and updates `users/{uid}.bossRush` adhering strictly to 1-Doc-Per-User discipline.
 *
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.3 & Sprint 9, Task 3.4
 */

import { defineEventHandler, readBody, createError, getRequestHeader } from 'h3';
import { adminAuth, adminDb } from '../../utils/firebaseAdmin';
import type {
  BossRushSubmitPayload,
  BossRushSubmitResponse,
  BossRushResult,
  TrackBossRushRecord,
  UserBossRushProgress,
} from '~/types/bossRush';
import type { UserProfile, WorldTrack } from '~/types/user';

export default defineEventHandler(async (event): Promise<BossRushSubmitResponse> => {
  const body = await readBody<BossRushSubmitPayload>(event);

  if (!body || !body.result || !body.result.worldTrack) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thiếu dữ liệu kết quả Đấu Trường Boss Rush (result).',
    });
  }

  const { result } = body;
  const validTracks: WorldTrack[] = ['kids', 'teens', 'adults'];
  if (!validTracks.includes(result.worldTrack)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: `Vũ trụ không hợp lệ: "${result.worldTrack}".`,
    });
  }

  // -------------------------------------------------------------------------
  // 1. Server-Side Anti-Cheat Scoring Verification
  // -------------------------------------------------------------------------
  const bossesDefeated = Math.max(0, Math.min(4, Math.floor(result.bossesDefeated || 0)));
  const accuracyPercent = Math.max(0, Math.min(100, Math.floor(result.accuracyPercent || 0)));
  const remainingHP = Math.max(0, Math.min(3, Math.floor(result.remainingHP || 0)));
  const totalTimeMs = Math.max(5000, Math.floor(result.totalTimeMs || 0));

  const totalSeconds = Math.floor(totalTimeMs / 1000);
  const serverTimeBonus = Math.max(0, Math.floor((360 - totalSeconds) * 8));

  // Official formula: (bossesDefeated * 1000) + (accuracyPercent * 10) + (remainingHP * 500) + timeBonus
  const serverFinalScore =
    bossesDefeated * 1000 + accuracyPercent * 10 + remainingHP * 500 + serverTimeBonus;

  const isCleared = bossesDefeated === 4;
  const isPerfect = isCleared && remainingHP === 3;

  // Compute EXP & Gold rewards
  let earnedExp = bossesDefeated * 125; // 500 max
  let earnedGold = bossesDefeated * 50; // 200 max
  if (isPerfect) {
    earnedExp += 300; // Perfect run bonus
    earnedGold += 100;
  }

  // -------------------------------------------------------------------------
  // 2. Authentication Check
  // -------------------------------------------------------------------------
  const authHeader = getRequestHeader(event, 'authorization');
  const token = body.idToken || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

  let uid = '';
  let isGuest = false;

  if (token && token !== 'guest') {
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      isGuest = true;
    }
  } else {
    isGuest = true;
  }

  const rewardsUnlocked: {
    titleId?: string;
    avatarFrame?: string;
    cardId?: string;
  } = {
    titleId: isCleared ? 'title_boss_slayer' : undefined,
    avatarFrame: isCleared ? 'avatar_frame_gold' : undefined,
    cardId: isPerfect ? `card_mythic_${result.worldTrack}` : undefined,
  };

  // -------------------------------------------------------------------------
  // 3. Handle Guest Mode (Stateless reward computation)
  // -------------------------------------------------------------------------
  if (isGuest || !uid) {
    return {
      success: true,
      earnedExp,
      earnedGold,
      isNewBestScore: true,
      isNewBestTime: true,
      rewardsUnlocked,
      message: 'Lưu kết quả Đấu Trường ở chế độ Khách (Guest)! Đăng nhập để ghi danh lên Bảng Xếp Hạng toàn cầu nhé.',
    };
  }

  // -------------------------------------------------------------------------
  // 4. Authenticated Cloud Sync (1-Doc-Per-User at users/{uid})
  // -------------------------------------------------------------------------
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

  // Retrieve existing bossRush state or initialize default
  const existingBossRush: UserBossRushProgress = userDoc.bossRush || {
    tracks: {
      kids: { bestScore: 0, bestTimeMs: 0, bossesDefeated: 0, isCleared: false, isPerfect: false },
      teens: { bestScore: 0, bestTimeMs: 0, bossesDefeated: 0, isCleared: false, isPerfect: false },
      adults: { bestScore: 0, bestTimeMs: 0, bossesDefeated: 0, isCleared: false, isPerfect: false },
    },
    totalClears: 0,
  };

  const trackRecord: TrackBossRushRecord = existingBossRush.tracks[result.worldTrack] || {
    bestScore: 0,
    bestTimeMs: 0,
    bossesDefeated: 0,
    isCleared: false,
    isPerfect: false,
  };

  const isNewBestScore = serverFinalScore > trackRecord.bestScore;
  const isNewBestTime =
    trackRecord.bestTimeMs === 0 ||
    (totalTimeMs < trackRecord.bestTimeMs && bossesDefeated >= trackRecord.bossesDefeated);

  // Update track record
  existingBossRush.tracks[result.worldTrack] = {
    bestScore: Math.max(trackRecord.bestScore, serverFinalScore),
    bestTimeMs: isNewBestTime ? totalTimeMs : trackRecord.bestTimeMs,
    bossesDefeated: Math.max(trackRecord.bossesDefeated, bossesDefeated),
    isCleared: trackRecord.isCleared || isCleared,
    isPerfect: trackRecord.isPerfect || isPerfect,
    clearedAt: isCleared ? Date.now() : trackRecord.clearedAt,
  };

  if (isCleared) {
    existingBossRush.totalClears = (existingBossRush.totalClears || 0) + 1;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  existingBossRush.lastPlayedDate = todayStr;

  // Unlock Badges & Rewards in User Profile
  const unlockedTitles = [...(userDoc.unlockedTitles || ['rookie_explorer'])];
  const unlockedAvatarFrames = [...(userDoc.unlockedAvatarFrames || ['default'])];
  const collectedCards = [...(userDoc.collectedCards || [])];

  if (isCleared) {
    if (!unlockedTitles.includes('title_boss_slayer')) {
      unlockedTitles.push('title_boss_slayer');
    }
    if (!unlockedAvatarFrames.includes('avatar_frame_gold')) {
      unlockedAvatarFrames.push('avatar_frame_gold');
    }
  }

  if (isPerfect) {
    const mythicCardId = `card_mythic_${result.worldTrack}`;
    if (!collectedCards.includes(mythicCardId)) {
      collectedCards.push(mythicCardId);
    }
  }

  // Check Multiverse Champion title (all 3 tracks cleared)
  const allTracksCleared = validTracks.every(
    (t) => existingBossRush.tracks[t]?.isCleared
  );
  if (allTracksCleared && !unlockedTitles.includes('title_multiverse_champion')) {
    unlockedTitles.push('title_multiverse_champion');
  }

  // Update user profile atomically with 1 command
  const updatedExp = (userDoc.exp || 0) + earnedExp;
  const updatedGold = (userDoc.gold || 0) + earnedGold;
  const updatedLevel = Math.floor(updatedExp / 250) + 1;

  await userRef.update({
    exp: updatedExp,
    gold: updatedGold,
    level: updatedLevel,
    bossRush: existingBossRush,
    unlockedTitles,
    unlockedAvatarFrames,
    collectedCards,
    updatedAt: Date.now(),
  });

  return {
    success: true,
    earnedExp,
    earnedGold,
    isNewBestScore,
    isNewBestTime,
    rewardsUnlocked,
    message: isCleared
      ? 'Chúc mừng bạn đã chinh phục thành công Đấu Trường Sinh Tử!'
      : 'Đã ghi nhận kết quả chiến đấu vào hồ sơ của bạn.',
  };
});

