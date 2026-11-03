<script setup lang="ts">
/**
 * EngVerse - AI Free Simulator (/play/free-simulator)
 * Lifelong conversational simulator with preset/custom scenarios, adaptive difficulty,
 * voice input/output integration, and CEFR evaluation.
 * Strictly typed (0 any), Vue 3.5 script setup, 1-Doc-Per-User architecture.
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.4, Tasks 4.1 & 4.2
 */

import { ref, computed, onMounted, nextTick, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '~/stores/user';
import { useSoundEffects } from '~/composables/useSoundEffects';
import { useSpeechEngine } from '~/composables/useSpeechEngine';
import {
  type SimulatorCategory,
  type CEFRLevel,
  type PresetScenario,
  type CustomScenarioConfig,
  type FreeSimSessionRecord,
  type SimulationTurnsOption,
  type NpcPersonaType,
  type FreeSimChatMessage,
  type FreeSimChatPayload,
  type FreeSimChatResponse,
  CATEGORY_METAS,
  PRESET_SCENARIOS,
  CUSTOM_PROMPT_SUGGESTIONS,
  MAX_DAILY_FREE_SIM_SESSIONS,
} from '~/types/freeSimulator';

const router = useRouter();
const userStore = useUserStore();
const { playSound, playClick, playCorrect, playVictoryFanfare } = useSoundEffects();
const {
  speak,
  stopSpeaking,
  startListening,
  stopListening,
  isListening,
  currentTranscript,
  isSttSupported,
  isTtsSupported,
} = useSpeechEngine();

// ---------------------------------------------------------------------------
// Tabs & Screen View State
// ---------------------------------------------------------------------------
type ActiveTab = 'presets' | 'custom' | 'history';
const activeTab = ref<ActiveTab>('presets');

// Simulation Arena Active Mode
const isSimulating = ref<boolean>(false);

function setTab(tab: ActiveTab): void {
  playClick();
  activeTab.value = tab;
}

// ---------------------------------------------------------------------------
// Daily Quota Tracking
// ---------------------------------------------------------------------------
const dailyQuotaRemaining = computed<number>(() => {
  return userStore.getFreeSimDailyRemaining();
});

const isQuotaExhausted = computed<boolean>(() => {
  return dailyQuotaRemaining.value <= 0;
});

// ---------------------------------------------------------------------------
// Filter & Search State for Presets
// ---------------------------------------------------------------------------
const selectedCategory = ref<SimulatorCategory | 'all'>('all');
const selectedCefrFilter = ref<CEFRLevel | 'all'>('all');
const searchQuery = ref<string>('');

const filteredScenarios = computed<PresetScenario[]>(() => {
  return PRESET_SCENARIOS.filter((scenario) => {
    if (selectedCategory.value !== 'all' && scenario.category !== selectedCategory.value) {
      return false;
    }
    if (selectedCefrFilter.value !== 'all' && scenario.targetCefr !== selectedCefrFilter.value) {
      return false;
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim();
      const matchTitle = scenario.title.toLowerCase().includes(q);
      const matchTitleVi = scenario.titleVi.toLowerCase().includes(q);
      const matchDesc = scenario.description.toLowerCase().includes(q);
      const matchVocab = scenario.recommendedVocab.some(
        (v) => v.word.toLowerCase().includes(q) || v.meaningVi.toLowerCase().includes(q)
      );
      if (!matchTitle && !matchTitleVi && !matchDesc && !matchVocab) {
        return false;
      }
    }
    return true;
  });
});

// ---------------------------------------------------------------------------
// Custom Scenario Builder State
// ---------------------------------------------------------------------------
const customPrompt = ref<string>('');
const customUserRole = ref<string>('Du khách / Ứng viên');
const customNpcRole = ref<string>('Người phỏng vấn / Nhân viên tiếp đón');
const customNpcName = ref<string>('Alex');
const customTargetCefr = ref<CEFRLevel | 'auto'>('auto');
const customTurnsCount = ref<SimulationTurnsOption>(12);
const customPersona = ref<NpcPersonaType>('friendly');

function applyQuickPrompt(item: typeof CUSTOM_PROMPT_SUGGESTIONS[0]): void {
  playClick();
  customPrompt.value = item.prompt;
  customTargetCefr.value = item.targetCefr;
  if (item.category === 'work') {
    customUserRole.value = 'Ứng viên tiềm năng';
    customNpcRole.value = 'Giám đốc Nhân sự (HR Director)';
    customNpcName.value = 'Ms. Jessica';
  } else if (item.category === 'advanced') {
    customUserRole.value = 'Đương đơn xin Visa';
    customNpcRole.value = 'Viên chức Lãnh sự quán';
    customNpcName.value = 'Officer Hayes';
  } else if (item.category === 'health') {
    customUserRole.value = 'Bệnh nhân';
    customNpcRole.value = 'Dược sĩ / Bác sĩ tư vấn';
    customNpcName.value = 'Dr. Julian';
  } else if (item.category === 'travel') {
    customUserRole.value = 'Khách lưu trú quốc tế';
    customNpcRole.value = 'Quản lý quầy Lễ tân';
    customNpcName.value = 'Marcus';
  } else {
    customUserRole.value = 'Người mua hàng';
    customNpcRole.value = 'Chủ sạp chợ đêm';
    customNpcName.value = 'Uncle Ken';
  }
}

// ---------------------------------------------------------------------------
// Scenario Briefing & Launch Modal
// ---------------------------------------------------------------------------
const isBriefingOpen = ref<boolean>(false);
const activeScenarioBrief = ref<PresetScenario | null>(null);
const activeCustomBrief = ref<CustomScenarioConfig | null>(null);

function openPresetBriefing(scenario: PresetScenario): void {
  playClick();
  activeScenarioBrief.value = scenario;
  activeCustomBrief.value = null;
  isBriefingOpen.value = true;
}

function openCustomBriefing(): void {
  if (!customPrompt.value.trim()) return;
  playClick();
  activeCustomBrief.value = {
    userPrompt: customPrompt.value.trim(),
    userRole: customUserRole.value.trim() || 'Người giao tiếp',
    npcRole: customNpcRole.value.trim() || 'Đối tác trò chuyện',
    npcName: customNpcName.value.trim() || 'Alex',
    targetCefr: customTargetCefr.value,
    turnsCount: customTurnsCount.value,
    npcPersona: customPersona.value,
  };
  activeScenarioBrief.value = null;
  isBriefingOpen.value = true;
}

function closeBriefing(): void {
  playClick();
  isBriefingOpen.value = false;
  activeScenarioBrief.value = null;
  activeCustomBrief.value = null;
}

// ---------------------------------------------------------------------------
// Active Live Simulation Conversation Engine (Task 4.2)
// ---------------------------------------------------------------------------
const currentSimTurn = ref<number>(1);
const maxSimTurns = ref<number>(12);
const activeMessages = ref<FreeSimChatMessage[]>([]);
const isAiThinking = ref<boolean>(false);
const userSpeechInput = ref<string>('');
const currentStarterChips = ref<string[]>([]);
const isSimulationCompleted = ref<boolean>(false);
const simErrorMessage = ref<string>('');
const translatedTurns = ref<Record<number, boolean>>({});
const chatContainerRef = ref<HTMLElement | null>(null);

// Session active metadata
const simTitle = ref<string>('');
const simCategory = ref<SimulatorCategory | 'custom'>('custom');
const simNpcName = ref<string>('Alex');
const simNpcRole = ref<string>('Đối tác đàm thoại');
const simNpcAvatar = ref<string>('🤖');
const simUserRole = ref<string>('Người giao tiếp');
const simTargetCefr = ref<CEFRLevel | 'auto'>('auto');
const simPersona = ref<NpcPersonaType>('friendly');
const simObjectives = ref<string[]>([]);
const simRecommendedVocab = ref<PresetScenario['recommendedVocab']>([]);

// Sync speech recognition transcript
watch(currentTranscript, (transcript) => {
  if (transcript && isListening.value) {
    userSpeechInput.value = transcript;
  }
});

function toggleMic(): void {
  if (isListening.value) {
    stopListening();
    playClick();
  } else {
    userSpeechInput.value = '';
    startListening('en-US');
    playClick();
  }
}

function scrollToBottom(): void {
  nextTick(() => {
    if (chatContainerRef.value) {
      chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight;
    }
  });
}

function toggleTranslation(idx: number): void {
  playClick();
  translatedTurns.value[idx] = !translatedTurns.value[idx];
}

function playSpeechAudio(text: string): void {
  if (!text) return;
  stopSpeaking();
  speak(text);
}

function selectStarterChip(chip: string): void {
  playClick();
  userSpeechInput.value = chip;
}

function startSimulationSession(): void {
  if (isQuotaExhausted.value) {
    playSound('wrong');
    alert('Bạn đã dùng hết 5 lượt giả lập miễn phí hôm nay. Vui lòng quay lại vào ngày mai (00:00 GMT+7)!');
    return;
  }

  playClick();
  isBriefingOpen.value = false;
  simErrorMessage.value = '';
  isSimulationCompleted.value = false;
  currentSimTurn.value = 1;
  activeMessages.value = [];
  translatedTurns.value = {};

  if (activeScenarioBrief.value) {
    const s = activeScenarioBrief.value;
    simTitle.value = s.title;
    simCategory.value = s.category;
    simNpcName.value = s.npcName;
    simNpcRole.value = s.npcRole;
    simNpcAvatar.value = s.npcAvatar;
    simUserRole.value = s.userRole;
    simTargetCefr.value = s.targetCefr;
    simPersona.value = 'friendly';
    maxSimTurns.value = s.suggestedTurns;
    simObjectives.value = s.objectives;
    simRecommendedVocab.value = s.recommendedVocab;

    // Initial opening message from NPC
    activeMessages.value.push({
      role: 'assistant',
      content: s.sampleOpening,
      vietnameseTranslation: 'Xin chào! Rất vui được gặp bạn hôm nay. Chúng ta bắt đầu nhé?',
      turnIndex: 0,
      createdAt: Date.now(),
    });

    currentStarterChips.value = [
      `Hello ${s.npcName}, thank you for meeting with me.`,
      `Good day! I am here regarding our appointment.`,
      `Hi there, could you help me with this matter?`,
    ];

    if (isTtsSupported.value) {
      playSpeechAudio(s.sampleOpening);
    }
  } else if (activeCustomBrief.value) {
    const c = activeCustomBrief.value;
    simTitle.value = c.userPrompt.slice(0, 45) + (c.userPrompt.length > 45 ? '...' : '');
    simCategory.value = 'custom';
    simNpcName.value = c.npcName;
    simNpcRole.value = c.npcRole;
    simNpcAvatar.value = '✨';
    simUserRole.value = c.userRole;
    simTargetCefr.value = c.targetCefr;
    simPersona.value = c.npcPersona;
    maxSimTurns.value = c.turnsCount;
    simObjectives.value = ['Giao tiếp trôi chảy và đạt mục tiêu theo tình huống.'];
    simRecommendedVocab.value = [];

    const opening = `Hello! I am ${c.npcName}, your ${c.npcRole}. I am ready to practice this scenario with you. How can I help you today?`;
    activeMessages.value.push({
      role: 'assistant',
      content: opening,
      vietnameseTranslation: `Xin chào! Tôi là ${c.npcName}. Tôi đã sẵn sàng giả lập tình huống cùng bạn!`,
      turnIndex: 0,
      createdAt: Date.now(),
    });

    currentStarterChips.value = [
      `Hello ${c.npcName}, I would like to discuss this with you.`,
      `Hi, thanks for taking the time to speak with me.`,
      `Good morning, I have a few questions for you.`,
    ];

    if (isTtsSupported.value) {
      playSpeechAudio(opening);
    }
  }

  isSimulating.value = true;
  scrollToBottom();
}

async function sendUserTurn(): Promise<void> {
  const text = userSpeechInput.value.trim();
  if (!text || isAiThinking.value) return;

  if (isListening.value) {
    stopListening();
  }

  playClick();
  simErrorMessage.value = '';

  // 1. Append user message to active conversation
  const userTurnIndex = currentSimTurn.value;
  activeMessages.value.push({
    role: 'user',
    content: text,
    turnIndex: userTurnIndex,
    createdAt: Date.now(),
  });

  userSpeechInput.value = '';
  isAiThinking.value = true;
  scrollToBottom();

  try {
    const payload: FreeSimChatPayload = {
      scenarioId: activeScenarioBrief.value?.id,
      scenarioTitle: simTitle.value,
      category: simCategory.value,
      userRole: simUserRole.value,
      npcRole: simNpcRole.value,
      npcName: simNpcName.value,
      npcPersona: simPersona.value,
      targetCefr: simTargetCefr.value,
      turnsCount: maxSimTurns.value as SimulationTurnsOption,
      currentTurn: userTurnIndex,
      playerInput: text,
      conversationHistory: activeMessages.value.map((m) => ({
        role: m.role,
        content: m.content,
        vietnameseTranslation: m.vietnameseTranslation,
        turnIndex: m.turnIndex,
      })),
      recommendedVocab: simRecommendedVocab.value,
      objectives: simObjectives.value,
      idToken: userStore.user.isGuest ? undefined : undefined,
      guestId: userStore.user.uid,
    };

    const res = await $fetch<FreeSimChatResponse>('/api/game/free-simulator/chat', {
      method: 'POST',
      body: payload,
    });

    if (res && res.success) {
      playCorrect();

      // Update the user's turn with detected CEFR
      const lastUserMsg = activeMessages.value[activeMessages.value.length - 1];
      if (lastUserMsg && lastUserMsg.role === 'user') {
        lastUserMsg.detectedCefrTurn = res.detectedCefrTurn;
      }

      // Append assistant's response
      activeMessages.value.push({
        role: 'assistant',
        content: res.npcReply,
        vietnameseTranslation: res.vietnameseTranslation,
        grammarCorrection: res.grammarCorrection,
        detectedCefrTurn: res.detectedCefrTurn,
        quickStarterChips: res.quickStarterChips,
        turnIndex: userTurnIndex,
        createdAt: Date.now(),
      });

      // Update starter chips for next turn
      currentStarterChips.value = res.quickStarterChips || [];

      // Automatically speak NPC reply if TTS is supported
      if (isTtsSupported.value) {
        playSpeechAudio(res.npcReply);
      }

      // Check if conversation completed
      if (res.isConversationCompleted || currentSimTurn.value >= maxSimTurns.value) {
        isSimulationCompleted.value = true;
        playVictoryFanfare();
      } else {
        currentSimTurn.value++;
      }
    } else {
      simErrorMessage.value = 'Không thể kết nối đến máy chủ AI. Đang sử dụng phản hồi dự phòng!';
    }
  } catch (err: unknown) {
    console.error('[FreeSimulator] Chat error:', err);
    simErrorMessage.value = 'Lỗi kết nối AI. Vui lòng kiểm tra mạng hoặc thử lại!';
    playSound('wrong');
  } finally {
    isAiThinking.value = false;
    scrollToBottom();
  }
}

function exitSimulationArena(): void {
  playClick();
  stopSpeaking();
  if (isListening.value) {
    stopListening();
  }
  isSimulating.value = false;
  activeMessages.value = [];
}

// ---------------------------------------------------------------------------
// History & Scorecard Inspection
// ---------------------------------------------------------------------------
const historyRecords = computed<FreeSimSessionRecord[]>(() => {
  return userStore.freeSimulator?.history || [];
});

const isScorecardOpen = ref<boolean>(false);
const inspectedRecord = ref<FreeSimSessionRecord | null>(null);

function viewRecordDetails(record: FreeSimSessionRecord): void {
  playClick();
  inspectedRecord.value = record;
  isScorecardOpen.value = true;
}

function closeScorecard(): void {
  playClick();
  isScorecardOpen.value = false;
  inspectedRecord.value = null;
}

function replayFromRecord(record: FreeSimSessionRecord): void {
  playClick();
  closeScorecard();
  if (record.scenarioId) {
    const matched = PRESET_SCENARIOS.find((s) => s.id === record.scenarioId);
    if (matched) {
      openPresetBriefing(matched);
      return;
    }
  }
  customPrompt.value = `Luyện tập lại tình huống: ${record.scenarioTitle}`;
  activeTab.value = 'custom';
}

function formatSessionDate(timestampMs: number): string {
  const d = new Date(timestampMs);
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getCefrBadgeClass(level: CEFRLevel): string {
  switch (level) {
    case 'A1':
    case 'A2':
      return 'badge-cefr-beginner';
    case 'B1':
    case 'B2':
      return 'badge-cefr-intermediate';
    case 'C1':
    case 'C2':
      return 'badge-cefr-advanced';
    default:
      return 'badge-cefr-intermediate';
  }
}

function goBackHome(): void {
  playClick();
  router.push('/');
}

onMounted(() => {
  userStore.initUserSession();
});

onUnmounted(() => {
  stopSpeaking();
  if (isListening.value) {
    stopListening();
  }
});
</script>

<template>
  <div class="free-sim-page">
    <!-- Ambient Glows -->
    <div class="ambient-glow glow-cyan" aria-hidden="true" />
    <div class="ambient-glow glow-purple" aria-hidden="true" />

    <div class="sim-container">
      <!-- =================================================================== -->
      <!-- VIEW 1: ACTIVE LIVE SIMULATION ARENA -->
      <!-- =================================================================== -->
      <main v-if="isSimulating" class="active-sim-arena theme-card">
        <!-- Top Arena Bar -->
        <header class="arena-top-bar">
          <div class="arena-bar-left">
            <button
              type="button"
              class="arena-exit-btn"
              aria-label="Thoát phòng giả lập"
              @click="exitSimulationArena"
            >
              ← Thoát
            </button>
            <div class="arena-title-pod">
              <div class="arena-title-row">
                <span class="arena-icon">{{ simNpcAvatar }}</span>
                <h2 class="arena-scenario-title">{{ simTitle }}</h2>
                <span
                  class="cefr-level-badge"
                  :class="getCefrBadgeClass(simTargetCefr === 'auto' ? 'B1' : simTargetCefr)"
                >
                  {{ simTargetCefr }}
                </span>
              </div>
              <div class="arena-npc-sub">
                Đang trò chuyện với: <strong>{{ simNpcName }}</strong> ({{ simNpcRole }})
              </div>
            </div>
          </div>

          <!-- Turn Progress & Quota -->
          <div class="arena-bar-right">
            <div class="turn-counter-box">
              <span class="turn-label">LƯỢT ĐỐI THOẠI</span>
              <span class="turn-val">
                <strong>{{ currentSimTurn }}</strong> / {{ maxSimTurns }}
              </span>
              <div class="turn-mini-bar">
                <div
                  class="turn-mini-fill"
                  :style="{ width: `${Math.min(100, (currentSimTurn / maxSimTurns) * 100)}%` }"
                />
              </div>
            </div>
          </div>
        </header>

        <!-- Error Alert Banner -->
        <div v-if="simErrorMessage" class="sim-error-banner">
          ⚠️ {{ simErrorMessage }}
        </div>

        <!-- Chat Stream Window -->
        <div ref="chatContainerRef" class="chat-stream-window">
          <div
            v-for="(msg, idx) in activeMessages"
            :key="idx"
            class="chat-bubble-row"
            :class="msg.role === 'user' ? 'row-user' : 'row-npc'"
          >
            <!-- NPC Avatar -->
            <div v-if="msg.role === 'assistant'" class="bubble-avatar npc-avatar">
              {{ simNpcAvatar }}
            </div>

            <!-- Bubble Content -->
            <div class="bubble-pod" :class="msg.role === 'user' ? 'bubble-user' : 'bubble-npc'">
              <div class="bubble-header">
                <span class="sender-name">
                  {{ msg.role === 'user' ? simUserRole : simNpcName }}
                </span>
                <span v-if="msg.detectedCefrTurn" class="instant-cefr-chip">
                  CEFR: {{ msg.detectedCefrTurn }}
                </span>
              </div>

              <!-- Message Text -->
              <p class="bubble-text">{{ msg.content }}</p>

              <!-- Optional Grammar Correction -->
              <div v-if="msg.grammarCorrection" class="bubble-grammar-tip">
                <span class="grammar-icon">💡</span>
                <span class="grammar-text"><strong>Gợi ý ngữ pháp:</strong> {{ msg.grammarCorrection }}</span>
              </div>

              <!-- Translated Text (Collapsible) -->
              <div v-if="msg.vietnameseTranslation && translatedTurns[idx]" class="bubble-translation">
                🇻🇳 {{ msg.vietnameseTranslation }}
              </div>

              <!-- Action Bar for Bubble -->
              <div v-if="msg.role === 'assistant'" class="bubble-action-bar">
                <button
                  type="button"
                  class="bubble-action-btn"
                  title="Nghe phát âm tiếng Anh"
                  @click="playSpeechAudio(msg.content)"
                >
                  🔊 Nghe
                </button>
                <button
                  v-if="msg.vietnameseTranslation"
                  type="button"
                  class="bubble-action-btn"
                  title="Dịch sang tiếng Việt"
                  @click="toggleTranslation(idx)"
                >
                  🌐 {{ translatedTurns[idx] ? 'Ẩn bản dịch' : 'Xem bản dịch' }}
                </button>
              </div>
            </div>

            <!-- User Avatar -->
            <div v-if="msg.role === 'user'" class="bubble-avatar user-avatar">
              👤
            </div>
          </div>

          <!-- AI Thinking Indicator -->
          <div v-if="isAiThinking" class="chat-bubble-row row-npc thinking-row">
            <div class="bubble-avatar npc-avatar">{{ simNpcAvatar }}</div>
            <div class="bubble-pod bubble-npc thinking-pod">
              <span class="thinking-text">{{ simNpcName }} đang suy nghĩ & phân tích CEFR...</span>
              <div class="typing-dots">
                <span class="dot" />
                <span class="dot" />
                <span class="dot" />
              </div>
            </div>
          </div>
        </div>

        <!-- Simulation Completed Celebration Card -->
        <div v-if="isSimulationCompleted" class="session-completed-card">
          <div class="completed-hero">
            <span class="completed-emoji">🏆</span>
            <div>
              <h3 class="completed-title">Phiên Giả Lập Hoàn Tất!</h3>
              <p class="completed-desc">
                Bạn đã hoàn thành trọn vẹn {{ maxSimTurns }} lượt hội thoại tình huống "{{ simTitle }}".
              </p>
            </div>
          </div>
          <div class="completed-actions">
            <button
              type="button"
              class="theme-btn-primary completed-btn"
              @click="exitSimulationArena"
            >
              ← Về Danh Sách Kịch Bản
            </button>
          </div>
        </div>

        <!-- Input & Starter Chips Bar (Only shown when not completed) -->
        <footer v-if="!isSimulationCompleted" class="arena-input-footer">
          <!-- Starter Chips Row -->
          <div v-if="currentStarterChips.length > 0 && !isAiThinking" class="starter-chips-row">
            <span class="chips-label">💡 Gợi ý câu nói tiếp:</span>
            <div class="chips-list">
              <button
                v-for="(chip, cIdx) in currentStarterChips"
                :key="cIdx"
                type="button"
                class="starter-chip-btn"
                @click="selectStarterChip(chip)"
              >
                {{ chip }}
              </button>
            </div>
          </div>

          <!-- Controls Input Bar -->
          <div class="input-controls-row">
            <!-- Voice Input Mic Button -->
            <button
              v-if="isSttSupported"
              type="button"
              class="mic-toggle-btn"
              :class="{ 'mic-active': isListening }"
              :title="isListening ? 'Bấm để dừng thu âm' : 'Bấm để nói bằng Microphone'"
              @click="toggleMic"
            >
              <span class="mic-icon">{{ isListening ? '⏹️' : '🎙️' }}</span>
              <span class="mic-pulse" aria-hidden="true" />
            </button>

            <!-- Text Input -->
            <input
              v-model="userSpeechInput"
              type="text"
              maxlength="150"
              class="speech-text-input"
              :placeholder="isListening ? 'Đang nghe giọng nói của bạn... Hãy nói to rõ...' : 'Gõ tiếng Anh hoặc bấm Mic để nói... (Enter để gửi)'"
              :disabled="isAiThinking"
              @keydown.enter.prevent="sendUserTurn"
            />

            <!-- Send Button -->
            <button
              type="button"
              class="send-turn-btn"
              :disabled="!userSpeechInput.trim() || isAiThinking"
              aria-label="Gửi lượt nói"
              @click="sendUserTurn"
            >
              Gửi ↵
            </button>
          </div>
        </footer>
      </main>

      <!-- =================================================================== -->
      <!-- VIEW 2: SCENARIO PICKER & HISTORY DASHBOARD -->
      <!-- =================================================================== -->
      <template v-else>
        <!-- 1. Top Navigation & Status Bar -->
        <header class="sim-header theme-card">
          <div class="sim-header-left">
            <button
              type="button"
              class="back-btn"
              aria-label="Quay lại trang chủ"
              @click="goBackHome"
            >
              <span class="back-arrow">←</span> Trang Chủ
            </button>
            <div class="title-cluster">
              <div class="title-row">
                <span class="sim-hero-emoji">🎙️</span>
                <h1 class="sim-title">AI Free Simulator</h1>
                <span class="sim-tag-beta">ENDGAME • LIFELONG</span>
              </div>
              <p class="sim-subtitle">
                Phòng Giả Lập Giao Tiếp Tự Do Trước Mọi Tình Huống Đời Thực & Đánh Giá CEFR Toàn Diện
              </p>
            </div>
          </div>

          <div class="sim-header-right">
            <!-- Daily Quota Counter Pill -->
            <div
              class="quota-pill"
              :class="{ 'quota-empty': isQuotaExhausted }"
              title="Giới hạn 5 phiên giả lập mỗi ngày (Reset 00:00 GMT+7)"
            >
              <div class="quota-icon">⚡</div>
              <div class="quota-text">
                <div class="quota-label">LƯỢT MIỄN PHÍ HÔM NAY</div>
                <div class="quota-val">
                  <strong>{{ dailyQuotaRemaining }}</strong> / {{ MAX_DAILY_FREE_SIM_SESSIONS }} phiên
                </div>
              </div>
            </div>
          </div>
        </header>

        <!-- 2. Main Navigation Tabs -->
        <nav class="sim-tab-nav" aria-label="Bộ chọn chế độ giả lập">
          <button
            type="button"
            class="sim-tab-btn"
            :class="{ 'tab-active': activeTab === 'presets' }"
            @click="setTab('presets')"
          >
            <span class="tab-emoji">🎯</span>
            <span class="tab-label">Kịch Bản Có Sẵn (Presets)</span>
            <span class="tab-badge">{{ PRESET_SCENARIOS.length }}</span>
          </button>

          <button
            type="button"
            class="sim-tab-btn"
            :class="{ 'tab-active': activeTab === 'custom' }"
            @click="setTab('custom')"
          >
            <span class="tab-emoji">✍️</span>
            <span class="tab-label">Tự Nhập Tình Huống</span>
            <span class="tab-badge-new">TÙY BIẾN</span>
          </button>

          <button
            type="button"
            class="sim-tab-btn"
            :class="{ 'tab-active': activeTab === 'history' }"
            @click="setTab('history')"
          >
            <span class="tab-emoji">📜</span>
            <span class="tab-label">Lịch Sử & Báo Cáo CEFR</span>
            <span v-if="historyRecords.length > 0" class="tab-badge">{{ historyRecords.length }}</span>
          </button>
        </nav>

        <!-- 3. TAB CONTENT -->

        <!-- TAB 1: PRESET SCENARIOS -->
        <section v-if="activeTab === 'presets'" class="presets-section">
          <!-- Search & Filter Bar -->
          <div class="filter-bar theme-card">
            <!-- Category Filter Pills -->
            <div class="category-pills-row">
              <button
                type="button"
                class="cat-pill"
                :class="{ 'cat-active': selectedCategory === 'all' }"
                @click="selectedCategory = 'all'; playClick()"
              >
                🌐 Tất Cả
              </button>
              <button
                v-for="cat in CATEGORY_METAS"
                :key="cat.id"
                type="button"
                class="cat-pill"
                :class="{ 'cat-active': selectedCategory === cat.id }"
                @click="selectedCategory = cat.id; playClick()"
              >
                <span>{{ cat.emoji }}</span>
                <span>{{ cat.name }}</span>
              </button>
            </div>

            <!-- Secondary Filters Row (CEFR & Keyword Search) -->
            <div class="secondary-filter-row">
              <div class="cefr-filter-group">
                <span class="filter-label">Chuẩn CEFR:</span>
                <button
                  type="button"
                  class="cefr-filter-chip"
                  :class="{ 'chip-active': selectedCefrFilter === 'all' }"
                  @click="selectedCefrFilter = 'all'; playClick()"
                >
                  Tất cả
                </button>
                <button
                  v-for="lvl in (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CEFRLevel[])"
                  :key="lvl"
                  type="button"
                  class="cefr-filter-chip"
                  :class="{ 'chip-active': selectedCefrFilter === lvl }"
                  @click="selectedCefrFilter = lvl; playClick()"
                >
                  {{ lvl }}
                </button>
              </div>

              <div class="search-box">
                <span class="search-icon">🔍</span>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Tìm kịch bản (ví dụ: hotel, phỏng vấn, visa, taxi...)"
                  class="search-input"
                />
                <button
                  v-if="searchQuery"
                  type="button"
                  class="clear-search-btn"
                  aria-label="Xóa tìm kiếm"
                  @click="searchQuery = ''; playClick()"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <!-- Scenarios Grid -->
          <div v-if="filteredScenarios.length > 0" class="scenarios-grid">
            <article
              v-for="scenario in filteredScenarios"
              :key="scenario.id"
              class="scenario-card theme-card"
              @click="openPresetBriefing(scenario)"
            >
              <div class="card-header">
                <div class="card-emoji-box">
                  <span class="card-emoji">{{ scenario.emoji }}</span>
                </div>
                <div class="card-badges">
                  <span
                    class="cefr-level-badge"
                    :class="getCefrBadgeClass(scenario.targetCefr)"
                  >
                    {{ scenario.targetCefr }}
                  </span>
                  <span class="turns-badge">
                    ⏱️ {{ scenario.suggestedTurns }} lượt
                  </span>
                </div>
              </div>

              <div class="card-body">
                <h3 class="scenario-title">{{ scenario.title }}</h3>
                <div class="scenario-title-vi">{{ scenario.titleVi }}</div>

                <div class="scenario-roles">
                  <div class="role-item">
                    <span class="role-icon">👤</span>
                    <span class="role-text"><strong>Bạn:</strong> {{ scenario.userRole }}</span>
                  </div>
                  <div class="role-item">
                    <span class="role-icon">{{ scenario.npcAvatar }}</span>
                    <span class="role-text"><strong>AI:</strong> {{ scenario.npcName }} ({{ scenario.npcRole }})</span>
                  </div>
                </div>

                <p class="scenario-desc">{{ scenario.description }}</p>

                <!-- Vocab Tags Preview -->
                <div class="vocab-preview-row">
                  <span
                    v-for="vocab in scenario.recommendedVocab.slice(0, 3)"
                    :key="vocab.word"
                    class="vocab-tag"
                    :title="vocab.meaningVi"
                  >
                    ✨ {{ vocab.word }}
                  </span>
                  <span v-if="scenario.recommendedVocab.length > 3" class="vocab-more">
                    +{{ scenario.recommendedVocab.length - 3 }}
                  </span>
                </div>
              </div>

              <div class="card-footer">
                <div class="stars-rating" :title="`Độ khó: ${scenario.difficultyRating}/5 sao`">
                  <span v-for="n in 5" :key="n" class="star" :class="{ 'star-filled': n <= scenario.difficultyRating }">
                    ★
                  </span>
                </div>
                <button
                  type="button"
                  class="start-card-btn"
                  aria-label="Chọn kịch bản này"
                >
                  Vào Giả Lập →
                </button>
              </div>
            </article>
          </div>

          <!-- Empty State for Search -->
          <div v-else class="empty-state theme-card">
            <div class="empty-emoji">🔍</div>
            <h3 class="empty-title">Không tìm thấy kịch bản phù hợp</h3>
            <p class="empty-desc">
              Hãy thử tìm bằng từ khóa khác hoặc chuyển sang tab "Tự Nhập Tình Huống" để tạo kịch bản theo ý muốn của bạn!
            </p>
            <button
              type="button"
              class="theme-btn-primary empty-action-btn"
              @click="selectedCategory = 'all'; selectedCefrFilter = 'all'; searchQuery = ''; playClick()"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        </section>

        <!-- TAB 2: CUSTOM SCENARIO BUILDER -->
        <section v-else-if="activeTab === 'custom'" class="custom-section">
          <div class="custom-builder-card theme-card">
            <div class="builder-header">
              <span class="builder-icon">✨</span>
              <div>
                <h2 class="builder-title">Thiết Kế Tình Huống Giả Lập Tùy Biến</h2>
                <p class="builder-desc">
                  Nhập bất kỳ tình huống thực tế nào bạn sắp phải đối mặt (bằng tiếng Việt hoặc tiếng Anh). Gemini AI sẽ nhập vai tự nhiên và phân tích năng lực giao tiếp của bạn.
                </p>
              </div>
            </div>

            <!-- Quick Suggestion Prompts -->
            <div class="quick-prompts-container">
              <span class="quick-prompt-label">💡 Gợi ý tình huống thịnh hành:</span>
              <div class="quick-prompts-grid">
                <button
                  v-for="(item, idx) in CUSTOM_PROMPT_SUGGESTIONS"
                  :key="idx"
                  type="button"
                  class="quick-prompt-btn"
                  @click="applyQuickPrompt(item)"
                >
                  {{ item.label }}
                </button>
              </div>
            </div>

            <!-- Prompt Input -->
            <div class="form-group">
              <div class="form-label-row">
                <label for="customPromptInput" class="form-label">
                  Mô tả tình huống bạn muốn luyện tập:
                </label>
                <span class="char-count">{{ customPrompt.length }}/300</span>
              </div>
              <textarea
                id="customPromptInput"
                v-model="customPrompt"
                maxlength="300"
                rows="4"
                class="custom-textarea"
                placeholder="Ví dụ: Tôi sắp đi phỏng vấn xin Visa du lịch Mỹ tại Đại sứ quán. Hãy đóng vai viên chức lãnh sự quán kiểm tra lý do và ràng buộc tài chính của tôi..."
              />
            </div>

            <!-- Granular Configuration Grid -->
            <div class="config-grid">
              <!-- 1. Target CEFR -->
              <div class="config-item">
                <label class="config-label">Mục tiêu cấp độ CEFR:</label>
                <div class="cefr-select-row">
                  <button
                    type="button"
                    class="select-pill"
                    :class="{ 'pill-selected': customTargetCefr === 'auto' }"
                    @click="customTargetCefr = 'auto'; playClick()"
                  >
                    ⚡ Tự động (Theo cấp độ bạn)
                  </button>
                  <button
                    v-for="lvl in (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CEFRLevel[])"
                    :key="lvl"
                    type="button"
                    class="select-pill"
                    :class="{ 'pill-selected': customTargetCefr === lvl }"
                    @click="customTargetCefr = lvl; playClick()"
                  >
                    {{ lvl }}
                  </button>
                </div>
              </div>

              <!-- 2. Simulation Turns -->
              <div class="config-item">
                <label class="config-label">Số lượt đối thoại:</label>
                <div class="turns-select-row">
                  <button
                    type="button"
                    class="select-pill"
                    :class="{ 'pill-selected': customTurnsCount === 8 }"
                    @click="customTurnsCount = 8; playClick()"
                  >
                    ⚡ 8 lượt (Nhanh - 5 phút)
                  </button>
                  <button
                    type="button"
                    class="select-pill"
                    :class="{ 'pill-selected': customTurnsCount === 12 }"
                    @click="customTurnsCount = 12; playClick()"
                  >
                    🎯 12 lượt (Tiêu chuẩn - 8 phút)
                  </button>
                  <button
                    type="button"
                    class="select-pill"
                    :class="{ 'pill-selected': customTurnsCount === 15 }"
                    @click="customTurnsCount = 15; playClick()"
                  >
                    🏆 15 lượt (Chuyên sâu - 12 phút)
                  </button>
                </div>
              </div>

              <!-- 3. Persona / Tone of AI -->
              <div class="config-item full-width">
                <label class="config-label">Phong thái & Thái độ của AI:</label>
                <div class="persona-cards-row">
                  <button
                    type="button"
                    class="persona-card"
                    :class="{ 'persona-selected': customPersona === 'friendly' }"
                    @click="customPersona = 'friendly'; playClick()"
                  >
                    <span class="persona-icon">🤝</span>
                    <div class="persona-info">
                      <span class="persona-title">Thân Thiện & Khích Lệ</span>
                      <span class="persona-desc">Nói chậm rãi, động viên và khéo léo gợi mở từ vựng.</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    class="persona-card"
                    :class="{ 'persona-selected': customPersona === 'professional' }"
                    @click="customPersona = 'professional'; playClick()"
                  >
                    <span class="persona-icon">👔</span>
                    <div class="persona-info">
                      <span class="persona-title">Chuyên Nghiệp & Điềm Đạm</span>
                      <span class="persona-desc">Phong thái công sở chuẩn mực, phản hồi rõ ràng, thực tế.</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    class="persona-card"
                    :class="{ 'persona-selected': customPersona === 'challenging' }"
                    @click="customPersona = 'challenging'; playClick()"
                  >
                    <span class="persona-icon">⚡</span>
                    <div class="persona-info">
                      <span class="persona-title">Thử Thách & Khắt Khe</span>
                      <span class="persona-desc">Truy vấn dồn dập, thử phản xạ tự nhiên và phản biện sắc bén.</span>
                    </div>
                  </button>
                </div>
              </div>

              <!-- 4. Roles input -->
              <div class="config-item">
                <label for="customUserRoleInput" class="config-label">Vai trò của bạn (User Role):</label>
                <input
                  id="customUserRoleInput"
                  v-model="customUserRole"
                  type="text"
                  class="form-input"
                  placeholder="Ví dụ: Ứng viên xin việc, Du khách, Người mua hàng..."
                />
              </div>

              <div class="config-item">
                <label for="customNpcRoleInput" class="config-label">Vai trò của AI (NPC Role):</label>
                <input
                  id="customNpcRoleInput"
                  v-model="customNpcRole"
                  type="text"
                  class="form-input"
                  placeholder="Ví dụ: Giám đốc Nhân sự, Viên chức Lãnh sự, Lễ tân..."
                />
              </div>
            </div>

            <!-- Submit Button -->
            <div class="builder-actions">
              <button
                type="button"
                class="theme-btn-primary create-sim-btn"
                :disabled="!customPrompt.trim()"
                @click="openCustomBriefing"
              >
                🚀 Xem Bản Tóm Tắt & Bắt Đầu Giả Lập
              </button>
            </div>
          </div>
        </section>

        <!-- TAB 3: HISTORY & PROGRESS -->
        <section v-else-if="activeTab === 'history'" class="history-section">
          <div v-if="historyRecords.length > 0" class="history-container">
            <div class="history-stats-banner theme-card">
              <div class="history-stat-box">
                <span class="stat-big-val">{{ historyRecords.length }}</span>
                <span class="stat-label">Phiên Giả Lập Gần Nhất</span>
              </div>
              <div class="history-stat-box">
                <span class="stat-big-val text-accent">
                  {{ historyRecords[0]?.achievedCefr || 'B1' }}
                </span>
                <span class="stat-label">Cấp Độ CEFR Gần Nhất</span>
              </div>
              <div class="history-stat-box">
                <span class="stat-big-val text-gold">
                  {{ userStore.user.freeSimulator?.totalSessionsCompleted || historyRecords.length }}
                </span>
                <span class="stat-label">Tổng Số Buổi Luyện Tập</span>
              </div>
            </div>

            <!-- Recent Sessions List -->
            <div class="sessions-list">
              <article
                v-for="record in historyRecords"
                :key="record.sessionId"
                class="history-card theme-card"
              >
                <div class="history-card-header">
                  <div>
                    <div class="history-date">{{ formatSessionDate(record.completedAt) }}</div>
                    <h3 class="history-title">{{ record.scenarioTitle }}</h3>
                  </div>
                  <div class="history-cefr-badge" :class="getCefrBadgeClass(record.achievedCefr)">
                    {{ record.achievedCefr }}
                  </div>
                </div>

                <!-- Score Bars -->
                <div class="history-scores-grid">
                  <div class="score-bar-item">
                    <div class="score-label-row">
                      <span>📚 Vốn từ (Lexical)</span>
                      <strong>{{ record.scorecard.lexicalResource.score }}%</strong>
                    </div>
                    <div class="progress-track">
                      <div
                        class="progress-fill fill-cyan"
                        :style="{ width: `${record.scorecard.lexicalResource.score}%` }"
                      />
                    </div>
                  </div>

                  <div class="score-bar-item">
                    <div class="score-label-row">
                      <span>📝 Ngữ pháp (Grammar)</span>
                      <strong>{{ record.scorecard.grammaticalAccuracy.score }}%</strong>
                    </div>
                    <div class="progress-track">
                      <div
                        class="progress-fill fill-purple"
                        :style="{ width: `${record.scorecard.grammaticalAccuracy.score}%` }"
                      />
                    </div>
                  </div>

                  <div class="score-bar-item">
                    <div class="score-label-row">
                      <span>🗣️ Phát âm (Pronunciation)</span>
                      <strong>{{ record.scorecard.pronunciation.score }}%</strong>
                    </div>
                    <div class="progress-track">
                      <div
                        class="progress-fill fill-emerald"
                        :style="{ width: `${record.scorecard.pronunciation.score}%` }"
                      />
                    </div>
                  </div>

                  <div class="score-bar-item">
                    <div class="score-label-row">
                      <span>🎯 Năng lực giao tiếp</span>
                      <strong>{{ record.scorecard.communicativeCompetence.score }}%</strong>
                    </div>
                    <div class="progress-track">
                      <div
                        class="progress-fill fill-amber"
                        :style="{ width: `${record.scorecard.communicativeCompetence.score}%` }"
                      />
                    </div>
                  </div>
                </div>

                <div class="history-card-actions">
                  <button
                    type="button"
                    class="btn-secondary-sm"
                    @click="viewRecordDetails(record)"
                  >
                    🔍 Xem Báo Cáo CEFR Chi Tiết
                  </button>
                  <button
                    type="button"
                    class="btn-primary-sm"
                    @click="replayFromRecord(record)"
                  >
                    🔄 Luyện Tập Lại
                  </button>
                </div>
              </article>
            </div>
          </div>

          <!-- Empty State for History -->
          <div v-else class="empty-state theme-card">
            <div class="empty-emoji">🎓</div>
            <h3 class="empty-title">Chưa Có Phiên Giả Lập Nào</h3>
            <p class="empty-desc">
              Bạn chưa thực hiện phiên giả lập nào. Hãy chọn một kịch bản hoặc nhập tình huống thực tế để nhận bảng phân tích chuẩn CEFR đầu tiên của bạn!
            </p>
            <button
              type="button"
              class="theme-btn-primary empty-action-btn"
              @click="setTab('presets')"
            >
              Khám Phá Kịch Bản Ngay 🚀
            </button>
          </div>
        </section>
      </template>
    </div>

    <!-- ======================================================================= -->
    <!-- MODAL 1: SCENARIO BRIEFING & LAUNCH CONFIRMATION -->
    <!-- ======================================================================= -->
    <Teleport to="body">
      <div
        v-if="isBriefingOpen"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="briefing-title"
        @click.self="closeBriefing"
      >
        <div class="briefing-modal-sheet theme-card">
          <!-- Modal Header -->
          <div class="modal-header">
            <div class="modal-header-left">
              <span class="modal-emoji">
                {{ activeScenarioBrief?.emoji || '✨' }}
              </span>
              <div>
                <h2 id="briefing-title" class="modal-title">
                  {{ activeScenarioBrief?.title || 'Tình Huống Giả Lập Tùy Biến' }}
                </h2>
                <div class="modal-sub">
                  {{ activeScenarioBrief?.titleVi || activeCustomBrief?.userPrompt }}
                </div>
              </div>
            </div>
            <button
              type="button"
              class="modal-close-btn"
              aria-label="Đóng bảng"
              @click="closeBriefing"
            >
              ✕
            </button>
          </div>

          <!-- Modal Body -->
          <div class="modal-body">
            <!-- Meta Pills -->
            <div class="briefing-meta-row">
              <span
                class="cefr-level-badge"
                :class="getCefrBadgeClass(activeScenarioBrief?.targetCefr || (activeCustomBrief?.targetCefr === 'auto' ? 'B1' : activeCustomBrief?.targetCefr || 'B1'))"
              >
                Mục tiêu: {{ activeScenarioBrief?.targetCefr || activeCustomBrief?.targetCefr }}
              </span>
              <span class="turns-badge">
                ⏱️ {{ activeScenarioBrief?.suggestedTurns || activeCustomBrief?.turnsCount }} Lượt hội thoại
              </span>
              <span v-if="activeCustomBrief" class="persona-tag">
                🎭 Phong thái: {{ activeCustomBrief.npcPersona }}
              </span>
            </div>

            <!-- Roles Breakdown -->
            <div class="briefing-roles-box">
              <div class="briefing-role-col">
                <span class="role-badge-pill">VAI CỦA BẠN</span>
                <h4 class="role-name">{{ activeScenarioBrief?.userRole || activeCustomBrief?.userRole }}</h4>
              </div>
              <div class="role-vs-divider">VS</div>
              <div class="briefing-role-col">
                <span class="role-badge-pill role-ai">VAI CỦA AI</span>
                <h4 class="role-name">
                  {{ activeScenarioBrief?.npcName || activeCustomBrief?.npcName }}
                  <small>({{ activeScenarioBrief?.npcRole || activeCustomBrief?.npcRole }})</small>
                </h4>
              </div>
            </div>

            <!-- Description / Objectives -->
            <div class="briefing-desc-box">
              <h4 class="box-heading">Bối cảnh nhiệm vụ:</h4>
              <p class="desc-text">
                {{ activeScenarioBrief?.description || activeCustomBrief?.userPrompt }}
              </p>
            </div>

            <!-- Objectives for Preset -->
            <div v-if="activeScenarioBrief?.objectives?.length" class="briefing-objectives-box">
              <h4 class="box-heading">Mục tiêu bạn cần đạt trong cuộc hội thoại:</h4>
              <ul class="objectives-list">
                <li
                  v-for="(obj, idx) in activeScenarioBrief.objectives"
                  :key="idx"
                  class="objective-item"
                >
                  <span class="obj-check">✓</span>
                  <span>{{ obj }}</span>
                </li>
              </ul>
            </div>

            <!-- Recommended Vocab for Preset -->
            <div v-if="activeScenarioBrief?.recommendedVocab?.length" class="briefing-vocab-box">
              <h4 class="box-heading">Từ vựng & Cụm từ gợi ý nên áp dụng:</h4>
              <div class="vocab-chips-wrap">
                <div
                  v-for="v in activeScenarioBrief.recommendedVocab"
                  :key="v.word"
                  class="vocab-chip-item"
                >
                  <span class="vocab-word">{{ v.word }}</span>
                  <span class="vocab-meaning">{{ v.meaningVi }}</span>
                </div>
              </div>
            </div>

            <!-- Sample Opening Preview -->
            <div v-if="activeScenarioBrief?.sampleOpening" class="opening-preview-box">
              <span class="opening-badge">LỜI MỞ ĐẦU CỦA AI:</span>
              <p class="opening-text">
                "{{ activeScenarioBrief.sampleOpening }}"
              </p>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="modal-footer">
            <button
              type="button"
              class="theme-btn-secondary"
              @click="closeBriefing"
            >
              Chọn Lại
            </button>
            <button
              type="button"
              class="theme-btn-primary launch-sim-btn"
              :disabled="isQuotaExhausted"
              @click="startSimulationSession"
            >
              <span v-if="isQuotaExhausted">Hết lượt hôm nay</span>
              <span v-else>🚀 Bắt Đầu Giả Lập</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ======================================================================= -->
    <!-- MODAL 2: DETAILED CEFR SCORECARD INSPECTION -->
    <!-- ======================================================================= -->
    <Teleport to="body">
      <div
        v-if="isScorecardOpen && inspectedRecord"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scorecard-title"
        @click.self="closeScorecard"
      >
        <div class="scorecard-modal-sheet theme-card">
          <!-- Header -->
          <div class="modal-header">
            <div class="modal-header-left">
              <span class="modal-emoji">📊</span>
              <div>
                <h2 id="scorecard-title" class="modal-title">Báo Cáo Năng Lực CEFR</h2>
                <div class="modal-sub">{{ inspectedRecord.scenarioTitle }}</div>
              </div>
            </div>
            <button
              type="button"
              class="modal-close-btn"
              aria-label="Đóng báo cáo"
              @click="closeScorecard"
            >
              ✕
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <!-- Overall Level Hero -->
            <div class="cefr-hero-card">
              <div class="cefr-hero-badge" :class="getCefrBadgeClass(inspectedRecord.achievedCefr)">
                {{ inspectedRecord.achievedCefr }}
              </div>
              <div class="cefr-hero-text">
                <h3 class="cefr-hero-title">Đạt Cấp Độ CEFR: {{ inspectedRecord.achievedCefr }}</h3>
                <p class="cefr-hero-summary">{{ inspectedRecord.scorecard.summary }}</p>
              </div>
            </div>

            <!-- Grammatical Errors & Corrections -->
            <div class="scorecard-section">
              <h4 class="scorecard-subhead">
                📝 Phân Tích Lỗi Sai Ngữ Pháp & Đề Xuất Câu Chuẩn:
              </h4>
              <div
                v-if="inspectedRecord.scorecard.grammaticalAccuracy.errorsFound.length > 0"
                class="errors-list"
              >
                <div
                  v-for="(err, idx) in inspectedRecord.scorecard.grammaticalAccuracy.errorsFound"
                  :key="idx"
                  class="error-item"
                >
                  <div class="error-said">
                    <span class="err-tag tag-said">Bạn đã nói:</span>
                    <span class="err-text">"{{ err.userSaid }}"</span>
                  </div>
                  <div class="error-corrected">
                    <span class="err-tag tag-correct">Câu chuẩn:</span>
                    <span class="err-text">"{{ err.corrected }}"</span>
                  </div>
                  <div class="error-explanation">
                    💡 <em>{{ err.explanation }}</em>
                  </div>
                </div>
              </div>
              <p v-else class="text-positive">
                🎉 Tuyệt vời! Bạn không mắc lỗi ngữ pháp đáng kể nào trong phiên này!
              </p>
            </div>

            <!-- Lexical Upgrades -->
            <div class="scorecard-section">
              <h4 class="scorecard-subhead">
                📚 Đề Xuất Nâng Cấp Từ Vựng (Lexical Resource):
              </h4>
              <div class="upgrades-list">
                <div
                  v-for="(upg, idx) in inspectedRecord.scorecard.lexicalResource.suggestedUpgrades"
                  :key="idx"
                  class="upgrade-item"
                >
                  <div class="upgrade-row">
                    <span class="orig-word">{{ upg.original }}</span>
                    <span class="upgrade-arrow">➔</span>
                    <span class="target-word">{{ upg.upgraded }}</span>
                  </div>
                  <div class="upgrade-context">{{ upg.contextVi }}</div>
                </div>
              </div>
            </div>

            <!-- Pronunciation & Fluency -->
            <div class="scorecard-section">
              <h4 class="scorecard-subhead">
                🗣️ Đánh Giá Phát Âm & Độ Trôi Chảy:
              </h4>
              <div class="fluency-card">
                <div>
                  <strong>Độ lưu loát:</strong>
                  <span class="fluency-tag">{{ inspectedRecord.scorecard.pronunciation.fluencyRating }}</span>
                </div>
                <div v-if="inspectedRecord.scorecard.pronunciation.problematicSounds.length > 0">
                  <strong>Âm cần rèn thêm:</strong>
                  <span class="problem-sounds">
                    {{ inspectedRecord.scorecard.pronunciation.problematicSounds.join(', ') }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button
              type="button"
              class="theme-btn-secondary"
              @click="closeScorecard"
            >
              Đóng
            </button>
            <button
              type="button"
              class="theme-btn-primary"
              @click="replayFromRecord(inspectedRecord)"
            >
              🔄 Luyện Tập Lại Tình Huống Này
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.free-sim-page {
  position: relative;
  min-height: calc(100vh - 65px);
  padding: 1.5rem 1rem 3rem;
  background: var(--bg-primary, #0b0f19);
  color: var(--text-primary, #f8fafc);
  overflow-x: hidden;
}

/* Ambient Backdrops */
.ambient-glow {
  position: absolute;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.15;
  pointer-events: none;
  z-index: 0;
}
.glow-cyan {
  top: -100px;
  left: -150px;
  background: #06b6d4;
}
.glow-purple {
  top: 300px;
  right: -150px;
  background: #8b5cf6;
}

.sim-container {
  position: relative;
  z-index: 1;
  max-width: 1200px;
  margin: 0 auto;
}

/* =========================================================================== */
/* ACTIVE LIVE SIMULATION ARENA STYLES */
/* =========================================================================== */
.active-sim-arena {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 110px);
  max-height: 850px;
  background: #0f172a;
  border: 1px solid rgba(6, 182, 212, 0.4);
  border-radius: var(--radius-lg, 16px);
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(6, 182, 212, 0.2);
  overflow: hidden;
}

.arena-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: rgba(17, 24, 39, 0.95);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.arena-bar-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.arena-exit-btn {
  padding: 0.45rem 0.85rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-md, 8px);
  color: var(--text-secondary, #94a3b8);
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}
.arena-exit-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
  color: #f87171;
}

.arena-title-pod {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.arena-title-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}
.arena-icon {
  font-size: 1.4rem;
}
.arena-scenario-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text-primary, #ffffff);
}
.arena-npc-sub {
  font-size: 0.78rem;
  color: var(--text-secondary, #94a3b8);
}
.arena-npc-sub strong {
  color: #38bdf8;
}

.turn-counter-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  min-width: 140px;
}
.turn-label {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: var(--text-muted, #64748b);
}
.turn-val {
  font-size: 1.05rem;
  color: var(--text-secondary, #94a3b8);
}
.turn-val strong {
  color: #38bdf8;
  font-size: 1.2rem;
}
.turn-mini-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-pill, 9999px);
  overflow: hidden;
}
.turn-mini-fill {
  height: 100%;
  background: linear-gradient(90deg, #06b6d4, #38bdf8);
  border-radius: var(--radius-pill, 9999px);
  transition: width 0.4s ease;
}

.sim-error-banner {
  padding: 0.6rem 1.25rem;
  background: rgba(239, 68, 68, 0.2);
  border-bottom: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
}

/* Chat Stream Window */
.chat-stream-window {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.chat-bubble-row {
  display: flex;
  gap: 0.85rem;
  max-width: 80%;
}
.row-npc {
  align-self: flex-start;
}
.row-user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.bubble-avatar {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 1.35rem;
  flex-shrink: 0;
}
.npc-avatar {
  background: rgba(6, 182, 212, 0.15);
  border: 1px solid rgba(6, 182, 212, 0.4);
}
.user-avatar {
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.4);
}

.bubble-pod {
  padding: 1rem 1.25rem;
  border-radius: var(--radius-md, 14px);
  position: relative;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25);
}
.bubble-npc {
  background: #1e293b;
  border: 1px solid rgba(6, 182, 212, 0.25);
  border-top-left-radius: 4px;
}
.bubble-user {
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-top-right-radius: 4px;
}

.bubble-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  margin-bottom: 0.4rem;
}
.sender-name {
  font-size: 0.78rem;
  font-weight: 700;
  color: #94a3b8;
}
.instant-cefr-chip {
  padding: 0.15rem 0.45rem;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  font-size: 0.68rem;
  font-weight: 800;
  color: #ffffff;
}

.bubble-text {
  margin: 0;
  font-size: 0.95rem;
  color: #ffffff;
  line-height: 1.5;
  letter-spacing: -0.01em;
}

.bubble-grammar-tip {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-top: 0.65rem;
  padding: 0.55rem 0.85rem;
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--radius-md, 8px);
  font-size: 0.82rem;
  color: #fde68a;
  line-height: 1.4;
}
.grammar-icon {
  font-size: 1rem;
}

.bubble-translation {
  margin-top: 0.65rem;
  padding: 0.55rem 0.85rem;
  background: rgba(0, 0, 0, 0.25);
  border-left: 2px solid #06b6d4;
  border-radius: 0 6px 6px 0;
  font-size: 0.85rem;
  color: #cbd5e1;
  font-style: italic;
  line-height: 1.45;
}

.bubble-action-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.bubble-action-btn {
  padding: 0.25rem 0.6rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-sm, 6px);
  color: var(--text-secondary, #94a3b8);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}
.bubble-action-btn:hover {
  background: rgba(6, 182, 212, 0.2);
  color: #38bdf8;
  border-color: #06b6d4;
}

/* Thinking Bubble */
.thinking-row {
  align-self: flex-start;
}
.thinking-pod {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.15rem;
}
.thinking-text {
  font-size: 0.82rem;
  color: #38bdf8;
  font-weight: 600;
}
.typing-dots {
  display: flex;
  gap: 4px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38bdf8;
  animation: pulse-dot 1.2s infinite ease-in-out;
}
.dot:nth-child(2) {
  animation-delay: 0.2s;
}
.dot:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes pulse-dot {
  0%, 100% { transform: scale(0.6); opacity: 0.4; }
  50% { transform: scale(1.2); opacity: 1; }
}

/* Session Completed Card */
.session-completed-card {
  padding: 1.5rem 2rem;
  margin: 1rem 1.5rem;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%);
  border: 1px solid rgba(16, 185, 129, 0.4);
  border-radius: var(--radius-lg, 14px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1.25rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
}
.completed-hero {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}
.completed-emoji {
  font-size: 2.5rem;
}
.completed-title {
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
  font-weight: 800;
  color: #34d399;
}
.completed-desc {
  margin: 0;
  font-size: 0.88rem;
  color: #cbd5e1;
}
.completed-btn {
  padding: 0.75rem 1.5rem;
  font-weight: 700;
}

/* Arena Input Footer */
.arena-input-footer {
  padding: 1rem 1.5rem;
  background: rgba(17, 24, 39, 0.95);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex-shrink: 0;
}

.starter-chips-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}
.chips-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: #38bdf8;
  white-space: nowrap;
}
.chips-list {
  display: flex;
  gap: 0.5rem;
}
.starter-chip-btn {
  padding: 0.35rem 0.75rem;
  background: rgba(6, 182, 212, 0.1);
  border: 1px solid rgba(6, 182, 212, 0.3);
  border-radius: var(--radius-pill, 9999px);
  color: #e0f2fe;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.18s ease;
}
.starter-chip-btn:hover {
  background: #06b6d4;
  color: #04101c;
}

.input-controls-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.mic-toggle-btn {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}
.mic-toggle-btn:hover {
  background: rgba(6, 182, 212, 0.2);
  border-color: #06b6d4;
}
.mic-toggle-btn.mic-active {
  background: #ef4444;
  border-color: #ef4444;
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.6);
}
.mic-icon {
  font-size: 1.35rem;
}

.speech-text-input {
  flex: 1;
  padding: 0.85rem 1.25rem;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-md, 12px);
  color: #ffffff;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s ease;
}
.speech-text-input:focus {
  border-color: #06b6d4;
  box-shadow: 0 0 12px rgba(6, 182, 212, 0.3);
}

.send-turn-btn {
  padding: 0.85rem 1.4rem;
  background: #06b6d4;
  border: none;
  border-radius: var(--radius-md, 12px);
  color: #04101c;
  font-size: 0.92rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}
.send-turn-btn:hover:not(:disabled) {
  background: #22d3ee;
  transform: translateY(-1px);
}
.send-turn-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* =========================================================================== */
/* DASHBOARD & SCENARIO PICKER STYLES */
/* =========================================================================== */
.sim-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1.25rem;
  padding: 1.5rem 2rem;
  margin-bottom: 1.75rem;
  background: var(--bg-card, #131d31);
  border: 1px solid var(--border-color, rgba(6, 182, 212, 0.3));
  border-radius: var(--radius-lg, 16px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}

.sim-header-left {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  flex: 1;
  min-width: 280px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.9rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-md, 10px);
  color: var(--text-secondary, #94a3b8);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}
.back-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text-primary, #ffffff);
  transform: translateX(-2px);
}
.back-arrow {
  font-size: 1.1rem;
}

.title-cluster {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.sim-hero-emoji {
  font-size: 1.8rem;
  line-height: 1;
}

.sim-title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 800;
  background: linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #c084fc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.02em;
}

.sim-tag-beta {
  padding: 0.2rem 0.6rem;
  background: rgba(14, 165, 233, 0.15);
  border: 1px solid rgba(14, 165, 233, 0.4);
  border-radius: var(--radius-pill, 9999px);
  color: #38bdf8;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.sim-subtitle {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary, #94a3b8);
  line-height: 1.4;
}

.sim-header-right {
  display: flex;
  align-items: center;
}

/* Daily Quota Pill */
.quota-pill {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.75rem 1.25rem;
  background: rgba(6, 182, 212, 0.1);
  border: 1px solid rgba(6, 182, 212, 0.3);
  border-radius: var(--radius-lg, 14px);
  box-shadow: 0 0 15px rgba(6, 182, 212, 0.15);
}
.quota-pill.quota-empty {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.35);
  box-shadow: 0 0 15px rgba(239, 68, 68, 0.15);
}
.quota-icon {
  font-size: 1.5rem;
}
.quota-label {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--text-muted, #64748b);
}
.quota-val {
  font-size: 1.05rem;
  color: var(--text-primary, #ffffff);
}
.quota-val strong {
  color: #38bdf8;
}
.quota-pill.quota-empty .quota-val strong {
  color: #f87171;
}

/* 2. Tabs */
.sim-tab-nav {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}

.sim-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1.4rem;
  background: var(--bg-card, #131d31);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md, 12px);
  color: var(--text-secondary, #94a3b8);
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}
.sim-tab-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary, #ffffff);
}
.sim-tab-btn.tab-active {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);
  border-color: #06b6d4;
  color: #38bdf8;
  box-shadow: 0 0 16px rgba(6, 182, 212, 0.25);
}
.tab-badge {
  padding: 0.15rem 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-pill, 9999px);
  font-size: 0.75rem;
  color: var(--text-primary, #ffffff);
}
.tab-badge-new {
  padding: 0.15rem 0.5rem;
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  border-radius: var(--radius-pill, 9999px);
  font-size: 0.65rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 0.05em;
}

/* 3. Filter Bar */
.filter-bar {
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.75rem;
  background: var(--bg-card, #131d31);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg, 14px);
}

.category-pills-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.75rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.cat-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-pill, 9999px);
  color: var(--text-secondary, #94a3b8);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
  white-space: nowrap;
}
.cat-pill:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary, #ffffff);
}
.cat-pill.cat-active {
  background: #06b6d4;
  border-color: #06b6d4;
  color: #04101c;
  font-weight: 700;
  box-shadow: 0 0 12px rgba(6, 182, 212, 0.4);
}

.secondary-filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.cefr-filter-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.filter-label {
  font-size: 0.85rem;
  color: var(--text-secondary, #94a3b8);
  margin-right: 0.2rem;
}
.cefr-filter-chip {
  padding: 0.3rem 0.65rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm, 6px);
  color: var(--text-secondary, #94a3b8);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;
}
.cefr-filter-chip:hover {
  color: var(--text-primary, #ffffff);
}
.cefr-filter-chip.chip-active {
  background: #8b5cf6;
  border-color: #8b5cf6;
  color: #ffffff;
  box-shadow: 0 0 10px rgba(139, 92, 246, 0.35);
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 260px;
  flex: 1;
  max-width: 400px;
}
.search-icon {
  position: absolute;
  left: 0.85rem;
  font-size: 0.9rem;
  color: var(--text-muted, #64748b);
  pointer-events: none;
}
.search-input {
  width: 100%;
  padding: 0.55rem 2.2rem 0.55rem 2.3rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-md, 8px);
  color: var(--text-primary, #ffffff);
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.2s ease;
}
.search-input:focus {
  border-color: #06b6d4;
  box-shadow: 0 0 10px rgba(6, 182, 212, 0.25);
}
.clear-search-btn {
  position: absolute;
  right: 0.65rem;
  background: transparent;
  border: none;
  color: var(--text-muted, #64748b);
  cursor: pointer;
  font-size: 0.8rem;
}
.clear-search-btn:hover {
  color: var(--text-primary, #ffffff);
}

/* 4. Scenarios Grid */
.scenarios-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1.25rem;
}

.scenario-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.4rem;
  background: var(--bg-card, #131d31);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg, 14px);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.scenario-card:hover {
  transform: translateY(-4px);
  border-color: #06b6d4;
  box-shadow: 0 12px 30px rgba(6, 182, 212, 0.18);
  background: var(--bg-card-hover, #1c2742);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.card-emoji-box {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md, 12px);
  font-size: 1.6rem;
}

.card-badges {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.cefr-level-badge {
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}
.badge-cefr-beginner {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.4);
}
.badge-cefr-intermediate {
  background: rgba(6, 182, 212, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(6, 182, 212, 0.4);
}
.badge-cefr-advanced {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.4);
}

.turns-badge {
  padding: 0.25rem 0.55rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-sm, 6px);
  font-size: 0.75rem;
  color: var(--text-secondary, #94a3b8);
}

.card-body {
  flex: 1;
  margin-bottom: 1.25rem;
}

.scenario-title {
  margin: 0 0 0.2rem;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-primary, #ffffff);
  line-height: 1.35;
}

.scenario-title-vi {
  margin-bottom: 0.75rem;
  font-size: 0.85rem;
  color: #38bdf8;
  font-weight: 600;
}

.scenario-roles {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.65rem 0.85rem;
  margin-bottom: 0.75rem;
  background: rgba(0, 0, 0, 0.25);
  border-radius: var(--radius-md, 8px);
  font-size: 0.82rem;
}
.role-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}
.role-icon {
  font-size: 0.95rem;
}
.role-text {
  color: var(--text-secondary, #94a3b8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.role-text strong {
  color: var(--text-primary, #f8fafc);
}

.scenario-desc {
  margin: 0 0 0.85rem;
  font-size: 0.85rem;
  color: var(--text-secondary, #94a3b8);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.vocab-preview-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.vocab-tag {
  padding: 0.2rem 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm, 6px);
  font-size: 0.72rem;
  color: #cbd5e1;
}
.vocab-more {
  font-size: 0.72rem;
  color: var(--text-muted, #64748b);
  font-weight: 700;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.stars-rating {
  display: flex;
  gap: 2px;
}
.star {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.15);
}
.star.star-filled {
  color: #f59e0b;
}

.start-card-btn {
  padding: 0.45rem 0.95rem;
  background: rgba(6, 182, 212, 0.15);
  border: 1px solid rgba(6, 182, 212, 0.4);
  border-radius: var(--radius-md, 8px);
  color: #38bdf8;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}
.start-card-btn:hover {
  background: #06b6d4;
  color: #04101c;
  box-shadow: 0 0 10px rgba(6, 182, 212, 0.4);
}

/* 5. Custom Scenario Builder */
.custom-builder-card {
  padding: 2rem;
  background: var(--bg-card, #131d31);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg, 16px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}

.builder-header {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}
.builder-icon {
  font-size: 2.2rem;
  line-height: 1;
}
.builder-title {
  margin: 0 0 0.35rem;
  font-size: 1.45rem;
  font-weight: 800;
  color: var(--text-primary, #ffffff);
}
.builder-desc {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary, #94a3b8);
  line-height: 1.45;
}

.quick-prompts-container {
  padding: 1.25rem;
  margin-bottom: 1.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-md, 12px);
}
.quick-prompt-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 700;
  color: #38bdf8;
  margin-bottom: 0.75rem;
}
.quick-prompts-grid {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.quick-prompt-btn {
  padding: 0.4rem 0.85rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-pill, 9999px);
  color: var(--text-primary, #f8fafc);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.18s ease;
}
.quick-prompt-btn:hover {
  background: rgba(6, 182, 212, 0.2);
  border-color: #06b6d4;
  color: #38bdf8;
}

.form-group {
  margin-bottom: 1.5rem;
}
.form-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.form-label {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary, #ffffff);
}
.char-count {
  font-size: 0.78rem;
  color: var(--text-muted, #64748b);
}

.custom-textarea {
  width: 100%;
  padding: 1rem 1.25rem;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-md, 12px);
  color: var(--text-primary, #ffffff);
  font-size: 0.95rem;
  font-family: inherit;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s ease;
}
.custom-textarea:focus {
  border-color: #06b6d4;
  box-shadow: 0 0 12px rgba(6, 182, 212, 0.25);
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
}
.config-item.full-width {
  grid-column: 1 / -1;
}

.config-label {
  display: block;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-secondary, #94a3b8);
  margin-bottom: 0.6rem;
}

.cefr-select-row,
.turns-select-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.select-pill {
  padding: 0.5rem 0.95rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md, 8px);
  color: var(--text-secondary, #94a3b8);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}
.select-pill:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary, #ffffff);
}
.select-pill.pill-selected {
  background: #06b6d4;
  border-color: #06b6d4;
  color: #04101c;
  font-weight: 700;
  box-shadow: 0 0 12px rgba(6, 182, 212, 0.35);
}

.persona-cards-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}
.persona-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md, 10px);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}
.persona-card:hover {
  background: rgba(255, 255, 255, 0.06);
}
.persona-card.persona-selected {
  background: rgba(139, 92, 246, 0.15);
  border-color: #8b5cf6;
  box-shadow: 0 0 14px rgba(139, 92, 246, 0.3);
}
.persona-icon {
  font-size: 1.5rem;
  line-height: 1;
}
.persona-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.persona-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-primary, #ffffff);
}
.persona-desc {
  font-size: 0.75rem;
  color: var(--text-secondary, #94a3b8);
  line-height: 1.35;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-md, 8px);
  color: var(--text-primary, #ffffff);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s ease;
}
.form-input:focus {
  border-color: #06b6d4;
}

.builder-actions {
  display: flex;
  justify-content: flex-end;
}
.create-sim-btn {
  padding: 0.85rem 1.8rem;
  font-size: 1rem;
  font-weight: 700;
  border-radius: var(--radius-md, 10px);
  box-shadow: 0 0 20px rgba(6, 182, 212, 0.4);
}

/* 6. History Tab */
.history-stats-banner {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  padding: 1.5rem;
  margin-bottom: 2rem;
  background: var(--bg-card, #131d31);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg, 14px);
  text-align: center;
}
.history-stat-box {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.stat-big-val {
  font-size: 2.2rem;
  font-weight: 800;
}
.text-accent {
  color: #38bdf8;
}
.text-gold {
  color: #f59e0b;
}
.stat-label {
  font-size: 0.82rem;
  color: var(--text-secondary, #94a3b8);
  font-weight: 600;
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.history-card {
  padding: 1.5rem;
  background: var(--bg-card, #131d31);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg, 14px);
}

.history-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}
.history-date {
  font-size: 0.78rem;
  color: var(--text-muted, #64748b);
  margin-bottom: 0.25rem;
}
.history-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-primary, #ffffff);
}

.history-cefr-badge {
  font-size: 1.4rem;
  font-weight: 900;
  padding: 0.4rem 1rem;
  border-radius: var(--radius-md, 10px);
}

.history-scores-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem 1.5rem;
  margin-bottom: 1.25rem;
}
.score-label-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.82rem;
  color: var(--text-secondary, #94a3b8);
  margin-bottom: 0.35rem;
}
.score-label-row strong {
  color: var(--text-primary, #ffffff);
}
.progress-track {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-pill, 9999px);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: var(--radius-pill, 9999px);
  transition: width 0.6s ease;
}
.fill-cyan {
  background: linear-gradient(90deg, #06b6d4, #38bdf8);
}
.fill-purple {
  background: linear-gradient(90deg, #8b5cf6, #c084fc);
}
.fill-emerald {
  background: linear-gradient(90deg, #10b981, #34d399);
}
.fill-amber {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

.history-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.btn-secondary-sm {
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-md, 8px);
  color: var(--text-primary, #ffffff);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-secondary-sm:hover {
  background: rgba(255, 255, 255, 0.12);
}
.btn-primary-sm {
  padding: 0.5rem 1rem;
  background: #06b6d4;
  border: none;
  border-radius: var(--radius-md, 8px);
  color: #04101c;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-primary-sm:hover {
  background: #22d3ee;
}

/* Empty State */
.empty-state {
  padding: 3rem 2rem;
  text-align: center;
  background: var(--bg-card, #131d31);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg, 16px);
}
.empty-emoji {
  font-size: 3rem;
  margin-bottom: 1rem;
}
.empty-title {
  margin: 0 0 0.5rem;
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--text-primary, #ffffff);
}
.empty-desc {
  max-width: 480px;
  margin: 0 auto 1.5rem;
  font-size: 0.9rem;
  color: var(--text-secondary, #94a3b8);
  line-height: 1.5;
}
.empty-action-btn {
  padding: 0.75rem 1.6rem;
  font-weight: 700;
}

/* ======================================================================= */
/* MODALS */
/* ======================================================================= */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
}

.briefing-modal-sheet,
.scorecard-modal-sheet {
  width: 100%;
  max-width: 680px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: #111827;
  border: 1px solid rgba(6, 182, 212, 0.4);
  border-radius: var(--radius-lg, 18px);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(6, 182, 212, 0.2);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.25rem 1.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.modal-header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.modal-emoji {
  font-size: 2rem;
  line-height: 1;
}
.modal-title {
  margin: 0 0 0.2rem;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--text-primary, #ffffff);
}
.modal-sub {
  font-size: 0.85rem;
  color: #38bdf8;
  font-weight: 600;
}
.modal-close-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary, #94a3b8);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.3rem;
}
.modal-close-btn:hover {
  color: var(--text-primary, #ffffff);
}

.modal-body {
  padding: 1.5rem 1.75rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.briefing-meta-row {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.persona-tag {
  padding: 0.25rem 0.6rem;
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.4);
  border-radius: var(--radius-sm, 6px);
  font-size: 0.75rem;
  color: #c084fc;
}

.briefing-roles-box {
  display: flex;
  align-items: center;
  padding: 1rem 1.25rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md, 12px);
}
.briefing-role-col {
  flex: 1;
}
.role-badge-pill {
  display: inline-block;
  padding: 0.15rem 0.45rem;
  background: rgba(6, 182, 212, 0.2);
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 800;
  color: #38bdf8;
  margin-bottom: 0.3rem;
}
.role-badge-pill.role-ai {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
}
.role-name {
  margin: 0;
  font-size: 0.95rem;
  color: var(--text-primary, #ffffff);
}
.role-name small {
  display: block;
  font-size: 0.78rem;
  color: var(--text-secondary, #94a3b8);
  font-weight: normal;
}
.role-vs-divider {
  padding: 0 1rem;
  font-size: 0.85rem;
  font-weight: 900;
  color: var(--text-muted, #64748b);
}

.box-heading {
  margin: 0 0 0.5rem;
  font-size: 0.88rem;
  font-weight: 700;
  color: #38bdf8;
}
.desc-text {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary, #94a3b8);
  line-height: 1.5;
}

.objectives-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.objective-item {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  font-size: 0.85rem;
  color: var(--text-primary, #f8fafc);
  line-height: 1.4;
}
.obj-check {
  color: #10b981;
  font-weight: 800;
}

.vocab-chips-wrap {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}
.vocab-chip-item {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.75rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm, 6px);
}
.vocab-word {
  font-weight: 700;
  font-size: 0.85rem;
  color: #38bdf8;
}
.vocab-meaning {
  font-size: 0.75rem;
  color: var(--text-secondary, #94a3b8);
}

.opening-preview-box {
  padding: 0.85rem 1rem;
  background: rgba(6, 182, 212, 0.06);
  border-left: 3px solid #06b6d4;
  border-radius: 0 8px 8px 0;
}
.opening-badge {
  display: block;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #38bdf8;
  margin-bottom: 0.25rem;
}
.opening-text {
  margin: 0;
  font-size: 0.88rem;
  font-style: italic;
  color: #f8fafc;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.85rem;
  padding: 1.25rem 1.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.launch-sim-btn {
  padding: 0.75rem 1.5rem;
  font-weight: 700;
}

/* Scorecard Modal Specific */
.cefr-hero-card {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md, 12px);
}
.cefr-hero-badge {
  font-size: 2.2rem;
  font-weight: 900;
  padding: 0.75rem 1.4rem;
  border-radius: var(--radius-md, 12px);
}
.cefr-hero-title {
  margin: 0 0 0.35rem;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text-primary, #ffffff);
}
.cefr-hero-summary {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary, #94a3b8);
  line-height: 1.45;
}

.scorecard-section {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.scorecard-subhead {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
  color: #38bdf8;
}

.errors-list,
.upgrades-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.error-item,
.upgrade-item {
  padding: 0.85rem 1rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-md, 8px);
  font-size: 0.85rem;
}
.err-tag {
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  margin-right: 0.4rem;
}
.tag-said {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}
.tag-correct {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}
.error-said,
.error-corrected {
  margin-bottom: 0.35rem;
}
.error-explanation {
  font-size: 0.8rem;
  color: var(--text-secondary, #94a3b8);
  margin-top: 0.35rem;
}

.upgrade-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}
.orig-word {
  color: var(--text-secondary, #94a3b8);
}
.upgrade-arrow {
  color: #38bdf8;
}
.target-word {
  color: #38bdf8;
}
.upgrade-context {
  font-size: 0.78rem;
  color: var(--text-secondary, #94a3b8);
}

.fluency-card {
  padding: 0.85rem 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: var(--radius-md, 8px);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.85rem;
}
.fluency-tag {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.15rem 0.5rem;
  background: rgba(6, 182, 212, 0.2);
  color: #38bdf8;
  border-radius: 4px;
  font-weight: 700;
}
.problem-sounds {
  margin-left: 0.5rem;
  color: #f87171;
  font-family: monospace;
}

.text-positive {
  font-size: 0.88rem;
  color: #34d399;
  font-weight: 600;
}

/* Responsiveness */
@media (max-width: 768px) {
  .sim-header {
    padding: 1.25rem;
  }
  .active-sim-arena {
    height: calc(100vh - 80px);
  }
  .arena-top-bar {
    padding: 0.75rem 1rem;
  }
  .chat-bubble-row {
    max-width: 92%;
  }
  .config-grid {
    grid-template-columns: 1fr;
  }
  .persona-cards-row {
    grid-template-columns: 1fr;
  }
  .history-scores-grid {
    grid-template-columns: 1fr;
  }
  .history-stats-banner {
    grid-template-columns: 1fr;
  }
  .vocab-chips-wrap {
    grid-template-columns: 1fr;
  }
  .briefing-roles-box {
    flex-direction: column;
    gap: 0.75rem;
    text-align: center;
  }
}
</style>
