<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useUserStore } from '~/stores/user';
import type { StageData, CodexData } from '~/types/game';

const userStore = useUserStore();

const currentTrack = computed(() => userStore.currentTrack);
const collectedCardsCount = computed(() => userStore.user.collectedCards?.length || 0);
const dailyStreak = computed(() => userStore.dailyStreak || 0);
const isDailyCompleted = computed(() => userStore.isDailyChallengeCompletedToday);
const freeSimDailyRemaining = computed(() => userStore.getFreeSimDailyRemaining());

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

    <!-- Streak At-Risk / Shield Rescue Alert Banner -->
    <StreakAtRiskBanner />

    <!-- Quick Activity Hub (Daily Challenge, Colosseum Endgame, AI Free Simulator) -->
    <section class="activity-hub-section" aria-label="Hoạt động nổi bật">
      <div class="activity-cards-grid">
        <!-- 1. Daily Challenge Card -->
        <div class="activity-card theme-card daily-card">
          <div class="activity-header">
            <span class="activity-badge badge-flame">🔥 HÀNG NGÀY</span>
            <span v-if="isDailyCompleted" class="status-pill status-done">Đã xong hôm nay ✓</span>
            <span v-else class="status-pill status-pending">Chuỗi {{ dailyStreak }} ngày</span>
          </div>
          <h3 class="activity-title">Luyện Phản Xạ 4 Pha</h3>
          <p class="activity-desc">3 phút luyện Vocab, Grammar, Voice và Mini Roleplay mỗi ngày.</p>
          <NuxtLink to="/play/daily-challenge" class="theme-btn-primary activity-cta">
            {{ isDailyCompleted ? 'Luyện Lại' : 'Chinh Phục Ngay ⚡' }}
          </NuxtLink>
        </div>

        <!-- 2. Colosseum Endgame Card -->
        <div class="activity-card theme-card colosseum-card">
          <div class="activity-header">
            <span class="activity-badge badge-colosseum">⚔️ ENDGAME</span>
            <span v-if="userStore.isBossRushUnlocked(currentTrack)" class="status-pill status-done">Đã mở 🔓</span>
            <span v-else class="status-pill status-locked">Cần 20 chặng 🔒</span>
          </div>
          <h3 class="activity-title">Đấu Trường Sinh Tử</h3>
          <p class="activity-desc">Thử thách 4 Boss liên hoàn, tranh đoạt Khung Avatar Hoàng Kim.</p>
          <NuxtLink :to="`/play/boss-rush/${currentTrack}`" class="theme-btn-primary activity-cta cta-colosseum">
            Vào Đấu Trường ⚔️
          </NuxtLink>
        </div>

        <!-- 3. AI Free Simulator Card -->
        <div class="activity-card theme-card simulator-card">
          <div class="activity-header">
            <span class="activity-badge badge-simulator">🎙️ SIMULATOR</span>
            <span class="status-pill status-quota">{{ freeSimDailyRemaining }}/5 lượt hôm nay</span>
          </div>
          <h3 class="activity-title">Giả Lập Giao Tiếp & CEFR</h3>
          <p class="activity-desc">24+ tình huống đời thực hoặc tự thiết kế kịch bản với AI.</p>
          <NuxtLink to="/play/free-simulator" class="theme-btn-primary activity-cta cta-simulator">
            Vào Giả Lập 🎙️
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
/* ==========================================================================
   Quick Activity Hub (Daily Challenge, Colosseum Endgame, AI Simulator)
   ========================================================================== */
.activity-hub-section {
  max-width: 900px;
  margin: 1.25rem auto 1.5rem;
  padding: 0 1rem;
}

.activity-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.activity-card {
  display: flex;
  flex-direction: column;
  padding: 1.15rem 1.25rem;
  border-radius: var(--radius-lg);
  border: 1.5px solid var(--border-color);
  background: var(--bg-card);
  box-shadow: var(--shadow-sm);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.activity-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--border-focus);
}

.activity-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.65rem;
  flex-wrap: wrap;
}

.activity-badge {
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-pill);
}

.badge-flame {
  color: #ea580c;
  background: rgba(234, 88, 12, 0.12);
}

.badge-colosseum {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.12);
}

.badge-simulator {
  color: #06b6d4;
  background: rgba(6, 182, 212, 0.12);
}

.status-pill {
  font-size: 0.75rem;
  font-weight: 700;
}

.status-done {
  color: #059669;
}

.status-pending {
  color: var(--text-muted);
}

.status-unlocked {
  color: #10b981;
}

.status-locked {
  color: #ef4444;
}

.status-quota {
  color: #8b5cf6;
}

.activity-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0 0 0.35rem;
}

.activity-desc {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.4;
  margin: 0 0 1rem;
  flex: 1;
}

.activity-cta {
  display: block;
  text-align: center;
  text-decoration: none;
  padding: 0.55rem 1rem;
  font-size: 0.85rem;
  font-weight: 700;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.cta-colosseum {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: #ffffff;
}

.cta-simulator {
  background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
  color: #ffffff;
}

/* ==========================================================================
   THEME OVERRIDES: ĐẢO THẦN THOẠI (KIDS MODE)
   ========================================================================== */
html[data-theme="kids"] .cta-simulator {
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35);
}

html[data-theme="kids"] .badge-simulator {
  color: #b45309;
  background: rgba(245, 158, 11, 0.15);
}

/* ==========================================================================
   THEME OVERRIDES: SIMLIFE GLOBAL (ADULTS MODE)
   ========================================================================== */
html[data-theme="adults"] .cta-simulator {
  background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25);
}

html[data-theme="adults"] .badge-simulator {
  color: #059669;
  background: rgba(5, 150, 105, 0.12);
}
</style>
