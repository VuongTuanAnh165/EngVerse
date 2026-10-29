<script setup lang="ts">
import { ref, computed, onMounted, onScopeDispose } from 'vue';
import type { StageData, StageVocabItem, AlchemyCard } from '~/types/game';
import { useGameSessionStore } from '~/stores/gameSession';
import { useSoundEffects } from '~/composables/useSoundEffects';
import { useSpeechEngine } from '~/composables/useSpeechEngine';

interface Props {
  stage: StageData;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'completed'): void;
  (e: 'failed'): void;
}>();

const sessionStore = useGameSessionStore();
const { playSound, triggerScreenShake } = useSoundEffects();
const { speak } = useSpeechEngine();

// -------------------------------------------------------------------------
// Component State
// -------------------------------------------------------------------------
const cards = ref<AlchemyCard[]>([]);
const selectedCards = ref<AlchemyCard[]>([]);
const matchedCount = ref<number>(0);
const totalPairs = ref<number>(0);
const isProcessing = ref<boolean>(false);

// Countdown timer
const timeRemaining = ref<number>(45);
let timerInterval: ReturnType<typeof setInterval> | null = null;
let mismatchTimeout: ReturnType<typeof setTimeout> | null = null;

// -------------------------------------------------------------------------
// Computed
// -------------------------------------------------------------------------
const isAllMatched = computed<boolean>(() => {
  return totalPairs.value > 0 && matchedCount.value >= totalPairs.value;
});

const progressPercent = computed<number>(() => {
  if (totalPairs.value === 0) return 0;
  return Math.round((matchedCount.value / totalPairs.value) * 100);
});

// -------------------------------------------------------------------------
// Setup Puzzle Cards
// -------------------------------------------------------------------------
function initCards(): void {
  const vocabs: StageVocabItem[] =
    props.stage.vocabPool || props.stage.vocabList || [];

  // Pick up to config.vocabPickCount items
  const pickCount = Math.min(props.stage.config?.vocabPickCount || 4, vocabs.length);
  const selectedVocabs = vocabs.slice(0, pickCount);
  totalPairs.value = selectedVocabs.length;
  matchedCount.value = 0;
  selectedCards.value = [];

  const cardList: AlchemyCard[] = [];

  for (const v of selectedVocabs) {
    // English Word Card
    cardList.push({
      id: `word_${v.id}`,
      vocabId: v.id,
      type: 'word',
      text: v.word,
      subtext: v.ipa,
      emoji: v.emoji,
      isMatched: false,
      isSelected: false,
      isWrong: false,
    });

    // Vietnamese Meaning Card
    cardList.push({
      id: `meaning_${v.id}`,
      vocabId: v.id,
      type: 'meaning',
      text: v.meaning,
      subtext: v.partOfSpeech,
      emoji: v.emoji,
      isMatched: false,
      isSelected: false,
      isWrong: false,
    });
  }

  // Shuffle all cards with Fisher-Yates
  for (let i = cardList.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = cardList[i]!;
    cardList[i] = cardList[j]!;
    cardList[j] = temp;
  }

  cards.value = cardList;

  // Initialize Timer
  timeRemaining.value = Math.max(30, totalPairs.value * 10);
  startTimer();
}

function startTimer(): void {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (timeRemaining.value > 0) {
      timeRemaining.value--;
    } else {
      handleTimeOut();
    }
  }, 1000);
}

function handleTimeOut(): void {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  playSound('wrong');
  triggerScreenShake('heavy');
  sessionStore.takeDamage(1);

  if (sessionStore.isAlive) {
    // Give extra 15s to retry
    timeRemaining.value = 15;
    startTimer();
  } else {
    emit('failed');
  }
}

// -------------------------------------------------------------------------
// Card Interaction Logic
// -------------------------------------------------------------------------
function handleCardClick(card: AlchemyCard): void {
  if (isProcessing.value || card.isMatched || card.isSelected) {
    return;
  }

  playSound('click');

  // If clicked English word card, pronounce it via TTS
  if (card.type === 'word') {
    void speak(card.text);
  }

  card.isSelected = true;
  selectedCards.value.push(card);

  // When two cards are selected, evaluate match
  if (selectedCards.value.length === 2) {
    evaluateSelectedPair();
  }
}

function evaluateSelectedPair(): void {
  const [first, second] = selectedCards.value;
  if (!first || !second) return;

  isProcessing.value = true;

  // Check if both cards point to the same vocab item AND are different types (word vs meaning)
  const isMatch = first.vocabId === second.vocabId && first.type !== second.type;

  if (isMatch) {
    // Successful match
    first.isMatched = true;
    second.isMatched = true;
    first.isSelected = false;
    second.isSelected = false;

    matchedCount.value++;
    selectedCards.value = [];
    isProcessing.value = false;

    sessionStore.recordAnswer({
      questionId: first.vocabId,
      itemType: 'vocab',
      isCorrect: true,
      timeSpentMs: 1200,
      userResponse: `${first.text} <=> ${second.text}`,
      expectedResponse: `${first.text} <=> ${second.text}`,
      scoreAwarded: 150,
    });

    // Check if entire stage mini-game is completed
    if (isAllMatched.value) {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      setTimeout(() => {
        emit('completed');
      }, 600);
    }
  } else {
    // Mismatch
    first.isWrong = true;
    second.isWrong = true;

    sessionStore.recordAnswer({
      questionId: first.vocabId,
      itemType: 'vocab',
      isCorrect: false,
      timeSpentMs: 1200,
      userResponse: `${first.text} != ${second.text}`,
      expectedResponse: first.vocabId,
      scoreAwarded: 0,
    });

    mismatchTimeout = setTimeout(() => {
      first.isSelected = false;
      second.isSelected = false;
      first.isWrong = false;
      second.isWrong = false;
      selectedCards.value = [];
      isProcessing.value = false;
    }, 550);
  }
}

// -------------------------------------------------------------------------
// Lifecycle
// -------------------------------------------------------------------------
onMounted(() => {
  initCards();
});

onScopeDispose(() => {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (mismatchTimeout) {
    clearTimeout(mismatchTimeout);
    mismatchTimeout = null;
  }
});
</script>

<template>
  <div class="alchemy-game-container">
    <!-- Header HUD -->
    <div class="game-hud">
      <div class="hud-item-box">
        <span class="hud-label">Thời Gian</span>
        <span class="hud-val" :class="{ 'val-urgent': timeRemaining <= 10 }">
          ⏱️ {{ timeRemaining }}s
        </span>
      </div>

      <!-- Fever & Combo Counter -->
      <div class="fever-hud-box" :class="{ 'fever-active': sessionStore.isFeverActive }">
        <span class="fever-title">
          {{ sessionStore.isFeverActive ? '🔥 FEVER x2!' : 'Combo' }}
        </span>
        <div class="fever-pips">
          <span
            v-for="p in 5"
            :key="p"
            class="fever-pip"
            :class="{ 'fever-pip-filled': p <= sessionStore.feverProgress }"
          />
        </div>
      </div>

      <div class="hud-item-box">
        <span class="hud-label">Tiến Độ</span>
        <span class="hud-val">✨ {{ matchedCount }}/{{ totalPairs }}</span>
      </div>
    </div>

    <!-- Progress Gauge -->
    <div class="progress-bar-track">
      <div class="progress-bar-fill" :style="{ width: `${progressPercent}%` }" />
    </div>

    <!-- Instructions -->
    <div class="game-instruction">
      <p>Chạm vào một <strong>Từ Tiếng Anh</strong> và <strong>Nghĩa Tiếng Việt</strong> tương ứng để hợp nhất!</p>
    </div>

    <!-- Interactive Alchemy Cards Grid -->
    <div class="alchemy-grid">
      <button
        v-for="card in cards"
        :key="card.id"
        type="button"
        class="alchemy-card"
        :class="{
          'card-selected': card.isSelected,
          'card-matched': card.isMatched,
          'card-wrong': card.isWrong,
          'card-word': card.type === 'word',
          'card-meaning': card.type === 'meaning'
        }"
        :disabled="card.isMatched || isProcessing"
        @click="handleCardClick(card)"
      >
        <div class="card-inner">
          <span v-if="card.emoji" class="card-emoji" aria-hidden="true">{{ card.emoji }}</span>
          <span class="card-main-text">{{ card.text }}</span>
          <span v-if="card.subtext" class="card-sub-text">{{ card.subtext }}</span>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.alchemy-game-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
  max-width: 780px;
  margin: 0 auto;
  user-select: none;
}

/* HUD Header */
.game-hud {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.hud-item-box {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hud-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
}

.hud-val {
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--text-primary);
}

.val-urgent {
  color: #ef4444 !important;
  animation: pulse-urgent 0.8s infinite;
}

@keyframes pulse-urgent {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

/* Fever & Combo Gauge */
.fever-hud-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.fever-title {
  font-size: 0.8125rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  color: var(--accent-primary);
  transition: all 0.2s ease;
}

.fever-active .fever-title {
  color: #ef4444;
  text-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
  animation: fever-glow 1.2s infinite alternate;
}

@keyframes fever-glow {
  from { transform: scale(1); }
  to { transform: scale(1.1); }
}

.fever-pips {
  display: flex;
  gap: 0.3rem;
}

.fever-pip {
  width: 14px;
  height: 6px;
  border-radius: var(--radius-pill);
  background-color: var(--border-color);
  transition: background-color 0.25s ease;
}

.fever-pip-filled {
  background: var(--accent-gradient);
  box-shadow: 0 0 6px rgba(245, 158, 11, 0.5);
}

/* Progress Bar */
.progress-bar-track {
  width: 100%;
  height: 8px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--accent-gradient);
  border-radius: var(--radius-pill);
  transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Instruction */
.game-instruction {
  text-align: center;
}

.game-instruction p {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}

/* Alchemy Grid */
.alchemy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
}

/* Card Button */
.alchemy-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 110px;
  padding: 1rem;
  background-color: var(--bg-surface);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-lg);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: inherit;
  outline: none;
}

.alchemy-card:hover:not(:disabled) {
  transform: translateY(-3px);
  border-color: var(--border-focus);
  box-shadow: var(--shadow-md);
}

.card-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.25rem;
}

.card-emoji {
  font-size: 1.75rem;
  line-height: 1;
}

.card-main-text {
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.25;
}

.card-sub-text {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
}

/* Selected Card */
.card-selected {
  border-color: var(--accent-primary) !important;
  box-shadow: var(--glow-accent) !important;
  transform: scale(1.03) !important;
  background: linear-gradient(135deg, var(--bg-surface) 0%, rgba(245, 158, 11, 0.1) 100%);
}

/* Matched Card */
.card-matched {
  opacity: 0.25;
  filter: grayscale(0.8);
  cursor: not-allowed;
  transform: scale(0.96);
  border-color: #10b981;
}

/* Wrong Match Animation */
.card-wrong {
  border-color: #ef4444 !important;
  background-color: rgba(239, 68, 68, 0.1) !important;
  animation: card-shake 0.4s ease-in-out both;
}

@keyframes card-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  50% { transform: translateX(6px); }
  75% { transform: translateX(-3px); }
}

@media (max-width: 640px) {
  .alchemy-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
  .alchemy-card {
    min-height: 95px;
    padding: 0.75rem 0.5rem;
  }
}
</style>

