/**
 * POST /api/admin/codex/cards
 * Adds or updates a collectible card in the Codex and updates total counters.
 */

import { defineEventHandler, readBody, createError } from 'h3';
import { readCodex, writeCodex } from '../../../utils/adminStorage';
import type { CodexCard } from '~/types/game';

export default defineEventHandler(async (event): Promise<{ success: boolean; card: CodexCard }> => {
  const body = await readBody<{ card: CodexCard }>(event);

  if (!body || !body.card) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thiếu dữ liệu thẻ bài (card).',
    });
  }

  const card = body.card;

  if (!card.id || !card.word || !card.meaning) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thẻ bài phải có đầy đủ ID, từ vựng (word) và nghĩa (meaning).',
    });
  }

  const codex = await readCodex();
  const existingIndex = codex.cards.findIndex((c) => c.id === card.id);

  if (existingIndex >= 0) {
    codex.cards[existingIndex] = {
      ...codex.cards[existingIndex],
      ...card,
    };
  } else {
    codex.cards.push(card);
  }

  codex.metadata.totalCards = codex.cards.length;
  await writeCodex(codex);

  return {
    success: true,
    card,
  };
});

