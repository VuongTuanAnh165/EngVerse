/**
 * GET /api/admin/stages
 * Retrieves all stages for a specified world track.
 */

import { defineEventHandler, getQuery, createError } from 'h3';
import { readStages } from '../../utils/adminStorage';
import type { WorldTrack } from '~/types/user';
import type { StageData } from '~/types/game';

export default defineEventHandler(async (event): Promise<StageData[]> => {
  const query = getQuery(event);
  const track = query.track as WorldTrack;

  if (!track || !['kids', 'teens', 'adults'].includes(track)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thiếu hoặc sai tham số thế giới (track: "kids" | "teens" | "adults").',
    });
  }

  const stages = await readStages(track);
  return stages.sort((a, b) => a.stageId - b.stageId);
});

