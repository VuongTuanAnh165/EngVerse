<script setup lang="ts">
/**
 * EngVerse - Application Global Footer
 * Tôn vinh tác giả Vương Tuấn Anh và liên kết kênh TikTok chính thức.
 * Tự động thích ứng đa vũ trụ (Themes) và tương thích hoàn hảo mọi thiết bị di động.
 */
</script>

<template>
  <footer class="app-footer" role="contentinfo" aria-label="Thông tin chân trang EngVerse">
    <div class="footer-container">
      <div class="footer-inner">
        <!-- Copyright & Creator Credit -->
        <div class="footer-credit">
          <span class="copyright-part">© 2026 <strong class="brand-name">EngVerse</strong></span>
          <span class="divider-dot" aria-hidden="true">•</span>
          <span class="creator-part">
            Được phát triển bởi
            <strong class="creator-name">Vương Tuấn Anh</strong>
          </span>
        </div>

        <!-- TikTok Social Link Button -->
        <div class="footer-actions">
          <a
            href="https://www.tiktok.com/@marvelous1605?is_from_webapp=1&sender_device=pc"
            target="_blank"
            rel="noopener noreferrer"
            class="tiktok-btn"
            aria-label="Kênh TikTok chính thức của Vương Tuấn Anh: @marvelous1605"
            title="Ghé thăm TikTok @marvelous1605 của Vương Tuấn Anh"
          >
            <span class="tiktok-icon-wrapper" aria-hidden="true">
              <!-- Official TikTok SVG Icon -->
              <svg
                class="tiktok-svg"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="currentColor"
              >
                <path
                  d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
                />
              </svg>
            </span>
            <span class="tiktok-label">TikTok</span>
            <span class="external-icon" aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  width: 100%;
  margin-top: auto;
  background: var(--header-bg);
  border-top: 1px solid var(--border-color);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: background-color var(--transition-speed) ease, border-color var(--transition-speed) ease;
  z-index: 10;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.15rem 1.5rem;
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  flex-wrap: wrap;
}

/* Credit & Copyright Text */
.footer-credit {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.5;
  flex-wrap: wrap;
}

.brand-name {
  color: var(--text-primary);
  font-weight: 800;
  letter-spacing: -0.01em;
}

.divider-dot {
  color: var(--border-color);
  font-weight: 900;
  user-select: none;
}

.creator-part {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.creator-name {
  color: var(--text-primary);
  font-weight: 800;
  position: relative;
  transition: color 0.2s ease;
}

/* Interactive TikTok Button */
.footer-actions {
  display: flex;
  align-items: center;
}

.tiktok-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem 0.9rem;
  border-radius: var(--radius-pill);
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 0.8125rem;
  font-weight: 700;
  text-decoration: none;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.2s ease,
              border-color 0.2s ease,
              color 0.2s ease,
              background-color 0.2s ease;
  user-select: none;
}

.tiktok-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s ease;
}

.tiktok-label {
  letter-spacing: 0.02em;
}

.external-icon {
  font-size: 0.75rem;
  opacity: 0.6;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

/* Hover & Focus Micro-interactions */
.tiktok-btn:hover {
  transform: translateY(-2px);
  border-color: #fe2c55;
  color: #fe2c55;
  background: var(--bg-card-hover);
  box-shadow: 0 4px 16px rgba(254, 44, 85, 0.22), 0 0 10px rgba(37, 244, 238, 0.18);
}

.tiktok-btn:hover .tiktok-icon-wrapper {
  transform: scale(1.18) rotate(-4deg);
  color: #fe2c55;
}

.tiktok-btn:hover .external-icon {
  opacity: 1;
  transform: translate(2px, -2px);
}

.tiktok-btn:active {
  transform: translateY(0) scale(0.98);
}

.tiktok-btn:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}

/* Mobile Responsive */
@media (max-width: 640px) {
  .footer-container {
    padding: 1rem 1rem 1.25rem;
  }

  .footer-inner {
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    gap: 0.75rem;
  }

  .footer-credit {
    justify-content: center;
    font-size: 0.8125rem;
    gap: 0.4rem;
  }

  .divider-dot {
    display: inline;
  }

  .tiktok-btn {
    padding: 0.45rem 1.15rem;
    font-size: 0.825rem;
  }
}
</style>

