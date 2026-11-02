/**
 * POST /api/user/profile
 * Updates user custom cosmetic rewards (equippedTitle, avatarFrame, displayName)
 * with strict server-side validation against unlocked cosmetics inventory.
 * 1-Doc-Per-User architecture (0 subcollections).
 */

import { defineEventHandler, readBody, createError, getRequestHeader } from 'h3';
import { adminAuth, adminDb } from '../../utils/firebaseAdmin';

interface UpdateProfilePayload {
  idToken?: string;
  equippedTitle?: string;
  avatarFrame?: string;
  displayName?: string;
}

interface UpdateProfileResponse {
  success: boolean;
  message?: string;
  equippedTitle?: string;
  avatarFrame?: string;
  displayName?: string;
}

export default defineEventHandler(async (event): Promise<UpdateProfileResponse> => {
  const body = await readBody<UpdateProfilePayload>(event);

  if (!body) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thiếu dữ liệu cập nhật hồ sơ.',
    });
  }

  // 1. Resolve Firebase Auth Token
  const authHeader = getRequestHeader(event, 'authorization');
  let token = body.idToken;
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  if (!token) {
    // Guest user updating cosmetics locally - echo back
    return {
      success: true,
      message: 'Cập nhật giao diện thành công (Chế độ Khách).',
      equippedTitle: body.equippedTitle,
      avatarFrame: body.avatarFrame,
      displayName: body.displayName,
    };
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch (err: unknown) {
    console.warn('[ProfileAPI] Invalid token:', err);
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
    });
  }

  const userRef = adminDb.collection('users').doc(uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Không tìm thấy hồ sơ người chơi.',
    });
  }

  const userData = userDoc.data();
  const unlockedTitles: string[] = Array.isArray(userData?.unlockedTitles)
    ? userData?.unlockedTitles
    : ['rookie_explorer', 'Tân Binh'];
  const unlockedFrames: string[] = Array.isArray(userData?.unlockedAvatarFrames)
    ? userData?.unlockedAvatarFrames
    : ['default'];

  const updates: Record<string, unknown> = {
    updatedAt: Date.now(),
  };

  // Validate & Apply equippedTitle
  if (body.equippedTitle !== undefined) {
    const title = body.equippedTitle.trim();
    const isRookie = title === 'rookie_explorer' || title === 'Tân Binh';
    if (isRookie || unlockedTitles.includes(title)) {
      updates.equippedTitle = title;
    } else {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: `Bạn chưa mở khóa danh hiệu: "${title}".`,
      });
    }
  }

  // Validate & Apply avatarFrame
  if (body.avatarFrame !== undefined) {
    const frame = body.avatarFrame.trim();
    const isDefault = frame === 'default';
    if (isDefault || unlockedFrames.includes(frame)) {
      updates.avatarFrame = frame;
    } else {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: `Bạn chưa mở khóa khung avatar: "${frame}".`,
      });
    }
  }

  // Optional displayName update
  if (body.displayName !== undefined) {
    const cleanName = body.displayName.trim().slice(0, 32);
    if (cleanName.length > 0) {
      updates.displayName = cleanName;
    }
  }

  await userRef.update(updates);

  return {
    success: true,
    message: 'Trang bị phần thưởng thành công!',
    equippedTitle: (updates.equippedTitle as string) || userData?.equippedTitle,
    avatarFrame: (updates.avatarFrame as string) || userData?.avatarFrame,
    displayName: (updates.displayName as string) || userData?.displayName,
  };
});

