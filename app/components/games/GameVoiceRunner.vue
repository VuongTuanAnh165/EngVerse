<script setup lang="ts">
import { ref, computed, onMounted, onScopeDispose, watch } from 'vue';
import type { StageData, StageVocabItem, RunnerObstacle } from '~/types/game';
import { useGameSessionStore } from '~/stores/gameSession';
import { useSoundEffects } from '~/composables/useSoundEffects';
import { useSpeechEngine } from '~/composables/useSpeechEngine';
import { useAnalytics } from '~/composables/useAnalytics';

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
const speechEngine = useSpeechEngine();
const analytics = useAnalytics();
let hasTrackedFallback = false;

function trackMicFallback(reason?: string): void {
  if (hasTrackedFallback) return;
  hasTrackedFallback = true;

  const derivedReason = reason || (speechEngine.hasPermissionDenied.value
    ? 'not-allowed'
    : !speechEngine.isSttSupported.value
    ? 'unsupported'
    : 'manual_switch');

  analytics.trackMicFallbackTriggered({
    world_track: props.stage.worldTrack,
    stage_id: props.stage.stageId,
    error_reason: derivedReason,
    target_word: currentVocab.value?.word,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  });
}

function handleSwitchToFallback(): void {
  trackMicFallback('manual_switch');
  speechEngine.switchToFallbackMode();
}

// -------------------------------------------------------------------------
// Component State
// -------------------------------------------------------------------------
const obstacles = ref<RunnerObstacle[]>([]);
const currentObstacleIndex = ref<number>(0);
const isAttacking = ref<boolean>(false);
const isObstacleDefeated = ref<boolean>(false);
const speechFeedback = ref<string>('');
const isEvaluating = ref<boolean>(false);

// -------------------------------------------------------------------------
// Computed
// -------------------------------------------------------------------------
const currentObstacle = computed<RunnerObstacle | null>(() => {
  return obstacles.value[currentObstacleIndex.value] || null;
});

const currentVocab = computed<StageVocabItem | null>(() => {
  return currentObstacle.value?.vocabItem || null;
});

const totalObstacles = computed<number>(() => obstacles.value.length);

const progressPercent = computed<number>(() => {
  if (totalObstacles.value === 0) return 0;
  return Math.round((currentObstacleIndex.value / totalObstacles.value) * 100);
});

// -------------------------------------------------------------------------
// Setup Obstacles
// -------------------------------------------------------------------------
function initObstacles(): void {
  const vocabs: StageVocabItem[] =
    props.stage.vocabPool || props.stage.vocabList || [];

  // Pick up to 3-4 obstacles
  const pickCount = Math.min(3, vocabs.length);
  const selected = vocabs.slice(0, pickCount);

  const obstacleTypes: Array<'gate' | 'golem' | 'drone' | 'barrier'> = [
    'golem',
    'barrier',
    'gate',
  ];

  obstacles.value = selected.map((v, idx) => ({
    id: `obs_${v.id}`,
    vocabItem: v,
    isDefeated: false,
    obstacleType: obstacleTypes[idx % obstacleTypes.length] || 'golem',
  }));

  currentObstacleIndex.value = 0;
  loadCurrentObstacle();
}

function loadCurrentObstacle(): void {
  speechFeedback.value = '';
  isAttacking.value = false;
  isObstacleDefeated.value = false;
  isEvaluating.value = false;

  if (!currentVocab.value) return;

  // If in fallback mode, initialize Rhythm Tap syllables
  if (speechEngine.isFallbackMode.value) {
    speechEngine.initRhythmChallenge(
      currentVocab.value.word,
      currentVocab.value.rhythmSyllables
    );
  }
}

// Watch for fallback mode toggling or automatic activation
watch(
  () => speechEngine.isFallbackMode.value,
  (isFallback) => {
    if (isFallback) {
      trackMicFallback();
      if (currentVocab.value) {
        speechEngine.initRhythmChallenge(
          currentVocab.value.word,
          currentVocab.value.rhythmSyllables
        );
      }
    }
  }
);

// -------------------------------------------------------------------------
// Speech Recognition Actions
// -------------------------------------------------------------------------
function handleListenToggle(): void {
  if (!currentVocab.value) return;

  if (speechEngine.isListening.value) {
    speechEngine.stopListening();
  } else {
    speechFeedback.value = '';
    isEvaluating.value = true;

    speechEngine.startListening(currentVocab.value.word, {
      acceptedVariants: currentVocab.value.acceptedVoiceVariants || [],
      threshold: props.stage.config?.voicePassThreshold
        ? Math.round(props.stage.config.voicePassThreshold * 100)
        : 75,
      onResult: (evalResult) => {
        isEvaluating.value = false;
        speechFeedback.value = evalResult.feedbackVi;

        if (evalResult.isPassed) {
          executeSuccessfulAttack(evalResult.recognizedText);
        } else {
          playSound('wrong');
          triggerScreenShake('light');
          sessionStore.recordAnswer({
            questionId: currentVocab.value?.id || '',
            itemType: 'voice',
            isCorrect: false,
            timeSpentMs: 2000,
            userResponse: evalResult.recognizedText,
            expectedResponse: currentVocab.value?.word || '',
            scoreAwarded: 0,
          });
        }
      },
      onError: (errMsg) => {
        isEvaluating.value = false;
        speechFeedback.value = errMsg;
      },
    });
  }
}

// -------------------------------------------------------------------------
// Rhythm Tap Fallback Tap Handler
// -------------------------------------------------------------------------
function handleSyllableTap(item: import('~/types/speech').RhythmSyllableItem): void {
  if (!currentVocab.value) return;

  const result = speechEngine.tapRhythmSyllable(item);

  if (result.isCorrect) {
    if (result.isComplete) {
      speechFeedback.value = 'Chính xác! Đòn tấn công nhịp điệu đã kích hoạt!';
      executeSuccessfulAttack(currentVocab.value.word);
    }
  } else if (!result.isAlreadyTapped) {
    playSound('wrong');
    triggerScreenShake('light');
  }
}

// -------------------------------------------------------------------------
// Attack & Advance Sequence
// -------------------------------------------------------------------------
function executeSuccessfulAttack(spokenText: string): void {
  if (!currentVocab.value) return;

  isAttacking.value = true;
  playSound('hit');
  triggerScreenShake('medium');

  setTimeout(() => {
    isObstacleDefeated.value = true;
    playSound('correct');

    sessionStore.recordAnswer({
      questionId: currentVocab.value?.id || '',
      itemType: 'voice',
      isCorrect: true,
      timeSpentMs: 1800,
      userResponse: spokenText,
      expectedResponse: currentVocab.value?.word || '',
      scoreAwarded: 200,
    });

    // Advance to next obstacle or complete
    setTimeout(() => {
      if (currentObstacleIndex.value + 1 < totalObstacles.value) {
        currentObstacleIndex.value++;
        loadCurrentObstacle();
      } else {
        emit('completed');
      }
    }, 700);
  }, 400);
}

function handlePlaySample(): void {
  if (currentVocab.value) {
    void speechEngine.speak(currentVocab.value.word);
  }
}

// -------------------------------------------------------------------------
// Lifecycle
// -------------------------------------------------------------------------
onMounted(() => {
  initObstacles();
});

onScopeDispose(() => {
  speechEngine.stopListening();
  speechEngine.stopSpeaking();
});
</script>

<template>
  <div class="voice-runner-container">
    <!-- Top HUD -->
    <div class="runner-hud">
      <div class="hud-stat-box">
        <span class="hud-label">Mục Tiêu</span>
        <span class="hud-val">🛡️ {{ currentObstacleIndex + 1 }}/{{ totalObstacles }}</span>
      </div>

      <!-- Mode Pill (Voice vs Rhythm Fallback) -->
      <div class="mode-indicator">
        <span v-if="!speechEngine.isFallbackMode.value" class="mode-badge voice-mode">
          🎙️ Chế Độ Giọng Nói
        </span>
        <span v-else class="mode-badge rhythm-mode">
          🎵 Chế Độ Nhịp Điệu (Rhythm)
        </span>
      </div>

      <div class="hud-stat-box">
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

    <!-- 60FPS Animated Runner Arena -->
    <div class="runner-arena">
      <!-- Background Parallax Scenery -->
      <div class="scenery-sky" />
      <div class="scenery-ground" :class="{ 'ground-scrolling': !isObstacleDefeated }" />

      <!-- Player Character -->
      <div
        class="runner-character"
        :class="{
          'char-running': !isAttacking && !isObstacleDefeated,
          'char-attacking': isAttacking
        }"
      >
        <span class="character-sprite" aria-hidden="true">🏃‍♂️</span>
        <span v-if="isAttacking" class="attack-slash" aria-hidden="true">⚡⚔️</span>
      </div>

      <!-- Obstacle Monster / Gate -->
      <div
        v-if="currentObstacle"
        class="runner-obstacle"
        :class="{ 'obstacle-defeated': isObstacleDefeated }"
      >
        <div class="obstacle-sprite">
          <span v-if="currentObstacle.obstacleType === 'golem'" class="obs-icon">🗿</span>
          <span v-else-if="currentObstacle.obstacleType === 'barrier'" class="obs-icon">🛑</span>
          <span v-else class="obs-icon">🚪</span>
        </div>
        <span class="obstacle-name">{{ currentVocab?.meaning }}</span>
      </div>
    </div>

    <!-- Keyword Target Card -->
    <div v-if="currentVocab" class="target-keyword-card">
      <div class="target-header">
        <div class="target-word-info">
          <span class="target-label">Từ Khóa Vượt Chướng Ngại Vật:</span>
          <div class="target-word-row">
            <h2 class="target-word">{{ currentVocab.word }}</h2>
            <button
              type="button"
              class="sample-audio-btn"
              title="Nghe phát âm chuẩn"
              aria-label="Nghe giọng đọc mẫu"
              @click="handlePlaySample"
            >
              🔊
            </button>
          </div>
          <span class="target-ipa">{{ currentVocab.ipa }}</span>
        </div>

        <div v-if="currentVocab.emoji" class="target-emoji" aria-hidden="true">
          {{ currentVocab.emoji }}
        </div>
      </div>

      <!-- Dynamic Feedback / Transcript -->
      <div v-if="speechFeedback || speechEngine.currentTranscript.value" class="speech-feedback-box">
        <p v-if="speechEngine.currentTranscript.value" class="transcript-text">
          Đang nghe: "<em>{{ speechEngine.currentTranscript.value }}</em>"
        </p>
        <p v-if="speechFeedback" class="feedback-text">{{ speechFeedback }}</p>
      </div>

      <!-- Interaction Mode 1: Microphone Voice Activation -->
      <div v-if="!speechEngine.isFallbackMode.value" class="voice-controls-section">
        <button
          type="button"
          class="voice-action-btn"
          :class="{
            'btn-listening': speechEngine.isListening.value,
            'btn-evaluating': isEvaluating
          }"
          :disabled="isAttacking || isObstacleDefeated"
          @click="handleListenToggle"
        >
          <div class="voice-btn-inner">
            <span class="mic-icon">{{ speechEngine.isListening.value ? '🔴' : '🎙️' }}</span>
            <span class="mic-text">
              {{
                speechEngine.isListening.value
                  ? 'Đang nghe... Nhấn để Dừng'
                  : 'Nhấn & Đọc To Để Tấn Công!'
              }}
            </span>
          </div>

          <!-- Pulsing Sound Wave Animation while listening -->
          <div v-if="speechEngine.isListening.value" class="sound-wave-bars">
            <span class="wave-bar" />
            <span class="wave-bar" />
            <span class="wave-bar" />
            <span class="wave-bar" />
          </div>
        </button>

        <!-- Toggle to Fallback Rhythm Mode if desired -->
        <button
          type="button"
          class="switch-fallback-btn"
          @click="handleSwitchToFallback"
        >
          Không dùng mic? Chuyển sang Chạm Nhịp Điệu 🎵
        </button>
      </div>

      <!-- Interaction Mode 2: Golden Fallback Rhythm Tap -->
      <div v-else class="rhythm-controls-section">
        <p class="rhythm-instructions">
          Chạm vào các âm tiết theo đúng thứ tự nhịp điệu để vượt qua:
        </p>

        <div v-if="speechEngine.rhythmState.value" class="rhythm-syllables-grid">
          <button
            v-for="syl in speechEngine.rhythmState.value.shuffledSyllables"
            :key="syl.id"
            type="button"
            class="syllable-chip-btn"
            :class="{
              'syl-tapped': syl.isTapped,
              'syl-target': syl.isCurrentTarget,
              'syl-wrong': speechEngine.rhythmState.value.wrongTapIndex === syl.originalIndex
            }"
            :disabled="syl.isTapped || isAttacking || isObstacleDefeated"
            @click="handleSyllableTap(syl)"
          >
            {{ syl.syllable }}
          </button>
        </div>

        <button
          v-if="speechEngine.isSttSupported.value && !speechEngine.hasPermissionDenied.value"
          type="button"
          class="switch-fallback-btn"
          @click="speechEngine.switchToVoiceMode"
        >
          Bật lại Micro Giọng Nói 🎙️
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.voice-runner-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
  max-width: 780px;
  margin: 0 auto;
  user-select: none;
}

/* HUD */
.runner-hud {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.hud-stat-box {
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

.hp-hearts {
  display: flex;
  gap: 0.2rem;
}

.heart-icon {
  font-size: 1.125rem;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.heart-lost {
  opacity: 0.2;
  filter: grayscale(1);
}

.mode-badge {
  font-size: 0.8125rem;
  font-weight: 700;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-pill);
}

.voice-mode {
  background: rgba(6, 182, 212, 0.15);
  color: var(--accent-primary);
  border: 1px solid var(--border-color);
}

.rhythm-mode {
  background: rgba(245, 158, 11, 0.15);
  color: #d97706;
  border: 1px solid var(--border-color);
}

/* 60FPS Runner Arena */
.runner-arena {
  position: relative;
  width: 100%;
  height: 200px;
  background: linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-secondary) 100%);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.scenery-sky {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 60%;
  background: radial-gradient(circle at 80% 20%, rgba(254, 240, 138, 0.4) 0%, transparent 60%);
}

.scenery-ground {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 50px;
  background-color: var(--border-color);
  border-top: 3px solid var(--accent-primary);
}

.ground-scrolling {
  background-image: repeating-linear-gradient(
    90deg,
    transparent,
    transparent 40px,
    rgba(255, 255, 255, 0.4) 40px,
    rgba(255, 255, 255, 0.4) 80px
  );
  animation: scroll-ground 0.8s linear infinite;
}

@keyframes scroll-ground {
  from { background-position: 0 0; }
  to { background-position: -80px 0; }
}

/* Character */
.runner-character {
  position: absolute;
  bottom: 40px;
  left: 20%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 10;
}

.char-running {
  animation: run-bounce 0.4s infinite alternate ease-in-out;
}

@keyframes run-bounce {
  from { transform: translateY(0); }
  to { transform: translateY(-8px); }
}

.char-attacking {
  transform: translateX(60px) scale(1.2);
}

.character-sprite {
  font-size: 3.5rem;
  line-height: 1;
}

.attack-slash {
  font-size: 2.25rem;
  animation: slash-flash 0.35s ease-out;
}

@keyframes slash-flash {
  from { transform: scale(0.4) rotate(-30deg); opacity: 0; }
  to { transform: scale(1.4) rotate(15deg); opacity: 1; }
}

/* Obstacle */
.runner-obstacle {
  position: absolute;
  bottom: 40px;
  right: 20%;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 10;
}

.obs-icon {
  font-size: 3.5rem;
  line-height: 1;
}

.obstacle-name {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-primary);
  background: var(--bg-surface-translucent);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-sm);
  margin-top: 0.25rem;
}

.obstacle-defeated {
  opacity: 0;
  transform: translate(40px, -40px) scale(0.2) rotate(45deg);
  filter: blur(4px);
}

/* Target Keyword Card */
.target-keyword-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.target-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.target-label {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-muted);
}

.target-word-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0.25rem 0;
}

.target-word {
  margin: 0;
  font-size: 2rem;
  font-weight: 900;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.sample-audio-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-pill);
  width: 36px;
  height: 36px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.sample-audio-btn:hover {
  transform: scale(1.1);
  border-color: var(--border-focus);
}

.target-ipa {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.target-emoji {
  font-size: 3rem;
  line-height: 1;
}

/* Speech Feedback */
.speech-feedback-box {
  background: var(--bg-primary);
  border-left: 3px solid var(--accent-primary);
  padding: 0.625rem 1rem;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.transcript-text,
.feedback-text {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.feedback-text {
  font-weight: 700;
  color: var(--accent-primary);
}

/* Voice Controls */
.voice-controls-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.voice-action-btn {
  width: 100%;
  max-width: 420px;
  padding: 1.125rem 2rem;
  border-radius: var(--radius-md);
  background: var(--accent-gradient);
  color: var(--accent-text);
  border: none;
  font-size: 1.125rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: var(--btn-3d-shadow);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  font-family: inherit;
}

.voice-action-btn:active {
  transform: translateY(2px);
  box-shadow: var(--btn-3d-active);
}

.btn-listening {
  background: linear-gradient(135deg, #ef4444 0%, #f97316 100%) !important;
  animation: pulse-recording 1.2s infinite;
}

@keyframes pulse-recording {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

.voice-btn-inner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sound-wave-bars {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 16px;
}

.wave-bar {
  width: 4px;
  background-color: #ffffff;
  border-radius: 2px;
  animation: wave 0.8s ease-in-out infinite alternate;
}

.wave-bar:nth-child(2) { animation-delay: 0.2s; }
.wave-bar:nth-child(3) { animation-delay: 0.4s; }
.wave-bar:nth-child(4) { animation-delay: 0.6s; }

@keyframes wave {
  from { height: 4px; }
  to { height: 16px; }
}

.switch-fallback-btn {
  background: transparent;
  border: none;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  text-decoration: underline;
  padding: 0.25rem 0.5rem;
  font-family: inherit;
}

.switch-fallback-btn:hover {
  color: var(--text-primary);
}

/* Rhythm Controls */
.rhythm-controls-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.rhythm-instructions {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-align: center;
}

.rhythm-syllables-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
}

.syllable-chip-btn {
  background: var(--bg-surface);
  border: 2px solid var(--border-color);
  color: var(--text-primary);
  font-size: 1.25rem;
  font-weight: 800;
  padding: 0.875rem 1.5rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
  font-family: inherit;
}

.syllable-chip-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: var(--border-focus);
}

.syl-target {
  border-color: var(--accent-primary) !important;
  box-shadow: var(--glow-accent) !important;
}

.syl-tapped {
  opacity: 0.3;
  transform: scale(0.92);
  border-color: #10b981;
  background-color: rgba(16, 185, 129, 0.1);
  cursor: not-allowed;
}

.syl-wrong {
  border-color: #ef4444 !important;
  background-color: rgba(239, 68, 68, 0.1) !important;
  animation: card-shake 0.3s ease;
}

@keyframes card-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  50% { transform: translateX(4px); }
  75% { transform: translateX(-2px); }
}

@media (max-width: 640px) {
  .runner-arena {
    height: 160px;
  }
  .character-sprite,
  .obs-icon {
    font-size: 2.75rem;
  }
  .target-word {
    font-size: 1.625rem;
  }
}
</style>

