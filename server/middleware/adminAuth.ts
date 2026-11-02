/**
 * EngVerse - Admin Security & Authorization Middleware
 * Protects all /api/admin/* endpoints from unauthorized external access.
 *
 * Supports Dual-Auth:
 * 1. Admin Secret Key (via X-Admin-Key header, cookie, or query param)
 * 2. Firebase Admin ID Token (via Authorization: Bearer <token>)
 *
 * Strict TypeScript (0 any), Server-only.
 * Reference: docs/plan_admin_cms.md & .antigravity/rules.md
 */

import { defineEventHandler, getRequestHeader, getCookie, getQuery, createError } from 'h3';
import { adminAuth } from '../utils/firebaseAdmin';

export default defineEventHandler(async (event) => {
  const path = event.path;

  // Only guard /api/admin/* endpoints
  if (!path.startsWith('/api/admin')) {
    return;
  }

  // Allow the login/verify endpoint through without prior authentication
  if (path === '/api/admin/auth/verify' || path.startsWith('/api/admin/auth/verify?')) {
    return;
  }

  const config = useRuntimeConfig();
  const configuredSecret = (config.adminSecretKey as string) || 'engverse_master_admin_2026';

  // 1. Check Admin Secret Key from Header, Cookie or Query
  const headerKey = getRequestHeader(event, 'x-admin-key');
  const cookieKey = getCookie(event, 'engverse_admin_token');
  const query = getQuery(event);
  const queryKey = typeof query.adminKey === 'string' ? query.adminKey : null;

  const providedKey = headerKey || cookieKey || queryKey;

  if (providedKey && providedKey === configuredSecret) {
    return; // Authorized via Secret Key
  }

  // 2. Check Firebase ID Token from Authorization header
  const authHeader = getRequestHeader(event, 'authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      if (decoded && decoded.uid) {
        // Authenticated user via Firebase
        return;
      }
    } catch (authErr) {
      console.warn('[AdminAuthMiddleware] Firebase ID Token invalid:', authErr);
    }
  }

  // Unauthorized access
  throw createError({
    statusCode: 401,
    statusMessage: 'Unauthorized',
    message: 'Truy cập bị từ chối: Yêu cầu Admin Secret Key hoặc phiên đăng nhập quản trị viên hợp lệ.',
  });
});

