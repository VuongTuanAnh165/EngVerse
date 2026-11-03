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

// Collocations Knowledge State (Task 1.11)
const activeHintVocab = ref<StageVocabItem | null>(null);
const matchedVocabsHistory = ref<StageVocabItem[]>([]);
const showCompletionSummary = ref<boolean>(false);

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
      collocations: v.collocations ? [...v.collocations] : undefined,
      realWorldPhrase: v.realWorldPhrase,
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
      collocations: v.collocations ? [...v.collocations] : undefined,
      realWorldPhrase: v.realWorldPhrase,
    });
  }

  // Pre-select first vocab for initial hint
  if (selectedVocabs.length > 0 && selectedVocabs[0]) {
    activeHintVocab.value = selectedVocabs[0];
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

  // Set active hint vocab for knowledge reinforcement (Task 1.11)
  const vocabs: StageVocabItem[] = props.stage.vocabPool || props.stage.vocabList || [];
  const foundVocab = vocabs.find((v) => v.id === card.vocabId);
  if (foundVocab) {
    activeHintVocab.value = foundVocab;
  }

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

    // Track matched vocab in history for summary
    const vocabs: StageVocabItem[] = props.stage.vocabPool || props.stage.vocabList || [];
    const matchedVocab = vocabs.find((v) => v.id === first.vocabId);
    if (matchedVocab) {
      activeHintVocab.value = matchedVocab;
      if (!matchedVocabsHistory.value.some((mv) => mv.id === matchedVocab.id)) {
        matchedVocabsHistory.value.push(matchedVocab);
      }
    }

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
      playSound('combo_fever');
      showCompletionSummary.value = true;
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

function pronounceCollocation(phrase: string, e?: Event): void {
  if (e) e.stopPropagation();
  playSound('click');
  void speak(phrase);
}

function handleFinishGame(): void {
  playSound('click');
  emit('completed');
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

    <!-- Collocation Knowledge Hint Banner (Task 1.11) -->
    <Transition name="fade-slide">
      <div v-if="activeHintVocab && activeHintVocab.collocations?.length" class="collocation-hint-banner">
        <div class="hint-header">
          <span class="hint-icon" aria-hidden="true">💡</span>
          <span class="hint-word">{{ activeHintVocab.word }}</span>
          <span class="hint-ipa">{{ activeHintVocab.ipa }}</span>
          <span class="hint-pos">({{ activeHintVocab.partOfSpeech }})</span>
          <span class="hint-meaning">— {{ activeHintVocab.meaning }}</span>
        </div>

        <div class="hint-collocations-row">
          <span class="colloc-badge-label">Cụm từ đi kèm (Collocations):</span>
          <div class="colloc-chips">
            <button
              v-for="(colloc, cIdx) in activeHintVocab.collocations"
              :key="cIdx"
              type="button"
              class="colloc-chip-btn"
              title="Bấm để nghe phát âm cụm từ này"
              @click="pronounceCollocation(colloc, $event)"
            >
              <span>🔊</span>
              <span>{{ colloc }}</span>
            </button>
          </div>
        </div>

        <div v-if="activeHintVocab.realWorldPhrase" class="hint-phrase-row">
          <span class="phrase-icon" aria-hidden="true">💬</span>
          <span class="phrase-text">"{{ activeHintVocab.realWorldPhrase }}"</span>
        </div>
      </div>
    </Transition>

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
          <span
            v-if="card.type === 'word' && card.collocations?.length"
            class="card-colloc-indicator"
            title="Có 3 cụm từ gợi ý đi kèm"
          >
            ✨ 3 cụm từ
          </span>
        </div>
      </button>
    </div>

    <!-- Completion Knowledge Summary Modal (Task 1.11) -->
    <Transition name="celebrate-fade">
      <div v-if="showCompletionSummary" class="summary-overlay">
        <div class="summary-card theme-card">
          <div class="summary-header">
            <div class="summary-emblem">✨</div>
            <h2 class="summary-title">Thu Thập Tri Thức Thành Công!</h2>
            <p class="summary-subtitle">
              Bạn đã mở khóa toàn bộ {{ totalPairs }} từ vựng và các cụm từ thực tế của chặng này!
            </p>
          </div>

          <div class="unlocked-vocabs-list">
            <div
              v-for="vocab in matchedVocabsHistory"
              :key="vocab.id"
              class="unlocked-vocab-item"
            >
              <div class="vocab-main-line">
                <span class="vocab-emoji">{{ vocab.emoji || '✨' }}</span>
                <strong class="vocab-word">{{ vocab.word }}</strong>
                <span class="vocab-ipa">{{ vocab.ipa }}</span>
                <span class="vocab-meaning">{{ vocab.meaning }}</span>
                <button
                  type="button"
                  class="speak-btn-mini"
                  title="Nghe phát âm từ vựng"
                  @click="speak(vocab.word)"
                >
                  🔊
                </button>
              </div>

              <div v-if="vocab.collocations?.length" class="vocab-collocs-line">
                <span class="collocs-intro">Cụm từ:</span>
                <span
                  v-for="(c, idx) in vocab.collocations"
                  :key="idx"
                  class="unlocked-colloc-tag"
                  title="Bấm để nghe phát âm"
                  @click="pronounceCollocation(c)"
                >
                  {{ c }} 🔊
                </span>
              </div>

              <p v-if="vocab.realWorldPhrase" class="vocab-phrase-line">
                💬 {{ vocab.realWorldPhrase }}
              </p>
            </div>
          </div>

          <div class="summary-actions">
            <button
              type="button"
              class="theme-btn-primary advance-phase-btn"
              @click="handleFinishGame"
            >
              <span>Tiếp Tục Luyện Phát Âm (Voice Runner)</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
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

/* Collocation Knowledge Hint Banner (Task 1.11) */
.collocation-hint-banner {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95));
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-radius: var(--radius-lg);
  padding: 0.85rem 1.25rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.hint-header {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.875rem;
  flex-wrap: wrap;
}

.hint-icon {
  font-size: 1rem;
}

.hint-word {
  font-weight: 800;
  color: #38bdf8;
  font-size: 1.05rem;
}

.hint-ipa {
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.hint-pos {
  font-size: 0.75rem;
  font-style: italic;
  color: var(--accent-primary);
}

.hint-meaning {
  font-weight: 700;
  color: var(--text-secondary);
}

.hint-collocations-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.colloc-badge-label {
  font-size: 0.6875rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 0.04em;
}

.colloc-chips {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.colloc-chip-btn {
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: #38bdf8;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-pill);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  transition: all 0.2s ease;
}

.colloc-chip-btn:hover {
  background: rgba(56, 189, 248, 0.25);
  border-color: #38bdf8;
  color: #ffffff;
  transform: translateY(-1px);
}

.hint-phrase-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
  color: #10b981;
  font-style: italic;
  background: rgba(16, 185, 129, 0.08);
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  border-left: 3px solid #10b981;
}

/* Card Colloc Indicator */
.card-colloc-indicator {
  font-size: 0.625rem;
  font-weight: 700;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.12);
  padding: 1px 6px;
  border-radius: 4px;
  margin-top: 2px;
}

/* Completion Knowledge Showcase Modal */
.summary-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  z-index: 1000;
}

.summary-card {
  width: 100%;
  max-width: 620px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border: 2px solid var(--accent-primary);
  border-radius: var(--radius-xl, 20px);
  padding: 1.75rem;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  animation: zoom-in-modal 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes zoom-in-modal {
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
}

.summary-header {
  text-align: center;
  margin-bottom: 1.25rem;
}

.summary-emblem {
  font-size: 2.5rem;
  margin-bottom: 0.25rem;
}

.summary-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--text-primary);
}

.summary-subtitle {
  margin: 0.35rem 0 0 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.unlocked-vocabs-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  max-height: 45vh;
  padding-right: 0.4rem;
  margin-bottom: 1.25rem;
}

.unlocked-vocab-item {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.vocab-main-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.vocab-emoji {
  font-size: 1.25rem;
}

.vocab-word {
  font-size: 1rem;
  color: var(--text-primary);
}

.vocab-ipa {
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.vocab-meaning {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--accent-primary);
  margin-left: 0.25rem;
}

.speak-btn-mini {
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: var(--text-primary);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  cursor: pointer;
  margin-left: auto;
  transition: all 0.2s;
}

.speak-btn-mini:hover {
  background: var(--accent-primary);
  color: var(--accent-text);
  transform: scale(1.1);
}

.vocab-collocs-line {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.collocs-intro {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--text-muted);
}

.unlocked-colloc-tag {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.25);
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.unlocked-colloc-tag:hover {
  background: rgba(56, 189, 248, 0.25);
  color: #ffffff;
}

.vocab-phrase-line {
  margin: 0;
  font-size: 0.75rem;
  color: #10b981;
  font-style: italic;
}

.summary-actions {
  display: flex;
  justify-content: center;
}

.advance-phase-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1.75rem;
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
}

/* Animations */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.celebrate-fade-enter-active,
.celebrate-fade-leave-active {
  transition: all 0.3s ease;
}

.celebrate-fade-enter-from,
.celebrate-fade-leave-to {
  opacity: 0;
}

/* ==========================================================================
   THEME OVERRIDES: ĐẢO THẦN THOẠI (KIDS MODE)
   ========================================================================== */
html[data-theme="kids"] .alchemy-card {
  background: #ffffff;
  border: 2px solid #fde68a;
  box-shadow: 0 4px 14px rgba(217, 119, 6, 0.08);
  color: #3b1d07;
}

html[data-theme="kids"] .alchemy-card:hover:not(.card-matched):not(.card-selected) {
  border-color: #f59e0b;
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(217, 119, 6, 0.15);
}

html[data-theme="kids"] .card-selected {
  background: #fef3c7 !important;
  border-color: #f59e0b !important;
  box-shadow: 0 0 16px rgba(245, 158, 11, 0.4) !important;
}

html[data-theme="kids"] .card-colloc-indicator {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}

/* Collocation Hint Banner - Kids */
html[data-theme="kids"] .collocation-hint-banner {
  background: #ffffff;
  border: 2px solid #fde68a;
  box-shadow: 0 8px 24px rgba(217, 119, 6, 0.1);
}

html[data-theme="kids"] .hint-word {
  color: #b45309;
}

html[data-theme="kids"] .hint-ipa {
  color: #92400e;
}

html[data-theme="kids"] .hint-pos {
  color: #d97706;
}

html[data-theme="kids"] .hint-meaning {
  color: #3b1d07;
}

html[data-theme="kids"] .colloc-badge-label {
  color: #78350f;
}

html[data-theme="kids"] .colloc-chip-btn {
  background: #fef3c7;
  border: 1.5px solid #fde68a;
  color: #92400e;
}

html[data-theme="kids"] .colloc-chip-btn:hover {
  background: #fde68a;
  border-color: #f59e0b;
  color: #78350f;
}

html[data-theme="kids"] .hint-phrase-row {
  background: #f0fdf4;
  border-left: 3px solid #16a34a;
  color: #166534;
}

/* Summary Modal - Kids */
html[data-theme="kids"] .summary-overlay {
  background: rgba(45, 27, 10, 0.65);
}

html[data-theme="kids"] .summary-card {
  background: #ffffff;
  border: 3px solid #f59e0b;
  box-shadow: 0 20px 50px rgba(217, 119, 6, 0.25);
}

html[data-theme="kids"] .summary-title {
  color: #3b1d07;
}

html[data-theme="kids"] .summary-subtitle {
  color: #78350f;
}

html[data-theme="kids"] .unlocked-vocab-item {
  background: #fffdf5;
  border: 1.5px solid #fde68a;
  box-shadow: 0 2px 8px rgba(217, 119, 6, 0.06);
}

html[data-theme="kids"] .vocab-word {
  color: #3b1d07;
  font-weight: 800;
}

html[data-theme="kids"] .vocab-ipa {
  color: #92400e;
}

html[data-theme="kids"] .vocab-meaning {
  color: #b45309;
}

html[data-theme="kids"] .collocs-intro {
  color: #78350f;
}

html[data-theme="kids"] .unlocked-colloc-tag {
  background: #ffffff;
  border: 1px solid #fde68a;
  color: #92400e;
}

html[data-theme="kids"] .unlocked-colloc-tag:hover {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #78350f;
}

html[data-theme="kids"] .vocab-phrase-line {
  background: #f0fdf4;
  border-left: 2px solid #16a34a;
  color: #166534;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

html[data-theme="kids"] .speak-btn-mini {
  background: #fef3c7;
  color: #92400e;
}

html[data-theme="kids"] .speak-btn-mini:hover {
  background: #f59e0b;
  color: #ffffff;
}

html[data-theme="kids"] .advance-phase-btn {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #ffffff;
  border: 2px solid #b45309;
  box-shadow: 0 4px 0 #b45309, 0 8px 18px rgba(217, 119, 6, 0.35);
}

/* ==========================================================================
   THEME OVERRIDES: SIMLIFE GLOBAL (ADULTS MODE)
   ========================================================================== */
html[data-theme="adults"] .alchemy-card {
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
  color: #0f172a;
}

html[data-theme="adults"] .alchemy-card:hover:not(.card-matched):not(.card-selected) {
  border-color: #0284c7;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
}

html[data-theme="adults"] .card-selected {
  background: #f0f9ff !important;
  border-color: #0284c7 !important;
  box-shadow: 0 0 16px rgba(2, 132, 199, 0.3) !important;
}

html[data-theme="adults"] .card-colloc-indicator {
  background: #f1f5f9;
  color: #0284c7;
  border: 1px solid #cbd5e1;
}

/* Collocation Hint Banner - Adults */
html[data-theme="adults"] .collocation-hint-banner {
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}

html[data-theme="adults"] .hint-word {
  color: #0f172a;
}

html[data-theme="adults"] .hint-ipa {
  color: #64748b;
}

html[data-theme="adults"] .hint-pos {
  color: #0284c7;
}

html[data-theme="adults"] .hint-meaning {
  color: #334155;
}

html[data-theme="adults"] .colloc-badge-label {
  color: #475569;
}

html[data-theme="adults"] .colloc-chip-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #1e293b;
}

html[data-theme="adults"] .colloc-chip-btn:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
  color: #0f172a;
}

html[data-theme="adults"] .hint-phrase-row {
  background: #f8fafc;
  border-left: 3px solid #0284c7;
  color: #0f172a;
}

/* Summary Modal - Adults */
html[data-theme="adults"] .summary-overlay {
  background: rgba(15, 23, 42, 0.65);
}

html[data-theme="adults"] .summary-card {
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.15);
}

html[data-theme="adults"] .summary-title {
  color: #0f172a;
}

html[data-theme="adults"] .summary-subtitle {
  color: #475569;
}

html[data-theme="adults"] .unlocked-vocab-item {
  background: #f8fafc;
  border: 1.5px solid #cbd5e1;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
}

html[data-theme="adults"] .vocab-word {
  color: #0f172a;
  font-weight: 800;
}

html[data-theme="adults"] .vocab-ipa {
  color: #64748b;
}

html[data-theme="adults"] .vocab-meaning {
  color: #0284c7;
}

html[data-theme="adults"] .collocs-intro {
  color: #475569;
}

html[data-theme="adults"] .unlocked-colloc-tag {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #1e293b;
}

html[data-theme="adults"] .unlocked-colloc-tag:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
  color: #0f172a;
}

html[data-theme="adults"] .vocab-phrase-line {
  background: #f1f5f9;
  border-left: 2px solid #0284c7;
  color: #0f172a;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

html[data-theme="adults"] .speak-btn-mini {
  background: #e2e8f0;
  color: #1e293b;
}

html[data-theme="adults"] .speak-btn-mini:hover {
  background: #0284c7;
  color: #ffffff;
}

html[data-theme="adults"] .advance-phase-btn {
  background: #0284c7;
  color: #ffffff;
  border: 1.5px solid #0369a1;
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);
}
</style>

