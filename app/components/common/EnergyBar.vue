<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useUserStore } from '~/stores/user';

const userStore = useUserStore();

const REFILL_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes per energy unit
const timeRemainingSeconds = ref<number>(0);
let countdownTimer: ReturnType<typeof setInterval> | null = null;

const currentEnergy = computed(() => userStore.energy?.current ?? 5);
const maxEnergy = computed(() => userStore.energy?.max ?? 5);
const isFull = computed(() => currentEnergy.value >= maxEnergy.value);

function calculateRemainingTime(): void {
  if (isFull.value) {
    timeRemainingSeconds.value = 0;
    return;
  }

  const lastRefill = userStore.energy?.lastRefillAt || Date.now();
  const elapsed = Date.now() - lastRefill;
  const remainderMs = REFILL_INTERVAL_MS - (elapsed % REFILL_INTERVAL_MS);
  timeRemainingSeconds.value = Math.max(0, Math.ceil(remainderMs / 1000));
}

const formattedCountdown = computed(() => {
  if (isFull.value || timeRemainingSeconds.value <= 0) {
    return 'Đầy';
  }
  const minutes = Math.floor(timeRemainingSeconds.value / 60);
  const seconds = timeRemainingSeconds.value % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
});

onMounted(() => {
  calculateRemainingTime();
  countdownTimer = setInterval(() => {
    calculateRemainingTime();
  }, 1000);
});

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
});
</script>

<template>
  <div class="energy-bar-container" title="Năng lượng: Hồi 1⚡ mỗi 20 phút">
    <div class="energy-icon-box" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="currentColor"
        class="lightning-svg"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    </div>

    <!-- Energy Pip Indicator -->
    <div class="energy-pips" aria-label="Năng lượng hiện tại">
      <div
        v-for="index in maxEnergy"
        :key="index"
        class="energy-pip"
        :class="{
          'pip-filled': index <= currentEnergy,
          'pip-empty': index > currentEnergy
        }"
      />
    </div>

    <!-- Count & Timer Text -->
    <div class="energy-text">
      <span class="energy-count">{{ currentEnergy }}/{{ maxEnergy }}</span>
      <span v-if="!isFull" class="energy-timer">({{ formattedCountdown }})</span>
    </div>
  </div>
</template>

<style scoped>
.energy-bar-container {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background-color: var(--bg-surface-translucent);
  border: 1px solid var(--border-color);
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-sm);
  user-select: none;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all var(--transition-speed) var(--transition-timing);
}

.energy-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #eab308;
  filter: drop-shadow(0 0 4px rgba(234, 179, 8, 0.5));
  flex-shrink: 0;
}

.lightning-svg {
  animation: pulse-energy 2s infinite ease-in-out;
}

.energy-pips {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.energy-pip {
  width: 6px;
  height: 12px;
  border-radius: 2px;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  transform: skewX(-12deg);
}

.pip-filled {
  background: linear-gradient(180deg, #fde047 0%, #eab308 100%);
  box-shadow: 0 0 6px rgba(234, 179, 8, 0.6);
}

.pip-empty {
  background-color: rgba(148, 163, 184, 0.3);
  border: 1px solid rgba(148, 163, 184, 0.4);
}

.energy-text {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
}

.energy-timer {
  font-size: 0.725rem;
  font-weight: 500;
  color: var(--text-muted);
}

@keyframes pulse-energy {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
}

@media (max-width: 1100px) {
  .energy-timer {
    display: none;
  }
}

@media (max-width: 640px) {
  .energy-pips {
    display: none;
  }
  .energy-bar-container {
    padding: 0.25rem 0.5rem;
    gap: 0.25rem;
  }
}
</style>
