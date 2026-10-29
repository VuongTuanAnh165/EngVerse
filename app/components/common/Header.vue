<script setup lang="ts">
import { computed } from 'vue';
import { useUserStore } from '~/stores/user';
import type { WorldTrack } from '~/types/user';

const userStore = useUserStore();

const tracks: Array<{ id: WorldTrack; name: string; emoji: string }> = [
  { id: 'kids', name: 'Đảo Thần Thoại', emoji: '🏝️' },
  { id: 'teens', name: 'Cyber City', emoji: '⚡' },
  { id: 'adults', name: 'SimLife Global', emoji: '🌐' },
];

const currentTrack = computed(() => userStore.currentTrack);
const userGold = computed(() => userStore.gold);
const userLevel = computed(() => userStore.level);
const userExp = computed(() => userStore.exp);
const isGuest = computed(() => userStore.isGuest);
const isSyncing = computed(() => userStore.isSyncing);
const displayName = computed(() => userStore.user.displayName || 'Explorer');
const avatar = computed(() => userStore.user.avatar || 'rookie_explorer');
const equippedTitle = computed(() => userStore.user.equippedTitle || 'Tân Binh');

function onSwitchTrack(trackId: WorldTrack): void {
  userStore.switchWorldTrack(trackId);
}

async function onGoogleSync(): Promise<void> {
  try {
    await userStore.syncGuestWithGoogle();
  } catch (err) {
    console.error('[Header] Sign-in failed:', err);
  }
}

async function onLogout(): Promise<void> {
  await userStore.logout();
}
</script>

<template>
  <header class="engverse-header">
    <div class="header-inner">
      <!-- Left: Logo & Universe Switcher -->
      <div class="header-left">
        <NuxtLink to="/" class="brand-logo" aria-label="EngVerse Trang Chủ">
          <span class="logo-text">EngVerse</span>
          <span class="logo-verse-badge">{{ currentTrack.toUpperCase() }}</span>
        </NuxtLink>

        <!-- 3-Universe Track Switcher -->
        <nav class="universe-selector" aria-label="Chọn Vũ Trụ Học Tập">
          <button
            v-for="item in tracks"
            :key="item.id"
            type="button"
            class="track-tab-btn"
            :class="{ 'tab-active': currentTrack === item.id }"
            @click="onSwitchTrack(item.id)"
          >
            <span class="tab-emoji">{{ item.emoji }}</span>
            <span class="tab-label">{{ item.name }}</span>
          </button>
        </nav>
      </div>

      <!-- Right: Stats & Account -->
      <div class="header-right">
        <!-- Energy -->
        <EnergyBar />

        <!-- Streak -->
        <StreakBadge />

        <!-- Gold Counter -->
        <div class="stat-pill gold-pill" title="Vàng: Dùng mua Khiên Băng và vật phẩm">
          <span class="stat-icon" aria-hidden="true">💰</span>
          <span class="stat-val">{{ userGold }}</span>
        </div>

        <!-- Level & EXP -->
        <div class="stat-pill level-pill" :title="`Cấp độ ${userLevel} - Tổng EXP: ${userExp}`">
          <span class="stat-icon" aria-hidden="true">⭐</span>
          <span class="stat-val">Lv.{{ userLevel }}</span>
        </div>

        <!-- Audio Toggle -->
        <AudioToggle />

        <!-- User Authentication & Profile -->
        <div class="auth-section">
          <!-- Guest CTA: One-tap Google sync -->
          <button
            v-if="isGuest"
            type="button"
            class="guest-save-btn"
            :disabled="isSyncing"
            @click="onGoogleSync"
          >
            <svg
              v-if="!isSyncing"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="currentColor"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            <span v-else class="spinner-small" />
            <span>{{ isSyncing ? 'Đang lưu...' : 'Lưu tài khoản' }}</span>
          </button>

          <!-- Authenticated User Profile -->
          <div v-else class="user-profile-menu">
            <div class="user-avatar-badge" :title="`${displayName} (${equippedTitle})`">
              <img
                v-if="avatar.startsWith('http')"
                :src="avatar"
                :alt="displayName"
                class="avatar-img"
              />
              <span v-else class="avatar-fallback">{{ displayName.charAt(0) }}</span>
            </div>

            <button
              type="button"
              class="logout-btn"
              title="Đăng xuất"
              aria-label="Đăng xuất"
              @click="onLogout"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.engverse-header {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background-color: var(--header-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--header-border);
  transition: all var(--transition-speed) var(--transition-timing);
}

.header-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0.625rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.brand-logo {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  user-select: none;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 900;
  letter-spacing: -0.03em;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.logo-verse-badge {
  font-size: 0.625rem;
  font-weight: 800;
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-sm);
  background: var(--accent-primary);
  color: var(--accent-text);
  letter-spacing: 0.05em;
}

.universe-selector {
  display: flex;
  align-items: center;
  background-color: var(--bg-surface-translucent);
  border: 1px solid var(--border-color);
  padding: 0.2rem;
  border-radius: var(--radius-pill);
  gap: 0.2rem;
}

.track-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-pill);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.track-tab-btn:hover {
  color: var(--text-primary);
}

.tab-active {
  background: var(--accent-gradient);
  color: var(--accent-text) !important;
  box-shadow: var(--shadow-sm);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background-color: var(--bg-surface-translucent);
  border: 1px solid var(--border-color);
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-sm);
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-primary);
}

.gold-pill .stat-icon {
  font-size: 0.95rem;
}

.level-pill .stat-icon {
  font-size: 0.95rem;
  color: #eab308;
}

.guest-save-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 0.8125rem;
  font-weight: 700;
  padding: 0.35rem 0.85rem;
  border-radius: var(--radius-pill);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.guest-save-btn:hover {
  border-color: var(--border-focus);
  transform: translateY(-1px);
}

.user-profile-menu {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.user-avatar-badge {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--border-focus);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-primary);
  color: #ffffff;
  font-weight: bold;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  font-size: 0.875rem;
}

.logout-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.35rem;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.logout-btn:hover {
  color: #ef4444;
}

.spinner-small {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(148, 163, 184, 0.4);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .tab-label {
    display: none;
  }
  .track-tab-btn {
    padding: 0.35rem 0.5rem;
  }
}
</style>

