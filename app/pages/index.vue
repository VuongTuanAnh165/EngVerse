<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useUserStore } from '~/stores/user';
import type { StageData, CodexData } from '~/types/game';

const userStore = useUserStore();

const currentTrack = computed(() => userStore.currentTrack);
const collectedCardsCount = computed(() => userStore.user.collectedCards?.length || 0);
const dailyStreak = computed(() => userStore.dailyStreak || 0);
const isDailyCompleted = computed(() => userStore.isDailyChallengeCompletedToday);

// Dynamic overview counts synchronized with public/data
const totalStagesCount = ref<number>(10);
const totalBossesCount = ref<number>(2);
const totalChaptersCount = ref<number>(2);
const totalCodexCards = ref<number>(240);

async function syncOverviewStats(): Promise<void> {
  try {
    const [stagesData, codexData] = await Promise.all([
      $fetch<StageData[]>(`/data/${currentTrack.value}/stages.json`),
      $fetch<CodexData>('/data/cards/codex.json'),
    ]);

    if (stagesData && Array.isArray(stagesData)) {
      totalStagesCount.value = stagesData.length;
      totalBossesCount.value = stagesData.filter((s) => s.isBossStage).length;
      totalChaptersCount.value = new Set(stagesData.map((s) => s.chapter || 1)).size;
    }

    if (codexData && Array.isArray(codexData.cards)) {
      totalCodexCards.value = codexData.cards.length;
    }
  } catch (err) {
    console.warn('[IndexPage] Using fallback stats for overview banner:', err);
  }
}

watch(currentTrack, () => {
  void syncOverviewStats();
});

onMounted(() => {
  void syncOverviewStats();
});

const trackDisplay = computed(() => {
  switch (currentTrack.value) {
    case 'kids':
      return { name: 'Đảo Thần Thoại', badge: 'KIDS (5-12T)' };
    case 'teens':
      return { name: 'Cyber City', badge: 'TEENS (13-22T)' };
    case 'adults':
      return { name: 'SimLife Global', badge: 'ADULTS (23+)' };
    default:
      return { name: 'Đa Vũ Trụ', badge: 'ALL' };
  }
});

useHead({
  title: 'Bản Đồ Thế Giới - EngVerse',
  meta: [
    {
      name: 'description',
      content: 'Chinh phục các chặng thử thách tiếng Anh trên Bản Đồ Đa Vũ Trụ EngVerse.',
    },
  ],
});
</script>

<template>
  <main class="home-page-container">
    <!-- Universe Hero Banner -->
    <section class="universe-hero">
      <div class="hero-content">
        <div class="hero-tag">
          <span class="pulse-dot" />
          <span>VŨ TRỤ: {{ trackDisplay.name.toUpperCase() }} ({{ trackDisplay.badge }})</span>
        </div>

        <h1 class="hero-title">
          Chinh Phục Ngôn Ngữ Bằng Phản Xạ Game
        </h1>

        <p class="hero-desc">
          Mỗi từ vựng bạn làm chủ sẽ hóa thành Thẻ Bài 3D gia tăng sức mạnh. Vượt qua {{ totalStagesCount }} chặng thử thách qua {{ totalChaptersCount }} Chương để diện kiến {{ totalBossesCount }} Boss Ôn Tập và khẳng định vị thế trên Bảng Xếp Hạng toàn cầu!
        </p>

        <div class="hero-quick-stats">
          <div class="quick-stat-box theme-card">
            <span class="quick-stat-icon" aria-hidden="true">🗺️</span>
            <div class="quick-stat-info">
              <span class="quick-stat-val">{{ totalStagesCount }}</span>
              <span class="quick-stat-label">Chặng Thử Thách</span>
            </div>
          </div>

          <div class="quick-stat-box theme-card">
            <span class="quick-stat-icon" aria-hidden="true">🃏</span>
            <div class="quick-stat-info">
              <span class="quick-stat-val">{{ collectedCardsCount }}/{{ totalCodexCards }}</span>
              <span class="quick-stat-label">Thẻ Bài Đã Có</span>
            </div>
          </div>

          <div class="quick-stat-box theme-card">
            <span class="quick-stat-icon" aria-hidden="true">👑</span>
            <div class="quick-stat-info">
              <span class="quick-stat-val">{{ totalBossesCount }} Boss</span>
              <span class="quick-stat-label">Thử Thách Cuối</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Daily Challenge Highlight Banner -->
    <section class="daily-challenge-callout-section">
      <div class="daily-callout-card theme-card">
        <div class="daily-callout-left">
          <div class="daily-icon-box">
            <span class="daily-flame">🔥</span>
          </div>
          <div class="daily-info">
            <div class="daily-title-row">
              <span class="daily-tag">THỬ THÁCH HÀNG NGÀY</span>
              <span v-if="isDailyCompleted" class="daily-status-completed">Đã hoàn thành hôm nay ✅</span>
              <span v-else class="daily-status-pending">Chưa hoàn thành • Reset 00:00 (GMT+7)</span>
            </div>
            <h3 class="daily-heading">3 Phút Luyện Phản Xạ 4 Pha Hàng Ngày</h3>
            <p class="daily-subtext">Vocab Sprint • Grammar Flash • Voice Challenge • Quick AI Roleplay. Chuỗi hiện tại: <strong>{{ dailyStreak }} ngày</strong>!</p>
          </div>
        </div>
        <div class="daily-callout-right">
          <NuxtLink
            to="/play/daily-challenge"
            class="theme-btn-primary daily-play-btn"
          >
            {{ isDailyCompleted ? 'Luyện Tập Lại' : 'Chinh Phục Ngay ⚡' }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Interactive Stage Map -->
    <WorldMap />
  </main>
</template>

<style scoped>
.home-page-container {
  min-height: calc(100vh - 65px);
  padding-bottom: 2rem;
}

.universe-hero {
  background: linear-gradient(180deg, var(--bg-secondary) 0%, transparent 100%);
  padding: 2.25rem 1rem 1.25rem;
  text-align: center;
}

.hero-content {
  max-width: 800px;
  margin: 0 auto;
}

.hero-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-surface-translucent);
  border: 1px solid var(--border-color);
  padding: 0.3rem 0.85rem;
  border-radius: var(--radius-pill);
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--accent-primary);
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
  box-shadow: var(--shadow-sm);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 6px #10b981;
  animation: pulse-green 1.5s infinite ease-in-out;
}

@keyframes pulse-green {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.hero-title {
  margin: 0 0 0.75rem 0;
  font-size: 2.25rem;
  font-weight: 900;
  line-height: 1.25;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.hero-desc {
  margin: 0 auto 1.5rem auto;
  max-width: 680px;
  font-size: 1rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.hero-quick-stats {
  display: flex;
  justify-content: center;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.quick-stat-box {
  background: var(--bg-surface);
  border: 1.5px solid var(--border-color);
  padding: 0.6rem 1.25rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.quick-stat-box:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--border-focus);
}

.quick-stat-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.quick-stat-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.quick-stat-val {
  font-size: 1.15rem;
  font-weight: 900;
  color: var(--text-primary);
  line-height: 1.2;
}

.quick-stat-label {
  font-size: 0.725rem;
  font-weight: 700;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .universe-hero {
    padding: 1.5rem 0.75rem 1rem;
  }
  .hero-title {
    font-size: 1.65rem;
  }
  .hero-desc {
    font-size: 0.9rem;
    margin-bottom: 1.25rem;
  }
  .hero-quick-stats {
    gap: 0.5rem;
  }
  .quick-stat-box {
    padding: 0.45rem 0.85rem;
    gap: 0.5rem;
  }
  .quick-stat-icon {
    font-size: 1.25rem;
  }
  .quick-stat-val {
    font-size: 1rem;
  }
}
/* Daily Challenge Banner */
.daily-challenge-callout-section {
  max-width: 900px;
  margin: -1rem auto 1.5rem;
  padding: 0 1rem;
}

.daily-callout-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.25rem 1.5rem;
  border-radius: var(--radius-lg);
  border: 2px solid var(--border-color);
  background: linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-card-hover) 100%);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.daily-callout-card:hover {
  border-color: #f97316;
  box-shadow: var(--shadow-md);
}

.daily-callout-left {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.daily-icon-box {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ffedd5, #fed7aa);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.daily-flame {
  font-size: 2rem;
}

.daily-title-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 0.25rem;
  flex-wrap: wrap;
}

.daily-tag {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: #ea580c;
  background: rgba(234, 88, 12, 0.1);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-pill);
}

.daily-status-completed {
  font-size: 0.75rem;
  font-weight: 700;
  color: #059669;
}

.daily-status-pending {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
}

.daily-heading {
  font-size: 1.15rem;
  font-weight: 800;
  margin: 0 0 0.25rem;
  color: var(--text-primary);
}

.daily-subtext {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
}

.daily-play-btn {
  white-space: nowrap;
  padding: 0.75rem 1.35rem;
  font-size: 0.95rem;
}

@media (max-width: 768px) {
  .daily-callout-card {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
    gap: 1rem;
    padding: 1.25rem 1rem;
  }
  .daily-callout-left {
    flex-direction: column;
    gap: 0.75rem;
  }
  .daily-title-row {
    justify-content: center;
  }
  .daily-heading {
    font-size: 1.05rem;
  }
  .daily-play-btn {
    width: 100%;
    text-align: center;
  }
}
</style>
