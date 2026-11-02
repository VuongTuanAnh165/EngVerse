/**
 * DELETE /api/admin/stages/:id
 * Removes a stage and cascades deletion to linked cards and collections.
 */

import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3';
import { removeStageWithCascade } from '../../../utils/adminStorage';
import type { WorldTrack } from '~/types/user';
import type { AdminStageDeleteResponse } from '~/types/admin';

export default defineEventHandler(async (event): Promise<AdminStageDeleteResponse> => {
  const paramId = getRouterParam(event, 'id');
  const stageId = Number(paramId);

  if (isNaN(stageId) || stageId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: `Mã chặng không hợp lệ: "${paramId}".`,
    });
  }

  const query = getQuery(event);
  const track = query.track as WorldTrack;

  if (!track || !['kids', 'teens', 'adults'].includes(track)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thiếu hoặc sai tham số thế giới (track: "kids" | "teens" | "adults").',
    });
  }

  const cascadeCards = query.cascadeCards !== 'false';

  const { deletedStage, removedCardsCount } = await removeStageWithCascade(
    track,
    stageId,
    cascadeCards
  );

  return {
    success: true,
    deletedStageId: deletedStage.stageId,
    worldTrack: track,
    cascadeCardsRemoved: removedCardsCount,
  };
});

