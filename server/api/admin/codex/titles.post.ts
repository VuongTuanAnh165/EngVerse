/**
 * POST /api/admin/codex/titles
 * Updates or creates an unlockable honorific title in the Codex.
 */

import { defineEventHandler, readBody, createError } from 'h3';
import { readCodex, writeCodex } from '../../../utils/adminStorage';
import type { CodexTitle } from '~/types/game';

export default defineEventHandler(async (event): Promise<{ success: boolean; title: CodexTitle }> => {
  const body = await readBody<{ title: CodexTitle }>(event);

  if (!body || !body.title) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thiếu dữ liệu danh hiệu (title).',
    });
  }

  const title = body.title;

  if (!title.id || !title.name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Danh hiệu phải có mã (id) và tên (name).',
    });
  }

  const codex = await readCodex();
  const existingIndex = codex.titles.findIndex((t) => t.id === title.id);

  if (existingIndex >= 0) {
    codex.titles[existingIndex] = {
      ...codex.titles[existingIndex],
      ...title,
    };
  } else {
    codex.titles.push(title);
  }

  await writeCodex(codex);

  return {
    success: true,
    title,
  };
});

