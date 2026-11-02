/**
 * GET /api/admin/export
 * Exports complete datasets across all 3 universes and Codex in a single unified JSON bundle.
 */

import { defineEventHandler } from 'h3';
import { generateExportBundle } from '../../utils/adminStorage';
import type { AdminExportBundle } from '~/types/admin';

export default defineEventHandler(async (): Promise<AdminExportBundle> => {
  return await generateExportBundle();
});

