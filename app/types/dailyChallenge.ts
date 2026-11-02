/**
 * EngVerse - Daily Challenge Types & Interfaces
 * Defines full contracts for Daily Challenge generation, 4-phase micro-learning structure,
 * streak tracking, SRS queue integration, and completion submission.
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.2 & Sprint 8, Task 2.1
 */

import type { UserProfile } from './user';

/**
 * Returns current date string formatted as YYYY-MM-DD in Vietnam Timezone (GMT+7)
 */
export function getDailyDateString(dateObj: Date = new Date()): string {
  const vnTime = new Date(dateObj.getTime() + 7 * 60 * 60 * 1000);
  return vnTime.toISOString().slice(0, 10);
}

/**
 * Alias for getDailyDateString for consistency across server and client
 */
export const getVietnamDateString = getDailyDateString;

/**
 * Returns yesterday's date string formatted as YYYY-MM-DD in Vietnam Timezone (GMT+7)
 */
export function getYesterdayDateString(dateObj: Date = new Date()): string {
  const yesterday = new Date(dateObj.getTime() - 24 * 60 * 60 * 1000);
  return getDailyDateString(yesterday);
}

/**
 * Milestone structure for maintaining consecutive streaks
 */
export interface StreakMilestone {
  days: number;
  rewardKey: string;
  titleVi: string;
  descriptionVi: string;
  rewardIcon: string;
}

/**
 * 5 Standard streak milestone rewards according to roadmap section 6.2
 */
export const STREAK_MILESTONES: readonly StreakMilestone[] = [
  {
    days: 3,
    rewardKey: 'streak_shield',
    titleVi: 'Khiên Băng Bảo Vệ',
    descriptionVi: 'Bảo vệ chuỗi ngày học 1 lần khi lỡ quên làm bài',
    rewardIcon: '🛡️',
  },
  {
    days: 7,
    rewardKey: 'exp_x2_24h',
    titleVi: 'Hào Quang Tri Thức (x2 EXP 24h)',
    descriptionVi: 'Nhân đôi toàn bộ EXP nhận được trong 24 giờ',
    rewardIcon: '⚡',
  },
  {
    days: 14,
    rewardKey: 'codex_epic_pack',
    titleVi: 'Gói Thẻ Sử Thi (Codex Epic Pack)',
    descriptionVi: 'Mở khóa ngay 1 gói thẻ bài Codex độ hiếm Epic',
    rewardIcon: '🃏',
  },
  {
    days: 30,
    rewardKey: 'codex_legendary',
    titleVi: 'Thẻ Bài Huyền Thoại (Codex Legendary)',
    descriptionVi: 'Nhận 1 Thẻ Bài 3D Legendary cực hiếm ngẫu nhiên',
    rewardIcon: '👑',
  },
  {
    days: 60,
    rewardKey: 'avatar_frame_gold',
    titleVi: 'Khung Avatar Vàng Hoàng Gia',
    descriptionVi: 'Khung ảnh đại diện mạ vàng thể hiện sự bền bỉ tối thượng',
    rewardIcon: '✨',
  },
];

/**
 * Phase 1: Vocab Sprint (6 words - 60 seconds)
 * 50% from user's SRS boss queue + 50% from daily theme / random stages
 */
export interface DailyVocabSprintItem {
  id: string;
  word: string;
  ipa: string;
  meaning: string;
  collocations?: string[];
  realWorldPhrase?: string;
  emoji?: string;
  distractorMeanings: string[];
}

/**
 * Phase 2: Grammar Flash (4 puzzles - 50 seconds)
 * Sentence lock puzzles selected from stage grammar pools
 */
export interface DailyGrammarFlashItem {
  id: string;
  grammarPattern: string;
  vietnamesePrompt: string;
  correctSentence: string;
  distractorWords: string[];
  grammarTip: string;
  functionalCategory?: string;
}

/**
 * Phase 3: Voice Challenge (3 phrases - 40 seconds)
 * Read-aloud speaking challenge based on real-world phrases
 */
export interface DailyVoiceChallengeItem {
  id: string;
  sentence: string;
  translationVi: string;
  focusWord: string;
  ipa: string;
}

/**
 * Phase 4: Quick Roleplay (3 turns - 90 seconds)
 * Rapid conversational AI exchange contextualized around the daily theme
 */
export interface DailyQuickRoleplayConfig {
  theme: string;
  npcName: string;
  npcTitle: string;
  npcEmoji: string;
  scenario: string;
  goal: string;
  openingLine: string;
  openingLineVi: string;
  targetKeywords: string[];
  starterChips: string[];
  maxTurns: number;
}

/**
 * Full Daily Challenge bundle generated for a specific day
 */
export interface DailyChallengeData {
  date: string; // ISO date string (YYYY-MM-DD)
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  theme: string;
  themeVi: string;
  icon: string;
  description: string;
  vocabSprint: DailyVocabSprintItem[];
  grammarFlash: DailyGrammarFlashItem[];
  voiceChallenge: DailyVoiceChallengeItem[];
  quickRoleplay: DailyQuickRoleplayConfig;
}

/**
 * Historical record of a completed daily challenge
 * Embedded in user doc (max 7 entries to respect 1-Doc-Per-User rule)
 */
export interface DailyChallengeHistoryEntry {
  date: string;
  score: number;
  stars: number;
  durationSeconds: number;
  completedAt: number;
  theme: string;
}

/**
 * Embedded user progress for Daily Challenge in Firestore users/{uid}
 */
export interface UserDailyChallenge {
  lastCompletedDate: string; // YYYY-MM-DD
  currentStreak: number;
  longestStreak: number;
  totalCompleted: number;
  history: DailyChallengeHistoryEntry[];
}

/**
 * Results broken down by phase
 */
export interface DailyChallengePhaseResults {
  vocabSprint: { score: number; correctCount: number; totalCount: number };
  grammarFlash: { score: number; correctCount: number; totalCount: number };
  voiceChallenge: { score: number; correctCount: number; totalCount: number };
  quickRoleplay: { score: number; turnsUsed: number; completed: boolean };
}

/**
 * Payload sent to POST /api/game/daily-challenge
 */
export interface DailyChallengeSubmitPayload {
  idToken?: string;
  guestId?: string;
  date: string; // YYYY-MM-DD
  totalScore: number;
  starsEarned: number; // 1-3
  durationSeconds: number;
  phaseResults: DailyChallengePhaseResults;
  newWrongWordIds?: string[];
  clearedWordIds?: string[];
}

/**
 * Response returned from POST /api/game/daily-challenge
 */
export interface DailyChallengeSubmitResponse {
  success: boolean;
  earnedExp: number;
  earnedGold: number;
  currentStreak: number;
  longestStreak: number;
  isStreakExtended: boolean;
  shieldUsed: boolean;
  rewardUnlocked?: string;
  user?: UserProfile;
  message: string;
}

