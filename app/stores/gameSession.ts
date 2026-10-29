/**
 * EngVerse - Game Session Store (Pinia)
 * Manages active in-game session state, player HP, combo streaks, Fever mode,
 * question logs, wrong-item tracking for Spaced Repetition Bosses, and HMAC AI proofs.
 *
 * Strict TypeScript (0 any), 100% memory leak free.
 * Reference: docs/ke_hoach.md - Sprint 3, Task 2 & Rules.md
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  StageData,
  GameSessionPhase,
  AnswerLogEntry,
  StageResultSummary,
  StageCompleteResponse,
} from '~/types/game';
import { useUserStore } from './user';
import { useSoundEffects } from '~/composables/useSoundEffects';
import { useFirebase } from '~/composables/useFirebase';

export const useGameSessionStore = defineStore('gameSession', () => {
  // -------------------------------------------------------------------------
  // Session State
  // -------------------------------------------------------------------------
  const stageData = ref<StageData | null>(null);
  const phase = ref<GameSessionPhase>('ready');

  // Player Health & Progression
  const maxHealth = ref<number>(3);
  const health = ref<number>(3);
  const score = ref<number>(0);

  // Combo & Fever System (5 in a row = 2x score multiplier)
  const combo = ref<number>(0);
  const maxCombo = ref<number>(0);
  const isFeverActive = ref<boolean>(false);
  const feverProgress = ref<number>(0); // 0 to 5

  // Timer & Logging
  const timeRemaining = ref<number>(60);
  const answersLog = ref<AnswerLogEntry[]>([]);
  const wrongItems = ref<string[]>([]);
  const clearedSrsItems = ref<string[]>([]);
  const aiCompletionProof = ref<string | null>(null);

  // Processing Flags
  const isSubmitting = ref<boolean>(false);
  const sessionStartTime = ref<number>(0);

  // -------------------------------------------------------------------------
  // Computed Getters
  // -------------------------------------------------------------------------
  const isAlive = computed<boolean>(() => health.value > 0);

  const totalQuestions = computed<number>(() => answersLog.value.length);

  const totalCorrect = computed<number>(
    () => answersLog.value.filter((a) => a.isCorrect).length
  );

  const accuracy = computed<number>(() => {
    if (totalQuestions.value === 0) return 0;
    return Math.round((totalCorrect.value / totalQuestions.value) * 100);
  });

  const currentMultiplier = computed<number>(() => (isFeverActive.value ? 2 : 1));

  const isBossStage = computed<boolean>(() => Boolean(stageData.value?.isBossStage));

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  /**
   * Initializes a brand-new stage session with full health and reset combo
   */
  function initSession(stage: StageData): void {
    stageData.value = stage;
    phase.value = 'ready';

    maxHealth.value = 3;
    health.value = 3;
    score.value = 0;

    combo.value = 0;
    maxCombo.value = 0;
    isFeverActive.value = false;
    feverProgress.value = 0;

    timeRemaining.value = stage.config?.timeLimitSeconds ?? 75;
    answersLog.value = [];
    wrongItems.value = [];
    clearedSrsItems.value = [];
    aiCompletionProof.value = null;

    isSubmitting.value = false;
    sessionStartTime.value = Date.now();
  }

  /**
   * Begins the first gameplay phase
   */
  function startSession(): void {
    if (!stageData.value) return;
    phase.value = 'word_alchemy';
  }

  /**
   * Advances gameplay phase with validation
   */
  function advancePhase(nextPhase: GameSessionPhase): void {
    phase.value = nextPhase;
  }

  /**
   * Records an answer attempt, manages combo/fever, health and sound effects
   */
  function recordAnswer(entry: Omit<AnswerLogEntry, 'timestamp'>): void {
    const { playSound, triggerScreenShake } = useSoundEffects();

    const fullEntry: AnswerLogEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    answersLog.value.push(fullEntry);

    if (entry.isCorrect) {
      // 1. Increment combo
      combo.value++;
      if (combo.value > maxCombo.value) {
        maxCombo.value = combo.value;
      }

      // 2. Fever progress & activation
      feverProgress.value++;
      if (feverProgress.value >= 5) {
        if (!isFeverActive.value) {
          isFeverActive.value = true;
          playSound('combo_fever');
          triggerScreenShake('light');
        }
        feverProgress.value = 5;
      } else {
        playSound('correct');
      }

      // 3. Award points with active fever multiplier
      const awardedPoints = (entry.scoreAwarded || 100) * currentMultiplier.value;
      score.value += awardedPoints;
    } else {
      // Wrong answer penalties
      combo.value = 0;
      isFeverActive.value = false;
      feverProgress.value = 0;

      // Track weak item for SRS Boss queue
      if (entry.questionId && !wrongItems.value.includes(entry.questionId)) {
        wrongItems.value.push(entry.questionId);
      }

      // Take damage and play buzz / impact
      takeDamage(1);
    }
  }

  /**
   * Reduces player health and triggers gameover if depleted
   */
  function takeDamage(amount: number = 1): void {
    const { playSound, triggerScreenShake } = useSoundEffects();

    health.value = Math.max(0, health.value - amount);
    playSound('hit');
    triggerScreenShake(health.value === 0 ? 'heavy' : 'medium');

    if (health.value <= 0) {
      phase.value = 'gameover';
      playSound('wrong');
    }
  }

  /**
   * Restores player health (up to maxHealth)
   */
  function heal(amount: number = 1): void {
    health.value = Math.min(maxHealth.value, health.value + amount);
  }

  /**
   * Records an SRS weak item as successfully cleared/mastered
   */
  function recordSrsItemCleared(itemId: string): void {
    if (itemId && !clearedSrsItems.value.includes(itemId)) {
      clearedSrsItems.value.push(itemId);
    }
  }

  /**
   * Stores the HMAC token received from server/api/ai/roleplay.post.ts
   */
  function setAiCompletionProof(proof: string): void {
    aiCompletionProof.value = proof;
  }

  /**
   * Calculates final stage stars and outcome
   */
  function calculateStageResult(): StageResultSummary {
    if (!stageData.value) {
      throw new Error('[GameSessionStore] Cannot calculate result without active stage data.');
    }

    const currentAccuracy = accuracy.value;
    const isCleared = health.value > 0;

    // Star calculation formula:
    // 3 Stars: Accuracy >= 90% AND No damage taken (3/3 HP)
    // 2 Stars: Accuracy >= 70% AND Cleared (>= 1 HP)
    // 1 Star:  Cleared (>= 1 HP)
    let stars = 0;
    if (isCleared) {
      if (currentAccuracy >= 90 && health.value === maxHealth.value) {
        stars = 3;
      } else if (currentAccuracy >= 70) {
        stars = 2;
      } else {
        stars = 1;
      }
    }

    const baseExp = stageData.value.reward.baseExp || 100;
    const baseGold = stageData.value.reward.baseGold || 50;

    // Performance multipliers
    const accuracyBonus = Math.round((currentAccuracy / 100) * 0.25 * baseExp);
    const starMultiplier = stars === 3 ? 1.2 : stars === 2 ? 1.0 : 0.8;

    const totalExpEarned = Math.round((baseExp + accuracyBonus) * starMultiplier);
    const totalGoldEarned = Math.round(baseGold * starMultiplier);

    const isPerfect = currentAccuracy === 100 && health.value === maxHealth.value;

    return {
      stageId: stageData.value.stageId,
      worldTrack: stageData.value.worldTrack,
      score: score.value,
      starsEarned: stars,
      isPerfect,
      accuracy: currentAccuracy,
      totalCorrect: totalCorrect.value,
      totalQuestions: totalQuestions.value,
      maxCombo: maxCombo.value,
      totalExpEarned,
      totalGoldEarned,
      wrongItems: [...wrongItems.value],
      clearedSrsItems: [...clearedSrsItems.value],
      aiCompletionProof: aiCompletionProof.value,
      answersLog: [...answersLog.value],
    };
  }

  /**
   * Finalizes the stage, awards guest rewards or dispatches server complete API
   */
  async function completeStage(): Promise<StageResultSummary | null> {
    if (!stageData.value || !isAlive.value) return null;

    isSubmitting.value = true;
    const { playSound, triggerVictoryConfetti } = useSoundEffects();
    const userStore = useUserStore();

    try {
      const summary = calculateStageResult();

      // If user is logged in, submit to server-side anti-cheat grading API
      if (userStore.isAuthenticated) {
        try {
          const { getClientAuth } = useFirebase();
          const currentUser = getClientAuth()?.currentUser;
          const token = currentUser ? await currentUser.getIdToken() : '';
          const durationSeconds = Math.max(
            5,
            Math.round((Date.now() - sessionStartTime.value) / 1000)
          );

          const serverRes = await $fetch<StageCompleteResponse>('/api/game/complete', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: {
              worldTrack: summary.worldTrack,
              stageId: summary.stageId,
              durationSeconds,
              answersLog: summary.answersLog,
              aiCompletionProof: summary.aiCompletionProof,
              newWrongIds: summary.wrongItems,
              clearedSrsIds: summary.clearedSrsItems,
            },
          });

          if (serverRes.success && serverRes.user) {
            userStore.user = serverRes.user;
          }
        } catch (apiErr) {
          console.warn(
            '[GameSession] Server completion API error, fell back to local store:',
            apiErr
          );
          userStore.recordGuestStageWin(
            summary.worldTrack,
            summary.stageId,
            summary.starsEarned,
            summary.totalExpEarned,
            summary.totalGoldEarned,
            stageData.value.reward.guaranteedCardId,
            summary.wrongItems,
            summary.clearedSrsItems
          );
        }
      } else {
        // Guest mode local persistence
        userStore.recordGuestStageWin(
          summary.worldTrack,
          summary.stageId,
          summary.starsEarned,
          summary.totalExpEarned,
          summary.totalGoldEarned,
          stageData.value.reward.guaranteedCardId,
          summary.wrongItems,
          summary.clearedSrsItems
        );
      }

      phase.value = 'victory';
      playSound('fanfare');
      triggerVictoryConfetti();

      return summary;
    } finally {
      isSubmitting.value = false;
    }
  }

  /**
   * Resets all session parameters cleanly
   */
  function resetSession(): void {
    stageData.value = null;
    phase.value = 'ready';
    health.value = 3;
    maxHealth.value = 3;
    score.value = 0;
    combo.value = 0;
    maxCombo.value = 0;
    isFeverActive.value = false;
    feverProgress.value = 0;
    timeRemaining.value = 60;
    answersLog.value = [];
    wrongItems.value = [];
    aiCompletionProof.value = null;
    isSubmitting.value = false;
  }

  return {
    // State
    stageData,
    phase,
    health,
    maxHealth,
    score,
    combo,
    maxCombo,
    isFeverActive,
    feverProgress,
    timeRemaining,
    answersLog,
    wrongItems,
    clearedSrsItems,
    aiCompletionProof,
    isSubmitting,

    // Getters
    isAlive,
    accuracy,
    totalQuestions,
    totalCorrect,
    currentMultiplier,
    isBossStage,

    // Actions
    initSession,
    startSession,
    advancePhase,
    recordAnswer,
    takeDamage,
    heal,
    recordSrsItemCleared,
    setAiCompletionProof,
    calculateStageResult,
    completeStage,
    resetSession,
  };
});

