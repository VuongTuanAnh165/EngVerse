/**
 * EngVerse - Stateless Anti-Cheat HMAC Verification Utility
 * Generates and verifies cryptographic signatures for AI Roleplay completion proofs
 * and stage completion validation with ZERO database reads/writes.
 *
 * Strict TypeScript (0 any), Server-only.
 * Reference: docs/ke_hoach.md - Sprint 4 & Rules.md Rule 3
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Returns formatted ISO date string YYYY-MM-DD
 */
export function getTodayDateString(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface ProofGenerationParams {
  uid: string;
  worldTrack: string;
  stageId: number | string;
  dateStr?: string;
}

/**
 * Generates a tamper-proof HMAC-SHA256 signature for AI mission completion
 * Format: YYYY-MM-DD.<64_char_hex_hmac>
 */
export function generateAiCompletionProof(
  params: ProofGenerationParams,
  secretKey: string
): string {
  const dateStr = params.dateStr || getTodayDateString();
  const fallbackKey = 'engverse_default_stateless_hmac_secret_2026';
  const effectiveKey = secretKey || process.env.HMAC_SECRET_KEY || fallbackKey;

  const canonicalPayload = `${params.uid}:${params.worldTrack}:${params.stageId}:${dateStr}`;

  const hmac = createHmac('sha256', effectiveKey)
    .update(canonicalPayload)
    .digest('hex');

  return `${dateStr}.${hmac}`;
}

/**
 * Verifies the validity of an AI completion proof token using constant-time comparison
 */
export function verifyAiCompletionProof(
  proof: string,
  params: { uid: string; worldTrack: string; stageId: number | string },
  secretKey: string
): boolean {
  if (!proof || typeof proof !== 'string' || !proof.includes('.')) {
    return false;
  }

  const parts = proof.split('.');
  if (parts.length !== 2) {
    return false;
  }

  const [dateStr, providedHmac] = parts;
  if (!dateStr || !providedHmac || providedHmac.length !== 64) {
    return false;
  }

  // Validate date is within valid 48-hour window (today or yesterday) to prevent replay attacks
  const tokenDate = new Date(`${dateStr}T00:00:00Z`).getTime();
  const now = Date.now();
  const diffHours = (now - tokenDate) / (1000 * 60 * 60);

  // Must not be older than 48h and not more than 24h in the future
  if (isNaN(tokenDate) || diffHours > 48 || diffHours < -24) {
    return false;
  }

  const fallbackKey = 'engverse_default_stateless_hmac_secret_2026';
  const effectiveKey = secretKey || process.env.HMAC_SECRET_KEY || fallbackKey;

  const expectedHmac = createHmac('sha256', effectiveKey)
    .update(`${params.uid}:${params.worldTrack}:${params.stageId}:${dateStr}`)
    .digest('hex');

  try {
    const expectedBuf = Buffer.from(expectedHmac, 'hex');
    const providedBuf = Buffer.from(providedHmac, 'hex');

    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }

    return timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

