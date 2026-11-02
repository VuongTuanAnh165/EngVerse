/**
 * PUT /api/admin/stages/:id
 * Updates an existing stage, synchronizes modified vocabulary with Codex cards,
 * and maintains atomic backup snapshots.
 */

import { defineEventHandler, getRouterParam, readBody, createError } from 'h3';
import {
  readStages,
  writeStages,
  readCodex,
  writeCodex,
  syncStageWithCodex,
} from '../../../utils/adminStorage';
import type { StageData } from '~/types/game';
import type { AdminStageSavePayload, AdminStageSaveResponse } from '~/types/admin';

export default defineEventHandler(async (event): Promise<AdminStageSaveResponse> => {
  const paramId = getRouterParam(event, 'id');
  const stageId = Number(paramId);

  if (isNaN(stageId) || stageId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: `Mã chặng không hợp lệ: "${paramId}".`,
    });
  }

  const body = await readBody<AdminStageSavePayload>(event);
  if (!body || !body.stage) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thiếu dữ liệu cập nhật chặng (stage).',
    });
  }

  const updatedStage = body.stage;
  const track = updatedStage.worldTrack;

  if (!track || !['kids', 'teens', 'adults'].includes(track)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thế giới không hợp lệ (worldTrack: "kids" | "teens" | "adults").',
    });
  }

  // Ensure map position boundaries
  if (!updatedStage.mapPosition || typeof updatedStage.mapPosition.x !== 'number' || typeof updatedStage.mapPosition.y !== 'number') {
    updatedStage.mapPosition = { x: 50, y: 50 };
  } else {
    updatedStage.mapPosition.x = Math.max(5, Math.min(95, updatedStage.mapPosition.x));
    updatedStage.mapPosition.y = Math.max(5, Math.min(95, updatedStage.mapPosition.y));
  }

  const stages = await readStages(track);
  const existingIndex = stages.findIndex((s) => s.stageId === stageId);

  if (existingIndex === -1) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: `Không tìm thấy chặng ID ${stageId} trong vũ trụ "${track}".`,
    });
  }

  // Auto-sync with Codex
  const codex = await readCodex();
  const { syncedCardsCount } = syncStageWithCodex(updatedStage, codex);

  // Replace existing stage
  stages[existingIndex] = updatedStage;
  stages.sort((a, b) => a.stageId - b.stageId);

  // Write changes with safe backups
  const backupCreated = await writeStages(track, stages);
  await writeCodex(codex);

  return {
    success: true,
    stage: updatedStage,
    syncedCardsCount,
    backupCreated: backupCreated || undefined,
  };
});

