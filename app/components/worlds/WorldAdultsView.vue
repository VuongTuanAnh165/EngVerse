<script setup lang="ts">
/**
 * EngVerse - WorldAdultsView Component
 * Dedicated World Interface for Universe 3: SimLife Global (Adults 23+).
 *
 * 100% Data-Driven Architecture:
 * - Dynamically computes total stages, chapters, bosses and max stars from `stages` data.
 * - Dynamically builds international flight hubs from stage titles / locations.
 * - Auto-adapts whenever stages.json is updated without UI code changes.
 *
 * Strict TypeScript (0 any), Vue 3.5+
 * Reference: docs/ke_hoach.md & Rules.md
 */

import { computed } from 'vue';
import { useUserStore } from '~/stores/user';
import type { StageData } from '~/types/game';

interface Props {
  stages?: StageData[];
}

const props = withDefaults(defineProps<Props>(), {
  stages: () => [],
});

const userStore = useUserStore();

const adultsProgress = computed(() => userStore.user.progress?.tracks?.adults);
const unlockedStage = computed(() => adultsProgress.value?.unlockedStage || 1);
const totalStars = computed(() => {
  const starsMap = adultsProgress.value?.stageStars || {};
  return Object.values(starsMap).reduce((sum, s) => sum + s, 0);
});

// Dynamic stage and star counts from data
const totalStagesCount = computed(() => props.stages.length || 10);
const maxPossibleStars = computed(() => totalStagesCount.value * 3);

// Career progress percentage based on stars collected
const careerPercent = computed(() =>
  maxPossibleStars.value > 0
    ? Math.min(100, Math.round((totalStars.value / maxPossibleStars.value) * 100))
    : 0
);

// Dynamic chapter detection from current stage data
const currentStage = computed(() =>
  props.stages.find((s) => s.stageId === unlockedStage.value) || props.stages[props.stages.length - 1]
);
const currentChapter = computed(() => currentStage.value?.chapter || 1);
const totalChapters = computed(() => {
  if (!props.stages || props.stages.length === 0) return 1;
  return new Set(props.stages.map((s) => s.chapter || 1)).size;
});

const currentChapterBadge = computed(() => {
  const chapterStages = props.stages.filter((s) => s.chapter === currentChapter.value);
  const startId = chapterStages[0]?.stageId || 1;
  const endId = chapterStages[chapterStages.length - 1]?.stageId || startId;
  const chapterBoss = chapterStages.find((s) => s.isBossStage);
  const bossText = chapterBoss ? ` // BOSS: ${chapterBoss.title.replace(/^BOSS:\s*/i, '').toUpperCase()}` : '';
  return `SIMLIFE GLOBAL // CHƯƠNG ${currentChapter.value}/${totalChapters.value} (Chặng ${startId}-${endId})${bossText}`;
});

// Known airport codes for international cities that might appear in stage titles
const CITY_AIRPORT_CODES: Record<string, string> = {
  'Hà Nội': 'HAN',
  'Singapore': 'SIN',
  'Tokyo': 'TYO',
  'London': 'LHR',
  'New York': 'JFK',
  'Paris': 'CDG',
  'Berlin': 'BER',
  'Silicon Valley': 'SFO',
  'Dubai': 'DXB',
  'Phố Wall': 'NYC',
  'Bangkok': 'BKK',
  'Seoul': 'ICN',
  'Sydney': 'SYD',
  'Frankfurt': 'FRA',
  'Hong Kong': 'HKG',
  'Toronto': 'YYZ',
};

// Global hubs dynamically derived from stages.json!
const hubs = computed(() => {
  if (!props.stages || props.stages.length === 0) return [];
  return props.stages.map((stage) => {
    let code = stage.isBossStage ? 'BOSS' : `S${stage.stageId}`;
    let city = stage.title.replace(/^BOSS:\s*/i, '');

    for (const [cityName, airportCode] of Object.entries(CITY_AIRPORT_CODES)) {
      if (stage.title.includes(cityName)) {
        code = airportCode;
        city = cityName;
        break;
      }
    }

    return {
      stageId: stage.stageId,
      code,
      city,
      isBoss: stage.isBossStage,
      active: unlockedStage.value >= stage.stageId,
    };
  });
});
</script>

<template>
  <div class="world-adults-container">
    <!-- Executive Career Dashboard Banner -->
    <div class="adults-dashboard-card theme-card">
      <div class="dashboard-left">
        <div class="globe-pod">
          <div class="globe-icon" aria-hidden="true">🌐</div>
          <div class="tier-pill">CẤP ĐỘ {{ unlockedStage }}/{{ totalStagesCount }} // EXECUTIVE EXP</div>
        </div>
      </div>

      <div class="dashboard-info">
        <div class="corp-track-badge">
          <span class="active-dot" />
          <span>{{ currentChapterBadge }}</span>
        </div>
        <h3 class="dashboard-title">Hành Trình Sự Nghiệp Toàn Cầu</h3>
        <p class="dashboard-desc">
          Làm chủ {{ totalStagesCount }} chặng thử thách qua các trung tâm tài chính thế giới: giao thương, thuyết trình ngoại giao, M&A và rung chuông IPO.
        </p>

        <!-- Global Hubs Route Status (Dynamically derived from stages.json) -->
        <div class="hubs-route-row">
          <div
            v-for="(hub, idx) in hubs"
            :key="hub.stageId"
            class="hub-item"
            :class="{ 'hub-active': hub.active }"
          >
            <span class="hub-code">{{ hub.code }}</span>
            <span class="hub-city">{{ hub.city }}</span>
            <span v-if="idx < hubs.length - 1" class="hub-arrow" aria-hidden="true">✈️</span>
          </div>
        </div>

        <!-- Career Milestone Progress Bar -->
        <div class="career-progress-wrapper">
          <div class="career-bar">
            <div class="career-fill" :style="{ width: `${careerPercent}%` }" />
          </div>
          <span class="career-percent-label">TIẾN ĐỘ THĂNG TIẾN: {{ careerPercent }}% ({{ totalStars }}/{{ maxPossibleStars }} ⭐)</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.world-adults-container {
  margin-bottom: 2rem;
  position: relative;
}

.adults-dashboard-card {
  display: flex;
  align-items: center;
  gap: 1.75rem;
  padding: 1.5rem 2rem;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(241, 245, 249, 0.9) 100%);
  border: 1px solid #cbd5e1;
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
}

.dashboard-left {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.globe-pod {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.globe-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.25rem;
  color: #ffffff;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.2);
  transition: transform 0.3s ease;
}

.globe-icon:hover {
  transform: rotate(15deg) scale(1.05);
}

.tier-pill {
  font-size: 0.625rem;
  font-weight: 800;
  color: #0f172a;
  background: rgba(15, 23, 42, 0.08);
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  white-space: nowrap;
  letter-spacing: 0.05em;
}

.dashboard-info {
  flex: 1;
}

.corp-track-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.6875rem;
  font-weight: 800;
  color: #0f172a;
  background: rgba(15, 23, 42, 0.06);
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  letter-spacing: 0.06em;
}

.active-dot {
  width: 6px;
  height: 6px;
  background-color: #059669;
  border-radius: 50%;
  box-shadow: 0 0 6px #059669;
}

.dashboard-title {
  margin: 0 0 0.4rem 0;
  font-size: 1.375rem;
  font-weight: 900;
  color: #0f172a;
}

.dashboard-desc {
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
  color: #475569;
  line-height: 1.5;
}

.hubs-route-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.hub-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  opacity: 0.4;
  transition: opacity 0.2s ease;
}

.hub-item.hub-active {
  opacity: 1;
}

.hub-code {
  font-size: 0.75rem;
  font-weight: 900;
  color: #0f172a;
  background: #e2e8f0;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}

.hub-item.hub-active .hub-code {
  background: #0f172a;
  color: #ffffff;
}

.hub-city {
  font-size: 0.75rem;
  font-weight: 600;
  color: #334155;
}

.hub-arrow {
  font-size: 0.75rem;
  margin-left: 0.25rem;
}

.career-progress-wrapper {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.career-bar {
  flex: 1;
  height: 10px;
  background: #e2e8f0;
  border-radius: 9999px;
  overflow: hidden;
}

.career-fill {
  height: 100%;
  background: linear-gradient(90deg, #0f172a 0%, #059669 100%);
  border-radius: 9999px;
  transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.career-percent-label {
  font-size: 0.75rem;
  font-weight: 800;
  color: #0f172a;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .adults-dashboard-card {
    flex-direction: column;
    text-align: center;
    padding: 1.25rem 1rem;
    gap: 1rem;
  }
  .hubs-route-row {
    justify-content: center;
  }
  .career-progress-wrapper {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
