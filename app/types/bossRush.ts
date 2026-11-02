/**
 * EngVerse - Boss Rush Colosseum Types & Hardcore Modifiers
 * Strictly typed contracts for Endgame Boss Rush mode across 3 tracks (Kids, Teens, Adults).
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.3 & .antigravity/rules.md
 */

import type { StageData } from '~/types/game';
import type { WorldTrack } from '~/types/user';

/**
 * Hardcore modifier configuration applied to all Boss battles in Colosseum
 */
export interface BossRushHardcoreConfig {
  /** Time limit multiplier compared to normal stages (-30% => 0.70) */
  timeMultiplier: number;
  /** Voice pronunciation pass threshold offset (+0.05 stricter) */
  voicePassThresholdOffset: number;
  /** Disables starter chips in AI Roleplay */
  hideStarterChips: boolean;
  /** Additional vocab count per round in Word Alchemy (+2 items) */
  extraVocabPickCount: number;
  /** Shared maximum HP across all 4 continuous boss battles */
  sharedMaxHp: number;
}

/**
 * Default Hardcore Modifiers constants
 */
export const BOSS_RUSH_HARDCORE_MODIFIERS: BossRushHardcoreConfig = Object.freeze({
  timeMultiplier: 0.7,
  voicePassThresholdOffset: 0.05,
  hideStarterChips: true,
  extraVocabPickCount: 2,
  sharedMaxHp: 3,
});

/**
 * Single Boss descriptor in the 4-Boss queue
 */
export interface BossRushBossItem {
  bossIndex: number; // 0, 1, 2, 3 (Boss 1 to 4)
  stageId: number; // 5, 10, 15, 20
  title: string;
  chapter: string;
  npcName: string;
  npcAvatarEmoji: string;
  introQuote: string;
  stageData: StageData;
  isDefeated: boolean;
}

/**
 * End-of-Run Evaluation Result
 */
export interface BossRushResult {
  worldTrack: WorldTrack;
  bossesDefeated: number; // 0 - 4
  totalTimeMs: number;
  accuracyPercent: number; // 0 - 100
  remainingHP: number; // 0 - 3
  timeBonus: number;
  finalScore: number;
  isCleared: boolean; // bossesDefeated === 4
  isPerfect: boolean; // bossesDefeated === 4 && remainingHP === 3
  completedAt: number;
  rewardsUnlocked: {
    titleId?: string;
    avatarFrame?: string;
    cardId?: string;
  };
}

/**
 * Per-track record saved in 1-Doc-Per-User schema
 */
export interface TrackBossRushRecord {
  bestScore: number;
  bestTimeMs: number;
  bossesDefeated: number; // 0 - 4
  isCleared: boolean;
  isPerfect: boolean;
  clearedAt?: number;
}

/**
 * Persistent Boss Rush progress in users/{uid}.bossRush
 */
export interface UserBossRushProgress {
  tracks: Record<WorldTrack, TrackBossRushRecord>;
  totalClears: number;
  lastPlayedDate?: string;
}

/**
 * Active game state of the Boss Rush Colosseum session
 */
export type BossRushSessionState =
  | 'portal_gate' // Gate screen (checking unlock condition, rules & modifiers overview)
  | 'boss_intro' // Cinematic intro before facing the next Boss
  | 'in_battle' // Active mini-game fight against current Boss
  | 'boss_cleared' // Intermission cutscene after defeating 1 Boss
  | 'victory' // Defeated all 4 Bosses
  | 'defeat'; // Lost all 3 HP

/**
 * Single entry on Boss Rush Colosseum Leaderboard
 */
export interface BossRushLeaderboardEntry {
  uid: string;
  rank: number;
  displayName: string;
  avatar: string;
  equippedTitle: string;
  worldTrack: WorldTrack;
  bestScore: number;
  bestTimeMs: number;
  formattedTime: string;
  bossesDefeated: number; // 0 - 4
  isCleared: boolean;
  isPerfect: boolean;
}

/**
 * Server response for GET /api/game/boss-rush/leaderboard
 */
export interface BossRushLeaderboardResponse {
  updatedAt: number;
  worldTrack: string;
  entries: BossRushLeaderboardEntry[];
}

/**
 * Payload for POST /api/game/boss-rush
 */
export interface BossRushSubmitPayload {
  result: BossRushResult;
  idToken?: string;
}

/**
 * Server response for POST /api/game/boss-rush
 */
export interface BossRushSubmitResponse {
  success: boolean;
  earnedExp: number;
  earnedGold: number;
  isNewBestScore: boolean;
  isNewBestTime: boolean;
  rewardsUnlocked: {
    titleId?: string;
    avatarFrame?: string;
    cardId?: string;
  };
  message?: string;
}
