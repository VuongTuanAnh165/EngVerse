/**
 * EngVerse - Social Share & OG Image Types
 * Strictly typed schema for public player profiles and dynamic Open Graph cards.
 * Reference: docs/ke_hoach.md - Sprint 6 (Mục 2) & Rules.md
 */

import type { WorldTrack } from './user';

/**
 * Public profile data exposed for social sharing and Open Graph cards.
 * Strictly excludes private fields (email, aiQuota, dailyReplayCount, etc.)
 */
export interface PublicShareProfile {
  uid: string;
  displayName: string;
  avatar: string;
  level: number;
  exp: number;
  equippedTitle: string;
  streak: {
    current: number;
    freezeShields?: number;
    lastPlayedDate?: string;
  };
  worldTrack: WorldTrack;
  collectedCardsCount: number;
  unlockedTitlesCount: number;
}

/**
 * API response format for public user lookup
 */
export interface PublicShareResponse {
  success: boolean;
  profile: PublicShareProfile;
  message?: string;
}

/**
 * Props passed to the dynamic Satori OG Image component (app/components/OgImage/HonorCard.vue)
 */
export interface OgImageHonorCardProps {
  displayName: string;
  avatar: string;
  level: number;
  streak: number;
  equippedTitle: string;
  worldTrack: WorldTrack;
  exp?: number;
  cardsCount?: number;
}


