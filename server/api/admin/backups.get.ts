/**
 * GET /api/admin/backups
 * Returns list of all automatic snapshot backups available for rollback.
 */

import { defineEventHandler } from 'h3';
import { listBackups } from '../../utils/adminStorage';
import type { AdminBackupFileInfo } from '~/types/admin';

export default defineEventHandler(async (): Promise<AdminBackupFileInfo[]> => {
  return await listBackups();
});

