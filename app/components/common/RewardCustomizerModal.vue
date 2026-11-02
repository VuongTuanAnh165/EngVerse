<script setup lang="ts">
/**
 * EngVerse - RewardCustomizerModal.vue
 * Modal for customizing and equipping unlocked Avatar Frames & Title Badges.
 * Strictly typed (0 any), Vue 3.5 script setup, animated live preview.
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.3 & Task 3.5.
 */

import { ref, computed } from 'vue';
import { useUserStore } from '~/stores/user';
import { useSoundEffects } from '~/composables/useSoundEffects';
import {
  ALL_AVATAR_FRAMES,
  ALL_TITLE_BADGES,
  type AvatarFrameId,
  type TitleBadgeId,
  type AvatarFrameDefinition,
  type TitleBadgeDefinition,
} from '~/types/rewards';

const props = withDefaults(
  defineProps<{
    open: boolean;
    initialTab?: 'frames' | 'titles';
  }>(),
  {
    open: false,
    initialTab: 'frames',
  }
);

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
}>();

const userStore = useUserStore();
const { playSound } = useSoundEffects();

const activeTab = ref<'frames' | 'titles'>(props.initialTab);
const isSaving = ref<boolean>(false);
const saveFeedback = ref<string>('');

// Current user state
const displayName = computed(() => userStore.user.displayName || 'Nhà Thám Hiểm');
const avatar = computed(() => userStore.user.avatar || 'rookie_explorer');
const currentFrameId = computed<string>(() => userStore.activeAvatarFrame || 'default');
const currentTitleId = computed<string>(() => userStore.user.equippedTitle || 'rookie_explorer');

// Selected preview frame
const previewFrameId = ref<string>(currentFrameId.value);

// Available / Unlocked inventories
const unlockedFrames = computed<string[]>(() => userStore.unlockedAvatarFramesList);
const unlockedTitles = computed<string[]>(() => userStore.unlockedTitlesList);

// Definitions lists
const frameList = computed<AvatarFrameDefinition[]>(() => Object.values(ALL_AVATAR_FRAMES));
const titleList = computed<TitleBadgeDefinition[]>(() => Object.values(ALL_TITLE_BADGES));

function closeModal(): void {
  emit('update:open', false);
}

function selectPreviewFrame(frameId: AvatarFrameId): void {
  previewFrameId.value = frameId;
  playSound('click');
}

async function handleEquipFrame(frameId: AvatarFrameId): Promise<void> {
  if (frameId === currentFrameId.value) return;
  isSaving.value = true;
  saveFeedback.value = '';

  const success = await userStore.equipAvatarFrame(frameId);
  isSaving.value = false;

  if (success) {
    playSound('correct');
    saveFeedback.value = `Đã trang bị "${ALL_AVATAR_FRAMES[frameId].name}"!`;
    setTimeout(() => {
      saveFeedback.value = '';
    }, 2500);
  }
}

async function handleEquipTitle(titleId: TitleBadgeId): Promise<void> {
  if (titleId === currentTitleId.value) return;
  isSaving.value = true;
  saveFeedback.value = '';

  const success = await userStore.equipTitle(titleId);
  isSaving.value = false;

  if (success) {
    playSound('correct');
    saveFeedback.value = `Đã đổi danh hiệu thành "${ALL_TITLE_BADGES[titleId].name}"!`;
    setTimeout(() => {
      saveFeedback.value = '';
    }, 2500);
  }
}

function isFrameUnlocked(id: AvatarFrameId): boolean {
  if (id === 'default') return true;
  return unlockedFrames.value.includes(id);
}

function isTitleUnlocked(id: TitleBadgeId): boolean {
  if (id === 'rookie_explorer') return true;
  return unlockedTitles.value.includes(id);
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="reward-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customizer-modal-title"
      @click.self="closeModal"
    >
      <div class="reward-modal-card theme-card">
        <!-- Header -->
        <div class="modal-top-bar">
          <div class="title-wrap">
            <h2 id="customizer-modal-title" class="modal-headline">
              👑 KHO BÁU & DANH DIỆN
            </h2>
            <p class="modal-sub">
              Trang bị Khung Avatar Hoàng Kim và Huy Hiệu Đấu Trường để khẳng định vị thế.
            </p>
          </div>
          <button
            type="button"
            class="modal-close-icon"
            aria-label="Đóng"
            @click="closeModal"
          >
            ✕
          </button>
        </div>

        <!-- Live Preview Banner -->
        <div class="live-avatar-preview-box">
          <div
            class="preview-avatar-ring"
            :class="previewFrameId"
          >
            <img
              v-if="avatar.startsWith('http')"
              :src="avatar"
              :alt="displayName"
              class="avatar-img"
            />
            <span v-else class="avatar-fallback">{{ displayName.charAt(0) }}</span>
          </div>
          <div class="preview-user-details">
            <span class="preview-name">{{ displayName }}</span>
            <span class="preview-title-pill">
              {{ userStore.equippedTitleDisplayName }}
            </span>
          </div>
        </div>

        <!-- Notification Toast -->
        <Transition name="fade">
          <div v-if="saveFeedback" class="save-feedback-toast">
            ✨ {{ saveFeedback }}
          </div>
        </Transition>

        <!-- Navigation Tabs -->
        <div class="customizer-nav-tabs">
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeTab === 'frames' }"
            @click="activeTab = 'frames'"
          >
            🖼️ Khung Avatar ({{ unlockedFrames.length }}/{{ frameList.length }})
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeTab === 'titles' }"
            @click="activeTab = 'titles'"
          >
            🏆 Huy Hiệu & Danh Hiệu ({{ unlockedTitles.length }}/{{ titleList.length }})
          </button>
        </div>

        <!-- Tab 1: Avatar Frames Grid -->
        <div v-if="activeTab === 'frames'" class="tab-body frames-grid-wrap">
          <div class="frames-grid">
            <div
              v-for="frame in frameList"
              :key="frame.id"
              class="frame-item-card"
              :class="{
                'is-equipped': currentFrameId === frame.id,
                'is-locked': !isFrameUnlocked(frame.id),
                'is-previewing': previewFrameId === frame.id,
                [`rarity-${frame.rarity}`]: true,
              }"
              @click="selectPreviewFrame(frame.id)"
            >
              <div class="frame-item-header">
                <span class="rarity-badge">{{ frame.rarity.toUpperCase() }}</span>
                <span v-if="currentFrameId === frame.id" class="equipped-tag">ĐANG DÙNG</span>
              </div>

              <!-- Miniature Frame Ring -->
              <div class="frame-ring-sample" :class="frame.id">
                <span class="sample-icon">{{ frame.icon }}</span>
              </div>

              <h4 class="frame-name">{{ frame.name }}</h4>
              <p class="frame-desc">{{ frame.description }}</p>

              <div class="frame-unlock-info">
                <span v-if="!isFrameUnlocked(frame.id)" class="unlock-cond">
                  🔒 {{ frame.unlockCondition }}
                </span>
                <span v-else class="unlocked-text">✓ Đã sở hữu</span>
              </div>

              <!-- Action button -->
              <button
                v-if="isFrameUnlocked(frame.id)"
                type="button"
                class="equip-btn"
                :class="{ active: currentFrameId === frame.id }"
                :disabled="isSaving || currentFrameId === frame.id"
                @click.stop="handleEquipFrame(frame.id)"
              >
                {{ currentFrameId === frame.id ? '✓ Đang Sử Dụng' : 'Trang Bị Khung' }}
              </button>
              <button
                v-else
                type="button"
                class="locked-btn"
                disabled
              >
                🔒 Chưa Mở Khóa
              </button>
            </div>
          </div>
        </div>

        <!-- Tab 2: Badges & Titles List -->
        <div v-else-if="activeTab === 'titles'" class="tab-body titles-list-wrap">
          <div class="titles-list">
            <div
              v-for="title in titleList"
              :key="title.id"
              class="title-item-card"
              :class="{
                'is-equipped': currentTitleId === title.id,
                'is-locked': !isTitleUnlocked(title.id),
                [`rarity-${title.rarity}`]: true,
              }"
            >
              <div class="title-left-col">
                <div class="title-emblem">{{ title.icon }}</div>
                <div class="title-info">
                  <div class="title-name-row">
                    <h4 class="title-label">{{ title.name }}</h4>
                    <span class="rarity-badge">{{ title.rarity.toUpperCase() }}</span>
                    <span v-if="currentTitleId === title.id" class="equipped-tag">ĐANG DÙNG</span>
                  </div>
                  <p class="title-desc">{{ title.description }}</p>
                  <span v-if="!isTitleUnlocked(title.id)" class="title-unlock-cond">
                    🔒 {{ title.unlockCondition }}
                  </span>
                </div>
              </div>

              <div class="title-right-col">
                <button
                  v-if="isTitleUnlocked(title.id)"
                  type="button"
                  class="equip-btn"
                  :class="{ active: currentTitleId === title.id }"
                  :disabled="isSaving || currentTitleId === title.id"
                  @click="handleEquipTitle(title.id)"
                >
                  {{ currentTitleId === title.id ? '✓ Đang Dùng' : 'Trang Bị' }}
                </button>
                <button
                  v-else
                  type="button"
                  class="locked-btn"
                  disabled
                >
                  🔒 Khóa
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer">
          <button type="button" class="btn-done" @click="closeModal">
            Đóng
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.reward-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 15, 29, 0.82);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: 1rem;
}

.reward-modal-card {
  max-width: 680px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: #111827;
  border: 1px solid rgba(245, 158, 11, 0.35);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75);
  border-radius: 1.25rem;
  padding: 1.5rem;
  color: #f9fafb;
  overflow: hidden;
}

.modal-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 0.75rem;
}

.modal-headline {
  font-size: 1.25rem;
  font-weight: 800;
  color: #fbbf24;
  margin: 0;
  letter-spacing: 0.03em;
}

.modal-sub {
  font-size: 0.85rem;
  color: #94a3b8;
  margin: 0.25rem 0 0;
}

.modal-close-icon {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.25rem;
  transition: color 0.2s;
}

.modal-close-icon:hover {
  color: #ffffff;
}

/* Live Preview Box */
.live-avatar-preview-box {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1rem 1.25rem;
  border-radius: 0.75rem;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 1rem;
}

.preview-avatar-ring {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #374151;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.preview-avatar-ring.gold-avatar-frame {
  border: 3px solid #f59e0b;
  box-shadow: 0 0 14px rgba(245, 158, 11, 0.8), inset 0 0 8px rgba(245, 158, 11, 0.5);
  animation: gold-pulse 2.2s infinite alternate ease-in-out;
}

.preview-avatar-ring.cyber-avatar-frame {
  border: 3px solid #8b5cf6;
  box-shadow: 0 0 14px rgba(139, 92, 246, 0.8), inset 0 0 8px rgba(6, 182, 212, 0.5);
  animation: cyber-pulse 2s infinite alternate ease-in-out;
}

.preview-avatar-ring.mythic-avatar-frame {
  border: 3px solid #ec4899;
  box-shadow: 0 0 16px rgba(236, 72, 153, 0.85), inset 0 0 10px rgba(168, 85, 247, 0.6);
  animation: mythic-pulse 2.5s infinite alternate ease-in-out;
}

.preview-avatar-ring.default-avatar-frame {
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  font-size: 1.5rem;
  font-weight: 700;
  color: #f1f5f9;
}

.preview-user-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.preview-name {
  font-size: 1.05rem;
  font-weight: 700;
  color: #f8fafc;
}

.preview-title-pill {
  font-size: 0.75rem;
  font-weight: 700;
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.15);
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  width: fit-content;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.save-feedback-toast {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  background: rgba(16, 185, 129, 0.2);
  border: 1px solid rgba(16, 185, 129, 0.5);
  color: #34d399;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  text-align: center;
}

/* Nav Tabs */
.customizer-nav-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tab-btn {
  flex: 1;
  padding: 0.6rem 0.75rem;
  border-radius: 0.5rem;
  background: #1f2937;
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: #374151;
  color: #fbbf24;
  border-color: rgba(245, 158, 11, 0.5);
  font-weight: 700;
}

/* Tab Content */
.tab-body {
  overflow-y: auto;
  padding-right: 0.35rem;
  max-height: 48vh;
  display: flex;
  flex-direction: column;
}

.frames-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.85rem;
}

.frame-item-card {
  padding: 0.85rem;
  border-radius: 0.75rem;
  background: #1f2937;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.frame-item-card:hover {
  transform: translateY(-2px);
  border-color: rgba(245, 158, 11, 0.5);
}

.frame-item-card.is-previewing {
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.3);
  border-color: #f59e0b;
}

.frame-item-card.is-locked {
  opacity: 0.65;
  filter: grayscale(0.2);
}

.frame-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rarity-badge {
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
  background: rgba(255, 255, 255, 0.1);
}

.rarity-legendary .rarity-badge {
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.2);
}

.rarity-mythic .rarity-badge {
  color: #f472b6;
  background: rgba(236, 72, 153, 0.2);
}

.rarity-epic .rarity-badge {
  color: #c084fc;
  background: rgba(168, 85, 247, 0.2);
}

.equipped-tag {
  font-size: 0.65rem;
  font-weight: 800;
  color: #34d399;
  background: rgba(16, 185, 129, 0.15);
  padding: 0.15rem 0.45rem;
  border-radius: 9999px;
  border: 1px solid rgba(16, 185, 129, 0.4);
}

.frame-ring-sample {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0.2rem auto;
  background: #374151;
}

.frame-ring-sample.gold-avatar-frame {
  border: 2px solid #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.7);
}

.frame-ring-sample.cyber-avatar-frame {
  border: 2px solid #8b5cf6;
  box-shadow: 0 0 8px rgba(139, 92, 246, 0.7);
}

.frame-ring-sample.mythic-avatar-frame {
  border: 2px solid #ec4899;
  box-shadow: 0 0 8px rgba(236, 72, 153, 0.8);
}

.frame-name {
  font-size: 0.95rem;
  font-weight: 700;
  margin: 0;
  color: #f8fafc;
}

.frame-desc {
  font-size: 0.8rem;
  color: #94a3b8;
  margin: 0;
  line-height: 1.35;
  flex: 1;
}

.frame-unlock-info {
  font-size: 0.75rem;
  color: #64748b;
  min-height: 1.8rem;
}

.unlock-cond {
  color: #f87171;
}

.unlocked-text {
  color: #34d399;
  font-weight: 600;
}

.equip-btn {
  padding: 0.45rem 0.75rem;
  border-radius: 0.4rem;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #111827;
  border: none;
  transition: all 0.2s;
}

.equip-btn:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.equip-btn.active {
  background: #374151;
  color: #34d399;
  border: 1px solid rgba(52, 211, 153, 0.4);
}

.locked-btn {
  padding: 0.45rem 0.75rem;
  border-radius: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
  background: #1e293b;
  color: #64748b;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  cursor: not-allowed;
}

/* Titles List */
.titles-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.title-item-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1rem;
  border-radius: 0.75rem;
  background: #1f2937;
  border: 1px solid rgba(255, 255, 255, 0.08);
  gap: 1rem;
}

.title-item-card.is-equipped {
  border-color: rgba(245, 158, 11, 0.5);
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, #1f2937 100%);
}

.title-item-card.is-locked {
  opacity: 0.65;
}

.title-left-col {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex: 1;
}

.title-emblem {
  font-size: 1.75rem;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #374151;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.title-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.title-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.title-label {
  font-size: 0.95rem;
  font-weight: 700;
  margin: 0;
  color: #f8fafc;
}

.title-desc {
  font-size: 0.8rem;
  color: #94a3b8;
  margin: 0;
  line-height: 1.35;
}

.title-unlock-cond {
  font-size: 0.75rem;
  color: #f87171;
}

.modal-footer {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: flex-end;
}

.btn-done {
  padding: 0.5rem 1.25rem;
  border-radius: 0.5rem;
  background: #374151;
  color: #f1f5f9;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-done:hover {
  background: #4b5563;
}

/* Pulse Keyframes */
@keyframes gold-pulse {
  from {
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
  }
  to {
    box-shadow: 0 0 16px rgba(245, 158, 11, 0.9), inset 0 0 8px rgba(245, 158, 11, 0.6);
  }
}

@keyframes cyber-pulse {
  from {
    box-shadow: 0 0 8px rgba(139, 92, 246, 0.5);
  }
  to {
    box-shadow: 0 0 16px rgba(6, 182, 212, 0.9), inset 0 0 8px rgba(139, 92, 246, 0.6);
  }
}

@keyframes mythic-pulse {
  from {
    box-shadow: 0 0 8px rgba(236, 72, 153, 0.5);
  }
  to {
    box-shadow: 0 0 18px rgba(168, 85, 247, 0.9), inset 0 0 10px rgba(236, 72, 153, 0.7);
  }
}
</style>
