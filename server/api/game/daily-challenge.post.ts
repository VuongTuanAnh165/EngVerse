/**
 * POST /api/game/daily-challenge
 * Submits Daily Challenge results, computes streak, awards EXP/Gold,
 * updates user's srsBossQueue and saves progress directly in `users/{uid}.dailyChallenge`
 * adhering strictly to the 1-Document-Per-User Firestore discipline.
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.2 & Task 2.1
 */

import { defineEventHandler, readBody, createError, getRequestHeader } from 'h3';
import { adminAuth, adminDb } from '../../utils/firebaseAdmin';
import {
  getVietnamDateString,
  getYesterdayVietnamDateString,
} from '../../utils/dailyChallengeGenerator';
import type {
  DailyChallengeSubmitPayload,
  DailyChallengeSubmitResponse,
  DailyChallengeHistoryEntry,
  UserDailyChallenge,
} from '~/types/dailyChallenge';
import type { UserProfile } from '~/types/user';

export default defineEventHandler(async (event): Promise<DailyChallengeSubmitResponse> => {
  const body = await readBody<DailyChallengeSubmitPayload>(event);

  if (!body || !body.date) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thiếu dữ liệu nộp bài thử thách hàng ngày (date).',
    });
  }

  const todayStr = getVietnamDateString();
  const yesterdayStr = getYesterdayVietnamDateString();

  // Authentication
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

  // -------------------------------------------------------------------------
  // Handle Guest Mode (Calculate rewards statelessly for client storage)
  // -------------------------------------------------------------------------
  if (isGuest || !uid) {
    const earnedExp = 150;
    const earnedGold = 80;
    return {
      success: true,
      earnedExp,
      earnedGold,
      currentStreak: 1,
      longestStreak: 1,
      isStreakExtended: true,
      shieldUsed: false,
      message: 'Hoàn thành thử thách hàng ngày chế độ Khách (Guest)! Đăng nhập để lưu Streak vĩnh viễn nhé.',
    };
  }

  // -------------------------------------------------------------------------
  // Handle Authenticated User Cloud Sync (1-Doc-Per-User)
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

  // Retrieve or initialize dailyChallenge state
  const existingDaily: UserDailyChallenge = userDoc.dailyChallenge || {
    lastCompletedDate: '',
    currentStreak: 0,
    longestStreak: 0,
    totalCompleted: 0,
    history: [],
  };

  let currentStreak = existingDaily.currentStreak || 0;
  let shieldUsed = false;
  let isStreakExtended = false;
  let rewardUnlocked: string | undefined;

  // Streak logic
  if (existingDaily.lastCompletedDate === body.date) {
    // Already completed today
    isStreakExtended = false;
  } else if (existingDaily.lastCompletedDate === yesterdayStr) {
    // Consecutive daily completion
    currentStreak += 1;
    isStreakExtended = true;
  } else if (!existingDaily.lastCompletedDate) {
    // First ever completion
    currentStreak = 1;
    isStreakExtended = true;
  } else {
    // Streak broken: check if user has a freeze shield
    let freezeShields = userDoc.streak?.freezeShields || 0;
    if (freezeShields > 0) {
      freezeShields -= 1;
      shieldUsed = true;
      currentStreak += 1;
      isStreakExtended = true;
      if (userDoc.streak) {
        userDoc.streak.freezeShields = freezeShields;
      }
    } else {
      currentStreak = 1;
      isStreakExtended = true;
    }
  }

  const longestStreak = Math.max(existingDaily.longestStreak || 0, currentStreak);

  // Rewards calculation
  const earnedExp = 150 + Math.min(100, currentStreak * 10);
  const earnedGold = 80 + Math.min(50, currentStreak * 5);
  const updatedExp = (userDoc.exp || 0) + earnedExp;
  const updatedGold = (userDoc.gold || 0) + earnedGold;
  const updatedLevel = Math.floor(updatedExp / 250) + 1;

  // Milestone rewards check
  let freezeShields = userDoc.streak?.freezeShields || 0;
  if (isStreakExtended) {
    if (currentStreak === 3) {
      freezeShields += 1;
      rewardUnlocked = 'Thưởng Khiên Bảo Vệ Chuỗi (Streak Shield)';
    } else if (currentStreak === 7) {
      rewardUnlocked = 'Danh Hiệu: Tín Đồ Chăm Chỉ (Daily Devotee)';
    } else if (currentStreak === 14) {
      rewardUnlocked = 'Gói Thẻ Sử Thi (Codex Epic Pack)';
    } else if (currentStreak === 30) {
      rewardUnlocked = 'Thẻ Bài Huyền Thoại (Codex Legendary)';
    }
  }

  // Update SRS Boss Queue
  const srsSet = new Set<string>(userDoc.srsBossQueue || []);
  if (Array.isArray(body.newWrongWordIds) && body.newWrongWordIds.length > 0) {
    for (const id of body.newWrongWordIds) {
      if (id) srsSet.add(id);
    }
  }
  if (Array.isArray(body.clearedWordIds) && body.clearedWordIds.length > 0) {
    for (const id of body.clearedWordIds) {
      if (id) srsSet.delete(id);
    }
  }
  const updatedSrsQueue = Array.from(srsSet);

  // Update Unlocked Titles
  const titlesSet = new Set<string>(userDoc.unlockedTitles || ['rookie_explorer']);
  if (currentStreak >= 7) titlesSet.add('daily_devotee');
  if (currentStreak >= 30) titlesSet.add('discipline_master');
  const updatedUnlockedTitles = Array.from(titlesSet);

  // New History Entry (max 7 items to keep document lightweight)
  const now = Date.now();
  const historyEntry: DailyChallengeHistoryEntry = {
    date: body.date,
    score: body.totalScore || 0,
    stars: body.starsEarned || 1,
    durationSeconds: body.durationSeconds || 0,
    completedAt: now,
    theme: 'Daily Challenge',
  };

  const updatedHistory = [historyEntry, ...(existingDaily.history || [])].slice(0, 7);

  const updatedDailyChallenge: UserDailyChallenge = {
    lastCompletedDate: body.date,
    currentStreak,
    longestStreak,
    totalCompleted: (existingDaily.totalCompleted || 0) + 1,
    history: updatedHistory,
  };

  const updatedStreak = {
    current: Math.max(userDoc.streak?.current || 0, currentStreak),
    lastPlayedDate: todayStr,
    freezeShields,
  };

  // Perform single atomic Firestore update
  await userRef.update({
    exp: updatedExp,
    gold: updatedGold,
    level: updatedLevel,
    streak: updatedStreak,
    dailyChallenge: updatedDailyChallenge,
    srsBossQueue: updatedSrsQueue,
    unlockedTitles: updatedUnlockedTitles,
    updatedAt: now,
  });

  // Construct complete updated UserProfile for Client Store
  const updatedUser: UserProfile = {
    ...userDoc,
    exp: updatedExp,
    gold: updatedGold,
    level: updatedLevel,
    streak: updatedStreak,
    dailyChallenge: updatedDailyChallenge,
    srsBossQueue: updatedSrsQueue,
    unlockedTitles: updatedUnlockedTitles,
    updatedAt: now,
    isGuest: false,
  };

  return {
    success: true,
    earnedExp,
    earnedGold,
    currentStreak,
    longestStreak,
    isStreakExtended,
    shieldUsed,
    rewardUnlocked,
    user: updatedUser,
    message: isStreakExtended
      ? `Chúc mừng bạn đã duy trì chuỗi ${currentStreak} ngày liên tiếp!`
      : 'Bạn đã hoàn thành thử thách hôm nay!',
  };
});

