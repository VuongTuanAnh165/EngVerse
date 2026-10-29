<script setup lang="ts">
/**
 * EngVerse - Mobile Universe Switcher & Quick Menu Drawer
 * Slide-up mobile modal for seamless universe switching, audio settings, and account management.
 */

import { computed } from 'vue';
import { useUserStore } from '~/stores/user';
import { useUiState } from '~/composables/useUiState';
import type { WorldTrack } from '~/types/user';

const userStore = useUserStore();
const { isMobileMenuOpen, closeMobileMenu } = useUiState();

const tracks: Array<{ id: WorldTrack; name: string; age: string; emoji: string; desc: string }> = [
  {
    id: 'kids',
    name: 'Đảo Thần Thoại',
    age: '5 - 12 tuổi',
    emoji: '🏝️',
    desc: 'Nuôi thú cưng, ấp trứng rồng & phản xạ qua hình ảnh rực rỡ.',
  },
  {
    id: 'teens',
    name: 'Cyber City',
    age: '13 - 22 tuổi',
    emoji: '⚡',
    desc: 'Phá án thám tử học viện Neo-High & giải mã dữ liệu Neon.',
  },
  {
    id: 'adults',
    name: 'SimLife Global',
    age: '23+ tuổi',
    emoji: '🌐',
    desc: 'Mô phỏng đàm phán quốc tế, phỏng vấn và thăng tiến sự nghiệp.',
  },
];

const currentTrack = computed(() => userStore.currentTrack);
const userGold = computed(() => userStore.gold);
const userLevel = computed(() => userStore.level);
const userExp = computed(() => userStore.exp);
const streakDays = computed(() => userStore.streak?.current ?? 0);
const freezeShields = computed(() => userStore.streak?.freezeShields ?? 0);
const isGuest = computed(() => userStore.isGuest);
const isSyncing = computed(() => userStore.isSyncing);
const displayName = computed(() => userStore.user.displayName || 'Nhà Thám Hiểm');
const avatar = computed(() => userStore.user.avatar || 'rookie_explorer');

function selectTrack(trackId: WorldTrack): void {
  userStore.switchWorldTrack(trackId);
  closeMobileMenu();
}

async function onGoogleSync(): Promise<void> {
  try {
    await userStore.syncGuestWithGoogle();
  } catch (err) {
    console.error('[MobileMenuDrawer] Google sync failed:', err);
  }
}

async function onLogout(): Promise<void> {
  await userStore.logout();
  closeMobileMenu();
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div
        v-if="isMobileMenuOpen"
        class="mobile-drawer-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-menu-title"
        @click.self="closeMobileMenu"
      >
        <div class="mobile-drawer-sheet theme-card">
          <!-- Drawer Drag Handle & Header -->
          <div class="drawer-header">
            <div class="drag-pill" aria-hidden="true" />
            <div class="drawer-title-row">
              <h2 id="mobile-menu-title" class="drawer-title">
                Khám Phá & Cài Đặt
              </h2>
              <button
                type="button"
                class="drawer-close-btn"
                aria-label="Đóng bảng cài đặt"
                @click="closeMobileMenu"
              >
                ✕
              </button>
            </div>
          </div>

          <div class="drawer-body">
            <!-- 1. Track Selector Cards -->
            <section class="drawer-section">
              <h3 class="section-label">CHỌN VŨ TRỤ HỌC TẬP</h3>
              <div class="universe-cards-grid">
                <button
                  v-for="item in tracks"
                  :key="item.id"
                  type="button"
                  class="universe-card-btn"
                  :class="{ 'card-active': currentTrack === item.id }"
                  @click="selectTrack(item.id)"
                >
                  <div class="card-icon-box">
                    <span class="card-emoji">{{ item.emoji }}</span>
                  </div>
                  <div class="card-info">
                    <div class="card-title-row">
                      <span class="card-name">{{ item.name }}</span>
                      <span class="card-age-tag">{{ item.age }}</span>
                    </div>
                    <p class="card-desc">{{ item.desc }}</p>
                  </div>
                  <div v-if="currentTrack === item.id" class="card-check-badge">✓</div>
                </button>
              </div>
            </section>

            <!-- 2. User Overview & Level Progress -->
            <section class="drawer-section">
              <h3 class="section-label">HỒ SƠ NHÀ THÁM HIỂM</h3>
              <div class="user-stats-card">
                <div class="user-info-row">
                  <div class="user-avatar-pod">
                    <img
                      v-if="avatar.startsWith('http')"
                      :src="avatar"
                      :alt="displayName"
                      class="avatar-img"
                    />
                    <span v-else class="avatar-letter">{{ displayName.charAt(0) }}</span>
                  </div>
                  <div class="user-text-pod">
                    <span class="user-name">{{ displayName }}</span>
                    <span class="user-level-tag">Cấp độ {{ userLevel }} • {{ userExp }} EXP</span>
                  </div>
                </div>

                <div class="user-quick-stats">
                  <div class="drawer-stat-item">
                    <span class="stat-ico">💰</span>
                    <span class="stat-num">{{ userGold }} Vàng</span>
                  </div>
                  <div class="drawer-stat-item">
                    <span class="stat-ico">🔥</span>
                    <span class="stat-num">{{ streakDays }} Ngày</span>
                  </div>
                  <div class="drawer-stat-item">
                    <span class="stat-ico">🛡️</span>
                    <span class="stat-num">{{ freezeShields }} Khiên</span>
                  </div>
                </div>
              </div>
            </section>

            <!-- 3. Utilities & Auth -->
            <section class="drawer-section">
              <div class="drawer-actions-list">
                <!-- Sound Toggle -->
                <div class="action-row">
                  <div class="action-info">
                    <span class="action-ico">🔊</span>
                    <span>Âm thanh hiệu ứng</span>
                  </div>
                  <AudioToggle />
                </div>

                <!-- Google Sync or Logout -->
                <div v-if="isGuest" class="auth-box">
                  <button
                    type="button"
                    class="theme-btn-primary full-auth-btn"
                    :disabled="isSyncing"
                    @click="onGoogleSync"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
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
                    <span>{{ isSyncing ? 'Đang lưu...' : 'Lưu tài khoản Google' }}</span>
                  </button>
                </div>

                <div v-else class="auth-box">
                  <button
                    type="button"
                    class="logout-action-btn"
                    @click="onLogout"
                  >
                    <span>Đăng xuất tài khoản</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.mobile-drawer-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.mobile-drawer-sheet {
  width: 100%;
  max-width: 540px;
  max-height: 85vh;
  background: var(--bg-surface);
  border-top-left-radius: var(--radius-lg);
  border-top-right-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.drawer-header {
  padding: 0.75rem 1.25rem 0.5rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.drag-pill {
  width: 40px;
  height: 4px;
  border-radius: 9999px;
  background-color: var(--border-color);
}

.drawer-title-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--text-primary);
}

.drawer-close-btn {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
}

.drawer-body {
  padding: 1.25rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.drawer-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-label {
  margin: 0;
  font-size: 0.6875rem;
  font-weight: 800;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

.universe-cards-grid {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.universe-card-btn {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--border-color);
  background: var(--bg-surface-translucent);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
  position: relative;
  font-family: inherit;
}

.universe-card-btn:hover {
  border-color: var(--border-focus);
}

.card-active {
  border-color: var(--accent-primary);
  background: var(--bg-card-hover);
  box-shadow: var(--shadow-sm);
}

.card-icon-box {
  font-size: 1.5rem;
  width: 42px;
  height: 42px;
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-info {
  flex: 1;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.2rem;
}

.card-name {
  font-weight: 800;
  font-size: 0.9375rem;
  color: var(--text-primary);
}

.card-age-tag {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--text-muted);
  background: rgba(148, 163, 184, 0.15);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.card-desc {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.35;
}

.card-check-badge {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--accent-primary);
  color: var(--accent-text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 900;
  flex-shrink: 0;
}

.user-stats-card {
  background: var(--bg-surface-translucent);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.875rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.user-info-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar-pod {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--accent-primary);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-text-pod {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 0.9375rem;
  font-weight: 800;
  color: var(--text-primary);
}

.user-level-tag {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.user-quick-stats {
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: var(--bg-primary);
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.drawer-stat-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-primary);
}

.drawer-actions-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.25rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-primary);
}

.action-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.full-auth-btn {
  width: 100%;
  padding: 0.75rem;
  border-radius: var(--radius-pill);
  gap: 0.6rem;
}

.logout-action-btn {
  width: 100%;
  padding: 0.7rem;
  border: 1px solid #ef4444;
  background: transparent;
  color: #ef4444;
  border-radius: var(--radius-pill);
  font-weight: 700;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.logout-action-btn:hover {
  background: #ef4444;
  color: #ffffff;
}

@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.25s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}
</style>

