<script setup lang="ts">
/**
 * EngVerse - Daily Challenge (Thử Thách Hàng Ngày)
 * 4-Phase Micro-Learning Experience:
 *   Phase 1: Vocab Sprint (6 words - 60s)
 *   Phase 2: Grammar Flash (4 puzzles - 50s)
 *   Phase 3: Voice Challenge (3 phrases - 40s)
 *   Phase 4: Quick Roleplay (3 turns - 90s)
 * 
 * Features:
 *   - Auto reset 00:00 GMT+7 daily
 *   - 50% SRS Queue personalized vocabulary review
 *   - 1-Doc-Per-User atomic submission & streak progression
 *   - Offline / Mic Fallback guard
 * 
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.2 & Task 2.3
 */

import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '~/stores/user';
import { useSpeechEngine } from '~/composables/useSpeechEngine';
import { useSoundEffects } from '~/composables/useSoundEffects';
import { useDailyStreak } from '~/composables/useDailyStreak';
import { useFirebase } from '~/composables/useFirebase';
import {
  type DailyChallengeData,
  type DailyChallengeSubmitPayload,
  type DailyChallengeSubmitResponse,
  type DailyChallengePhaseResults,
  getDailyDateString,
} from '~/types/dailyChallenge';
import type { AiChatMessage, AiRoleplayPayload, AiRoleplayResponse } from '~/types/ai';

const router = useRouter();
const userStore = useUserStore();
const { playSound, triggerVictoryConfetti } = useSoundEffects();
const {
  speak,
  stopSpeaking,
  startListening,
  stopListening,
  isListening,
  currentTranscript,
  isSttSupported,
  isTtsSupported,
  hasPermissionDenied,
  evaluateSpeech,
} = useSpeechEngine();
const { getClientAuth } = useFirebase();

// ---------------------------------------------------------------------------
// Page & Flow State
// ---------------------------------------------------------------------------
type ChallengePhase =
  | 'loading'
  | 'intro'
  | 'vocab_sprint'
  | 'grammar_flash'
  | 'voice_challenge'
  | 'quick_roleplay'
  | 'submitting'
  | 'victory'
  | 'error';

const currentPhase = ref<ChallengePhase>('loading');
const errorMessage = ref<string | null>(null);
const challenge = ref<DailyChallengeData | null>(null);
const isPracticingAgain = ref<boolean>(false);

// Overall game performance tracking
const totalScore = ref<number>(0);
const combo = ref<number>(1);
const timeRemaining = ref<number>(60);
let timerInterval: ReturnType<typeof setInterval> | null = null;
const sessionStartTime = ref<number>(Date.now());
const newWrongWordIds = ref<string[]>([]);
const clearedWordIds = ref<string[]>([]);
const submitResult = ref<DailyChallengeSubmitResponse | null>(null);

// Phase Results Breakdown
const phaseResults = ref<DailyChallengePhaseResults>({
  vocabSprint: { score: 0, correctCount: 0, totalCount: 6 },
  grammarFlash: { score: 0, correctCount: 0, totalCount: 4 },
  voiceChallenge: { score: 0, correctCount: 0, totalCount: 3 },
  quickRoleplay: { score: 0, turnsUsed: 0, completed: false },
});

const {
  currentStreak,
  timeUntilReset,
  nextMilestone,
  daysRemainingToMilestone,
  milestoneProgressPercent,
  isMaxMilestoneReached,
  getMilestoneByDays,
  claimMilestone,
} = useDailyStreak();

const isRewardModalOpen = ref<boolean>(false);
const activeRewardMilestone = ref<StreakMilestone | null>(null);

function openMilestonePreview(milestone: StreakMilestone): void {
  if (!milestone) return;
  activeRewardMilestone.value = milestone;
  isRewardModalOpen.value = true;
}

function handleClaimMilestoneReward(milestone: StreakMilestone): void {
  claimMilestone(milestone.days);
}

const isCompletedToday = computed(() => {
  return userStore.isDailyChallengeCompletedToday && !isPracticingAgain.value;
});

// ---------------------------------------------------------------------------
// Phase 1: Vocab Sprint State
// ---------------------------------------------------------------------------
const currentVocabIndex = ref<number>(0);
const currentVocabOptions = ref<string[]>([]);
const selectedVocabOption = ref<string | null>(null);
const isVocabCorrect = ref<boolean | null>(null);
const isVocabLocked = ref<boolean>(false);

// ---------------------------------------------------------------------------
// Phase 2: Grammar Flash State
// ---------------------------------------------------------------------------
interface WordToken {
  id: string;
  word: string;
}
const currentGrammarIndex = ref<number>(0);
const grammarSelectedTokens = ref<WordToken[]>([]);
const grammarBankTokens = ref<WordToken[]>([]);
const isGrammarChecked = ref<boolean>(false);
const isGrammarCorrect = ref<boolean | null>(null);
const grammarFeedbackTip = ref<string | null>(null);

// ---------------------------------------------------------------------------
// Phase 3: Voice Challenge State
// ---------------------------------------------------------------------------
const currentVoiceIndex = ref<number>(0);
const voiceMatchScore = ref<number>(0);
const voiceEvaluationStatus = ref<'idle' | 'listening' | 'evaluating' | 'passed' | 'retry'>('idle');
const voiceFeedbackMessage = ref<string | null>(null);
const isVoiceManualFallback = ref<boolean>(false);
const manualVoiceInput = ref<string>('');

// ---------------------------------------------------------------------------
// Phase 4: Quick Roleplay State
// ---------------------------------------------------------------------------
interface DailyRoleplayMessage {
  role: 'user' | 'model';
  content: string;
  vietnameseHint?: string;
  grammarCorrection?: string;
  timestamp?: number;
}

const roleplayMessages = ref<DailyRoleplayMessage[]>([]);
const playerInputText = ref<string>('');
const isAiResponding = ref<boolean>(false);
const roleplayTurnsUsed = ref<number>(0);
const roleplayHintVi = ref<string | null>(null);
const roleplayGrammarCorrection = ref<string | null>(null);

// ---------------------------------------------------------------------------
// Lifecycle & Data Fetching
// ---------------------------------------------------------------------------
onMounted(async () => {
  await loadDailyChallenge();
});

onUnmounted(() => {
  clearActiveTimer();
  stopSpeaking();
  stopListening();
});

async function loadDailyChallenge(): Promise<void> {
  currentPhase.value = 'loading';
  errorMessage.value = null;

  try {
    const today = getDailyDateString();
    let idToken = '';
    const clientAuth = getClientAuth();
    if (clientAuth?.currentUser) {
      idToken = await clientAuth.currentUser.getIdToken();
    }

    const queryParams: Record<string, string> = { date: today };
    if (!idToken && userStore.srsBossQueue && userStore.srsBossQueue.length > 0) {
      queryParams.srsVocabIds = userStore.srsBossQueue.slice(0, 10).join(',');
    }

    const headers: Record<string, string> = {};
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }

    const res = await $fetch<{ success: boolean; challenge: DailyChallengeData }>(
      '/api/game/daily-challenge',
      {
        params: queryParams,
        headers,
      }
    );

    if (res && res.challenge) {
      challenge.value = res.challenge;
      currentPhase.value = 'intro';
    } else {
      throw new Error('Không thể tải dữ liệu Thử Thách Hàng Ngày.');
    }
  } catch (err: unknown) {
    console.error('[DailyChallenge] Failed to load challenge:', err);
    errorMessage.value =
      err instanceof Error ? err.message : 'Có lỗi xảy ra khi kết nối máy chủ.';
    currentPhase.value = 'error';
  }
}

// ---------------------------------------------------------------------------
// Timer Management
// ---------------------------------------------------------------------------
function startPhaseTimer(seconds: number, onTimeout: () => void): void {
  clearActiveTimer();
  timeRemaining.value = seconds;
  timerInterval = setInterval(() => {
    if (timeRemaining.value > 0) {
      timeRemaining.value--;
      if (timeRemaining.value <= 5 && timeRemaining.value > 0) {
        playSound('combo_fever');
      }
    } else {
      clearActiveTimer();
      onTimeout();
    }
  }, 1000);
}

function clearActiveTimer(): void {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// ---------------------------------------------------------------------------
// Game Flow Navigation
// ---------------------------------------------------------------------------
function startChallenge(forceRetry: boolean = false): void {
  if (forceRetry) {
    isPracticingAgain.value = true;
  }
  isSubmitting = false;
  totalScore.value = 0;
  combo.value = 1;
  newWrongWordIds.value = [];
  clearedWordIds.value = [];
  sessionStartTime.value = Date.now();

  initVocabSprint();
}

// ===========================================================================
// Phase 1: Vocab Sprint (6 words - 60s)
// ===========================================================================
function initVocabSprint(): void {
  if (!challenge.value || !challenge.value.vocabSprint.length) {
    advanceToGrammarFlash();
    return;
  }

  currentPhase.value = 'vocab_sprint';
  currentVocabIndex.value = 0;
  phaseResults.value.vocabSprint = {
    score: 0,
    correctCount: 0,
    totalCount: challenge.value.vocabSprint.length,
  };

  setupVocabCard();
  startPhaseTimer(60, () => {
    playSound('wrong');
    advanceToGrammarFlash();
  });
}

function setupVocabCard(): void {
  if (!challenge.value) return;
  const item = challenge.value.vocabSprint[currentVocabIndex.value];
  if (!item) {
    advanceToGrammarFlash();
    return;
  }

  selectedVocabOption.value = null;
  isVocabCorrect.value = null;
  isVocabLocked.value = false;

  // Shuffle correct meaning with distractor meanings
  const options = [item.meaning, ...(item.distractorMeanings || [])];
  currentVocabOptions.value = options.sort(() => Math.random() - 0.5);

  // Auto pronunciation voice for immersion
  if (isTtsSupported.value) {
    void speak(item.word);
  }
}

function onSelectVocabOption(option: string): void {
  if (isVocabLocked.value || !challenge.value) return;
  isVocabLocked.value = true;
  selectedVocabOption.value = option;

  const currentItem = challenge.value.vocabSprint[currentVocabIndex.value];
  if (!currentItem) return;

  const isCorrect = option === currentItem.meaning;
  isVocabCorrect.value = isCorrect;

  if (isCorrect) {
    playSound('correct');
    combo.value++;
    const points = 100 * Math.min(combo.value, 4);
    totalScore.value += points;
    phaseResults.value.vocabSprint.score += points;
    phaseResults.value.vocabSprint.correctCount++;

    if (userStore.isItemInSrsQueue(currentItem.id)) {
      clearedWordIds.value.push(currentItem.id);
    }
  } else {
    playSound('wrong');
    combo.value = 1;
    newWrongWordIds.value.push(currentItem.id);
  }

  // Next word transition
  setTimeout(() => {
    if (currentVocabIndex.value + 1 < (challenge.value?.vocabSprint.length || 0)) {
      currentVocabIndex.value++;
      setupVocabCard();
    } else {
      advanceToGrammarFlash();
    }
  }, 700);
}

function playVocabPronunciation(): void {
  if (!challenge.value) return;
  const item = challenge.value.vocabSprint[currentVocabIndex.value];
  if (item) {
    void speak(item.word);
  }
}

// ===========================================================================
// Phase 2: Grammar Flash (4 puzzles - 50s)
// ===========================================================================
function advanceToGrammarFlash(): void {
  clearActiveTimer();
  if (!challenge.value || !challenge.value.grammarFlash.length) {
    advanceToVoiceChallenge();
    return;
  }

  currentPhase.value = 'grammar_flash';
  currentGrammarIndex.value = 0;
  phaseResults.value.grammarFlash = {
    score: 0,
    correctCount: 0,
    totalCount: challenge.value.grammarFlash.length,
  };

  setupGrammarPuzzle();
  startPhaseTimer(50, () => {
    playSound('wrong');
    advanceToVoiceChallenge();
  });
}

function setupGrammarPuzzle(): void {
  if (!challenge.value) return;
  const puzzle = challenge.value.grammarFlash[currentGrammarIndex.value];
  if (!puzzle) {
    advanceToVoiceChallenge();
    return;
  }

  grammarSelectedTokens.value = [];
  isGrammarChecked.value = false;
  isGrammarCorrect.value = null;
  grammarFeedbackTip.value = null;

  // Split correct sentence into words and add distractors
  const correctWords = puzzle.correctSentence.trim().split(/\s+/);
  const distractorWords = puzzle.distractorWords || [];
  const allWords = [...correctWords, ...distractorWords];

  grammarBankTokens.value = allWords
    .map((w, idx) => ({ id: `token_${idx}_${w}`, word: w }))
    .sort(() => Math.random() - 0.5);
}

function selectGrammarBankToken(token: WordToken): void {
  if (isGrammarChecked.value && isGrammarCorrect.value) return;
  const idx = grammarBankTokens.value.findIndex((t) => t.id === token.id);
  if (idx !== -1) {
    grammarBankTokens.value.splice(idx, 1);
    grammarSelectedTokens.value.push(token);
    playSound('combo_fever');
  }
}

function deselectGrammarToken(token: WordToken): void {
  if (isGrammarChecked.value && isGrammarCorrect.value) return;
  const idx = grammarSelectedTokens.value.findIndex((t) => t.id === token.id);
  if (idx !== -1) {
    grammarSelectedTokens.value.splice(idx, 1);
    grammarBankTokens.value.push(token);
  }
}

function clearGrammarSelection(): void {
  if (isGrammarChecked.value && isGrammarCorrect.value) return;
  grammarBankTokens.value = [...grammarBankTokens.value, ...grammarSelectedTokens.value];
  grammarSelectedTokens.value = [];
}

function checkGrammarAnswer(): void {
  if (!challenge.value || grammarSelectedTokens.value.length === 0 || (isGrammarChecked.value && isGrammarCorrect.value)) return;
  const puzzle = challenge.value.grammarFlash[currentGrammarIndex.value];
  if (!puzzle) return;

  const playerSentence = grammarSelectedTokens.value.map((t) => t.word).join(' ');
  const cleanPlayer = playerSentence.replace(/[.,!?]/g, '').trim().toLowerCase();
  const cleanCorrect = puzzle.correctSentence.replace(/[.,!?]/g, '').trim().toLowerCase();

  isGrammarChecked.value = true;
  if (cleanPlayer === cleanCorrect) {
    isGrammarCorrect.value = true;
    playSound('correct');
    combo.value++;
    const points = 150 * Math.min(combo.value, 4);
    totalScore.value += points;
    phaseResults.value.grammarFlash.score += points;
    phaseResults.value.grammarFlash.correctCount++;

    setTimeout(() => {
      if (currentGrammarIndex.value + 1 < (challenge.value?.grammarFlash.length || 0)) {
        currentGrammarIndex.value++;
        setupGrammarPuzzle();
      } else {
        advanceToVoiceChallenge();
      }
    }, 850);
  } else {
    isGrammarCorrect.value = false;
    playSound('wrong');
    combo.value = 1;
    grammarFeedbackTip.value = puzzle.grammarTip || 'Hãy kiểm tra lại trật tự sắp xếp từ!';
  }
}

// ===========================================================================
// Phase 3: Voice Challenge (3 phrases - 40s)
// ===========================================================================
function advanceToVoiceChallenge(): void {
  clearActiveTimer();
  if (!challenge.value || !challenge.value.voiceChallenge.length) {
    advanceToQuickRoleplay();
    return;
  }

  currentPhase.value = 'voice_challenge';
  currentVoiceIndex.value = 0;
  phaseResults.value.voiceChallenge = {
    score: 0,
    correctCount: 0,
    totalCount: challenge.value.voiceChallenge.length,
  };

  setupVoiceItem();
  startPhaseTimer(40, () => {
    playSound('wrong');
    advanceToQuickRoleplay();
  });
}

function setupVoiceItem(): void {
  if (!challenge.value) return;
  const item = challenge.value.voiceChallenge[currentVoiceIndex.value];
  if (!item) {
    advanceToQuickRoleplay();
    return;
  }

  voiceMatchScore.value = 0;
  voiceEvaluationStatus.value = 'idle';
  voiceFeedbackMessage.value = null;
  manualVoiceInput.value = '';
}

function playVoiceSentenceAudio(): void {
  if (!challenge.value) return;
  const item = challenge.value.voiceChallenge[currentVoiceIndex.value];
  if (item) {
    void speak(item.sentence);
  }
}

async function toggleVoiceRecording(): Promise<void> {
  if (voiceEvaluationStatus.value === 'passed' || voiceEvaluationStatus.value === 'evaluating') return;
  if (!challenge.value) return;
  const item = challenge.value.voiceChallenge[currentVoiceIndex.value];
  if (!item) return;

  if (isListening.value) {
    stopListening();
    evaluateVoiceSubmission(currentTranscript.value);
  } else {
    voiceEvaluationStatus.value = 'listening';
    voiceFeedbackMessage.value = 'Đang lắng nghe... Hãy đọc to câu tiếng Anh trên!';
    startListening(item.sentence, {
      acceptedVariants: [item.sentence, item.focusWord],
      threshold: 75,
      onResult: (res) => {
        evaluateVoiceSubmission(res.recognizedText || currentTranscript.value);
      },
      onError: () => {
        if (hasPermissionDenied.value) {
          voiceEvaluationStatus.value = 'idle';
          isVoiceManualFallback.value = true;
          voiceFeedbackMessage.value = 'Microphone bị chặn. Bạn có thể chuyển sang chế độ gõ câu!';
        }
      },
    });

    if (hasPermissionDenied.value || !isSttSupported.value) {
      voiceEvaluationStatus.value = 'idle';
      isVoiceManualFallback.value = true;
      voiceFeedbackMessage.value = 'Microphone không khả dụng. Bạn có thể chuyển sang chế độ gõ câu!';
    }
  }
}

function evaluateVoiceSubmission(userSpokenText: string): void {
  if (!challenge.value) return;
  const item = challenge.value.voiceChallenge[currentVoiceIndex.value];
  if (!item) return;

  voiceEvaluationStatus.value = 'evaluating';

  const result = evaluateSpeech(
    userSpokenText || '',
    item.sentence,
    [item.sentence, item.focusWord],
    75
  );

  voiceMatchScore.value = result.score;

  if (result.isPassed) {
    voiceEvaluationStatus.value = 'passed';
    playSound('correct');
    combo.value++;
    const points = 200 * Math.min(combo.value, 4);
    totalScore.value += points;
    phaseResults.value.voiceChallenge.score += points;
    phaseResults.value.voiceChallenge.correctCount++;
    voiceFeedbackMessage.value = `Chính xác! (${result.score}%) — Phát âm rất chuẩn.`;

    setTimeout(() => {
      if (currentVoiceIndex.value + 1 < (challenge.value?.voiceChallenge.length || 0)) {
        currentVoiceIndex.value++;
        setupVoiceItem();
      } else {
        advanceToQuickRoleplay();
      }
    }, 1000);
  } else {
    voiceEvaluationStatus.value = 'retry';
    playSound('wrong');
    voiceFeedbackMessage.value = result.feedbackVi || 'Chưa đạt độ chính xác (cần >= 75%). Hãy thử đọc lại to và rõ ràng hơn!';
  }
}

function submitManualVoiceInput(): void {
  if (!manualVoiceInput.value.trim() || voiceEvaluationStatus.value === 'passed' || voiceEvaluationStatus.value === 'evaluating') return;
  evaluateVoiceSubmission(manualVoiceInput.value);
}

// ===========================================================================
// Phase 4: Quick Roleplay (3 turns - 90s)
// ===========================================================================
function advanceToQuickRoleplay(): void {
  clearActiveTimer();
  if (!challenge.value || !challenge.value.quickRoleplay) {
    finishChallenge();
    return;
  }

  currentPhase.value = 'quick_roleplay';
  roleplayTurnsUsed.value = 0;
  playerInputText.value = '';
  roleplayHintVi.value = null;
  roleplayGrammarCorrection.value = null;

  const config = challenge.value.quickRoleplay;
  roleplayMessages.value = [
    {
      role: 'model',
      content: config.openingLine,
      vietnameseHint: config.openingLineVi,
      timestamp: Date.now(),
    },
  ];

  phaseResults.value.quickRoleplay = {
    score: 0,
    turnsUsed: 0,
    completed: false,
  };

  startPhaseTimer(90, () => {
    playSound('wrong');
    finishChallenge();
  });
}

function onSelectStarterChip(chip: string): void {
  playerInputText.value = chip;
  void sendRoleplayMessage();
}

async function sendRoleplayMessage(): Promise<void> {
  const text = playerInputText.value.trim();
  if (!text || isAiResponding.value || !challenge.value || roleplayTurnsUsed.value >= 3) return;

  const config = challenge.value.quickRoleplay;
  playerInputText.value = '';
  roleplayTurnsUsed.value++;
  phaseResults.value.quickRoleplay.turnsUsed = roleplayTurnsUsed.value;

  // Add user message
  roleplayMessages.value.push({
    role: 'user',
    content: text,
    timestamp: Date.now(),
  });

  isAiResponding.value = true;
  roleplayHintVi.value = null;
  roleplayGrammarCorrection.value = null;

  try {
    const historyPayload: AiChatMessage[] = roleplayMessages.value
      .slice(-4)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    const payload: AiRoleplayPayload = {
      worldTrack: userStore.currentTrack || 'adults',
      stageId: 0,
      playerInput: text,
      conversationHistory: historyPayload,
      aiMission: {
        npcName: config.npcName,
        npcTitle: config.npcTitle,
        npcEmoji: config.npcEmoji,
        scenario: config.scenario,
        goal: config.goal,
        openingLine: config.openingLine,
        openingLineVi: config.openingLineVi,
        recommendedWords: config.targetKeywords,
        targetKeywords: config.targetKeywords,
        starterChips: config.starterChips,
        maxTurns: 3,
      },
      guestId: userStore.user.uid || 'guest_user',
    };

    const res = await $fetch<AiRoleplayResponse>('/api/ai/roleplay', {
      method: 'POST',
      body: payload,
    });

    if (res && res.npcReply) {
      playSound('correct');
      const scoreGain = res.scoreDelta || 50;
      totalScore.value += scoreGain;
      phaseResults.value.quickRoleplay.score += scoreGain;

      roleplayMessages.value.push({
        role: 'model',
        content: res.npcReply,
        vietnameseHint: res.vietnameseHint,
        grammarCorrection: res.grammarCorrection,
        timestamp: Date.now(),
      });

      if (res.vietnameseHint) roleplayHintVi.value = res.vietnameseHint;
      if (res.grammarCorrection) roleplayGrammarCorrection.value = res.grammarCorrection;

      if (res.isMissionCompleted || roleplayTurnsUsed.value >= 3) {
        phaseResults.value.quickRoleplay.completed = true;
        setTimeout(() => {
          finishChallenge();
        }, 1200);
      }
    }
  } catch (err) {
    console.warn('[QuickRoleplay] AI fallback triggered:', err);
    // Graceful offline mock response
    totalScore.value += 40;
    phaseResults.value.quickRoleplay.score += 40;
    roleplayMessages.value.push({
      role: 'model',
      content: "Great job! That's very natural. Thank you for completing today's roleplay!",
      vietnameseHint: 'Làm tốt lắm! Bạn đã diễn đạt rất tự nhiên.',
      timestamp: Date.now(),
    });
    if (roleplayTurnsUsed.value >= 3) {
      phaseResults.value.quickRoleplay.completed = true;
      setTimeout(() => {
        finishChallenge();
      }, 1200);
    }
  } finally {
    isAiResponding.value = false;
  }
}

// ===========================================================================
// Submission & Victory Modal
// ===========================================================================
let isSubmitting = false;

async function finishChallenge(): Promise<void> {
  if (isSubmitting) return;
  isSubmitting = true;
  clearActiveTimer();
  currentPhase.value = 'submitting';

  const durationSeconds = Math.max(1, Math.floor((Date.now() - sessionStartTime.value) / 1000));
  
  // Calculate stars (1 - 3 stars)
  const maxPossible = 1500;
  let stars = 1;
  if (totalScore.value >= maxPossible * 0.75) {
    stars = 3;
  } else if (totalScore.value >= maxPossible * 0.45) {
    stars = 2;
  }

  let idToken = '';
  const clientAuth = getClientAuth();
  if (clientAuth?.currentUser) {
    try {
      idToken = await clientAuth.currentUser.getIdToken();
    } catch {
      // Guest
    }
  }

  const payload: DailyChallengeSubmitPayload = {
    idToken: idToken || undefined,
    guestId: userStore.user.uid || 'guest_user',
    date: challenge.value?.date || getDailyDateString(),
    totalScore: totalScore.value,
    starsEarned: stars,
    durationSeconds,
    phaseResults: phaseResults.value,
    newWrongWordIds: newWrongWordIds.value,
    clearedWordIds: clearedWordIds.value,
  };

  try {
    const res = await $fetch<DailyChallengeSubmitResponse>('/api/game/daily-challenge', {
      method: 'POST',
      body: payload,
    });

    submitResult.value = res;
    userStore.recordDailyChallengeCompletion(res);
    
    // Play celebratory sound & confetti
    playSound('fanfare');
    triggerVictoryConfetti();

    // Check if streak milestone is achieved or reward unlocked
    const streakMilestone = getMilestoneByDays(res.currentStreak);
    if (res.rewardUnlocked || streakMilestone) {
      activeRewardMilestone.value = streakMilestone || nextMilestone.value;
      setTimeout(() => {
        isRewardModalOpen.value = true;
      }, 700);
    }

    currentPhase.value = 'victory';
  } catch (err: unknown) {
    console.error('[DailyChallenge] Submission failed:', err);
    // Offline / Guest local completion fallback
    const localStreak = (userStore.dailyStreak || 0) + 1;
    const localMilestone = getMilestoneByDays(localStreak);
    const localRes: DailyChallengeSubmitResponse = {
      success: true,
      earnedExp: 150 * stars,
      earnedGold: 50 * stars,
      currentStreak: localStreak,
      longestStreak: Math.max((userStore.dailyChallenge?.longestStreak || 0), localStreak),
      isStreakExtended: true,
      shieldUsed: false,
      rewardUnlocked: localMilestone ? localMilestone.titleVi : undefined,
      message: 'Hoàn thành thử thách hàng ngày thành công!',
    };
    submitResult.value = localRes;
    userStore.recordDailyChallengeCompletion(localRes);

    playSound('fanfare');
    triggerVictoryConfetti();

    if (localMilestone) {
      activeRewardMilestone.value = localMilestone;
      setTimeout(() => {
        isRewardModalOpen.value = true;
      }, 700);
    }

    currentPhase.value = 'victory';
  }
}

function handleReturnHome(): void {
  void router.push('/');
}
</script>

<template>
  <div class="daily-challenge-page">
    <!-- 1. Loading State -->
    <div v-if="currentPhase === 'loading'" class="state-container theme-card">
      <div class="spinner-pulse" />
      <h2 class="state-title">Đang tải Thử Thách Hàng Ngày...</h2>
      <p class="state-subtitle">Hệ thống đang cá nhân hoá câu hỏi từ hàng đợi ôn tập SRS của bạn.</p>
    </div>

    <!-- 2. Error State -->
    <div v-else-if="currentPhase === 'error'" class="state-container theme-card">
      <span class="error-emoji" aria-hidden="true">⚠️</span>
      <h2 class="state-title">Không Thể Tải Thử Thách</h2>
      <p class="state-subtitle">{{ errorMessage || 'Vui lòng kiểm tra lại kết nối mạng.' }}</p>
      <div class="state-actions">
        <button class="theme-btn-primary" @click="loadDailyChallenge">Thử Lại</button>
        <button class="theme-btn-secondary" @click="handleReturnHome">Quay Về Bản Đồ</button>
      </div>
    </div>

    <!-- 3. Intro Screen -->
    <div v-else-if="currentPhase === 'intro' && challenge" class="intro-container theme-card">
      <div class="intro-header">
        <div class="theme-badge">
          <span class="theme-icon">{{ challenge.icon }}</span>
          <span class="theme-name">{{ challenge.themeVi }} ({{ challenge.theme }})</span>
        </div>
        <h1 class="intro-title">Thử Thách Hàng Ngày</h1>
        <p class="intro-desc">{{ challenge.description }}</p>
      </div>

      <!-- Streak & Countdown Banner -->
      <div class="streak-overview-box">
        <div class="streak-col">
          <span class="streak-flame-icon">🔥</span>
          <div class="streak-data">
            <span class="streak-number">{{ currentStreak }}</span>
            <span class="streak-label">Ngày Liên Tiếp</span>
          </div>
        </div>

        <div class="streak-divider" />

        <div class="reset-countdown-col">
          <span class="countdown-label">Làm mới sau:</span>
          <span class="countdown-val">{{ timeUntilReset }}</span>
          <span class="countdown-sub">00:00 (GMT+7)</span>
        </div>
      </div>

      <!-- Streak Milestone Progress Bar -->
      <div
        v-if="nextMilestone"
        class="streak-milestone-banner clickable"
        title="Bấm để xem chi tiết phần thưởng mốc!"
        @click="openMilestonePreview(nextMilestone)"
      >
        <div class="milestone-text-row">
          <span class="milestone-title">
            {{ nextMilestone.rewardIcon }} Mốc tiếp theo: <strong>{{ nextMilestone.titleVi }}</strong> ({{ nextMilestone.days }} ngày)
          </span>
          <div class="milestone-badge-group">
            <span v-if="isMaxMilestoneReached" class="milestone-remaining">👑 Đạt mốc tối đa!</span>
            <span v-else class="milestone-remaining">Còn {{ daysRemainingToMilestone }} ngày</span>
            <span class="milestone-preview-hint">👁️ Xem quà</span>
          </div>
        </div>
        <div class="milestone-progress-track">
          <div class="milestone-progress-fill" :style="{ width: `${milestoneProgressPercent}%` }" />
        </div>
      </div>

      <!-- 4 Phases Breakdown Cards -->
      <div class="phases-preview-grid">
        <div class="phase-preview-card">
          <div class="phase-badge phase-1">Phase 1</div>
          <span class="phase-icon">⚡</span>
          <h4>Vocab Sprint</h4>
          <p>6 từ vựng • 60 giây (50% từ SRS)</p>
        </div>

        <div class="phase-preview-card">
          <div class="phase-badge phase-2">Phase 2</div>
          <span class="phase-icon">🧩</span>
          <h4>Grammar Flash</h4>
          <p>4 câu ghép ngữ pháp • 50 giây</p>
        </div>

        <div class="phase-preview-card">
          <div class="phase-badge phase-3">Phase 3</div>
          <span class="phase-icon">🎙️</span>
          <h4>Voice Challenge</h4>
          <p>3 câu đọc to phát âm • 40 giây</p>
        </div>

        <div class="phase-preview-card">
          <div class="phase-badge phase-4">Phase 4</div>
          <span class="phase-icon">🤖</span>
          <h4>Quick Roleplay</h4>
          <p>3 lượt đối thoại AI • 90 giây</p>
        </div>
      </div>

      <!-- Completed today banner if already finished -->
      <div v-if="isCompletedToday" class="already-completed-banner">
        <span class="check-icon">✅</span>
        <div class="banner-text">
          <strong>Hôm nay bạn đã hoàn thành thử thách!</strong>
          <span>Streak đã được giữ vững. Bạn có thể luyện tập lại tự do mà không mất chuỗi.</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="intro-actions">
        <button
          v-if="!isCompletedToday"
          class="theme-btn-primary start-btn"
          @click="startChallenge(false)"
        >
          🚀 Bắt Đầu Thử Thách (~3 Phút)
        </button>
        <button
          v-else
          class="theme-btn-primary practice-btn"
          @click="startChallenge(true)"
        >
          🔄 Luyện Tập Lại Tự Do
        </button>
        <button class="theme-btn-secondary back-btn" @click="handleReturnHome">
          ← Về Bản Đồ
        </button>
      </div>
    </div>

    <!-- Active Challenge Session (Phases 1-4) -->
    <div
      v-else-if="challenge && (currentPhase === 'vocab_sprint' || currentPhase === 'grammar_flash' || currentPhase === 'voice_challenge' || currentPhase === 'quick_roleplay')"
      class="session-container"
    >
      <!-- Top Persistent HUD -->
      <header class="challenge-hud theme-card">
        <div class="hud-left">
          <span class="hud-theme-icon">{{ challenge.icon }}</span>
          <div class="hud-theme-info">
            <span class="hud-phase-name">
              <template v-if="currentPhase === 'vocab_sprint'">1. Vocab Sprint</template>
              <template v-else-if="currentPhase === 'grammar_flash'">2. Grammar Flash</template>
              <template v-else-if="currentPhase === 'voice_challenge'">3. Voice Challenge</template>
              <template v-else-if="currentPhase === 'quick_roleplay'">4. Quick Roleplay</template>
            </span>
            <span class="hud-theme-title">{{ challenge.themeVi }}</span>
          </div>
        </div>

        <div class="hud-center">
          <div class="timer-box" :class="{ 'timer-urgent': timeRemaining <= 10 }">
            <span class="timer-icon">⏳</span>
            <span class="timer-seconds">{{ timeRemaining }}s</span>
          </div>
        </div>

        <div class="hud-right">
          <div class="score-badge">
            <span class="score-label">Điểm</span>
            <span class="score-value">{{ totalScore }}</span>
          </div>
          <div v-if="combo > 1" class="combo-pill">
            🔥 x{{ combo }}
          </div>
        </div>
      </header>

      <!-- PHASE 1: VOCAB SPRINT -->
      <section v-if="currentPhase === 'vocab_sprint'" class="phase-workspace vocab-workspace theme-card">
        <div class="workspace-stepper">
          <span>Từ {{ currentVocabIndex + 1 }}/{{ challenge.vocabSprint.length }}</span>
        </div>

        <div
          v-if="challenge.vocabSprint[currentVocabIndex]"
          class="vocab-flashcard"
        >
          <div class="vocab-top-meta">
            <span v-if="challenge.vocabSprint[currentVocabIndex]?.emoji" class="vocab-emoji">
              {{ challenge.vocabSprint[currentVocabIndex]?.emoji }}
            </span>
            <span class="vocab-ipa">{{ challenge.vocabSprint[currentVocabIndex]?.ipa }}</span>
            <button
              class="audio-speaker-btn"
              title="Nghe phát âm"
              @click="playVocabPronunciation"
            >
              🔊
            </button>
          </div>

          <h2 class="vocab-word-display">
            {{ challenge.vocabSprint[currentVocabIndex]?.word }}
          </h2>

          <p v-if="challenge.vocabSprint[currentVocabIndex]?.realWorldPhrase" class="vocab-example">
            "{{ challenge.vocabSprint[currentVocabIndex]?.realWorldPhrase }}"
          </p>

          <!-- 4 Multiple Choice Options -->
          <div class="vocab-options-grid">
            <button
              v-for="(option, idx) in currentVocabOptions"
              :key="idx"
              class="vocab-option-btn"
              :class="{
                'selected-correct': selectedVocabOption === option && isVocabCorrect,
                'selected-wrong': selectedVocabOption === option && isVocabCorrect === false,
                'highlight-correct': isVocabCorrect === false && option === challenge.vocabSprint[currentVocabIndex]?.meaning
              }"
              :disabled="isVocabLocked"
              @click="onSelectVocabOption(option)"
            >
              <span class="option-letter">{{ ['A', 'B', 'C', 'D'][idx] }}</span>
              <span class="option-text">{{ option }}</span>
            </button>
          </div>
        </div>
      </section>

      <!-- PHASE 2: GRAMMAR FLASH -->
      <section v-else-if="currentPhase === 'grammar_flash'" class="phase-workspace grammar-workspace theme-card">
        <div class="workspace-stepper">
          <span>Câu {{ currentGrammarIndex + 1 }}/{{ challenge.grammarFlash.length }}</span>
          <span v-if="challenge.grammarFlash[currentGrammarIndex]?.grammarPattern" class="pattern-pill">
            {{ challenge.grammarFlash[currentGrammarIndex]?.grammarPattern }}
          </span>
        </div>

        <div v-if="challenge.grammarFlash[currentGrammarIndex]" class="grammar-content">
          <div class="vietnamese-prompt-box">
            <span class="prompt-flag">🇻🇳</span>
            <h3 class="vietnamese-text">{{ challenge.grammarFlash[currentGrammarIndex]?.vietnamesePrompt }}</h3>
          </div>

          <!-- Sentence Assembly Slot Box -->
          <div
            class="sentence-assembly-area"
            :class="{
              'assembly-correct': isGrammarChecked && isGrammarCorrect,
              'assembly-wrong': isGrammarChecked && isGrammarCorrect === false
            }"
          >
            <div v-if="grammarSelectedTokens.length === 0" class="assembly-placeholder">
              Chạm vào các từ bên dưới để ghép thành câu hoàn chỉnh...
            </div>
            <div
              v-for="token in grammarSelectedTokens"
              :key="token.id"
              class="placed-token-chip"
              @click="deselectGrammarToken(token)"
            >
              <span>{{ token.word }}</span>
              <span class="remove-dot">×</span>
            </div>
          </div>

          <!-- Grammar Tip If Incorrect -->
          <div v-if="grammarFeedbackTip" class="grammar-feedback-alert">
            💡 Gợi ý: {{ grammarFeedbackTip }}
          </div>

          <!-- Word Bank -->
          <div class="word-bank-container">
            <button
              v-for="token in grammarBankTokens"
              :key="token.id"
              class="bank-token-btn"
              @click="selectGrammarBankToken(token)"
            >
              {{ token.word }}
            </button>
          </div>

          <!-- Action Controls -->
          <div class="grammar-actions-bar">
            <button
              class="theme-btn-secondary clear-btn"
              :disabled="grammarSelectedTokens.length === 0"
              @click="clearGrammarSelection"
            >
              Xóa Hết
            </button>
            <button
              class="theme-btn-primary check-btn"
              :disabled="grammarSelectedTokens.length === 0"
              @click="checkGrammarAnswer"
            >
              Kiểm Tra
            </button>
          </div>
        </div>
      </section>

      <!-- PHASE 3: VOICE CHALLENGE -->
      <section v-else-if="currentPhase === 'voice_challenge'" class="phase-workspace voice-workspace theme-card">
        <div class="workspace-stepper">
          <span>Câu {{ currentVoiceIndex + 1 }}/{{ challenge.voiceChallenge.length }}</span>
        </div>

        <div v-if="challenge.voiceChallenge[currentVoiceIndex]" class="voice-content">
          <div class="voice-target-box">
            <div class="voice-top-actions">
              <span class="focus-badge">
                Focus: {{ challenge.voiceChallenge[currentVoiceIndex]?.focusWord }}
                ({{ challenge.voiceChallenge[currentVoiceIndex]?.ipa }})
              </span>
              <button class="speaker-pill-btn" @click="playVoiceSentenceAudio">
                🔊 Nghe Mẫu
              </button>
            </div>

            <h2 class="target-sentence-text">
              {{ challenge.voiceChallenge[currentVoiceIndex]?.sentence }}
            </h2>

            <p class="target-sentence-translation">
              {{ challenge.voiceChallenge[currentVoiceIndex]?.translationVi }}
            </p>
          </div>

          <!-- Micro Interactive Zone -->
          <div class="voice-mic-zone">
            <button
              class="big-mic-button"
              :class="{
                'mic-active': isListening,
                'mic-passed': voiceEvaluationStatus === 'passed',
                'mic-retry': voiceEvaluationStatus === 'retry'
              }"
              @click="toggleVoiceRecording"
            >
              <span class="mic-icon">{{ isListening ? '⏹️' : '🎙️' }}</span>
              <span class="mic-label">
                {{ isListening ? 'Đang nghe... (Bấm để dừng)' : 'Bấm Micro Để Đọc' }}
              </span>
            </button>

            <!-- Feedback status -->
            <div v-if="voiceFeedbackMessage" class="voice-status-box">
              <span class="status-text">{{ voiceFeedbackMessage }}</span>
              <span v-if="voiceMatchScore > 0" class="score-tag">{{ voiceMatchScore }}% match</span>
            </div>

            <!-- Manual text input fallback option -->
            <div class="mic-fallback-toggle">
              <button
                class="text-link-btn"
                @click="isVoiceManualFallback = !isVoiceManualFallback"
              >
                {{ isVoiceManualFallback ? '← Dùng Micro phát âm' : 'Micro gặp sự cố? Nhập văn bản' }}
              </button>
            </div>

            <div v-if="isVoiceManualFallback" class="manual-input-box">
              <input
                v-model="manualVoiceInput"
                type="text"
                placeholder="Gõ lại câu tiếng Anh chính xác..."
                class="manual-text-field"
                @keyup.enter="submitManualVoiceInput"
              />
              <button class="theme-btn-primary manual-submit-btn" @click="submitManualVoiceInput">
                Gửi
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- PHASE 4: QUICK ROLEPLAY -->
      <section v-else-if="currentPhase === 'quick_roleplay'" class="phase-workspace roleplay-workspace theme-card">
        <div class="workspace-stepper">
          <span>Lượt {{ roleplayTurnsUsed }}/3</span>
          <span class="roleplay-scenario-tag">
            {{ challenge.quickRoleplay.npcEmoji }} {{ challenge.quickRoleplay.npcName }} — {{ challenge.quickRoleplay.goal }}
          </span>
        </div>

        <!-- Chat Message Stream -->
        <div class="chat-messages-scroll">
          <div
            v-for="(msg, idx) in roleplayMessages"
            :key="idx"
            class="chat-bubble-wrapper"
            :class="{ 'user-bubble-wrapper': msg.role === 'user', 'assistant-bubble-wrapper': msg.role === 'model' }"
          >
            <div class="bubble-avatar">
              {{ msg.role === 'model' ? challenge.quickRoleplay.npcEmoji : '🧑‍🚀' }}
            </div>
            <div class="bubble-body">
              <p class="bubble-text">{{ msg.content }}</p>
              <p v-if="msg.vietnameseHint" class="bubble-hint-vi">
                🇻🇳 {{ msg.vietnameseHint }}
              </p>
              <p v-if="msg.grammarCorrection" class="bubble-grammar-fix">
                ✏️ Gợi ý sửa: {{ msg.grammarCorrection }}
              </p>
            </div>
          </div>

          <div v-if="isAiResponding" class="ai-typing-indicator">
            <span class="dot" />
            <span class="dot" />
            <span class="dot" />
            <span>{{ challenge.quickRoleplay.npcName }} đang trả lời...</span>
          </div>
        </div>

        <!-- Starter Chips -->
        <div v-if="challenge.quickRoleplay.starterChips?.length" class="starter-chips-container">
          <span class="chips-title">Gợi ý câu nói:</span>
          <div class="chips-row">
            <button
              v-for="(chip, idx) in challenge.quickRoleplay.starterChips"
              :key="idx"
              class="starter-chip-btn"
              :disabled="isAiResponding"
              @click="onSelectStarterChip(chip)"
            >
              "{{ chip }}"
            </button>
          </div>
        </div>

        <!-- Chat Input Bar -->
        <div class="chat-input-row">
          <input
            v-model="playerInputText"
            type="text"
            placeholder="Nhập câu trả lời bằng tiếng Anh..."
            class="chat-input-field"
            :disabled="isAiResponding"
            @keyup.enter="sendRoleplayMessage"
          />
          <button
            class="theme-btn-primary send-msg-btn"
            :disabled="!playerInputText.trim() || isAiResponding"
            @click="sendRoleplayMessage"
          >
            Gửi
          </button>
        </div>
      </section>
    </div>

    <!-- 4. Submitting State -->
    <div v-else-if="currentPhase === 'submitting'" class="state-container theme-card">
      <div class="spinner-pulse" />
      <h2 class="state-title">Đang Đồng Bộ Kết Quả...</h2>
      <p class="state-subtitle">Hệ thống đang tính chuỗi Streak và phần thưởng EXP/Gold cho bạn.</p>
    </div>

    <!-- 5. Victory Summary Modal -->
    <div v-else-if="currentPhase === 'victory' && submitResult" class="victory-container theme-card">
      <div class="victory-header">
        <span class="trophy-emoji">🏆</span>
        <h1 class="victory-title">Hoàn Thành Thử Thách!</h1>
        <p class="victory-subtitle">{{ challenge?.themeVi }}</p>
      </div>

      <!-- Streak Showcase Card -->
      <div class="streak-showcase-box">
        <div class="flame-graphic">🔥</div>
        <div class="streak-details">
          <span class="streak-headline">{{ submitResult.currentStreak }} Ngày Liên Tiếp!</span>
          <span v-if="submitResult.isStreakExtended" class="streak-sub">
            Bạn đã duy trì ngọn lửa học tập hôm nay!
          </span>
          <span v-if="submitResult.shieldUsed" class="streak-shield-alert">
            🛡️ Khiên Băng đã tự động bảo vệ chuỗi ngày của bạn!
          </span>
        </div>
      </div>

      <!-- Rewards Banner -->
      <div class="rewards-summary-row">
        <div class="reward-pill exp-pill">
          <span class="reward-icon">⚡</span>
          <span class="reward-val">+{{ submitResult.earnedExp }} EXP</span>
        </div>
        <div class="reward-pill gold-pill">
          <span class="reward-icon">🪙</span>
          <span class="reward-val">+{{ submitResult.earnedGold }} Vàng</span>
        </div>
        <div v-if="submitResult.rewardUnlocked" class="reward-pill milestone-pill">
          <span class="reward-icon">🎁</span>
          <span class="reward-val">Mở khóa: {{ submitResult.rewardUnlocked }}</span>
        </div>
      </div>

      <!-- Breakdown Table -->
      <div class="breakdown-box">
        <h4 class="breakdown-title">Chi Tiết Điểm Từng Phần</h4>
        <div class="breakdown-grid">
          <div class="breakdown-item">
            <span class="breakdown-label">⚡ Vocab Sprint</span>
            <span class="breakdown-val">
              {{ phaseResults.vocabSprint.correctCount }}/{{ phaseResults.vocabSprint.totalCount }} từ
            </span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">🧩 Grammar Flash</span>
            <span class="breakdown-val">
              {{ phaseResults.grammarFlash.correctCount }}/{{ phaseResults.grammarFlash.totalCount }} câu
            </span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">🎙️ Voice Challenge</span>
            <span class="breakdown-val">
              {{ phaseResults.voiceChallenge.correctCount }}/{{ phaseResults.voiceChallenge.totalCount }} câu
            </span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">🤖 Quick Roleplay</span>
            <span class="breakdown-val">
              {{ phaseResults.quickRoleplay.turnsUsed }}/3 lượt
            </span>
          </div>
        </div>
      </div>

      <!-- Final Actions -->
      <div class="victory-actions">
        <button
          v-if="submitResult?.rewardUnlocked || activeRewardMilestone"
          type="button"
          class="view-milestone-reward-btn theme-btn-secondary"
          @click="isRewardModalOpen = true"
        >
          🎁 Xem Quà Mốc Thưởng
        </button>
        <button class="theme-btn-primary return-home-btn" @click="handleReturnHome">
          Quay Về Bản Đồ
        </button>
      </div>
    </div>

    <!-- Streak Milestone Reward Modal -->
    <StreakRewardModal
      v-model:is-open="isRewardModalOpen"
      :milestone="activeRewardMilestone"
      :streak-days="currentStreak"
      @claim="handleClaimMilestoneReward"
    />
  </div>
</template>

<style scoped>
.daily-challenge-page {
  min-height: calc(100vh - 65px);
  padding: 1.5rem 1rem 3rem;
  max-width: 820px;
  margin: 0 auto;
}

/* States Containers */
.state-container,
.intro-container,
.victory-container {
  padding: 2.25rem 1.75rem;
  text-align: center;
  border-radius: var(--radius-lg);
}

.spinner-pulse {
  width: 54px;
  height: 54px;
  border: 4px solid var(--border-color);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 1.5rem auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.state-title {
  font-size: 1.45rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
}

.state-subtitle {
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin-bottom: 1.5rem;
}

.state-actions,
.intro-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 1.5rem;
}

/* Intro Screen */
.theme-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-surface-translucent);
  border: 1px solid var(--border-color);
  padding: 0.35rem 1rem;
  border-radius: var(--radius-pill);
  font-size: 0.85rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.intro-title {
  font-size: 2rem;
  font-weight: 900;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.intro-desc {
  color: var(--text-secondary);
  font-size: 1rem;
  max-width: 600px;
  margin: 0 auto 1.5rem;
}

.streak-overview-box {
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: var(--bg-card-hover);
  border: 1px solid var(--border-color);
  padding: 1.25rem;
  border-radius: var(--radius-md);
  margin-bottom: 1.75rem;
}

.streak-col {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.streak-flame-icon {
  font-size: 2.25rem;
}

.streak-number {
  display: block;
  font-size: 1.85rem;
  font-weight: 900;
  line-height: 1;
  color: #ea580c;
}

.streak-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 700;
}

.streak-divider {
  width: 1px;
  height: 40px;
  background: var(--border-color);
}

.reset-countdown-col {
  display: flex;
  flex-direction: column;
}

.countdown-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.countdown-val {
  font-size: 1.35rem;
  font-weight: 800;
  font-family: monospace;
  color: var(--accent-primary);
}

.countdown-sub {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.streak-milestone-banner {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  padding: 0.85rem 1.15rem;
  border-radius: var(--radius-md);
  margin-top: -1rem;
  margin-bottom: 1.75rem;
  text-align: left;
  transition: all 0.2s ease;
}

.streak-milestone-banner.clickable {
  cursor: pointer;
}

.streak-milestone-banner.clickable:hover {
  border-color: #f59e0b;
  box-shadow: 0 4px 15px rgba(245, 158, 11, 0.15);
  transform: translateY(-1px);
}

.milestone-badge-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.milestone-preview-hint {
  font-size: 0.725rem;
  color: #f59e0b;
  font-weight: 700;
  text-decoration: underline;
}

.view-milestone-reward-btn {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #1e1b4b;
  border: none;
  font-weight: 800;
  padding: 0.85rem 1.4rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);
  transition: all 0.2s ease;
}

.view-milestone-reward-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(245, 158, 11, 0.5);
}

.milestone-text-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  margin-bottom: 0.45rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.milestone-title {
  color: var(--text-primary);
}

.milestone-remaining {
  font-size: 0.75rem;
  font-weight: 800;
  color: #ea580c;
  background: rgba(234, 88, 12, 0.1);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-pill);
}

.milestone-progress-track {
  width: 100%;
  height: 8px;
  background: var(--border-color);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.milestone-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #f97316, #eab308);
  border-radius: var(--radius-pill);
  transition: width 0.4s ease;
}

.phases-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
  margin-bottom: 1.75rem;
}

.phase-preview-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  padding: 1rem 0.75rem;
  border-radius: var(--radius-md);
  text-align: center;
}

.phase-badge {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 800;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-pill);
  margin-bottom: 0.5rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.phase-icon {
  font-size: 1.75rem;
  display: block;
  margin-bottom: 0.35rem;
}

.phase-preview-card h4 {
  font-size: 0.9rem;
  font-weight: 800;
  margin-bottom: 0.25rem;
}

.phase-preview-card p {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.3;
}

.already-completed-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.4);
  padding: 0.85rem 1.25rem;
  border-radius: var(--radius-md);
  margin-bottom: 1.5rem;
  text-align: left;
}

.already-completed-banner .check-icon {
  font-size: 1.5rem;
}

.banner-text strong {
  display: block;
  color: #065f46;
}

.banner-text span {
  font-size: 0.85rem;
  color: #047857;
}

/* Persistent HUD */
.challenge-hud {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.25rem;
  border-radius: var(--radius-md);
  margin-bottom: 1.25rem;
}

.hud-left {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.hud-theme-icon {
  font-size: 1.5rem;
}

.hud-phase-name {
  display: block;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--accent-primary);
}

.hud-theme-title {
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.timer-box {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--bg-card-hover);
  border: 1px solid var(--border-color);
  padding: 0.35rem 0.85rem;
  border-radius: var(--radius-pill);
  font-weight: 800;
  font-family: monospace;
  font-size: 1.1rem;
}

.timer-urgent {
  background: rgba(239, 68, 68, 0.15);
  border-color: #ef4444;
  color: #b91c1c;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.hud-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.score-badge {
  text-align: right;
}

.score-label {
  display: block;
  font-size: 0.65rem;
  color: var(--text-muted);
}

.score-value {
  display: block;
  font-size: 1.1rem;
  font-weight: 900;
  color: #f59e0b;
}

.combo-pill {
  background: linear-gradient(135deg, #f97316, #ef4444);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-pill);
}

/* Phase Workspaces */
.phase-workspace {
  padding: 1.75rem 1.5rem;
  border-radius: var(--radius-lg);
}

.workspace-stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-muted);
  margin-bottom: 1.25rem;
}

.pattern-pill {
  background: var(--bg-card-hover);
  border: 1px solid var(--border-color);
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-pill);
  color: var(--accent-primary);
}

/* Phase 1 Vocab Sprint */
.vocab-flashcard {
  text-align: center;
}

.vocab-top-meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  margin-bottom: 0.75rem;
}

.vocab-emoji {
  font-size: 2rem;
}

.vocab-ipa {
  font-size: 1rem;
  color: var(--text-secondary);
  font-family: monospace;
}

.audio-speaker-btn {
  background: var(--bg-card-hover);
  border: 1px solid var(--border-color);
  border-radius: 50%;
  width: 34px;
  height: 34px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.vocab-word-display {
  font-size: 2.25rem;
  font-weight: 900;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.vocab-example {
  font-size: 0.95rem;
  font-style: italic;
  color: var(--text-secondary);
  margin-bottom: 1.75rem;
}

.vocab-options-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  max-width: 560px;
  margin: 0 auto;
}

@media (min-width: 600px) {
  .vocab-options-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.vocab-option-btn {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  background: var(--bg-surface);
  border: 2px solid var(--border-color);
  padding: 1rem 1.25rem;
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.vocab-option-btn:hover:not(:disabled) {
  border-color: var(--accent-primary);
  transform: translateY(-2px);
}

.option-letter {
  background: var(--bg-secondary);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
}

.selected-correct {
  background: rgba(16, 185, 129, 0.15) !important;
  border-color: #10b981 !important;
  color: #065f46;
}

.selected-wrong {
  background: rgba(239, 68, 68, 0.15) !important;
  border-color: #ef4444 !important;
  color: #991b1b;
  animation: shake 0.3s;
}

.highlight-correct {
  border-color: #10b981 !important;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}

/* Phase 2 Grammar Flash */
.vietnamese-prompt-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--bg-secondary);
  padding: 1rem 1.25rem;
  border-radius: var(--radius-md);
  margin-bottom: 1.25rem;
}

.vietnamese-text {
  font-size: 1.15rem;
  font-weight: 800;
  margin: 0;
}

.sentence-assembly-area {
  min-height: 80px;
  border: 2px dashed var(--border-color);
  background: var(--bg-card-hover);
  border-radius: var(--radius-md);
  padding: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 1.25rem;
}

.assembly-placeholder {
  color: var(--text-muted);
  font-size: 0.9rem;
  width: 100%;
  text-align: center;
}

.assembly-correct {
  border-color: #10b981 !important;
  background: rgba(16, 185, 129, 0.1);
}

.assembly-wrong {
  border-color: #ef4444 !important;
  background: rgba(239, 68, 68, 0.1);
}

.placed-token-chip {
  background: var(--accent-primary);
  color: #fff;
  padding: 0.45rem 0.85rem;
  border-radius: var(--radius-pill);
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
}

.word-bank-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.bank-token-btn {
  background: var(--bg-surface);
  border: 2px solid var(--border-color);
  padding: 0.6rem 1rem;
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.bank-token-btn:hover {
  border-color: var(--accent-primary);
  transform: translateY(-2px);
}

.grammar-actions-bar {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.grammar-feedback-alert {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid #f59e0b;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  color: #92400e;
  margin-bottom: 1.25rem;
}

/* Phase 3 Voice Challenge */
.voice-target-box {
  background: var(--bg-card-hover);
  border: 1px solid var(--border-color);
  padding: 1.5rem;
  border-radius: var(--radius-md);
  text-align: center;
  margin-bottom: 1.5rem;
}

.voice-top-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.focus-badge {
  background: var(--bg-secondary);
  font-size: 0.75rem;
  font-weight: 800;
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-pill);
}

.speaker-pill-btn {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-pill);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.target-sentence-text {
  font-size: 1.75rem;
  font-weight: 900;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.target-sentence-translation {
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.voice-mic-zone {
  text-align: center;
}

.big-mic-button {
  background: var(--bg-surface);
  border: 3px solid var(--border-color);
  padding: 1.25rem 2rem;
  border-radius: var(--radius-pill);
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: 800;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
}

.big-mic-button:hover {
  transform: scale(1.03);
}

.mic-active {
  background: rgba(239, 68, 68, 0.15) !important;
  border-color: #ef4444 !important;
  color: #b91c1c;
  animation: pulse 1.2s infinite;
}

.mic-passed {
  background: rgba(16, 185, 129, 0.15) !important;
  border-color: #10b981 !important;
}

.voice-status-box {
  margin-top: 1rem;
  font-size: 0.95rem;
  font-weight: 700;
}

.score-tag {
  display: inline-block;
  background: var(--bg-card-hover);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-pill);
  font-size: 0.8rem;
  margin-left: 0.5rem;
}

.mic-fallback-toggle {
  margin-top: 1.25rem;
}

.text-link-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.85rem;
  text-decoration: underline;
  cursor: pointer;
}

.manual-input-box {
  display: flex;
  gap: 0.5rem;
  max-width: 500px;
  margin: 1rem auto 0;
}

.manual-text-field {
  flex: 1;
  padding: 0.65rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  font-size: 0.95rem;
}

/* Phase 4 Quick Roleplay */
.roleplay-scenario-tag {
  font-size: 0.85rem;
  color: var(--accent-primary);
}

.chat-messages-scroll {
  min-height: 220px;
  max-height: 340px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-card-hover);
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
}

.chat-bubble-wrapper {
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
  max-width: 85%;
}

.user-bubble-wrapper {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.bubble-avatar {
  font-size: 1.5rem;
}

.bubble-body {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
}

.assistant-bubble-wrapper .bubble-body {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
}

.user-bubble-wrapper .bubble-body {
  background: var(--accent-primary);
  color: #fff;
}

.bubble-text {
  font-size: 0.95rem;
  margin: 0;
  line-height: 1.4;
}

.bubble-hint-vi {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 0.35rem;
  border-top: 1px solid var(--border-color);
  padding-top: 0.25rem;
}

.bubble-grammar-fix {
  font-size: 0.8rem;
  color: #b45309;
  margin-top: 0.25rem;
}

.starter-chips-container {
  margin-bottom: 0.75rem;
}

.chips-title {
  font-size: 0.75rem;
  color: var(--text-muted);
  display: block;
  margin-bottom: 0.35rem;
}

.chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.starter-chip-btn {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  padding: 0.3rem 0.65rem;
  border-radius: var(--radius-pill);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.starter-chip-btn:hover {
  border-color: var(--accent-primary);
}

.chat-input-row {
  display: flex;
  gap: 0.5rem;
}

.chat-input-field {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  font-size: 0.95rem;
}

/* Victory Summary */
.trophy-emoji {
  font-size: 3.5rem;
  display: block;
  margin-bottom: 0.5rem;
}

.victory-title {
  font-size: 2rem;
  font-weight: 900;
  margin-bottom: 0.25rem;
}

.victory-subtitle {
  color: var(--text-secondary);
  font-size: 1rem;
  margin-bottom: 1.5rem;
}

.streak-showcase-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: linear-gradient(135deg, rgba(249, 115, 22, 0.15), rgba(239, 68, 68, 0.15));
  border: 2px solid #f97316;
  padding: 1.25rem;
  border-radius: var(--radius-md);
  margin-bottom: 1.5rem;
}

.flame-graphic {
  font-size: 3rem;
}

.streak-headline {
  display: block;
  font-size: 1.5rem;
  font-weight: 900;
  color: #ea580c;
}

.streak-sub {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.rewards-summary-row {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.reward-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-pill);
  font-weight: 800;
  font-size: 0.95rem;
}

.exp-pill {
  background: rgba(16, 185, 129, 0.15);
  color: #065f46;
}

.gold-pill {
  background: rgba(245, 158, 11, 0.15);
  color: #92400e;
}

.milestone-pill {
  background: rgba(168, 85, 247, 0.15);
  color: #6b21a8;
}

.breakdown-box {
  background: var(--bg-card-hover);
  border: 1px solid var(--border-color);
  padding: 1.25rem;
  border-radius: var(--radius-md);
  margin-bottom: 1.5rem;
}

.breakdown-title {
  font-size: 0.9rem;
  font-weight: 800;
  margin-bottom: 0.75rem;
  text-align: left;
}

.breakdown-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  text-align: left;
}

.breakdown-label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.breakdown-val {
  font-size: 0.95rem;
  font-weight: 700;
}
</style>

