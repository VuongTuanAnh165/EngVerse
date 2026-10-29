<script setup lang="ts">
/**
 * EngVerse - Mobile Bottom Navigation Bar
 * Duolingo/HoYoLAB style persistent thumb-friendly bottom nav for mobile devices (< 768px).
 * Eliminates header cramping and provides instant 1-tap access to primary game sections.
 */

import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useUserStore } from '~/stores/user';
import { useUiState } from '~/composables/useUiState';

const route = useRoute();
const userStore = useUserStore();
const { openLeaderboard, openMobileMenu } = useUiState();

const currentTrack = computed(() => userStore.currentTrack || 'kids');
const isMapActive = computed(() => route.path === '/');
const isCodexActive = computed(() => route.path.startsWith('/codex'));
const isShareActive = computed(() => route.path.startsWith('/share'));

const universeEmoji = computed(() => {
  switch (currentTrack.value) {
    case 'kids':
      return '🏝️';
    case 'teens':
      return '⚡';
    case 'adults':
      return '🌐';
    default:
      return '✨';
  }
});
</script>

<template>
  <nav class="mobile-bottom-nav" aria-label="Điều hướng chính di động">
    <div class="bottom-nav-inner">
      <!-- 1. Map Tab -->
      <NuxtLink
        to="/"
        class="nav-tab-item"
        :class="{ 'tab-selected': isMapActive }"
        aria-label="Bản đồ thế giới"
      >
        <div class="tab-icon-box">
          <span class="tab-icon">🗺️</span>
        </div>
        <span class="tab-title">Bản đồ</span>
      </NuxtLink>

      <!-- 2. Codex Tab -->
      <NuxtLink
        to="/codex"
        class="nav-tab-item"
        :class="{ 'tab-selected': isCodexActive }"
        aria-label="Sổ tay Thẻ bài 3D"
      >
        <div class="tab-icon-box">
          <span class="tab-icon">📖</span>
        </div>
        <span class="tab-title">Sổ tay</span>
      </NuxtLink>

      <!-- 3. Leaderboard Action -->
      <button
        type="button"
        class="nav-tab-item tab-btn"
        aria-label="Bảng xếp hạng toàn cầu"
        @click="openLeaderboard"
      >
        <div class="tab-icon-box">
          <span class="tab-icon">🏆</span>
        </div>
        <span class="tab-title">Xếp hạng</span>
      </button>

      <!-- 4. Honor Share Card -->
      <NuxtLink
        :to="`/share/${userStore.user.uid || 'guest_user'}`"
        class="nav-tab-item"
        :class="{ 'tab-selected': isShareActive }"
        aria-label="Vinh danh và thành tích"
      >
        <div class="tab-icon-box">
          <span class="tab-icon">🎖️</span>
        </div>
        <span class="tab-title">Vinh danh</span>
      </NuxtLink>

      <!-- 5. Universe Switcher & Menu -->
      <button
        type="button"
        class="nav-tab-item tab-btn"
        aria-label="Vũ trụ và menu cài đặt"
        @click="openMobileMenu"
      >
        <div class="tab-icon-box menu-universe-box">
          <span class="tab-icon">{{ universeEmoji }}</span>
        </div>
        <span class="tab-title">Vũ trụ</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.mobile-bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background-color: var(--header-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid var(--header-border);
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.08);
  padding: 0.35rem 0.5rem calc(0.35rem + env(safe-area-inset-bottom, 0px));
}

.bottom-nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-around;
  max-width: 500px;
  margin: 0 auto;
  gap: 0.25rem;
}

.nav-tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  padding: 0.3rem 0.5rem;
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--text-muted);
  transition: all 0.2s ease;
  user-select: none;
  flex: 1;
  min-width: 0;
}

.tab-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.tab-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.tab-icon {
  font-size: 1.2rem;
  line-height: 1;
}

.tab-title {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
  line-height: 1;
}

.tab-selected {
  color: var(--text-primary);
}

.tab-selected .tab-icon-box {
  transform: translateY(-2px) scale(1.1);
  background: var(--bg-surface-translucent);
  box-shadow: var(--shadow-sm);
}

.tab-selected .tab-title {
  color: var(--accent-primary);
  font-weight: 800;
}

.menu-universe-box {
  position: relative;
}

@media (max-width: 768px) {
  .mobile-bottom-nav {
    display: block;
  }
}
</style>

