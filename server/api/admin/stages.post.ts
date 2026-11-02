/**
 * POST /api/admin/stages
 * Creates a new stage, automatically syncs corresponding Codex cards & collections,
 * and creates a safe snapshot backup before writing.
 */

import { defineEventHandler, readBody, createError } from 'h3';
import {
  readStages,
  writeStages,
  readCodex,
  writeCodex,
  syncStageWithCodex,
} from '../../utils/adminStorage';
import type { StageData } from '~/types/game';
import type { AdminStageSavePayload, AdminStageSaveResponse } from '~/types/admin';

export default defineEventHandler(async (event): Promise<AdminStageSaveResponse> => {
  const body = await readBody<AdminStageSavePayload>(event);

  if (!body || !body.stage) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thiếu dữ liệu cấu hình chặng (stage).',
    });
  }

  const stage = body.stage;
  const track = stage.worldTrack;

  if (!track || !['kids', 'teens', 'adults'].includes(track)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thế giới không hợp lệ (worldTrack: "kids" | "teens" | "adults").',
    });
  }

  if (typeof stage.stageId !== 'number' || stage.stageId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Mã chặng (stageId) phải là số nguyên dương lớn hơn 0.',
    });
  }

  if (!stage.title || !stage.title.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Tên chặng (title) không được để trống.',
    });
  }

  if (!Array.isArray(stage.vocabPool) || stage.vocabPool.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Kho từ vựng (vocabPool) phải có ít nhất 1 từ vựng.',
    });
  }

  // Ensure map position boundaries
  if (!stage.mapPosition || typeof stage.mapPosition.x !== 'number' || typeof stage.mapPosition.y !== 'number') {
    stage.mapPosition = { x: 50, y: 50 };
  } else {
    stage.mapPosition.x = Math.max(5, Math.min(95, stage.mapPosition.x));
    stage.mapPosition.y = Math.max(5, Math.min(95, stage.mapPosition.y));
  }

  // Default configuration fallback
  if (!stage.config) {
    stage.config = {
      vocabPickCount: Math.min(4, stage.vocabPool.length),
      grammarPickCount: Math.min(3, stage.grammarPool?.length || 0),
      voicePassThreshold: 0.7,
      timeLimitSeconds: 90,
    };
  }

  if (!stage.reward) {
    stage.reward = {
      baseExp: 100,
      baseGold: 50,
      firstClearBonusGold: 30,
    };
  }

  const existingStages = await readStages(track);
  const isDuplicate = existingStages.some((s) => s.stageId === stage.stageId);

  if (isDuplicate) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      message: `Chặng ID ${stage.stageId} đã tồn tại trong vũ trụ "${track}". Vui lòng chọn ID khác hoặc cập nhật chặng hiện tại.`,
    });
  }

  // Auto-sync with Codex
  const codex = await readCodex();
  const { syncedCardsCount } = syncStageWithCodex(stage, codex);

  // Append new stage and sort by stageId
  existingStages.push(stage);
  existingStages.sort((a, b) => a.stageId - b.stageId);

  // Write changes with safe backups
  const backupCreated = await writeStages(track, existingStages);
  await writeCodex(codex);

  return {
    success: true,
    stage,
    syncedCardsCount,
    backupCreated: backupCreated || undefined,
  };
});

