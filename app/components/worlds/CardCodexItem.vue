<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import type { CodexCard } from '~/types/game';

interface Props {
  card: CodexCard;
  isCollected: boolean;
}

const props = defineProps<Props>();

const isFlipped = ref<boolean>(false);
const isSpeaking = ref<boolean>(false);

function toggleFlip(): void {
  if (props.isCollected) {
    isFlipped.value = !isFlipped.value;
  }
}

function speakWord(e: Event): void {
  e.stopPropagation();
  if (!import.meta.client || !('speechSynthesis' in window)) {
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(props.card.audioText || props.card.word);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;

  utterance.onstart = () => {
    isSpeaking.value = true;
  };
  utterance.onend = () => {
    isSpeaking.value = false;
  };
  utterance.onerror = () => {
    isSpeaking.value = false;
  };

  window.speechSynthesis.speak(utterance);
}

onUnmounted(() => {
  if (import.meta.client && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
});

function getRarityLabel(rarity: string): string {
  switch (rarity) {
    case 'legendary':
      return 'Huyền Thoại';
    case 'epic':
      return 'Sử Thi';
    case 'rare':
      return 'Hiếm';
    default:
      return 'Phổ Thông';
  }
}
</script>

<template>
  <div
    class="card-3d-wrapper"
    :class="[
      `rarity-${card.rarity}`,
      { 'is-collected': isCollected, 'is-locked': !isCollected, 'is-flipped': isFlipped }
    ]"
    @click="toggleFlip"
  >
    <div class="card-inner">
      <!-- FRONT FACE -->
      <div class="card-face card-front">
        <!-- Rarity Badge & Audio Button -->
        <div class="card-top-bar">
          <span class="rarity-badge">{{ getRarityLabel(card.rarity) }}</span>

          <button
            v-if="isCollected"
            type="button"
            class="speak-btn"
            :class="{ 'speaking': isSpeaking }"
            title="Nghe phát âm chuẩn"
            aria-label="Phát âm từ vựng"
            @click="speakWord"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          </button>
        </div>

        <!-- Center Emoji Visual -->
        <div class="card-visual">
          <span v-if="isCollected" class="card-emoji">{{ card.emoji || '✨' }}</span>
          <span v-else class="locked-icon">🔒</span>
        </div>

        <!-- Word, IPA, Meaning -->
        <div class="card-body">
          <template v-if="isCollected">
            <h4 class="card-word">{{ card.word }}</h4>
            <span class="card-ipa">{{ card.ipa }}</span>
            <span class="card-pos">{{ card.partOfSpeech }}</span>
            <p class="card-meaning">{{ card.meaning }}</p>
          </template>

          <template v-else>
            <h4 class="card-word card-masked">???</h4>
            <p class="card-hint">Mở khóa tại Màn {{ card.stageId }}</p>
          </template>
        </div>

        <!-- Card Footer -->
        <div class="card-footer">
          <span v-if="isCollected" class="flip-hint">Chạm để xem chi tiết ↷</span>
          <span v-else class="locked-label">Chưa sưu tầm</span>
        </div>
      </div>

      <!-- BACK FACE (Details & Lore) -->
      <div class="card-face card-back">
        <div class="back-header">
          <span class="back-title">{{ card.word }}</span>
          <span class="back-rarity">{{ getRarityLabel(card.rarity) }}</span>
        </div>

        <div class="back-content">
          <div class="back-section">
            <span class="section-label">Ví dụ ngữ cảnh:</span>
            <p class="example-en">"{{ card.example }}"</p>
            <p class="example-vi">{{ card.exampleMeaning }}</p>
          </div>

          <div class="back-section">
            <span class="section-label">Cốt truyện thẻ bài:</span>
            <p class="card-lore">{{ card.lore }}</p>
          </div>
        </div>

        <div class="card-footer">
          <span class="flip-hint">Chạm để quay lại ↶</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-3d-wrapper {
  perspective: 1000px;
  width: 100%;
  aspect-ratio: 2 / 3.1;
  cursor: pointer;
  user-select: none;
}

.card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: var(--radius-lg);
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  transform-style: preserve-3d;
}

.card-3d-wrapper.is-flipped .card-inner {
  transform: rotateY(180deg);
}

.card-face {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: var(--radius-lg);
  padding: 1.25rem 1rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background-color: var(--bg-card);
  border: 2px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s;
}

.card-back {
  transform: rotateY(180deg);
  background-color: var(--bg-surface);
}

.card-3d-wrapper:hover .card-face {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
}

/* Rarity Accents */
.rarity-common .card-face {
  border-color: #94a3b8;
}

.rarity-rare .card-face {
  border-color: #3b82f6;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.25);
}

.rarity-epic .card-face {
  border-color: #a855f7;
  box-shadow: 0 0 16px rgba(168, 85, 247, 0.35);
}

.rarity-legendary .card-face {
  border-color: #f59e0b;
  box-shadow: 0 0 22px rgba(245, 158, 11, 0.5);
}

/* Locked Card Style */
.card-3d-wrapper.is-locked .card-face {
  background: var(--bg-secondary);
  border-color: rgba(148, 163, 184, 0.25);
  box-shadow: none !important;
  opacity: 0.65;
  filter: grayscale(0.85);
  cursor: default;
}

.card-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rarity-badge {
  font-size: 0.6875rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.45rem;
  border-radius: var(--radius-pill);
  background: rgba(148, 163, 184, 0.2);
  color: var(--text-primary);
}

.rarity-rare .rarity-badge {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.rarity-epic .rarity-badge {
  background: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

.rarity-legendary .rarity-badge {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.speak-btn {
  background: rgba(148, 163, 184, 0.15);
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.speak-btn:hover {
  background: var(--accent-primary);
  color: var(--accent-text);
  transform: scale(1.1);
}

.card-visual {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 0;
}

.card-emoji {
  font-size: 3.25rem;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.15));
  animation: float-card 3s infinite ease-in-out alternate;
}

.locked-icon {
  font-size: 2.5rem;
  opacity: 0.5;
}

.card-body {
  text-align: center;
}

.card-word {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.2;
}

.card-ipa {
  display: block;
  font-size: 0.8125rem;
  color: var(--text-muted);
  font-family: monospace;
  margin-top: 0.15rem;
}

.card-pos {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--accent-primary);
  background: rgba(148, 163, 184, 0.12);
  padding: 0.05rem 0.35rem;
  border-radius: 4px;
  margin: 0.25rem 0;
}

.card-meaning {
  margin: 0.25rem 0 0 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  line-height: 1.35;
}

.card-masked {
  letter-spacing: 0.25em;
  opacity: 0.5;
}

.card-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.5rem;
}

.card-footer {
  text-align: center;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--border-color);
}

.flip-hint {
  font-size: 0.6875rem;
  color: var(--text-muted);
  font-weight: 600;
}

.locked-label {
  font-size: 0.6875rem;
  color: var(--text-muted);
  font-style: italic;
}

/* BACK FACE STYLES */
.back-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.5rem;
}

.back-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--text-primary);
}

.back-rarity {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--accent-primary);
}

.back-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: left;
}

.section-label {
  display: block;
  font-size: 0.6875rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 0.2rem;
}

.example-en {
  margin: 0;
  font-size: 0.8125rem;
  font-style: italic;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.35;
}

.example-vi {
  margin: 0.15rem 0 0 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.card-lore {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--text-secondary);
}

@keyframes float-card {
  0% { transform: translateY(0); }
  100% { transform: translateY(-5px); }
}
</style>

