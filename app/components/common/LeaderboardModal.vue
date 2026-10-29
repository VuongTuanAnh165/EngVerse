<script setup lang="ts">
/**
 * EngVerse - LeaderboardModal Component
 * Displays global Top 30 leaderboard loaded from Edge CDN cached API (/api/leaderboard).
 * Features:
 * - 60FPS modal animations with backdrop blur
 * - Gold, Silver, Bronze badges for Top 3 champions
 * - Universe track filter tabs (Tất cả, Đảo Thần Thoại, Cyber City, SimLife Global)
 * - Zero Firebase read load thanks to 1-hour Edge CDN caching
 *
 * Strict TypeScript (0 any), Vue 3.5+.
 * Reference: docs/ke_hoach.md - Sprint 5, Task 2 & Rules.md
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

const filteredEntries = computed<LeaderboardEntry[]>(() => {
  if (selectedFilter.value === 'all') {
    return entries.value;
  }
  return entries.value.filter((e) => e.worldTrack === selectedFilter.value);
});

async function loadLeaderboard(): Promise<void> {
  isLoading.value = true;
  fetchError.value = null;

  try {
    const res = await $fetch<LeaderboardResponse>('/api/leaderboard');
    entries.value = res.entries || [];
  } catch (err: unknown) {
    console.error('[LeaderboardModal] Fetch error:', err);
    fetchError.value = 'Không thể tải Bảng Xếp Hạng lúc này. Vui lòng thử lại sau.';
  } finally {
    isLoading.value = false;
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      playSound('click');
      void loadLeaderboard();
    }
  }
);

function closeModal(): void {
  playSound('click');
  emit('update:open', false);
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
</script>

<template>
  <Transition name="modal-fade">
    <div
      v-if="open"
      class="leaderboard-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-title"
      @click.self="closeModal"
    >
      <div class="leaderboard-card theme-card">
        <!-- Header -->
        <div class="modal-header">
          <div class="title-group">
            <span class="header-trophy" aria-hidden="true">🏆</span>
            <div>
              <h2 id="leaderboard-title" class="modal-title">Bảng Xếp Hạng Toàn Cầu</h2>
              <p class="modal-subtitle">Top 30 Nhà Thám Hiểm xuất sắc nhất trên Edge CDN</p>
            </div>
          </div>

          <button
            type="button"
            class="close-modal-btn"
            aria-label="Đóng bảng xếp hạng"
            @click="closeModal"
          >
            ✕
          </button>
        </div>

        <!-- Filter Tabs -->
        <div class="track-filter-tabs">
          <button
            type="button"
            class="filter-tab-btn"
            :class="{ 'filter-active': selectedFilter === 'all' }"
            @click="selectedFilter = 'all'"
          >
            Tất cả
          </button>
          <button
            type="button"
            class="filter-tab-btn"
            :class="{ 'filter-active': selectedFilter === 'kids' }"
            @click="selectedFilter = 'kids'"
          >
            🏝️ Đảo Thần Thoại
          </button>
          <button
            type="button"
            class="filter-tab-btn"
            :class="{ 'filter-active': selectedFilter === 'teens' }"
            @click="selectedFilter = 'teens'"
          >
            ⚡ Cyber City
          </button>
          <button
            type="button"
            class="filter-tab-btn"
            :class="{ 'filter-active': selectedFilter === 'adults' }"
            @click="selectedFilter = 'adults'"
          >
            🌐 SimLife Global
          </button>
        </div>

        <!-- Content Area -->
        <div class="modal-body-content">
          <!-- Loading State -->
          <div v-if="isLoading" class="loading-state">
            <div class="loading-spinner" />
            <p>Đang đồng bộ dữ liệu Bảng Xếp Hạng từ Edge CDN...</p>
          </div>

          <!-- Error State -->
          <div v-else-if="fetchError" class="error-state">
            <p>{{ fetchError }}</p>
            <button type="button" class="theme-btn-primary retry-btn" @click="loadLeaderboard">
              Thử lại
            </button>
          </div>

          <!-- Empty State -->
          <div v-else-if="filteredEntries.length === 0" class="empty-state">
            <p>Chưa có dữ liệu người chơi trong vũ trụ này.</p>
          </div>

          <!-- Leaderboard List -->
          <div v-else class="entries-list">
            <div
              v-for="player in filteredEntries"
              :key="player.uid"
              class="leaderboard-row"
              :class="{
                'top-first': player.rank === 1,
                'top-second': player.rank === 2,
                'top-third': player.rank === 3,
                'is-current-user': player.uid === userStore.user.uid
              }"
            >
              <!-- Rank Badge -->
              <div class="rank-column">
                <span v-if="player.rank === 1" class="rank-medal gold-medal" title="Top 1">🥇</span>
                <span v-else-if="player.rank === 2" class="rank-medal silver-medal" title="Top 2">🥈</span>
                <span v-else-if="player.rank === 3" class="rank-medal bronze-medal" title="Top 3">🥉</span>
                <span v-else class="rank-number">#{{ player.rank }}</span>
              </div>

              <!-- Avatar & Player Info -->
              <div class="player-info-column">
                <div class="player-avatar-badge" aria-hidden="true">
                  {{ player.rank === 1 ? '👑' : player.rank === 2 ? '⚡' : player.rank === 3 ? '🌟' : '🧑‍🚀' }}
                </div>
                <div class="player-text-details">
                  <div class="player-name-row">
                    <span class="player-display-name">{{ player.displayName }}</span>
                    <span class="player-title-badge">{{ player.equippedTitle }}</span>
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

        <!-- Footer -->
        <div class="modal-footer">
          <div class="footer-note">
            <span class="cdn-dot" />
            <span>Được lưu đệm 1 giờ trên Vercel Edge CDN (Tiết kiệm 100% quota)</span>
          </div>
          <button type="button" class="theme-btn-primary close-action-btn" @click="closeModal">
            Đóng
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.leaderboard-modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(6px);
  z-index: 2100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
}

.leaderboard-card {
  width: 100%;
  max-width: 620px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
  overflow: hidden;
  animation: modal-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes modal-pop {
  0% { transform: scale(0.92) translateY(16px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}

/* Header */
.modal-header {
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
  gap: 0.875rem;
}

.header-trophy {
  font-size: 2.25rem;
  line-height: 1;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--text-primary);
}

.modal-subtitle {
  margin: 0.2rem 0 0 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.close-modal-btn {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}

.close-modal-btn:hover {
  background: rgba(148, 163, 184, 0.15);
  color: var(--text-primary);
}

/* Tabs */
.track-filter-tabs {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: rgba(148, 163, 184, 0.06);
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;
}

.filter-tab-btn {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 700;
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-pill);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.filter-tab-btn:hover {
  border-color: var(--border-focus);
  color: var(--text-primary);
}

.filter-active {
  background: var(--accent-gradient) !important;
  color: var(--accent-text) !important;
  border-color: transparent !important;
  box-shadow: var(--shadow-sm);
}

/* Body */
.modal-body-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;
  min-height: 320px;
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 4rem 1rem;
  color: var(--text-secondary);
  font-size: 0.9375rem;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(148, 163, 184, 0.3);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Entries List */
.entries-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.leaderboard-row {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.leaderboard-row:hover {
  transform: translateX(3px);
  border-color: var(--border-focus);
}

.top-first {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, var(--bg-surface) 100%);
  border: 2px solid #f59e0b;
}

.top-second {
  background: linear-gradient(135deg, rgba(148, 163, 184, 0.12) 0%, var(--bg-surface) 100%);
  border: 2px solid #94a3b8;
}

.top-third {
  background: linear-gradient(135deg, rgba(180, 83, 9, 0.12) 0%, var(--bg-surface) 100%);
  border: 2px solid #b45309;
}

.is-current-user {
  box-shadow: 0 0 0 2px var(--accent-primary);
}

.rank-column {
  width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.rank-medal {
  font-size: 1.75rem;
  line-height: 1;
}

.rank-number {
  font-size: 0.9375rem;
  font-weight: 800;
  color: var(--text-muted);
}

.player-info-column {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: 0.5rem;
}

.player-avatar-badge {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.player-text-details {
  display: flex;
  flex-direction: column;
}

.player-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.player-display-name {
  font-size: 0.9375rem;
  font-weight: 800;
  color: var(--text-primary);
}

.player-title-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  background: rgba(148, 163, 184, 0.15);
  color: var(--text-secondary);
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius-sm);
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
  font-size: 1.125rem;
  font-weight: 900;
  color: var(--text-primary);
  line-height: 1.2;
}

.score-label {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--text-muted);
}

/* Footer */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: var(--bg-surface-translucent);
  border-top: 1px solid var(--border-color);
  gap: 1rem;
  flex-wrap: wrap;
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
  padding: 0.5rem 1.25rem;
  font-size: 0.875rem;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>

