<script setup lang="ts">
/**
 * EngVerse - BossRushRewardModal.vue
 * Celebration modal showcasing unlocked badges, frames & mythic cards upon Boss Rush Victory.
 * Strictly typed (0 any), Vue 3.5 script setup, 1-click cosmetic equip.
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.3 & Task 3.5.
 */

import { ref, computed } from 'vue';
import type { WorldTrack } from '~/types/user';
import type { BossRushResult } from '~/types/bossRush';
import { useUserStore } from '~/stores/user';
import { useSoundEffects } from '~/composables/useSoundEffects';

const props = defineProps<{
  open: boolean;
  result: BossRushResult | null;
  worldTrack: WorldTrack;
}>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'open-customizer'): void;
}>();

const userStore = useUserStore();
const { playSound } = useSoundEffects();

const isEquipping = ref<boolean>(false);
const hasEquipped = ref<boolean>(false);

const isPerfect = computed<boolean>(() => Boolean(props.result?.isPerfect));
const isMultiverseChampion = computed<boolean>(() => {
  return Boolean(userStore.unlockedTitlesList.includes('title_multiverse_champion'));
});

const trackMythicCardName = computed<string>(() => {
  switch (props.worldTrack) {
    case 'teens':
      return 'Thẻ Mythic: Phantom AI Sovereign (Teens)';
    case 'adults':
      return 'Thẻ Mythic: Global Davos Tycoon (Adults)';
    case 'kids':
    default:
      return 'Thẻ Mythic: Titan Rồng Lửa Cổ Đại (Kids)';
  }
});

function closeModal(): void {
  emit('update:open', false);
}

async function handleEquipAllRewards(): Promise<void> {
  if (isEquipping.value || hasEquipped.value) return;
  isEquipping.value = true;

  try {
    // 1. Equip Gold Avatar Frame
    await userStore.equipAvatarFrame('avatar_frame_gold');

    // 2. Equip Vua Đấu Trường (or Bá Chủ Đa Vũ Trụ if completed all)
    const targetTitle = isMultiverseChampion.value
      ? 'title_multiverse_champion'
      : 'title_boss_slayer';
    await userStore.equipTitle(targetTitle);

    playSound('fanfare');
    hasEquipped.value = true;
  } catch (err: unknown) {
    console.error('[BossRushRewardModal] Equip failed:', err);
  } finally {
    isEquipping.value = false;
  }
}

function handleOpenCustomizer(): void {
  closeModal();
  emit('open-customizer');
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="reward-celebration-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reward-celebration-title"
      @click.self="closeModal"
    >
      <div class="reward-celebration-card theme-card">
        <!-- Floating Trophy Emblem -->
        <div class="celebration-emblem" aria-hidden="true">
          🏆
        </div>

        <h2 id="reward-celebration-title" class="celebration-headline">
          VINH DANH NHÀ VÔ ĐỊCH ĐẤU TRƯỜNG!
        </h2>
        <p class="celebration-subtext">
          Bạn đã khuất phục toàn bộ 4/4 Chúa Tể Đại Boss! Hãy nhận lấy các phần thưởng hoàng kim xứng tầm:
        </p>

        <!-- Unlocked Rewards Showcase List -->
        <div class="rewards-deck">
          <!-- 1. Title Badge -->
          <div class="reward-badge-card highlight-gold">
            <div class="badge-icon-box">🏆</div>
            <div class="badge-text-box">
              <span class="badge-tier">DANH HIỆU HUYỀN THOẠI</span>
              <h3 class="badge-title">Vua Đấu Trường</h3>
              <p class="badge-lore">Biểu tượng sức mạnh tối cao của Đấu Trường Sinh Tử Colosseum.</p>
            </div>
            <span class="badge-state-pill">MỚI</span>
          </div>

          <!-- 2. Gold Avatar Frame -->
          <div class="reward-badge-card highlight-gold">
            <div class="badge-icon-box frame-preview-sample">
              <span class="frame-crown">👑</span>
            </div>
            <div class="badge-text-box">
              <span class="badge-tier">KHUNG AVATAR HOÀNG KIM</span>
              <h3 class="badge-title">Khung Hoàng Kim (Golden Sunstone)</h3>
              <p class="badge-lore">Viền vàng lấp lánh và hào quang rực rỡ tỏa sáng trên toàn hệ thống.</p>
            </div>
            <span class="badge-state-pill">MỚI</span>
          </div>

          <!-- 3. Perfect Run Mythic Card (if remainingHP === 3) -->
          <div v-if="isPerfect" class="reward-badge-card highlight-mythic">
            <div class="badge-icon-box">⭐</div>
            <div class="badge-text-box">
              <span class="badge-tier mythic">THẺ CODEX MYTHIC EXCLUSIVE</span>
              <h3 class="badge-title">{{ trackMythicCardName }}</h3>
              <p class="badge-lore">Phần thưởng Perfect Run: Bảo toàn nguyên vẹn 3/3 ❤️ Tim Máu!</p>
            </div>
            <span class="badge-state-pill mythic">PERFECT</span>
          </div>

          <!-- 4. Multiverse Champion (if all 3 tracks cleared) -->
          <div v-if="isMultiverseChampion" class="reward-badge-card highlight-multiverse">
            <div class="badge-icon-box">💎</div>
            <div class="badge-text-box">
              <span class="badge-tier mythic">DANH HIỆU TỐI THƯỢNG</span>
              <h3 class="badge-title">Bá Chủ Đa Vũ Trụ</h3>
              <p class="badge-lore">Vinh danh Chiến Thần phá đảo trọn vẹn cả 3 Đấu Trường Kids, Teens & Adults!</p>
            </div>
            <span class="badge-state-pill mythic">MAX</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="celebration-actions">
          <button
            type="button"
            class="btn-equip-all"
            :class="{ equipped: hasEquipped }"
            :disabled="isEquipping || hasEquipped"
            @click="handleEquipAllRewards"
          >
            <span v-if="isEquipping">Đang trang bị...</span>
            <span v-else-if="hasEquipped">✓ Đã Trang Bị Khung Vàng & Danh Hiệu!</span>
            <span v-else>👑 TRANG BỊ NGAY KHUNG & DANH HIỆU</span>
          </button>

          <button
            type="button"
            class="btn-secondary-customizer"
            @click="handleOpenCustomizer"
          >
            🎨 Tùy Chỉnh Kho Báu
          </button>

          <button
            type="button"
            class="btn-close-modal"
            @click="closeModal"
          >
            Tiếp Tục
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.reward-celebration-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(8, 12, 22, 0.88);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: 1rem;
}

.reward-celebration-card {
  max-width: 580px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  background: linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%);
  border: 2px solid #f59e0b;
  box-shadow: 0 0 35px rgba(245, 158, 11, 0.4), 0 25px 50px -12px rgba(0, 0, 0, 0.8);
  border-radius: 1.5rem;
  padding: 2rem 1.75rem;
  text-align: center;
  color: #f8fafc;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  animation: card-appear 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes card-appear {
  from {
    transform: scale(0.92);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.celebration-emblem {
  font-size: 3.5rem;
  line-height: 1;
  animation: bounce-trophy 2s infinite ease-in-out;
}

@keyframes bounce-trophy {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

.celebration-headline {
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fde68a 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 0.02em;
}

.celebration-subtext {
  font-size: 0.95rem;
  color: #cbd5e1;
  margin: 0;
  line-height: 1.45;
  max-width: 480px;
}

.rewards-deck {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: left;
}

.reward-badge-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1rem;
  border-radius: 0.85rem;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  transition: transform 0.2s;
}

.reward-badge-card:hover {
  transform: translateX(3px);
}

.reward-badge-card.highlight-gold {
  border-color: rgba(245, 158, 11, 0.6);
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(30, 41, 59, 0.8) 100%);
}

.reward-badge-card.highlight-mythic {
  border-color: rgba(236, 72, 153, 0.6);
  background: linear-gradient(90deg, rgba(236, 72, 153, 0.15) 0%, rgba(30, 41, 59, 0.8) 100%);
}

.reward-badge-card.highlight-multiverse {
  border-color: rgba(99, 102, 241, 0.7);
  background: linear-gradient(90deg, rgba(99, 102, 241, 0.2) 0%, rgba(30, 41, 59, 0.8) 100%);
}

.badge-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #334155;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  flex-shrink: 0;
}

.frame-preview-sample {
  border: 2px solid #f59e0b;
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.8);
}

.frame-crown {
  font-size: 1.35rem;
}

.badge-text-box {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
  min-width: 0;
}

.badge-tier {
  font-size: 0.65rem;
  font-weight: 800;
  color: #fbbf24;
  letter-spacing: 0.08em;
}

.badge-tier.mythic {
  color: #f472b6;
}

.badge-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  color: #f8fafc;
}

.badge-lore {
  font-size: 0.8rem;
  color: #94a3b8;
  margin: 0;
  line-height: 1.3;
}

.badge-state-pill {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
  background: #f59e0b;
  color: #111827;
}

.badge-state-pill.mythic {
  background: #ec4899;
  color: #ffffff;
}

.celebration-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  margin-top: 0.5rem;
}

.btn-equip-all {
  width: 100%;
  padding: 0.85rem 1.25rem;
  border-radius: 0.6rem;
  font-size: 0.95rem;
  font-weight: 800;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #111827;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);
  transition: all 0.2s;
}

.btn-equip-all:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.btn-equip-all.equipped {
  background: #065f46;
  color: #a7f3d0;
  border: 1px solid #10b981;
  box-shadow: none;
}

.btn-secondary-customizer {
  width: 100%;
  padding: 0.65rem 1rem;
  border-radius: 0.6rem;
  background: #1e293b;
  color: #cbd5e1;
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary-customizer:hover {
  background: #334155;
  color: #ffffff;
}

.btn-close-modal {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.4rem;
  transition: color 0.2s;
}

.btn-close-modal:hover {
  color: #ffffff;
}
</style>

