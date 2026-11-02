/**
 * GET /api/game/daily-challenge
 * Returns the Daily Challenge bundle for today (Reset 00:00 GMT+7)
 * Personalizes Phase 1 (Vocab Sprint) with 50% words from user's srsBossQueue if authenticated.
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.2 & Task 2.1
 */

import { defineEventHandler, getQuery, getRequestHeader } from 'h3';
import { adminAuth, adminDb } from '../../utils/firebaseAdmin';
import {
  generateDailyChallenge,
  getVietnamDateString,
} from '../../utils/dailyChallengeGenerator';
import type { DailyChallengeData } from '~/types/dailyChallenge';
import type { UserProfile } from '~/types/user';

export default defineEventHandler(async (event): Promise<{ success: boolean; challenge: DailyChallengeData }> => {
  const query = getQuery(event);
  const todayStr = getVietnamDateString();
  const dateStr = typeof query.date === 'string' && query.date.match(/^\d{4}-\d{2}-\d{2}$/)
    ? query.date
    : todayStr;

  // Check authentication to retrieve user's srsBossQueue if available
  let srsVocabIds: string[] = [];
  const authHeader = getRequestHeader(event, 'authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token && token !== 'guest') {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        const userRef = adminDb.collection('users').doc(decoded.uid);
        const userDocSnap = await userRef.get();
        if (userDocSnap.exists) {
          const userDoc = userDocSnap.data() as UserProfile;
          if (Array.isArray(userDoc.srsBossQueue)) {
            srsVocabIds = userDoc.srsBossQueue;
          }
        }
      } catch (authErr) {
        // Fallback to guest non-personalized mode gracefully
        console.warn('[DailyChallengeGet] Token verification skipped for guest/expired session:', authErr);
      }
    }
  }

  // Fallback for guest mode: allow passing srsVocabIds via query parameters
  if (srsVocabIds.length === 0 && query.srsVocabIds) {
    if (typeof query.srsVocabIds === 'string') {
      srsVocabIds = query.srsVocabIds.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (Array.isArray(query.srsVocabIds)) {
      srsVocabIds = query.srsVocabIds.map(String).filter(Boolean);
    }
  }

  const challenge = await generateDailyChallenge(dateStr, srsVocabIds);

  return {
    success: true,
    challenge,
  };
});

