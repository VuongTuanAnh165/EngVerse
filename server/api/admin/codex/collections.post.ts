/**
 * POST /api/admin/codex/collections
 * Updates or creates a thematic collection set in the Codex.
 */

import { defineEventHandler, readBody, createError } from 'h3';
import { readCodex, writeCodex } from '../../../utils/adminStorage';
import type { CodexCollection } from '~/types/game';

export default defineEventHandler(async (event): Promise<{ success: boolean; collection: CodexCollection }> => {
  const body = await readBody<{ collection: CodexCollection }>(event);

  if (!body || !body.collection) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thiếu dữ liệu bộ sưu tập (collection).',
    });
  }

  const collection = body.collection;

  if (!collection.setId || !collection.title) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Bộ sưu tập phải có mã (setId) và tiêu đề (title).',
    });
  }

  const codex = await readCodex();
  const existingIndex = codex.collections.findIndex((c) => c.setId === collection.setId);

  if (existingIndex >= 0) {
    codex.collections[existingIndex] = {
      ...codex.collections[existingIndex],
      ...collection,
    };
  } else {
    codex.collections.push(collection);
  }

  codex.metadata.totalCollections = codex.collections.length;
  await writeCodex(codex);

  return {
    success: true,
    collection,
  };
});

