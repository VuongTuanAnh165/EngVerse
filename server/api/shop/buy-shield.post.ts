import { defineEventHandler, readBody, createError, getRequestHeader } from 'h3';
import { adminAuth, adminDb } from '../../utils/firebaseAdmin';
import type { BuyItemPayload, BuyItemResponse, UserProfile, UserEnergy } from '~/types/user';

const SHIELD_COST = 100;
const ENERGY_REFILL_COST = 50;
const MAX_FREEZE_SHIELDS = 3;
const MAX_ENERGY = 5;

/**
 * POST /api/shop/buy-shield
 * Production-ready atomic store purchasing endpoint with Firestore Transactions.
 * Guarantees zero gold duplication or item loss under race conditions.
 *
 * Supports:
 * - 'freeze_shield': 100 Gold -> +1 freeze shield (max 3)
 * - 'refill_energy': 50 Gold -> refill energy to 5/5
 *
 * Reference: docs/ke_hoach.md - Sprint 5, Task 1
 */
export default defineEventHandler(async (event): Promise<BuyItemResponse> => {
  const body = await readBody<BuyItemPayload>(event);

  if (!body || !body.itemType) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Thiếu thông tin vật phẩm muốn mua (itemType).',
    });
  }

  const validItems = ['freeze_shield', 'refill_energy'];
  if (!validItems.includes(body.itemType)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: `Vật phẩm không hợp lệ: "${body.itemType}".`,
    });
  }

  // 1. Identity Authentication
  const authHeader = getRequestHeader(event, 'authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Bạn cần đăng nhập để thực hiện giao dịch trong Cửa Hàng.',
    });
  }

  let uid = '';
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch (authErr) {
    console.warn('[ShopBuy] Token verification failed:', authErr);
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
    });
  }

  const userRef = adminDb.collection('users').doc(uid);

  // 2. Atomic Transaction Execution
  try {
    const transactionResult = await adminDb.runTransaction(async (transaction) => {
      const userDocSnap = await transaction.get(userRef);

      if (!userDocSnap.exists) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Not Found',
          message: 'Không tìm thấy tài khoản người chơi.',
        });
      }

      const userData = userDocSnap.data() as UserProfile;
      const currentGold = userData.gold || 0;
      const now = Date.now();

      if (body.itemType === 'freeze_shield') {
        const currentShields = userData.streak?.freezeShields || 0;

        if (currentShields >= MAX_FREEZE_SHIELDS) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: `Bạn đã đạt giới hạn tối đa ${MAX_FREEZE_SHIELDS} Khiên Băng!`,
          });
        }

        if (currentGold < SHIELD_COST) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: `Bạn không đủ Vàng để mua Khiên Băng (Cần ${SHIELD_COST} Vàng, bạn hiện có ${currentGold} Vàng).`,
          });
        }

        const newGold = currentGold - SHIELD_COST;
        const newShields = currentShields + 1;

        transaction.update(userRef, {
          gold: newGold,
          'streak.freezeShields': newShields,
          updatedAt: now,
        });

        return {
          gold: newGold,
          freezeShields: newShields,
          message: 'Mua Khiên Băng thành công! Chuỗi ngày học của bạn đã được bảo vệ.',
        };
      } else {
        // Refill Energy
        const currentEnergy = userData.energy?.current || 0;

        if (currentEnergy >= MAX_ENERGY) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: `Năng lượng của bạn đã đạt mức tối đa (${MAX_ENERGY}/${MAX_ENERGY})!`,
          });
        }

        if (currentGold < ENERGY_REFILL_COST) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request',
            message: `Bạn không đủ Vàng để hồi năng lượng (Cần ${ENERGY_REFILL_COST} Vàng, bạn hiện có ${currentGold} Vàng).`,
          });
        }

        const newGold = currentGold - ENERGY_REFILL_COST;
        const updatedEnergy: UserEnergy = {
          current: MAX_ENERGY,
          max: MAX_ENERGY,
          lastRefillAt: now,
        };

        transaction.update(userRef, {
          gold: newGold,
          energy: updatedEnergy,
          updatedAt: now,
        });

        return {
          gold: newGold,
          energy: updatedEnergy,
          message: 'Hồi đầy năng lượng (5/5 ⚡) thành công! Hãy tiếp tục cuộc phiêu lưu.',
        };
      }
    });

    return {
      success: true,
      gold: transactionResult.gold,
      freezeShields: transactionResult.freezeShields,
      energy: transactionResult.energy,
      message: transactionResult.message,
    };
  } catch (err: unknown) {
    if ((err as { statusCode?: number }).statusCode) {
      throw err;
    }
    console.error('[ShopBuy] Transaction error:', err);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Có sự cố khi xử lý giao dịch. Vui lòng thử lại sau.',
    });
  }
});

