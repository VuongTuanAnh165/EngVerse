/**
 * EngVerse - Free Simulator Rate Limiting & Premium Gating Middleware
 * Enforces server-side rate limits, checks daily session quotas,
 * and handles Premium tier verification for Endgame conversational simulator.
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.4, Tasks 4.5 & 4.6
 */

import { defineEventHandler, getRequestHeader, setResponseHeader, createError } from 'h3';
import { adminAuth, adminDb } from '../utils/firebaseAdmin';
import { getTodayDateString } from '../utils/cryptoProof';
import { MAX_DAILY_FREE_SIM_SESSIONS } from '~/types/freeSimulator';

export default defineEventHandler(async (event) => {
  const path = event.path || '';

  // Only apply to AI Free Simulator endpoints
  if (!path.startsWith('/api/game/free-simulator/')) {
    return;
  }

  const todayStr = getTodayDateString();
  const authHeader = getRequestHeader(event, 'authorization');
  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  let uid: string | null = null;
  let isPremium = false;
  let dailySessionsUsed = 0;

  // 1. Resolve Authentication & Subscription Tier
  if (token && token !== 'guest') {
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;

      // Read user document for subscription tier & daily session counter (1-Doc-Per-User)
      const userRef = adminDb.collection('users').doc(uid);
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        const data = userDoc.data();
        const tier = data?.subscriptionTier;
        const expiresAt = data?.subscriptionExpiresAt;

        // Check if premium is active
        if ((tier === 'premium' || tier === 'vip') && (!expiresAt || expiresAt > Date.now())) {
          isPremium = true;
        }

        const freeSimProgress = data?.freeSimulator;
        if (freeSimProgress && freeSimProgress.lastPlayedDate === todayStr) {
          dailySessionsUsed = freeSimProgress.dailySessionsCount || 0;
        }
      }
    } catch {
      // Invalid token or guest mode; will be handled gracefully by the endpoint
      isPremium = false;
    }
  }

  // 2. Attach Free Simulator Context to Event
  event.context.freeSim = {
    uid,
    isPremium,
    dailySessionsUsed,
    maxDailyFreeLimit: MAX_DAILY_FREE_SIM_SESSIONS,
    isQuotaExhausted: !isPremium && dailySessionsUsed >= MAX_DAILY_FREE_SIM_SESSIONS,
  };

  // 3. Set standard response telemetry headers
  setResponseHeader(event, 'X-FreeSim-Tier', isPremium ? 'premium' : 'free');
  setResponseHeader(
    event,
    'X-FreeSim-Daily-Limit',
    isPremium ? 'unlimited' : String(MAX_DAILY_FREE_SIM_SESSIONS)
  );
  setResponseHeader(
    event,
    'X-FreeSim-Daily-Remaining',
    isPremium ? 'unlimited' : String(Math.max(0, MAX_DAILY_FREE_SIM_SESSIONS - dailySessionsUsed))
  );
});

