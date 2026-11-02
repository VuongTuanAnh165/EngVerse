<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAdmin } from '~/composables/useAdmin';
import type { CodexData, CodexCard, CodexCollection, CodexTitle, CardRarity, PartOfSpeech } from '~/types/game';
import type { WorldTrack } from '~/types/user';

definePageMeta({
  layout: 'admin',
  middleware: 'admin-auth',
});

const { getCodex, saveCard, deleteCard, saveCollection, saveTitle } = useAdmin();

const activeMainTab = ref<'cards' | 'collections' | 'titles'>('cards');
const isLoading = ref(true);
const codexData = ref<CodexData | null>(null);

// Filters
const activeTrackFilter = ref<string>('all');
const activeRarityFilter = ref<string>('all');
const searchQuery = ref<string>('');

// Card Editor Modal State
const isCardModalOpen = ref(false);
const isSavingCard = ref(false);
const cardModalError = ref('');
const cardForm = ref<CodexCard>({
  id: '',
  vocabId: '',
  worldTrack: 'kids',
  stageId: 1,
  setId: 'set_k_1',
  word: '',
  ipa: '',
  partOfSpeech: 'noun',
  meaning: '',
  example: '',
  exampleMeaning: '',
  audioText: '',
  emoji: '✨',
  rarity: 'common',
  lore: '',
});

// Card to delete state
const cardToDelete = ref<CodexCard | null>(null);
const isDeletingCard = ref(false);

// Collection Editor Modal State
const isCollectionModalOpen = ref(false);
const isSavingCollection = ref(false);
const collectionForm = ref<CodexCollection>({
  setId: '',
  worldTrack: 'kids',
  stageId: 1,
  title: '',
  description: '',
  rewardGold: 100,
  rewardExp: 150,
  unlockTitleId: '',
  cardIds: [],
});

// Title Editor Modal State
const isTitleModalOpen = ref(false);
const isSavingTitle = ref(false);
const titleForm = ref<CodexTitle>({
  id: '',
  name: '',
  nameEn: '',
  badgeEmoji: '🏆',
  worldTrack: 'all',
  description: '',
});

const rarityList: CardRarity[] = ['common', 'rare', 'epic', 'legendary'];
const posList: PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'idiom'];

async function loadCodexData() {
  isLoading.value = true;
  try {
    codexData.value = await getCodex();
  } catch (err) {
    console.error('[AdminCodex] Load error:', err);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadCodexData();
});

// Rarity stats
const rarityCounts = computed(() => {
  const counts = { common: 0, rare: 0, epic: 0, legendary: 0 };
  if (!codexData.value?.cards) return counts;
  for (const c of codexData.value.cards) {
    if (counts[c.rarity] !== undefined) counts[c.rarity]++;
  }
  return counts;
});

// Filtered cards list
const filteredCards = computed<CodexCard[]>(() => {
  if (!codexData.value?.cards) return [];
  const q = searchQuery.value.trim().toLowerCase();

  return codexData.value.cards.filter((card) => {
    if (activeTrackFilter.value !== 'all' && card.worldTrack !== activeTrackFilter.value) {
      return false;
    }
    if (activeRarityFilter.value !== 'all' && card.rarity !== activeRarityFilter.value) {
      return false;
    }
    if (!q) return true;

    return (
      card.word.toLowerCase().includes(q) ||
      card.meaning.toLowerCase().includes(q) ||
      card.id.toLowerCase().includes(q)
    );
  });
});

// Web Speech pronunciation test
function speakWord(text: string) {
  if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

// Card Modal Handlers
function openNewCardModal() {
  cardModalError.value = '';
  const nextIdx = (codexData.value?.cards?.length || 0) + 1;
  cardForm.value = {
    id: `card_custom_${nextIdx}`,
    vocabId: `v_custom_${nextIdx}`,
    worldTrack: (activeTrackFilter.value !== 'all' ? activeTrackFilter.value : 'kids') as WorldTrack,
    stageId: 1,
    setId: 'set_k_1',
    word: '',
    ipa: '',
    partOfSpeech: 'noun',
    meaning: '',
    example: '',
    exampleMeaning: '',
    audioText: '',
    emoji: '✨',
    rarity: 'common',
    lore: '',
  };
  isCardModalOpen.value = true;
}

function openEditCardModal(card: CodexCard) {
  cardModalError.value = '';
  cardForm.value = JSON.parse(JSON.stringify(card));
  isCardModalOpen.value = true;
}

async function handleSaveCard() {
  if (!cardForm.value.word.trim() || !cardForm.value.meaning.trim()) {
    cardModalError.value = 'Vui lòng nhập từ tiếng Anh và nghĩa tiếng Việt.';
    return;
  }

  isSavingCard.value = true;
  cardModalError.value = '';

  try {
    await saveCard(cardForm.value);
    isCardModalOpen.value = false;
    await loadCodexData();
  } catch (err) {
    cardModalError.value = err instanceof Error ? err.message : String(err);
  } finally {
    isSavingCard.value = false;
  }
}

// Delete Card Handlers
function openDeleteCardModal(card: CodexCard) {
  cardToDelete.value = card;
}

async function confirmDeleteCard() {
  if (!cardToDelete.value) return;
  isDeletingCard.value = true;
  try {
    await deleteCard(cardToDelete.value.id);
    cardToDelete.value = null;
    await loadCodexData();
  } catch (err) {
    alert('Xóa thẻ thất bại: ' + (err instanceof Error ? err.message : String(err)));
  } finally {
    isDeletingCard.value = false;
  }
}

// Collection Modal Handlers
function openNewCollectionModal() {
  const nextSetId = `set_${activeTrackFilter.value === 'kids' ? 'k' : activeTrackFilter.value === 'teens' ? 't' : 'a'}_${(codexData.value?.collections?.length || 0) + 1}`;
  collectionForm.value = {
    setId: nextSetId,
    worldTrack: (activeTrackFilter.value !== 'all' ? activeTrackFilter.value : 'kids') as WorldTrack,
    stageId: (codexData.value?.collections?.length || 0) + 1,
    title: '',
    description: '',
    rewardGold: 100,
    rewardExp: 150,
    unlockTitleId: '',
    cardIds: [],
  };
  isCollectionModalOpen.value = true;
}

function openEditCollectionModal(col: CodexCollection) {
  collectionForm.value = JSON.parse(JSON.stringify(col));
  isCollectionModalOpen.value = true;
}

async function handleSaveCollection() {
  isSavingCollection.value = true;
  try {
    await saveCollection(collectionForm.value);
    isCollectionModalOpen.value = false;
    await loadCodexData();
  } catch (err) {
    alert('Lưu bộ sưu tập thất bại: ' + (err instanceof Error ? err.message : String(err)));
  } finally {
    isSavingCollection.value = false;
  }
}

// Title Modal Handlers
function openNewTitleModal() {
  const nextId = `title_custom_${Date.now().toString(36)}`;
  titleForm.value = {
    id: nextId,
    name: '',
    nameEn: '',
    badgeEmoji: '🏅',
    worldTrack: 'all',
    description: '',
  };
  isTitleModalOpen.value = true;
}

function openEditTitleModal(title: CodexTitle) {
  titleForm.value = JSON.parse(JSON.stringify(title));
  isTitleModalOpen.value = true;
}

async function handleSaveTitle() {
  if (!titleForm.value.name.trim()) {
    alert('Vui lòng nhập tên danh hiệu.');
    return;
  }
  isSavingTitle.value = true;
  try {
    await saveTitle(titleForm.value);
    isTitleModalOpen.value = false;
    await loadCodexData();
  } catch (err) {
    alert('Lưu danh hiệu thất bại: ' + (err instanceof Error ? err.message : String(err)));
  } finally {
    isSavingTitle.value = false;
  }
}
</script>

<template>
  <div class="admin-page-container">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Quản Lý Bộ Thẻ Bài 3D Codex</h1>
        <p class="page-desc">Chỉnh sửa truyền thuyết thẻ bài, bộ sưu tập và danh hiệu mở khóa</p>
      </div>

      <div class="header-actions">
        <button
          v-if="activeMainTab === 'cards'"
          type="button"
          class="btn btn-primary"
          @click="openNewCardModal"
        >
          <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14"/>
            <path d="M12 5v14"/>
          </svg>
          <span>Thêm Thẻ Mới</span>
        </button>

        <button
          v-if="activeMainTab === 'collections'"
          type="button"
          class="btn btn-primary"
          @click="openNewCollectionModal"
        >
          <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14"/>
            <path d="M12 5v14"/>
          </svg>
          <span>Thêm Bộ Sưu Tập</span>
        </button>

        <button
          v-if="activeMainTab === 'titles'"
          type="button"
          class="btn btn-primary"
          @click="openNewTitleModal"
        >
          <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14"/>
            <path d="M12 5v14"/>
          </svg>
          <span>Thêm Danh Hiệu</span>
        </button>

        <button
          type="button"
          class="btn btn-secondary"
          :disabled="isLoading"
          @click="loadCodexData"
        >
          <svg
            class="btn-icon"
            :class="{ 'icon-spinning': isLoading }"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
            <path d="M16 16h5v5"/>
          </svg>
          <span>{{ isLoading ? 'Đang tải...' : 'Làm Mới' }}</span>
        </button>
      </div>
    </div>

    <!-- Main Navigation Tabs -->
    <div class="main-tabs-bar">
      <button
        type="button"
        class="main-tab-btn"
        :class="{ active: activeMainTab === 'cards' }"
        @click="activeMainTab = 'cards'"
      >
        <span>🎴</span>
        <span>Kho Thẻ Bài 3D ({{ codexData?.cards?.length || 0 }})</span>
      </button>

      <button
        type="button"
        class="main-tab-btn"
        :class="{ active: activeMainTab === 'collections' }"
        @click="activeMainTab = 'collections'"
      >
        <span>📚</span>
        <span>Bộ Sưu Tập Sets ({{ codexData?.collections?.length || 0 }})</span>
      </button>

      <button
        type="button"
        class="main-tab-btn"
        :class="{ active: activeMainTab === 'titles' }"
        @click="activeMainTab = 'titles'"
      >
        <span>🏆</span>
        <span>Danh Hiệu Mở Khóa ({{ codexData?.titles?.length || 0 }})</span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner-large"></div>
      <p>Đang tải dữ liệu Codex 3D...</p>
    </div>

    <!-- TAB 1: CARDS GRID -->
    <div v-else-if="activeMainTab === 'cards'" class="tab-content">
      <!-- Rarity Metrics Stats -->
      <div class="rarity-summary-bar">
        <div class="rarity-stat-pill pill-common">
          <span class="dot"></span>
          <span>Phổ Thông: <strong>{{ rarityCounts.common }}</strong></span>
        </div>
        <div class="rarity-stat-pill pill-rare">
          <span class="dot"></span>
          <span>Hiếm: <strong>{{ rarityCounts.rare }}</strong></span>
        </div>
        <div class="rarity-stat-pill pill-epic">
          <span class="dot"></span>
          <span>Sử Thi: <strong>{{ rarityCounts.epic }}</strong></span>
        </div>
        <div class="rarity-stat-pill pill-legendary">
          <span class="dot"></span>
          <span>Huyền Thoại: <strong>{{ rarityCounts.legendary }}</strong></span>
        </div>
      </div>

      <!-- Filters Toolbar -->
      <div class="toolbar-box">
        <!-- Track Filter -->
        <div class="filter-group">
          <span class="filter-label">Vũ Trụ:</span>
          <div class="pill-group">
            <button
              class="pill-btn"
              :class="{ active: activeTrackFilter === 'all' }"
              @click="activeTrackFilter = 'all'"
            >
              Tất Cả
            </button>
            <button
              class="pill-btn"
              :class="{ active: activeTrackFilter === 'kids' }"
              @click="activeTrackFilter = 'kids'"
            >
              🎈 Kids
            </button>
            <button
              class="pill-btn"
              :class="{ active: activeTrackFilter === 'teens' }"
              @click="activeTrackFilter = 'teens'"
            >
              ⚡ Teens
            </button>
            <button
              class="pill-btn"
              :class="{ active: activeTrackFilter === 'adults' }"
              @click="activeTrackFilter = 'adults'"
            >
              🏢 Adults
            </button>
          </div>
        </div>

        <!-- Rarity Filter -->
        <div class="filter-group">
          <span class="filter-label">Độ Hiếm:</span>
          <div class="pill-group">
            <button
              class="pill-btn"
              :class="{ active: activeRarityFilter === 'all' }"
              @click="activeRarityFilter = 'all'"
            >
              Tất Cả
            </button>
            <button
              v-for="r in rarityList"
              :key="r"
              class="pill-btn"
              :class="[{ active: activeRarityFilter === r }, `pill-${r}`]"
              @click="activeRarityFilter = r"
            >
              {{ r.toUpperCase() }}
            </button>
          </div>
        </div>

        <!-- Search Input -->
        <div class="search-wrap">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Tìm theo từ vựng hoặc nghĩa..."
          />
        </div>
      </div>

      <!-- Cards Grid -->
      <div v-if="filteredCards.length === 0" class="empty-state">
        <p>Không tìm thấy thẻ bài nào khớp với bộ lọc.</p>
      </div>

      <div v-else class="admin-cards-grid">
        <div
          v-for="card in filteredCards"
          :key="card.id"
          class="codex-admin-card"
          :class="`border-${card.rarity}`"
        >
          <!-- Card Top Bar -->
          <div class="card-header-bar">
            <span class="stage-tag">{{ card.worldTrack.toUpperCase() }} • Màn {{ card.stageId }}</span>
            <span class="rarity-badge" :class="`badge-${card.rarity}`">
              {{ card.rarity.toUpperCase() }}
            </span>
          </div>

          <!-- Card Body -->
          <div class="card-main-content">
            <div class="emoji-circle">{{ card.emoji || '✨' }}</div>
            <h3 class="card-word">{{ card.word }}</h3>
            <span class="card-ipa">{{ card.ipa }}</span>
            <span class="card-pos">{{ card.partOfSpeech }}</span>
            <p class="card-meaning">{{ card.meaning }}</p>

            <div v-if="card.lore" class="card-lore-box">
              <span class="lore-tag">📜 Truyền thuyết:</span>
              <p class="lore-text">{{ card.lore }}</p>
            </div>
          </div>

          <!-- Card Footer Actions -->
          <div class="card-footer-actions">
            <button
              type="button"
              class="action-btn-small"
              title="Phát âm"
              @click="speakWord(card.audioText || card.word)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              </svg>
            </button>
            <button
              type="button"
              class="action-btn-small edit-card-btn"
              title="Chỉnh sửa thẻ"
              @click="openEditCardModal(card)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
              <span>Sửa</span>
            </button>
            <button
              type="button"
              class="action-btn-small delete-card-btn"
              title="Xóa thẻ"
              @click="openDeleteCardModal(card)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: COLLECTIONS LIST -->
    <div v-else-if="activeMainTab === 'collections'" class="tab-content">
      <div class="collections-grid">
        <div
          v-for="col in codexData?.collections || []"
          :key="col.setId"
          class="collection-item-card"
        >
          <div class="col-header">
            <span class="col-track-tag">{{ col.worldTrack.toUpperCase() }} • Màn {{ col.stageId }}</span>
            <button
              type="button"
              class="btn-icon-small"
              title="Sửa bộ sưu tập"
              @click="openEditCollectionModal(col)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </button>
          </div>

          <h3 class="col-title">{{ col.title }}</h3>
          <p class="col-desc">{{ col.description }}</p>

          <div class="col-details">
            <div class="col-meta-row">
              <span class="label">Mã Bộ (Set ID):</span>
              <code>{{ col.setId }}</code>
            </div>
            <div class="col-meta-row">
              <span class="label">Phần Thưởng:</span>
              <span class="reward-tag">💰 {{ col.rewardGold }} Vàng • ⚡ {{ col.rewardExp }} EXP</span>
            </div>
            <div class="col-meta-row">
              <span class="label">Danh Hiệu Thưởng:</span>
              <span class="title-tag">🏆 {{ col.unlockTitleId }}</span>
            </div>
            <div class="col-meta-row">
              <span class="label">Số Lượng Thẻ:</span>
              <strong>{{ col.cardIds?.length || 0 }} thẻ bài</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: TITLES LIST -->
    <div v-else-if="activeMainTab === 'titles'" class="tab-content">
      <div class="titles-grid">
        <div
          v-for="t in codexData?.titles || []"
          :key="t.id"
          class="title-item-card"
        >
          <div class="title-header">
            <div class="title-icon-badge">{{ t.badgeEmoji || '🏅' }}</div>
            <div class="title-names">
              <h3 class="title-name-vi">{{ t.name }}</h3>
              <span class="title-name-en">{{ t.nameEn }}</span>
            </div>
            <button
              type="button"
              class="btn-icon-small edit-title-btn"
              title="Sửa danh hiệu"
              @click="openEditTitleModal(t)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </button>
          </div>

          <p class="title-desc">{{ t.description }}</p>

          <div class="title-footer-meta">
            <span class="title-track-pill">{{ t.worldTrack.toUpperCase() }}</span>
            <code class="title-id-code">{{ t.id }}</code>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL 1: CARD EDITOR -->
    <div v-if="isCardModalOpen" class="modal-overlay" @click.self="isCardModalOpen = false">
      <div class="modal-card modal-card-wide">
        <div class="modal-header">
          <h2>Chỉnh Sửa Thẻ Bài Codex: {{ cardForm.word || cardForm.id }}</h2>
          <button type="button" class="modal-close-x" @click="isCardModalOpen = false">✕</button>
        </div>

        <div class="modal-body form-grid-2">
          <!-- Left: Inputs -->
          <div class="form-column">
            <div class="form-row-2">
              <div class="form-group">
                <label>Mã Thẻ (ID):</label>
                <input v-model="cardForm.id" type="text" />
              </div>
              <div class="form-group">
                <label>Độ Hiếm (Rarity):</label>
                <select v-model="cardForm.rarity">
                  <option v-for="r in rarityList" :key="r" :value="r">
                    {{ r.toUpperCase() }}
                  </option>
                </select>
              </div>
            </div>

            <div class="form-row-3">
              <div class="form-group" style="max-width: 70px;">
                <label>Emoji:</label>
                <input v-model="cardForm.emoji" type="text" style="text-align: center; font-size: 18px;" />
              </div>
              <div class="form-group">
                <label>Từ tiếng Anh (Word):</label>
                <input v-model="cardForm.word" type="text" />
              </div>
              <div class="form-group">
                <label>Phiên âm (IPA):</label>
                <input v-model="cardForm.ipa" type="text" />
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label>Nghĩa tiếng Việt:</label>
                <input v-model="cardForm.meaning" type="text" />
              </div>
              <div class="form-group">
                <label>Loại từ (POS):</label>
                <select v-model="cardForm.partOfSpeech">
                  <option v-for="p in posList" :key="p" :value="p">{{ p }}</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Câu ví dụ tiếng Anh:</label>
              <input v-model="cardForm.example" type="text" />
            </div>

            <div class="form-group">
              <label>Dịch nghĩa câu ví dụ:</label>
              <input v-model="cardForm.exampleMeaning" type="text" />
            </div>

            <div class="form-group">
              <label>Truyền Thuyết Thẻ Bài (Lore RPG):</label>
              <textarea
                v-model="cardForm.lore"
                rows="3"
                placeholder="Đoạn văn ngắn kể về nguồn gốc hoặc câu chuyện thú vị của thẻ bài này..."
              ></textarea>
            </div>
          </div>

          <!-- Right: Live 3D Holographic Card Preview -->
          <div class="form-column preview-column">
            <span class="preview-label">👁️ Xem Trước Thẻ Bài (Live Holographic Card)</span>
            <div class="live-card-preview" :class="`border-${cardForm.rarity}`">
              <div class="preview-top">
                <span class="preview-badge">{{ cardForm.rarity.toUpperCase() }}</span>
                <span class="preview-track">{{ cardForm.worldTrack.toUpperCase() }}</span>
              </div>
              <div class="preview-emoji">{{ cardForm.emoji || '✨' }}</div>
              <h3 class="preview-word">{{ cardForm.word || 'Word' }}</h3>
              <span class="preview-ipa">{{ cardForm.ipa || '/ipa/' }}</span>
              <p class="preview-meaning">{{ cardForm.meaning || 'Nghĩa tiếng Việt' }}</p>

              <div class="preview-lore">
                <p>{{ cardForm.lore || 'Truyền thuyết thẻ bài sẽ hiển thị tại đây...' }}</p>
              </div>
            </div>
          </div>
        </div>

        <div v-if="cardModalError" class="modal-error">
          {{ cardModalError }}
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="isCardModalOpen = false">
            Hủy Bỏ
          </button>
          <button type="button" class="btn btn-primary" :disabled="isSavingCard" @click="handleSaveCard">
            {{ isSavingCard ? 'Đang lưu...' : 'Lưu Thẻ Bài' }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL 2: DELETE CARD CONFIRMATION -->
    <div v-if="cardToDelete" class="modal-overlay" @click.self="cardToDelete = null">
      <div class="modal-card">
        <div class="modal-header">
          <h2>Xác Nhận Xóa Thẻ Bài</h2>
        </div>
        <p class="modal-body-text">
          Bạn có chắc chắn muốn xóa thẻ bài <strong>"{{ cardToDelete.word }}"</strong> ({{ cardToDelete.id }}) khỏi Codex không? Thẻ này cũng sẽ được tự động gỡ khỏi bộ sưu tập liên quan.
        </p>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="cardToDelete = null">
            Hủy Bỏ
          </button>
          <button type="button" class="btn btn-danger" :disabled="isDeletingCard" @click="confirmDeleteCard">
            {{ isDeletingCard ? 'Đang xóa...' : 'Xác Nhận Xóa' }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL 3: COLLECTION EDITOR -->
    <div v-if="isCollectionModalOpen" class="modal-overlay" @click.self="isCollectionModalOpen = false">
      <div class="modal-card">
        <div class="modal-header">
          <h2>Chỉnh Sửa Bộ Sưu Tập: {{ collectionForm.setId }}</h2>
          <button type="button" class="modal-close-x" @click="isCollectionModalOpen = false">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>Tiêu Đề Bộ Sưu Tập:</label>
            <input v-model="collectionForm.title" type="text" />
          </div>

          <div class="form-group">
            <label>Mô Tả:</label>
            <textarea v-model="collectionForm.description" rows="2"></textarea>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label>Thưởng Vàng (Gold):</label>
              <input v-model.number="collectionForm.rewardGold" type="number" min="0" />
            </div>
            <div class="form-group">
              <label>Thưởng Kinh Nghiệm (EXP):</label>
              <input v-model.number="collectionForm.rewardExp" type="number" min="0" />
            </div>
          </div>

          <div class="form-group">
            <label>Mã Danh Hiệu Mở Khóa (Unlock Title ID):</label>
            <input v-model="collectionForm.unlockTitleId" type="text" />
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="isCollectionModalOpen = false">Hủy</button>
          <button type="button" class="btn btn-primary" :disabled="isSavingCollection" @click="handleSaveCollection">
            {{ isSavingCollection ? 'Đang lưu...' : 'Lưu Bộ Sưu Tập' }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL 4: TITLE EDITOR -->
    <div v-if="isTitleModalOpen" class="modal-overlay" @click.self="isTitleModalOpen = false">
      <div class="modal-card">
        <div class="modal-header">
          <h2>Chỉnh Sửa Danh Hiệu: {{ titleForm.name || titleForm.id }}</h2>
          <button type="button" class="modal-close-x" @click="isTitleModalOpen = false">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-row-2">
            <div class="form-group" style="max-width: 90px;">
              <label>Huy Hiệu:</label>
              <input v-model="titleForm.badgeEmoji" type="text" style="font-size: 20px; text-align: center;" />
            </div>
            <div class="form-group">
              <label>Mã Danh Hiệu (ID):</label>
              <input v-model="titleForm.id" type="text" />
            </div>
          </div>

          <div class="form-group">
            <label>Tên Danh Hiệu (Tiếng Việt):</label>
            <input v-model="titleForm.name" type="text" />
          </div>

          <div class="form-group">
            <label>Tên Danh Hiệu (Tiếng Anh):</label>
            <input v-model="titleForm.nameEn" type="text" />
          </div>

          <div class="form-group">
            <label>Mô Tả Điều Kiện Mở Khóa:</label>
            <textarea v-model="titleForm.description" rows="3"></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="isTitleModalOpen = false">Hủy</button>
          <button type="button" class="btn btn-primary" :disabled="isSavingTitle" @click="handleSaveTitle">
            {{ isSavingTitle ? 'Đang lưu...' : 'Lưu Danh Hiệu' }}
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

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-title {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  color: #f8fafc;
}

.page-desc {
  margin: 6px 0 0 0;
  font-size: 14px;
  color: #94a3b8;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* Main Tabs Bar */
.main-tabs-bar {
  display: flex;
  gap: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 12px;
  margin-bottom: 24px;
}

.main-tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  color: #94a3b8;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.main-tab-btn:hover {
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
}

.main-tab-btn.active {
  background: rgba(168, 85, 247, 0.15);
  border-color: rgba(168, 85, 247, 0.4);
  color: #c084fc;
}

/* Rarity Summary Bar */
.rarity-summary-bar {
  display: flex;
  gap: 14px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.rarity-stat-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  padding: 6px 14px;
  font-size: 12px;
  color: #cbd5e1;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.pill-common .dot {
  background: #94a3b8;
}

.pill-rare .dot {
  background: #3b82f6;
  box-shadow: 0 0 8px #3b82f6;
}

.pill-epic .dot {
  background: #a855f7;
  box-shadow: 0 0 8px #a855f7;
}

.pill-legendary .dot {
  background: #f59e0b;
  box-shadow: 0 0 8px #f59e0b;
}

/* Toolbar */
.toolbar-box {
  display: flex;
  align-items: center;
  gap: 20px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 14px 18px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 700;
}

.pill-group {
  display: flex;
  gap: 4px;
}

.pill-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #94a3b8;
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.pill-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.pill-btn.active {
  background: rgba(56, 189, 248, 0.2);
  border-color: rgba(56, 189, 248, 0.4);
  color: #38bdf8;
}

.pill-common.active {
  color: #94a3b8;
  border-color: #64748b;
}

.pill-rare.active {
  color: #60a5fa;
  border-color: #3b82f6;
}

.pill-epic.active {
  color: #c084fc;
  border-color: #a855f7;
}

.pill-legendary.active {
  color: #fbbf24;
  border-color: #f59e0b;
}

.search-wrap {
  margin-left: auto;
  min-width: 220px;
}

.search-wrap input {
  width: 100%;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 12px;
  color: #fff;
  font-size: 12px;
  box-sizing: border-box;
}

/* Cards Grid */
.admin-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}

.codex-admin-card {
  background: rgba(15, 23, 42, 0.7);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 20px;
  display: flex;
  flex-direction: column;
  transition: all 0.25s;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

.codex-admin-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
}

.border-common {
  border-top: 3px solid #94a3b8;
}

.border-rare {
  border-top: 3px solid #3b82f6;
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.15);
}

.border-epic {
  border-top: 3px solid #a855f7;
  box-shadow: 0 0 15px rgba(168, 85, 247, 0.2);
}

.border-legendary {
  border-top: 3px solid #f59e0b;
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.25);
}

.card-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.stage-tag {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
}

.rarity-badge {
  font-size: 9px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
}

.badge-common {
  background: rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
}

.badge-rare {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.badge-epic {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
}

.badge-legendary {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.card-main-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 16px;
}

.emoji-circle {
  font-size: 32px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  margin-bottom: 10px;
}

.card-word {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  color: #f8fafc;
}

.card-ipa {
  font-size: 12px;
  color: #94a3b8;
  font-family: monospace;
  margin: 2px 0;
}

.card-pos {
  font-size: 10px;
  color: #64748b;
  font-style: italic;
  margin-bottom: 6px;
}

.card-meaning {
  margin: 4px 0 0 0;
  font-size: 13px;
  font-weight: 600;
  color: #38bdf8;
}

.card-lore-box {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 8px 10px;
  margin-top: 10px;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
}

.lore-tag {
  display: block;
  font-size: 10px;
  font-weight: 700;
  color: #fbbf24;
  margin-bottom: 2px;
}

.lore-text {
  margin: 0;
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.4;
}

.card-footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.action-btn-small {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
}

.action-btn-small:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  transform: translateY(-1px);
}

.edit-card-btn {
  flex: 1;
  background: rgba(56, 189, 248, 0.12);
  border-color: rgba(56, 189, 248, 0.35);
  color: #38bdf8;
}

.edit-card-btn:hover {
  background: rgba(56, 189, 248, 0.25);
  border-color: rgba(56, 189, 248, 0.6);
  color: #ffffff;
  box-shadow: 0 2px 10px rgba(56, 189, 248, 0.2);
}

.delete-card-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
  color: #f87171;
  box-shadow: 0 2px 10px rgba(239, 68, 68, 0.2);
}

/* Collections Grid */
.collections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.collection-item-card {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 22px;
}

.col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.col-track-tag {
  font-size: 11px;
  font-weight: 700;
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  padding: 3px 8px;
  border-radius: 6px;
}

.col-title {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: #f8fafc;
}

.col-desc {
  margin: 6px 0 16px 0;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.4;
}

.col-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
  padding: 12px;
  font-size: 12px;
}

.col-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.col-meta-row .label {
  color: #64748b;
}

.reward-tag {
  color: #fbbf24;
  font-weight: 700;
}

.title-tag {
  color: #a855f7;
  font-weight: 700;
}

/* Titles Grid */
.titles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 18px;
}

.title-item-card {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.title-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.title-icon-badge {
  font-size: 26px;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(245, 158, 11, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.title-names {
  flex: 1;
}

.title-name-vi {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: #f8fafc;
}

.title-name-en {
  font-size: 11px;
  color: #94a3b8;
  font-style: italic;
}

.title-desc {
  margin: 0 0 14px 0;
  font-size: 12px;
  color: #cbd5e1;
  line-height: 1.4;
  flex: 1;
}

.title-footer-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 10px;
}

.title-track-pill {
  font-size: 10px;
  font-weight: 700;
  color: #38bdf8;
}

.title-id-code {
  font-size: 11px;
  color: #64748b;
}

.btn-icon-small {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #94a3b8;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-icon-small:hover {
  background: rgba(56, 189, 248, 0.15);
  border-color: rgba(56, 189, 248, 0.4);
  color: #38bdf8;
  transform: translateY(-1px);
}

/* Modal Wide */
.modal-card-wide {
  max-width: 820px;
}

.preview-column {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.preview-label {
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
  margin-bottom: 16px;
}

.live-card-preview {
  width: 240px;
  background: rgba(15, 23, 42, 0.95);
  border-radius: 16px;
  border: 2px solid rgba(255, 255, 255, 0.15);
  padding: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
}

.preview-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 12px;
  font-size: 10px;
  font-weight: 700;
}

.preview-emoji {
  font-size: 40px;
  margin-bottom: 8px;
}

.preview-word {
  margin: 0;
  font-size: 18px;
  color: #f8fafc;
}

.preview-ipa {
  font-size: 12px;
  color: #94a3b8;
  font-family: monospace;
}

.preview-meaning {
  margin: 6px 0 0 0;
  font-size: 13px;
  font-weight: 700;
  color: #38bdf8;
}

.collocation-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
}

.preview-colloc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
  margin-top: 8px;
}

.preview-colloc-pill {
  font-size: 10px;
  font-weight: 600;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.25);
  padding: 1px 6px;
  border-radius: 4px;
}

.preview-real-phrase {
  margin: 6px 0 0 0;
  font-size: 11px;
  color: #10b981;
  font-style: italic;
  line-height: 1.3;
}

.preview-lore {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 8px 10px;
  margin-top: 12px;
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.4;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
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
}

.btn-primary {
  background: linear-gradient(135deg, #0284c7 0%, #2563eb 55%, #4f46e5 100%);
  border: 1px solid rgba(56, 189, 248, 0.45);
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.38);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #0369a1 0%, #1d4ed8 55%, #4338ca 100%);
  border-color: rgba(56, 189, 248, 0.7);
  transform: translateY(-1.5px);
}

.btn-danger {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  border: 1px solid rgba(239, 68, 68, 0.45);
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(220, 38, 38, 0.35);
}

.btn-danger:hover:not(:disabled) {
  background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
  transform: translateY(-1.5px);
}
</style>

