<script setup lang="ts">
/**
 * EngVerse - WorldKidsView Component
 * Dedicated World Interface for Universe 1: Đảo Thần Thoại (Kids 5-12).
 * Features:
 * - Floating fantasy magical islands & dragon egg incubator
 * - Whimsical cartoon cloud particles (60FPS GPU CSS)
 * - Chapter mission banner with interactive egg hatching milestone
 *
 * Strict TypeScript (0 any), Vue 3.5+
 * Reference: docs/ke_hoach.md - Sprint 5, Task 3 & Sprint 2
 */

import { computed } from 'vue';
import { useUserStore } from '~/stores/user';

const userStore = useUserStore();

const kidsProgress = computed(() => userStore.user.progress?.tracks?.kids);
const unlockedStage = computed(() => kidsProgress.value?.unlockedStage || 1);
const totalStars = computed(() => {
  const starsMap = kidsProgress.value?.stageStars || {};
  return Object.values(starsMap).reduce((sum, s) => sum + s, 0);
});

// Incubation percentage based on stars collected (out of 15 max stars in Chapter 1)
const eggHatchPercent = computed(() => Math.min(100, Math.round((totalStars.value / 15) * 100)));
</script>

<template>
  <div class="world-kids-container">
    <!-- Floating Cartoon Sky Elements -->
    <div class="sky-elements" aria-hidden="true">
      <div class="floating-cloud cloud-1">☁️</div>
      <div class="floating-cloud cloud-2">☁️</div>
      <div class="floating-sparkle sparkle-1">✨</div>
      <div class="floating-sparkle sparkle-2">🌟</div>
    </div>

    <!-- Dragon Egg Incubator Status Card -->
    <div class="kids-banner theme-card">
      <div class="dragon-egg-pod">
        <div class="egg-display" :class="{ 'egg-pulsing': eggHatchPercent > 0 }">
          <span class="egg-icon" aria-hidden="true">🥚</span>
          <div v-if="eggHatchPercent >= 100" class="hatch-badge">SẴN SÀNG NỞ! 🐣</div>
        </div>
      </div>

      <div class="incubator-info">
        <div class="chapter-badge">CHƯƠNG 1: HÀNH TRÌNH ẤP TRỨNG RỒNG</div>
        <h3 class="incubator-title">Lò Ấp Trứng Rồng Thần Thoại</h3>
        <p class="incubator-desc">
          Thu thập Ngôi Sao từ các chặng thử thách để truyền năng lượng cho Trứng Rồng nở thành thú cưng đồng hành!
        </p>

        <!-- Incubation Progress Bar -->
        <div class="egg-progress-wrapper">
          <div class="egg-progress-bar">
            <div class="egg-progress-fill" :style="{ width: `${eggHatchPercent}%` }" />
          </div>
          <span class="egg-progress-text">{{ eggHatchPercent }}% Năng lượng ({{ totalStars }}/15 ⭐)</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.world-kids-container {
  position: relative;
  margin-bottom: 2rem;
  overflow: hidden;
}

.sky-elements {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

.floating-cloud {
  position: absolute;
  font-size: 2.5rem;
  opacity: 0.6;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.05));
  will-change: transform;
}

.cloud-1 {
  top: 5%;
  left: 2%;
  animation: float-horizontal 18s linear infinite;
}

.cloud-2 {
  top: 40%;
  right: 5%;
  animation: float-horizontal 24s linear infinite reverse;
}

.floating-sparkle {
  position: absolute;
  font-size: 1.5rem;
  animation: sparkle-twinkle 2.5s ease-in-out infinite;
}

.sparkle-1 {
  top: 15%;
  right: 15%;
  animation-delay: 0.5s;
}

.sparkle-2 {
  bottom: 20%;
  left: 10%;
  animation-delay: 1.2s;
}

@keyframes float-horizontal {
  0% { transform: translate3d(-20px, 0, 0); }
  50% { transform: translate3d(20px, -10px, 0); }
  100% { transform: translate3d(-20px, 0, 0); }
}

@keyframes sparkle-twinkle {
  0%, 100% { opacity: 0.3; transform: scale(0.8) rotate(0deg); }
  50% { opacity: 1; transform: scale(1.2) rotate(15deg); }
}

.kids-banner {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 1.75rem;
  padding: 1.5rem 2rem;
  background: linear-gradient(135deg, rgba(254, 252, 232, 0.95) 0%, rgba(254, 240, 138, 0.6) 100%);
  border: 2px solid #fde047;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.dragon-egg-pod {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.egg-display {
  width: 90px;
  height: 90px;
  background: radial-gradient(circle, #fef08a 0%, #f59e0b 100%);
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  box-shadow: 0 8px 20px rgba(245, 158, 11, 0.35);
  position: relative;
  transition: transform 0.3s ease;
}

.egg-pulsing {
  animation: egg-bounce 2s infinite ease-in-out;
}

@keyframes egg-bounce {
  0%, 100% { transform: scale(1) translateY(0); }
  50% { transform: scale(1.06) translateY(-6px); }
}

.hatch-badge {
  position: absolute;
  bottom: -10px;
  background: #10b981;
  color: #ffffff;
  font-size: 0.625rem;
  font-weight: 900;
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
}

.incubator-info {
  flex: 1;
}

.chapter-badge {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 800;
  color: #b45309;
  background: rgba(245, 158, 11, 0.2);
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  margin-bottom: 0.5rem;
  letter-spacing: 0.05em;
}

.incubator-title {
  margin: 0 0 0.4rem 0;
  font-size: 1.375rem;
  font-weight: 900;
  color: #713f12;
}

.incubator-desc {
  margin: 0 0 0.875rem 0;
  font-size: 0.875rem;
  color: #854d0e;
  line-height: 1.5;
}

.egg-progress-wrapper {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.egg-progress-bar {
  flex: 1;
  height: 12px;
  background: rgba(217, 119, 6, 0.15);
  border-radius: 9999px;
  overflow: hidden;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.egg-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #f59e0b 0%, #10b981 100%);
  border-radius: 9999px;
  transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.egg-progress-text {
  font-size: 0.75rem;
  font-weight: 800;
  color: #b45309;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .kids-banner {
    flex-direction: column;
    text-align: center;
    padding: 1.25rem 1rem;
    gap: 1rem;
  }
  .egg-progress-wrapper {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>

