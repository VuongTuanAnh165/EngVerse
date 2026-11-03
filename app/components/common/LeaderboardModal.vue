<script setup lang="ts">
/**
 * EngVerse - LeaderboardModal Component (Bảng Vinh Danh Toàn Cầu)
 * Displays global Top 30 leaderboard with Esports/Olympic-style Top 3 Podium,
 * user ranking standing card, inspiring empty benchmark states, and universe-adaptive styling.
 *
 * Strict TypeScript (0 any), Vue 3.5+.
 * Reference: docs/ke_hoach.md & Rules.md
 */

import { ref, computed, watch } from 'vue';
import type { LeaderboardEntry, LeaderboardResponse, WorldTrack } from '~/types/user';
import { useUserStore } from '~/stores/user';
import { useSoundEffects } from '~/composables/useSoundEffects';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
}>();

const userStore = useUserStore();
const { playSound } = useSoundEffects();

const entries = ref<LeaderboardEntry[]>([]);
const isLoading = ref<boolean>(false);
const fetchError = ref<string | null>(null);
const selectedFilter = ref<string>('all'); // 'all' | 'kids' | 'teens' | 'adults'
const avatarErrors = ref<Record<string, boolean>>({});

function handleAvatarError(key: string): void {
  avatarErrors.value[key] = true;
}

function hasAvatarError(key: string): boolean {
  return !!avatarErrors.value[key];
}

const filteredEntries = computed<LeaderboardEntry[]>(() => {
  if (selectedFilter.value === 'all') {
    return entries.value;
  }
  return entries.value.filter((e) => e.worldTrack === selectedFilter.value);
});

// Dynamic theme driven by active filter or user's current world
const currentModalTheme = computed<WorldTrack>(() => {
  if (selectedFilter.value === 'kids') return 'kids';
  if (selectedFilter.value === 'teens') return 'teens';
  if (selectedFilter.value === 'adults') return 'adults';
  return userStore.user.worldTrack || 'kids';
});

const topFirst = computed<LeaderboardEntry | undefined>(() => filteredEntries.value[0]);
const topSecond = computed<LeaderboardEntry | undefined>(() => filteredEntries.value[1]);
const topThird = computed<LeaderboardEntry | undefined>(() => filteredEntries.value[2]);
const remainingEntries = computed<LeaderboardEntry[]>(() => filteredEntries.value.slice(3));

const currentUserRank = computed<number | null>(() => {
  const foundIndex = filteredEntries.value.findIndex((e) => e.uid === userStore.user.uid);
  if (foundIndex !== -1) {
    return foundIndex + 1;
  }
  return null;
});

async function loadLeaderboard(): Promise<void> {
  isLoading.value = true;
  fetchError.value = null;

  try {
    const res = await $fetch<LeaderboardResponse>('/api/leaderboard');
    entries.value = res.entries || [];
  } catch (err: unknown) {
    console.error('[LeaderboardModal] Fetch error:', err);
    fetchError.value = 'Không thể tải Bảng Vinh Danh lúc này. Vui lòng thử lại sau.';
  } finally {
    isLoading.value = false;
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      playSound('click');
      selectedFilter.value = userStore.user.worldTrack || 'all';
      avatarErrors.value = {};
      void loadLeaderboard();
    }
  }
);

function closeModal(): void {
  playSound('click');
  emit('update:open', false);
}

function setFilter(filter: string): void {
  playSound('click');
  selectedFilter.value = filter;
}

function getTrackBadge(track: WorldTrack): { name: string; emoji: string } {
  switch (track) {
    case 'kids':
      return { name: 'Đảo Thần Thoại', emoji: '🏝️' };
    case 'teens':
      return { name: 'Cyber City', emoji: '⚡' };
    case 'adults':
      return { name: 'SimLife Global', emoji: '🌐' };
    default:
      return { name: 'EngVerse', emoji: '✨' };
  }
}

function getTrackName(trackKey: string): string {
  switch (trackKey) {
    case 'kids':
      return 'Đảo Thần Thoại';
    case 'teens':
      return 'Cyber City';
    case 'adults':
      return 'SimLife Global';
    default:
      return 'Toàn Hệ Thống';
  }
}

function formatTitle(titleKey?: string): string {
  if (!titleKey) return 'Tân Binh';
  const titleMap: Record<string, string> = {
    rookie_explorer: 'Tân Binh Khám Phá',
    title_streak_master: 'Chiến Binh Bất Bại',
    title_boss_slayer: 'Dũng Sĩ Diệt Boss',
    title_multiverse_champion: 'Quán Quân Đa Vũ Trụ',
    dragon_rider: 'Kỵ Sĩ Rồng Thần',
    cyber_legend: 'Huyền Thoại Hacker',
    corporate_elite: 'Tinh Anh Toàn Cầu',
  };
  return titleMap[titleKey] || titleKey;
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="open"
        class="leaderboard-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-title"
        @click.self="closeModal"
      >
        <div
          class="leaderboard-card theme-card"
          :class="[`modal-theme-${currentModalTheme}`, `active-filter-${selectedFilter}`]"
        >
          <!-- Ambient Glow Background -->
          <div class="ambient-glow" aria-hidden="true" />

          <!-- Header -->
          <div class="modal-header">
            <div class="title-group">
              <div class="trophy-orb" aria-hidden="true">
                <svg viewBox="0 0 24 24" class="trophy-svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" />
                  <path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
                  <path d="M14 14.66V17c0 .55.45 1 1 1h2" />
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                </svg>
              </div>
              <div>
                <h2 id="leaderboard-title" class="modal-title">Bảng Vinh Danh Toàn Cầu</h2>
                <p class="modal-subtitle">Đấu Trường Xếp Hạng &amp; Top 30 Nhà Thám Hiểm Xuất Sắc</p>
              </div>
            </div>

            <button
              type="button"
              class="close-modal-btn"
              aria-label="Đóng bảng xếp hạng"
              @click="closeModal"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <!-- Universe Track Filter Tabs -->
          <div class="track-filter-tabs">
            <button
              type="button"
              class="filter-tab-btn"
              :class="{ 'filter-active': selectedFilter === 'all' }"
              @click="setFilter('all')"
            >
              <span>🌐</span>
              <span>Toàn Hệ Thống</span>
            </button>
            <button
              type="button"
              class="filter-tab-btn"
              :class="{ 'filter-active': selectedFilter === 'kids' }"
              @click="setFilter('kids')"
            >
              <span>🏝️</span>
              <span>Đảo Thần Thoại</span>
            </button>
            <button
              type="button"
              class="filter-tab-btn"
              :class="{ 'filter-active': selectedFilter === 'teens' }"
              @click="setFilter('teens')"
            >
              <span>⚡</span>
              <span>Cyber City</span>
            </button>
            <button
              type="button"
              class="filter-tab-btn"
              :class="{ 'filter-active': selectedFilter === 'adults' }"
              @click="setFilter('adults')"
            >
              <span>💼</span>
              <span>SimLife Global</span>
            </button>
          </div>

          <!-- Modal Scrollable Body -->
          <div class="modal-body-content">
            <!-- Loading State -->
            <div v-if="isLoading" class="loading-state">
              <div class="loading-spinner" />
              <p>Đang đồng bộ Bảng Vinh Danh thời gian thực...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="fetchError" class="error-state">
              <div class="error-icon">⚠️</div>
              <p>{{ fetchError }}</p>
              <button type="button" class="theme-btn-primary retry-btn" @click="loadLeaderboard">
                Thử lại
              </button>
            </div>

            <!-- Empty State (Inspiring Pioneer State) -->
            <div v-else-if="filteredEntries.length === 0" class="empty-state-card">
              <div class="empty-trophy-orb">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" />
                  <path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
                  <path d="M14 14.66V17c0 .55.45 1 1 1h2" />
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                </svg>
              </div>
              <h3 class="empty-state-title">Đấu Trường Đang Chờ Quán Quân!</h3>
              <p class="empty-state-desc">
                Chưa có chiến binh nào ghi danh tại <strong>{{ getTrackName(selectedFilter) }}</strong>. Bạn có muốn trở thành Nhà Thám Hiểm đầu tiên bước lên Bục Quán Quân Top 1?
              </p>
              <button type="button" class="theme-btn-primary empty-action-btn" @click="closeModal">
                <span>🚀</span>
                <span>Vượt Ải Lên Bảng Vàng Ngay</span>
              </button>
            </div>

            <!-- Content With Podium & List -->
            <div v-else class="leaderboard-content-wrapper">
              <!-- Top 3 Podium (Bục Vinh Quang) -->
              <div class="podium-container">
                <!-- Rank 2: Silver (Left) -->
                <div class="podium-column rank-2" :class="{ 'is-empty': !topSecond }">
                  <div v-if="topSecond" class="podium-player">
                    <div class="podium-avatar-wrapper silver-glow">
                      <img
                        v-if="topSecond.avatar && !hasAvatarError('topSecond')"
                        :src="topSecond.avatar"
                        class="podium-avatar-img"
                        alt=""
                        @error="handleAvatarError('topSecond')"
                      />
                      <span v-else class="podium-avatar-fallback">🥈</span>
                      <span class="podium-rank-pill silver">#2</span>
                    </div>
                    <strong class="podium-player-name" :title="topSecond.displayName">{{ topSecond.displayName }}</strong>
                    <span class="podium-title-tag">{{ formatTitle(topSecond.equippedTitle) }}</span>
                    <span class="podium-score-pill">{{ topSecond.exp.toLocaleString() }} EXP</span>
                  </div>
                  <div v-else class="podium-empty-slot">
                    <span class="empty-slot-icon">🥈</span>
                    <span class="empty-slot-text">Chờ Á Quân</span>
                  </div>
                  <div class="podium-pedestal pedestal-silver">
                    <span class="pedestal-num">2</span>
                  </div>
                </div>

                <!-- Rank 1: Gold (Center - Tallest) -->
                <div class="podium-column rank-1" :class="{ 'is-empty': !topFirst }">
                  <div v-if="topFirst" class="podium-player">
                    <div class="crown-icon-aura" aria-hidden="true">👑</div>
                    <div class="podium-avatar-wrapper gold-glow">
                      <img
                        v-if="topFirst.avatar && !hasAvatarError('topFirst')"
                        :src="topFirst.avatar"
                        class="podium-avatar-img"
                        alt=""
                        @error="handleAvatarError('topFirst')"
                      />
                      <span v-else class="podium-avatar-fallback">👑</span>
                      <span class="podium-rank-pill gold">#1</span>
                    </div>
                    <strong class="podium-player-name gold-text" :title="topFirst.displayName">{{ topFirst.displayName }}</strong>
                    <span class="podium-title-tag">{{ formatTitle(topFirst.equippedTitle) }}</span>
                    <span class="podium-score-pill gold-pill">{{ topFirst.exp.toLocaleString() }} EXP</span>
                  </div>
                  <div v-else class="podium-empty-slot">
                    <span class="empty-slot-icon">👑</span>
                    <span class="empty-slot-text">Chờ Quán Quân</span>
                  </div>
                  <div class="podium-pedestal pedestal-gold">
                    <span class="pedestal-num">1</span>
                  </div>
                </div>

                <!-- Rank 3: Bronze (Right) -->
                <div class="podium-column rank-3" :class="{ 'is-empty': !topThird }">
                  <div v-if="topThird" class="podium-player">
                    <div class="podium-avatar-wrapper bronze-glow">
                      <img
                        v-if="topThird.avatar && !hasAvatarError('topThird')"
                        :src="topThird.avatar"
                        class="podium-avatar-img"
                        alt=""
                        @error="handleAvatarError('topThird')"
                      />
                      <span v-else class="podium-avatar-fallback">🥉</span>
                      <span class="podium-rank-pill bronze">#3</span>
                    </div>
                    <strong class="podium-player-name" :title="topThird.displayName">{{ topThird.displayName }}</strong>
                    <span class="podium-title-tag">{{ formatTitle(topThird.equippedTitle) }}</span>
                    <span class="podium-score-pill">{{ topThird.exp.toLocaleString() }} EXP</span>
                  </div>
                  <div v-else class="podium-empty-slot">
                    <span class="empty-slot-icon">🥉</span>
                    <span class="empty-slot-text">Chờ Hạng 3</span>
                  </div>
                  <div class="podium-pedestal pedestal-bronze">
                    <span class="pedestal-num">3</span>
                  </div>
                </div>
              </div>

              <!-- Remaining Entries List (#4 to #30) -->
              <div v-if="remainingEntries.length > 0" class="entries-list">
                <div class="entries-list-header">
                  <span>BẢNG XẾP HẠNG TOP 4 — TOP 30</span>
                </div>
                <div
                  v-for="player in remainingEntries"
                  :key="player.uid"
                  class="leaderboard-row"
                  :class="{
                    'is-current-user': player.uid === userStore.user.uid
                  }"
                >
                  <!-- Rank Badge -->
                  <div class="rank-column">
                    <span class="rank-number">#{{ player.rank }}</span>
                  </div>

                  <!-- Avatar & Player Info -->
                  <div class="player-info-column">
                    <div class="player-avatar-badge" aria-hidden="true">
                      <img
                        v-if="player.avatar && !hasAvatarError(player.uid)"
                        :src="player.avatar"
                        class="row-avatar-img"
                        alt=""
                        @error="handleAvatarError(player.uid)"
                      />
                      <span v-else>🧑‍🚀</span>
                    </div>
                    <div class="player-text-details">
                      <div class="player-name-row">
                        <span class="player-display-name">{{ player.displayName }}</span>
                        <span v-if="player.uid === userStore.user.uid" class="you-badge">Bạn</span>
                        <span class="player-title-badge">{{ formatTitle(player.equippedTitle) }}</span>
                      </div>
                      <div class="player-meta-row">
                        <span class="track-tag-pill">
                          {{ getTrackBadge(player.worldTrack).emoji }} {{ getTrackBadge(player.worldTrack).name }}
                        </span>
                        <span class="level-indicator">Lv.{{ player.level }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- EXP Score -->
                  <div class="score-column">
                    <span class="score-val">{{ player.exp.toLocaleString() }}</span>
                    <span class="score-label">EXP</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Current User Standing Bar (Pinned Bottom Card) -->
          <div class="user-standing-card">
            <div class="user-standing-left">
              <div class="standing-rank-badge" :class="{ 'top-three-rank': currentUserRank && currentUserRank <= 3 }">
                <span class="standing-rank-label">VỊ TRÍ</span>
                <span class="standing-rank-val">{{ currentUserRank ? `#${currentUserRank}` : '#--' }}</span>
              </div>
              <div class="standing-avatar-box">
                <img
                  v-if="userStore.user.avatar && !hasAvatarError('currentUser')"
                  :src="userStore.user.avatar"
                  class="standing-avatar-img"
                  alt=""
                  @error="handleAvatarError('currentUser')"
                />
                <span v-else class="standing-avatar-fallback">🧑‍🚀</span>
                <span class="standing-level-dot">Lv.{{ userStore.user.level || 1 }}</span>
              </div>
              <div class="standing-info">
                <div class="standing-name-row">
                  <strong class="standing-name">{{ userStore.user.displayName || 'Nhà Thám Hiểm' }}</strong>
                  <span class="standing-title-pill">{{ formatTitle(userStore.user.equippedTitle) }}</span>
                </div>
                <span class="standing-hint">
                  {{ currentUserRank && currentUserRank <= 3 ? '🎉 Tuyệt vời! Bạn đang đứng trên Bục Vinh Quang!' : 'Vượt ải và tham gia Boss Rush để tích lũy thêm EXP thăng hạng!' }}
                </span>
              </div>
            </div>
            <div class="user-standing-right">
              <span class="standing-exp-num">{{ (userStore.user.exp || 0).toLocaleString() }}</span>
              <span class="standing-exp-label">TỔNG EXP</span>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <div class="footer-note">
              <span class="cdn-dot" />
              <span>Dữ liệu bảng vàng đồng bộ thời gian thực</span>
            </div>
            <button type="button" class="theme-btn-primary close-action-btn" @click="closeModal">
              Đóng
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ==========================================================================
   Full Viewport Centered Overlay (Fixes "Dính ngay trên đỉnh")
   ========================================================================== */
.leaderboard-modal-overlay {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  box-sizing: border-box;
}

/* Modal Card Base */
.leaderboard-card {
  width: 100%;
  max-width: 660px;
  max-height: 90vh;
  margin: auto;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border-radius: 22px;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.45);
  border: 1.5px solid var(--border-color);
  overflow: hidden;
  position: relative;
  animation: modal-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes modal-pop {
  0% {
    transform: scale(0.92) translateY(20px);
    opacity: 0;
  }
  100% {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

.ambient-glow {
  position: absolute;
  top: -120px;
  left: 50%;
  transform: translateX(-50%);
  width: 400px;
  height: 250px;
  pointer-events: none;
  z-index: 0;
}

/* Header */
.modal-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  background: var(--bg-surface-translucent);
  border-bottom: 1px solid var(--border-color);
}

.title-group {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.trophy-orb {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.trophy-svg {
  width: 26px;
  height: 26px;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.modal-subtitle {
  margin: 0.25rem 0 0 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.close-modal-btn {
  background: rgba(148, 163, 184, 0.1);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  cursor: pointer;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.close-modal-btn:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
  transform: rotate(90deg);
}

/* Universe Tabs */
.track-filter-tabs {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: rgba(148, 163, 184, 0.05);
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;
}

.filter-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 700;
  padding: 0.4rem 0.9rem;
  border-radius: var(--radius-pill);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.filter-tab-btn:hover {
  border-color: var(--border-focus);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.filter-active {
  background: var(--accent-gradient) !important;
  color: #ffffff !important;
  border-color: transparent !important;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
}

/* Modal Body */
.modal-body-content {
  position: relative;
  z-index: 1;
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
  min-height: 280px;
}

/* Loading & Error States */
.loading-state,
.error-state {
  text-align: center;
  padding: 3.5rem 1rem;
  color: var(--text-secondary);
  font-size: 0.9375rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3.5px solid rgba(148, 163, 184, 0.25);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1.25rem;
}

.error-icon {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
}

.retry-btn {
  margin-top: 1rem;
  padding: 0.5rem 1.25rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Empty State Card (Pioneer Invitation) */
.empty-state-card {
  text-align: center;
  padding: 2.5rem 1.5rem;
  background: rgba(148, 163, 184, 0.05);
  border-radius: 16px;
  border: 1.5px dashed var(--border-color);
  margin: 0.5rem 0;
}

.empty-trophy-orb {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
}

.empty-state-title {
  margin: 0 0 0.5rem 0;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text-primary);
}

.empty-state-desc {
  margin: 0 auto 1.25rem auto;
  max-width: 440px;
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.empty-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0.65rem 1.5rem;
  font-weight: 800;
  border-radius: 12px;
  cursor: pointer;
}

/* ==========================================================================
   TOP 3 PODIUM (Bục Vinh Quang Olympic / Esports)
   ========================================================================== */
.podium-container {
  display: grid;
  grid-template-columns: 1fr 1.15fr 1fr;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 1.5rem;
  padding: 1.25rem 0.5rem 0 0.5rem;
}

.podium-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-width: 0;
  width: 100%;
}

.podium-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 10px;
  width: 100%;
}

.crown-icon-aura {
  font-size: 1.6rem;
  line-height: 1;
  margin-bottom: 2px;
  animation: crown-float 2s ease-in-out infinite alternate;
}

@keyframes crown-float {
  0% { transform: translateY(0); }
  100% { transform: translateY(-4px); }
}

.podium-avatar-wrapper {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  padding: 3px;
  background: var(--bg-surface);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.rank-1 .podium-avatar-wrapper {
  width: 68px;
  height: 68px;
}

.gold-glow {
  border: 3px solid #f59e0b;
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.45);
}

.silver-glow {
  border: 2.5px solid #94a3b8;
  box-shadow: 0 0 16px rgba(148, 163, 184, 0.35);
}

.bronze-glow {
  border: 2.5px solid #d97706;
  box-shadow: 0 0 16px rgba(217, 119, 6, 0.35);
}

.podium-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.podium-avatar-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
}

.podium-rank-pill {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 900;
  color: #fff;
  letter-spacing: -0.02em;
}

.podium-rank-pill.gold {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.podium-rank-pill.silver {
  background: linear-gradient(135deg, #94a3b8, #64748b);
}

.podium-rank-pill.bronze {
  background: linear-gradient(135deg, #d97706, #92400e);
}

/* FIX: Tăng max-width lên 190px - Không còn bị cắt "Vuong Tuan A..." */
.podium-player-name {
  margin-top: 8px;
  font-size: 0.9375rem;
  font-weight: 800;
  color: var(--text-primary);
  max-width: 190px;
  text-align: center;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gold-text {
  font-size: 0.95rem;
  color: #f59e0b;
}

.podium-title-tag {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 2px;
  max-width: 180px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.podium-score-pill {
  margin-top: 5px;
  font-size: 0.75rem;
  font-weight: 800;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.15);
  color: var(--text-secondary);
}

.gold-pill {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
  font-weight: 900;
}

/* Empty Slot in Podium */
.podium-empty-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 12px;
  opacity: 0.6;
}

.empty-slot-icon {
  font-size: 1.8rem;
  margin-bottom: 4px;
}

.empty-slot-text {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 700;
}

/* Pedestals */
.podium-pedestal {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px 12px 4px 4px;
  font-weight: 900;
  font-size: 1.5rem;
  color: rgba(255, 255, 255, 0.9);
  box-shadow: inset 0 2px 6px rgba(255, 255, 255, 0.3), 0 4px 15px rgba(0, 0, 0, 0.15);
}

.pedestal-gold {
  height: 95px;
  background: linear-gradient(180deg, #f59e0b 0%, #b45309 100%);
}

.pedestal-silver {
  height: 75px;
  background: linear-gradient(180deg, #94a3b8 0%, #475569 100%);
}

.pedestal-bronze {
  height: 60px;
  background: linear-gradient(180deg, #d97706 0%, #78350f 100%);
}

.pedestal-num {
  font-size: 1.5rem;
  font-weight: 900;
  opacity: 0.9;
}

/* Remaining Entries List */
.entries-list-header {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  margin-bottom: 8px;
  padding-left: 4px;
}

.entries-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.leaderboard-row {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.leaderboard-row:hover {
  transform: translateX(4px);
  border-color: var(--border-focus);
}

.leaderboard-row.is-current-user {
  border-color: var(--accent-primary);
  background: rgba(56, 189, 248, 0.08);
}

.rank-column {
  width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.rank-number {
  font-size: 0.875rem;
  font-weight: 800;
  color: var(--text-muted);
}

.player-info-column {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: 0.25rem;
  min-width: 0;
}

.player-avatar-badge {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  flex-shrink: 0;
  overflow: hidden;
}

.row-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.player-text-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.player-name-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.player-display-name {
  font-size: 0.875rem;
  font-weight: 800;
  color: var(--text-primary);
}

.you-badge {
  font-size: 0.625rem;
  font-weight: 800;
  background: var(--accent-primary);
  color: #fff;
  padding: 1px 6px;
  border-radius: 999px;
}

.player-title-badge {
  font-size: 0.65rem;
  font-weight: 700;
  background: rgba(148, 163, 184, 0.15);
  color: var(--text-secondary);
  padding: 1px 6px;
  border-radius: 6px;
}

.player-meta-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.15rem;
}

.track-tag-pill {
  font-size: 0.6875rem;
  color: var(--text-muted);
  font-weight: 600;
}

.level-indicator {
  font-size: 0.6875rem;
  font-weight: 800;
  color: #10b981;
}

.score-column {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: 0.75rem;
  flex-shrink: 0;
}

.score-val {
  font-size: 1rem;
  font-weight: 900;
  color: var(--text-primary);
  line-height: 1.2;
}

.score-label {
  font-size: 0.625rem;
  font-weight: 700;
  color: var(--text-muted);
}

/* ==========================================================================
   USER STANDING CARD (Pinned Bottom Card)
   ========================================================================== */
.user-standing-card {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.25rem;
  background: var(--bg-surface);
  border-top: 2px solid var(--border-color);
  box-shadow: 0 -4px 18px rgba(0, 0, 0, 0.08);
}

.user-standing-left {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}

.standing-rank-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  padding: 4px 6px;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.15);
  border: 1px solid var(--border-color);
}

.standing-rank-label {
  font-size: 0.55rem;
  font-weight: 800;
  color: var(--text-muted);
  line-height: 1;
}

.standing-rank-val {
  font-size: 0.95rem;
  font-weight: 900;
  color: var(--text-primary);
  line-height: 1.2;
}

.top-three-rank {
  background: rgba(245, 158, 11, 0.2);
  border-color: #f59e0b;
}

.top-three-rank .standing-rank-val {
  color: #f59e0b;
}

.standing-avatar-box {
  position: relative;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 2px solid var(--accent-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--bg-primary);
}

.standing-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.standing-avatar-fallback {
  font-size: 1.3rem;
}

.standing-level-dot {
  position: absolute;
  bottom: -4px;
  right: -4px;
  background: #10b981;
  color: #fff;
  font-size: 0.55rem;
  font-weight: 900;
  padding: 1px 4px;
  border-radius: 999px;
  border: 1px solid #fff;
}

.standing-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.standing-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.standing-name {
  font-size: 0.875rem;
  font-weight: 800;
  color: var(--text-primary);
}

.standing-title-pill {
  font-size: 0.65rem;
  font-weight: 700;
  background: rgba(148, 163, 184, 0.15);
  color: var(--text-secondary);
  padding: 1px 6px;
  border-radius: 6px;
}

.standing-hint {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-standing-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: 0.75rem;
  flex-shrink: 0;
}

.standing-exp-num {
  font-size: 1.15rem;
  font-weight: 900;
  color: #f59e0b;
  line-height: 1.1;
}

.standing-exp-label {
  font-size: 0.6rem;
  font-weight: 800;
  color: var(--text-muted);
}

/* Footer */
.modal-footer {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.5rem;
  background: var(--bg-surface-translucent);
  border-top: 1px solid var(--border-color);
  gap: 1rem;
}

.footer-note {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.cdn-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.close-action-btn {
  padding: 0.45rem 1.25rem;
  font-size: 0.85rem;
  font-weight: 700;
  border-radius: 10px;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* ==========================================================================
   THEME 1: ĐẢO THẦN THOẠI (KIDS MODE) - Warm Golden Amber Glory
   ========================================================================== */
.modal-theme-kids {
  background-color: #ffffff !important;
  border: 3px solid #f59e0b !important;
  box-shadow: 0 25px 60px rgba(217, 119, 6, 0.3) !important;
}

.modal-theme-kids .ambient-glow {
  background: radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, transparent 70%);
}

.modal-theme-kids .modal-header {
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%) !important;
  border-bottom: 2px solid #fde68a !important;
}

/* FIX: Chữ tiêu đề màu nâu hổ phách đậm siêu nét trên nền vàng (Không bị trắng mờ) */
.modal-theme-kids .modal-title {
  color: #78350f !important;
  font-weight: 900 !important;
  font-size: 1.3rem !important;
}

.modal-theme-kids .modal-subtitle {
  color: #92400e !important;
  font-weight: 600 !important;
}

.modal-theme-kids .trophy-orb {
  background: #fef3c7;
  border: 1.5px solid #f59e0b;
  color: #d97706;
  box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
}

.modal-theme-kids .close-modal-btn {
  background: #fef3c7;
  border: 1px solid #fde68a;
  color: #78350f;
}

.modal-theme-kids .close-modal-btn:hover {
  background: #fee2e2;
  color: #ef4444;
}

.modal-theme-kids .track-filter-tabs {
  background: #fffbeb;
  border-bottom: 2px solid #fde68a;
}

.modal-theme-kids .filter-tab-btn {
  background: #ffffff;
  border: 1.5px solid #fde68a;
  color: #78350f;
}

.modal-theme-kids .filter-active {
  background: linear-gradient(135deg, #f59e0b, #fbbf24) !important;
  color: #ffffff !important;
  border-color: #d97706 !important;
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35) !important;
}

.modal-theme-kids .modal-body-content {
  background: #fffdf5;
}

.modal-theme-kids .leaderboard-row {
  background: #ffffff;
  border: 1.5px solid #fde68a;
}

.modal-theme-kids .player-display-name {
  color: #3b1d07;
}

.modal-theme-kids .score-val {
  color: #b45309;
}

.modal-theme-kids .user-standing-card {
  background: #fffdf5;
  border-top: 2px solid #fde68a;
}

.modal-theme-kids .standing-rank-badge {
  background: #fef3c7;
  border-color: #fde68a;
}

.modal-theme-kids .standing-name {
  color: #3b1d07;
}

.modal-theme-kids .modal-footer {
  background: #fffbeb;
  border-top: 2px solid #fde68a;
}

.modal-theme-kids .close-action-btn {
  background: linear-gradient(135deg, #f59e0b, #d97706) !important;
  color: #ffffff !important;
  border: none !important;
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4) !important;
}

/* ==========================================================================
   THEME 2: CYBER CITY (TEENS MODE) - Neon Cyber Hologram Dark Arena
   ========================================================================== */
.modal-theme-teens {
  background-color: #0b0f19 !important;
  border: 1.5px solid rgba(6, 182, 212, 0.45) !important;
  box-shadow: 0 0 40px rgba(6, 182, 212, 0.25), 0 25px 60px rgba(0, 0, 0, 0.7) !important;
}

.modal-theme-teens .ambient-glow {
  background: radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, rgba(168, 85, 247, 0.1) 40%, transparent 70%);
}

.modal-theme-teens .modal-header {
  background: linear-gradient(135deg, rgba(16, 23, 38, 0.98), rgba(30, 27, 75, 0.9)) !important;
  border-bottom: 1.5px solid rgba(6, 182, 212, 0.3) !important;
}

.modal-theme-teens .trophy-orb {
  background: rgba(6, 182, 212, 0.15);
  border: 1px solid #06b6d4;
  color: #06b6d4;
  box-shadow: 0 0 16px rgba(6, 182, 212, 0.5);
}

.modal-theme-teens .modal-title {
  background: linear-gradient(135deg, #38bdf8, #c084fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: 900 !important;
  font-size: 1.3rem !important;
}

.modal-theme-teens .modal-subtitle {
  color: #94a3b8;
}

.modal-theme-teens .close-modal-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #94a3b8;
}

.modal-theme-teens .close-modal-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.4);
}

.modal-theme-teens .track-filter-tabs {
  background: rgba(16, 23, 38, 0.7);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-theme-teens .filter-tab-btn {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
}

.modal-theme-teens .filter-active {
  background: linear-gradient(135deg, #06b6d4, #a855f7) !important;
  color: #ffffff !important;
  border-color: transparent !important;
  box-shadow: 0 0 18px rgba(6, 182, 212, 0.45) !important;
}

.modal-theme-teens .modal-body-content {
  background: #0b0f19;
}

.modal-theme-teens .leaderboard-row {
  background: rgba(16, 23, 38, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-theme-teens .leaderboard-row:hover {
  border-color: #06b6d4;
  box-shadow: 0 0 15px rgba(6, 182, 212, 0.25);
}

.modal-theme-teens .score-val {
  color: #38bdf8;
}

.modal-theme-teens .user-standing-card {
  background: #0d1527;
  border-top: 1.5px solid rgba(6, 182, 212, 0.3);
}

.modal-theme-teens .standing-name {
  color: #f8fafc;
}

.modal-theme-teens .modal-footer {
  background: #0d1527;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-theme-teens .close-action-btn {
  background: linear-gradient(135deg, #06b6d4, #0891b2) !important;
  color: #ffffff !important;
  border: none !important;
  box-shadow: 0 4px 15px rgba(6, 182, 212, 0.4) !important;
}

/* ==========================================================================
   THEME 3: SIMLIFE GLOBAL (ADULTS MODE) - Executive Pearl Luxury (Forbes Hall of Fame)
   Fix: Đồng bộ 100% màu sắc thanh lịch, bỏ header đen lệch tông, bục kim loại sang trọng
   ========================================================================== */
.modal-theme-adults {
  background-color: #ffffff !important;
  border: 1.5px solid #cbd5e1 !important;
  box-shadow: 0 25px 60px rgba(15, 23, 42, 0.18) !important;
}

.modal-theme-adults .ambient-glow {
  background: radial-gradient(circle, rgba(5, 150, 105, 0.12) 0%, transparent 70%);
}

/* FIX: Header đồng bộ tone màu ngọc trai sang trọng, KHÔNG bị đen kịt chắp vá */
.modal-theme-adults .modal-header {
  background: linear-gradient(135deg, #f8fafc 0%, #eef2f6 100%) !important;
  border-bottom: 1.5px solid #cbd5e1 !important;
}

.modal-theme-adults .modal-title {
  color: #0f172a !important;
  font-weight: 900 !important;
  font-size: 1.3rem !important;
  letter-spacing: -0.01em;
}

.modal-theme-adults .modal-subtitle {
  color: #475569 !important;
  font-weight: 600 !important;
}

.modal-theme-adults .trophy-orb {
  background: rgba(5, 150, 105, 0.12);
  border: 1.5px solid #059669;
  color: #059669;
  box-shadow: 0 4px 15px rgba(5, 150, 105, 0.25);
}

.modal-theme-adults .close-modal-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
}

.modal-theme-adults .close-modal-btn:hover {
  background: #fee2e2;
  color: #ef4444;
  border-color: #fca5a5;
}

.modal-theme-adults .track-filter-tabs {
  background: #f8fafc;
  border-bottom: 1.5px solid #cbd5e1;
}

.modal-theme-adults .filter-tab-btn {
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  color: #475569;
  font-weight: 700;
}

.modal-theme-adults .filter-tab-btn:hover {
  border-color: #059669;
  color: #0f172a;
}

/* Tab active màu Emerald ngọc lục bảo danh giá của SimLife Global */
.modal-theme-adults .filter-active {
  background: #059669 !important;
  color: #ffffff !important;
  border-color: #047857 !important;
  box-shadow: 0 4px 14px rgba(5, 150, 105, 0.3) !important;
}

.modal-theme-adults .modal-body-content {
  background: #ffffff;
}

/* FIX: Bục vinh quang phong cách Kim loại Titan & Vàng Hoàng Gia cho người lớn */
.modal-theme-adults .pedestal-gold {
  background: linear-gradient(180deg, #d97706 0%, #92400e 100%) !important;
}

.modal-theme-adults .pedestal-silver {
  background: linear-gradient(180deg, #64748b 0%, #334155 100%) !important;
}

.modal-theme-adults .pedestal-bronze {
  background: linear-gradient(180deg, #b45309 0%, #78350f 100%) !important;
}

.modal-theme-adults .gold-text {
  color: #d97706 !important;
}

.modal-theme-adults .gold-pill {
  background: rgba(217, 119, 6, 0.15) !important;
  color: #b45309 !important;
}

.modal-theme-adults .podium-score-pill {
  background: rgba(5, 150, 105, 0.12) !important;
  color: #059669 !important;
  font-weight: 800;
}

.modal-theme-adults .leaderboard-row {
  background: #ffffff;
  border: 1.5px solid #e2e8f0;
}

.modal-theme-adults .leaderboard-row:hover {
  border-color: #059669;
  box-shadow: 0 4px 14px rgba(5, 150, 105, 0.1);
}

.modal-theme-adults .player-display-name {
  color: #0f172a;
}

.modal-theme-adults .score-val {
  color: #059669;
}

.modal-theme-adults .user-standing-card {
  background: #f8fafc;
  border-top: 2px solid #cbd5e1;
}

.modal-theme-adults .standing-rank-badge {
  background: #ffffff;
  border-color: #cbd5e1;
}

.modal-theme-adults .standing-rank-val {
  color: #0f172a;
}

.modal-theme-adults .top-three-rank .standing-rank-val {
  color: #d97706;
}

.modal-theme-adults .standing-avatar-box {
  border-color: #059669;
  background: #ffffff;
}

.modal-theme-adults .standing-name {
  color: #0f172a;
}

.modal-theme-adults .standing-exp-num {
  color: #059669;
}

.modal-theme-adults .modal-footer {
  background: #f8fafc;
  border-top: 1.5px solid #cbd5e1;
}

.modal-theme-adults .close-action-btn {
  background: #059669 !important;
  color: #ffffff !important;
  border: none !important;
  box-shadow: 0 4px 14px rgba(5, 150, 105, 0.35) !important;
}

.modal-theme-adults .close-action-btn:hover {
  background: #047857 !important;
}
</style>
