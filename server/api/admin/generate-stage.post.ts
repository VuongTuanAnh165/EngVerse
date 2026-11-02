/**
 * POST /api/admin/generate-stage
 * Generates an end-to-end educational stage with AI (Gemini Flash / Groq / OpenRouter)
 * based on a user-provided topic.
 */

import { defineEventHandler, readBody, createError } from 'h3';
import { generateStageWithAi } from '../../utils/adminAiGenerator';
import { readStages } from '../../utils/adminStorage';
import type { AdminAiGeneratePayload, AdminAiGenerateResponse } from '~/types/admin';

export default defineEventHandler(async (event): Promise<AdminAiGenerateResponse> => {
  const body = await readBody<AdminAiGeneratePayload>(event);

  if (!body || !body.topic || !body.topic.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Vui lòng cung cấp chủ đề bài học cần tạo (topic).',
    });
  }

  const track = body.worldTrack;
  if (!track || !['kids', 'teens', 'adults'].includes(track)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thế giới không hợp lệ (worldTrack: "kids" | "teens" | "adults").',
    });
  }

  // Determine next stage ID automatically
  const stages = await readStages(track);
  const nextStageId = stages.reduce((max, s) => Math.max(max, s.stageId), 0) + 1;

  try {
    const result = await generateStageWithAi(body, nextStageId);
    return {
      success: true,
      stage: result.stage,
      providerUsed: result.providerUsed,
      latencyMs: result.latencyMs,
    };
  } catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: `Tạo bài học bằng AI thất bại: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});

