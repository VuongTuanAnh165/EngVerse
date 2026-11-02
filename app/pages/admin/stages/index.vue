<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAdmin } from '~/composables/useAdmin';
import type { WorldTrack } from '~/types/user';
import type { StageData } from '~/types/game';

definePageMeta({
  layout: 'admin',
  middleware: 'admin-auth',
});

const route = useRoute();
const router = useRouter();
const { getStages, deleteStage, createStage } = useAdmin();

const activeTrack = ref<WorldTrack>((route.query.track as WorldTrack) || 'kids');
const searchQuery = ref('');
const selectedChapter = ref<number | 'all'>('all');

const isLoading = ref(true);
const stagesList = ref<StageData[]>([]);

// Delete confirmation modal state
const stageToDelete = ref<StageData | null>(null);
const isDeleting = ref(false);
const cascadeCardsCheck = ref(true);
const deleteError = ref('');

// Track tabs definition
const trackTabs: Array<{ id: WorldTrack; label: string; icon: string; color: string }> = [
  { id: 'kids', label: 'Đảo Thần Thoại (Kids)', icon: '🎈', color: '#f59e0b' },
  { id: 'teens', label: 'Cyber City (Teens)', icon: '⚡', color: '#8b5cf6' },
  { id: 'adults', label: 'SimLife Global (Adults)', icon: '🏢', color: '#3b82f6' },
];

async function loadStages() {
  isLoading.value = true;
  try {
    const data = await getStages(activeTrack.value);
    stagesList.value = data || [];
  } catch (err) {
    console.error('[AdminStages] Load error:', err);
  } finally {
    isLoading.value = false;
  }
}

watch(activeTrack, (newTrack) => {
  router.replace({ query: { track: newTrack } });
  selectedChapter.value = 'all';
  loadStages();
});

onMounted(() => {
  loadStages();
});

// Compute unique chapters for filter
const availableChapters = computed(() => {
  const chapters = new Set<number>();
  stagesList.value.forEach((s) => {
    if (typeof s.chapter === 'number') chapters.add(s.chapter);
  });
  return Array.from(chapters).sort((a, b) => a - b);
});

// Filtered stage list
const filteredStages = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return stagesList.value.filter((stage) => {
    if (selectedChapter.value !== 'all' && stage.chapter !== selectedChapter.value) {
      return false;
    }
    if (!query) return true;

    const matchTitle = stage.title.toLowerCase().includes(query);
    const matchSubtitle = (stage.subtitle || '').toLowerCase().includes(query);
    const matchVocab = stage.vocabPool?.some((v) =>
      v.word.toLowerCase().includes(query) || v.meaning.toLowerCase().includes(query)
    );
    const matchId = String(stage.stageId).includes(query);

    return matchTitle || matchSubtitle || matchVocab || matchId;
  });
});

// Clone stage
async function handleCloneStage(stage: StageData) {
  const maxId = stagesList.value.reduce((max, s) => Math.max(max, s.stageId), 0);
  const newStageId = maxId + 1;

  const clonedStage: StageData = JSON.parse(JSON.stringify(stage));
  clonedStage.stageId = newStageId;
  clonedStage.title = `${stage.title} (Bản sao)`;
  // Offset map position slightly
  clonedStage.mapPosition = {
    x: Math.min(90, (stage.mapPosition?.x || 50) + 4),
    y: Math.min(90, (stage.mapPosition?.y || 50) + 4),
  };

  // Re-id vocabulary items to prevent collisions
  const trackInitial = activeTrack.value === 'kids' ? 'k' : activeTrack.value === 'teens' ? 't' : 'a';
  clonedStage.vocabPool = (clonedStage.vocabPool || []).map((v, idx) => ({
    ...v,
    id: `v_${trackInitial}_${newStageId}${idx + 1 < 10 ? '0' + (idx + 1) : idx + 1}`,
    cardId: `card_${trackInitial}_${newStageId < 10 ? '0' + newStageId : newStageId}_${idx + 1 < 10 ? '0' + (idx + 1) : idx + 1}`,
  }));

  try {
    isLoading.value = true;
    await createStage(clonedStage);
    await loadStages();
    navigateTo(`/admin/stages/${newStageId}?track=${activeTrack.value}`);
  } catch (err) {
    alert('Nhân bản chặng thất bại: ' + (err instanceof Error ? err.message : String(err)));
    isLoading.value = false;
  }
}

// Delete stage modal handlers
function openDeleteModal(stage: StageData) {
  stageToDelete.value = stage;
  deleteError.value = '';
  cascadeCardsCheck.value = true;
}

function closeDeleteModal() {
  stageToDelete.value = null;
  deleteError.value = '';
}

async function confirmDelete() {
  if (!stageToDelete.value) return;
  isDeleting.value = true;
  deleteError.value = '';

  try {
    await deleteStage(
      activeTrack.value,
      stageToDelete.value.stageId,
      cascadeCardsCheck.value
    );
    closeDeleteModal();
    await loadStages();
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : String(err);
  } finally {
    isDeleting.value = false;
  }
}
</script>

<template>
  <div class="admin-page-container">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Quản Lý Chặng Thử Thách</h1>
        <p class="page-desc">Thêm, sửa, nhân bản và định vị chặng trên bản đồ thế giới</p>
      </div>

      <div class="header-actions">
        <NuxtLink :to="`/admin/stages/new?track=${activeTrack}&ai=true`" class="btn btn-ai-magic">
          <svg class="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
            <path d="M20 3v4"/>
            <path d="M22 5h-4"/>
            <path d="M4 17v2"/>
            <path d="M5 18H3"/>
          </svg>
          <span>Tạo Bằng AI</span>
        </NuxtLink>

        <NuxtLink :to="`/admin/stages/new?track=${activeTrack}`" class="btn btn-primary">
          <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14"/>
            <path d="M12 5v14"/>
          </svg>
          <span>Tạo Thủ Công</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Universe Track Tabs -->
    <div class="track-tabs-bar">
      <button
        v-for="tab in trackTabs"
        :key="tab.id"
        class="track-tab-btn"
        :class="{ active: activeTrack === tab.id }"
        @click="activeTrack = tab.id"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
        <span class="tab-badge" v-if="activeTrack === tab.id">
          {{ stagesList.length }} chặng
        </span>
      </button>
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="toolbar-box">
      <div class="search-input-wrap">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Tìm theo tên chặng, từ vựng hoặc ID..."
        />
        <button v-if="searchQuery" class="clear-search-btn" @click="searchQuery = ''">✕</button>
      </div>

      <div class="chapter-filter">
        <label>Chương (Chapter):</label>
        <select v-model="selectedChapter">
          <option value="all">Tất cả các chương</option>
          <option v-for="ch in availableChapters" :key="ch" :value="ch">
            Chương {{ ch }}
          </option>
        </select>
      </div>

      <div class="count-pill">
        Hiển thị: <strong>{{ filteredStages.length }} / {{ stagesList.length }}</strong> chặng
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner-large"></div>
      <p>Đang tải danh sách chặng...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredStages.length === 0" class="empty-state">
      <span class="empty-icon">🏜️</span>
      <h3>Không tìm thấy chặng nào</h3>
      <p v-if="searchQuery">Hãy thử tìm với từ khóa khác.</p>
      <p v-else>Vũ trụ này chưa có chặng nào. Hãy bấm "Tạo Chặng Mới" để bắt đầu.</p>
      <NuxtLink :to="`/admin/stages/new?track=${activeTrack}`" class="btn btn-primary" style="margin-top: 12px;">
        Tạo Chặng Đầu Tiên
      </NuxtLink>
    </div>

    <!-- Stages Table Grid -->
    <div v-else class="stages-table-container">
      <table class="stages-table">
        <thead>
          <tr>
            <th style="width: 70px;">ID</th>
            <th style="width: 80px;">Chương</th>
            <th>Tên Chặng & Cốt Truyện</th>
            <th style="width: 100px;">CEFR</th>
            <th style="width: 110px;">Nội Dung</th>
            <th style="width: 120px;">Tọa Độ Map</th>
            <th style="width: 130px;">Phần Thưởng</th>
            <th style="width: 190px; text-align: right;">Hành Động</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="stage in filteredStages" :key="stage.stageId">
            <td>
              <span class="stage-id-badge">#{{ stage.stageId }}</span>
            </td>
            <td>
              <span class="chapter-badge">Chương {{ stage.chapter }}</span>
            </td>
            <td>
              <div class="stage-title-group">
                <div class="title-row">
                  <span
                    class="color-dot"
                    :style="{ background: stage.themeColor || '#38bdf8' }"
                  ></span>
                  <strong class="stage-title">{{ stage.title }}</strong>
                  <span v-if="stage.isBossStage" class="boss-tag">👑 BOSS</span>
                </div>
                <p v-if="stage.subtitle" class="stage-subtitle">{{ stage.subtitle }}</p>
              </div>
            </td>
            <td>
              <span class="cefr-pill">{{ stage.cefrLevel || 'A1' }}</span>
            </td>
            <td>
              <div class="content-summary">
                <span class="count-item">📖 {{ stage.vocabPool?.length || 0 }} từ</span>
                <span class="count-item">🧩 {{ stage.grammarPool?.length || 0 }} ngữ pháp</span>
              </div>
            </td>
            <td>
              <span class="coord-badge">
                📍 ({{ stage.mapPosition?.x }}%, {{ stage.mapPosition?.y }}%)
              </span>
            </td>
            <td>
              <div class="reward-pill">
                <span>⚡ {{ stage.reward?.baseExp || 100 }}</span>
                <span>💰 {{ stage.reward?.baseGold || 50 }}</span>
              </div>
            </td>
            <td>
              <div class="actions-group">
                <!-- Edit button -->
                <NuxtLink
                  :to="`/admin/stages/${stage.stageId}?track=${activeTrack}`"
                  class="action-icon-btn edit-btn"
                  title="Chỉnh sửa chặng"
                >
                  ✏️
                </NuxtLink>

                <!-- Clone button -->
                <button
                  type="button"
                  class="action-icon-btn clone-btn"
                  title="Nhân bản chặng mới"
                  @click="handleCloneStage(stage)"
                >
                  📋
                </button>

                <!-- Test play button -->
                <NuxtLink
                  :to="`/play/${stage.stageId}`"
                  target="_blank"
                  class="action-icon-btn play-btn"
                  title="Chơi thử chặng"
                >
                  🎮
                </NuxtLink>

                <!-- Delete button -->
                <button
                  type="button"
                  class="action-icon-btn delete-btn"
                  title="Xóa chặng"
                  @click="openDeleteModal(stage)"
                >
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="stageToDelete" class="modal-overlay" @click.self="closeDeleteModal">
      <div class="modal-card">
        <div class="modal-header">
          <span class="modal-warn-icon">⚠️</span>
          <h2>Xác Nhận Xóa Chặng #{{ stageToDelete.stageId }}</h2>
        </div>

        <p class="modal-body-text">
          Bạn có chắc chắn muốn xóa chặng <strong>"{{ stageToDelete.title }}"</strong> khỏi vũ trụ
          <strong>{{ activeTrack.toUpperCase() }}</strong> không?
        </p>

        <div class="cascade-toggle-box">
          <label class="checkbox-label">
            <input v-model="cascadeCardsCheck" type="checkbox" />
            <span>
              <strong>Tự động xóa các Thẻ bài & Bộ sưu tập liên kết trong Codex</strong>
              <small>(Khuyến nghị bật để tránh thẻ mồ côi trong game)</small>
            </span>
          </label>
        </div>

        <div v-if="deleteError" class="modal-error">
          {{ deleteError }}
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" :disabled="isDeleting" @click="closeDeleteModal">
            Hủy Bỏ
          </button>
          <button class="btn btn-danger" :disabled="isDeleting" @click="confirmDelete">
            {{ isDeleting ? 'Đang xóa...' : 'Xác Nhận Xóa' }}
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

.btn-ai-magic {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #8b5cf6, #06b6d4);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
  box-shadow: 0 4px 15px rgba(139, 92, 246, 0.35);
}

.btn-ai-magic:hover {
  background: linear-gradient(135deg, #7c3aed, #0891b2);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.5);
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #0284c7, #6366f1);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
  box-shadow: 0 4px 15px rgba(2, 132, 199, 0.3);
}

.btn-primary:hover {
  background: linear-gradient(135deg, #0369a1, #4f46e5);
  transform: translateY(-1px);
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #e2e8f0;
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(51, 65, 85, 0.95);
  border-color: rgba(255, 255, 255, 0.32);
  color: #ffffff;
  transform: translateY(-1px);
}

/* Track Tabs */
.track-tabs-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 12px;
}

.track-tab-btn {
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

.track-tab-btn:hover {
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
}

.track-tab-btn.active {
  background: rgba(56, 189, 248, 0.15);
  border-color: rgba(56, 189, 248, 0.4);
  color: #38bdf8;
}

.tab-badge {
  font-size: 11px;
  background: rgba(56, 189, 248, 0.2);
  padding: 2px 8px;
  border-radius: 9999px;
}

/* Toolbar */
.toolbar-box {
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 14px 18px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.search-input-wrap {
  position: relative;
  flex: 1;
  min-width: 240px;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  font-size: 14px;
  opacity: 0.6;
}

.search-input-wrap input {
  width: 100%;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 9px 36px 9px 34px;
  color: #fff;
  font-size: 13px;
}

.clear-search-btn {
  position: absolute;
  right: 10px;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
}

.chapter-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #94a3b8;
}

.chapter-filter select {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 12px;
  color: #fff;
  font-size: 13px;
}

.count-pill {
  font-size: 12px;
  color: #64748b;
  margin-left: auto;
}

.count-pill strong {
  color: #cbd5e1;
}

/* Table */
.stages-table-container {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
}

.stages-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}

.stages-table th {
  background: rgba(255, 255, 255, 0.02);
  color: #94a3b8;
  font-weight: 700;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.stages-table td {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  vertical-align: middle;
}

.stages-table tr:hover td {
  background: rgba(255, 255, 255, 0.02);
}

.stage-id-badge {
  display: inline-flex;
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  font-weight: 700;
  color: #38bdf8;
}

.chapter-badge {
  font-size: 11px;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.04);
  padding: 3px 6px;
  border-radius: 4px;
}

.stage-title-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.stage-title {
  font-size: 14px;
  font-weight: 700;
  color: #f8fafc;
}

.boss-tag {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.4);
  color: #fbbf24;
  font-size: 10px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 4px;
}

.stage-subtitle {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
}

.cefr-pill {
  display: inline-block;
  padding: 3px 8px;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: #a5b4fc;
  border-radius: 6px;
  font-weight: 700;
  font-size: 11px;
}

.content-summary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: #94a3b8;
}

.coord-badge {
  font-size: 11px;
  color: #64748b;
  font-family: monospace;
}

.reward-pill {
  display: inline-flex;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  color: #cbd5e1;
}

/* Actions group */
.actions-group {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.action-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  text-decoration: none;
  font-size: 14px;
  transition: all 0.2s;
}

.action-icon-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: translateY(-1px);
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-card {
  width: 100%;
  max-width: 480px;
  background: #0f172a;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 18px;
  padding: 28px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.modal-warn-icon {
  font-size: 28px;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  color: #f8fafc;
}

.modal-body-text {
  font-size: 14px;
  color: #cbd5e1;
  line-height: 1.5;
  margin-bottom: 20px;
}

.cascade-toggle-box {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 20px;
}

.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  color: #f1f5f9;
  cursor: pointer;
}

.checkbox-label small {
  display: block;
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}

.modal-error {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  padding: 10px;
  border-radius: 8px;
  font-size: 12px;
  margin-bottom: 16px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-danger {
  background: #dc2626;
  color: #fff;
  border: none;
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  background: rgba(15, 23, 42, 0.4);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  color: #94a3b8;
  text-align: center;
}

.empty-icon {
  font-size: 44px;
  margin-bottom: 12px;
}
</style>

