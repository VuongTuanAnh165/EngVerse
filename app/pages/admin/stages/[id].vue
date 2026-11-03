<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAdmin } from '~/composables/useAdmin';
import InteractiveMapPicker from '~/components/admin/InteractiveMapPicker.vue';
import type { WorldTrack } from '~/types/user';
import type { StageData, StageVocabItem, StageGrammarItem, CardRarity, PartOfSpeech, FunctionalGrammarCategory, AiRoleplayPlotTwist } from '~/types/game';

definePageMeta({
  layout: 'admin',
  middleware: 'admin-auth',
});

const route = useRoute();
const router = useRouter();
const { getStages, createStage, updateStage, generateStageWithAi } = useAdmin();

const rawId = (route.params.id as string) || 'new';
const isNewStage = computed(() => rawId === 'new');
const activeTrack = ref<WorldTrack>((route.query.track as WorldTrack) || 'kids');

const activeTab = ref<'general' | 'vocab' | 'grammar' | 'ai' | 'config'>('general');
const isLoading = ref(true);
const isSaving = ref(false);
const saveError = ref('');
const saveSuccess = ref('');

// AI Co-Pilot Modal State
const isAiModalOpen = ref(false);
const isAiGenerating = ref(false);
const aiTopic = ref('');
const aiCefrLevel = ref('A1');
const aiVocabCount = ref(8);
const aiErrorMessage = ref('');
const aiGenerationStatus = ref('');

// Suggested topics per universe
const topicSuggestions: Record<WorldTrack, string[]> = {
  kids: [
    'Các loài động vật trong rừng 🦁',
    'Các loại trái cây và màu sắc phép thuật 🍎',
    'Ngày đầu tiên đến trường tiểu học 🎒',
    'Gia đình và ngôi nhà hạnh phúc 👨‍👩‍👧',
    'Khám phá thế giới đại dương cùng cá heo 🐬',
    'Sinh nhật tuổi lên 6 với bánh kem 🎂',
  ],
  teens: [
    'Bẻ khóa Firewall Trùm Phantom AI 💻',
    'Mua linh kiện máy tính tại Chợ Đen Cyber 🤖',
    'Hẹn bạn bè đi uống trà sữa cuối tuần 🥤',
    'Trận chung kết giải đấu Thể Thao Điện Tử 🏆',
    'Lái xe bay tuần tra thành phố đêm Neon 🚗',
    'Nhạc hội EDM và vũ điệu ánh sáng 🎧',
  ],
  adults: [
    'Phỏng vấn xin việc bằng tiếng Anh tại London 💼',
    'Sự cố trễ chuyến bay tại Sân bay Quốc tế ✈️',
    'Đàm phán giá cả và ký hợp đồng thương mại 🤝',
    'Ăn tối và giao thiệp cùng đối tác tại nhà hàng 🍷',
    'Đặt phòng khách sạn và xử lý khiếu nại 🏨',
    'Thuyết trình báo cáo tài chính quý cho ban giám đốc 📈',
  ],
};

function openAiModal() {
  aiErrorMessage.value = '';
  aiCefrLevel.value = stageForm.cefrLevel || 'A1';
  if (!aiTopic.value && topicSuggestions[activeTrack.value]?.[0]) {
    aiTopic.value = topicSuggestions[activeTrack.value]?.[0] || '';
  }
  isAiModalOpen.value = true;
}

function selectTopicSuggestion(suggestion: string) {
  // Strip trailing emoji for clean topic
  aiTopic.value = suggestion.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
}

async function executeAiGeneration() {
  if (!aiTopic.value.trim()) {
    aiErrorMessage.value = 'Vui lòng nhập chủ đề bài học.';
    return;
  }

  isAiGenerating.value = true;
  aiErrorMessage.value = '';
  aiGenerationStatus.value = 'Đang gọi Gemini 3.8 Flash & Groq soạn thảo nội dung...';

  try {
    const res = await generateStageWithAi({
      topic: aiTopic.value.trim(),
      worldTrack: activeTrack.value,
      chapter: stageForm.chapter,
      cefrLevel: aiCefrLevel.value,
      vocabCount: aiVocabCount.value,
    });

    if (res.success && res.stage) {
      // Preserve current stageId and mapPosition
      const currentStageId = stageForm.stageId;
      const currentMapPosition = stageForm.mapPosition;

      Object.assign(stageForm, res.stage);
      stageForm.stageId = currentStageId;
      stageForm.mapPosition = currentMapPosition;

      // Update sync texts
      targetKeywordsText.value = (stageForm.aiRoleplayMission?.targetKeywords || []).join(', ');
      starterChipsText.value = (stageForm.aiRoleplayMission?.starterChips || []).join('\n');

      saveSuccess.value = `✨ AI (${res.providerUsed.toUpperCase()}) đã sinh hoàn tất 100% nội dung chặng trong ${(res.latencyMs / 1000).toFixed(1)}s! Hãy xem lại kho từ vựng và bấm "Lưu Chặng".`;
      isAiModalOpen.value = false;
      activeTab.value = 'vocab';
    }
  } catch (err) {
    aiErrorMessage.value = err instanceof Error ? err.message : String(err);
  } finally {
    isAiGenerating.value = false;
    aiGenerationStatus.value = '';
  }
}

const existingStages = ref<StageData[]>([]);

// Default blank stage template
const stageForm = reactive<StageData>({
  stageId: 1,
  chapter: 1,
  worldTrack: 'kids',
  cefrLevel: 'A1',
  title: '',
  subtitle: '',
  isBossStage: false,
  themeColor: '#38bdf8',
  mapPosition: { x: 50, y: 50 },
  storyIntro: '',
  reward: {
    baseExp: 100,
    baseGold: 50,
    firstClearBonusGold: 30,
    guaranteedCardId: '',
  },
  config: {
    vocabPickCount: 4,
    grammarPickCount: 3,
    voicePassThreshold: 0.7,
    timeLimitSeconds: 90,
  },
  vocabPool: [],
  grammarPool: [],
  aiRoleplayMission: {
    npcName: 'Guide',
    npcTitle: 'Trợ lý học tập',
    npcEmoji: '🤖',
    scenario: 'Luyện tập giao tiếp tiếng Anh cơ bản.',
    openingLine: 'Hello explorer! How are you doing today?',
    openingLineVi: 'Xin chào nhà thám hiểm! Bạn cảm thấy thế nào hôm nay?',
    goal: 'Chào hỏi và nói về kế hoạch của bạn bằng tiếng Anh.',
    recommendedWords: [],
    targetKeywords: [],
    starterChips: ['I am great, thank you!', 'I want to learn English.', 'Nice to meet you!'],
  },
});

// Comma-separated helper refs for easy editing
const distractorMeaningsText = ref<string[]>([]);
const distractorWordsText = ref<string[]>([]);
const targetKeywordsText = ref('');
const starterChipsText = ref('');

const functionalCategories: Array<{ value: FunctionalGrammarCategory; label: string }> = [
  { value: 'asking', label: 'Hỏi thông tin (Asking)' },
  { value: 'refusing', label: 'Từ chối lịch sự (Refusing)' },
  { value: 'apologizing', label: 'Xin lỗi & Khắc phục (Apologizing)' },
  { value: 'persuading', label: 'Thuyết phục (Persuading)' },
  { value: 'clarifying', label: 'Làm rõ / Xác nhận (Clarifying)' },
  { value: 'describing', label: 'Miêu tả chi tiết (Describing)' },
  { value: 'narrating', label: 'Kể chuyện / Trình tự (Narrating)' },
  { value: 'negotiating', label: 'Đàm phán / Thương lượng (Negotiating)' },
  { value: 'complaining', label: 'Phàn nàn / Khiếu nại (Complaining)' },
  { value: 'thanking', label: 'Cảm ơn & Tri ân (Thanking)' },
];

const hasPlotTwist = ref(false);
const plotTwistBonusKeywordsText = ref('');

function handlePlotTwistToggle() {
  if (hasPlotTwist.value && !stageForm.aiRoleplayMission.plotTwist) {
    stageForm.aiRoleplayMission.plotTwist = {
      triggerAfterTurn: 2,
      twistScenario: '',
      twistLineVi: '',
      bonusKeywords: [],
    };
  }
}

function setVocabCollocation(vocab: StageVocabItem, index: number, val: string) {
  if (!Array.isArray(vocab.collocations)) {
    vocab.collocations = ['', '', ''];
  }
  vocab.collocations[index] = val;
}

const rarityOptions: CardRarity[] = ['common', 'rare', 'epic', 'legendary'];
const posOptions: PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'idiom'];

async function initStageData() {
  isLoading.value = true;
  saveError.value = '';

  try {
    const stages = await getStages(activeTrack.value);
    existingStages.value = stages || [];

    if (isNewStage.value) {
      // Calculate next available ID
      const maxId = existingStages.value.reduce((max, s) => Math.max(max, s.stageId), 0);
      stageForm.stageId = maxId + 1;
      stageForm.worldTrack = activeTrack.value;
      stageForm.chapter = Math.floor(maxId / 5) + 1;
      stageForm.title = `Chặng Thử Thách ${stageForm.stageId}`;

      // Set initial map position offset
      const lastStage = existingStages.value[existingStages.value.length - 1];
      if (lastStage?.mapPosition) {
        stageForm.mapPosition = {
          x: Math.min(90, lastStage.mapPosition.x + 5),
          y: Math.min(90, lastStage.mapPosition.y + 5),
        };
      }

      // Add 4 sample vocab items for starter
      stageForm.vocabPool = [createBlankVocab(1), createBlankVocab(2), createBlankVocab(3), createBlankVocab(4)];
    } else {
      const targetId = Number(rawId);
      const found = existingStages.value.find((s) => s.stageId === targetId);

      if (!found) {
        saveError.value = `Không tìm thấy chặng #${targetId} trong vũ trụ ${activeTrack.value}.`;
        return;
      }

      // Populate stageForm
      Object.assign(stageForm, JSON.parse(JSON.stringify(found)));
      stageForm.worldTrack = activeTrack.value;

      // Fill comma-separated inputs
      targetKeywordsText.value = (stageForm.aiRoleplayMission?.targetKeywords || []).join(', ');
      starterChipsText.value = (stageForm.aiRoleplayMission?.starterChips || []).join('\n');
    }
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : String(err);
  } finally {
    isLoading.value = false;
  }
}

function createBlankVocab(index: number): StageVocabItem {
  const initial = activeTrack.value === 'kids' ? 'k' : activeTrack.value === 'teens' ? 't' : 'a';
  const stageId = stageForm.stageId;
  const idxStr = index < 10 ? '0' + index : String(index);

  return {
    id: `v_${initial}_${stageId}${idxStr}`,
    cardId: `card_${initial}_${stageId < 10 ? '0' + stageId : stageId}_${idxStr}`,
    word: '',
    ipa: '',
    partOfSpeech: 'noun',
    meaning: '',
    distractorMeanings: ['', '', ''],
    example: '',
    exampleMeaning: '',
    audioText: '',
    emoji: '✨',
    cardRarity: index === 1 ? 'rare' : 'common',
  };
}

function addVocabItem() {
  const nextIndex = stageForm.vocabPool.length + 1;
  stageForm.vocabPool.push(createBlankVocab(nextIndex));
}

function removeVocabItem(index: number) {
  if (stageForm.vocabPool.length <= 1) {
    alert('Mỗi chặng phải có tối thiểu 1 từ vựng.');
    return;
  }
  stageForm.vocabPool.splice(index, 1);
}

function addGrammarItem() {
  const nextId = `g_${activeTrack.value[0]}_${stageForm.stageId}${stageForm.grammarPool.length + 1}`;
  stageForm.grammarPool.push({
    id: nextId,
    grammarPattern: 'S + V + O',
    vietnamesePrompt: '',
    correctSentence: '',
    distractorWords: [],
    grammarTip: '',
  });
}

function removeGrammarItem(index: number) {
  stageForm.grammarPool.splice(index, 1);
}

// Pronounce text with Web Speech API
function testPronunciation(text: string) {
  if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

// Save stage handler
async function handleSaveStage() {
  saveError.value = '';
  saveSuccess.value = '';

  // Basic validation
  if (!stageForm.title.trim()) {
    saveError.value = 'Tên chặng không được để trống.';
    activeTab.value = 'general';
    return;
  }

  if (stageForm.vocabPool.length === 0) {
    saveError.value = 'Kho từ vựng phải có ít nhất 1 từ vựng.';
    activeTab.value = 'vocab';
    return;
  }

  // Parse comma-separated AI mission keywords
  if (targetKeywordsText.value) {
    const kw = targetKeywordsText.value.split(',').map((s) => s.trim()).filter(Boolean);
    stageForm.aiRoleplayMission.targetKeywords = kw;
    stageForm.aiRoleplayMission.recommendedWords = kw;
  }

  if (starterChipsText.value) {
    stageForm.aiRoleplayMission.starterChips = starterChipsText.value
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  isSaving.value = true;

  try {
    if (isNewStage.value) {
      const res = await createStage(stageForm);
      saveSuccess.value = `Tạo thành công chặng #${res.stage.stageId} và tự động đồng bộ ${res.syncedCardsCount} thẻ bài vào Codex!`;
      setTimeout(() => {
        router.push(`/admin/stages?track=${activeTrack.value}`);
      }, 1500);
    } else {
      const res = await updateStage(stageForm.stageId, stageForm);
      saveSuccess.value = `Lưu cập nhật chặng #${res.stage.stageId} thành công (Đồng bộ ${res.syncedCardsCount} thẻ Codex)!`;
    }
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : String(err);
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  initStageData();
  if (route.query.ai === 'true') {
    openAiModal();
  }
});
</script>

<template>
  <div class="admin-page-container">
    <!-- Header with Breadcrumb & Save Button -->
    <div class="editor-header">
      <div>
        <NuxtLink :to="`/admin/stages?track=${activeTrack}`" class="back-link">
          ← Danh sách chặng {{ activeTrack.toUpperCase() }}
        </NuxtLink>
        <h1 class="editor-title">
          {{ isNewStage ? 'Tạo Chặng Thử Thách Mới' : `Chỉnh Sửa Chặng #${stageForm.stageId}: ${stageForm.title}` }}
        </h1>
      </div>

      <div class="editor-actions">
        <button
          type="button"
          class="btn btn-ai-magic"
          @click="openAiModal"
        >
          <svg class="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
            <path d="M20 3v4"/>
            <path d="M22 5h-4"/>
            <path d="M4 17v2"/>
            <path d="M5 18H3"/>
          </svg>
          <span>AI Soạn Bài</span>
        </button>

        <button
          type="button"
          class="btn btn-secondary"
          @click="router.push(`/admin/stages?track=${activeTrack}`)"
        >
          <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
          <span>Hủy Bỏ</span>
        </button>

        <button
          type="button"
          class="btn btn-primary"
          :disabled="isSaving"
          @click="handleSaveStage"
        >
          <span v-if="isSaving" class="spinner-small"></span>
          <svg v-else class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          <span>{{ isSaving ? 'Đang lưu...' : 'Lưu Chặng (Auto-Sync)' }}</span>
        </button>
      </div>
    </div>

    <!-- Notification Banners -->
    <div v-if="saveSuccess" class="alert alert-success">
      <span>✅</span>
      <span>{{ saveSuccess }}</span>
    </div>

    <div v-if="saveError" class="alert alert-danger">
      <span>⚠️</span>
      <span>{{ saveError }}</span>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner-large"></div>
      <p>Đang tải dữ liệu chặng...</p>
    </div>

    <!-- Main Editor Tabs -->
    <div v-else class="editor-body">
      <!-- Tab Navigation -->
      <div class="editor-tabs-nav">
        <button
          type="button"
          class="tab-nav-btn"
          :class="{ active: activeTab === 'general' }"
          @click="activeTab = 'general'"
        >
          <span>🗺️</span>
          <span>Thông Tin & Bản Đồ</span>
        </button>

        <button
          type="button"
          class="tab-nav-btn"
          :class="{ active: activeTab === 'vocab' }"
          @click="activeTab = 'vocab'"
        >
          <span>📖</span>
          <span>Kho Từ Vựng ({{ stageForm.vocabPool.length }})</span>
        </button>

        <button
          type="button"
          class="tab-nav-btn"
          :class="{ active: activeTab === 'grammar' }"
          @click="activeTab = 'grammar'"
        >
          <span>🧩</span>
          <span>Ngữ Pháp ({{ stageForm.grammarPool.length }})</span>
        </button>

        <button
          type="button"
          class="tab-nav-btn"
          :class="{ active: activeTab === 'ai' }"
          @click="activeTab = 'ai'"
        >
          <span>🤖</span>
          <span>Nhiệm Vụ AI Roleplay</span>
        </button>

        <button
          type="button"
          class="tab-nav-btn"
          :class="{ active: activeTab === 'config' }"
          @click="activeTab = 'config'"
        >
          <span>⚙️</span>
          <span>Cấu Hình & Thưởng</span>
        </button>
      </div>

      <!-- Tab 1: General Info & Interactive Map Picker -->
      <div v-show="activeTab === 'general'" class="tab-pane">
        <!-- AI Callout Banner -->
        <div class="ai-callout-banner">
          <div class="callout-left">
            <div class="ai-orb">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                <path d="M20 3v4"/>
                <path d="M22 5h-4"/>
                <path d="M4 17v2"/>
                <path d="M5 18H3"/>
              </svg>
            </div>
            <div>
              <strong>Trợ lý AI Co-Pilot (Gemini 3.8 Flash & Groq)</strong>
              <p>Tự động tạo trọn gói 8 từ vựng, 3 câu đố ngữ pháp và kịch bản nhập vai NPC chỉ trong vài giây.</p>
            </div>
          </div>
          <button type="button" class="btn btn-ai-magic" @click="openAiModal">
            <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
              <path d="M20 3v4"/>
              <path d="M22 5h-4"/>
              <path d="M4 17v2"/>
              <path d="M5 18H3"/>
            </svg>
            <span>Mở AI Soạn Bài</span>
          </button>
        </div>
        <div class="form-grid-2">
          <!-- Left Column: Inputs -->
          <div class="form-column">
            <div class="form-row-2">
              <div class="form-group">
                <label>Mã Chặng (Stage ID):</label>
                <input v-model.number="stageForm.stageId" type="number" min="1" :disabled="!isNewStage" />
              </div>

              <div class="form-group">
                <label>Chương (Chapter):</label>
                <input v-model.number="stageForm.chapter" type="number" min="1" />
              </div>
            </div>

            <div class="form-group">
              <label>Tên Chặng (Title):</label>
              <input v-model="stageForm.title" type="text" placeholder="Ví dụ: Quả Trứng Phát Sáng" />
            </div>

            <div class="form-group">
              <label>Phụ Đề / Tóm Tắt (Subtitle):</label>
              <input v-model="stageForm.subtitle" type="text" placeholder="Ví dụ: Đánh thức Rồng Con bằng màu sắc" />
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label>Cấp Độ CEFR:</label>
                <select v-model="stageForm.cefrLevel">
                  <option value="Pre-A1">Pre-A1 (Mầm non / Mới bắt đầu)</option>
                  <option value="A1">A1 (Cơ bản)</option>
                  <option value="A2">A2 (Sơ cấp)</option>
                  <option value="B1">B1 (Trung cấp)</option>
                  <option value="B2">B2 (Nâng cao)</option>
                </select>
              </div>

              <div class="form-group">
                <label>Màu Chủ Đề (Theme Color):</label>
                <div class="color-picker-row">
                  <input v-model="stageForm.themeColor" type="color" class="color-swatch" />
                  <input v-model="stageForm.themeColor" type="text" class="color-hex-input" />
                </div>
              </div>
            </div>

            <div class="form-group checkbox-group">
              <label class="toggle-switch">
                <input v-model="stageForm.isBossStage" type="checkbox" />
                <span class="switch-slider"></span>
              </label>
              <span>👑 Đánh dấu là Màn Trùm Cuối Chương (Boss Stage)</span>
            </div>

            <div class="form-group">
              <label>Đoạn Giới Thiệu Cốt Truyện (Story Intro):</label>
              <textarea
                v-model="stageForm.storyIntro"
                rows="4"
                placeholder="Lời dẫn mở đầu khi người chơi bước vào màn chơi..."
              ></textarea>
            </div>
          </div>

          <!-- Right Column: Interactive Map Picker -->
          <div class="form-column">
            <InteractiveMapPicker
              v-model="stageForm.mapPosition"
              :world-track="activeTrack"
              :existing-stages="existingStages"
              :current-stage-id="stageForm.stageId"
              :stage-title="stageForm.title"
            />
          </div>
        </div>
      </div>

      <!-- Tab 2: Vocab Pool -->
      <div v-show="activeTab === 'vocab'" class="tab-pane">
        <div class="pane-header">
          <div>
            <h3>Danh Sách Từ Vựng Của Chặng ({{ stageForm.vocabPool.length }} từ)</h3>
            <p>Mỗi từ vựng sẽ tự động được sinh thành 1 thẻ bài tương ứng trong 3D Codex.</p>
          </div>
          <button type="button" class="btn btn-secondary" @click="addVocabItem">
            <span>➕</span>
            <span>Thêm Từ Vựng</span>
          </button>
        </div>

        <div class="vocab-cards-list">
          <div
            v-for="(vocab, vIdx) in stageForm.vocabPool"
            :key="vocab.id || vIdx"
            class="vocab-edit-card"
          >
            <div class="vocab-card-header">
              <span class="vocab-index-badge">#{{ vIdx + 1 }}</span>
              <input
                v-model="vocab.emoji"
                type="text"
                class="emoji-input"
                title="Emoji đại diện"
              />
              <strong class="vocab-card-title">{{ vocab.word || '(Chưa nhập từ)' }}</strong>

              <div class="vocab-header-right">
                <select v-model="vocab.cardRarity" class="rarity-badge-select" :class="`rarity-${vocab.cardRarity}`">
                  <option v-for="r in rarityOptions" :key="r" :value="r">
                    {{ r.toUpperCase() }}
                  </option>
                </select>
                <button
                  type="button"
                  class="btn-icon delete-vocab-btn"
                  title="Xóa từ vựng này"
                  @click="removeVocabItem(vIdx)"
                >
                  ✕
                </button>
              </div>
            </div>

            <div class="vocab-card-body">
              <div class="form-row-3">
                <div class="form-group">
                  <label>Từ tiếng Anh (Word):</label>
                  <div class="input-with-action">
                    <input v-model="vocab.word" type="text" placeholder="dragon" />
                    <button
                      type="button"
                      class="btn-icon-inline"
                      title="Phát âm thử"
                      @click="testPronunciation(vocab.word)"
                    >
                      🔊
                    </button>
                  </div>
                </div>

                <div class="form-group">
                  <label>Phiên âm (IPA):</label>
                  <input v-model="vocab.ipa" type="text" placeholder="/ˈdræɡ.ən/" />
                </div>

                <div class="form-group">
                  <label>Loại từ (Part of Speech):</label>
                  <select v-model="vocab.partOfSpeech">
                    <option v-for="pos in posOptions" :key="pos" :value="pos">
                      {{ pos }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="form-row-2">
                <div class="form-group">
                  <label>Nghĩa tiếng Việt (Meaning):</label>
                  <input v-model="vocab.meaning" type="text" placeholder="con rồng" />
                </div>

                <div class="form-group">
                  <label>3 Nghĩa Gây Nhiễu (Distractor Meanings):</label>
                  <div v-if="vocab.distractorMeanings" class="distractor-inputs">
                    <input
                      v-model="vocab.distractorMeanings[0]"
                      type="text"
                      placeholder="Nhiễu 1 (vd: khủng long)"
                    />
                    <input
                      v-model="vocab.distractorMeanings[1]"
                      type="text"
                      placeholder="Nhiễu 2 (vd: kỳ lân)"
                    />
                    <input
                      v-model="vocab.distractorMeanings[2]"
                      type="text"
                      placeholder="Nhiễu 3 (vd: đại bàng)"
                    />
                  </div>
                </div>
              </div>

              <div class="form-row-2">
                <div class="form-group">
                  <label>Câu ví dụ tiếng Anh (Example):</label>
                  <input
                    v-model="vocab.example"
                    type="text"
                    placeholder="The baby dragon is sleeping."
                  />
                </div>

                <div class="form-group">
                  <label>Dịch nghĩa câu ví dụ:</label>
                  <input
                    v-model="vocab.exampleMeaning"
                    type="text"
                    placeholder="Chú rồng con đang ngủ."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 3: Grammar Pool -->
      <div v-show="activeTab === 'grammar'" class="tab-pane">
        <div class="pane-header">
          <div>
            <h3>Thử Thách Ngữ Pháp & Ráp Câu ({{ stageForm.grammarPool.length }} câu đố)</h3>
            <p>Học viên sẽ sắp xếp các mảnh từ vựng để hoàn thành câu hoàn chỉnh.</p>
          </div>
          <button type="button" class="btn btn-secondary" @click="addGrammarItem">
            <span>➕</span>
            <span>Thêm Câu Đố Ngữ Pháp</span>
          </button>
        </div>

        <div v-if="stageForm.grammarPool.length === 0" class="empty-sub-state">
          <p>Chưa có câu đố ngữ pháp nào. Bấm nút phía trên để thêm.</p>
        </div>

        <div v-else class="grammar-cards-list">
          <div
            v-for="(grammar, gIdx) in stageForm.grammarPool"
            :key="grammar.id || gIdx"
            class="grammar-edit-card"
          >
            <div class="grammar-card-header">
              <span class="grammar-index-badge">Câu #{{ gIdx + 1 }}</span>
              <input
                v-model="grammar.grammarPattern"
                type="text"
                class="pattern-input"
                placeholder="Mẫu: S + have/has + O"
              />
              <button
                type="button"
                class="btn-icon delete-vocab-btn"
                @click="removeGrammarItem(gIdx)"
              >
                ✕
              </button>
            </div>

            <div class="grammar-card-body">
              <div class="form-group">
                <label>Gợi ý tiếng Việt (Vietnamese Prompt):</label>
                <input
                  v-model="grammar.vietnamesePrompt"
                  type="text"
                  placeholder="Ví dụ: Tôi nhìn thấy một quả trứng rồng vàng."
                />
              </div>

              <div class="form-group">
                <label>Câu tiếng Anh chuẩn xác (Correct Sentence):</label>
                <input
                  v-model="grammar.correctSentence"
                  type="text"
                  placeholder="Ví dụ: I see a golden dragon egg."
                />
              </div>

              <div class="form-row-2">
                <div class="form-group">
                  <label>Từ Gây Nhiễu (phân tách bằng dấu phẩy):</label>
                  <input
                    :value="(grammar.distractorWords || []).join(', ')"
                    type="text"
                    placeholder="an, red, sleeping"
                    @input="grammar.distractorWords = ($event.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean)"
                  />
                </div>

                <div class="form-group">
                  <label>Mẹo Ngữ Pháp (Grammar Tip):</label>
                  <input
                    v-model="grammar.grammarTip"
                    type="text"
                    placeholder="Mẹo: Dùng 'a' trước phụ âm, 'an' trước nguyên âm."
                  />
                </div>
              </div>

              <div class="form-group">
                <label>Chức năng giao tiếp đời thực (Functional Category):</label>
                <select v-model="grammar.functionalCategory" class="theme-select">
                  <option value="">-- Mặc định (Tự động nhận diện) --</option>
                  <option value="asking">🙋‍♂️ Asking — Yêu cầu &amp; Hỏi han lịch sự</option>
                  <option value="refusing">🛡️ Refusing — Từ chối khéo &amp; Ngăn chặn</option>
                  <option value="apologizing">🙏 Apologizing — Xin lỗi &amp; Nhận lỗi</option>
                  <option value="persuading">💡 Persuading — Khuyên nhủ &amp; Thuyết phục</option>
                  <option value="clarifying">🔍 Clarifying — Làm rõ &amp; Xác nhận chứng cứ</option>
                  <option value="describing">🎨 Describing — Miêu tả đặc điểm &amp; Nhận định</option>
                  <option value="narrating">📖 Narrating — Kể chuyện &amp; Diễn biến thời gian</option>
                  <option value="negotiating">🤝 Negotiating — Đàm phán &amp; Thỏa thuận điều kiện</option>
                  <option value="complaining">⚠️ Complaining — Khiếu nại &amp; Báo sự cố</option>
                  <option value="thanking">💐 Thanking — Cảm ơn &amp; Tri ân</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 4: AI Roleplay Mission -->
      <div v-show="activeTab === 'ai'" class="tab-pane">
        <div class="pane-header">
          <div>
            <h3>Nhiệm Vụ Nhập Vai AI (AI Roleplay Mission)</h3>
            <p>Hội thoại đối thoại với NPC ảo sử dụng Gemini Flash/Groq.</p>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-column">
            <div class="form-row-3">
              <div class="form-group" style="max-width: 90px;">
                <label>Icon Avatar:</label>
                <input v-model="stageForm.aiRoleplayMission.npcEmoji" type="text" class="emoji-input-large" />
              </div>

              <div class="form-group">
                <label>Tên Nhân Vật (NPC Name):</label>
                <input v-model="stageForm.aiRoleplayMission.npcName" type="text" placeholder="Dragon Master" />
              </div>

              <div class="form-group">
                <label>Danh Hiệu / Chức Danh:</label>
                <input v-model="stageForm.aiRoleplayMission.npcTitle" type="text" placeholder="Người Nuôi Rồng" />
              </div>
            </div>

            <div class="form-group">
              <label>Bối Cảnh Tình Huống (Scenario):</label>
              <textarea
                v-model="stageForm.aiRoleplayMission.scenario"
                rows="3"
                placeholder="Bối cảnh cuộc gặp gỡ giữa người chơi và nhân vật..."
              ></textarea>
            </div>

            <div class="form-group">
              <label>Mục Tiêu Để Hoàn Thành (Goal):</label>
              <input
                v-model="stageForm.aiRoleplayMission.goal"
                type="text"
                placeholder="Nói tên 2 loại trái cây và màu sắc để ấp trứng nở."
              />
            </div>
          </div>

          <div class="form-column">
            <div class="form-group">
              <label>Câu Chào Mở Đầu Tiếng Anh (Opening Line EN):</label>
              <input
                v-model="stageForm.aiRoleplayMission.openingLine"
                type="text"
                placeholder="Welcome to Dragon Island! What food did you bring?"
              />
            </div>

            <div class="form-group">
              <label>Câu Chào Tiếng Việt (Opening Line VI):</label>
              <input
                v-model="stageForm.aiRoleplayMission.openingLineVi"
                type="text"
                placeholder="Chào mừng đến Đảo Rồng! Bạn mang thức ăn gì tới vậy?"
              />
            </div>

            <div class="form-group">
              <label>Từ Khóa Bắt Buộc Để Qua Màn (phân tách dấu phẩy):</label>
              <input
                v-model="targetKeywordsText"
                type="text"
                placeholder="apple, banana, golden, dragon"
              />
            </div>

            <div class="form-group">
              <label>Gợi Ý Câu Nói Nhanh (Starter Chips - mỗi dòng 1 câu):</label>
              <textarea
                v-model="starterChipsText"
                rows="3"
                placeholder="I have a red apple.&#10;The dragon is hungry.&#10;Here is a sweet banana."
              ></textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 5: Config & Rewards -->
      <div v-show="activeTab === 'config'" class="tab-pane">
        <div class="pane-header">
          <div>
            <h3>Cấu Hình Màn Chơi & Phần Thưởng</h3>
            <p>Thiết lập thời gian đếm ngược, ngưỡng chấm điểm phát âm và phần thưởng qua màn.</p>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-column">
            <h4 class="section-title">⚙️ Cấu Hình Mini-Game</h4>

            <div class="form-row-2">
              <div class="form-group">
                <label>Số từ rút ra mỗi lượt chơi:</label>
                <input v-model.number="stageForm.config.vocabPickCount" type="number" min="1" max="10" />
              </div>

              <div class="form-group">
                <label>Số câu ngữ pháp rút ra:</label>
                <input v-model.number="stageForm.config.grammarPickCount" type="number" min="0" max="10" />
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label>Ngưỡng phát âm chuẩn (0.5 - 0.9):</label>
                <input v-model.number="stageForm.config.voicePassThreshold" type="number" step="0.05" min="0.5" max="0.95" />
              </div>

              <div class="form-group">
                <label>Thời gian đếm ngược (giây):</label>
                <input v-model.number="stageForm.config.timeLimitSeconds" type="number" min="30" max="300" />
              </div>
            </div>
          </div>

          <div class="form-column">
            <h4 class="section-title">🎁 Phần Thưởng Hoàn Thành</h4>

            <div class="form-row-2">
              <div class="form-group">
                <label>Kinh nghiệm cơ bản (EXP):</label>
                <input v-model.number="stageForm.reward.baseExp" type="number" min="10" />
              </div>

              <div class="form-group">
                <label>Vàng cơ bản (Gold):</label>
                <input v-model.number="stageForm.reward.baseGold" type="number" min="10" />
              </div>
            </div>

            <div class="form-group">
              <label>Thưởng Vàng lần đầu vượt màn:</label>
              <input v-model.number="stageForm.reward.firstClearBonusGold" type="number" min="0" />
            </div>

            <div class="form-group">
              <label>Thẻ Bài Chắc Chắn Nhận Được (Guaranteed Card):</label>
              <select v-model="stageForm.reward.guaranteedCardId">
                <option value="">-- Tự động chọn thẻ hiếm nhất --</option>
                <option
                  v-for="v in stageForm.vocabPool"
                  :key="v.cardId"
                  :value="v.cardId"
                >
                  {{ v.emoji }} {{ v.word }} ({{ v.cardRarity.toUpperCase() }}) - {{ v.cardId }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- AI Co-Pilot Modal -->
    <div v-if="isAiModalOpen" class="modal-overlay" @click.self="!isAiGenerating && (isAiModalOpen = false)">
      <div class="modal-card ai-modal-card">
        <div class="modal-header">
          <div class="ai-orb">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
              <path d="M20 3v4"/>
              <path d="M22 5h-4"/>
              <path d="M4 17v2"/>
              <path d="M5 18H3"/>
            </svg>
          </div>
          <div>
            <h2>Trợ Lý AI Soạn Bài Tự Động</h2>
            <p class="ai-modal-desc">Sử dụng Google Gemini 3.8 Flash & Groq tốc độ cao</p>
          </div>
          <button
            type="button"
            class="modal-close-x"
            :disabled="isAiGenerating"
            @click="isAiModalOpen = false"
          >
            ✕
          </button>
        </div>

        <div class="ai-modal-body">
          <div class="form-group">
            <label>Chủ đề bài học (Topic):</label>
            <input
              v-model="aiTopic"
              type="text"
              placeholder="Ví dụ: Đặt phòng khách sạn và xử lý khiếu nại, Khám phá vườn bách thú..."
              :disabled="isAiGenerating"
            />
          </div>

          <!-- Quick Topic Suggestion Chips -->
          <div class="suggestions-box">
            <label>Gợi ý chủ đề nhanh cho vũ trụ {{ activeTrack.toUpperCase() }}:</label>
            <div class="topic-chips">
              <button
                v-for="s in topicSuggestions[activeTrack]"
                :key="s"
                type="button"
                class="topic-chip"
                :disabled="isAiGenerating"
                @click="selectTopicSuggestion(s)"
              >
                {{ s }}
              </button>
            </div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label>Trình độ CEFR mục tiêu:</label>
              <select v-model="aiCefrLevel" :disabled="isAiGenerating">
                <option value="Pre-A1">Pre-A1 (Mầm non / Khởi đầu)</option>
                <option value="A1">A1 (Cơ bản)</option>
                <option value="A2">A2 (Sơ cấp)</option>
                <option value="B1">B1 (Trung cấp)</option>
                <option value="B2">B2 (Nâng cao)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Số lượng từ vựng cần sinh:</label>
              <select v-model.number="aiVocabCount" :disabled="isAiGenerating">
                <option :value="6">6 từ vựng</option>
                <option :value="8">8 từ vựng (Khuyến nghị chuẩn)</option>
                <option :value="10">10 từ vựng</option>
              </select>
            </div>
          </div>

          <!-- Generating Loader Animation -->
          <div v-if="isAiGenerating" class="ai-generating-box">
            <div class="ai-pulse-orb">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                <path d="M20 3v4"/>
                <path d="M22 5h-4"/>
                <path d="M4 17v2"/>
                <path d="M5 18H3"/>
              </svg>
            </div>
            <p class="ai-status-text">{{ aiGenerationStatus }}</p>
            <div class="ai-progress-bar">
              <div class="ai-progress-fill"></div>
            </div>
            <span class="ai-note">Vui lòng chờ khoảng 2-5 giây để AI hoàn thiện toàn bộ từ vựng, ngữ pháp và kịch bản...</span>
          </div>

          <div v-if="aiErrorMessage" class="modal-error">
            {{ aiErrorMessage }}
          </div>
        </div>

        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="isAiGenerating"
            @click="isAiModalOpen = false"
          >
            Hủy Bỏ
          </button>
          <button
            type="button"
            class="btn btn-ai-magic"
            :disabled="isAiGenerating"
            @click="executeAiGeneration"
          >
            <span v-if="isAiGenerating" class="spinner-small"></span>
            <span>{{ isAiGenerating ? 'Đang soạn thảo...' : 'Bắt Đầu Sinh Nội Dung' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page-container {
  padding: 32px 36px;
  box-sizing: border-box;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.back-link {
  color: #38bdf8;
  font-size: 13px;
  text-decoration: none;
  font-weight: 600;
}

.back-link:hover {
  text-decoration: underline;
}

.editor-title {
  margin: 4px 0 0 0;
  font-size: 24px;
  font-weight: 800;
  color: #f8fafc;
}

.editor-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

/* Button UI Components */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  font-size: 13.5px;
  font-weight: 700;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  line-height: 1.4;
  white-space: nowrap;
  user-select: none;
  text-decoration: none;
  font-family: inherit;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
  outline: none;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.btn-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: inline-block;
}

.btn-secondary {
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #e2e8f0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(51, 65, 85, 0.95);
  border-color: rgba(255, 255, 255, 0.32);
  color: #ffffff;
  transform: translateY(-1.5px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
}

.btn-secondary:active:not(:disabled) {
  transform: translateY(0);
  background: rgba(30, 41, 59, 0.9);
}

.btn-primary {
  background: linear-gradient(135deg, #0284c7 0%, #2563eb 55%, #4f46e5 100%);
  border: 1px solid rgba(56, 189, 248, 0.45);
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #0369a1 0%, #1d4ed8 55%, #4338ca 100%);
  border-color: rgba(56, 189, 248, 0.7);
  transform: translateY(-1.5px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

/* Alert banners */
.alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 20px;
}

.alert-success {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.4);
  color: #34d399;
}

.alert-danger {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
}

/* Tabs Nav */
.editor-tabs-nav {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 12px;
  margin-bottom: 24px;
  overflow-x: auto;
}

.tab-nav-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #94a3b8;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.tab-nav-btn:hover {
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
}

.tab-nav-btn.active {
  background: rgba(56, 189, 248, 0.15);
  border-color: rgba(56, 189, 248, 0.4);
  color: #38bdf8;
}

/* Tab Pane */
.tab-pane {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 28px;
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.pane-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #f1f5f9;
}

.pane-header p {
  margin: 4px 0 0 0;
  font-size: 13px;
  color: #94a3b8;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
}

@media (max-width: 1000px) {
  .form-grid-2 {
    grid-template-columns: 1fr;
  }
}

.form-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.form-row-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 12px;
  font-weight: 600;
  color: #cbd5e1;
}

.form-group input[type='text'],
.form-group input[type='number'],
.form-group select,
.form-group textarea {
  width: 100%;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 10px 12px;
  color: #fff;
  font-size: 13px;
  box-sizing: border-box;
  transition: all 0.2s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #38bdf8;
  background: rgba(30, 41, 59, 0.9);
}

/* Color Picker */
.color-picker-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-swatch {
  width: 40px;
  height: 38px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: transparent;
}

.color-hex-input {
  flex: 1;
}

/* Checkbox Toggle */
.checkbox-group {
  flex-direction: row;
  align-items: center;
  gap: 12px;
  margin: 6px 0;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 24px;
  transition: 0.3s;
}

.switch-slider:before {
  position: absolute;
  content: '';
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: 0.3s;
}

input:checked + .switch-slider {
  background-color: #f59e0b;
}

input:checked + .switch-slider:before {
  transform: translateX(20px);
}

/* Vocab List */
.vocab-cards-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.vocab-edit-card {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px 20px;
  transition: border-color 0.2s;
}

.vocab-edit-card:hover {
  border-color: rgba(56, 189, 248, 0.3);
}

.vocab-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.vocab-index-badge {
  font-size: 11px;
  font-weight: 800;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  padding: 2px 8px;
  border-radius: 6px;
}

.emoji-input {
  width: 38px;
  text-align: center;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 4px;
  font-size: 16px;
}

.vocab-card-title {
  font-size: 15px;
  color: #f8fafc;
}

.vocab-header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rarity-badge-select {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid transparent;
  background: #1e293b;
}

.rarity-common {
  color: #94a3b8;
  border-color: #475569;
}

.rarity-rare {
  color: #60a5fa;
  border-color: #2563eb;
}

.rarity-epic {
  color: #c084fc;
  border-color: #9333ea;
}

.rarity-legendary {
  color: #f59e0b;
  border-color: #d97706;
}

.btn-icon {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
}

.btn-icon:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.input-with-action {
  display: flex;
  gap: 6px;
}

.btn-icon-inline {
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: #38bdf8;
  border-radius: 6px;
  padding: 0 10px;
  cursor: pointer;
}

.collocation-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
}

.category-select {
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: #38bdf8;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  max-width: 200px;
}

.plot-twist-box {
  background: rgba(147, 51, 234, 0.08);
  border: 1px dashed rgba(168, 85, 247, 0.35);
  border-radius: 12px;
  padding: 16px;
  margin-top: 20px;
}

.plot-twist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 700;
  color: #c084fc;
}

.toggle-checkbox {
  width: 18px;
  height: 18px;
  accent-color: #a855f7;
  cursor: pointer;
}

.hint-pill {
  font-size: 11px;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.05);
  padding: 3px 8px;
  border-radius: 6px;
}

.plot-twist-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(168, 85, 247, 0.2);
}

.distractor-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
}

/* Grammar list */
.grammar-cards-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.grammar-edit-card {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px 20px;
}

.grammar-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.grammar-index-badge {
  font-size: 11px;
  font-weight: 800;
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  padding: 2px 8px;
  border-radius: 6px;
}

.pattern-input {
  flex: 1;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 6px 10px;
  color: #38bdf8;
  font-size: 13px;
  font-family: monospace;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 15px;
  font-weight: 700;
  color: #f1f5f9;
}

.emoji-input-large {
  font-size: 24px;
  text-align: center;
}

/* Spinner */
.spinner-small {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
/* AI Magic Button & Styles */
.btn-ai-magic {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #8b5cf6, #06b6d4);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s;
  box-shadow: 0 4px 15px rgba(139, 92, 246, 0.35);
}

.btn-ai-magic:hover:not(:disabled) {
  background: linear-gradient(135deg, #7c3aed, #0891b2);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.5);
}

.btn-ai-magic:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* AI Callout Banner in Tab 1 */
.ai-callout-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(6, 182, 212, 0.12));
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 14px;
  padding: 16px 20px;
  margin-bottom: 24px;
  gap: 16px;
  flex-wrap: wrap;
}

.callout-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.callout-sparkle {
  font-size: 28px;
}

.callout-left strong {
  display: block;
  font-size: 14px;
  color: #f1f5f9;
}

.callout-left p {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: #94a3b8;
}

/* AI Modal */
.ai-modal-card {
  max-width: 620px;
  border-color: rgba(139, 92, 246, 0.4);
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(139, 92, 246, 0.2);
}

.ai-orb {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(139, 92, 246, 0.2);
  border: 1px solid rgba(139, 92, 246, 0.4);
  font-size: 22px;
}

.ai-modal-desc {
  margin: 2px 0 0 0;
  font-size: 12px;
  color: #94a3b8;
}

.modal-close-x {
  margin-left: auto;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
}

.modal-close-x:hover {
  color: #fff;
}

.ai-modal-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin: 20px 0;
}

/* Suggestions chips */
.suggestions-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suggestions-box label {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
}

.topic-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.topic-chip {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  padding: 6px 12px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.topic-chip:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.4);
  color: #c084fc;
  transform: translateY(-1px);
}

/* Generating animation */
.ai-generating-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
}

.ai-pulse-orb {
  font-size: 36px;
  animation: pulse 1.5s infinite;
  margin-bottom: 8px;
}

.ai-status-text {
  font-size: 13px;
  font-weight: 700;
  color: #c084fc;
  margin: 0 0 12px 0;
}

.ai-progress-bar {
  width: 100%;
  max-width: 320px;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 9999px;
  overflow: hidden;
  margin-bottom: 10px;
}

.ai-progress-fill {
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg, #8b5cf6, #06b6d4);
  border-radius: 9999px;
  animation: progressIndeterminate 1.8s infinite ease-in-out;
}

@keyframes progressIndeterminate {
  0% {
    margin-left: 0%;
    width: 20%;
  }
  50% {
    margin-left: 40%;
    width: 60%;
  }
  100% {
    margin-left: 100%;
    width: 10%;
  }
}

.ai-note {
  font-size: 11px;
  color: #64748b;
  font-style: italic;
}
</style>
