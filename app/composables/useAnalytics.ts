/**
 * EngVerse - Advanced Google Analytics 4 (GA4) Composable
 * Dispatches mission-critical gameplay telemetry, funnel metrics,
 * and adaptive mic fallback occurrences to Google Analytics 4.
 *
 * Strict TypeScript (0 any), SSR-safe, AdBlocker resilient.
 * Reference: docs/ke_hoach.md - Sprint 6 (Mục 1) & Rules.md
 */

import { useRuntimeConfig } from '#app';
import type {
  AnalyticsEventName,
  AnalyticsEventMap,
  OnboardingCompleteParams,
  StageWinParams,
  StageFailParams,
  MicFallbackParams,
  ShopPurchaseParams,
  UniverseSwitchParams,
} from '~/types/analytics';

export function useAnalytics() {
  const config = useRuntimeConfig();
  const rawGtagId = config.public.gtagId;
  const isGtagConfigured = Boolean(rawGtagId && rawGtagId !== 'G-XXXXXXXXXX');

  /**
   * Generic type-safe event dispatcher for Google Analytics 4
   */
  function trackEvent<T extends AnalyticsEventName>(
    eventName: T,
    params: AnalyticsEventMap[T]
  ): void {
    if (!import.meta.client) {
      return;
    }

    try {
      if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
        window.gtag('event', eventName, params as unknown as Record<string, unknown>);
      }

      if (process.env.NODE_ENV !== 'production' || !isGtagConfigured) {
        console.debug(`[Analytics Track] [${eventName}]`, params);
      }
    } catch (err) {
      // Gracefully prevent analytics failures (such as AdBlockers) from disrupting gameplay
      console.warn(`[Analytics] Error dispatching event "${eventName}":`, err);
    }
  }

  /**
   * 1. Onboarding Funnel: Fired when player chooses a universe and completes the first challenge/signup
   * Reveals which demographic (Kids, Teens, Adults) is driving the highest initial adoption.
   */
  function trackOnboardingComplete(params: OnboardingCompleteParams): void {
    trackEvent('onboarding_complete', params);
  }

  /**
   * 2. Stage Victory: Fired upon victorious completion of a stage
   * Measures player retention, accuracy, and progression pacing.
   */
  function trackStageWin(params: StageWinParams): void {
    trackEvent('stage_win', params);
  }

  /**
   * 3. Stage Defeat: Fired when a player runs out of hearts or fails a challenge
   * Identifies stages with abnormally high failure rates to calibrate difficulty curves.
   */
  function trackStageFail(params: StageFailParams): void {
    trackEvent('stage_fail', params);
  }

  /**
   * 4. Adaptive Mic Fallback: Fired when browser denies microphone or lacks STT support
   * Measures the real-world percentage of users routed to the Golden Fallback "Rhythm Tap" mode.
   */
  function trackMicFallbackTriggered(params: MicFallbackParams): void {
    trackEvent('mic_fallback_triggered', params);
  }

  /**
   * 5. Shop Purchase: Fired when Freeze Shields or Energy refills are purchased
   */
  function trackShopPurchase(params: ShopPurchaseParams): void {
    trackEvent('shop_purchase', params);
  }

  /**
   * 6. Universe Switch: Fired when player shifts between Kids, Teens, and Adults tracks
   */
  function trackUniverseSwitch(params: UniverseSwitchParams): void {
    trackEvent('universe_switch', params);
  }

  /**
   * Associates the current analytics session with an authenticated Firebase UID
   */
  function setUserId(uid: string): void {
    if (!import.meta.client) return;

    try {
      if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
        window.gtag('set', 'user_id', { user_id: uid });
      }
    } catch (err) {
      console.warn('[Analytics] Failed to set user_id:', err);
    }
  }

  /**
   * Sets custom user properties (e.g. current universe, player level)
   */
  function setUserProperties(properties: Record<string, string | number | boolean>): void {
    if (!import.meta.client) return;

    try {
      if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
        window.gtag('set', 'user_properties', properties);
      }
    } catch (err) {
      console.warn('[Analytics] Failed to set user_properties:', err);
    }
  }

  return {
    isGtagConfigured,
    trackEvent,
    trackOnboardingComplete,
    trackStageWin,
    trackStageFail,
    trackMicFallbackTriggered,
    trackShopPurchase,
    trackUniverseSwitch,
    setUserId,
    setUserProperties,
  };
}

