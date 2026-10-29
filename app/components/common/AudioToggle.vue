<script setup lang="ts">
import { ref, onMounted } from 'vue';

const isMuted = ref<boolean>(false);

function toggleAudio(): void {
  isMuted.value = !isMuted.value;
  if (import.meta.client) {
    try {
      localStorage.setItem('engverse_audio_muted', String(isMuted.value));
      // Dispatch custom window event for useSoundEffects composable
      window.dispatchEvent(
        new CustomEvent('engverse:audio-toggle', {
          detail: { isMuted: isMuted.value },
        })
      );
    } catch {
      // Ignore storage errors
    }
  }
}

onMounted(() => {
  if (import.meta.client) {
    try {
      const stored = localStorage.getItem('engverse_audio_muted');
      if (stored === 'true') {
        isMuted.value = true;
      }
    } catch {
      // Ignore storage errors
    }
  }
});
</script>

<template>
  <button
    type="button"
    class="audio-toggle-btn"
    :class="{ 'btn-muted': isMuted }"
    :aria-label="isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'"
    :title="isMuted ? 'Bật âm thanh trò chơi' : 'Tắt âm thanh trò chơi'"
    @click="toggleAudio"
  >
    <!-- Unmuted Speaker -->
    <svg
      v-if="!isMuted"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="audio-svg"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>

    <!-- Muted Speaker -->
    <svg
      v-else
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="audio-svg"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  </button>
</template>

<style scoped>
.audio-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-pill);
  background-color: var(--bg-surface-translucent);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-speed) var(--transition-timing);
}

.audio-toggle-btn:hover {
  transform: scale(1.05);
  border-color: var(--border-focus);
}

.audio-toggle-btn:active {
  transform: scale(0.96);
}

.btn-muted {
  color: var(--text-muted);
  opacity: 0.75;
}

.audio-svg {
  transition: transform 0.2s ease;
}
</style>

