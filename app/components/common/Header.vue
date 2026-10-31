<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useUserStore } from '~/stores/user';
import { useUiState } from '~/composables/useUiState';
import type { WorldTrack } from '~/types/user';

// Lazy-loaded Leaderboard Modal & Mobile Menu Drawer
const LeaderboardModal = defineAsyncComponent(() => import('~/components/common/LeaderboardModal.vue'));
const MobileMenuDrawer = defineAsyncComponent(() => import('~/components/common/MobileMenuDrawer.vue'));

const userStore = useUserStore();
const { isLeaderboardOpen, openLeaderboard, openMobileMenu } = useUiState();

interface TrackInfo {
  id: WorldTrack;
  name: string;
  emoji: string;
}

const defaultTrack: TrackInfo = {
  id: 'kids',
  name: 'Đảo Thần Thoại',
  emoji: '🏝️',
};

const tracks: TrackInfo[] = [
  defaultTrack,
  { id: 'teens', name: 'Cyber City', emoji: '⚡' },
  { id: 'adults', name: 'SimLife Global', emoji: '🌐' },
];

const currentTrack = computed(() => userStore.currentTrack || 'kids');
const currentTrackObj = computed<TrackInfo>(() => {
  return tracks.find((t) => t.id === currentTrack.value) ?? defaultTrack;
});

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
    const errorObj = err as { code?: string; message?: string };
    const errCode = errorObj?.code || '';

    if (errCode === 'auth/unauthorized-domain') {
      alert('Tên miền chưa được cấp phép trong Firebase! Vui lòng truy cập qua http://localhost:3000 (không dùng 127.0.0.1) hoặc thêm domain vào Firebase Authentication -> Settings -> Authorized domains.');
    } else if (errCode === 'auth/popup-closed-by-user') {
      console.warn('[Header] Cửa sổ đăng nhập đã bị đóng trước khi hoàn tất.');
    } else if (errCode === 'auth/popup-blocked') {
      alert('Trình duyệt đã chặn cửa sổ Popup! Vui lòng cấp quyền cho phép Pop-up trên thanh địa chỉ trình duyệt để đăng nhập Google.');
    } else if (errCode === 'auth/operation-not-allowed') {
      alert('Chưa kích hoạt tính năng Google Sign-in trên Firebase Console! Vui lòng vào Firebase Console -> Authentication -> Sign-in method -> Bật Google và bấm Save.');
    } else {
      alert(`Đăng nhập Google chưa thành công (${errCode}): ${errorObj?.message || 'Vui lòng nhấn F12 mở tab Console để xem lỗi chi tiết.'}`);
    }
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
        </NuxtLink>

        <!-- Desktop 3-Universe Track Switcher (Visible on >= 1024px) -->
        <nav class="universe-selector desktop-only" aria-label="Chọn Vũ Trụ Học Tập">
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

        <!-- Mobile / Tablet Quick Universe Dropdown Pill (Visible on < 1024px) -->
        <button
          type="button"
          class="mobile-universe-pill mobile-tablet-only"
          title="Bấm để đổi vũ trụ học tập"
          @click="openMobileMenu"
        >
          <span class="pill-emoji">{{ currentTrackObj.emoji }}</span>
          <span class="pill-name">{{ currentTrackObj.name }}</span>
          <span class="pill-arrow" aria-hidden="true">▾</span>
        </button>
      </div>

      <!-- Right: Stats & Account -->
      <div class="header-right">
        <!-- Energy Bar -->
        <EnergyBar />

        <!-- Streak Badge -->
        <StreakBadge class="streak-header-item" />

        <!-- Gold Counter -->
        <div class="stat-pill gold-pill" title="Vàng: Dùng mua Khiên Băng và vật phẩm">
          <span class="stat-icon" aria-hidden="true">💰</span>
          <span class="stat-val">{{ userGold }}</span>
        </div>

        <!-- Level & EXP (Hidden on Mobile < 768px) -->
        <div class="stat-pill level-pill desktop-tablet-only" :title="`Cấp độ ${userLevel} - Tổng EXP: ${userExp}`">
          <span class="stat-icon" aria-hidden="true">⭐</span>
          <span class="stat-val">Lv.{{ userLevel }}</span>
        </div>

        <!-- Global Leaderboard Button (Hidden on Mobile < 768px, available in Bottom Nav) -->
        <button
          type="button"
          class="stat-pill leaderboard-trigger-btn desktop-tablet-only"
          title="Bảng Xếp Hạng Toàn Cầu (Top 30)"
          @click="openLeaderboard"
        >
          <span class="stat-icon" aria-hidden="true">🏆</span>
          <span class="stat-val text-label">Xếp Hạng</span>
        </button>

        <!-- Share Honor Card Link (Visible on >= 992px) -->
        <NuxtLink
          :to="`/share/${userStore.user.uid || 'guest_user'}`"
          class="stat-pill share-trigger-btn large-screen-only"
          title="Xem & Chia Sẻ Thẻ Vinh Danh"
        >
          <span class="stat-icon" aria-hidden="true">🎖️</span>
          <span class="stat-val text-label">Vinh Danh</span>
        </NuxtLink>

        <!-- Audio Toggle (Hidden on Mobile < 768px, available in Mobile Menu) -->
        <AudioToggle class="desktop-tablet-only" />

        <!-- User Authentication & Profile -->
        <div class="auth-section">
          <!-- Guest CTA: One-tap Google sync -->
          <button
            v-if="isGuest"
            type="button"
            class="guest-save-btn"
            :disabled="isSyncing"
            title="Lưu tiến trình học lên Google"
            @click="onGoogleSync"
          >
            <svg
              v-if="!isSyncing"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="currentColor"
              class="google-icon"
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
            <span class="guest-btn-text">
              {{ isSyncing ? 'Đang lưu...' : 'Lưu tài khoản' }}
            </span>
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
              class="logout-btn desktop-tablet-only"
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

    <!-- Global Top 30 Leaderboard Modal -->
    <LeaderboardModal v-model:open="isLeaderboardOpen" />

    <!-- Mobile Slide-Up Settings & Universe Drawer -->
    <MobileMenuDrawer />
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
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--header-border);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
  transition: all var(--transition-speed) var(--transition-timing);
}

.header-inner {
  max-width: 1320px;
  margin: 0 auto;
  padding: 0.5rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}

.brand-logo {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  user-select: none;
  flex-shrink: 0;
}

.logo-text {
  font-size: 1.3rem;
  font-weight: 900;
  letter-spacing: -0.03em;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1;
}

/* 3-Universe Selector (Desktop) */
.universe-selector {
  display: flex;
  align-items: center;
  background-color: var(--bg-surface-translucent);
  border: 1px solid var(--border-color);
  padding: 0.2rem;
  border-radius: var(--radius-pill);
  gap: 0.2rem;
  white-space: nowrap;
  flex-shrink: 0;
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
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  white-space: nowrap;
  flex-shrink: 0;
}

.track-tab-btn:hover {
  color: var(--text-primary);
}

.tab-active {
  background: var(--accent-gradient);
  color: var(--accent-text) !important;
  box-shadow: var(--shadow-sm);
}

.tab-emoji {
  font-size: 0.95rem;
  line-height: 1;
}

.tab-label {
  white-space: nowrap;
}

/* Mobile & Tablet Universe Pill */
.mobile-universe-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background-color: var(--bg-surface-translucent);
  border: 1px solid var(--border-color);
  padding: 0.3rem 0.65rem;
  border-radius: var(--radius-pill);
  color: var(--text-primary);
  font-size: 0.8125rem;
  font-weight: 800;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
  font-family: inherit;
}

.mobile-universe-pill:hover {
  border-color: var(--border-focus);
}

.pill-emoji {
  font-size: 0.95rem;
  line-height: 1;
}

.pill-name {
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pill-arrow {
  font-size: 0.7rem;
  color: var(--text-muted);
}

/* Header Right */
.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  white-space: nowrap;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background-color: var(--bg-surface-translucent);
  border: 1px solid var(--border-color);
  padding: 0.35rem 0.6rem;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-sm);
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  flex-shrink: 0;
}

.stat-icon {
  font-size: 0.95rem;
  line-height: 1;
  flex-shrink: 0;
}

.stat-val {
  white-space: nowrap;
}

.leaderboard-trigger-btn,
.share-trigger-btn {
  cursor: pointer;
  background-color: var(--bg-surface);
  text-decoration: none;
  font-family: inherit;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.leaderboard-trigger-btn:hover,
.share-trigger-btn:hover {
  transform: translateY(-1px);
  border-color: var(--accent-primary);
  box-shadow: var(--shadow-sm);
}

.guest-save-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 0.8125rem;
  font-weight: 700;
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-pill);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s ease;
  font-family: inherit;
}

.guest-save-btn:hover {
  border-color: var(--border-focus);
  transform: translateY(-1px);
}

.guest-btn-text {
  white-space: nowrap;
}

.google-icon {
  flex-shrink: 0;
}

.user-profile-menu {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.user-avatar-badge {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--border-focus);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-primary);
  color: #ffffff;
  font-weight: bold;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  font-size: 0.8125rem;
}

.logout-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.3rem;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
  flex-shrink: 0;
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
  flex-shrink: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Visibility classes */
.mobile-tablet-only {
  display: none;
}

.desktop-only {
  display: flex;
}

.desktop-tablet-only {
  display: inline-flex;
}

.large-screen-only {
  display: inline-flex;
}

/* ==========================================================================
   Responsive Breakpoints: PC -> Laptop -> Tablet -> Mobile
   ========================================================================== */

/* Laptop (1024px - 1199px) */
@media (max-width: 1199px) {
  .large-screen-only {
    display: none; /* Hide Vinh Danh button to keep laptop header clean */
  }
  .track-tab-btn {
    padding: 0.35rem 0.55rem;
    font-size: 0.78rem;
  }
}

/* Tablet (768px - 1023px) */
@media (max-width: 1023px) {
  .desktop-only {
    display: none; /* Hide 3 desktop tabs */
  }
  .mobile-tablet-only {
    display: inline-flex; /* Show single compact universe pill */
  }
  .guest-btn-text {
    display: none; /* Icon-only Google save button on tablet */
  }
  .guest-save-btn {
    padding: 0.35rem 0.5rem;
  }
  .leaderboard-trigger-btn .text-label {
    display: none; /* Icon-only leaderboard button on tablet */
  }
  .leaderboard-trigger-btn {
    padding: 0.35rem 0.5rem;
  }
}

/* Mobile (< 768px) */
@media (max-width: 767px) {
  .header-inner {
    padding: 0.4rem 0.75rem;
    gap: 0.4rem;
  }
  .logo-text {
    font-size: 1.15rem;
  }
  .pill-name {
    display: none; /* Only show emoji on small mobile screens */
  }
  .mobile-universe-pill {
    padding: 0.25rem 0.45rem;
  }
  .desktop-tablet-only {
    display: none; /* Level, Leaderboard, Audio moved to Mobile Bottom Nav & Drawer */
  }
  .header-right {
    gap: 0.35rem;
  }
  .gold-pill {
    padding: 0.25rem 0.45rem;
    font-size: 0.78rem;
  }
}
</style>
