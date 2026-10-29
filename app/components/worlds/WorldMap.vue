<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useUserStore } from '~/stores/user';
import type { StageData } from '~/types/game';

const userStore = useUserStore();
const currentTrack = computed(() => userStore.currentTrack);

const stages = ref<StageData[]>([]);
const isLoading = ref<boolean>(true);
const fetchError = ref<string | null>(null);
const selectedStage = ref<StageData | null>(null);

async function loadStages(): Promise<void> {
  isLoading.value = true;
  fetchError.value = null;

  try {
    const data = await $fetch<StageData[]>(`/data/${currentTrack.value}/stages.json`);
    stages.value = data || [];
  } catch (err: unknown) {
    console.error('[WorldMap] Failed to load stages:', err);
    fetchError.value = 'Không thể tải dữ liệu bản đồ. Vui lòng thử lại sau.';
  } finally {
    isLoading.value = false;
  }
}

// Watch track changes and reload stage list instantly
watch(currentTrack, () => {
  selectedStage.value = null;
  void loadStages();
});

onMounted(() => {
  void loadStages();
});

// Stage status helpers
function getStageStars(stageId: number): number {
  const trackStars = userStore.currentTrackProgress?.stageStars || {};
  return trackStars[String(stageId)] || 0;
}

function isStageCompleted(stageId: number): boolean {
  return getStageStars(stageId) > 0;
}

function isStageUnlocked(stageId: number): boolean {
  const unlocked = userStore.currentTrackProgress?.unlockedStage ?? 1;
  return stageId <= unlocked;
}

function isCurrentActiveStage(stageId: number): boolean {
  const unlocked = userStore.currentTrackProgress?.unlockedStage ?? 1;
  return stageId === unlocked && !isStageCompleted(stageId);
}

function handleStageClick(stage: StageData): void {
  if (isStageUnlocked(stage.stageId)) {
    selectedStage.value = stage;
  }
}

function closeModal(): void {
  selectedStage.value = null;
}

function getTrackTitle(track: string): string {
  switch (track) {
    case 'kids':
      return 'Đảo Thần Thoại - Hành Trình Ấp Trứng Rồng';
    case 'teens':
      return 'Cyber City - Vụ Án Thám Tử Học Viện Neo-High';
    case 'adults':
      return 'SimLife Global - Chinh Phục Sự Nghiệp Quốc Tế';
    default:
      return 'Bản Đồ Thử Thách Đa Vũ Trụ';
  }
}
</script>

<template>
  <div class="world-map-wrapper">
    <!-- Map Header -->
    <div class="map-header">
      <div class="map-title-box">
        <h2 class="map-title">{{ getTrackTitle(currentTrack) }}</h2>
        <p class="map-subtitle">
          Chương 1: Vượt qua các chặng thử thách để mở khóa Boss ôn tập và nhận Thẻ Bài độc quyền!
        </p>
      </div>

      <NuxtLink to="/codex" class="codex-shortcut-btn">
        <span class="shortcut-icon" aria-hidden="true">📖</span>
        <span>Sổ Tay Thẻ Bài 3D</span>
      </NuxtLink>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="map-loading-state">
      <div class="loading-spinner" />
      <p>Đang đồng bộ bản đồ thế giới...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="fetchError" class="map-error-state">
      <p>{{ fetchError }}</p>
      <button type="button" class="retry-btn" @click="loadStages">Thử lại</button>
    </div>

    <!-- Interactive Stage Path -->
    <div v-else class="stage-roadmap">
      <div
        v-for="(stage, idx) in stages"
        :key="stage.stageId"
        class="stage-node-container"
        :class="{
          'node-left': idx % 2 === 0,
          'node-right': idx % 2 !== 0,
          'boss-node': stage.isBossStage,
          'unlocked': isStageUnlocked(stage.stageId),
          'locked': !isStageUnlocked(stage.stageId),
          'current': isCurrentActiveStage(stage.stageId)
        }"
      >
        <!-- Node Card Button -->
        <button
          type="button"
          class="stage-node-btn"
          :disabled="!isStageUnlocked(stage.stageId)"
          @click="handleStageClick(stage)"
        >
          <!-- Boss / Stage Number Emblem -->
          <div class="stage-emblem">
            <span v-if="stage.isBossStage" class="boss-icon" aria-hidden="true">👑</span>
            <span v-else-if="isStageCompleted(stage.stageId)" class="check-icon" aria-hidden="true">✓</span>
            <span v-else-if="!isStageUnlocked(stage.stageId)" class="lock-icon" aria-hidden="true">🔒</span>
            <span v-else class="stage-num">{{ stage.stageId }}</span>
          </div>

          <!-- Stage Info -->
          <div class="stage-info">
            <div class="stage-meta">
              <span v-if="stage.cefrLevel" class="cefr-badge">{{ stage.cefrLevel }}</span>
              <span v-if="stage.isBossStage" class="boss-badge">BOSS CHƯƠNG</span>
              <span class="stage-ch-text">Chặng {{ stage.stageId }}</span>
            </div>

            <h3 class="stage-name">{{ stage.title }}</h3>
            <p v-if="stage.subtitle" class="stage-desc">{{ stage.subtitle }}</p>

            <!-- Stars display -->
            <div class="stars-row">
              <span
                v-for="starIndex in 3"
                :key="starIndex"
                class="star-icon"
                :class="{ 'star-filled': starIndex <= getStageStars(stage.stageId) }"
              >
                ★
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- Stage Detail / Start Modal -->
    <Transition name="modal-fade">
      <div
        v-if="selectedStage"
        class="stage-modal-overlay"
        role="dialog"
        aria-modal="true"
        @click.self="closeModal"
      >
        <div class="stage-modal-card theme-card">
          <div class="modal-header">
            <div class="modal-tag">
              <span class="modal-cefr">{{ selectedStage.cefrLevel }}</span>
              <span>Chặng {{ selectedStage.stageId }}</span>
            </div>
            <button
              type="button"
              class="modal-close-btn"
              aria-label="Đóng bảng thông tin"
              @click="closeModal"
            >
              ✕
            </button>
          </div>

          <h2 class="modal-title">{{ selectedStage.title }}</h2>
          <p class="modal-story">{{ selectedStage.storyIntro }}</p>

          <!-- Rewards Preview -->
          <div class="modal-rewards">
            <div class="reward-item">
              <span class="reward-icon" aria-hidden="true">⚡</span>
              <div class="reward-details">
                <span class="reward-val">+{{ selectedStage.reward.baseExp }} EXP</span>
                <span class="reward-label">Kinh nghiệm</span>
              </div>
            </div>

            <div class="reward-item">
              <span class="reward-icon" aria-hidden="true">🪙</span>
              <div class="reward-details">
                <span class="reward-val">+{{ selectedStage.reward.baseGold }} Vàng</span>
                <span class="reward-label">Tiền thưởng</span>
              </div>
            </div>

            <div v-if="selectedStage.reward.guaranteedCardId" class="reward-item">
              <span class="reward-icon" aria-hidden="true">🃏</span>
              <div class="reward-details">
                <span class="reward-val">Thẻ Bài 3D</span>
                <span class="reward-label">Mở khóa Codex</span>
              </div>
            </div>
          </div>

          <!-- Vocab Preview -->
          <div class="vocab-preview">
            <span class="vocab-preview-title">Từ vựng & Thử thách:</span>
            <div class="vocab-chips">
              <span
                v-for="v in selectedStage.vocabPool.slice(0, 4)"
                :key="v.id"
                class="vocab-chip"
              >
                {{ v.emoji || '✨' }} {{ v.word }}
              </span>
            </div>
          </div>

          <!-- Play Action -->
          <div class="modal-actions">
            <NuxtLink
              :to="`/play/${selectedStage.stageId}`"
              class="theme-btn-primary start-btn"
            >
              Bắt Đầu Chinh Phục (Tốn 1⚡)
            </NuxtLink>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.world-map-wrapper {
  max-width: 860px;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}

.map-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 2.5rem;
  flex-wrap: wrap;
}

.map-title {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.3;
}

.map-subtitle {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}

.codex-shortcut-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-weight: 700;
  font-size: 0.875rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-pill);
  text-decoration: none;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
  user-select: none;
}

.codex-shortcut-btn:hover {
  transform: translateY(-2px);
  border-color: var(--border-focus);
  box-shadow: var(--shadow-md);
}

.map-loading-state,
.map-error-state {
  text-align: center;
  padding: 4rem 1rem;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(148, 163, 184, 0.3);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Roadmap Grid */
.stage-roadmap {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  position: relative;
}

.stage-node-container {
  display: flex;
  width: 100%;
}

.node-left {
  justify-content: flex-start;
}

.node-right {
  justify-content: flex-end;
}

.stage-node-btn {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  width: 100%;
  max-width: 460px;
  background-color: var(--bg-surface);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.25rem 1.5rem;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  text-align: left;
  font-family: inherit;
}

.stage-node-btn:hover:not(:disabled) {
  transform: translateY(-3px);
  border-color: var(--border-focus);
  box-shadow: var(--shadow-md);
}

.stage-node-container.current .stage-node-btn {
  border-color: var(--accent-primary);
  box-shadow: var(--glow-accent);
  animation: current-pulse 2.2s infinite ease-in-out;
}

.stage-node-container.boss-node .stage-node-btn {
  border: 2px solid #ef4444;
  background: linear-gradient(135deg, var(--bg-surface) 0%, rgba(239, 68, 68, 0.08) 100%);
}

.stage-node-container.locked .stage-node-btn {
  opacity: 0.6;
  cursor: not-allowed;
  filter: grayscale(0.6);
}

.stage-emblem {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md);
  background: var(--accent-gradient);
  color: var(--accent-text);
  font-weight: 900;
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--btn-3d-shadow);
}

.boss-icon {
  font-size: 1.5rem;
}

.stage-info {
  flex: 1;
}

.stage-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.cefr-badge {
  font-size: 0.6875rem;
  font-weight: 800;
  background: rgba(148, 163, 184, 0.2);
  color: var(--text-muted);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.boss-badge {
  font-size: 0.6875rem;
  font-weight: 800;
  background: #ef4444;
  color: #ffffff;
  padding: 0.1rem 0.45rem;
  border-radius: 4px;
  letter-spacing: 0.04em;
}

.stage-ch-text {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
}

.stage-name {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--text-primary);
  font-family: inherit;
}

.stage-desc {
  margin: 0.25rem 0 0.5rem 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.stars-row {
  display: flex;
  gap: 0.25rem;
}

.star-icon {
  color: rgba(148, 163, 184, 0.3);
  font-size: 1rem;
}

.star-filled {
  color: #f59e0b !important;
  filter: drop-shadow(0 0 3px rgba(245, 158, 11, 0.6));
}

/* Modal Styles */
.stage-modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
}

.stage-modal-card {
  width: 100%;
  max-width: 520px;
  padding: 2rem;
  position: relative;
  background-color: var(--bg-surface);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.modal-tag {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-muted);
}

.modal-cefr {
  background: var(--accent-gradient);
  color: var(--accent-text);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
}

.modal-close-btn {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
}

.modal-title {
  margin: 0 0 0.75rem 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-primary);
}

.modal-story {
  margin: 0 0 1.25rem 0;
  font-size: 0.9375rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.modal-rewards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.reward-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  padding: 0.625rem;
  border-radius: var(--radius-md);
}

.reward-icon {
  font-size: 1.5rem;
}

.reward-details {
  display: flex;
  flex-direction: column;
}

.reward-val {
  font-size: 0.875rem;
  font-weight: 800;
  color: var(--text-primary);
}

.reward-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.vocab-preview {
  margin-bottom: 1.5rem;
}

.vocab-preview-title {
  display: block;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.vocab-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.vocab-chip {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-pill);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
}

.start-btn {
  width: 100%;
  font-size: 1rem;
  padding: 0.875rem;
  text-decoration: none;
}

@keyframes current-pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
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

