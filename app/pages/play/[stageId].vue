<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { StageData, GameSessionPhase, StageResultSummary } from '~/types/game';
import { useUserStore } from '~/stores/user';
import { useGameSessionStore } from '~/stores/gameSession';
import { useSoundEffects } from '~/composables/useSoundEffects';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const sessionStore = useGameSessionStore();
const { playSound, triggerVictoryConfetti } = useSoundEffects();

const stageIdParam = computed(() => Number(route.params.stageId) || 1);
const currentTrack = computed(() => userStore.currentTrack);

const stage = ref<StageData | null>(null);
const isLoading = ref<boolean>(true);
const loadError = ref<string | null>(null);
const stageResult = ref<StageResultSummary | null>(null);

// -------------------------------------------------------------------------
// Load Stage Data
// -------------------------------------------------------------------------
async function loadStage(): Promise<void> {
  isLoading.value = true;
  loadError.value = null;

  try {
    const stages = await $fetch<StageData[]>(`/data/${currentTrack.value}/stages.json`);
    const target = stages.find((s) => s.stageId === stageIdParam.value);

    if (!target) {
      throw new Error(`Không tìm thấy chặng thử thách #${stageIdParam.value}`);
    }

    stage.value = target;

    // Check Energy requirement
    if (userStore.energy.current < 1) {
      loadError.value = 'Bạn không đủ năng lượng ⚡ để bắt đầu chặng này! Hãy đợi hồi năng lượng hoặc mua tại Cửa Hàng.';
      return;
    }

    // Deduct 1 energy
    userStore.energy.current = Math.max(0, userStore.energy.current - 1);
    userStore.saveGuestState();

    // Start Session
    sessionStore.initSession(target);
    sessionStore.startSession();
  } catch (err: unknown) {
    console.error('[PlayPage] Failed to load stage:', err);
    loadError.value =
      err instanceof Error ? err.message : 'Có lỗi xảy ra khi tải chặng thử thách.';
  } finally {
    isLoading.value = false;
  }
}

// -------------------------------------------------------------------------
// Mini-Game Step Transitions
// -------------------------------------------------------------------------
function onAlchemyCompleted(): void {
  playSound('correct');
  sessionStore.advancePhase('voice_runner');
}

function onVoiceCompleted(): void {
  playSound('correct');
  sessionStore.advancePhase('sentence_lock');
}

async function onSentenceCompleted(): Promise<void> {
  playSound('correct');
  // If stage has AI roleplay mission, advance to Phase 4: AI Roleplay
  if (stage.value?.aiRoleplayMission) {
    sessionStore.advancePhase('ai_roleplay');
  } else {
    const summary = await sessionStore.completeStage();
    stageResult.value = summary;
  }
}

async function onAiRoleplayCompleted(): Promise<void> {
  playSound('correct');
  const summary = await sessionStore.completeStage();
  stageResult.value = summary;
}

function onGameFailed(): void {
  playSound('wrong');
  sessionStore.advancePhase('gameover');
}

function handleRetry(): void {
  if (stage.value) {
    if (userStore.energy.current < 1) {
      loadError.value = 'Không đủ năng lượng để thử lại!';
      return;
    }
    userStore.energy.current = Math.max(0, userStore.energy.current - 1);
    userStore.saveGuestState();

    sessionStore.initSession(stage.value);
    sessionStore.startSession();
    stageResult.value = null;
  }
}

function handleReturnHome(): void {
  void router.push('/');
}

onMounted(() => {
  void loadStage();
});
</script>

<template>
  <div class="play-page-container">
    <!-- Loading State -->
    <div v-if="isLoading" class="play-loading-state theme-card">
      <div class="loading-spinner" />
      <p>Đang tải thử thách Chặng {{ stageIdParam }}...</p>
    </div>

    <!-- Error / Out of Energy State -->
    <div v-else-if="loadError" class="play-error-state theme-card">
      <span class="error-icon" aria-hidden="true">⚠️</span>
      <h2>Không Thể Bắt Đầu</h2>
      <p>{{ loadError }}</p>
      <NuxtLink to="/" class="theme-btn-primary return-home-btn">
        Quay Về Bản Đồ
      </NuxtLink>
    </div>

    <!-- Active Game Session -->
    <div v-else-if="stage" class="play-content-wrapper">
      <!-- Session Header Bar -->
      <div class="session-header-bar theme-card">
        <div class="session-left">
          <NuxtLink to="/" class="back-link-btn" title="Trở về bản đồ" aria-label="Trở về">
            ← Bản Đồ
          </NuxtLink>
          <div class="stage-badge-info">
            <span class="stage-tag">Chặng {{ stage.stageId }}</span>
            <span class="stage-title-text">{{ stage.title }}</span>
          </div>
        </div>

        <!-- Mini-Games Step Progression Bar -->
        <div class="game-steps-nav">
          <span
            class="step-pill"
            :class="{
              'step-active': sessionStore.phase === 'word_alchemy',
              'step-done': sessionStore.phase === 'voice_runner' || sessionStore.phase === 'sentence_lock' || sessionStore.phase === 'ai_roleplay' || sessionStore.phase === 'victory'
            }"
          >
            1. Ghép Thẻ
          </span>
          <span class="step-divider">→</span>
          <span
            class="step-pill"
            :class="{
              'step-active': sessionStore.phase === 'voice_runner',
              'step-done': sessionStore.phase === 'sentence_lock' || sessionStore.phase === 'ai_roleplay' || sessionStore.phase === 'victory'
            }"
          >
            2. Giọng Nói
          </span>
          <span class="step-divider">→</span>
          <span
            class="step-pill"
            :class="{
              'step-active': sessionStore.phase === 'sentence_lock',
              'step-done': sessionStore.phase === 'ai_roleplay' || sessionStore.phase === 'victory'
            }"
          >
            3. Khóa Cổ Ngữ
          </span>
          <template v-if="stage.aiRoleplayMission">
            <span class="step-divider">→</span>
            <span
              class="step-pill"
              :class="{
                'step-active': sessionStore.phase === 'ai_roleplay',
                'step-done': sessionStore.phase === 'victory'
              }"
            >
              4. Nhập Vai AI
            </span>
          </template>
        </div>

        <!-- Session Score & HP -->
        <div class="session-right">
          <span class="score-display">⭐ {{ sessionStore.score }}</span>
        </div>
      </div>

      <!-- Boss Stage Spaced Repetition SRS Ambush Banner -->
      <div v-if="stage.isBossStage" class="boss-ambush-banner theme-card">
        <div class="boss-badge-icon" aria-hidden="true">👑</div>
        <div class="boss-ambush-info">
          <h3 class="boss-ambush-title">MÀN ĐẤU BOSS CHƯƠNG: {{ stage.title }}</h3>
          <p class="boss-ambush-desc">
            Vượt qua các chướng ngại vật và đối thoại AI để hạ gục Boss!
            <span v-if="userStore.srsBossQueue.length > 0" class="srs-count-pill">
              Ôn tập {{ userStore.srsBossQueue.length }} từ vựng yếu
            </span>
          </p>
        </div>
      </div>

      <!-- Mini-Game 1: Word Alchemy -->
      <GameWordAlchemy
        v-if="sessionStore.phase === 'word_alchemy'"
        :stage="stage"
        @completed="onAlchemyCompleted"
        @failed="onGameFailed"
      />

      <!-- Mini-Game 2: Voice Runner -->
      <GameVoiceRunner
        v-else-if="sessionStore.phase === 'voice_runner'"
        :stage="stage"
        @completed="onVoiceCompleted"
        @failed="onGameFailed"
      />

      <!-- Mini-Game 3: Sentence Lock -->
      <GameSentenceLock
        v-else-if="sessionStore.phase === 'sentence_lock'"
        :stage="stage"
        @completed="onSentenceCompleted"
        @failed="onGameFailed"
      />

      <!-- Mini-Game 4: AI Roleplay -->
      <GameAiRoleplay
        v-else-if="sessionStore.phase === 'ai_roleplay'"
        :stage="stage"
        @completed="onAiRoleplayCompleted"
        @failed="onGameFailed"
      />

      <!-- Victory Screen -->
      <div v-else-if="sessionStore.phase === 'victory'" class="victory-screen theme-card">
        <span class="victory-icon" aria-hidden="true">🏆</span>
        <h1 class="victory-title">Chinh Phục Thành Công!</h1>
        <p class="victory-subtitle">Bạn đã hoàn thành toàn bộ thử thách tại {{ stage.title }}</p>

        <!-- Stars Display -->
        <div class="victory-stars">
          <span
            v-for="s in 3"
            :key="s"
            class="star-emblem"
            :class="{ 'star-earned': s <= (stageResult?.starsEarned || 0) }"
          >
            ★
          </span>
        </div>

        <!-- Rewards Summary -->
        <div class="victory-rewards-grid">
          <div class="reward-card">
            <span class="reward-icon" aria-hidden="true">⚡</span>
            <span class="reward-amount">+{{ stageResult?.totalExpEarned }} EXP</span>
            <span class="reward-title">Kinh Nghiệm</span>
          </div>

          <div class="reward-card">
            <span class="reward-icon" aria-hidden="true">💰</span>
            <span class="reward-amount">+{{ stageResult?.totalGoldEarned }} Vàng</span>
            <span class="reward-title">Tiền Thưởng</span>
          </div>

          <div v-if="stage.reward.guaranteedCardId" class="reward-card highlight-card">
            <span class="reward-icon" aria-hidden="true">🃏</span>
            <span class="reward-amount">Thẻ Bài Mới!</span>
            <span class="reward-title">Đã nạp vào Codex</span>
          </div>
        </div>

        <div class="victory-actions">
          <button type="button" class="theme-btn-primary" @click="handleReturnHome">
            Tiếp Tục Bản Đồ Thế Giới →
          </button>
        </div>
      </div>

      <!-- GameOver Screen -->
      <div v-else-if="sessionStore.phase === 'gameover'" class="gameover-screen theme-card">
        <span class="gameover-icon" aria-hidden="true">💀</span>
        <h1 class="gameover-title">Hết Tim!</h1>
        <p class="gameover-subtitle">Bạn đã kiệt sức trước chướng ngại vật của chặng này.</p>

        <div class="gameover-actions">
          <button type="button" class="theme-btn-primary retry-btn" @click="handleRetry">
            Thử Lại (Tốn 1⚡)
          </button>
          <button type="button" class="return-btn" @click="handleReturnHome">
            Quay Về Bản Đồ
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.play-page-container {
  min-height: calc(100vh - 70px);
  padding: 1.5rem 1rem 3rem;
  max-width: 900px;
  margin: 0 auto;
}

.play-loading-state,
.play-error-state {
  text-align: center;
  padding: 3rem 1.5rem;
  max-width: 500px;
  margin: 4rem auto;
}

.loading-spinner {
  width: 44px;
  height: 44px;
  border: 3px solid rgba(148, 163, 184, 0.3);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1.25rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 0.75rem;
}

.return-home-btn {
  margin-top: 1.5rem;
  text-decoration: none;
}

/* Session Header Bar */
.session-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.session-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-link-btn {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-muted);
  text-decoration: none;
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;
}

.back-link-btn:hover {
  color: var(--text-primary);
  border-color: var(--border-focus);
}

.stage-badge-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stage-tag {
  font-size: 0.75rem;
  font-weight: 800;
  background: var(--accent-gradient);
  color: var(--accent-text);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-sm);
}

.stage-title-text {
  font-size: 0.9375rem;
  font-weight: 800;
  color: var(--text-primary);
}

/* Steps Nav */
.game-steps-nav {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.step-pill {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-pill);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  transition: all 0.25s ease;
}

.step-active {
  background: var(--accent-primary);
  color: var(--accent-text);
  border-color: var(--accent-primary);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
}

.step-done {
  color: #10b981;
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.step-divider {
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.score-display {
  font-size: 1.125rem;
  font-weight: 900;
  color: var(--text-primary);
}

/* Victory Screen */
.victory-screen {
  text-align: center;
  padding: 3rem 1.5rem;
  max-width: 580px;
  margin: 1.5rem auto;
  animation: victory-pop 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes victory-pop {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

.victory-icon {
  font-size: 4rem;
  line-height: 1;
}

.victory-title {
  margin: 0.75rem 0 0.25rem;
  font-size: 1.75rem;
  font-weight: 900;
  color: var(--text-primary);
}

.victory-subtitle {
  margin: 0 0 1.5rem;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}

.victory-stars {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 2rem;
}

.star-emblem {
  font-size: 2.5rem;
  color: rgba(148, 163, 184, 0.3);
  transition: all 0.3s ease;
}

.star-earned {
  color: #f59e0b !important;
  filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.6));
  animation: star-bounce 0.4s ease-out;
}

@keyframes star-bounce {
  0% { transform: scale(0); }
  60% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

.victory-rewards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.reward-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.highlight-card {
  border-color: #a855f7;
  background: rgba(168, 85, 247, 0.08);
}

.reward-amount {
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0.25rem 0;
}

.reward-title {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.victory-actions {
  display: flex;
  justify-content: center;
}

/* Boss Ambush SRS Banner */
.boss-ambush-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
  border: 2px solid #ef4444;
  background: linear-gradient(135deg, var(--bg-surface) 0%, rgba(239, 68, 68, 0.08) 100%);
  animation: current-pulse 2s infinite ease-in-out;
}

.boss-badge-icon {
  font-size: 2rem;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: #ef4444;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3);
}

.boss-ambush-info {
  flex: 1;
}

.boss-ambush-title {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  font-weight: 800;
  color: #ef4444;
  letter-spacing: 0.02em;
}

.boss-ambush-desc {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.srs-count-pill {
  background: #ef4444;
  color: #ffffff;
  font-size: 0.6875rem;
  font-weight: 800;
  padding: 0.1rem 0.5rem;
  border-radius: var(--radius-pill);
}

/* GameOver Screen */
.gameover-screen {
  text-align: center;
  padding: 3rem 1.5rem;
  max-width: 500px;
  margin: 1.5rem auto;
}

.gameover-icon {
  font-size: 4rem;
  line-height: 1;
}

.gameover-title {
  margin: 0.75rem 0 0.25rem;
  font-size: 1.75rem;
  font-weight: 900;
  color: #ef4444;
}

.gameover-subtitle {
  margin: 0 0 1.5rem;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}

.gameover-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.return-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius-md);
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
</style>

