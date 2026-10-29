<script setup lang="ts">
import { computed } from 'vue';
import { useUserStore } from '~/stores/user';

const userStore = useUserStore();

const streakDays = computed(() => userStore.streak?.current ?? 0);
const freezeShields = computed(() => userStore.streak?.freezeShields ?? 0);
const hasActiveShield = computed(() => freezeShields.value > 0);
</script>

<template>
  <div
    class="streak-badge-container"
    :title="`Chuỗi học: ${streakDays} ngày liên tục. Khiên Băng: ${freezeShields} khiên bảo vệ.`"
  >
    <!-- Streak Flame -->
    <div class="streak-flame-box" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="currentColor"
        class="flame-svg"
      >
        <path
          d="M12 2c-.5 2-1 3.5-3 5.5-2.2 2.2-3 4.3-3 6.5 0 4.4 3.6 8 8 8s8-3.6 8-8c0-3.5-2.2-6.5-4-8.5-1-1.1-1.5-2.5-1.5-3.5 0 0-1 0-1.5.5s-1.5 1.5-1.5 2.5c0 1.5-1 2.5-1.5 2.5-.3 0-.5-.5-.5-1z"
        />
      </svg>
    </div>

    <!-- Days Count -->
    <span class="streak-count">{{ streakDays }}</span>

    <!-- Freeze Shield Status -->
    <div
      v-if="hasActiveShield"
      class="freeze-shield-indicator"
      title="Khiên Băng đang bảo vệ chuỗi ngày học của bạn!"
    >
      <svg
        viewBox="0 0 24 24"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
      <span class="shield-count">{{ freezeShields }}</span>
    </div>
  </div>
</template>

<style scoped>
.streak-badge-container {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background-color: var(--bg-surface-translucent);
  border: 1px solid var(--border-color);
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-sm);
  user-select: none;
  transition: all var(--transition-speed) var(--transition-timing);
}

.streak-flame-box {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f97316;
  filter: drop-shadow(0 0 6px rgba(249, 115, 22, 0.6));
}

.flame-svg {
  animation: flicker-flame 1.8s infinite ease-in-out alternate;
}

.streak-count {
  font-size: 0.8125rem;
  font-weight: 800;
  color: var(--text-primary);
}

.freeze-shield-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.4);
  color: #38bdf8;
  padding: 0.1rem 0.35rem;
  border-radius: var(--radius-pill);
  font-size: 0.6875rem;
  font-weight: 700;
  margin-left: 0.25rem;
}

@keyframes flicker-flame {
  0% {
    transform: scale(0.96) rotate(-2deg);
  }
  100% {
    transform: scale(1.08) rotate(3deg);
  }
}
</style>

