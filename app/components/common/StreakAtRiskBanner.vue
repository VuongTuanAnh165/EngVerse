<script setup lang="ts">
/**
 * EngVerse - StreakAtRiskBanner Component
 * Notification banner warning users when their consecutive streak is in danger of expiring
 * before 00:00 GMT+7, or offering one-click Freeze Shield rescue if a day was missed.
 * 
 * Strict TypeScript, Vue 3.5 setup, dismissible per session with smooth CSS transitions.
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.2 & Sprint 8, Task 2.5
 */

import { ref, computed, onMounted } from 'vue';
import { useDailyStreak } from '~/composables/useDailyStreak';
import { useSoundEffects } from '~/composables/useSoundEffects';
import { getDailyDateString } from '~/types/dailyChallenge';

const {
  currentStreak,
  isCompletedToday,
  isStreakAtRisk,
  isStreakBroken,
  freezeShields,
  canBeRescuedByShield,
  timeUntilReset,
  repairStreakWithShield,
} = useDailyStreak();

const { playSound } = useSoundEffects();

const isDismissed = ref<boolean>(false);
const rescueMessage = ref<string | null>(null);
const isRescuing = ref<boolean>(false);

const sessionDismissKey = computed<string>(() => {
  return `engverse_streak_banner_dismissed_${getDailyDateString()}`;
});

onMounted(() => {
  if (typeof window !== 'undefined') {
    try {
      const dismissed = sessionStorage.getItem(sessionDismissKey.value);
      if (dismissed === 'true') {
        isDismissed.value = true;
      }
    } catch {
      // Ignore storage errors in restrictive environments
    }
  }
});

function handleDismiss(): void {
  isDismissed.value = true;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(sessionDismissKey.value, 'true');
    } catch {
      // Ignore storage errors
    }
  }
}

async function handleRescueWithShield(): Promise<void> {
  if (isRescuing.value) return;
  isRescuing.value = true;

  try {
    const result = repairStreakWithShield();
    if (result.rescued) {
      playSound('correct');
      rescueMessage.value = `Đã dùng 1 Khiên Băng để bảo toàn chuỗi ${result.currentStreak} ngày thành công! 🛡️`;
      setTimeout(() => {
        rescueMessage.value = null;
      }, 5000);
    }
  } catch (err) {
    console.error('[StreakAtRiskBanner] Failed to rescue streak:', err);
  } finally {
    isRescuing.value = false;
  }
}

// Banner should only be visible when there is an active actionable state
const isVisible = computed<boolean>(() => {
  if (isDismissed.value) return false;
  // If rescue is possible, always prioritize rescue banner
  if (canBeRescuedByShield.value) return true;
  // If streak is at risk and not yet completed today
  if (isStreakAtRisk.value && !isCompletedToday.value) return true;
  // If a success rescue message is temporarily showing
  if (rescueMessage.value) return true;
  return false;
});
</script>

<template>
  <Transition name="slide-banner">
    <div
      v-if="isVisible"
      class="streak-banner-wrapper"
      role="alert"
      aria-live="polite"
    >
      <!-- Mode 1: Success message after rescue -->
      <div v-if="rescueMessage" class="streak-banner-card banner-success">
        <span class="banner-icon">✨</span>
        <div class="banner-content">
          <p class="banner-title">Giải Cứu Thành Công!</p>
          <p class="banner-desc">{{ rescueMessage }}</p>
        </div>
        <button
          type="button"
          class="banner-close-btn"
          title="Đóng thông báo"
          @click="handleDismiss"
        >
          ✕
        </button>
      </div>

      <!-- Mode 2: Rescue Available with Shield -->
      <div
        v-else-if="canBeRescuedByShield"
        class="streak-banner-card banner-rescue"
      >
        <div class="banner-icon-box ice-glow">
          <span class="pulsing-icon">🛡️</span>
        </div>

        <div class="banner-content">
          <div class="banner-badge ice-badge">
            <span>KHIÊN BĂNG SẴN SÀNG</span>
          </div>
          <h4 class="banner-title">
            Bạn đã lỡ mất chuỗi ngày học!
          </h4>
          <p class="banner-desc">
            Bạn còn <strong>{{ freezeShields }} Khiên Băng</strong>. Kích hoạt khiên ngay để bảo toàn chuỗi <strong>{{ currentStreak }} ngày</strong>!
          </p>
        </div>

        <div class="banner-actions">
          <button
            type="button"
            class="rescue-btn theme-btn-primary"
            :disabled="isRescuing"
            @click="handleRescueWithShield"
          >
            <span class="btn-icon">❄️</span>
            <span>{{ isRescuing ? 'Đang kích hoạt...' : 'Cứu Chuỗi Bằng Khiên' }}</span>
          </button>
          <button
            type="button"
            class="banner-close-btn"
            title="Bỏ qua thông báo"
            @click="handleDismiss"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Mode 3: Streak At Risk (Pending Daily Completion) -->
      <div
        v-else-if="isStreakAtRisk && !isCompletedToday"
        class="streak-banner-card banner-warning"
      >
        <div class="banner-icon-box flame-glow">
          <span class="pulsing-icon flame-icon">🔥</span>
        </div>

        <div class="banner-content">
          <div class="banner-badge flame-badge">
            <span>NGUY CƠ ĐỨT CHUỖI</span>
          </div>
          <h4 class="banner-title">
            Chuỗi {{ currentStreak }} Ngày Học Có Nguy Cơ Bị Tắt!
          </h4>
          <p class="banner-desc">
            Bạn chưa hoàn thành Thử thách Hôm nay. Còn <strong class="timer-highlight">{{ timeUntilReset }}</strong> trước khi hệ thống reset lúc 00:00 (GMT+7).
          </p>
        </div>

        <div class="banner-actions">
          <NuxtLink
            to="/play/daily-challenge"
            class="keep-streak-btn theme-btn-primary"
          >
            <span class="btn-icon">⚡</span>
            <span>Chơi Giữ Chuỗi Ngay</span>
          </NuxtLink>
          <button
            type="button"
            class="banner-close-btn"
            title="Bỏ qua thông báo"
            @click="handleDismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.streak-banner-wrapper {
  width: 100%;
  max-width: 1100px;
  margin: 0.75rem auto;
  padding: 0 1rem;
}

.streak-banner-card {
  display: flex;
  align-items: center;
  gap: 1.15rem;
  padding: 0.95rem 1.35rem;
  border-radius: 1rem;
  background: var(--bg-surface, #1e293b);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.35);
  position: relative;
  overflow: hidden;
}

/* Warning Theme (Flame) */
.banner-warning {
  border-color: #ea580c;
  background: linear-gradient(90deg, rgba(234, 88, 12, 0.15) 0%, var(--bg-surface) 35%);
}

/* Rescue Theme (Ice Shield) */
.banner-rescue {
  border-color: #06b6d4;
  background: linear-gradient(90deg, rgba(6, 182, 212, 0.15) 0%, var(--bg-surface) 35%);
}

/* Success Theme */
.banner-success {
  border-color: #10b981;
  background: linear-gradient(90deg, rgba(16, 185, 129, 0.15) 0%, var(--bg-surface) 35%);
}

.banner-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 1.5rem;
}

.flame-glow {
  background: rgba(234, 88, 12, 0.2);
  box-shadow: 0 0 15px rgba(234, 88, 12, 0.4);
}

.ice-glow {
  background: rgba(6, 182, 212, 0.2);
  box-shadow: 0 0 15px rgba(6, 182, 212, 0.4);
}

.pulsing-icon {
  display: inline-block;
  animation: pulse-icon 1.8s infinite ease-in-out;
}

.flame-icon {
  animation: flicker-icon 1.2s infinite alternate ease-in-out;
}

.banner-content {
  flex: 1;
  text-align: left;
}

.banner-badge {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
}

.flame-badge {
  background: rgba(234, 88, 12, 0.2);
  color: #fb923c;
  border: 1px solid rgba(234, 88, 12, 0.35);
}

.ice-badge {
  background: rgba(6, 182, 212, 0.2);
  color: #38bdf8;
  border: 1px solid rgba(6, 182, 212, 0.35);
}

.banner-title {
  margin: 0 0 0.2rem;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-primary, #fff);
  line-height: 1.3;
}

.banner-desc {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted, #94a3b8);
  line-height: 1.4;
}

.timer-highlight {
  color: #f97316;
  font-family: monospace;
  font-weight: 800;
  font-size: 0.875rem;
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-shrink: 0;
}

.keep-streak-btn,
.rescue-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  font-size: 0.825rem;
  font-weight: 800;
  border-radius: 0.65rem;
  text-decoration: none;
  white-space: nowrap;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.keep-streak-btn {
  background: linear-gradient(135deg, #ea580c, #f97316);
  color: #fff;
  box-shadow: 0 4px 12px rgba(234, 88, 12, 0.35);
}

.keep-streak-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(234, 88, 12, 0.5);
}

.rescue-btn {
  background: linear-gradient(135deg, #0284c7, #06b6d4);
  color: #fff;
  box-shadow: 0 4px 12px rgba(6, 182, 212, 0.35);
}

.rescue-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(6, 182, 212, 0.5);
}

.banner-close-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: var(--text-muted, #94a3b8);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s ease;
}

.banner-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

/* Animations */
@keyframes pulse-icon {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
}

@keyframes flicker-icon {
  0% {
    transform: scale(1) rotate(-2deg);
    filter: drop-shadow(0 0 4px rgba(234, 88, 12, 0.4));
  }
  100% {
    transform: scale(1.1) rotate(2deg);
    filter: drop-shadow(0 0 10px rgba(249, 115, 22, 0.8));
  }
}

/* Slide Transition */
.slide-banner-enter-active,
.slide-banner-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-banner-enter-from,
.slide-banner-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Responsive */
@media (max-width: 768px) {
  .streak-banner-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
  }

  .banner-actions {
    width: 100%;
    justify-content: space-between;
  }

  .keep-streak-btn,
  .rescue-btn {
    flex: 1;
    justify-content: center;
  }
}
</style>

