/**
 * DELETE /api/admin/codex/cards/:id
 * Deletes a card from Codex, cleans up collection references, and updates total counters.
 */

import { defineEventHandler, getRouterParam, createError } from 'h3';
import { readCodex, writeCodex } from '../../../../utils/adminStorage';

export default defineEventHandler(async (event): Promise<{ success: boolean; deletedCardId: string }> => {
  const cardId = getRouterParam(event, 'id');

  if (!cardId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thiếu mã thẻ bài (id).',
    });
  }

  const codex = await readCodex();
  const cardIndex = codex.cards.findIndex((c) => c.id === cardId);

  if (cardIndex === -1) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: `Không tìm thấy thẻ bài ID "${cardId}" trong Codex.`,
    });
  }

  codex.cards.splice(cardIndex, 1);

  // Remove card from collection sets
  for (const collection of codex.collections) {
    collection.cardIds = collection.cardIds.filter((cid) => cid !== cardId);
  }

  codex.metadata.totalCards = codex.cards.length;
  await writeCodex(codex);

  return {
    success: true,
    deletedCardId: cardId,
  };
});

