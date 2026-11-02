/**
 * POST /api/admin/auth/verify
 * Validates the admin secret key and establishes an admin session cookie.
 */

import { defineEventHandler, readBody, createError, setCookie } from 'h3';
import type { AdminAuthVerifyPayload, AdminAuthResponse } from '~/types/admin';

export default defineEventHandler(async (event): Promise<AdminAuthResponse> => {
  const body = await readBody<AdminAuthVerifyPayload>(event);

  if (!body || typeof body.key !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Vui lòng cung cấp mã khóa quản trị viên (Admin Key).',
    });
  }

  const config = useRuntimeConfig();
  const configuredSecret = (config.adminSecretKey as string) || 'engverse_master_admin_2026';

  if (body.key.trim() !== configuredSecret.trim()) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Mã khóa quản trị viên không chính xác.',
    });
  }

  // Set auth cookie valid for 7 days
  setCookie(event, 'engverse_admin_token', configuredSecret.trim(), {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return {
    success: true,
    message: 'Xác thực Quản trị viên thành công.',
    role: 'master_admin',
  };
});

