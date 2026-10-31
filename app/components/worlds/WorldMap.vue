<script setup lang="ts">
import { ref, computed, watch, onMounted, defineAsyncComponent } from 'vue';
import { useUserStore } from '~/stores/user';
import type { StageData } from '~/types/game';

// ---------------------------------------------------------------------------
// Lazy-loaded 3 Universe Thematic Interfaces (Sprint 5 - Mục 3 Lighthouse 98+)
// ---------------------------------------------------------------------------
const WorldKidsView = defineAsyncComponent(() => import('~/components/worlds/WorldKidsView.vue'));
const WorldTeensView = defineAsyncComponent(() => import('~/components/worlds/WorldTeensView.vue'));
const WorldAdultsView = defineAsyncComponent(() => import('~/components/worlds/WorldAdultsView.vue'));

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


const totalStagesCount = computed(() => stages.value.length || 0);
const totalBossesCount = computed(() => stages.value.filter((s) => s.isBossStage).length || 0);
const totalChaptersCount = computed(() => {
  if (stages.value.length === 0) return 1;
  return new Set(stages.value.map((s) => s.chapter || 1)).size;
});

function getChapterInfo(track: string, chapter: number): { title: string; subtitle: string; bossName: string } {
  const chapterStages = stages.value.filter((s) => s.chapter === chapter);
  const chapterBoss = chapterStages.find((s) => s.isBossStage);
  const startStageId = chapterStages[0]?.stageId || 1;
  const endStageId = chapterStages[chapterStages.length - 1]?.stageId || startStageId;
  const bossName = chapterBoss?.title?.replace(/^BOSS:\s*/i, '') || `Trùm Cuối Chương ${chapter}`;

  return {
    title: `CHƯƠNG ${chapter} (Chặng ${startStageId} - ${endStageId})`,
    subtitle: `${chapterStages.length} chặng thử thách tiếng Anh theo cốt truyện`,
    bossName,
  };
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
          {{ totalChaptersCount }} Chương Thử Thách ({{ totalStagesCount }} Chặng): Vượt qua các chặng để mở khóa {{ totalBossesCount }} Boss ôn tập và nhận Thẻ Bài độc quyền!
        </p>
      </div>

      <NuxtLink to="/codex" class="codex-shortcut-btn" title="Mở bộ sưu tập Thẻ Bài 3D">
        <span class="shortcut-icon" aria-hidden="true">📖</span>
        <span>Sổ Tay Thẻ Bài 3D</span>
      </NuxtLink>
    </div>

    <!-- Thematic Universe Hub Banner (Lazy-loaded per Track) -->
    <ClientOnly>
      <WorldKidsView v-if="currentTrack === 'kids'" :stages="stages" />
      <WorldTeensView v-else-if="currentTrack === 'teens'" :stages="stages" />
      <WorldAdultsView v-else-if="currentTrack === 'adults'" :stages="stages" />
    </ClientOnly>

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
          class="stage-node-btn theme-card"
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
              <span v-else-if="isCurrentActiveStage(stage.stageId)" class="current-badge">CHẶNG HIỆN TẠI</span>
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
              <span class="reward-icon" aria-hidden="true">💰</span>
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
  max-width: 880px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}

.map-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.map-title-box {
  flex: 1;
  min-width: 260px;
}

.map-title {
  margin: 0 0 0.4rem 0;
  font-size: 1.5rem;
  font-weight: 900;
  color: var(--text-primary);
  line-height: 1.3;
}

.map-subtitle {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.codex-shortcut-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background-color: var(--bg-surface);
  border: 1.5px solid var(--border-color);
  color: var(--text-primary);
  font-weight: 700;
  font-size: 0.85rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-pill);
  text-decoration: none;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
  user-select: none;
  white-space: nowrap;
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

.retry-btn {
  margin-top: 1rem;
  padding: 0.5rem 1.25rem;
  border-radius: var(--radius-pill);
  background: var(--accent-primary);
  color: var(--accent-text);
  border: none;
  font-weight: 700;
  cursor: pointer;
}


/* Chapter Milestone Banner */
.chapter-milestone-banner {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1rem 1.5rem;
  background: var(--bg-surface);
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-lg);
  margin: 1.5rem 0 0.5rem 0;
  box-shadow: var(--shadow-sm);
  width: 100%;
}

.chapter-milestone-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--accent-gradient);
  color: var(--accent-text);
  font-size: 0.75rem;
  font-weight: 900;
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-pill);
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.chapter-milestone-info {
  flex: 1;
}

.chapter-milestone-title {
  margin: 0 0 0.2rem 0;
  font-size: 1.05rem;
  font-weight: 900;
  color: var(--text-primary);
}

.chapter-milestone-desc {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.chapter-boss-highlight {
  color: #ef4444;
  font-weight: 700;
}

/* Roadmap Grid */
.stage-roadmap {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  position: relative;
  padding: 1rem 0;
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
  max-width: 470px;
  background-color: var(--bg-surface);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.15rem 1.35rem;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  text-align: left;
  font-family: inherit;
  position: relative;
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
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.2);
}

.stage-node-container.locked .stage-node-btn {
  opacity: 0.65;
  cursor: not-allowed;
  filter: grayscale(0.5);
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
  font-size: 1.6rem;
}

.check-icon {
  font-size: 1.4rem;
  color: #ffffff;
}

.lock-icon {
  font-size: 1.2rem;
  opacity: 0.8;
}

.stage-info {
  flex: 1;
  min-width: 0;
}

.stage-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.25rem;
  flex-wrap: wrap;
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
  font-weight: 900;
  background: #ef4444;
  color: #ffffff;
  padding: 0.1rem 0.5rem;
  border-radius: 4px;
  letter-spacing: 0.04em;
}

.current-badge {
  font-size: 0.6875rem;
  font-weight: 900;
  background: var(--accent-primary);
  color: var(--accent-text);
  padding: 0.1rem 0.5rem;
  border-radius: 4px;
  letter-spacing: 0.02em;
}

.stage-ch-text {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
}

.stage-name {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--text-primary);
  font-family: inherit;
  line-height: 1.35;
}

.stage-desc {
  margin: 0.2rem 0 0.4rem 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stars-row {
  display: flex;
  gap: 0.25rem;
}

.star-icon {
  color: rgba(148, 163, 184, 0.3);
  font-size: 1.05rem;
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
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
}

.stage-modal-card {
  width: 100%;
  max-width: 520px;
  padding: 1.75rem;
  position: relative;
  background-color: var(--bg-surface);
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
  max-height: 90vh;
  overflow-y: auto;
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
  margin: 0 0 0.5rem 0;
  font-size: 1.35rem;
  font-weight: 900;
  color: var(--text-primary);
}

.modal-story {
  margin: 0 0 1.25rem 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.modal-rewards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.65rem;
  margin-bottom: 1.25rem;
}

.reward-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  padding: 0.5rem 0.65rem;
  border-radius: var(--radius-md);
}

.reward-icon {
  font-size: 1.35rem;
}

.reward-details {
  display: flex;
  flex-direction: column;
}

.reward-val {
  font-size: 0.8125rem;
  font-weight: 800;
  color: var(--text-primary);
}

.reward-label {
  font-size: 0.7rem;
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
  margin-bottom: 0.4rem;
}

.vocab-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.vocab-chip {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  padding: 0.25rem 0.6rem;
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

/* ==========================================================================
   Responsive Map Rules
   ========================================================================== */
@media (max-width: 768px) {
  .world-map-wrapper {
    padding: 1rem 0.75rem 2.5rem;
  }
  .map-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }
  .map-title {
    font-size: 1.25rem;
  }
  .codex-shortcut-btn {
    width: 100%;
    justify-content: center;
    padding: 0.45rem 1rem;
  }
  /* On mobile, center all stage nodes for thumb-friendly tapping */
  .node-left,
  .node-right {
    justify-content: center;
  }
  .stage-node-btn {
    max-width: 100%;
    padding: 0.85rem 1rem;
    gap: 0.85rem;
  }
  .stage-emblem {
    width: 44px;
    height: 44px;
    font-size: 1.1rem;
  }
  .stage-name {
    font-size: 0.95rem;
  }
  .stage-desc {
    white-space: normal;
  }
}
</style>
