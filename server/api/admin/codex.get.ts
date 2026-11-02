/**
 * GET /api/admin/codex
 * Retrieves complete Codex dataset (cards, collections, titles, metadata).
 */

import { defineEventHandler } from 'h3';
import { readCodex } from '../../utils/adminStorage';
import type { CodexData } from '~/types/game';

export default defineEventHandler(async (): Promise<CodexData> => {
  return await readCodex();
});

