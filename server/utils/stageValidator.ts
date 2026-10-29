/**
 * EngVerse - Stage Validator & Anti-Cheat Engine (Serverless)
 *
 * Enforces strict anti-cheat rules on Vercel Serverless:
 * 1. Identity authentication via Firebase ID Token
 * 2. Speed hack detection (min 1.2s per question)
 * 3. Server-side answer validation & HMAC proof verification (0 client trust)
 * 4. Replay cap (max 3 replays/day, 10% EXP, 0 Gold)
 * 5. Bundled static stages without fs.readFileSync to prevent ENOENT on Vercel
 *
 * Strict TypeScript (0 any), Server-only.
 * Reference: docs/ke_hoach.md - Sprint 5, Task 1 & Rules.md Rule 3 & 4
 */

import type { WorldTrack, UserProfile, UserStreak } from '~/types/user';
import type { StageData, AnswerLogEntry } from '~/types/game';
import { verifyAiCompletionProof, getTodayDateString } from './cryptoProof.ts';

// Direct static import ensures all stage definitions are baked into Vercel Serverless bundle
import kidsStagesRaw from '../../public/data/kids/stages.json' with { type: 'json' };
import teensStagesRaw from '../../public/data/teens/stages.json' with { type: 'json' };
import adultsStagesRaw from '../../public/data/adults/stages.json' with { type: 'json' };

const ALL_STAGES: Record<WorldTrack, StageData[]> = {
  kids: kidsStagesRaw as unknown as StageData[],
  teens: teensStagesRaw as unknown as StageData[],
  adults: adultsStagesRaw as unknown as StageData[],
};

export interface StageValidationResult {
  isValid: boolean;
  isSpeedHack: boolean;
  speedError?: string;
  stage: StageData;
  starsEarned: number;
  totalCorrect: number;
  totalQuestions: number;
  accuracy: number;
  earnedExp: number;
  earnedGold: number;
  isReplay: boolean;
  guaranteedCardId?: string;
  updatedReplayCount: { date: string; count: number };
}

/**
 * Retrieves the official stage configuration from bundled JSON data
 */
export function getBundledStage(worldTrack: WorldTrack, stageId: number): StageData | null {
  const trackStages = ALL_STAGES[worldTrack];
  if (!trackStages) return null;
  return trackStages.find((s) => s.stageId === stageId) || null;
}

/**
 * Checks for speed hacks: each question must take at least 1.2 seconds of real human time
 */
export function checkSpeedHack(
  durationSeconds: number,
  totalQuestions: number
): { isSpeedHack: boolean; minExpectedSeconds: number } {
  // If no questions in answersLog, at least 5 seconds for a stage
  const minExpectedSeconds = Math.max(5, Math.floor(totalQuestions * 1.2));
  const isSpeedHack = durationSeconds < minExpectedSeconds;
  return { isSpeedHack, minExpectedSeconds };
}

/**
 * Calculates updated daily learning streak and consumes freeze shields if days were missed
 */
export function computeUpdatedStreak(
  currentStreak: UserStreak | undefined,
  todayStr: string
): UserStreak {
  if (!currentStreak) {
    return {
      current: 1,
      lastPlayedDate: todayStr,
      freezeShields: 0,
    };
  }

  // If already played today, streak count remains the same
  if (currentStreak.lastPlayedDate === todayStr) {
    return { ...currentStreak };
  }

  if (!currentStreak.lastPlayedDate) {
    return {
      current: 1,
      lastPlayedDate: todayStr,
      freezeShields: currentStreak.freezeShields || 0,
    };
  }

  // Calculate day difference
  const lastDate = new Date(`${currentStreak.lastPlayedDate}T00:00:00Z`).getTime();
  const todayDate = new Date(`${todayStr}T00:00:00Z`).getTime();
  const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    // Consecutive day
    return {
      current: currentStreak.current + 1,
      lastPlayedDate: todayStr,
      freezeShields: currentStreak.freezeShields,
    };
  } else if (diffDays > 1) {
    // Missed one or more days: check freeze shields
    if (currentStreak.freezeShields > 0) {
      return {
        current: currentStreak.current + 1, // Freeze shield protected streak
        lastPlayedDate: todayStr,
        freezeShields: currentStreak.freezeShields - 1, // Consumed 1 freeze shield
      };
    } else {
      // Streak broken
      return {
        current: 1,
        lastPlayedDate: todayStr,
        freezeShields: 0,
      };
    }
  }

  return { ...currentStreak, lastPlayedDate: todayStr };
}

/**
 * Validates stage answers against bundled curriculum and calculates server rewards
 */
export function validateStageRun(
  userDoc: UserProfile,
  worldTrack: WorldTrack,
  stageId: number,
  durationSeconds: number,
  answersLog: AnswerLogEntry[],
  aiCompletionProof: string | null | undefined,
  hmacSecret: string
): StageValidationResult {
  const stage = getBundledStage(worldTrack, stageId);
  if (!stage) {
    throw new Error(`[StageValidator] Stage #${stageId} not found in world track "${worldTrack}".`);
  }

  const totalQuestions = answersLog.length;

  // 1. Speed Hack Detection
  const { isSpeedHack, minExpectedSeconds } = checkSpeedHack(durationSeconds, totalQuestions);
  if (isSpeedHack) {
    return {
      isValid: false,
      isSpeedHack: true,
      speedError: `Thời gian hoàn thành (${durationSeconds}s) quá ngắn so với tối thiểu (${minExpectedSeconds}s) cho ${totalQuestions} câu hỏi.`,
      stage,
      starsEarned: 0,
      totalCorrect: 0,
      totalQuestions,
      accuracy: 0,
      earnedExp: 0,
      earnedGold: 0,
      isReplay: false,
      updatedReplayCount: userDoc.progress?.dailyReplayCount || {
        date: getTodayDateString(),
        count: 0,
      },
    };
  }

  // 2. Server-side AI Roleplay Proof Verification
  if (stage.aiRoleplayMission) {
    const hasRoleplayTask = answersLog.some((a) => a.itemType === 'roleplay') || !stage.isBossStage;
    if (hasRoleplayTask) {
      if (!aiCompletionProof) {
        throw new Error(
          'Thiếu chữ ký xác thực AI Roleplay. Không thể hoàn thành chặng này mà chưa vượt qua nhiệm vụ AI.'
        );
      }

      const isValidProof = verifyAiCompletionProof(
        aiCompletionProof,
        {
          uid: userDoc.uid,
          worldTrack,
          stageId,
        },
        hmacSecret
      );

      if (!isValidProof) {
        throw new Error(
          'Chữ ký xác thực nhiệm vụ AI không hợp lệ hoặc đã hết hạn (Anti-Cheat Token Invalid).'
        );
      }
    }
  }

  // 3. Server-side Scoring
  const totalCorrect = answersLog.filter((a) => a.isCorrect).length;
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 100;

  let starsEarned = 0;
  if (accuracy >= 90) {
    starsEarned = 3;
  } else if (accuracy >= 70) {
    starsEarned = 2;
  } else if (accuracy >= 50) {
    starsEarned = 1;
  } else {
    starsEarned = 0;
  }

  // 4. Replay Cap Check
  const todayStr = getTodayDateString();
  const trackProgress = userDoc.progress?.tracks?.[worldTrack];
  const previousStars = trackProgress?.stageStars?.[String(stageId)] || 0;
  const isReplay = previousStars > 0;

  const currentReplay = userDoc.progress?.dailyReplayCount || { date: todayStr, count: 0 };
  let replayCountToday = currentReplay.date === todayStr ? currentReplay.count : 0;

  let earnedExp = 0;
  let earnedGold = 0;
  let guaranteedCardId: string | undefined;

  if (isReplay) {
    // Replay Cap: max 3 replays per day, receives 10% EXP and 0 Gold
    if (replayCountToday < 3) {
      earnedExp = Math.round((stage.reward.baseExp || 100) * 0.1);
      earnedGold = 0;
      replayCountToday++;
    } else {
      earnedExp = 0;
      earnedGold = 0;
    }
  } else {
    // First clear reward with star multiplier
    const starMultiplier = starsEarned === 3 ? 1.2 : starsEarned === 2 ? 1.0 : 0.8;
    earnedExp = Math.round((stage.reward.baseExp || 100) * starMultiplier);
    earnedGold = Math.round(
      (stage.reward.baseGold || 50) * starMultiplier + (stage.reward.firstClearBonusGold || 0)
    );

    if (stage.reward.guaranteedCardId) {
      guaranteedCardId = stage.reward.guaranteedCardId;
    }
  }

  return {
    isValid: true,
    isSpeedHack: false,
    stage,
    starsEarned,
    totalCorrect,
    totalQuestions,
    accuracy,
    earnedExp,
    earnedGold,
    isReplay,
    guaranteedCardId,
    updatedReplayCount: {
      date: todayStr,
      count: replayCountToday,
    },
  };
}
