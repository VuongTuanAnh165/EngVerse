/**
 * EngVerse - Boss Rush Colosseum Store (Pinia)
 * Manages the continuous 4-Boss endgame gauntlet loop, shared 3 HP persistence,
 * real-time total elapsed timer, hardcore modifier calculations, and results recording.
 *
 * Strict TypeScript (0 any), memory-leak free, Vue 3.5+ script setup.
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Sprint 9, Task 3.2, 3.3 & Rules.md
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { StageData } from '~/types/game';
import type { WorldTrack } from '~/types/user';
import {
  type BossRushBossItem,
  type BossRushResult,
  type BossRushSessionState,
  BOSS_RUSH_HARDCORE_MODIFIERS,
} from '~/types/bossRush';
import { useUserStore } from './user';
import { useGameSessionStore } from './gameSession';
import { useBossRushModifier } from '~/composables/useBossRushModifier';
import { useSoundEffects } from '~/composables/useSoundEffects';

export const BOSS_STAGE_IDS = [5, 10, 15, 20] as const;

export const BOSS_META_MAP: Record<WorldTrack, Record<number, { npcName: string; emoji: string; introQuote: string }>> = {
  kids: {
    5: { npcName: 'Vệ Thần Đá Cổ Đại', emoji: '🗿', introQuote: 'Kẻ phàm trần nào dám đánh thức giấc ngủ ngàn năm của ta?' },
    10: { npcName: 'Chúa Tể Rồng Bóng Đêm', emoji: '🐉', introQuote: 'Ngọn lửa hắc ám của ta sẽ thiêu rụi mọi ngữ pháp sai sót!' },
    15: { npcName: 'Phượng Hoàng Lửa Thời Gian', emoji: '🦅', introQuote: 'Hãy chứng minh tốc độ tư duy của ngươi trước ngọn lửa vĩnh cửu!' },
    20: { npcName: 'Hoàng Đế Hỗn Mang Leviathan', emoji: '👑', introQuote: 'Ta là điểm tận cùng của thế giới. Hãy thuần phục hoặc bị nuốt chửng!' },
  },
  teens: {
    5: { npcName: 'Trùm Tin Tặc Phantom AI', emoji: '👾', introQuote: 'Hệ thống an ninh của ngươi đã bị xâm nhập. Đối thoại hoặc bị xóa sổ!' },
    10: { npcName: 'Kiến Trúc Sư Nexus', emoji: '🤖', introQuote: 'Mọi thuật toán đều quy phục ta. Ngươi nghĩ mình có thể giải mã?' },
    15: { npcName: 'Bóng Ma Mirage', emoji: '👤', introQuote: 'Trong biển dữ liệu ảo ảnh, một từ sai là rơi vào khoảng trống!' },
    20: { npcName: 'Thực Thể Lượng Tử OMEGA', emoji: '🌐', introQuote: 'Ta nắm giữ mã nguồn vũ trụ. Khả năng ngôn ngữ của ngươi đã đạt ngưỡng tối cao chưa?' },
  },
  adults: {
    5: { npcName: 'Hội Đồng Quản Trị Toàn Cầu', emoji: '💼', introQuote: 'Chào mừng đến phòng họp cổ đông. Hãy bảo vệ dự án của bạn bằng lập luận sắc bén!' },
    10: { npcName: 'Rung Chuông IPO Phố Wall', emoji: '📈', introQuote: 'Thị trường không khoan nhượng cho bất kỳ sự ấp úng nào!' },
    15: { npcName: 'Đập Tan Thâu Tóm Thù Địch', emoji: '⚖️', introQuote: 'Đối thủ đang nắm giữ 49% cổ phần. Bạn có xoay chuyển được bàn cờ?' },
    20: { npcName: 'Diễn Đàn Kinh Tế Davos', emoji: '🏛️', introQuote: 'Cả thế giới đang lắng nghe bài phát biểu then chốt của bạn!' },
  },
};

export const useBossRushStore = defineStore('bossRush', () => {
  const userStore = useUserStore();
  const sessionStore = useGameSessionStore();
  const { playSound, triggerVictoryConfetti, triggerScreenShake } = useSoundEffects();
  const { applyHardcoreModifiers, calculateBossRushScore } = useBossRushModifier();

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const currentTrack = ref<WorldTrack>('kids');
  const sessionState = ref<BossRushSessionState>('portal_gate');
  const isLoadingStages = ref<boolean>(false);
  const loadErrorMessage = ref<string | null>(null);

  // 4 Continuous Bosses in queue
  const bossQueue = ref<BossRushBossItem[]>([]);
  const currentBossIndex = ref<number>(0);

  // Shared HP across all 4 continuous bosses (3 ❤️ maximum, no mid-battle refills)
  const sharedHp = ref<number>(BOSS_RUSH_HARDCORE_MODIFIERS.sharedMaxHp);
  const isPreviewMode = ref<boolean>(false);

  // Active modified stage data applied with Hardcore Modifiers
  const activeModifiedStage = ref<StageData | null>(null);

  // Real-time Total Elapsed Stopwatch
  const totalElapsedMs = ref<number>(0);
  let arenaTimerInterval: ReturnType<typeof setInterval> | null = null;
  let intermissionTimeout: ReturnType<typeof setTimeout> | null = null;
  let introCountdownInterval: ReturnType<typeof setInterval> | null = null;
  const introCountdownSeconds = ref<number>(3);

  // Cumulative Analytics across 4 continuous battles
  const totalQuestionsAnswered = ref<number>(0);
  const totalCorrectAnswers = ref<number>(0);
  const totalScoreAccumulated = ref<number>(0);
  const runResult = ref<BossRushResult | null>(null);
  const showExitConfirmModal = ref<boolean>(false);

  // -------------------------------------------------------------------------
  // Computed Getters
  // -------------------------------------------------------------------------
  const currentBoss = computed<BossRushBossItem | null>(() => {
    return bossQueue.value[currentBossIndex.value] || null;
  });

  const bossesDefeatedCount = computed<number>(() => {
    return bossQueue.value.filter((b) => b.isDefeated).length;
  });

  const isCurrentBossFinal = computed<boolean>(() => {
    return currentBossIndex.value === bossQueue.value.length - 1;
  });

  const overallAccuracy = computed<number>(() => {
    if (totalQuestionsAnswered.value === 0) return 100;
    return Math.round((totalCorrectAnswers.value / totalQuestionsAnswered.value) * 100);
  });

  const formattedElapsedTime = computed<string>(() => {
    const totalSeconds = Math.floor(totalElapsedMs.value / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });

  const isTrackUnlocked = computed<boolean>(() => {
    return userStore.isBossRushUnlocked(currentTrack.value);
  });

  const userTrackBestRecord = computed(() => {
    return userStore.bossRush?.tracks[currentTrack.value] || null;
  });

  // -------------------------------------------------------------------------
  // Core Actions
  // -------------------------------------------------------------------------

  /**
   * Loads 4 Boss stages (Stage 5, 10, 15, 20) for the designated track
   */
  async function loadBossStages(track: WorldTrack): Promise<void> {
    currentTrack.value = track;
    isLoadingStages.value = true;
    loadErrorMessage.value = null;

    try {
      const stages = await $fetch<StageData[]>(`/data/${track}/stages.json`);
      const bossesFound: BossRushBossItem[] = [];

      for (let i = 0; i < BOSS_STAGE_IDS.length; i++) {
        const stageId = BOSS_STAGE_IDS[i];
        if (typeof stageId !== 'number') continue;
        const stageData = stages.find((s) => s.stageId === stageId);

        if (stageData) {
          const meta = BOSS_META_MAP[track]?.[stageId] || {
            npcName: stageData.aiRoleplayMission?.npcName || `Trùm Ải ${stageId}`,
            emoji: '👑',
            introQuote: 'Hãy chứng minh bản lĩnh của ngươi!',
          };

          bossesFound.push({
            bossIndex: i,
            stageId,
            title: stageData.title,
            chapter: String(stageData.chapter || `Ải Boss ${stageId}`),
            npcName: meta.npcName,
            npcAvatarEmoji: meta.emoji,
            introQuote: meta.introQuote,
            stageData,
            isDefeated: false,
          });
        }
      }

      if (bossesFound.length < 4) {
        throw new Error(`Chỉ tìm thấy ${bossesFound.length}/4 Bosses cho vũ trụ ${track}.`);
      }

      bossQueue.value = bossesFound;
    } catch (err: unknown) {
      console.error('[BossRushStore] Failed to load stages:', err);
      loadErrorMessage.value =
        err instanceof Error ? err.message : 'Không thể tải danh sách Boss Đấu Trường.';
    } finally {
      isLoadingStages.value = false;
    }
  }

  /**
   * Initializes a fresh 4-Boss survival run with shared 3 HP
   */
  function startColosseumRun(track: WorldTrack, isForcedPreview = false): void {
    currentTrack.value = track;
    isPreviewMode.value = isForcedPreview;
    currentBossIndex.value = 0;
    sharedHp.value = BOSS_RUSH_HARDCORE_MODIFIERS.sharedMaxHp; // 3 ❤️
    totalElapsedMs.value = 0;
    totalQuestionsAnswered.value = 0;
    totalCorrectAnswers.value = 0;
    totalScoreAccumulated.value = 0;
    runResult.value = null;

    // Reset defeat flags
    bossQueue.value.forEach((b) => {
      b.isDefeated = false;
    });

    // Start Total Stopwatch
    clearAllTimers();
    const startTimestamp = Date.now();
    arenaTimerInterval = setInterval(() => {
      totalElapsedMs.value = Date.now() - startTimestamp;
    }, 200);

    // Transition to Boss 1 Intro
    prepareCurrentBossIntro();
  }

  /**
   * Cinematic countdown intro before facing the Boss
   */
  function prepareCurrentBossIntro(): void {
    sessionState.value = 'boss_intro';
    introCountdownSeconds.value = 3;
    playSound('hit');

    if (introCountdownInterval) clearInterval(introCountdownInterval);
    introCountdownInterval = setInterval(() => {
      introCountdownSeconds.value--;
      if (introCountdownSeconds.value <= 0) {
        if (introCountdownInterval) clearInterval(introCountdownInterval);
        launchBossBattle();
      }
    }, 1000);
  }

  /**
   * Enters the arena fight against the active Boss, binding the shared HP
   */
  function launchBossBattle(): void {
    if (introCountdownInterval) clearInterval(introCountdownInterval);
    const boss = currentBoss.value;
    if (!boss) return;

    // Apply Hardcore Modifiers through useBossRushModifier composable
    const modifiedStage = applyHardcoreModifiers(boss.stageData);
    activeModifiedStage.value = modifiedStage;

    // Initialize Game Session with retained shared HP
    sessionStore.initSession(modifiedStage);
    sessionStore.health = sharedHp.value;
    sessionStore.maxHealth = BOSS_RUSH_HARDCORE_MODIFIERS.sharedMaxHp;
    sessionStore.startSession();

    sessionState.value = 'in_battle';
  }

  /**
   * Deducts 1 Shared HP when player takes damage or fails an obstacle/countdown
   */
  function takeSharedDamage(amount: number = 1): void {
    sharedHp.value = Math.max(0, sharedHp.value - amount);
    sessionStore.health = sharedHp.value;
    playSound('hit');
    triggerScreenShake(sharedHp.value === 0 ? 'heavy' : 'medium');

    if (sharedHp.value <= 0) {
      handleRunDefeat();
    }
  }

  /**
   * Synchronizes an answer logged from the active mini-game
   */
  function recordAnswerAttempt(isCorrect: boolean, scoreDelta: number = 100): void {
    totalQuestionsAnswered.value++;
    if (isCorrect) {
      totalCorrectAnswers.value++;
      totalScoreAccumulated.value += scoreDelta;
    }
  }

  /**
   * Called when all 4 mini-game steps of the current Boss are completed
   */
  function handleCurrentBossDefeated(): void {
    const boss = currentBoss.value;
    if (!boss) return;

    boss.isDefeated = true;
    totalScoreAccumulated.value += 1000;
    playSound('fanfare');
    triggerVictoryConfetti();

    const nextIndex = currentBossIndex.value + 1;

    if (nextIndex >= bossQueue.value.length) {
      // Defeated all 4 Bosses -> Champion Victory!
      handleRunVictory();
    } else {
      // Intermission cutscene before next Boss
      sessionState.value = 'boss_cleared';
      currentBossIndex.value = nextIndex;

      // Auto-advance after 4 seconds
      if (intermissionTimeout) clearTimeout(intermissionTimeout);
      intermissionTimeout = setTimeout(() => {
        prepareCurrentBossIntro();
      }, 4000);
    }
  }

  /**
   * Defeated all 4 Bosses — computes final score & unlocks rewards
   */
  function handleRunVictory(): void {
    if (arenaTimerInterval) clearInterval(arenaTimerInterval);
    sessionState.value = 'victory';
    playSound('fanfare');
    triggerVictoryConfetti();

    const bossesDefeated = 4;
    const accuracy = overallAccuracy.value;
    const remainingHP = Math.max(0, sharedHp.value);

    // Calculate official Colosseum score through useBossRushModifier composable
    const scoreResult = calculateBossRushScore({
      bossesDefeated,
      accuracyPercent: accuracy,
      remainingHP,
      totalTimeMs: totalElapsedMs.value,
    });

    const result: BossRushResult = {
      worldTrack: currentTrack.value,
      bossesDefeated,
      totalTimeMs: totalElapsedMs.value,
      accuracyPercent: accuracy,
      remainingHP,
      timeBonus: scoreResult.timeBonus,
      finalScore: scoreResult.finalScore,
      isCleared: true,
      isPerfect: scoreResult.isPerfect,
      completedAt: Date.now(),
      rewardsUnlocked: {
        titleId: 'title_boss_slayer',
        avatarFrame: 'avatar_frame_gold',
        cardId: scoreResult.isPerfect ? `card_mythic_${currentTrack.value}` : undefined,
      },
    };

    runResult.value = result;
    userStore.recordBossRushRun(result);
  }

  /**
   * Defeat condition when all 3 Shared HP are depleted
   */
  function handleRunDefeat(): void {
    if (arenaTimerInterval) clearInterval(arenaTimerInterval);
    sessionState.value = 'defeat';
    playSound('wrong');
    triggerScreenShake('heavy');

    const bossesDefeated = bossesDefeatedCount.value;
    const accuracy = overallAccuracy.value;
    const finalScore = bossesDefeated * 1000 + accuracy * 10;

    const result: BossRushResult = {
      worldTrack: currentTrack.value,
      bossesDefeated,
      totalTimeMs: totalElapsedMs.value,
      accuracyPercent: accuracy,
      remainingHP: 0,
      timeBonus: 0,
      finalScore,
      isCleared: false,
      isPerfect: false,
      completedAt: Date.now(),
      rewardsUnlocked: {},
    };

    runResult.value = result;
    userStore.recordBossRushRun(result);
  }

  /**
   * Aborts active run and returns to portal gate view
   */
  function abortRunToPortal(): void {
    clearAllTimers();
    sessionState.value = 'portal_gate';
    showExitConfirmModal.value = false;
  }

  function clearAllTimers(): void {
    if (arenaTimerInterval) {
      clearInterval(arenaTimerInterval);
      arenaTimerInterval = null;
    }
    if (intermissionTimeout) {
      clearTimeout(intermissionTimeout);
      intermissionTimeout = null;
    }
    if (introCountdownInterval) {
      clearInterval(introCountdownInterval);
      introCountdownInterval = null;
    }
  }

  return {
    // State
    currentTrack,
    sessionState,
    isLoadingStages,
    loadErrorMessage,
    bossQueue,
    currentBossIndex,
    sharedHp,
    isPreviewMode,
    activeModifiedStage,
    totalElapsedMs,
    introCountdownSeconds,
    totalQuestionsAnswered,
    totalCorrectAnswers,
    totalScoreAccumulated,
    runResult,
    showExitConfirmModal,
    // Getters
    currentBoss,
    bossesDefeatedCount,
    isCurrentBossFinal,
    overallAccuracy,
    formattedElapsedTime,
    isTrackUnlocked,
    userTrackBestRecord,
    // Actions
    applyHardcoreModifiers,
    calculateBossRushScore,
    loadBossStages,
    startColosseumRun,
    prepareCurrentBossIntro,
    launchBossBattle,
    takeSharedDamage,
    recordAnswerAttempt,
    handleCurrentBossDefeated,
    handleRunVictory,
    handleRunDefeat,
    abortRunToPortal,
    clearAllTimers,
  };
});
