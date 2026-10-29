import type { H3Event } from 'h3';

interface RateLimitRule {
  limit: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Endpoint-specific rate limiting policies
 */
const ROUTE_RULES: Array<{ prefix: string; rule: RateLimitRule }> = [
  { prefix: '/api/ai/', rule: { limit: 15, windowMs: 60_000 } }, // 15 req/min for AI
  { prefix: '/api/auth/', rule: { limit: 20, windowMs: 60_000 } }, // 20 req/min for Auth
  { prefix: '/api/game/', rule: { limit: 30, windowMs: 60_000 } }, // 30 req/min for Game validation
  { prefix: '/api/shop/', rule: { limit: 20, windowMs: 60_000 } }, // 20 req/min for Transactions
];

const DEFAULT_RULE: RateLimitRule = {
  limit: 60,
  windowMs: 60_000, // 60 req/min for general endpoints
};

/**
 * In-memory token store with TTL cleanup
 */
const rateLimitStore = new Map<string, RateLimitEntry>();
const MAX_STORE_ENTRIES = 5_000;
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanupAt = Date.now();

/**
 * Purges expired keys from memory to guarantee zero memory leaks
 */
function purgeExpiredEntries(now: number): void {
  lastCleanupAt = now;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }

  // Hard safety cap: if map is still excessively large, evict oldest entries
  if (rateLimitStore.size > MAX_STORE_ENTRIES) {
    const keysToPurge = Array.from(rateLimitStore.keys()).slice(
      0,
      Math.floor(MAX_STORE_ENTRIES * 0.2)
    );
    for (const key of keysToPurge) {
      rateLimitStore.delete(key);
    }
  }
}

// Background cleanup timer for persistent Node runtime
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    purgeExpiredEntries(Date.now());
  }, CLEANUP_INTERVAL_MS);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

/**
 * Extracts the real client IP across CDNs (Cloudflare, Vercel, Proxies)
 */
function resolveClientIp(event: H3Event): string {
  const cfIp = getRequestHeader(event, 'cf-connecting-ip');
  if (cfIp) {
    return cfIp.trim();
  }

  const forwarded = getRequestHeader(event, 'x-forwarded-for');
  if (forwarded) {
    const primaryIp = forwarded.split(',')[0]?.trim();
    if (primaryIp) {
      return primaryIp;
    }
  }

  const realIp = getRequestHeader(event, 'x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return event.node.req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Resolves optional User UID from custom header or authorization
 */
function resolveClientUid(event: H3Event): string | null {
  const customUid = getRequestHeader(event, 'x-user-uid');
  if (customUid && customUid.trim().length > 0) {
    return customUid.trim();
  }
  return null;
}

/**
 * Finds the applicable rate limit rule based on the request URL path
 */
function matchRule(path: string): RateLimitRule {
  for (const item of ROUTE_RULES) {
    if (path.startsWith(item.prefix)) {
      return item.rule;
    }
  }
  return DEFAULT_RULE;
}

export default defineEventHandler((event: H3Event) => {
  const path = event.path || '';

  // Only apply rate limiting to /api/** routes
  if (!path.startsWith('/api/')) {
    return;
  }

  const now = Date.now();

  // Serverless-safe periodic check: purge expired keys if interval passed
  if (now - lastCleanupAt > CLEANUP_INTERVAL_MS || rateLimitStore.size > MAX_STORE_ENTRIES) {
    purgeExpiredEntries(now);
  }

  const clientIp = resolveClientIp(event);
  const clientUid = resolveClientUid(event);
  const rule = matchRule(path);

  // Group key by Route Group + UID (if authenticated) or IP
  const routeGroup = path.split('/').slice(0, 3).join('/');
  const identity = clientUid ? `uid:${clientUid}` : `ip:${clientIp}`;
  const rateLimitKey = `${routeGroup}:${identity}`;

  let entry = rateLimitStore.get(rateLimitKey);

  if (!entry || now >= entry.resetAt) {
    entry = {
      count: 1,
      resetAt: now + rule.windowMs,
    };
    rateLimitStore.set(rateLimitKey, entry);
  } else {
    entry.count += 1;
  }

  const remaining = Math.max(0, rule.limit - entry.count);
  const resetSeconds = Math.ceil(entry.resetAt / 1000);

  // Set standard rate limit headers on response
  setResponseHeaders(event, {
    'X-RateLimit-Limit': String(rule.limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(resetSeconds),
  });

  // Check if limit exceeded
  if (entry.count > rule.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

    setResponseHeader(event, 'retry-after', retryAfterSeconds);

    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: 'Bạn đang gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít giây.',
      data: {
        retryAfter: retryAfterSeconds,
      },
    });
  }
});
