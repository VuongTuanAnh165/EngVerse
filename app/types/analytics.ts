/**
 * EngVerse - Google Analytics 4 (GA4) Strict Event Types
 * Defines end-to-end schemas for deep telemetry & user behavior measurement.
 * Reference: docs/ke_hoach.md - Sprint 6 (Mục 1) & Rules.md
 */

import type { WorldTrack } from './user';

/**
 * Parameters for 'onboarding_complete' event
 * Tracks universe selection and initial funnel conversion.
 */
export interface OnboardingCompleteParams {
  /** The universe chosen by the player (kids, teens, or adults) */
  world_track: WorldTrack;
  /** Authentication status when onboarding completes (guest vs google) */
  auth_method?: 'guest' | 'google';
  /** ID of the initial tutorial or first stage completed */
  completed_stage_id?: number;
  /** Duration in seconds taken to complete the initial onboarding */
  duration_seconds?: number;
}

/**
 * Parameters for 'stage_win' event
 * Tracks player victories, accuracy, and clear rate across stages.
 */
export interface StageWinParams {
  /** The universe of the completed stage */
  world_track: WorldTrack;
  /** Stage numeric ID */
  stage_id: number;
  /** Number of stars earned (1 - 3) */
  stars_earned: number;
  /** Total score accumulated during the stage */
  score: number;
  /** Accuracy percentage (0 - 100) */
  accuracy: number;
  /** Total elapsed gameplay time in seconds */
  duration_seconds: number;
  /** Whether this stage was a Spaced Repetition Boss stage */
  is_boss_stage: boolean;
  /** Whether the stage was cleared with 100% accuracy and 3/3 HP */
  is_perfect?: boolean;
}

/**
 * Parameters for 'stage_fail' event
 * Pinpoints difficulty spikes and stages with high drop-off rates.
 */
export interface StageFailParams {
  /** The universe of the failed stage */
  world_track: WorldTrack;
  /** Stage numeric ID */
  stage_id: number;
  /** Specific mini-game phase where the defeat occurred */
  failed_phase?: string;
  /** Accuracy percentage at the moment of game over */
  accuracy?: number;
  /** Seconds remaining on the clock when defeat occurred */
  time_remaining?: number;
  /** Whether this stage was a Spaced Repetition Boss stage */
  is_boss_stage: boolean;
}

/**
 * Parameters for 'mic_fallback_triggered' event
 * Measures microphone permission denial and unsupported browser rates.
 */
export interface MicFallbackParams {
  /** The active universe during the speech challenge */
  world_track: WorldTrack;
  /** Current stage ID */
  stage_id: number;
  /** The root cause triggering the fallback */
  error_reason: 'not-allowed' | 'service-not-allowed' | 'unsupported' | 'manual_switch' | 'recognition_error' | string;
  /** Vocabulary word or sentence being evaluated when fallback occurred */
  target_word?: string;
  /** User Agent snippet for identifying problematic in-app browsers */
  user_agent?: string;
}

/**
 * Parameters for 'page_view' event
 */
export interface PageViewParams {
  page_path: string;
  page_title: string;
}

/**
 * Parameters for 'shop_purchase' event
 */
export interface ShopPurchaseParams {
  item_type: 'freeze_shield' | 'refill_energy';
  gold_spent: number;
  world_track: WorldTrack;
}

/**
 * Parameters for 'universe_switch' event
 */
export interface UniverseSwitchParams {
  from_track: WorldTrack;
  to_track: WorldTrack;
}

/**
 * Strongly-typed mapping of all EngVerse GA4 event names to their parameter interfaces.
 */
export interface AnalyticsEventMap {
  onboarding_complete: OnboardingCompleteParams;
  stage_win: StageWinParams;
  stage_fail: StageFailParams;
  mic_fallback_triggered: MicFallbackParams;
  page_view: PageViewParams;
  shop_purchase: ShopPurchaseParams;
  universe_switch: UniverseSwitchParams;
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

/**
 * Standard gtag function signature adhering strictly to Google Analytics 4 conventions.
 */
export type GtagFunction = (
  command: 'config' | 'event' | 'set' | 'consent' | 'js',
  targetIdOrEventName: string | Date,
  params?: Record<string, unknown>
) => void;

/**
 * Global Window augmentation for GA4 dataLayer and gtag function.
 */
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: GtagFunction;
  }
}

