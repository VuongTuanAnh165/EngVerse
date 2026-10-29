/**
 * EngVerse - Public User Profile API (Serverless Edge-Cached)
 * Safely fetches public achievement data for social sharing & OG card generation.
 *
 * Strict Security & Cost Rules:
 * - 0 private secrets or emails leaked.
 * - Layered Edge CDN caching (5 mins cache, 1 hour SWR) prevents Firebase Read spikes from web crawlers.
 * - Reference: docs/ke_hoach.md - Sprint 6 (Mục 2) & Rules.md
 */

import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3';
import { adminDb } from '../../../utils/firebaseAdmin';
import type { PublicShareResponse, PublicShareProfile } from '~/types/share';
import type { WorldTrack } from '~/types/user';

/**
 * Fallback rookie profile for guest exploration or when database is offline
 */
function createFallbackProfile(uid: string): PublicShareProfile {
  return {
    uid,
    displayName: uid === 'guest_user' ? 'Nhà Thám Hiểm Tân Binh' : `Thám Hiểm #${uid.slice(0, 6)}`,
    avatar: 'rookie_explorer',
    level: 1,
    exp: 100,
    equippedTitle: 'Tân Binh Đa Vũ Trụ',
    streak: {
      current: 1,
      freezeShields: 0,
      lastPlayedDate: new Date().toISOString().split('T')[0],
    },
    worldTrack: 'kids',
    collectedCardsCount: 1,
    unlockedTitlesCount: 1,
  };
}

export default defineEventHandler(async (event): Promise<PublicShareResponse> => {
  // Edge CDN caching: 300s cache, 3600s stale-while-revalidate
  setResponseHeader(
    event,
    'Cache-Control',
    'public, s-maxage=300, stale-while-revalidate=3600'
  );

  const rawUid = getRouterParam(event, 'uid');
  if (!rawUid) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Mã người chơi (UID) không hợp lệ.',
    });
  }

  const uid = decodeURIComponent(rawUid).trim();

  // Handle guest or mock demo UIDs immediately without hitting database
  if (uid === 'guest_user' || uid === 'guest' || uid.startsWith('demo_')) {
    return {
      success: true,
      profile: createFallbackProfile(uid),
    };
  }

  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Không tìm thấy hồ sơ người chơi với mã này.',
      });
    }

    const data = userDoc.data();
    const track: WorldTrack =
      data?.worldTrack === 'kids' || data?.worldTrack === 'teens' || data?.worldTrack === 'adults'
        ? data.worldTrack
        : 'kids';

    const collectedCards = Array.isArray(data?.collectedCards) ? data.collectedCards : [];
    const unlockedTitles = Array.isArray(data?.unlockedTitles) ? data.unlockedTitles : ['Tân Binh'];

    const profile: PublicShareProfile = {
      uid: userDoc.id,
      displayName: (data?.displayName as string) || `Explorer_${userDoc.id.slice(0, 6)}`,
      avatar: (data?.avatar as string) || 'rookie_explorer',
      level: typeof data?.level === 'number' ? data.level : 1,
      exp: typeof data?.exp === 'number' ? data.exp : 0,
      equippedTitle: (data?.equippedTitle as string) || 'Tân Binh Đa Vũ Trụ',
      streak: {
        current: typeof data?.streak?.current === 'number' ? data.streak.current : 0,
        freezeShields: typeof data?.streak?.freezeShields === 'number' ? data.streak.freezeShields : 0,
        lastPlayedDate: (data?.streak?.lastPlayedDate as string) || '',
      },
      worldTrack: track,
      collectedCardsCount: collectedCards.length,
      unlockedTitlesCount: unlockedTitles.length,
    };

    return {
      success: true,
      profile,
    };
  } catch (err: unknown) {
    // If it's already an H3Error (like 404), rethrow
    if (typeof err === 'object' && err !== null && 'statusCode' in err) {
      throw err;
    }

    console.warn('[PublicProfileAPI] Database query failed, using safe fallback:', err);
    return {
      success: true,
      profile: createFallbackProfile(uid),
      message: 'Hồ sơ ngoại tuyến.',
    };
  }
});
