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
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
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
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
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
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
          </svg>
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
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="6" />
            <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
          </svg>
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
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span class="universe-active-dot" :class="`dot-${currentTrack}`" />
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

:root[data-theme="kids"] .tab-selected .tab-title,
html[data-theme="kids"] .tab-selected .tab-title {
  color: #b45309;
}

:root[data-theme="kids"] .tab-selected .tab-icon-box,
html[data-theme="kids"] .tab-selected .tab-icon-box {
  background: #fef3c7;
  border-bottom: 2px solid #f59e0b;
}

:root[data-theme="adults"] .tab-selected .tab-title,
html[data-theme="adults"] .tab-selected .tab-title {
  color: #059669;
}

:root[data-theme="adults"] .tab-selected .tab-icon-box,
html[data-theme="adults"] .tab-selected .tab-icon-box {
  border-bottom: 2px solid #059669;
}

.menu-universe-box {
  position: relative;
}

.universe-active-dot {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1px solid var(--header-bg);
}

.dot-kids {
  background-color: #f59e0b;
}

.dot-teens {
  background-color: #06b6d4;
  box-shadow: 0 0 6px #06b6d4;
}

.dot-adults {
  background-color: #059669;
}

@media (max-width: 768px) {
  .mobile-bottom-nav {
    display: block;
  }
}
</style>

