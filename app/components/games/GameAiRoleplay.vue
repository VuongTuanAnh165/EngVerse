<script setup lang="ts">
/**
 * EngVerse - GameAiRoleplay Component
 * Real-time AI NPC Roleplay mini-game powered by Gemini Flash & OpenRouter Smart Fallback.
 * Features:
 * - Anti-Prompt Injection guardrails
 * - Real-time grammar correction & Vietnamese hints
 * - Web Speech API Voice-to-Text input & Text-to-Speech audio playback
 * - Max 150-char strict input control & remaining turn tracker
 * - Stateless HMAC completion proof handling
 *
 * Strict TypeScript (0 any), Vue 3.5+, 60FPS CSS animations.
 * Reference: docs/ke_hoach.md - Sprint 4, Task 3 & Rules.md
 */

import { ref, computed, onMounted, nextTick, watch } from 'vue';
import type { StageData, StageAiMission } from '~/types/game';
import type { AiChatMessage, AiRoleplayPayload, AiRoleplayResponse } from '~/types/ai';
import { useGameSessionStore } from '~/stores/gameSession';
import { useUserStore } from '~/stores/user';
import { useSpeechEngine } from '~/composables/useSpeechEngine';
import { useSoundEffects } from '~/composables/useSoundEffects';

interface RoleplayMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  vietnameseHint?: string;
  grammarCorrection?: string;
  scoreDelta?: number;
  isMissionCompleted?: boolean;
}

const props = defineProps<{
  stage: StageData;
}>();

const emit = defineEmits<{
  (e: 'completed'): void;
  (e: 'failed'): void;
}>();

const sessionStore = useGameSessionStore();
const userStore = useUserStore();
const { playSound, triggerVictoryConfetti } = useSoundEffects();
const {
  speak,
  stopSpeaking,
  isSpeaking,
  startListening,
  stopListening,
  isListening,
  currentTranscript,
  isSttSupported,
} = useSpeechEngine();

// ---------------------------------------------------------------------------
// Component State
// ---------------------------------------------------------------------------
const mission = computed<StageAiMission>(() => props.stage.aiRoleplayMission);
const messages = ref<RoleplayMessage[]>([]);
const inputText = ref<string>('');
const isThinking = ref<boolean>(false);
const errorMessage = ref<string | null>(null);
const isMissionCleared = ref<boolean>(false);
const remainingTurns = ref<number>(20);
const chatScrollContainer = ref<HTMLElement | null>(null);

const charCount = computed<number>(() => inputText.value.length);
const isInputValid = computed<boolean>(() => {
  const trimmed = inputText.value.trim();
  return trimmed.length > 0 && trimmed.length <= 150 && !isThinking.value;
});

// Auto-fill speech transcript into input field while listening
watch(currentTranscript, (newText) => {
  if (isListening.value && newText) {
    inputText.value = newText.slice(0, 150);
  }
});

/**
 * Scroll chat smoothly to bottom when new messages arrive
 */
async function scrollToBottom(): Promise<void> {
  await nextTick();
  if (chatScrollContainer.value) {
    chatScrollContainer.value.scrollTo({
      top: chatScrollContainer.value.scrollHeight,
      behavior: 'smooth',
    });
  }
}

/**
 * Initialize opening message from NPC on mount
 */
onMounted(() => {
  const introMsg: RoleplayMessage = {
    id: `msg_init_${Date.now()}`,
    role: 'model',
    content: mission.value.openingLine || 'Hello! How can I help you today?',
    vietnameseHint: mission.value.openingLineVi || 'Hãy bắt đầu bằng lời chào tiếng Anh nhé!',
    scoreDelta: 0,
    isMissionCompleted: false,
  };
  messages.value.push(introMsg);

  // Play NPC opening speech
  speak(introMsg.content, { lang: 'en-US' });
});

/**
 * Inserts a starter keyword or phrase into the input field
 */
function useChip(keyword: string): void {
  playSound('click');
  const clean = keyword.trim();
  if (!inputText.value) {
    inputText.value = clean;
  } else if (!inputText.value.toLowerCase().includes(clean.toLowerCase())) {
    inputText.value = `${inputText.value} ${clean}`.slice(0, 150);
  }
}

/**
 * Toggle voice recognition recording
 */
async function toggleVoiceInput(): Promise<void> {
  if (!isSttSupported.value) {
    errorMessage.value = 'Trình duyệt không hỗ trợ nhận diện giọng nói. Hãy dùng bàn phím nhé!';
    return;
  }

  if (isListening.value) {
    stopListening();
  } else {
    errorMessage.value = null;
    playSound('click');
    await startListening('en-US');
  }
}

/**
 * Play text-to-speech for an NPC message
 */
function handleSpeakMessage(text: string): void {
  if (isSpeaking.value) {
    stopSpeaking();
  } else {
    speak(text, { lang: 'en-US' });
  }
}

/**
 * Send user utterance to AI Roleplay API
 */
async function handleSendMessage(): Promise<void> {
  if (!isInputValid.value || isThinking.value) return;

  const playerUtterance = inputText.value.trim();
  inputText.value = '';
  errorMessage.value = null;

  if (isListening.value) {
    stopListening();
  }

  // 1. Append user message to thread
  const userMsgId = `msg_user_${Date.now()}`;
  messages.value.push({
    id: userMsgId,
    role: 'user',
    content: playerUtterance,
  });
  void scrollToBottom();

  isThinking.value = true;
  playSound('click');

  try {
    // 2. Prepare sliding window payload (last 4 turns)
    const historyPayload: AiChatMessage[] = messages.value
      .filter((m) => m.id !== userMsgId)
      .slice(-4)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    const payload: AiRoleplayPayload = {
      worldTrack: props.stage.worldTrack,
      stageId: props.stage.stageId,
      playerInput: playerUtterance,
      conversationHistory: historyPayload,
      aiMission: mission.value,
      guestId: userStore.user.uid,
    };

    // 3. Call Server API with Smart Fallback
    const response = await $fetch<AiRoleplayResponse>('/api/ai/roleplay', {
      method: 'POST',
      body: payload,
    });

    if (!response || !response.success) {
      throw new Error(response?.message || 'Không nhận được phản hồi từ AI.');
    }

    if (typeof response.remainingTurns === 'number') {
      remainingTurns.value = response.remainingTurns;
    }

    // 4. Append NPC response
    const npcMsg: RoleplayMessage = {
      id: `msg_model_${Date.now()}`,
      role: 'model',
      content: response.npcReply,
      vietnameseHint: response.vietnameseHint,
      grammarCorrection: response.grammarCorrection,
      scoreDelta: response.scoreDelta,
      isMissionCompleted: response.isMissionCompleted,
    };
    messages.value.push(npcMsg);
    void scrollToBottom();

    // 5. Play NPC voice audio
    speak(response.npcReply, { lang: 'en-US' });

    // 6. Record answer points into session
    sessionStore.recordAnswer({
      questionId: `roleplay_turn_${messages.value.length}`,
      itemType: 'roleplay',
      isCorrect: true,
      timeSpentMs: response.latencyMs || 1000,
      userResponse: playerUtterance,
      expectedResponse: mission.value.goal,
      scoreAwarded: response.scoreDelta || 25,
    });

    // 7. Check Mission Clear
    if (response.isMissionCompleted) {
      isMissionCleared.value = true;
      playSound('fanfare');
      triggerVictoryConfetti();

      // Store HMAC cryptographic proof in Pinia session store
      if (response.completionProof) {
        sessionStore.setAiCompletionProof(response.completionProof);
      }
    }
  } catch (err: unknown) {
    console.error('[GameAiRoleplay] Error sending message:', err);
    errorMessage.value =
      err instanceof Error
        ? err.message
        : 'Có sự cố kết nối với AI. Đang kích hoạt chế độ hỗ trợ...';
    playSound('wrong');
  } finally {
    isThinking.value = false;
  }
}

function handleContinue(): void {
  playSound('click');
  emit('completed');
}
</script>

<template>
  <div class="ai-roleplay-container theme-card">
    <!-- Roleplay Scenario Header -->
    <div class="roleplay-header">
      <div class="npc-emblem-wrapper">
        <span class="npc-avatar-emoji" aria-hidden="true">
          {{ mission.npcEmoji || '🎭' }}
        </span>
      </div>

      <div class="npc-meta-box">
        <div class="npc-title-row">
          <h2 class="npc-name">{{ mission.npcName }}</h2>
          <span class="mission-tag">Nhiệm Vụ Nhập Vai</span>
        </div>
        <p class="scenario-desc">{{ mission.scenario }}</p>
        <div class="goal-box">
          <span class="goal-label">Mục tiêu:</span>
          <span class="goal-text">{{ mission.goal }}</span>
        </div>
      </div>
    </div>

    <!-- Recommended Words / Quick Chips -->
    <div v-if="mission.recommendedWords?.length" class="recommended-chips-bar">
      <span class="chips-title">Từ khóa gợi ý:</span>
      <div class="chips-list">
        <button
          v-for="word in mission.recommendedWords"
          :key="word"
          type="button"
          class="word-chip-btn"
          title="Bấm để đưa từ này vào câu nói"
          @click="useChip(word)"
        >
          + {{ word }}
        </button>
      </div>
    </div>

    <!-- Chat Message History -->
    <div ref="chatScrollContainer" class="chat-thread-container">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message-row"
        :class="{
          'row-user': msg.role === 'user',
          'row-npc': msg.role === 'model'
        }"
      >
        <!-- NPC Avatar icon -->
        <div v-if="msg.role === 'model'" class="msg-avatar-badge" aria-hidden="true">
          {{ mission.npcEmoji || '🤖' }}
        </div>

        <div class="bubble-wrapper">
          <!-- Main text bubble -->
          <div class="chat-bubble">
            <p class="bubble-text">{{ msg.content }}</p>

            <!-- TTS Speaker Button on NPC Message -->
            <button
              v-if="msg.role === 'model'"
              type="button"
              class="speak-inline-btn"
              title="Nghe phát âm chuẩn"
              aria-label="Phát âm"
              @click="handleSpeakMessage(msg.content)"
            >
              🔊
            </button>
          </div>

          <!-- Inline Grammar Correction Alert -->
          <div v-if="msg.grammarCorrection" class="grammar-correction-box">
            <span class="correction-icon" aria-hidden="true">✏️</span>
            <div class="correction-content">
              <span class="correction-label">Góp ý ngữ pháp:</span>
              <span class="correction-text">{{ msg.grammarCorrection }}</span>
            </div>
          </div>

          <!-- Inline Vietnamese Hint -->
          <div v-if="msg.vietnameseHint" class="vietnamese-hint-box">
            <span class="hint-icon" aria-hidden="true">💡</span>
            <span class="hint-text">{{ msg.vietnameseHint }}</span>
          </div>

          <!-- Score delta pill -->
          <div v-if="msg.scoreDelta && msg.scoreDelta > 0" class="score-delta-pill">
            +{{ msg.scoreDelta }} ⭐
          </div>
        </div>
      </div>

      <!-- Thinking Indicator -->
      <div v-if="isThinking" class="message-row row-npc thinking-row">
        <div class="msg-avatar-badge" aria-hidden="true">
          {{ mission.npcEmoji || '🤖' }}
        </div>
        <div class="chat-bubble thinking-bubble">
          <span class="dot-bounce" />
          <span class="dot-bounce" />
          <span class="dot-bounce" />
          <span class="thinking-text">{{ mission.npcName }} đang suy nghĩ...</span>
        </div>
      </div>
    </div>

    <!-- Error Banner -->
    <div v-if="errorMessage" class="error-notice-banner">
      <span>⚠️ {{ errorMessage }}</span>
    </div>

    <!-- Input Bar & Voice Option -->
    <div class="chat-input-toolbar">
      <div class="input-field-wrapper">
        <input
          v-model="inputText"
          type="text"
          class="chat-input-field"
          placeholder="Nói bằng tiếng Anh để thuyết phục NPC... (Enter để gửi)"
          maxlength="150"
          :disabled="isThinking || isMissionCleared"
          @keydown.enter.prevent="handleSendMessage"
        >

        <span class="char-counter" :class="{ 'char-warning': charCount > 130 }">
          {{ charCount }}/150
        </span>
      </div>

      <!-- Voice Microphone Toggle -->
      <button
        v-if="isSttSupported"
        type="button"
        class="mic-action-btn"
        :class="{ 'mic-active': isListening }"
        :title="isListening ? 'Đang lắng nghe... Bấm để dừng' : 'Bấm để nói bằng giọng nói'"
        :disabled="isThinking || isMissionCleared"
        @click="toggleVoiceInput"
      >
        <span class="mic-icon" aria-hidden="true">{{ isListening ? '🔴' : '🎙️' }}</span>
      </button>

      <!-- Send Button -->
      <button
        type="button"
        class="theme-btn-primary send-msg-btn"
        :disabled="!isInputValid || isThinking || isMissionCleared"
        @click="handleSendMessage"
      >
        <span>Gửi</span>
        <span aria-hidden="true">➤</span>
      </button>
    </div>

    <!-- Mission Completed Modal Overlay -->
    <Transition name="celebrate-fade">
      <div v-if="isMissionCleared" class="mission-cleared-overlay">
        <div class="mission-cleared-card theme-card">
          <div class="cleared-emblem">🌟</div>
          <h2 class="cleared-title">Nhiệm Vụ Nhập Vai Thành Công!</h2>
          <p class="cleared-desc">
            Bạn đã xuất sắc dùng tiếng Anh để hoàn thành mục tiêu:
            <strong>"{{ mission.goal }}"</strong> cùng {{ mission.npcName }}.
          </p>

          <div class="cleared-proof-tag">
            <span class="shield-icon" aria-hidden="true">🛡️</span>
            <span>Chữ ký HMAC đã được kích hoạt</span>
          </div>

          <button type="button" class="theme-btn-primary finish-mission-btn" @click="handleContinue">
            Hoàn Tất Chặng Thử Thách →
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.ai-roleplay-container {
  display: flex;
  flex-direction: column;
  min-height: 580px;
  max-height: 720px;
  border-radius: var(--radius-lg);
  position: relative;
  overflow: hidden;
}

/* Header */
.roleplay-header {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.25rem 1.5rem;
  background: var(--bg-surface-translucent);
  border-bottom: 1px solid var(--border-color);
}

.npc-emblem-wrapper {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-md);
  background: var(--accent-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.25rem;
  box-shadow: var(--btn-3d-shadow);
  flex-shrink: 0;
}

.npc-meta-box {
  flex: 1;
}

.npc-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

.npc-name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--text-primary);
}

.mission-tag {
  font-size: 0.6875rem;
  font-weight: 800;
  background: var(--accent-gradient);
  color: var(--accent-text);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-pill);
  letter-spacing: 0.05em;
}

.scenario-desc {
  margin: 0 0 0.4rem 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.goal-box {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
}

.goal-label {
  font-weight: 700;
  color: var(--text-muted);
}

.goal-text {
  font-weight: 700;
  color: var(--accent-primary);
}

/* Quick Starter Chips */
.recommended-chips-bar {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 1.5rem;
  background: rgba(148, 163, 184, 0.08);
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;
}

.chips-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  white-space: nowrap;
}

.chips-list {
  display: flex;
  gap: 0.4rem;
}

.word-chip-btn {
  background: var(--bg-surface);
  border: 1px dashed var(--border-color);
  color: var(--text-primary);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-pill);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.word-chip-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  transform: translateY(-1px);
}

/* Chat Scroll Thread */
.chat-thread-container {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message-row {
  display: flex;
  gap: 0.75rem;
  max-width: 82%;
}

.row-user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.row-npc {
  align-self: flex-start;
}

.msg-avatar-badge {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.bubble-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.chat-bubble {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: var(--shadow-sm);
  word-break: break-word;
}

.row-user .chat-bubble {
  background: var(--accent-gradient);
  color: var(--accent-text);
  border-bottom-right-radius: 4px;
}

.row-npc .chat-bubble {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-bottom-left-radius: 4px;
}

.bubble-text {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.45;
  font-weight: 600;
}

.speak-inline-btn {
  background: transparent;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.15rem;
  opacity: 0.7;
  transition: opacity 0.15s ease, transform 0.15s ease;
  user-select: none;
}

.speak-inline-btn:hover {
  opacity: 1;
  transform: scale(1.15);
}

/* Inline Feedback Boxes */
.grammar-correction-box {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.6rem;
  font-size: 0.8125rem;
}

.correction-icon {
  font-size: 0.875rem;
}

.correction-content {
  display: flex;
  flex-direction: column;
}

.correction-label {
  font-weight: 700;
  color: #ef4444;
}

.correction-text {
  color: var(--text-primary);
  font-weight: 600;
}

.vietnamese-hint-box {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: var(--radius-sm);
  padding: 0.35rem 0.6rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.hint-icon {
  font-size: 0.875rem;
}

.hint-text {
  font-weight: 500;
}

.score-delta-pill {
  align-self: flex-start;
  font-size: 0.6875rem;
  font-weight: 800;
  color: #10b981;
  background: rgba(16, 185, 129, 0.12);
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius-pill);
}

/* Thinking Indicator */
.thinking-bubble {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.dot-bounce {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--accent-primary);
  animation: dot-pulse 1.4s infinite ease-in-out both;
}

.dot-bounce:nth-child(1) { animation-delay: -0.32s; }
.dot-bounce:nth-child(2) { animation-delay: -0.16s; }

@keyframes dot-pulse {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.thinking-text {
  font-size: 0.8125rem;
  color: var(--text-muted);
  font-weight: 600;
  margin-left: 0.3rem;
}

/* Error Notice Banner */
.error-notice-banner {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  padding: 0.5rem 1.5rem;
  font-size: 0.8125rem;
  font-weight: 700;
  border-top: 1px solid rgba(239, 68, 68, 0.25);
}

/* Input Bar */
.chat-input-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: var(--bg-surface-translucent);
  border-top: 1px solid var(--border-color);
}

.input-field-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.chat-input-field {
  width: 100%;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-pill);
  padding: 0.75rem 4.5rem 0.75rem 1.25rem;
  font-size: 0.9375rem;
  color: var(--text-primary);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.chat-input-field:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2);
}

.char-counter {
  position: absolute;
  right: 1rem;
  font-size: 0.6875rem;
  color: var(--text-muted);
  font-weight: 700;
  pointer-events: none;
}

.char-warning {
  color: #ef4444 !important;
}

.mic-action-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mic-action-btn:hover:not(:disabled) {
  border-color: var(--accent-primary);
  transform: scale(1.05);
}

.mic-active {
  background: #ef4444 !important;
  color: #ffffff;
  border-color: #ef4444 !important;
  animation: pulse-red 1.2s infinite ease-in-out;
}

@keyframes pulse-red {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
  50% { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
}

.send-msg-btn {
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-pill);
  gap: 0.4rem;
}

.send-msg-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* Mission Cleared Overlay */
.mission-cleared-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.mission-cleared-card {
  width: 100%;
  max-width: 460px;
  background: var(--bg-surface);
  padding: 2.25rem 2rem;
  text-align: center;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  border: 2px solid var(--accent-primary);
  animation: modal-pop 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes modal-pop {
  0% { transform: scale(0.9) translateY(20px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}

.cleared-emblem {
  font-size: 3.5rem;
  margin-bottom: 0.5rem;
  animation: bounce-emblem 1s infinite alternate ease-in-out;
}

@keyframes bounce-emblem {
  from { transform: translateY(0); }
  to { transform: translateY(-8px); }
}

.cleared-title {
  margin: 0 0 0.75rem 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-primary);
}

.cleared-desc {
  margin: 0 0 1.25rem 0;
  font-size: 0.9375rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.cleared-proof-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  font-size: 0.75rem;
  font-weight: 800;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-pill);
  margin-bottom: 1.5rem;
}

.finish-mission-btn {
  width: 100%;
  font-size: 1rem;
  padding: 0.875rem;
}

.celebrate-fade-enter-active,
.celebrate-fade-leave-active {
  transition: opacity 0.3s ease;
}

.celebrate-fade-enter-from,
.celebrate-fade-leave-to {
  opacity: 0;
}
</style>
