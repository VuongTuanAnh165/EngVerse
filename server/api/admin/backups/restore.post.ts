/**
 * POST /api/admin/backups/restore
 * Restores a snapshot file to its target location with safety verification.
 */

import { defineEventHandler, readBody, createError } from 'h3';
import { restoreBackup } from '../../../utils/adminStorage';

export default defineEventHandler(async (event): Promise<{ success: boolean; targetFile: string }> => {
  const body = await readBody<{ filename: string }>(event);

  if (!body || !body.filename) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thiếu tên file sao lưu cần phục hồi (filename).',
    });
  }

  return await restoreBackup(body.filename);
});

