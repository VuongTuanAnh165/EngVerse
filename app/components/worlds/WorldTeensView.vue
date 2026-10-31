<script setup lang="ts">
/**
 * EngVerse - WorldTeensView Component
 * Dedicated World Interface for Universe 2: Cyber City Neo-High (Teens 13-22).
 *
 * 100% Data-Driven Architecture:
 * - Dynamically computes total stages, chapters, bosses and max stars from `stages` data.
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

const teensProgress = computed(() => userStore.user.progress?.tracks?.teens);
const unlockedStage = computed(() => teensProgress.value?.unlockedStage || 1);
const totalStars = computed(() => {
  const starsMap = teensProgress.value?.stageStars || {};
  return Object.values(starsMap).reduce((sum, s) => sum + s, 0);
});

// Dynamic stage and star counts from data
const totalStagesCount = computed(() => props.stages.length || 10);
const maxPossibleStars = computed(() => totalStagesCount.value * 3);

// Dynamic decryption percentage based on actual total stars available
const decryptPercent = computed(() =>
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
  return `NEO-HIGH MAINFRAME // CHƯƠNG ${currentChapter.value}/${totalChapters.value} (Chặng ${startId}-${endId})${bossText}`;
});
</script>

<template>
  <div class="world-teens-container">
    <!-- Cyberpunk Ambient Scanline & Grid Background -->
    <div class="cyber-grid-ambient" aria-hidden="true">
      <div class="radar-circle" />
      <div class="radar-sweep" />
    </div>

    <!-- Neo-High Terminal Status Card -->
    <div class="teens-terminal-card theme-card">
      <div class="terminal-badge-pod">
        <div class="terminal-radar-display">
          <span class="cyber-radar-icon" aria-hidden="true">📡</span>
          <div class="radar-ping" />
        </div>
        <div class="clearance-tag">CẤP ĐỘ {{ unlockedStage }}/{{ totalStagesCount }}</div>
      </div>

      <div class="terminal-info">
        <div class="cyber-glitch-badge">
          <span class="blinking-led" />
          <span>{{ currentChapterBadge }}</span>
        </div>
        <h3 class="terminal-title">Bản Đồ Giải Mã Dữ Liệu Cyber City</h3>
        <p class="terminal-desc">
          Thu thập chứng cứ từ {{ totalStagesCount }} chặng thử thách để giải mã tệp tin tuyệt mật và lật mở danh tính Trùm Hacker Boss!
        </p>

        <!-- Decryption Progress HUD -->
        <div class="decrypt-hud-wrapper">
          <div class="decrypt-bar">
            <div class="decrypt-fill" :style="{ width: `${decryptPercent}%` }" />
          </div>
          <span class="decrypt-label">TIẾN ĐỘ GIẢI MÃ: {{ decryptPercent }}% ({{ totalStars }}/{{ maxPossibleStars }} ⭐)</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.world-teens-container {
  position: relative;
  margin-bottom: 2rem;
  overflow: hidden;
}

.cyber-grid-ambient {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  background: radial-gradient(circle at 80% 20%, rgba(6, 182, 212, 0.12) 0%, transparent 60%);
}

.radar-circle {
  position: absolute;
  top: -40px;
  right: -40px;
  width: 180px;
  height: 180px;
  border: 1px dashed rgba(6, 182, 212, 0.25);
  border-radius: 50%;
}

.radar-sweep {
  position: absolute;
  top: -40px;
  right: -40px;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  border-right: 2px solid #06b6d4;
  animation: radar-spin 6s linear infinite;
}

@keyframes radar-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.teens-terminal-card {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 1.75rem;
  padding: 1.5rem 2rem;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.85) 100%);
  border: 1px solid rgba(6, 182, 212, 0.4);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5), inset 0 0 15px rgba(6, 182, 212, 0.1);
}

.terminal-badge-pod {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.terminal-radar-display {
  width: 80px;
  height: 80px;
  background: rgba(6, 182, 212, 0.1);
  border: 2px solid #06b6d4;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.25rem;
  position: relative;
  box-shadow: 0 0 20px rgba(6, 182, 212, 0.35);
}

.radar-ping {
  position: absolute;
  inset: -4px;
  border-radius: 14px;
  border: 1px solid #22d3ee;
  animation: ping-wave 2s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes ping-wave {
  75%, 100% {
    transform: scale(1.2);
    opacity: 0;
  }
}

.clearance-tag {
  font-size: 0.625rem;
  font-weight: 900;
  color: #22d3ee;
  background: rgba(6, 182, 212, 0.15);
  border: 1px solid rgba(6, 182, 212, 0.3);
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  letter-spacing: 0.08em;
  font-family: monospace;
}

.terminal-info {
  flex: 1;
}

.cyber-glitch-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.6875rem;
  font-weight: 800;
  color: #06b6d4;
  background: rgba(6, 182, 212, 0.15);
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  letter-spacing: 0.08em;
  font-family: monospace;
}

.blinking-led {
  width: 6px;
  height: 6px;
  background-color: #06b6d4;
  border-radius: 50%;
  box-shadow: 0 0 6px #06b6d4;
  animation: blink 1s infinite alternate;
}

@keyframes blink {
  from { opacity: 0.2; }
  to { opacity: 1; }
}

.terminal-title {
  margin: 0 0 0.4rem 0;
  font-size: 1.375rem;
  font-weight: 900;
  color: #f8fafc;
  letter-spacing: -0.01em;
}

.terminal-desc {
  margin: 0 0 0.875rem 0;
  font-size: 0.875rem;
  color: #94a3b8;
  line-height: 1.5;
}

.decrypt-hud-wrapper {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.decrypt-bar {
  flex: 1;
  height: 10px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(6, 182, 212, 0.3);
  border-radius: 4px;
  overflow: hidden;
}

.decrypt-fill {
  height: 100%;
  background: linear-gradient(90deg, #06b6d4 0%, #a855f7 100%);
  border-radius: 3px;
  box-shadow: 0 0 10px rgba(6, 182, 212, 0.6);
  transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.decrypt-label {
  font-size: 0.75rem;
  font-weight: 800;
  color: #22d3ee;
  font-family: monospace;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .teens-terminal-card {
    flex-direction: column;
    text-align: center;
    padding: 1.25rem 1rem;
    gap: 1rem;
  }
  .decrypt-hud-wrapper {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
