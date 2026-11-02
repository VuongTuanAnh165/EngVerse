<script setup lang="ts">
/**
 * EngVerse - StreakRewardModal Component
 * Celebratory reward modal presented when reaching consecutive streak milestones
 * (3, 7, 14, 30, 60 days) with sound fanfare, confetti particle burst, and perk details.
 * 
 * Strict TypeScript, Vue 3.5 setup, accessible modal dialog with backdrop & ESC key support.
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.2 & Sprint 8, Task 2.5
 */

import { computed, watch, onMounted, onUnmounted } from 'vue';
import type { StreakMilestone } from '~/types/dailyChallenge';
import { useSoundEffects } from '~/composables/useSoundEffects';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    milestone: StreakMilestone | null;
    streakDays?: number;
  }>(),
  {
    streakDays: 0,
  }
);

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void;
  (e: 'claim', milestone: StreakMilestone): void;
  (e: 'close'): void;
}>();

const { playSound, triggerVictoryConfetti } = useSoundEffects();

const milestoneData = computed<StreakMilestone | null>(() => props.milestone);

const milestoneAuraClass = computed<string>(() => {
  if (!milestoneData.value) return 'aura-amber';
  switch (milestoneData.value.days) {
    case 3:
      return 'aura-cyan';
    case 7:
      return 'aura-yellow';
    case 14:
      return 'aura-purple';
    case 30:
      return 'aura-amber';
    case 60:
      return 'aura-gold';
    default:
      return 'aura-amber';
  }
});

const perkDetails = computed<string[]>(() => {
  if (!milestoneData.value) return [];
  switch (milestoneData.value.days) {
    case 3:
      return [
        '🛡️ Cộng 1 Khiên Băng vào túi bảo vệ',
        'Tự động kích hoạt khi bạn lỡ một ngày học',
        'Bảo toàn chuỗi streak và năng lượng',
      ];
    case 7:
      return [
        '⚡ Nhân đôi (x2) toàn bộ EXP nhận được trong 24 giờ',
        '🌟 Mở khóa Danh Hiệu: Tín Đồ Chăm Chỉ (Daily Devotee)',
        'Gia tăng tốc độ thăng cấp vượt bậc',
      ];
    case 14:
      return [
        '🃏 Mở khóa 1 Gói Thẻ Sử Thi (Codex Epic Pack)',
        'Nhận thẻ 3D Epic độc quyền tăng điểm thuộc tính',
        'Mở khóa Danh Hiệu: Nhà Sưu Tầm Sử Thi',
      ];
    case 30:
      return [
        '👑 Nhận 1 Thẻ Bài Huyền Thoại (Codex Legendary) ngẫu nhiên',
        'Danh hiệu vinh danh độc quyền: Bậc Thầy Kỷ Luật',
        'Hiệu ứng hào quang đặc biệt trên Bảng Xếp Hạng',
      ];
    case 60:
      return [
        '✨ Khung Avatar Vàng Hoàng Gia vĩnh viễn',
        'Danh hiệu tối thượng: Bất Tử Đa Vũ Trụ (Streak Immortal)',
        'Khẳng định vị thế người kiên trì bền bỉ nhất EngVerse',
      ];
    default:
      return [milestoneData.value.descriptionVi];
  }
});

function handleClose(): void {
  emit('update:isOpen', false);
  emit('close');
}

function handleClaim(): void {
  if (milestoneData.value) {
    emit('claim', milestoneData.value);
  }
  handleClose();
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.isOpen) {
    handleClose();
  }
}

// Watch for modal opening to trigger celebratory fanfare & confetti
watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) {
      playSound('fanfare');
      triggerVictoryConfetti();
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
      }
    } else {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    }
  }
);

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeyDown);
    document.body.style.overflow = '';
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="isOpen && milestoneData"
        class="streak-reward-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="streak-reward-title"
        @click.self="handleClose"
      >
        <div class="streak-reward-card" :class="milestoneAuraClass">
          <!-- Close Button -->
          <button
            type="button"
            class="reward-close-btn"
            title="Đóng modal"
            aria-label="Đóng modal"
            @click="handleClose"
          >
            ✕
          </button>

          <!-- Top Celebratory Badge -->
          <div class="reward-header-pill">
            <span class="sparkle-icon" aria-hidden="true">🎉</span>
            <span>MỐC THƯỞNG STREAK MỚI</span>
          </div>

          <!-- Animated Floating Icon -->
          <div class="reward-icon-container">
            <div class="reward-icon-glow" />
            <div class="reward-icon-box">
              <span class="floating-icon">{{ milestoneData.rewardIcon }}</span>
            </div>
          </div>

          <!-- Streak Day Milestone Banner -->
          <div class="streak-days-badge">
            <span class="flame-icon">🔥</span>
            <span>CHINH PHỤC CHUỖI {{ milestoneData.days }} NGÀY LIÊN TIẾP!</span>
          </div>

          <!-- Reward Title & Description -->
          <h2 id="streak-reward-title" class="reward-title">
            {{ milestoneData.titleVi }}
          </h2>

          <p class="reward-desc">
            {{ milestoneData.descriptionVi }}
          </p>

          <!-- Perks List -->
          <div class="perks-container">
            <div
              v-for="(perk, idx) in perkDetails"
              :key="idx"
              class="perk-item"
            >
              <span class="perk-bullet">✦</span>
              <span class="perk-text">{{ perk }}</span>
            </div>
          </div>

          <!-- Action Button -->
          <div class="reward-actions">
            <button
              type="button"
              class="claim-reward-btn theme-btn-primary"
              @click="handleClaim"
            >
              <span class="btn-icon">🎁</span>
              <span>Thu Nhận & Tiếp Tục Chinh Phục</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.streak-reward-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background-color: rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.streak-reward-card {
  position: relative;
  width: 100%;
  max-width: 480px;
  background: var(--bg-surface, #1e293b);
  border: 2px solid rgba(245, 158, 11, 0.4);
  border-radius: 1.5rem;
  padding: 2.25rem 1.75rem 2rem;
  text-align: center;
  color: var(--text-primary, #f8fafc);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(245, 158, 11, 0.25);
  animation: card-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  overflow: hidden;
}

/* Aura Color Themes */
.aura-cyan {
  border-color: rgba(6, 182, 212, 0.5);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(6, 182, 212, 0.3);
}
.aura-yellow {
  border-color: rgba(234, 179, 8, 0.5);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(234, 179, 8, 0.3);
}
.aura-purple {
  border-color: rgba(168, 85, 247, 0.5);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(168, 85, 247, 0.3);
}
.aura-amber {
  border-color: rgba(245, 158, 11, 0.5);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(245, 158, 11, 0.3);
}
.aura-gold {
  border-color: rgba(251, 191, 36, 0.7);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 45px rgba(251, 191, 36, 0.45);
}

.reward-close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: var(--text-muted, #94a3b8);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.reward-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  transform: scale(1.08);
}

.reward-header-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.3);
  padding: 0.3rem 0.85rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: #f59e0b;
  margin-bottom: 1.25rem;
  text-transform: uppercase;
}

.reward-icon-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0.5rem 0 1.25rem;
}

.reward-icon-glow {
  position: absolute;
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, transparent 70%);
  animation: pulse-glow 2.5s infinite ease-in-out;
}

.reward-icon-box {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.03));
  border: 2px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 2px 8px rgba(255, 255, 255, 0.2), 0 10px 20px rgba(0, 0, 0, 0.4);
}

.floating-icon {
  font-size: 2.75rem;
  display: inline-block;
  animation: float-bob 3s infinite ease-in-out;
}

.streak-days-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: rgba(234, 88, 12, 0.15);
  border: 1px solid rgba(234, 88, 12, 0.35);
  color: #fb923c;
  padding: 0.35rem 0.85rem;
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-weight: 800;
  margin-bottom: 0.75rem;
}

.reward-title {
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0 0 0.5rem;
  background: linear-gradient(135deg, #fff 40%, #fbbf24 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1.25;
}

.reward-desc {
  font-size: 0.9rem;
  color: var(--text-muted, #94a3b8);
  margin: 0 0 1.25rem;
  line-height: 1.45;
}

.perks-container {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 1rem;
  padding: 0.85rem 1rem;
  text-align: left;
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.perk-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.825rem;
  line-height: 1.4;
  color: #e2e8f0;
}

.perk-bullet {
  color: #f59e0b;
  font-weight: bold;
  flex-shrink: 0;
}

.claim-reward-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.85rem 1.5rem;
  font-size: 0.95rem;
  font-weight: 800;
  border-radius: 0.75rem;
  cursor: pointer;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #1e1b4b;
  border: none;
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);
  transition: all 0.2s ease;
}

.claim-reward-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.6);
  filter: brightness(1.08);
}

.claim-reward-btn:active {
  transform: translateY(0);
}

/* Animations */
@keyframes card-pop {
  0% {
    transform: scale(0.9) translateY(20px);
    opacity: 0;
  }
  100% {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

@keyframes float-bob {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-6px) rotate(3deg);
  }
}

@keyframes pulse-glow {
  0%, 100% {
    transform: scale(1);
    opacity: 0.4;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.75;
  }
}

/* Transition */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>

