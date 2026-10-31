<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useUserStore } from '~/stores/user';
import type { CodexData, CodexCard, CardRarity } from '~/types/game';
import type { WorldTrack } from '~/types/user';

const userStore = useUserStore();

const codexData = ref<CodexData | null>(null);
const isLoading = ref<boolean>(true);
const fetchError = ref<string | null>(null);

const activeTrackFilter = ref<string>('all');
const activeRarityFilter = ref<string>('all');
const searchQuery = ref<string>('');

async function loadCodex(): Promise<void> {
  isLoading.value = true;
  fetchError.value = null;

  try {
    const data = await $fetch<CodexData>('/data/cards/codex.json');
    codexData.value = data;
  } catch (err: unknown) {
    console.error('[CodexPage] Failed to fetch codex data:', err);
    fetchError.value = 'Không thể tải bộ sưu tập Thẻ Bài. Vui lòng thử lại sau.';
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  void loadCodex();
});

const userCollectedCardIds = computed<Set<string>>(() => {
  return new Set(userStore.user.collectedCards || []);
});

const totalCollected = computed<number>(() => {
  return userCollectedCardIds.value.size;
});

const totalCardsCount = computed<number>(() => {
  return codexData.value?.cards?.length || 240;
});

function getTrackCardsCount(track: string): number {
  if (!codexData.value?.cards) return 0;
  return codexData.value.cards.filter((c) => c.worldTrack === track).length;
}

const progressPercent = computed<number>(() => {
  if (totalCardsCount.value === 0) return 0;
  return Math.min(100, Math.round((totalCollected.value / totalCardsCount.value) * 100));
});

const filteredCards = computed<CodexCard[]>(() => {
  if (!codexData.value?.cards) return [];

  return codexData.value.cards.filter((card) => {
    // Universe Filter
    if (activeTrackFilter.value !== 'all' && card.worldTrack !== activeTrackFilter.value) {
      return false;
    }

    // Rarity Filter
    if (activeRarityFilter.value !== 'all' && card.rarity !== activeRarityFilter.value) {
      return false;
    }

    // Search Query Filter
    if (searchQuery.value.trim().length > 0) {
      const q = searchQuery.value.toLowerCase().trim();
      const matchWord = card.word.toLowerCase().includes(q);
      const matchMeaning = card.meaning.toLowerCase().includes(q);
      if (!matchWord && !matchMeaning) return false;
    }

    return true;
  });
});

useHead({
  title: 'Sổ Tay Thẻ Bài 3D (Codex) - EngVerse',
  meta: [
    {
      name: 'description',
      content: 'Bộ sưu tập Thẻ Bài 3D từ vựng tiếng Anh theo từng vũ trụ tại EngVerse.',
    },
  ],
});
</script>

<template>
  <main class="codex-page-container">
    <!-- Codex Header & Progress -->
    <section class="codex-header-section">
      <div class="header-inner-box">
        <div class="top-nav-bar">
          <NuxtLink to="/" class="back-link">
            ← Quay lại Bản Đồ Thế Giới
          </NuxtLink>
        </div>

        <h1 class="codex-title">Sổ Tay Thẻ Bài 3D (Codex)</h1>
        <p class="codex-desc">
          Bộ sưu tập {{ totalCardsCount }} thẻ bài từ vựng ma thuật. Mỗi thẻ bài hoàn thành sẽ mở khóa danh hiệu độc quyền
          và gia tăng sức mạnh ngôn ngữ của bạn.
        </p>

        <!-- Collection Progress Bar -->
        <div class="collection-progress-card theme-card">
          <div class="progress-info">
            <span class="progress-title">Tiến Độ Thu Thập Toàn Bộ Vũ Trụ:</span>
            <span class="progress-numbers">
              <strong>{{ totalCollected }}</strong> / {{ totalCardsCount }} Thẻ Bài ({{ progressPercent }}%)
            </span>
          </div>

          <div class="progress-track" role="progressbar" :aria-valuenow="progressPercent" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-fill" :style="{ width: `${progressPercent}%` }" />
          </div>
        </div>
      </div>
    </section>

    <!-- Filters & Search Toolbar -->
    <section class="codex-toolbar">
      <div class="toolbar-inner">
        <!-- Universe Track Filter -->
        <div class="filter-group">
          <span class="filter-label">Vũ Trụ:</span>
          <div class="filter-pills">
            <button
              type="button"
              class="filter-pill"
              :class="{ 'pill-active': activeTrackFilter === 'all' }"
              @click="activeTrackFilter = 'all'"
            >
              Tất cả ({{ totalCardsCount }})
            </button>
            <button
              type="button"
              class="filter-pill"
              :class="{ 'pill-active': activeTrackFilter === 'kids' }"
              @click="activeTrackFilter = 'kids'"
            >
              🏝️ Đảo Thần Thoại ({{ getTrackCardsCount('kids') }})
            </button>
            <button
              type="button"
              class="filter-pill"
              :class="{ 'pill-active': activeTrackFilter === 'teens' }"
              @click="activeTrackFilter = 'teens'"
            >
              ⚡ Cyber City ({{ getTrackCardsCount('teens') }})
            </button>
            <button
              type="button"
              class="filter-pill"
              :class="{ 'pill-active': activeTrackFilter === 'adults' }"
              @click="activeTrackFilter = 'adults'"
            >
              🌐 SimLife ({{ getTrackCardsCount('adults') }})
            </button>
          </div>
        </div>

        <!-- Rarity Filter -->
        <div class="filter-group">
          <span class="filter-label">Độ Hiếm:</span>
          <div class="filter-pills">
            <button
              type="button"
              class="filter-pill"
              :class="{ 'pill-active': activeRarityFilter === 'all' }"
              @click="activeRarityFilter = 'all'"
            >
              Tất cả
            </button>
            <button
              type="button"
              class="filter-pill rarity-pill-common"
              :class="{ 'pill-active': activeRarityFilter === 'common' }"
              @click="activeRarityFilter = 'common'"
            >
              Phổ Thông
            </button>
            <button
              type="button"
              class="filter-pill rarity-pill-rare"
              :class="{ 'pill-active': activeRarityFilter === 'rare' }"
              @click="activeRarityFilter = 'rare'"
            >
              Hiếm
            </button>
            <button
              type="button"
              class="filter-pill rarity-pill-epic"
              :class="{ 'pill-active': activeRarityFilter === 'epic' }"
              @click="activeRarityFilter = 'epic'"
            >
              Sử Thi
            </button>
            <button
              type="button"
              class="filter-pill rarity-pill-legendary"
              :class="{ 'pill-active': activeRarityFilter === 'legendary' }"
              @click="activeRarityFilter = 'legendary'"
            >
              Huyền Thoại
            </button>
          </div>
        </div>

        <!-- Search Input -->
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Tìm theo từ vựng hoặc nghĩa tiếng Việt..."
            class="search-input"
          />
        </div>
      </div>
    </section>

    <!-- Cards Grid -->
    <section class="codex-cards-section">
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner" />
        <p>Đang tải bộ thẻ bài 3D...</p>
      </div>

      <div v-else-if="fetchError" class="error-state">
        <p>{{ fetchError }}</p>
        <button type="button" class="retry-btn" @click="loadCodex">Thử lại</button>
      </div>

      <div v-else-if="filteredCards.length === 0" class="empty-state">
        <p>Không tìm thấy thẻ bài nào khớp với bộ lọc.</p>
      </div>

      <div v-else class="cards-grid">
        <CardCodexItem
          v-for="card in filteredCards"
          :key="card.id"
          :card="card"
          :is-collected="userCollectedCardIds.has(card.id)"
        />
      </div>
    </section>
  </main>
</template>

<style scoped>
.codex-page-container {
  min-height: calc(100vh - 70px);
  padding-bottom: 5rem;
}

.codex-header-section {
  background: linear-gradient(180deg, var(--bg-secondary) 0%, transparent 100%);
  padding: 1.5rem 1.25rem 2rem;
}

.header-inner-box {
  max-width: 1200px;
  margin: 0 auto;
}

.top-nav-bar {
  margin-bottom: 1rem;
}

.back-link {
  color: var(--accent-primary);
  font-weight: 700;
  font-size: 0.875rem;
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}

.codex-title {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
  font-weight: 900;
  color: var(--text-primary);
}

.codex-desc {
  margin: 0 0 1.5rem 0;
  font-size: 0.9375rem;
  color: var(--text-secondary);
  max-width: 760px;
  line-height: 1.5;
}

.collection-progress-card {
  padding: 1.25rem 1.5rem;
  max-width: 650px;
  background-color: var(--bg-surface);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.625rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  flex-wrap: wrap;
  gap: 0.5rem;
}

.progress-track {
  width: 100%;
  height: 10px;
  background-color: rgba(148, 163, 184, 0.2);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent-gradient);
  border-radius: var(--radius-pill);
  transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Toolbar */
.codex-toolbar {
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-surface-translucent);
  padding: 1rem 1.25rem;
  position: sticky;
  top: 60px;
  z-index: 100;
  backdrop-filter: blur(8px);
}

.toolbar-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-label {
  font-size: 0.8125rem;
  font-weight: 800;
  color: var(--text-muted);
  min-width: 70px;
}

.filter-pills {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.filter-pill {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-pill:hover {
  border-color: var(--border-focus);
  color: var(--text-primary);
}

.pill-active {
  background: var(--accent-primary) !important;
  border-color: var(--accent-primary) !important;
  color: var(--accent-text) !important;
}

.search-box {
  width: 100%;
}

.search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.625rem 1rem;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.875rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: var(--border-focus);
}

/* Cards Section */
.codex-cards-section {
  max-width: 1200px;
  margin: 2rem auto 0;
  padding: 0 1.25rem;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem;
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 5rem 1rem;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 44px;
  height: 44px;
  border: 3px solid rgba(148, 163, 184, 0.3);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .cards-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
  }
  .codex-title {
    font-size: 1.6rem;
  }
}
</style>

