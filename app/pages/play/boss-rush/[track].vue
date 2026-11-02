<script setup lang="ts">
/**
 * EngVerse - Boss Rush Colosseum Arena (/play/boss-rush/[track])
 * Continuous 4-Boss survival gauntlet with shared HP and Hardcore Modifiers.
 * Strictly typed (0 any), Vue 3.5 script setup, 1-Doc-Per-User architecture.
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.3, VII & Sprint 9 (Tasks 3.1 & 3.2).
 */

import { computed, onMounted, onUnmounted, defineAsyncComponent, watch, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { WorldTrack } from '~/types/user';
import { BOSS_RUSH_HARDCORE_MODIFIERS } from '~/types/bossRush';
import { useUserStore } from '~/stores/user';
import { useGameSessionStore } from '~/stores/gameSession';
import { useBossRushStore, BOSS_META_MAP } from '~/stores/bossRush';
import { useBossRushModifier } from '~/composables/useBossRushModifier';
import { useSoundEffects } from '~/composables/useSoundEffects';

// Lazy-load Mini-game components
const GameWordAlchemy = defineAsyncComponent(() => import('~/components/games/GameWordAlchemy.vue'));
const GameVoiceRunner = defineAsyncComponent(() => import('~/components/games/GameVoiceRunner.vue'));
const GameSentenceLock = defineAsyncComponent(() => import('~/components/games/GameSentenceLock.vue'));
const GameAiRoleplay = defineAsyncComponent(() => import('~/components/games/GameAiRoleplay.vue'));

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const sessionStore = useGameSessionStore();
const bossRushStore = useBossRushStore();
const { activeModifierBadges } = useBossRushModifier();
const { playSound } = useSoundEffects();

// ---------------------------------------------------------------------------
// Route & Track Resolution
// ---------------------------------------------------------------------------
const validTracks: WorldTrack[] = ['kids', 'teens', 'adults'];
const routeTrackParam = String(route.params.track || '').toLowerCase();
const currentTrack = computed<WorldTrack>(() => {
  if (validTracks.includes(routeTrackParam as WorldTrack)) {
    return routeTrackParam as WorldTrack;
  }
  return userStore.currentTrack || 'kids';
});

// Arena track visual theme details
const trackThemeMeta = computed(() => {
  switch (currentTrack.value) {
    case 'teens':
      return {
        name: 'Đấu Trường Cyber Nexus (Teens)',
        themeClass: 'theme-track-teens',
        icon: '⚡',
        accentColor: '#8b5cf6',
        lore: 'Đối đầu chuỗi Phantom AI và các thực thể thuật toán tối thượng!',
      };
    case 'adults':
      return {
        name: 'Đấu Trường Davos & Phố Wall (Adults)',
        themeClass: 'theme-track-adults',
        icon: '💼',
        accentColor: '#f59e0b',
        lore: 'Đàm phán sinh tử với HĐQT toàn cầu và các trùm tài phiệt!',
      };
    case 'kids':
    default:
      return {
        name: 'Đấu Trường Vệ Thần Cổ Đại (Kids)',
        themeClass: 'theme-track-kids',
        icon: '🔥',
        accentColor: '#ef4444',
        lore: 'Chinh phục 4 Chúa Tể Vệ Thần huyền thoại của vương quốc phép thuật!',
      };
  }
});

// ---------------------------------------------------------------------------
// Store Bindings & Synchronizations
// ---------------------------------------------------------------------------
const sessionState = computed(() => bossRushStore.sessionState);
const bossQueue = computed(() => bossRushStore.bossQueue);
const currentBoss = computed(() => bossRushStore.currentBoss);
const currentBossIndex = computed(() => bossRushStore.currentBossIndex);
const sharedHp = computed(() => bossRushStore.sharedHp);
const isPreviewMode = computed(() => bossRushStore.isPreviewMode);
const activeModifiedStage = computed(() => bossRushStore.activeModifiedStage);
const runResult = computed(() => bossRushStore.runResult);
const introCountdownSeconds = computed(() => bossRushStore.introCountdownSeconds);
const formattedElapsedTime = computed(() => bossRushStore.formattedElapsedTime);
const isLoadingStages = computed(() => bossRushStore.isLoadingStages);
const loadErrorMessage = computed(() => bossRushStore.loadErrorMessage);
const isTrackUnlocked = computed(() => bossRushStore.isTrackUnlocked);
const userTrackBestRecord = computed(() => bossRushStore.userTrackBestRecord);

// Synchronize mini-game damage back into shared HP
watch(
  () => sessionStore.health,
  (newHealth) => {
    if (bossRushStore.sessionState === 'in_battle' && newHealth < bossRushStore.sharedHp) {
      bossRushStore.takeSharedDamage(bossRushStore.sharedHp - newHealth);
    }
  }
);

// Synchronize answers log into cumulative accuracy & score tracker
watch(
  () => sessionStore.answersLog.length,
  (newLen, oldLen) => {
    if (newLen > oldLen) {
      const latest = sessionStore.answersLog[newLen - 1];
      if (latest) {
        bossRushStore.recordAnswerAttempt(latest.isCorrect, latest.scoreAwarded || 100);
      }
    }
  }
);

// Mini-game progression steps
function onAlchemyStepCompleted(): void {
  playSound('correct');
  sessionStore.advancePhase('voice_runner');
}

function onVoiceStepCompleted(): void {
  playSound('correct');
  sessionStore.advancePhase('sentence_lock');
}

function onSentenceStepCompleted(): void {
  playSound('correct');
  if (bossRushStore.activeModifiedStage?.aiRoleplayMission) {
    sessionStore.advancePhase('ai_roleplay');
  } else {
    bossRushStore.handleCurrentBossDefeated();
  }
}

function onAiRoleplayStepCompleted(): void {
  playSound('correct');
  bossRushStore.handleCurrentBossDefeated();
}

function onMiniGameFailed(): void {
  bossRushStore.takeSharedDamage(1);
}

// ---------------------------------------------------------------------------
// Exit & Navigation Controls
// ---------------------------------------------------------------------------
function confirmExit(): void {
  bossRushStore.showExitConfirmModal = true;
}

function cancelExit(): void {
  bossRushStore.showExitConfirmModal = false;
}

function proceedExit(): void {
  bossRushStore.abortRunToPortal();
}

function returnToMap(): void {
  void router.push('/');
}

// ---------------------------------------------------------------------------
// Colosseum Leaderboard (Task 3.4)
// ---------------------------------------------------------------------------
const showLeaderboardModal = ref(false);
const selectedLeaderboardTrack = ref<WorldTrack>(currentTrack.value);

function openLeaderboard(track?: WorldTrack): void {
  selectedLeaderboardTrack.value = track || currentTrack.value;
  showLeaderboardModal.value = true;
  void bossRushStore.fetchColosseumLeaderboard(selectedLeaderboardTrack.value);
}

function switchLeaderboardTrack(track: WorldTrack): void {
  selectedLeaderboardTrack.value = track;
  void bossRushStore.fetchColosseumLeaderboard(track);
}

function closeLeaderboard(): void {
  showLeaderboardModal.value = false;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
onMounted(() => {
  void bossRushStore.loadBossStages(currentTrack.value);
});

watch(currentTrack, (newTrack) => {
  void bossRushStore.loadBossStages(newTrack);
});

onUnmounted(() => {
  bossRushStore.clearAllTimers();
});
</script>

<template>
  <div class="boss-rush-page" :class="trackThemeMeta.themeClass">
    <!-- Exit Confirmation Modal -->
    <div v-if="bossRushStore.showExitConfirmModal" class="modal-backdrop">
      <div class="modal-card theme-card">
        <h3 class="modal-title">Rút Lui Khỏi Đấu Trường?</h3>
        <p class="modal-desc">
          Rời khỏi đấu trường sẽ hủy bỏ lượt đánh hiện tại và Shared HP của bạn sẽ bị tính là thất bại.
        </p>
        <div class="modal-actions">
          <button class="btn-cancel" type="button" @click="cancelExit">
            Tiếp Tục Đấu
          </button>
          <button class="btn-confirm-exit" type="button" @click="proceedExit">
            Xác Nhận Rút Lui
          </button>
        </div>
      </div>
    </div>

    <!-- Leaderboard Modal (Task 3.4) -->
    <div
      v-if="showLeaderboardModal"
      class="modal-backdrop leaderboard-backdrop"
      @click.self="closeLeaderboard"
    >
      <div class="modal-card theme-card leaderboard-modal-card">
        <div class="leaderboard-header">
          <div class="leaderboard-title-group">
            <h3 class="leaderboard-modal-title">🏆 BẢNG XẾP HẠNG ĐẤU TRƯỜNG</h3>
            <p class="leaderboard-modal-sub">
              Top 10 Thần Tốc Phá Đảo Colosseum • Dual-Layer SWR Caching
            </p>
          </div>
          <button
            class="modal-close-icon"
            type="button"
            title="Đóng"
            @click="closeLeaderboard"
          >
            ✕
          </button>
        </div>

        <!-- Track Selector in Modal -->
        <div class="leaderboard-track-tabs">
          <button
            v-for="t in validTracks"
            :key="t"
            type="button"
            class="tab-pill"
            :class="{ active: selectedLeaderboardTrack === t }"
            @click="switchLeaderboardTrack(t)"
          >
            {{ t === 'kids' ? '🔥 Kids' : t === 'teens' ? '⚡ Teens' : '💼 Adults' }}
          </button>
        </div>

        <!-- Leaderboard Body -->
        <div v-if="bossRushStore.isLoadingLeaderboard" class="leaderboard-loading">
          <div class="spinner" />
          <span>Đang tải bảng xếp hạng Đấu Trường...</span>
        </div>
        <div v-else-if="bossRushStore.leaderboardError" class="error-box">
          <span>{{ bossRushStore.leaderboardError }}</span>
        </div>
        <div
          v-else-if="!bossRushStore.colosseumLeaderboard || bossRushStore.colosseumLeaderboard.length === 0"
          class="empty-leaderboard"
        >
          <span>Chưa có Chiến Thần nào ghi danh. Hãy là người đầu tiên!</span>
        </div>
        <div v-else class="leaderboard-list">
          <div
            v-for="entry in bossRushStore.colosseumLeaderboard"
            :key="entry.rank"
            class="leaderboard-item"
            :class="{
              'rank-top-1': entry.rank === 1,
              'rank-top-2': entry.rank === 2,
              'rank-top-3': entry.rank === 3,
            }"
          >
            <!-- Rank Column -->
            <div class="rank-col">
              <span v-if="entry.rank === 1" class="rank-medal gold">🥇 1</span>
              <span v-else-if="entry.rank === 2" class="rank-medal silver">🥈 2</span>
              <span v-else-if="entry.rank === 3" class="rank-medal bronze">🥉 3</span>
              <span v-else class="rank-medal normal">#{{ entry.rank }}</span>
            </div>

            <!-- Avatar & Player Info -->
            <div class="player-col">
              <div class="player-avatar-circle">
                {{ entry.avatar || '👤' }}
              </div>
              <div class="player-name-wrap">
                <span class="player-name">{{ entry.displayName }}</span>
                <span v-if="entry.equippedTitle" class="player-title-badge">
                  👑 {{ entry.equippedTitle === 'title_boss_slayer' ? 'Vua Đấu Trường' : entry.equippedTitle === 'title_multiverse_champion' ? 'Bá Chủ Đa Vũ Trụ' : entry.equippedTitle }}
                </span>
              </div>
            </div>

            <!-- Stats: Bosses, Time, Score -->
            <div class="stats-col">
              <div class="stat-cell time-cell" title="Thời gian phá đảo">
                ⏱️ {{ entry.formattedTime }}
              </div>
              <div class="stat-cell score-cell" title="Điểm số kỷ lục">
                ⭐ {{ entry.bestScore.toLocaleString('vi-VN') }}
              </div>
            </div>
          </div>
        </div>

        <div class="leaderboard-footer">
          <button class="btn-cancel" type="button" @click="closeLeaderboard">
            Đóng
          </button>
        </div>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- 1. PORTAL GATE (Entry & Rules Overview)                             -->
    <!-- =================================================================== -->
    <section v-if="sessionState === 'portal_gate'" class="portal-gate-view">
      <!-- Top Header Navigation -->
      <div class="gate-top-nav">
        <button class="back-link-btn" type="button" @click="returnToMap">
          ← Về Bản Đồ
        </button>
        <button class="btn-view-leaderboard-pill" type="button" @click="openLeaderboard(currentTrack)">
          🏆 Bảng Xếp Hạng
        </button>
        <div class="track-switcher-pills">
          <NuxtLink
            v-for="t in validTracks"
            :key="t"
            :to="`/play/boss-rush/${t}`"
            class="track-nav-pill"
            :class="{ active: currentTrack === t }"
          >
            {{ t === 'kids' ? '🔥 Kids' : t === 'teens' ? '⚡ Teens' : '💼 Adults' }}
          </NuxtLink>
        </div>
      </div>

      <!-- Main Colosseum Portal Hero -->
      <div class="portal-hero-card theme-card">
        <div class="colosseum-emblem" aria-hidden="true">
          {{ trackThemeMeta.icon }}
        </div>
        <div class="hero-header-text">
          <span class="arena-tag">ENDGAME COLOSSEUM</span>
          <h1 class="colosseum-title">{{ trackThemeMeta.name }}</h1>
          <p class="colosseum-lore">{{ trackThemeMeta.lore }}</p>
        </div>

        <!-- Lock Status Alert -->
        <div v-if="!isTrackUnlocked" class="lock-status-alert">
          <div class="lock-icon" aria-hidden="true">🔒</div>
          <div class="lock-info">
            <h2 class="lock-title">CỔNG ĐẤU TRƯỜNG ĐANG KHÓA</h2>
            <p class="lock-desc">
              Cần hoàn thành toàn bộ 20 chặng của vũ trụ này để mở khóa Đấu Trường Sinh Tử chính thức.
            </p>
            <div class="progress-bar-wrap">
              <div
                class="progress-bar-fill"
                :style="{
                  width: `${Math.min(100, Math.round(((userStore.user.progress.tracks[currentTrack]?.unlockedStage || 1) / 20) * 100))}%`
                }"
              />
            </div>
            <span class="progress-label">
              Tiến độ: {{ Math.min(20, userStore.user.progress.tracks[currentTrack]?.unlockedStage || 1) }}/20 chặng
            </span>
          </div>
        </div>

        <div v-else class="unlocked-status-alert">
          <span class="unlock-icon" aria-hidden="true">🔓</span>
          <span>ĐẤU TRƯỜNG ĐÃ MỞ KHÓA — SẴN SÀNG KHIÊU CHIẾN!</span>
        </div>

        <!-- Track Best Record Banner -->
        <div v-if="userTrackBestRecord && userTrackBestRecord.bestScore > 0" class="best-record-bar">
          <div class="record-item">
            <span class="lbl">Kỷ Lục Điểm</span>
            <span class="val">⭐ {{ userTrackBestRecord.bestScore.toLocaleString('vi-VN') }}</span>
          </div>
          <div class="record-item">
            <span class="lbl">Bosses Đã Hạ</span>
            <span class="val">⚔️ {{ userTrackBestRecord.bossesDefeated }}/4</span>
          </div>
          <div class="record-item">
            <span class="lbl">Trạng Thái</span>
            <span class="val status-cleared">
              {{ userTrackBestRecord.isCleared ? '🏆 Đã Phá Đảo' : '⚔️ Đang Chinh Phục' }}
            </span>
          </div>
        </div>

        <!-- Hardcore Modifiers Overview Grid -->
        <div class="modifiers-section">
          <h2 class="section-title">QUY TẮC SINH TỬ (HARDCORE MODIFIERS)</h2>
          <div class="modifiers-grid">
            <div
              v-for="badge in activeModifierBadges"
              :key="badge.id"
              class="modifier-card"
            >
              <span class="mod-icon">{{ badge.icon }}</span>
              <div class="mod-text">
                <strong>{{ badge.title }}</strong>
                <span>{{ badge.description }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 4 Continuous Bosses List -->
        <div class="bosses-lineup-section">
          <h2 class="section-title">DANH SÁCH 4 ĐẠI BOSS LIÊN HOÀN</h2>
          <div v-if="isLoadingStages" class="loading-box">
            <div class="spinner" />
            <span>Đang nạp dữ liệu Bosses...</span>
          </div>
          <div v-else-if="loadErrorMessage" class="error-box">
            <span>{{ loadErrorMessage }}</span>
          </div>
          <div v-else class="bosses-grid">
            <div
              v-for="(boss, idx) in bossQueue"
              :key="boss.stageId"
              class="boss-card-preview"
            >
              <div class="boss-preview-badge">Boss {{ idx + 1 }}/4</div>
              <div class="boss-preview-avatar">{{ boss.npcAvatarEmoji }}</div>
              <h3 class="boss-preview-name">{{ boss.npcName }}</h3>
              <span class="boss-preview-stage">Chặng {{ boss.stageId }} • {{ boss.title }}</span>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="gate-actions">
          <button
            v-if="isTrackUnlocked"
            class="theme-btn-primary enter-arena-btn"
            type="button"
            :disabled="isLoadingStages"
            @click="bossRushStore.startColosseumRun(currentTrack, false)"
          >
            ⚔️ TIẾN VÀO ĐẤU TRƯỜNG NGAY
          </button>
          <button
            v-else
            class="preview-arena-btn"
            type="button"
            :disabled="isLoadingStages"
            @click="bossRushStore.startColosseumRun(currentTrack, true)"
          >
            ⚡ Chơi Thử Nghiệm (Preview Mode)
          </button>
        </div>
      </div>
    </section>

    <!-- =================================================================== -->
    <!-- 2. BOSS INTRO CINEMATIC (Pre-battle cutscene)                       -->
    <!-- =================================================================== -->
    <section v-else-if="sessionState === 'boss_intro' && currentBoss" class="boss-intro-view">
      <div class="intro-dialog-card theme-card animate-pulse">
        <div class="intro-top-tag">
          ⚔️ ĐẠI BOSS {{ currentBossIndex + 1 }}/4 • CHẶNG {{ currentBoss.stageId }}
        </div>
        <div class="intro-avatar-big" aria-hidden="true">
          {{ currentBoss.npcAvatarEmoji }}
        </div>
        <h1 class="intro-boss-name">{{ currentBoss.npcName }}</h1>
        <h2 class="intro-boss-title">{{ currentBoss.title }}</h2>

        <div class="intro-quote-box">
          <p class="intro-quote">
            "{{ currentBoss.introQuote || 'Ngươi có đủ dũng khí đối đầu với ta?' }}"
          </p>
        </div>

        <div class="intro-countdown-wrap">
          <span class="countdown-text">Vào trận sau {{ introCountdownSeconds }}s...</span>
        </div>

        <button class="theme-btn-primary fight-now-btn" type="button" @click="bossRushStore.launchBossBattle">
          CHIẾN ĐẤU NGAY ⚔️
        </button>
      </div>
    </section>

    <!-- =================================================================== -->
    <!-- 3. IN BATTLE (HUD + Active Mini-games with shared HP)              -->
    <!-- =================================================================== -->
    <section v-else-if="sessionState === 'in_battle' && activeModifiedStage && currentBoss" class="in-battle-view">
      <!-- Persistent Arena Top HUD -->
      <header class="arena-hud-bar theme-card">
        <!-- Left: Track & Exit -->
        <div class="hud-left">
          <button class="exit-btn" type="button" title="Rút lui" @click="confirmExit">
            ✕ Rút Lui
          </button>
          <div class="hud-track-badge">
            <span class="hud-track-icon">{{ trackThemeMeta.icon }}</span>
            <span class="hud-track-name">Boss {{ currentBossIndex + 1 }}/4: {{ currentBoss.npcName }}</span>
          </div>
        </div>

        <!-- Center: Mini-Game Phase Stepper -->
        <div class="hud-center-stepper">
          <span
            class="stepper-node"
            :class="{ active: sessionStore.phase === 'word_alchemy', done: sessionStore.phase !== 'word_alchemy' }"
          >
            1. Ghép Thẻ
          </span>
          <span class="stepper-arrow">→</span>
          <span
            class="stepper-node"
            :class="{
              active: sessionStore.phase === 'voice_runner',
              done: sessionStore.phase === 'sentence_lock' || sessionStore.phase === 'ai_roleplay'
            }"
          >
            2. Giọng Nói
          </span>
          <span class="stepper-arrow">→</span>
          <span
            class="stepper-node"
            :class="{
              active: sessionStore.phase === 'sentence_lock',
              done: sessionStore.phase === 'ai_roleplay'
            }"
          >
            3. Khóa Cổ Ngữ
          </span>
          <template v-if="activeModifiedStage.aiRoleplayMission">
            <span class="stepper-arrow">→</span>
            <span
              class="stepper-node"
              :class="{ active: sessionStore.phase === 'ai_roleplay' }"
            >
              4. Đối Thoại AI
            </span>
          </template>
        </div>

        <!-- Right: Shared 3 HP & Timer & Score -->
        <div class="hud-right">
          <!-- Shared 3 Hearts -->
          <div class="shared-hp-group" title="Shared HP còn lại">
            <span
              v-for="h in BOSS_RUSH_HARDCORE_MODIFIERS.sharedMaxHp"
              :key="h"
              class="heart-icon"
              :class="{ active: h <= sharedHp, empty: h > sharedHp }"
            >
              {{ h <= sharedHp ? '❤️' : '🖤' }}
            </span>
          </div>

          <!-- Total Stopwatch -->
          <div class="stopwatch-display" title="Tổng thời gian thực">
            ⏱️ {{ formattedElapsedTime }}
          </div>

          <!-- Score -->
          <div class="score-display" title="Điểm tích lũy">
            ⭐ {{ sessionStore.score }}
          </div>
        </div>
      </header>

      <!-- Active Hardcore Modifiers Banner -->
      <div class="hardcore-hud-strip">
        <span
          v-for="badge in activeModifierBadges"
          :key="badge.id"
          class="strip-pill"
        >
          {{ badge.icon }} {{ badge.shortLabel }}
        </span>
        <span v-if="isPreviewMode" class="strip-pill preview-badge">⚡ Preview Mode</span>
      </div>

      <!-- Mini-Game Component Slot -->
      <main class="battle-component-container">
        <!-- 1. Word Alchemy with extra vocab pick -->
        <GameWordAlchemy
          v-if="sessionStore.phase === 'word_alchemy'"
          :stage="activeModifiedStage"
          @completed="onAlchemyStepCompleted"
          @failed="onMiniGameFailed"
        />

        <!-- 2. Voice Runner with stricter threshold & reduced time -->
        <GameVoiceRunner
          v-else-if="sessionStore.phase === 'voice_runner'"
          :stage="activeModifiedStage"
          @completed="onVoiceStepCompleted"
          @failed="onMiniGameFailed"
        />

        <!-- 3. Sentence Lock with reduced time -->
        <GameSentenceLock
          v-else-if="sessionStore.phase === 'sentence_lock'"
          :stage="activeModifiedStage"
          @completed="onSentenceStepCompleted"
          @failed="onMiniGameFailed"
        />

        <!-- 4. AI Roleplay with hidden starter chips -->
        <GameAiRoleplay
          v-else-if="sessionStore.phase === 'ai_roleplay'"
          :stage="activeModifiedStage"
          :hide-starter-chips="true"
          @completed="onAiRoleplayStepCompleted"
          @failed="onMiniGameFailed"
        />
      </main>
    </section>

    <!-- =================================================================== -->
    <!-- 4. BOSS CLEARED INTERMISSION (Between bosses)                       -->
    <!-- =================================================================== -->
    <section v-else-if="sessionState === 'boss_cleared' && currentBoss" class="boss-cleared-view">
      <div class="intermission-card theme-card">
        <div class="cleared-badge">⚔️ HẠ GỤC BOSS THÀNH CÔNG!</div>
        <div class="boss-avatar-cleared" aria-hidden="true">
          {{ bossQueue[currentBossIndex - 1]?.npcAvatarEmoji || '👑' }}
        </div>
        <h1 class="cleared-boss-name">
          {{ bossQueue[currentBossIndex - 1]?.npcName }} ĐÃ BỊ ĐÁNH BẠI!
        </h1>
        <p class="cleared-subtext">
          Bạn đã vượt qua {{ currentBossIndex }}/4 Đại Boss của Đấu Trường!
        </p>

        <!-- Retained HP Warning -->
        <div class="hp-retained-box">
          <span class="hp-label">MÁU BẢO TOÀN CHO TRẬN KẾ TIẾP:</span>
          <div class="hp-hearts">
            <span
              v-for="h in BOSS_RUSH_HARDCORE_MODIFIERS.sharedMaxHp"
              :key="h"
              class="heart-icon"
              :class="{ active: h <= sharedHp, empty: h > sharedHp }"
            >
              {{ h <= sharedHp ? '❤️' : '🖤' }}
            </span>
          </div>
          <span class="hp-warn-note">⚠️ Cảnh báo: Máu không được hồi phục giữa các trận!</span>
        </div>

        <div class="intermission-actions">
          <button class="theme-btn-primary continue-btn" type="button" @click="bossRushStore.prepareCurrentBossIntro">
            TIẾN VÀO BOSS {{ currentBossIndex + 1 }}/4 ({{ currentBoss.npcName }}) ⚔️
          </button>
        </div>
      </div>
    </section>

    <!-- =================================================================== -->
    <!-- 5. CHAMPION VICTORY SCREEN (Defeated all 4 Bosses)                  -->
    <!-- =================================================================== -->
    <section v-else-if="sessionState === 'victory' && runResult" class="victory-view">
      <div class="victory-card theme-card">
        <div class="victory-trophy-icon" aria-hidden="true">🏆</div>
        <h1 class="victory-headline">VÔ ĐỊCH ĐẤU TRƯỜNG SINH TỬ!</h1>
        <p class="victory-subtext">
          Bạn đã hạ gục toàn bộ 4/4 Đại Boss tại {{ trackThemeMeta.name }}!
        </p>

        <!-- Perfect Run Badge -->
        <div v-if="runResult.isPerfect" class="perfect-run-banner">
          ⭐ PERFECT RUN: BẢO TOÀN NGUYÊN VẸN 3/3 TIM MÁU! ⭐
        </div>

        <!-- Detailed Scoring Breakdown -->
        <div class="scoring-card">
          <h2 class="score-breakdown-title">BẢNG TỔNG KẾT ĐIỂM SỐ HOÀNG KIM</h2>
          <div class="score-line">
            <span>4 Đại Boss Bị Hạ Gục (4 × 1,000)</span>
            <strong>+4,000 pts</strong>
          </div>
          <div class="score-line">
            <span>Độ Chính Xác Trung Bình ({{ runResult.accuracyPercent }}% × 10)</span>
            <strong>+{{ runResult.accuracyPercent * 10 }} pts</strong>
          </div>
          <div class="score-line">
            <span>Tim Máu Bảo Toàn ({{ runResult.remainingHP }} ❤️ × 500)</span>
            <strong>+{{ runResult.remainingHP * 500 }} pts</strong>
          </div>
          <div class="score-line">
            <span>Thưởng Tốc Độ ({{ formattedElapsedTime }})</span>
            <strong>+{{ runResult.timeBonus }} pts</strong>
          </div>
          <div class="score-total-line">
            <span>👉 TỔNG ĐIỂM CHUNG CUỘC</span>
            <span class="total-score-val">⭐ {{ runResult.finalScore.toLocaleString('vi-VN') }}</span>
          </div>
        </div>

        <!-- Rewards Showcase -->
        <div class="rewards-showcase">
          <h2 class="rewards-title">PHẦN THƯỞNG MỞ KHÓA</h2>
          <div class="rewards-grid">
            <div class="reward-item">
              <span class="reward-icon">🏆</span>
              <span class="reward-name">Danh hiệu: "Vua Đấu Trường"</span>
            </div>
            <div class="reward-item">
              <span class="reward-icon">👑</span>
              <span class="reward-name">Khung Avatar Hoàng Kim</span>
            </div>
            <div v-if="runResult.isPerfect" class="reward-item mythic-card">
              <span class="reward-icon">⭐</span>
              <span class="reward-name">Thẻ Codex Mythic Exclusive</span>
            </div>
          </div>
        </div>

        <!-- Navigation Buttons -->
        <div class="victory-actions">
          <button class="theme-btn-primary play-again-btn" type="button" @click="bossRushStore.startColosseumRun(currentTrack, false)">
            ⚔️ Khiêu Chiến Lại Lập Kỷ Lục Mới
          </button>
          <button class="btn-view-leaderboard-action" type="button" @click="openLeaderboard(currentTrack)">
            🏆 Bảng Xếp Hạng Top 10
          </button>
          <button class="btn-return-portal" type="button" @click="proceedExit">
            Về Cổng Đấu Trường
          </button>
        </div>
      </div>
    </section>

    <!-- =================================================================== -->
    <!-- 6. DEFEAT SCREEN (HP depleted)                                     -->
    <!-- =================================================================== -->
    <section v-else-if="sessionState === 'defeat' && runResult" class="defeat-view">
      <div class="defeat-card theme-card">
        <div class="defeat-skull-icon" aria-hidden="true">💀</div>
        <h1 class="defeat-headline">BẠN ĐÃ NGÃ XUỐNG TẠI ĐẤU TRƯỜNG</h1>
        <p class="defeat-subtext">
          Đấu trường sinh tử không khoan nhượng. Toàn bộ 3 Tim đã cạn kiệt!
        </p>

        <div class="defeat-stats-box">
          <div class="stat-row">
            <span>Số Boss Đã Hạ:</span>
            <strong>{{ runResult.bossesDefeated }}/4 Bosses</strong>
          </div>
          <div class="stat-row">
            <span>Ngã Xuống Tại:</span>
            <strong>Boss {{ currentBossIndex + 1 }}: {{ currentBoss?.npcName || 'Đại Boss' }}</strong>
          </div>
          <div class="stat-row">
            <span>Thời Gian Trụ Vững:</span>
            <strong>⏱️ {{ formattedElapsedTime }}</strong>
          </div>
          <div class="stat-row">
            <span>Điểm Tích Lũy:</span>
            <strong>⭐ {{ runResult.finalScore.toLocaleString('vi-VN') }}</strong>
          </div>
        </div>

        <div class="defeat-actions">
          <button class="theme-btn-primary retry-btn" type="button" @click="bossRushStore.startColosseumRun(currentTrack, isPreviewMode)">
            ⚔️ Tái Đấu Ngay Lập Tức
          </button>
          <button class="btn-view-leaderboard-action" type="button" @click="openLeaderboard(currentTrack)">
            🏆 Xem Bảng Xếp Hạng
          </button>
          <button class="btn-return-portal" type="button" @click="proceedExit">
            Rút Lui Về Cổng
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.boss-rush-page {
  min-height: 100vh;
  padding: 1.5rem 1rem 3rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: var(--color-bg-primary, #0f172a);
  color: var(--color-text-primary, #f8fafc);
  font-family: inherit;
}

/* Modals */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-card {
  max-width: 440px;
  width: 100%;
  padding: 1.5rem;
  border-radius: 1rem;
  background: #1e293b;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #f87171;
  margin-bottom: 0.75rem;
}

.modal-desc {
  font-size: 0.95rem;
  color: #cbd5e1;
  margin-bottom: 1.25rem;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.btn-cancel,
.btn-confirm-exit {
  padding: 0.6rem 1.25rem;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
}

.btn-cancel {
  background: #334155;
  color: #f1f5f9;
}

.btn-confirm-exit {
  background: #ef4444;
  color: #ffffff;
}

/* 1. PORTAL GATE STYLES */
.portal-gate-view {
  max-width: 860px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.gate-top-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.back-link-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #94a3b8;
  padding: 0.4rem 0.85rem;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.back-link-btn:hover {
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.5);
}

.track-switcher-pills {
  display: flex;
  gap: 0.5rem;
}

.track-nav-pill {
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
  background: #1e293b;
  color: #94a3b8;
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s;
}

.track-nav-pill.active {
  background: #3b82f6;
  color: #ffffff;
  border-color: #60a5fa;
}

.portal-hero-card {
  padding: 2rem 1.5rem;
  border-radius: 1.25rem;
  background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1.5rem;
}

.colosseum-emblem {
  font-size: 3.5rem;
  line-height: 1;
}

.arena-tag {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  color: #f59e0b;
  text-transform: uppercase;
}

.colosseum-title {
  font-size: 1.75rem;
  font-weight: 800;
  margin: 0.25rem 0 0.5rem;
  background: linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.colosseum-lore {
  font-size: 0.95rem;
  color: #94a3b8;
  max-width: 580px;
  margin: 0 auto;
}

/* Lock Status Alert */
.lock-status-alert {
  width: 100%;
  display: flex;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: 0.75rem;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  text-align: left;
  align-items: center;
}

.lock-icon {
  font-size: 2rem;
}

.lock-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #f87171;
  margin: 0 0 0.25rem;
}

.lock-desc {
  font-size: 0.85rem;
  color: #fca5a5;
  margin: 0 0 0.5rem;
}

.progress-bar-wrap {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 9999px;
  overflow: hidden;
  margin-bottom: 0.25rem;
}

.progress-bar-fill {
  height: 100%;
  background: #f87171;
  transition: width 0.3s;
}

.progress-label {
  font-size: 0.75rem;
  color: #fca5a5;
  font-weight: 600;
}

.unlocked-status-alert {
  padding: 0.6rem 1.25rem;
  border-radius: 9999px;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.4);
  color: #34d399;
  font-size: 0.85rem;
  font-weight: 700;
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.best-record-bar {
  width: 100%;
  display: flex;
  justify-content: space-around;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.record-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.record-item .lbl {
  font-size: 0.75rem;
  color: #94a3b8;
}

.record-item .val {
  font-size: 0.95rem;
  font-weight: 700;
  color: #f8fafc;
}

/* Modifiers Section */
.modifiers-section,
.bosses-lineup-section {
  width: 100%;
  text-align: left;
}

.section-title {
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #94a3b8;
  margin-bottom: 0.75rem;
}

.modifiers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.modifier-card {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.6rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  align-items: flex-start;
}

.mod-icon {
  font-size: 1.4rem;
}

.mod-text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.mod-text strong {
  font-size: 0.85rem;
  color: #f8fafc;
}

.mod-text span {
  font-size: 0.75rem;
  color: #94a3b8;
  line-height: 1.3;
}

/* Bosses Lineup */
.bosses-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 0.75rem;
}

.boss-card-preview {
  padding: 1rem 0.75rem;
  border-radius: 0.75rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.4rem;
}

.boss-preview-badge {
  font-size: 0.7rem;
  font-weight: 700;
  color: #f59e0b;
  text-transform: uppercase;
}

.boss-preview-avatar {
  font-size: 2.2rem;
  line-height: 1;
  margin: 0.25rem 0;
}

.boss-preview-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: #f8fafc;
  margin: 0;
}

.boss-preview-stage {
  font-size: 0.75rem;
  color: #94a3b8;
}

/* Gate Actions */
.gate-actions {
  display: flex;
  gap: 1rem;
  width: 100%;
  justify-content: center;
}

.enter-arena-btn,
.preview-arena-btn {
  padding: 0.85rem 2rem;
  border-radius: 0.75rem;
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
  border: none;
  transition: transform 0.2s, box-shadow 0.2s;
}

.enter-arena-btn {
  background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
  color: #ffffff;
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
}

.enter-arena-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(239, 68, 68, 0.6);
}

.preview-arena-btn {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #ffffff;
  box-shadow: 0 4px 15px rgba(245, 158, 11, 0.35);
}

.preview-arena-btn:hover {
  transform: translateY(-2px);
}

/* 2. BOSS INTRO STYLES */
.boss-intro-view {
  min-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 580px;
}

.intro-dialog-card {
  width: 100%;
  padding: 2.5rem 1.5rem;
  border-radius: 1.25rem;
  background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%);
  border: 2px solid #ef4444;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 0 40px rgba(239, 68, 68, 0.3);
}

.intro-top-tag {
  font-size: 0.8rem;
  font-weight: 800;
  color: #ef4444;
  letter-spacing: 0.1em;
}

.intro-avatar-big {
  font-size: 4.5rem;
  line-height: 1;
}

.intro-boss-name {
  font-size: 1.6rem;
  font-weight: 800;
  color: #f8fafc;
  margin: 0;
}

.intro-boss-title {
  font-size: 1rem;
  color: #94a3b8;
  margin: 0;
}

.intro-quote-box {
  background: rgba(0, 0, 0, 0.35);
  border-left: 3px solid #ef4444;
  padding: 0.85rem 1rem;
  border-radius: 0.5rem;
  max-width: 440px;
}

.intro-quote {
  font-style: italic;
  font-size: 0.95rem;
  color: #e2e8f0;
  margin: 0;
}

.intro-countdown-wrap {
  font-size: 0.85rem;
  color: #fca5a5;
  font-weight: 600;
}

.fight-now-btn {
  padding: 0.75rem 2rem;
  font-size: 1rem;
  font-weight: 800;
  border-radius: 0.5rem;
  background: #ef4444;
  color: #ffffff;
  border: none;
  cursor: pointer;
}

/* 3. IN BATTLE HUD */
.in-battle-view {
  width: 100%;
  max-width: 940px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.arena-hud-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.1);
  gap: 0.75rem;
  flex-wrap: wrap;
}

.hud-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.exit-btn {
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  padding: 0.3rem 0.65rem;
  border-radius: 0.4rem;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.hud-track-badge {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: #f8fafc;
}

.hud-center-stepper {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.stepper-node {
  color: #64748b;
  padding: 0.2rem 0.4rem;
  border-radius: 0.3rem;
}

.stepper-node.active {
  color: #ffffff;
  background: #3b82f6;
}

.stepper-node.done {
  color: #34d399;
}

.stepper-arrow {
  color: #475569;
}

.hud-right {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.shared-hp-group {
  display: flex;
  gap: 0.2rem;
  font-size: 1.15rem;
}

.heart-icon.empty {
  opacity: 0.3;
}

.stopwatch-display,
.score-display {
  font-size: 0.85rem;
  font-weight: 700;
  color: #f8fafc;
  background: rgba(0, 0, 0, 0.25);
  padding: 0.25rem 0.55rem;
  border-radius: 0.4rem;
}

.hardcore-hud-strip {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.strip-pill {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.preview-badge {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
  border-color: rgba(245, 158, 11, 0.4);
}

.battle-component-container {
  width: 100%;
}

/* 4. BOSS CLEARED INTERMISSION */
.boss-cleared-view {
  min-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 560px;
}

.intermission-card {
  width: 100%;
  padding: 2.5rem 1.5rem;
  border-radius: 1.25rem;
  background: #1e293b;
  border: 2px solid #34d399;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 0 35px rgba(52, 211, 153, 0.25);
}

.cleared-badge {
  font-size: 0.8rem;
  font-weight: 800;
  color: #34d399;
  letter-spacing: 0.1em;
}

.boss-avatar-cleared {
  font-size: 4rem;
  line-height: 1;
}

.cleared-boss-name {
  font-size: 1.5rem;
  font-weight: 800;
  color: #f8fafc;
  margin: 0;
}

.cleared-subtext {
  font-size: 0.95rem;
  color: #94a3b8;
  margin: 0;
}

.hp-retained-box {
  background: rgba(0, 0, 0, 0.3);
  padding: 1rem;
  border-radius: 0.75rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.hp-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #cbd5e1;
}

.hp-hearts {
  font-size: 1.5rem;
  display: flex;
  gap: 0.35rem;
}

.hp-warn-note {
  font-size: 0.75rem;
  color: #f87171;
  font-style: italic;
}

.continue-btn {
  padding: 0.85rem 1.75rem;
  font-size: 1rem;
  font-weight: 800;
  border-radius: 0.5rem;
  background: #10b981;
  color: #ffffff;
  border: none;
  cursor: pointer;
}

/* 5. VICTORY VIEW */
.victory-view {
  width: 100%;
  max-width: 640px;
  display: flex;
  justify-content: center;
}

.victory-card {
  width: 100%;
  padding: 2.5rem 1.5rem;
  border-radius: 1.25rem;
  background: radial-gradient(circle at top, #1e293b 0%, #0f172a 100%);
  border: 2px solid #f59e0b;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  box-shadow: 0 0 45px rgba(245, 158, 11, 0.35);
}

.victory-trophy-icon {
  font-size: 4.5rem;
  line-height: 1;
}

.victory-headline {
  font-size: 1.8rem;
  font-weight: 900;
  margin: 0;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.victory-subtext {
  font-size: 0.95rem;
  color: #cbd5e1;
  margin: 0;
}

.perfect-run-banner {
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  background: linear-gradient(90deg, #f59e0b 0%, #ef4444 100%);
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.scoring-card {
  width: 100%;
  padding: 1.25rem;
  border-radius: 0.75rem;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  text-align: left;
}

.score-breakdown-title {
  font-size: 0.8rem;
  font-weight: 800;
  color: #f59e0b;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}

.score-line {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: #cbd5e1;
}

.score-total-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.95rem;
  font-weight: 800;
  color: #f8fafc;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
}

.total-score-val {
  font-size: 1.2rem;
  color: #f59e0b;
}

.rewards-showcase {
  width: 100%;
  text-align: left;
}

.rewards-title {
  font-size: 0.8rem;
  font-weight: 800;
  color: #94a3b8;
  margin-bottom: 0.5rem;
}

.rewards-grid {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.reward-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.8rem;
  font-weight: 700;
  color: #f8fafc;
}

.reward-item.mythic-card {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.victory-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
}

.play-again-btn {
  padding: 0.8rem 1.75rem;
  font-weight: 800;
  border-radius: 0.5rem;
  background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
  color: #ffffff;
  border: none;
  cursor: pointer;
}

.btn-return-portal {
  padding: 0.8rem 1.5rem;
  font-weight: 700;
  border-radius: 0.5rem;
  background: #334155;
  color: #f1f5f9;
  border: none;
  cursor: pointer;
}

/* 6. DEFEAT VIEW */
.defeat-view {
  width: 100%;
  max-width: 540px;
  display: flex;
  justify-content: center;
}

.defeat-card {
  width: 100%;
  padding: 2.5rem 1.5rem;
  border-radius: 1.25rem;
  background: radial-gradient(circle at center, #1e1b1e 0%, #0f172a 100%);
  border: 2px solid #ef4444;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  box-shadow: 0 0 35px rgba(239, 68, 68, 0.3);
}

.defeat-skull-icon {
  font-size: 4rem;
  line-height: 1;
}

.defeat-headline {
  font-size: 1.6rem;
  font-weight: 800;
  color: #ef4444;
  margin: 0;
}

.defeat-subtext {
  font-size: 0.95rem;
  color: #cbd5e1;
  margin: 0;
}

.defeat-stats-box {
  width: 100%;
  padding: 1rem;
  border-radius: 0.75rem;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  text-align: left;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: #cbd5e1;
}

.stat-row strong {
  color: #f8fafc;
}

.defeat-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
}

.retry-btn {
  padding: 0.8rem 1.75rem;
  font-weight: 800;
  border-radius: 0.5rem;
  background: #ef4444;
  color: #ffffff;
  border: none;
  cursor: pointer;
}

/* Spinner */
.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Animations */
.animate-pulse {
  animation: pulse-border 2s infinite alternate;
}

@keyframes pulse-border {
  from {
    border-color: rgba(239, 68, 68, 0.4);
  }
  to {
    border-color: rgba(239, 68, 68, 1);
  }
}

/* Track Themes Overrides */
.theme-track-teens .colosseum-title {
  background: linear-gradient(135deg, #c084fc 0%, #818cf8 100%);
  background-clip: text;
  -webkit-background-clip: text;
}

.theme-track-adults .colosseum-title {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  background-clip: text;
  -webkit-background-clip: text;
}

/* ------------------------------------------------------------------------- */
/* 7. COLOSSEUM LEADERBOARD MODAL & BUTTONS (Task 3.4)                       */
/* ------------------------------------------------------------------------- */
.btn-view-leaderboard-pill {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.4);
  color: #fbbf24;
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  transition: all 0.2s ease;
}

.btn-view-leaderboard-pill:hover {
  background: rgba(245, 158, 11, 0.3);
  border-color: #f59e0b;
  transform: translateY(-1px);
}

.btn-view-leaderboard-action {
  padding: 0.8rem 1.5rem;
  font-weight: 700;
  border-radius: 0.5rem;
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
  color: #ffffff;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(217, 119, 6, 0.25);
}

.btn-view-leaderboard-action:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.leaderboard-modal-card {
  max-width: 620px;
  width: 95%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  background: #111827;
  border: 1px solid rgba(245, 158, 11, 0.3);
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.7);
  overflow: hidden;
}

.leaderboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 0.75rem;
}

.leaderboard-title-group {
  text-align: left;
}

.leaderboard-modal-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: #fbbf24;
  margin: 0;
  letter-spacing: 0.03em;
}

.leaderboard-modal-sub {
  font-size: 0.8rem;
  color: #94a3b8;
  margin: 0.2rem 0 0;
}

.modal-close-icon {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
  transition: color 0.2s;
}

.modal-close-icon:hover {
  color: #ffffff;
}

.leaderboard-track-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  justify-content: center;
}

.tab-pill {
  padding: 0.4rem 1rem;
  border-radius: 9999px;
  background: #1f2937;
  color: #9ca3af;
  font-size: 0.85rem;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-pill.active {
  background: #f59e0b;
  color: #111827;
  border-color: #fbbf24;
  font-weight: 700;
}

.leaderboard-loading,
.empty-leaderboard {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2.5rem 1rem;
  color: #94a3b8;
  font-size: 0.95rem;
}

.leaderboard-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  padding-right: 0.25rem;
  max-height: 48vh;
}

.leaderboard-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  border-radius: 0.5rem;
  background: #1f2937;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: transform 0.15s ease;
}

.leaderboard-item:hover {
  transform: translateX(2px);
  background: #283548;
}

.leaderboard-item.rank-top-1 {
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.18) 0%, rgba(31, 41, 55, 0.9) 100%);
  border: 1px solid rgba(245, 158, 11, 0.6);
}

.leaderboard-item.rank-top-2 {
  background: linear-gradient(90deg, rgba(148, 163, 184, 0.18) 0%, rgba(31, 41, 55, 0.9) 100%);
  border: 1px solid rgba(148, 163, 184, 0.5);
}

.leaderboard-item.rank-top-3 {
  background: linear-gradient(90deg, rgba(217, 119, 6, 0.15) 0%, rgba(31, 41, 55, 0.9) 100%);
  border: 1px solid rgba(217, 119, 6, 0.4);
}

.rank-col {
  width: 42px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: 800;
}

.rank-medal {
  font-size: 0.85rem;
  padding: 0.2rem 0.4rem;
  border-radius: 0.35rem;
}

.rank-medal.gold {
  color: #fbbf24;
  font-size: 0.95rem;
}

.rank-medal.silver {
  color: #cbd5e1;
  font-size: 0.95rem;
}

.rank-medal.bronze {
  color: #d97706;
  font-size: 0.95rem;
}

.rank-medal.normal {
  color: #64748b;
  font-size: 0.85rem;
}

.player-col {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex: 1;
  min-width: 0;
  text-align: left;
}

.player-avatar-circle {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #374151;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  flex-shrink: 0;
}

.player-name-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.player-name {
  font-weight: 700;
  font-size: 0.9rem;
  color: #f3f4f6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-title-badge {
  font-size: 0.7rem;
  color: #f59e0b;
  font-weight: 600;
}

.stats-col {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-shrink: 0;
}

.stat-cell {
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 0.35rem;
  background: rgba(0, 0, 0, 0.3);
}

.time-cell {
  color: #60a5fa;
}

.score-cell {
  color: #f59e0b;
  font-weight: 800;
}

.leaderboard-footer {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: flex-end;
}
</style>
