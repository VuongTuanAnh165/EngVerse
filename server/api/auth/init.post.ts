import { defineEventHandler, readBody, createError, getRequestHeader } from 'h3';
import { adminAuth, adminDb } from '../../utils/firebaseAdmin';
import {
  type AuthInitPayload,
  type AuthInitResponse,
  type UserProfile,
  type WorldTrack,
  createDefaultUserProfile,
} from '~/types/user';

/**
 * Serverless Turnstile Verification
 */
async function verifyCloudflareTurnstile(
  turnstileToken: string,
  secretKey: string,
  remoteIp?: string
): Promise<boolean> {
  // Allow Cloudflare testing dummy keys in development
  if (
    !secretKey ||
    secretKey === '1x0000000000000000000000000000000AA' ||
    turnstileToken.startsWith('1x00000000000000000000AA')
  ) {
    return true;
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', turnstileToken);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const verification = await $fetch<{ success: boolean }>(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: formData,
      }
    );

    return !!verification.success;
  } catch (error) {
    console.error('[Turnstile] Verification failed:', error);
    return false;
  }
}

/**
 * POST /api/auth/init
 * Authenticates Firebase ID Token, verifies Turnstile, and initializes/merges
 * 1-Document-Per-User in Firestore (zero client writes).
 */
export default defineEventHandler(async (event): Promise<AuthInitResponse> => {
  const body = await readBody<AuthInitPayload>(event);

  if (!body || !body.idToken) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thiếu idToken xác thực từ Firebase.',
    });
  }

  const config = useRuntimeConfig();

  // 1. Verify Cloudflare Turnstile bot detection
  if (body.turnstileToken) {
    const remoteIp =
      getRequestHeader(event, 'cf-connecting-ip') ||
      getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim();

    const isHuman = await verifyCloudflareTurnstile(
      body.turnstileToken,
      config.turnstileSecretKey,
      remoteIp
    );

    if (!isHuman) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Xác thực Cloudflare Turnstile không hợp lệ.',
      });
    }
  }

  // 2. Verify Firebase ID Token securely using Firebase Admin SDK
  let uid = '';
  let email: string | null = null;
  let displayName = 'Explorer';
  let avatar = 'rookie_explorer';

  try {
    const decodedToken = await adminAuth.verifyIdToken(body.idToken);
    uid = decodedToken.uid;
    email = decodedToken.email || null;
    if (decodedToken.name) displayName = decodedToken.name;
    if (decodedToken.picture) avatar = decodedToken.picture;
  } catch (authError) {
    console.error('[AuthInit] Firebase token verification failed:', authError);
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'ID Token không hợp lệ hoặc đã hết hạn.',
    });
  }

  const userRef = adminDb.collection('users').doc(uid);
  const docSnap = await userRef.get();
  const now = Date.now();

  // 3. Existing User Path
  if (docSnap.exists) {
    const existingData = docSnap.data() as UserProfile;

    // Refresh timestamp
    await userRef.update({
      updatedAt: now,
    });

    existingData.updatedAt = now;
    existingData.isGuest = false;

    return {
      success: true,
      user: existingData,
      isNewUser: false,
      message: 'Chào mừng bạn quay trở lại EngVerse!',
    };
  }

  // 4. New User Path (Sync Guest Progress into First Firestore Document)
  const chosenTrack: WorldTrack =
    body.guestProgress?.worldTrack === 'teens' ||
    body.guestProgress?.worldTrack === 'adults' ||
    body.guestProgress?.worldTrack === 'kids'
      ? body.guestProgress.worldTrack
      : 'kids';

  const newProfile = createDefaultUserProfile(uid, displayName, avatar, chosenTrack);
  newProfile.email = email;
  newProfile.createdAt = now;
  newProfile.updatedAt = now;
  newProfile.isGuest = false;

  // Merge validated guest progress from 30-second trial
  if (body.guestProgress) {
    const guest = body.guestProgress;

    // Apply safety guards against tampered guest local data
    if (typeof guest.gold === 'number' && guest.gold >= 0) {
      newProfile.gold = Math.min(500, Math.max(100, Math.floor(guest.gold)));
    }
    if (typeof guest.exp === 'number' && guest.exp >= 0) {
      newProfile.exp = Math.min(500, Math.floor(guest.exp));
    }
    if (Array.isArray(guest.collectedCards)) {
      newProfile.collectedCards = guest.collectedCards.slice(0, 5);
    }

    // Merge track progress (capped at initial tutorial stage)
    if (guest.progress && guest.progress.tracks) {
      const guestTracks = guest.progress.tracks;
      for (const trackKey of ['kids', 'teens', 'adults'] as const) {
        if (guestTracks[trackKey]) {
          const guestTrack = guestTracks[trackKey];
          if (typeof guestTrack.unlockedStage === 'number') {
            newProfile.progress.tracks[trackKey].unlockedStage = Math.min(
              2,
              Math.max(1, guestTrack.unlockedStage)
            );
          }
          if (guestTrack.stageStars && typeof guestTrack.stageStars === 'object') {
            const stars: Record<string, number> = {};
            for (const [sId, sCount] of Object.entries(guestTrack.stageStars)) {
              if (sId === '1' && typeof sCount === 'number') {
                stars['1'] = Math.min(3, Math.max(1, Math.floor(sCount)));
              }
            }
            newProfile.progress.tracks[trackKey].stageStars = stars;
          }
        }
      }
    }
  }

  // Atomically write new profile to Firestore (1 doc per user rule)
  await userRef.set(newProfile);

  return {
    success: true,
    user: newProfile,
    isNewUser: true,
    message: 'Tài khoản đã được khởi tạo và lưu tiến trình thành công!',
  };
});
