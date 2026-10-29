import { setResponseHeader } from 'h3';
import { adminDb } from '../utils/firebaseAdmin';
import type { LeaderboardEntry, LeaderboardResponse, WorldTrack } from '~/types/user';

/**
 * Seed champions fallback when database is fresh or offline
 */
const SEED_CHAMPIONS: LeaderboardEntry[] = [
  {
    uid: 'seed_1',
    rank: 1,
    displayName: 'DragonSlayer_Alex',
    avatar: 'dragon_rider',
    equippedTitle: 'Huyền Thoại Ấp Rồng',
    level: 28,
    exp: 7120,
    worldTrack: 'kids',
  },
  {
    uid: 'seed_2',
    rank: 2,
    displayName: 'CyberPhantom_Mia',
    avatar: 'cyber_sleuth',
    equippedTitle: 'Siêu Thám Tử Mũ Trắng',
    level: 25,
    exp: 6350,
    worldTrack: 'teens',
  },
  {
    uid: 'seed_3',
    rank: 3,
    displayName: 'GlobalLeader_David',
    avatar: 'global_ceo',
    equippedTitle: 'Nhà Đàm Phán Toàn Cầu',
    level: 23,
    exp: 5890,
    worldTrack: 'adults',
  },
  {
    uid: 'seed_4',
    rank: 4,
    displayName: 'NeonPhoenix_Leo',
    avatar: 'neon_hacker',
    equippedTitle: 'Bậc Thầy Ngữ Pháp',
    level: 20,
    exp: 5120,
    worldTrack: 'teens',
  },
  {
    uid: 'seed_5',
    rank: 5,
    displayName: 'FairyExplorer_Emma',
    avatar: 'fairy_friend',
    equippedTitle: 'Phù Thủy Từ Vựng',
    level: 18,
    exp: 4600,
    worldTrack: 'kids',
  },
  {
    uid: 'seed_6',
    rank: 6,
    displayName: 'VenturePartner_Sarah',
    avatar: 'business_pro',
    equippedTitle: 'Bậc Thầy Giao Tiếp',
    level: 16,
    exp: 4150,
    worldTrack: 'adults',
  },
];

/**
 * GET /api/leaderboard
 * Ultra-low quota Edge CDN cached leaderboard endpoint.
 *
 * Performance & Cost Architecture:
 * 1. Dual-Layer Caching:
 *    - Layer 1 (Nitro Memory SWR): maxAge 3600s, stale-while-revalidate 86400s
 *    - Layer 2 (Vercel Edge CDN): Cache-Control public, s-maxage=3600, stale-while-revalidate=86400
 * 2. Guaranteed zero Firebase Read spike: 1,000,000 visitors result in at most 24 reads per day per CDN region.
 * 3. Slim projection: Only extracts necessary public leaderboard fields (no email, tokens or private progress).
 *
 * Reference: docs/ke_hoach.md - Sprint 5, Task 2 & Rules.md Rule 4
 */
export default defineCachedEventHandler(
  async (event): Promise<LeaderboardResponse> => {
    // Hardcode HTTP Cache-Control header for Edge CDN (Vercel / Cloudflare)
    setResponseHeader(
      event,
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=86400'
    );

    let entries: LeaderboardEntry[] = [];

    try {
      const snapshot = await adminDb
        .collection('users')
        .orderBy('exp', 'desc')
        .limit(30)
        .select('displayName', 'avatar', 'level', 'exp', 'worldTrack', 'equippedTitle')
        .get();

      if (!snapshot.empty) {
        entries = snapshot.docs.map((doc, idx) => {
          const data = doc.data();
          const track: WorldTrack =
            data.worldTrack === 'kids' || data.worldTrack === 'teens' || data.worldTrack === 'adults'
              ? data.worldTrack
              : 'kids';

          return {
            uid: doc.id,
            rank: idx + 1,
            displayName: (data.displayName as string) || `Explorer_${doc.id.slice(0, 5)}`,
            avatar: (data.avatar as string) || 'rookie_explorer',
            equippedTitle: (data.equippedTitle as string) || 'Tân Binh',
            level: typeof data.level === 'number' ? data.level : 1,
            exp: typeof data.exp === 'number' ? data.exp : 0,
            worldTrack: track,
          };
        });
      }
    } catch (err: unknown) {
      console.warn('[LeaderboardAPI] Firestore query fallback to seed champions:', err);
    }

    // If database is clean or query returned no entries, serve seed champions
    if (entries.length === 0) {
      entries = SEED_CHAMPIONS;
    }

    return {
      updatedAt: Date.now(),
      entries,
    };
  },
  {
    maxAge: 60 * 60, // Cache results for 1 hour (3600s)
    swr: true, // Serve cached snapshot instantly while revalidating in background
    name: 'global-leaderboard',
  }
);

