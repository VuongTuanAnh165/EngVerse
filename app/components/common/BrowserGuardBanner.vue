<script setup lang="ts">
import { useBrowserGuard } from '~/composables/useBrowserGuard';

const {
  browserType,
  isIos,
  isAndroid,
  isCopied,
  shouldShowBanner,
  dismissBanner,
  copyCurrentUrl,
  openInExternalBrowser,
} = useBrowserGuard();
</script>

<template>
  <Transition name="guard-slide">
    <aside
      v-if="shouldShowBanner"
      class="browser-guard-banner"
      role="alert"
      aria-live="polite"
    >
      <div class="guard-container">
        <!-- Icon & Status -->
        <div class="guard-header">
          <div class="guard-icon-box" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div class="guard-titles">
            <div class="guard-badge">
              Cảnh báo trình duyệt {{ browserType || 'In-App' }}
            </div>
            <h2 class="guard-title">
              Mở bằng Safari hoặc Chrome để bật tính năng Luyện nói AI
            </h2>
          </div>
          <button
            type="button"
            class="guard-close-btn"
            aria-label="Đóng cảnh báo"
            @click="dismissBanner"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <!-- Description & Guide -->
        <p class="guard-description">
          Trình duyệt trong ứng dụng <strong>{{ browserType || 'này' }}</strong> thường xuyên
          chặn quyền Micro, khiến các màn chơi Nhận diện giọng nói và Nhập vai AI không hoạt động ổn định.
        </p>

        <!-- OS-Specific Instruction -->
        <div v-if="isIos" class="guard-instructions">
          <div class="instruction-step">
            <span class="step-num">1</span>
            <span>Bấm vào biểu tượng <strong>(...)</strong> hoặc nút <strong>Chia sẻ</strong> ở góc màn hình.</span>
          </div>
          <div class="instruction-step">
            <span class="step-num">2</span>
            <span>Chọn <strong>"Mở bằng trình duyệt"</strong> hoặc <strong>"Mở bằng Safari"</strong>.</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="guard-actions">
          <button
            v-if="isAndroid"
            type="button"
            class="btn-primary"
            @click="openInExternalBrowser"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" />
              <line x1="21.17" y1="8" x2="12" y2="8" />
              <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
              <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
            </svg>
            Mở bằng Chrome
          </button>

          <button
            type="button"
            class="btn-secondary"
            :class="{ 'btn-copied': isCopied }"
            @click="copyCurrentUrl"
          >
            <svg
              v-if="!isCopied"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <svg
              v-else
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {{ isCopied ? 'Đã sao chép link!' : 'Sao chép link trang' }}
          </button>

          <button
            type="button"
            class="btn-text"
            @click="dismissBanner"
          >
            Tiếp tục tại đây
          </button>
        </div>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.browser-guard-banner {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
  border-bottom: 2px solid #6366f1;
  color: #f8fafc;
  padding: 1rem 1.25rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.guard-container {
  max-width: 960px;
  margin: 0 auto;
}

.guard-header {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  position: relative;
}

.guard-icon-box {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f87171;
  animation: pulse-ring 2s infinite ease-in-out;
}

.guard-titles {
  flex: 1;
}

.guard-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: #ef4444;
  color: #ffffff;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  margin-bottom: 0.25rem;
}

.guard-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.4;
  color: #ffffff;
}

.guard-close-btn {
  background: transparent;
  border: none;
  color: #cbd5e1;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.guard-close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.guard-description {
  margin: 0.5rem 0 0.75rem 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #e2e8f0;
}

.guard-instructions {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.instruction-step {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.85rem;
  color: #e0e7ff;
}

.step-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #6366f1;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.guard-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.625rem;
  align-items: center;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #3b82f6;
  color: #ffffff;
  font-weight: 600;
  font-size: 0.875rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  font-weight: 600;
  font-size: 0.875rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

.btn-copied {
  background: #10b981 !important;
  border-color: #10b981 !important;
}

.btn-text {
  background: transparent;
  color: #cbd5e1;
  font-size: 0.85rem;
  padding: 0.5rem 0.75rem;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: color 0.2s;
}

.btn-text:hover {
  color: #ffffff;
}

@keyframes pulse-ring {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
  }
  50% {
    transform: scale(1.04);
    box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
  }
}

/* Slide Transition */
.guard-slide-enter-active,
.guard-slide-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.guard-slide-enter-from,
.guard-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>

