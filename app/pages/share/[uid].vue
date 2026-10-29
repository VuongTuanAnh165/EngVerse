<script setup lang="ts">
/**
 * EngVerse - Social Share Achievement Page with Dynamic OG Image
 * Generates viral Open Graph cards for Facebook & Zalo crawlers,
 * and provides a 3D honor card experience for visiting users.
 *
 * Strict TypeScript (0 any), 100% memory leak free.
 * Reference: docs/ke_hoach.md - Sprint 6 (Mục 2) & Rules.md
 */

import { ref, computed, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import type { PublicShareResponse, PublicShareProfile } from '~/types/share';
import type { WorldTrack } from '~/types/user';

const route = useRoute();
const config = useRuntimeConfig();

const uid = computed<string>(() => {
  const param = route.params.uid;
  return Array.isArray(param) ? param[0] || 'guest_user' : param || 'guest_user';
});

const siteUrl = computed<string>(() => {
  const raw = (config.public.siteUrl as string) || '';
  return raw.replace(/\/+$/, '') || 'https://engverse.vercel.app';
});

const currentShareUrl = computed<string>(() => `${siteUrl.value}/share/${uid.value}`);

// Server-side fetching of public profile data
const { data: response, error } = await useAsyncData<PublicShareResponse>(
  `public-profile-${uid.value}`,
  () => $fetch<PublicShareResponse>(`/api/user/public/${encodeURIComponent(uid.value)}`)
);

const profile = computed<PublicShareProfile>(() => {
  if (response.value && response.value.profile) {
    return response.value.profile;
  }
  return {
    uid: uid.value,
    displayName: 'Nhà Thám Hiểm Tân Binh',
    avatar: 'rookie_explorer',
    level: 1,
    exp: 100,
    equippedTitle: 'Tân Binh Đa Vũ Trụ',
    streak: { current: 1, freezeShields: 0 },
    worldTrack: 'kids' as WorldTrack,
    collectedCardsCount: 1,
    unlockedTitlesCount: 1,
  };
});

// Configure SEO Meta tags for Facebook, Zalo, and Twitter/X
useSeoMeta({
  title: () => `Thẻ Vinh Danh: ${profile.value.displayName} (Lv.${profile.value.level}) | EngVerse`,
  ogTitle: () => `🔥 Thẻ Vinh Danh: ${profile.value.displayName} - Lv.${profile.value.level}`,
  description: () =>
    `${profile.value.displayName} đang nắm giữ danh hiệu "${profile.value.equippedTitle}" cùng Chuỗi ${profile.value.streak.current} ngày học liên tiếp trên Đa Vũ Trụ EngVerse! Thử thách cùng tôi ngay!`,
  ogDescription: () =>
    `${profile.value.displayName} đang nắm giữ danh hiệu "${profile.value.equippedTitle}" cùng Chuỗi ${profile.value.streak.current} ngày học liên tiếp trên Đa Vũ Trụ EngVerse! Thử thách cùng tôi ngay!`,
  ogType: 'profile',
  ogUrl: () => currentShareUrl.value,
  twitterCard: 'summary_large_image',
  twitterTitle: () => `🔥 Thẻ Vinh Danh: ${profile.value.displayName} - Lv.${profile.value.level}`,
  twitterDescription: () =>
    `Đạt Danh hiệu "${profile.value.equippedTitle}" và Chuỗi ${profile.value.streak.current} ngày học liên tiếp trên EngVerse.`,
});

// Define dynamic Open Graph Image component using nuxt-og-image
defineOgImageComponent('HonorCard', {
  displayName: profile.value.displayName,
  avatar: profile.value.avatar,
  level: profile.value.level,
  streak: profile.value.streak.current,
  equippedTitle: profile.value.equippedTitle,
  worldTrack: profile.value.worldTrack,
  exp: profile.value.exp,
  cardsCount: profile.value.collectedCardsCount,
});

// Clipboard and Share Interactions
const copyFeedback = ref<string | null>(null);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

async function handleCopyLink(): Promise<void> {
  if (!import.meta.client) return;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(currentShareUrl.value);
    } else {
      // Fallback for non-secure contexts
      const textArea = document.createElement('textarea');
      textArea.value = currentShareUrl.value;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }

    copyFeedback.value = 'Đã sao chép link vinh danh!';
  } catch {
    copyFeedback.value = 'Không thể sao chép tự động. Hãy sao chép link trên thanh địa chỉ.';
  }

  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copyFeedback.value = null;
  }, 3500);
}

function shareOnFacebook(): void {
  if (!import.meta.client) return;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentShareUrl.value)}`;
  window.open(fbUrl, '_blank', 'width=620,height=520,noopener,noreferrer');
}

function shareOnZalo(): void {
  if (!import.meta.client) return;
  const zaloUrl = `https://zalo.me/share?url=${encodeURIComponent(currentShareUrl.value)}`;
  window.open(zaloUrl, '_blank', 'width=620,height=520,noopener,noreferrer');
}

function getTrackDisplayName(track: string): string {
  switch (track) {
    case 'kids':
      return 'Đảo Thần Thoại 🏝️';
    case 'teens':
      return 'Cyber City ⚡';
    case 'adults':
      return 'SimLife Global 🌐';
    default:
      return 'Đa Vũ Trụ EngVerse';
  }
}

function getAvatarEmoji(avatar: string): string {
  if (avatar.includes('dragon') || avatar.includes('rider')) return '🐉';
  if (avatar.includes('cyber') || avatar.includes('sleuth') || avatar.includes('hacker')) return '🕵️‍♂️';
  if (avatar.includes('global') || avatar.includes('ceo') || avatar.includes('business')) return '💼';
  if (avatar.includes('fairy')) return '🧚';
  return '🚀';
}

onUnmounted(() => {
  if (copyTimer) {
    clearTimeout(copyTimer);
  }
});
</script>

<template>
  <main class="share-page-container">
    <div class="share-wrapper">
      <!-- Breadcrumb / Back Link -->
      <nav class="share-nav" aria-label="Điều hướng">
        <NuxtLink to="/" class="back-link">
          ← Khám Phá Bản Đồ EngVerse
        </NuxtLink>
      </nav>

      <!-- Error State -->
      <div v-if="error" class="error-banner theme-card">
        <span class="error-icon" aria-hidden="true">⚠️</span>
        <h2>Không Tìm Thấy Hồ Sơ</h2>
        <p>Người chơi này có thể chưa đăng ký hoặc mã chia sẻ không chính xác.</p>
        <NuxtLink to="/" class="theme-btn-primary return-home-btn">
          Về Trang Chủ Khám Phá
        </NuxtLink>
      </div>

      <!-- Main Honor Card Section -->
      <section v-else class="honor-card-section">
        <!-- 3D Holographic Card Preview -->
        <div class="honor-holo-card theme-card" :data-track="profile.worldTrack">
          <!-- Card Header -->
          <div class="card-top-bar">
            <div class="brand-pill">
              <span class="brand-icon">⚡</span>
              <span class="brand-text">EngVerse Bảng Vàng</span>
            </div>
            <div class="track-tag">
              {{ getTrackDisplayName(profile.worldTrack) }}
            </div>
          </div>

          <!-- Card Body -->
          <div class="card-hero-body">
            <div class="avatar-ring-container">
              <div class="avatar-halo">
                <span class="avatar-emoji">{{ getAvatarEmoji(profile.avatar) }}</span>
              </div>
              <span class="level-badge">Lv.{{ profile.level }}</span>
            </div>

            <div class="identity-info">
              <div class="equipped-title-badge">
                <span class="crown-icon">👑</span>
                <span>{{ profile.equippedTitle }}</span>
              </div>
              <h1 class="player-name">{{ profile.displayName }}</h1>
              <p class="honor-caption">
                Chiến binh tiếng Anh đã hoàn thành xuất sắc các chặng thử thách đa vũ trụ.
              </p>
            </div>
          </div>

          <!-- Card Stats Grid -->
          <div class="card-stats-grid">
            <div class="stat-box streak-box">
              <span class="stat-icon" aria-hidden="true">🔥</span>
              <div class="stat-meta">
                <span class="stat-value">{{ profile.streak.current }} Ngày</span>
                <span class="stat-label">Chuỗi Học Tập</span>
              </div>
            </div>

            <div class="stat-box exp-box">
              <span class="stat-icon" aria-hidden="true">⭐</span>
              <div class="stat-meta">
                <span class="stat-value">{{ profile.exp }}</span>
                <span class="stat-label">Tổng EXP</span>
              </div>
            </div>

            <div class="stat-box cards-box">
              <span class="stat-icon" aria-hidden="true">🃏</span>
              <div class="stat-meta">
                <span class="stat-value">{{ profile.collectedCardsCount }}</span>
                <span class="stat-label">Thẻ Bài Codex</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Viral Share Actions -->
        <div class="share-actions-card theme-card">
          <h2 class="actions-title">Chia Sẻ Thành Tích Này</h2>
          <p class="actions-subtitle">
            Khoe chuỗi ngày học và danh hiệu lên Facebook, Zalo hoặc gửi cho bạn bè để thách đấu!
          </p>

          <div class="social-btn-group">
            <button
              type="button"
              class="social-btn fb-btn"
              @click="shareOnFacebook"
            >
              <span class="social-icon">📘</span>
              <span>Chia sẻ Facebook</span>
            </button>

            <button
              type="button"
              class="social-btn zalo-btn"
              @click="shareOnZalo"
            >
              <span class="social-icon">💬</span>
              <span>Chia sẻ Zalo</span>
            </button>

            <button
              type="button"
              class="social-btn copy-btn"
              @click="handleCopyLink"
            >
              <span class="social-icon">🔗</span>
              <span>Sao chép Link</span>
            </button>
          </div>

          <transition name="fade">
            <div v-if="copyFeedback" class="copy-toast" role="status">
              {{ copyFeedback }}
            </div>
          </transition>

          <!-- Call to action: Challenge & Play -->
          <div class="cta-divider" />
          <div class="challenge-cta">
            <p class="cta-text">
              Bạn có thể vượt qua kỷ lục của <strong>{{ profile.displayName }}</strong> không?
            </p>
            <NuxtLink to="/" class="theme-btn-primary play-now-btn">
              ⚡ Chơi Thử Ngay Trong 30 Giây
            </NuxtLink>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.share-page-container {
  min-height: calc(100vh - 70px);
  padding: 2.5rem 1.25rem 4rem;
  background: radial-gradient(circle at 50% 20%, rgba(56, 189, 248, 0.08) 0%, transparent 60%);
}

.share-wrapper {
  max-width: 820px;
  margin: 0 auto;
}

.share-nav {
  margin-bottom: 1.5rem;
}

.back-link {
  display: inline-flex;
  align-items: center;
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 700;
  text-decoration: none;
  transition: color 0.2s ease;
}

.back-link:hover {
  color: var(--accent-primary);
}

.honor-card-section {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

/* 3D Holographic Card */
.honor-holo-card {
  position: relative;
  border-radius: var(--radius-card);
  padding: 2.5rem 2rem;
  background: linear-gradient(145deg, var(--bg-surface) 0%, rgba(15, 23, 42, 0.95) 100%);
  border: 1px solid rgba(56, 189, 248, 0.3);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45), 0 0 40px rgba(56, 189, 248, 0.15);
  overflow: hidden;
}

.honor-holo-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #38bdf8, #818cf8, #f472b6);
}

.card-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.brand-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.85rem;
  border-radius: var(--radius-pill);
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: var(--accent-primary);
  font-size: 0.8125rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.track-tag {
  font-size: 0.8125rem;
  font-weight: 800;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.05);
  padding: 0.35rem 0.85rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-color);
}

.card-hero-body {
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 2.5rem;
}

.avatar-ring-container {
  position: relative;
  flex-shrink: 0;
}

.avatar-halo {
  width: 104px;
  height: 104px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  border: 3px solid #38bdf8;
  box-shadow: 0 0 24px rgba(56, 189, 248, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-emoji {
  font-size: 3rem;
}

.level-badge {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border: 2px solid #ffffff;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 900;
  padding: 0.15rem 0.65rem;
  border-radius: var(--radius-pill);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  white-space: nowrap;
}

.identity-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.equipped-title-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  align-self: flex-start;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-pill);
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.4);
  color: #fbbf24;
  font-size: 0.8125rem;
  font-weight: 800;
}

.player-name {
  margin: 0;
  font-size: 2rem;
  font-weight: 900;
  color: var(--text-primary);
  line-height: 1.2;
}

.honor-caption {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* Stats Grid */
.card-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.stat-box {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1.125rem 1.25rem;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
}

.stat-icon {
  font-size: 1.75rem;
  flex-shrink: 0;
}

.stat-meta {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 900;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.streak-box .stat-value {
  color: #f97316;
}

.exp-box .stat-value {
  color: #38bdf8;
}

.cards-box .stat-value {
  color: #a855f7;
}

/* Share Actions Card */
.share-actions-card {
  padding: 2rem;
  text-align: center;
  border-radius: var(--radius-card);
}

.actions-title {
  margin: 0 0 0.5rem 0;
  font-size: 1.375rem;
  font-weight: 800;
  color: var(--text-primary);
}

.actions-subtitle {
  margin: 0 0 1.5rem 0;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}

.social-btn-group {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.875rem;
  margin-bottom: 1rem;
}

.social-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius-pill);
  font-size: 0.875rem;
  font-weight: 800;
  cursor: pointer;
  border: 1px solid transparent;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.social-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.25);
}

.fb-btn {
  background: #1877f2;
  color: #ffffff;
}

.zalo-btn {
  background: #0068ff;
  color: #ffffff;
}

.copy-btn {
  background: var(--bg-surface-translucent);
  border-color: var(--border-color);
  color: var(--text-primary);
}

.copy-toast {
  margin-top: 0.75rem;
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-pill);
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.4);
  color: #34d399;
  font-size: 0.8125rem;
  font-weight: 700;
}

.cta-divider {
  height: 1px;
  background: var(--border-color);
  margin: 1.75rem 0;
}

.challenge-cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.875rem;
}

.cta-text {
  margin: 0;
  font-size: 1rem;
  color: var(--text-secondary);
}

.play-now-btn {
  padding: 0.875rem 2rem;
  font-size: 1rem;
  text-decoration: none;
  border-radius: var(--radius-pill);
}

.error-banner {
  text-align: center;
  padding: 3rem 1.5rem;
}

.error-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

.return-home-btn {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  text-decoration: none;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .card-hero-body {
    flex-direction: column;
    text-align: center;
    gap: 1.25rem;
  }

  .equipped-title-badge {
    align-self: center;
  }

  .card-stats-grid {
    grid-template-columns: 1fr;
  }

  .social-btn-group {
    flex-direction: column;
  }

  .social-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>

