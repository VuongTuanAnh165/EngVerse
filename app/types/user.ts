/**
 * EngVerse - Core User Profile & Progress Types
 * Strictly typed schema for 1-Document-Per-User architecture in Firestore
 * Reference: docs/ke_hoach.md - Section III.2 & Sprint 1
 */

export type WorldTrack = 'kids' | 'teens' | 'adults';

/**
 * Mapping of stage ID to the number of stars earned (1-3 stars)
 * Example: { "1": 3, "2": 2 }
 */
export type StageStarsMap = Record<string, number>;

/**
 * Progress details for a single world track
 */
export interface TrackProgress {
  unlockedStage: number;
  stageStars: StageStarsMap;
}

/**
 * Tracks progress across all three universes (Kids, Teens, Adults)
 */
export type WorldTracksProgress = Record<WorldTrack, TrackProgress>;

/**
 * Daily replay tracker for anti-cheat and replay farming prevention
 * Replayed completed stages cap at max 10% EXP, 0 Gold, max 3 times per day.
 */
export interface DailyReplayCount {
  date: string; // Format: YYYY-MM-DD
  count: number;
}

/**
 * Multi-track progress structure stored inside the user document
 */
export interface UserProgress {
  tracks: WorldTracksProgress;
  dailyReplayCount: DailyReplayCount;
}

/**
 * Energy system state (5/5 max, regenerates over time)
 */
export interface UserEnergy {
  current: number;
  max: number;
  lastRefillAt: number; // Unix timestamp in milliseconds
}

/**
 * Daily learning streak and freeze shields (to protect streak)
 */
export interface UserStreak {
  current: number;
  lastPlayedDate: string; // Format: YYYY-MM-DD
  freezeShields: number;
}

/**
 * AI Roleplay quota tracker (max 20 turns per user per day)
 */
export interface UserAiQuota {
  date: string; // Format: YYYY-MM-DD
  usedTurns: number;
}

/**
 * Full User Profile document stored at `users/{uid}` in Firestore
 * Adheres strictly to the 1 Document / 1 User rule
 */
export interface UserProfile {
  uid: string;
  displayName: string;
  avatar: string;
  worldTrack: WorldTrack;
  level: number;
  exp: number;
  gold: number;
  energy: UserEnergy;
  streak: UserStreak;
  progress: UserProgress;
  srsBossQueue: string[];
  collectedCards: string[];
  unlockedTitles: string[];
  equippedTitle: string;
  aiQuota: UserAiQuota;
  updatedAt: number; // Unix timestamp in milliseconds
  createdAt?: number; // Unix timestamp in milliseconds
  email?: string | null;
  isGuest?: boolean; // Client-side state indicator for guest mode
}

/**
 * Payload sent from client during guest-to-cloud account migration or initialization
 */
export interface AuthInitPayload {
  idToken: string;
  turnstileToken?: string;
  guestProgress?: Partial<UserProfile> | null;
}

/**
 * Server response for `/api/auth/init`
 */
export interface AuthInitResponse {
  success: boolean;
  user: UserProfile;
  isNewUser: boolean;
  message?: string;
}

/**
 * Payload for shop transactions (e.g. freeze shield or energy refill)
 */
export interface BuyItemPayload {
  itemType: 'freeze_shield' | 'refill_energy';
}

/**
 * Server response for shop transactions
 */
export interface BuyItemResponse {
  success: boolean;
  gold: number;
  freezeShields?: number;
  energy?: UserEnergy;
  message?: string;
}

/**
 * Single entry on the Edge CDN cached leaderboard
 */
export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  avatar: string;
  equippedTitle: string;
  level: number;
  exp: number;
  worldTrack: WorldTrack;
  rank: number;
}

/**
 * Response for `/api/leaderboard`
 */
export interface LeaderboardResponse {
  updatedAt: number;
  entries: LeaderboardEntry[];
}

/**
 * Helper to construct a clean default UserProfile instance
 * Suitable for Guest mode or initial cloud document creation
 */
export function createDefaultUserProfile(
  uid = 'guest_user',
  displayName = 'Guest Explorer',
  avatar = 'rookie_avatar',
  worldTrack: WorldTrack = 'kids'
): UserProfile {
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();

  return {
    uid,
    displayName,
    avatar,
    worldTrack,
    level: 1,
    exp: 0,
    gold: 100,
    energy: {
      current: 5,
      max: 5,
      lastRefillAt: now,
    },
    streak: {
      current: 0,
      lastPlayedDate: '',
      freezeShields: 0,
    },
    progress: {
      tracks: {
        kids: {
          unlockedStage: 1,
          stageStars: {},
        },
        teens: {
          unlockedStage: 1,
          stageStars: {},
        },
        adults: {
          unlockedStage: 1,
          stageStars: {},
        },
      },
      dailyReplayCount: {
        date: today,
        count: 0,
      },
    },
    srsBossQueue: [],
    collectedCards: [],
    unlockedTitles: ['rookie_explorer'],
    equippedTitle: 'rookie_explorer',
    aiQuota: {
      date: today,
      usedTurns: 0,
    },
    updatedAt: now,
    createdAt: now,
    isGuest: true,
  };
}

