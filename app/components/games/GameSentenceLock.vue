<script setup lang="ts">
import { ref, computed, onMounted, onScopeDispose } from 'vue';
import type { StageData, StageGrammarItem, RuneStone, FunctionalGrammarCategory } from '~/types/game';
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
const puzzles = ref<StageGrammarItem[]>([]);
const currentPuzzleIndex = ref<number>(0);
const runeStones = ref<RuneStone[]>([]);
const placedRunes = ref<RuneStone[]>([]);
const isChestUnlocked = ref<boolean>(false);
const isEvaluating = ref<boolean>(false);
const feedbackMessage = ref<string>('');
const isFeedbackError = ref<boolean>(false);

// -------------------------------------------------------------------------
// Computed
// -------------------------------------------------------------------------
const currentPuzzle = computed<StageGrammarItem | null>(() => {
  return puzzles.value[currentPuzzleIndex.value] || null;
});

const totalPuzzles = computed<number>(() => puzzles.value.length);

const progressPercent = computed<number>(() => {
  if (totalPuzzles.value === 0) return 0;
  return Math.round((currentPuzzleIndex.value / totalPuzzles.value) * 100);
});

const currentSentenceString = computed<string>(() => {
  return placedRunes.value.map((r) => r.word).join(' ');
});

const FUNCTIONAL_CATEGORY_META: Record<FunctionalGrammarCategory, { icon: string; labelVi: string; intentVi: string }> = {
  asking: { icon: '🙋‍♂️', labelVi: 'Hỏi Han & Nhờ Vả', intentVi: 'Yêu cầu, hỏi thăm hoặc nhờ hỗ trợ lịch sự' },
  refusing: { icon: '🛡️', labelVi: 'Từ Chối & Ngăn Chặn', intentVi: 'Từ chối khéo, phản đối hoặc ngăn chặn' },
  apologizing: { icon: '🙏', labelVi: 'Xin Lỗi & Cáo Lỗi', intentVi: 'Nhận lỗi và bày tỏ sự cáo lỗi chân thành' },
  persuading: { icon: '💡', labelVi: 'Khuyên Nhủ & Thuyết Phục', intentVi: 'Đưa ra lời khuyên, đề xuất và thuyết phục' },
  clarifying: { icon: '🔍', labelVi: 'Làm Rõ & Xác Nhận', intentVi: 'Thu thập chứng cứ, điều tra và làm sáng tỏ' },
  describing: { icon: '🎨', labelVi: 'Miêu Tả & Nhận Định', intentVi: 'Trình bày đặc điểm, trạng thái hoặc vị trí' },
  narrating: { icon: '📖', labelVi: 'Kể Chuyện & Diễn Biến', intentVi: 'Kể lại trải nghiệm, quá khứ và chuỗi sự kiện' },
  negotiating: { icon: '🤝', labelVi: 'Đàm Phán & Thỏa Thuận', intentVi: 'Đàm phán điều kiện, thương thảo hợp đồng' },
  complaining: { icon: '⚠️', labelVi: 'Khiếu Nại & Báo Sự Cố', intentVi: 'Báo cáo hỏng hóc, sự cố và yêu cầu giải quyết' },
  thanking: { icon: '💐', labelVi: 'Cảm Ơn & Tri Ân', intentVi: 'Thể hiện lòng biết ơn và trân trọng' },
};

const currentFunctionalMeta = computed(() => {
  const cat = currentPuzzle.value?.functionalCategory;
  if (!cat || !FUNCTIONAL_CATEGORY_META[cat]) return null;
  return FUNCTIONAL_CATEGORY_META[cat];
});

// -------------------------------------------------------------------------
// Setup Grammar Puzzles
// -------------------------------------------------------------------------
function initPuzzles(): void {
  const grammarItems: StageGrammarItem[] =
    props.stage.grammarPool || props.stage.grammarChallenges || [];

  const pickCount = Math.min(props.stage.config?.grammarPickCount || 2, grammarItems.length);
  puzzles.value = grammarItems.slice(0, pickCount);
  currentPuzzleIndex.value = 0;

  loadCurrentPuzzle();
}

function loadCurrentPuzzle(): void {
  isChestUnlocked.value = false;
  isEvaluating.value = false;
  feedbackMessage.value = '';
  isFeedbackError.value = false;
  placedRunes.value = [];

  if (!currentPuzzle.value) return;

  const sentenceWords = currentPuzzle.value.correctSentence.trim().split(/\s+/);
  const distractors = currentPuzzle.value.distractorWords || [];

  const stones: RuneStone[] = [];

  // Correct sentence words
  sentenceWords.forEach((word, idx) => {
    stones.push({
      id: `rune_${idx}_${word}`,
      word,
      isDistractor: false,
      isPlaced: false,
      slotIndex: null,
    });
  });

  // Distractor words
  distractors.forEach((word, idx) => {
    stones.push({
      id: `distractor_${idx}_${word}`,
      word,
      isDistractor: true,
      isPlaced: false,
      slotIndex: null,
    });
  });

  // Shuffle stones with Fisher-Yates
  for (let i = stones.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = stones[i]!;
    stones[i] = stones[j]!;
    stones[j] = temp;
  }

  runeStones.value = stones;
}

// -------------------------------------------------------------------------
// Rune Stone Manipulation
// -------------------------------------------------------------------------
function handlePickRune(stone: RuneStone): void {
  if (stone.isPlaced || isChestUnlocked.value || isEvaluating.value) {
    return;
  }

  playSound('click');
  stone.isPlaced = true;
  stone.slotIndex = placedRunes.value.length;
  placedRunes.value.push(stone);
  feedbackMessage.value = '';
}

function handleRemovePlacedRune(index: number): void {
  if (isChestUnlocked.value || isEvaluating.value) {
    return;
  }

  const removed = placedRunes.value.splice(index, 1)[0];
  if (removed) {
    playSound('click');
    removed.isPlaced = false;
    removed.slotIndex = null;

    // Re-index remaining placed runes
    placedRunes.value.forEach((r, idx) => {
      r.slotIndex = idx;
    });
  }
}

function handleClearAll(): void {
  if (isChestUnlocked.value || isEvaluating.value) return;

  playSound('click');
  placedRunes.value.forEach((r) => {
    r.isPlaced = false;
    r.slotIndex = null;
  });
  placedRunes.value = [];
  feedbackMessage.value = '';
}

// -------------------------------------------------------------------------
// Sentence Verification Logic
// -------------------------------------------------------------------------
function handleVerifySentence(): void {
  if (!currentPuzzle.value || placedRunes.value.length === 0 || isEvaluating.value) {
    return;
  }

  isEvaluating.value = true;
  const userSentence = currentSentenceString.value.trim().toLowerCase();
  const targetSentence = currentPuzzle.value.correctSentence.trim().toLowerCase();

  // Strip punctuation for flexible matching
  const cleanUser = userSentence.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, '');
  const cleanTarget = targetSentence.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, '');

  if (cleanUser === cleanTarget) {
    // Correct Sentence!
    isChestUnlocked.value = true;
    isFeedbackError.value = false;
    feedbackMessage.value = 'Chính xác! Rương cổ ngữ đã mở khóa!';

    playSound('correct');
    triggerScreenShake('light');

    // Read full sentence via TTS
    void speak(currentPuzzle.value.correctSentence);

    sessionStore.recordAnswer({
      questionId: currentPuzzle.value.id,
      itemType: 'grammar',
      isCorrect: true,
      timeSpentMs: 2500,
      userResponse: currentSentenceString.value,
      expectedResponse: currentPuzzle.value.correctSentence,
      scoreAwarded: 200,
    });

    // Advance to next puzzle or complete mini-game
    setTimeout(() => {
      if (currentPuzzleIndex.value + 1 < totalPuzzles.value) {
        currentPuzzleIndex.value++;
        loadCurrentPuzzle();
      } else {
        emit('completed');
      }
    }, 1500);
  } else {
    // Wrong Sentence!
    isFeedbackError.value = true;
    feedbackMessage.value = `Chưa đúng! Gợi ý: ${currentPuzzle.value.grammarTip}`;

    playSound('wrong');
    triggerScreenShake('medium');
    sessionStore.takeDamage(1);

    sessionStore.recordAnswer({
      questionId: currentPuzzle.value.id,
      itemType: 'grammar',
      isCorrect: false,
      timeSpentMs: 2500,
      userResponse: currentSentenceString.value,
      expectedResponse: currentPuzzle.value.correctSentence,
      scoreAwarded: 0,
    });

    isEvaluating.value = false;

    if (!sessionStore.isAlive) {
      emit('failed');
    }
  }
}

// -------------------------------------------------------------------------
// Lifecycle
// -------------------------------------------------------------------------
onMounted(() => {
  initPuzzles();
});

onScopeDispose(() => {
  // Clean up any pending state
});
</script>

<template>
  <div class="sentence-lock-container">
    <!-- Top HUD -->
    <div class="lock-hud">
      <div class="hud-item-box">
        <span class="hud-label">Thử Thách Cổ Ngữ</span>
        <span class="hud-val">📜 {{ currentPuzzleIndex + 1 }}/{{ totalPuzzles }}</span>
      </div>

      <div class="pattern-badge-box">
        <span class="pattern-label">Cấu Trúc Ngữ Pháp:</span>
        <span class="pattern-val">{{ currentPuzzle?.grammarPattern }}</span>
      </div>

      <div class="hud-item-box">
        <span class="hud-label">Máu</span>
        <div class="hp-hearts">
          <span
            v-for="h in sessionStore.maxHealth"
            :key="h"
            class="heart-icon"
            :class="{ 'heart-lost': h > sessionStore.health }"
          >
            ❤️
          </span>
        </div>
      </div>
    </div>

    <!-- Chest & Ancient Lock Animation Stage -->
    <div class="lock-stage theme-card">
      <div class="chest-visual" :class="{ 'chest-unlocked': isChestUnlocked }">
        <span class="chest-icon" aria-hidden="true">{{ isChestUnlocked ? '🎁✨' : '🔒📦' }}</span>
        <span class="chest-title">
          {{ isChestUnlocked ? 'Khóa Cổ Đã Mở!' : 'Rương Cổ Ngữ Phong Ấn' }}
        </span>
      </div>

      <!-- Vietnamese Prompt & Functional Intent -->
      <div class="vietnamese-prompt-box">
        <div v-if="currentFunctionalMeta" class="functional-intent-pill" :class="`cat-${currentPuzzle?.functionalCategory}`">
          <span class="intent-icon" aria-hidden="true">{{ currentFunctionalMeta.icon }}</span>
          <span class="intent-label">Mục Tiêu: {{ currentFunctionalMeta.labelVi }}</span>
          <span class="intent-desc">— {{ currentFunctionalMeta.intentVi }}</span>
        </div>
        <div class="prompt-text-row">
          <span class="prompt-flag" aria-hidden="true">🇻🇳</span>
          <p class="prompt-text">{{ currentPuzzle?.vietnamesePrompt }}</p>
        </div>
      </div>

      <!-- Placed Runes Sentence Construction Bar -->
      <div class="sentence-drop-slot" :class="{ 'slot-unlocked': isChestUnlocked }">
        <span v-if="placedRunes.length === 0" class="slot-placeholder">
          Chạm vào các viên đá cổ ngữ bên dưới để sắp xếp câu hoàn chỉnh...
        </span>

        <button
          v-for="(rune, idx) in placedRunes"
          :key="rune.id"
          type="button"
          class="placed-rune-btn"
          title="Chạm để gỡ bỏ"
          @click="handleRemovePlacedRune(idx)"
        >
          <span>{{ rune.word }}</span>
          <span class="remove-badge" aria-hidden="true">×</span>
        </button>
      </div>

      <!-- Feedback Banner -->
      <div
        v-if="feedbackMessage"
        class="feedback-banner"
        :class="{ 'feedback-error': isFeedbackError, 'feedback-success': !isFeedbackError }"
      >
        <span>{{ isFeedbackError ? '⚠️' : '🎉' }}</span>
        <p>{{ feedbackMessage }}</p>
      </div>

      <!-- Action Buttons -->
      <div class="lock-actions-row">
        <button
          type="button"
          class="clear-all-btn"
          :disabled="placedRunes.length === 0 || isChestUnlocked || isEvaluating"
          @click="handleClearAll"
        >
          🗑️ Xóa Hết
        </button>

        <button
          type="button"
          class="theme-btn-primary verify-btn"
          :disabled="placedRunes.length === 0 || isChestUnlocked || isEvaluating"
          @click="handleVerifySentence"
        >
          {{ isEvaluating ? 'Đang Kiểm Tra...' : 'Mở Khóa Rương ✨' }}
        </button>
      </div>
    </div>

    <!-- Rune Stones Pool -->
    <div class="rune-stones-section">
      <span class="rune-pool-label">Các Viên Đá Cổ Ngữ (Bao gồm từ gây nhiễu):</span>
      <div class="rune-stones-grid">
        <button
          v-for="stone in runeStones"
          :key="stone.id"
          type="button"
          class="rune-stone-btn"
          :class="{ 'stone-placed': stone.isPlaced }"
          :disabled="stone.isPlaced || isChestUnlocked || isEvaluating"
          @click="handlePickRune(stone)"
        >
          <span class="stone-word">{{ stone.word }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sentence-lock-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
  max-width: 780px;
  margin: 0 auto;
  user-select: none;
}

/* HUD */
.lock-hud {
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
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-primary);
}

.pattern-badge-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.pattern-label {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--text-muted);
}

.pattern-val {
  font-size: 0.8125rem;
  font-weight: 800;
  color: var(--accent-primary);
  background: var(--bg-primary);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.hp-hearts {
  display: flex;
  gap: 0.2rem;
}

.heart-icon {
  font-size: 1.125rem;
}

.heart-lost {
  opacity: 0.2;
  filter: grayscale(1);
}

/* Lock Stage */
.lock-stage {
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  background-color: var(--bg-surface);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-lg);
}

.chest-visual {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  transition: transform 0.3s ease;
}

.chest-icon {
  font-size: 3rem;
  line-height: 1;
}

.chest-title {
  font-size: 0.875rem;
  font-weight: 800;
  color: var(--text-muted);
}

.chest-unlocked {
  animation: chest-pulse 0.6s infinite alternate;
}

@keyframes chest-pulse {
  from { transform: scale(1); }
  to { transform: scale(1.08); }
}

/* Vietnamese Prompt */
.vietnamese-prompt-box {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  padding: 0.875rem 1.25rem;
  border-radius: var(--radius-md);
}

.prompt-text-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.functional-intent-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  align-self: flex-start;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: #38bdf8;
}

.functional-intent-pill.cat-complaining {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
  color: #f87171;
}

.functional-intent-pill.cat-negotiating {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.4);
  color: #fbbf24;
}

.functional-intent-pill.cat-persuading {
  background: rgba(168, 85, 247, 0.15);
  border-color: rgba(168, 85, 247, 0.4);
  color: #c084fc;
}

.functional-intent-pill.cat-refusing {
  background: rgba(244, 63, 94, 0.15);
  border-color: rgba(244, 63, 94, 0.4);
  color: #fb7185;
}

.functional-intent-pill.cat-thanking,
.functional-intent-pill.cat-apologizing {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.4);
  color: #34d399;
}

.intent-desc {
  font-weight: 500;
  opacity: 0.85;
  margin-left: 0.25rem;
}

@media (max-width: 640px) {
  .intent-desc {
    display: none;
  }
}

.prompt-flag {
  font-size: 1.5rem;
  line-height: 1;
}

.prompt-text {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.4;
}

/* Placed Runes Sentence Slot */
.sentence-drop-slot {
  min-height: 68px;
  background-color: var(--bg-primary);
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
}

.slot-placeholder {
  font-size: 0.875rem;
  font-style: italic;
  color: var(--text-muted);
  width: 100%;
  text-align: center;
}

.slot-unlocked {
  border-color: #10b981 !important;
  background-color: rgba(16, 185, 129, 0.08) !important;
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
}

.placed-rune-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--bg-surface);
  border: 2px solid var(--accent-primary);
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 800;
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all 0.15s ease;
  font-family: inherit;
}

.placed-rune-btn:hover {
  transform: translateY(-2px);
  background-color: #fee2e2;
  border-color: #ef4444;
}

.remove-badge {
  font-size: 1.125rem;
  color: var(--text-muted);
  line-height: 1;
}

/* Feedback Banner */
.feedback-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  animation: feedback-slide 0.25s ease-out;
}

@keyframes feedback-slide {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

.feedback-banner p {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.4;
}

.feedback-success {
  background-color: rgba(16, 185, 129, 0.15);
  border: 1px solid #10b981;
  color: #065f46;
}

.feedback-error {
  background-color: rgba(239, 68, 68, 0.15);
  border: 1px solid #ef4444;
  color: #991b1b;
}

/* Actions Row */
.lock-actions-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
}

.clear-all-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  padding: 0.625rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.clear-all-btn:hover:not(:disabled) {
  border-color: var(--border-focus);
  color: var(--text-primary);
}

.clear-all-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.verify-btn {
  padding: 0.75rem 1.75rem;
  font-size: 1rem;
}

/* Rune Stones Pool */
.rune-stones-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.rune-pool-label {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-muted);
}

.rune-stones-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.625rem;
}

.rune-stone-btn {
  background: var(--bg-surface);
  border: 2px solid var(--border-color);
  color: var(--text-primary);
  font-size: 1.0625rem;
  font-weight: 800;
  padding: 0.625rem 1.125rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  box-shadow: var(--btn-3d-shadow);
  transition: all 0.15s ease;
  font-family: inherit;
}

.rune-stone-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: var(--border-focus);
}

.rune-stone-btn:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: var(--btn-3d-active);
}

.stone-placed {
  opacity: 0.25;
  transform: scale(0.94);
  box-shadow: none;
  border-style: dashed;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .lock-stage {
    padding: 1.25rem;
  }
  .prompt-text {
    font-size: 1rem;
  }
  .rune-stone-btn {
    font-size: 0.9375rem;
    padding: 0.5rem 0.85rem;
  }
}
/* ==========================================================================
   THEME OVERRIDES: ĐẢO THẦN THOẠI (KIDS MODE)
   ========================================================================== */
html[data-theme="kids"] .lock-hud {
  background: #ffffff;
  border: 2px solid #fde68a;
  box-shadow: 0 4px 14px rgba(217, 119, 6, 0.08);
}

html[data-theme="kids"] .hud-label {
  color: #78350f;
}

html[data-theme="kids"] .hud-val {
  color: #3b1d07;
}

html[data-theme="kids"] .pattern-val {
  background: #fef3c7;
  border: 1.5px solid #fde68a;
  color: #b45309;
}

html[data-theme="kids"] .lock-stage {
  background: #ffffff;
  border: 2px solid #fde68a;
  box-shadow: 0 4px 16px rgba(217, 119, 6, 0.08);
}

html[data-theme="kids"] .chest-title {
  color: #78350f;
}

html[data-theme="kids"] .vietnamese-prompt-box {
  background: #fffdf5;
  border: 1.5px solid #fde68a;
}

html[data-theme="kids"] .prompt-text {
  color: #3b1d07;
}

html[data-theme="kids"] .functional-intent-pill {
  background: #fef3c7;
  border: 1.5px solid #fde68a;
  color: #b45309;
}

html[data-theme="kids"] .sentence-drop-slot {
  background: #fffbeb;
  border: 2px dashed #fde68a;
}

html[data-theme="kids"] .slot-placeholder {
  color: #92400e;
}

html[data-theme="kids"] .placed-rune-btn {
  background: #ffffff;
  border: 2px solid #f59e0b;
  color: #3b1d07;
  box-shadow: 0 3px 0 #fde68a;
}

html[data-theme="kids"] .placed-rune-btn:hover {
  background: #fee2e2;
  border-color: #ef4444;
  color: #991b1b;
}

html[data-theme="kids"] .rune-pool-label {
  color: #78350f;
}

html[data-theme="kids"] .rune-stone-btn {
  background: #ffffff;
  border: 2px solid #fde68a;
  color: #3b1d07;
  box-shadow: 0 4px 0 #fde68a;
}

html[data-theme="kids"] .rune-stone-btn:hover:not(:disabled) {
  border-color: #f59e0b;
  transform: translateY(-2px);
}

html[data-theme="kids"] .clear-all-btn {
  background: #fffbeb;
  border: 1.5px solid #fde68a;
  color: #78350f;
}

html[data-theme="kids"] .clear-all-btn:hover:not(:disabled) {
  border-color: #f59e0b;
  color: #3b1d07;
}

/* ==========================================================================
   THEME OVERRIDES: SIMLIFE GLOBAL (ADULTS MODE)
   ========================================================================== */
html[data-theme="adults"] .lock-hud {
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
}

html[data-theme="adults"] .hud-label {
  color: #475569;
}

html[data-theme="adults"] .hud-val {
  color: #0f172a;
}

html[data-theme="adults"] .pattern-val {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #0284c7;
}

html[data-theme="adults"] .lock-stage {
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
}

html[data-theme="adults"] .chest-title {
  color: #475569;
}

html[data-theme="adults"] .vietnamese-prompt-box {
  background: #f8fafc;
  border: 1.5px solid #cbd5e1;
}

html[data-theme="adults"] .prompt-text {
  color: #0f172a;
}

html[data-theme="adults"] .functional-intent-pill {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #0284c7;
}

html[data-theme="adults"] .sentence-drop-slot {
  background: #f8fafc;
  border: 2px dashed #cbd5e1;
}

html[data-theme="adults"] .slot-placeholder {
  color: #64748b;
}

html[data-theme="adults"] .placed-rune-btn {
  background: #ffffff;
  border: 1.5px solid #0284c7;
  color: #0f172a;
  box-shadow: 0 2px 0 #cbd5e1;
}

html[data-theme="adults"] .rune-pool-label {
  color: #475569;
}

html[data-theme="adults"] .rune-stone-btn {
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  color: #0f172a;
  box-shadow: 0 3px 0 #cbd5e1;
}

html[data-theme="adults"] .rune-stone-btn:hover:not(:disabled) {
  border-color: #0284c7;
  transform: translateY(-2px);
}

html[data-theme="adults"] .clear-all-btn {
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  color: #475569;
}

html[data-theme="adults"] .clear-all-btn:hover:not(:disabled) {
  border-color: #0284c7;
  color: #0f172a;
}
</style>

