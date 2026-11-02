<script setup lang="ts">
/**
 * EngVerse - Social Share Achievement Page with Dynamic OG Image
 * Generates viral Open Graph cards for Facebook & Zalo crawlers,
 * and provides a 3D honor card experience for visiting users.
 *
 * Strict TypeScript (0 any), 100% memory leak free.
 * Multi-Universe Dynamic Theming:
 *   - Kids (Đảo Thần Thoại): Radiant Golden Sunstone Fantasy Parchment
 *   - Teens (Cyber City): Cyberpunk Neon Holographic Dark Card
 *   - Adults (SimLife Global): Executive Platinum & Sapphire VIP Card
 *
 * Reference: docs/ke_hoach.md - Sprint 6 (Mục 2) & Rules.md
 */

import { ref, computed, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useUserStore } from '~/stores/user';
import type { PublicShareResponse, PublicShareProfile } from '~/types/share';
import type { WorldTrack } from '~/types/user';

const route = useRoute();
const config = useRuntimeConfig();
const userStore = useUserStore();

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
  let base: PublicShareProfile;
  if (response.value && response.value.profile) {
    base = { ...response.value.profile };
  } else {
    base = {
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
  }

  // When previewing guest mode in browser, sync with the active visitor session and track
  if (uid.value === 'guest_user' && import.meta.client) {
    if (userStore.currentTrack) {
      base.worldTrack = userStore.currentTrack;
    }
    if (userStore.user.displayName && userStore.user.displayName !== 'Explorer') {
      base.displayName = userStore.user.displayName;
    }
    if (userStore.level > 1) {
      base.level = userStore.level;
    }
    if (userStore.exp > 100) {
      base.exp = userStore.exp;
    }
    if (userStore.streak.current > 1) {
      base.streak = { current: userStore.streak.current, freezeShields: userStore.streak.freezeShields };
    }
  }

  return base;
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

    copyFeedback.value = 'Đã sao chép link vinh danh thành công!';
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
          <svg class="back-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Khám Phá Bản Đồ EngVerse</span>
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
        <div class="honor-holo-card" :data-track="profile.worldTrack">
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
        <div class="share-actions-card">
          <h2 class="actions-title">Chia Sẻ Thành Tích Này</h2>
          <p class="actions-subtitle">
            Khoe chuỗi ngày học và danh hiệu lên Facebook, Zalo hoặc gửi cho bạn bè để thách đấu!
          </p>

          <div class="social-btn-group">
            <button
              type="button"
              class="social-btn fb-btn"
              aria-label="Chia sẻ lên Facebook"
              @click="shareOnFacebook"
            >
              <svg class="social-svg-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>Chia sẻ Facebook</span>
            </button>

            <button
              type="button"
              class="social-btn zalo-btn"
              aria-label="Chia sẻ qua Zalo"
              @click="shareOnZalo"
            >
              <svg class="social-svg-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <rect width="24" height="24" rx="5" fill="#0068FF"/>
                <path d="M6 7.5h5l-4 6H12v2H5l4-6H6v-2zm7 0h2.2v8H13v-8zm3.2 0h2v5.2a1.4 1.4 0 002.8 0V7.5H23v5.2a3.4 3.4 0 01-6.8 0V7.5z" fill="#ffffff"/>
              </svg>
              <span>Chia sẻ Zalo</span>
            </button>

            <button
              type="button"
              class="social-btn copy-btn"
              aria-label="Sao chép liên kết vinh danh"
              @click="handleCopyLink"
            >
              <svg class="social-svg-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <span>Sao chép Link</span>
            </button>
          </div>

          <transition name="fade">
            <div v-if="copyFeedback" class="copy-toast" role="status">
              <svg class="toast-check-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span>{{ copyFeedback }}</span>
            </div>
          </transition>

          <!-- Call to action: Challenge & Play -->
          <div class="cta-divider" />
          <div class="challenge-cta">
            <p class="cta-text">
              Bạn có thể vượt qua kỷ lục của <strong>{{ profile.displayName }}</strong> không?
            </p>
            <NuxtLink to="/" class="theme-btn-primary play-now-btn">
              <svg class="play-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              <span>Chơi Thử Ngay Trong 30 Giây</span>
            </NuxtLink>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
/* ==========================================================================
   GLOBAL LAYOUT & BASE SHARE STYLES
   ========================================================================== */
.share-page-container {
  min-height: calc(100vh - 70px);
  padding: 2.5rem 1.25rem 4rem;
  background: radial-gradient(circle at 50% 15%, rgba(6, 182, 212, 0.1) 0%, transparent 65%);
  transition: background 0.3s ease;
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
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.2s ease;
}

.back-icon {
  transition: transform 0.2s ease;
}

.back-link:hover .back-icon {
  transform: translateX(-3px);
}

.honor-card-section {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

/* Base Holographic Card Styling */
.honor-holo-card {
  position: relative;
  overflow: hidden;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease, border-color 0.3s ease;
}

.honor-holo-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: -120%;
  width: 50%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.12) 50%,
    transparent 100%
  );
  transform: skewX(-25deg);
  pointer-events: none;
  transition: left 0.85s ease;
}

.honor-holo-card:hover::after {
  left: 150%;
}

.honor-holo-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  z-index: 2;
}

.card-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  position: relative;
  z-index: 1;
}

.brand-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.85rem;
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.track-tag {
  font-size: 0.8125rem;
  font-weight: 800;
  padding: 0.35rem 0.85rem;
  border-radius: 9999px;
}

.card-hero-body {
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 2.25rem;
  position: relative;
  z-index: 1;
}

.avatar-ring-container {
  position: relative;
  flex-shrink: 0;
}

.avatar-halo {
  width: 104px;
  height: 104px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease;
}

.honor-holo-card:hover .avatar-halo {
  transform: scale(1.05);
}

.avatar-emoji {
  font-size: 3rem;
  line-height: 1;
}

.level-badge {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.75rem;
  font-weight: 900;
  padding: 0.18rem 0.7rem;
  border-radius: 9999px;
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
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-weight: 800;
}

.player-name {
  margin: 0;
  font-size: 2rem;
  font-weight: 900;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.honor-caption {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.5;
}

/* Stats Grid */
.card-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  position: relative;
  z-index: 1;
}

.stat-box {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1.125rem 1.25rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-box:hover {
  transform: translateY(-2px);
}

.stat-icon {
  font-size: 1.75rem;
  flex-shrink: 0;
  line-height: 1;
}

.stat-meta {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.35rem;
  font-weight: 900;
  line-height: 1.2;
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-top: 0.15rem;
}

/* Share Actions Card */
.share-actions-card {
  padding: 2.25rem 2rem;
  text-align: center;
  transition: box-shadow 0.3s ease;
}

.actions-title {
  margin: 0 0 0.5rem 0;
  font-size: 1.375rem;
  font-weight: 900;
  letter-spacing: -0.01em;
}

.actions-subtitle {
  margin: 0 0 1.5rem 0;
  font-size: 0.9375rem;
  line-height: 1.5;
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
  gap: 0.6rem;
  padding: 0.75rem 1.35rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 800;
  cursor: pointer;
  border: 1px solid transparent;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
}

.social-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.social-svg-icon {
  flex-shrink: 0;
}

.fb-btn {
  background: #1877f2;
  color: #ffffff;
}

.zalo-btn {
  background: #0068ff;
  color: #ffffff;
}

.copy-toast {
  margin-top: 0.875rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.15rem;
  border-radius: 9999px;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.4);
  color: #10b981;
  font-size: 0.8125rem;
  font-weight: 800;
}

.toast-check-icon {
  stroke: #10b981;
}

.cta-divider {
  height: 1px;
  margin: 1.85rem 0;
}

.challenge-cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.cta-text {
  margin: 0;
  font-size: 1rem;
}

.play-now-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 2.25rem;
  font-size: 1.05rem;
  font-weight: 800;
  text-decoration: none;
  border-radius: 9999px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.play-icon {
  flex-shrink: 0;
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

/* ==========================================================================
   1. UNIVERSE 1: ĐẢO THẦN THOẠI (kids) - Radiant Fantasy Sunstone Parchment
   ========================================================================== */
html[data-theme="kids"] .share-page-container {
  background: radial-gradient(circle at 50% 12%, rgba(245, 158, 11, 0.16) 0%, rgba(254, 243, 199, 0.3) 40%, transparent 75%);
}

html[data-theme="kids"] .back-link {
  color: #78350f;
  font-weight: 800;
}

html[data-theme="kids"] .back-link:hover {
  color: #d97706;
}

/* Card in Kids theme OR when card's track is kids */
html[data-theme="kids"] .honor-holo-card,
.honor-holo-card[data-track="kids"] {
  border-radius: 24px;
  padding: 2.5rem 2.25rem;
  background: linear-gradient(145deg, #ffffff 0%, #fffdf5 45%, #fef3c7 100%);
  border: 2px solid #fcd34d;
  box-shadow: 0 18px 42px rgba(245, 158, 11, 0.16), 0 0 35px rgba(251, 191, 36, 0.2), inset 0 1px 0 #ffffff;
}

html[data-theme="kids"] .honor-holo-card:hover,
.honor-holo-card[data-track="kids"]:hover {
  box-shadow: 0 22px 50px rgba(245, 158, 11, 0.22), 0 0 45px rgba(251, 191, 36, 0.3);
}

html[data-theme="kids"] .honor-holo-card::before,
.honor-holo-card[data-track="kids"]::before {
  background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 35%, #10b981 70%, #ec4899 100%);
}

html[data-theme="kids"] .brand-pill,
.honor-holo-card[data-track="kids"] .brand-pill {
  background: #fef3c7;
  border: 1.5px solid #fcd34d;
  color: #b45309;
  box-shadow: 0 2px 6px rgba(245, 158, 11, 0.12);
}

html[data-theme="kids"] .track-tag,
.honor-holo-card[data-track="kids"] .track-tag {
  background: #ffffff;
  border: 1.5px solid #fde68a;
  color: #78350f;
  box-shadow: 0 2px 6px rgba(245, 158, 11, 0.08);
}

html[data-theme="kids"] .avatar-halo,
.honor-holo-card[data-track="kids"] .avatar-halo {
  background: linear-gradient(135deg, #ffffff 0%, #fffbeb 50%, #fef3c7 100%);
  border: 3.5px solid #f59e0b;
  box-shadow: 0 0 24px rgba(245, 158, 11, 0.35), 0 4px 14px rgba(180, 83, 9, 0.15);
}

html[data-theme="kids"] .level-badge,
.honor-holo-card[data-track="kids"] .level-badge {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border: 2px solid #ffffff;
  color: #ffffff;
  box-shadow: 0 3px 8px rgba(180, 83, 9, 0.35);
}

html[data-theme="kids"] .equipped-title-badge,
.honor-holo-card[data-track="kids"] .equipped-title-badge {
  background: #fef3c7;
  border: 1.5px solid #fcd34d;
  color: #92400e;
}

html[data-theme="kids"] .player-name,
.honor-holo-card[data-track="kids"] .player-name {
  color: #3b1d07 !important;
  text-shadow: 0 1px 2px rgba(245, 158, 11, 0.12);
}

html[data-theme="kids"] .honor-caption,
.honor-holo-card[data-track="kids"] .honor-caption {
  color: #78350f !important;
}

html[data-theme="kids"] .stat-box,
.honor-holo-card[data-track="kids"] .stat-box {
  background: #ffffff;
  border: 1.5px solid #fde68a;
  border-radius: 18px;
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.08);
}

html[data-theme="kids"] .stat-label,
.honor-holo-card[data-track="kids"] .stat-label {
  color: #92400e;
}

html[data-theme="kids"] .streak-box .stat-value,
.honor-holo-card[data-track="kids"] .streak-box .stat-value {
  color: #ea580c;
}

html[data-theme="kids"] .exp-box .stat-value,
.honor-holo-card[data-track="kids"] .exp-box .stat-value {
  color: #0284c7;
}

html[data-theme="kids"] .cards-box .stat-value,
.honor-holo-card[data-track="kids"] .cards-box .stat-value {
  color: #7c3aed;
}

html[data-theme="kids"] .share-actions-card {
  border-radius: 24px;
  background: #ffffff;
  border: 1.5px solid #fde68a;
  box-shadow: 0 12px 32px rgba(245, 158, 11, 0.1);
}

html[data-theme="kids"] .actions-title {
  color: #3b1d07;
}

html[data-theme="kids"] .actions-subtitle {
  color: #78350f;
}

html[data-theme="kids"] .copy-btn {
  background: #fffbeb;
  border: 1.5px solid #fde68a;
  color: #78350f;
}

html[data-theme="kids"] .copy-btn:hover {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #3b1d07;
}

html[data-theme="kids"] .cta-divider {
  background: #fde68a;
}

html[data-theme="kids"] .cta-text {
  color: #78350f;
}

html[data-theme="kids"] .play-now-btn {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #ffffff;
  box-shadow: 0 4px 0 #b45309, 0 8px 20px rgba(245, 158, 11, 0.35);
}

html[data-theme="kids"] .play-now-btn:hover {
  box-shadow: 0 6px 0 #b45309, 0 10px 24px rgba(245, 158, 11, 0.45);
}

html[data-theme="kids"] .play-now-btn:active {
  transform: translateY(2px);
  box-shadow: 0 2px 0 #b45309;
}

/* ==========================================================================
   2. UNIVERSE 2: CYBER CITY (teens) - Cyberpunk Holographic Dark Card
   ========================================================================== */
html[data-theme="teens"] .share-page-container {
  background: radial-gradient(circle at 50% 15%, rgba(6, 182, 212, 0.12) 0%, transparent 65%);
}

html[data-theme="teens"] .back-link {
  color: #94a3b8;
}

html[data-theme="teens"] .back-link:hover {
  color: #06b6d4;
}

/* Card in Teens theme OR when card's track is teens */
html[data-theme="teens"] .honor-holo-card,
.honor-holo-card[data-track="teens"] {
  border-radius: 14px;
  padding: 2.5rem 2rem;
  background: linear-gradient(145deg, #141e33 0%, rgba(15, 23, 42, 0.98) 100%);
  border: 1px solid rgba(6, 182, 212, 0.35);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6), 0 0 35px rgba(6, 182, 212, 0.18);
}

html[data-theme="teens"] .honor-holo-card:hover,
.honor-holo-card[data-track="teens"]:hover {
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.7), 0 0 45px rgba(6, 182, 212, 0.3);
}

html[data-theme="teens"] .honor-holo-card::before,
.honor-holo-card[data-track="teens"]::before {
  background: linear-gradient(90deg, #06b6d4, #3b82f6, #a855f7, #f43f5e);
}

html[data-theme="teens"] .brand-pill,
.honor-holo-card[data-track="teens"] .brand-pill {
  background: rgba(6, 182, 212, 0.12);
  border: 1px solid rgba(6, 182, 212, 0.35);
  color: #22d3ee;
  box-shadow: 0 0 15px rgba(6, 182, 212, 0.2);
}

html[data-theme="teens"] .track-tag,
.honor-holo-card[data-track="teens"] .track-tag {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(6, 182, 212, 0.25);
  color: #94a3b8;
}

html[data-theme="teens"] .avatar-halo,
.honor-holo-card[data-track="teens"] .avatar-halo {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border: 3px solid #06b6d4;
  box-shadow: 0 0 24px rgba(6, 182, 212, 0.5);
}

html[data-theme="teens"] .level-badge,
.honor-holo-card[data-track="teens"] .level-badge {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border: 2px solid #ffffff;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
}

html[data-theme="teens"] .equipped-title-badge,
.honor-holo-card[data-track="teens"] .equipped-title-badge {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.4);
  color: #fbbf24;
}

html[data-theme="teens"] .player-name,
.honor-holo-card[data-track="teens"] .player-name {
  color: #f8fafc !important;
  text-shadow: 0 0 20px rgba(6, 182, 212, 0.25);
}

html[data-theme="teens"] .honor-caption,
.honor-holo-card[data-track="teens"] .honor-caption {
  color: #94a3b8 !important;
}

html[data-theme="teens"] .stat-box,
.honor-holo-card[data-track="teens"] .stat-box {
  background: rgba(20, 30, 51, 0.65);
  border: 1px solid rgba(6, 182, 212, 0.25);
  border-radius: 10px;
}

html[data-theme="teens"] .stat-label,
.honor-holo-card[data-track="teens"] .stat-label {
  color: #64748b;
}

html[data-theme="teens"] .streak-box .stat-value,
.honor-holo-card[data-track="teens"] .streak-box .stat-value {
  color: #f97316;
}

html[data-theme="teens"] .exp-box .stat-value,
.honor-holo-card[data-track="teens"] .exp-box .stat-value {
  color: #06b6d4;
}

html[data-theme="teens"] .cards-box .stat-value,
.honor-holo-card[data-track="teens"] .cards-box .stat-value {
  color: #a855f7;
}

html[data-theme="teens"] .share-actions-card {
  border-radius: 14px;
  background: #131d31;
  border: 1px solid rgba(6, 182, 212, 0.25);
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.7);
}

html[data-theme="teens"] .actions-title {
  color: #f8fafc;
}

html[data-theme="teens"] .actions-subtitle {
  color: #94a3b8;
}

html[data-theme="teens"] .copy-btn {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(6, 182, 212, 0.3);
  color: #f8fafc;
}

html[data-theme="teens"] .copy-btn:hover {
  background: rgba(6, 182, 212, 0.15);
  border-color: #06b6d4;
}

html[data-theme="teens"] .cta-divider {
  background: rgba(6, 182, 212, 0.2);
}

html[data-theme="teens"] .cta-text {
  color: #94a3b8;
}

html[data-theme="teens"] .play-now-btn {
  background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #a855f7 100%);
  color: #04101c;
  box-shadow: 0 0 24px rgba(6, 182, 212, 0.5);
}

html[data-theme="teens"] .play-now-btn:hover {
  box-shadow: 0 0 35px rgba(6, 182, 212, 0.7);
  transform: translateY(-2px);
}

/* ==========================================================================
   3. UNIVERSE 3: SIMLIFE GLOBAL (adults) - Executive Platinum Card
   ========================================================================== */
html[data-theme="adults"] .share-page-container {
  background: radial-gradient(circle at 50% 12%, rgba(16, 185, 129, 0.1) 0%, rgba(14, 165, 233, 0.05) 40%, transparent 70%);
}

html[data-theme="adults"] .back-link {
  color: #475569;
  font-weight: 700;
}

html[data-theme="adults"] .back-link:hover {
  color: #0f172a;
}

/* Card in Adults theme OR when card's track is adults */
html[data-theme="adults"] .honor-holo-card,
.honor-holo-card[data-track="adults"] {
  border-radius: 16px;
  padding: 2.5rem 2.25rem;
  background: linear-gradient(145deg, #ffffff 0%, #f8fafc 45%, #f1f5f9 100%);
  border: 1.5px solid #cbd5e1;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08), 0 0 30px rgba(16, 185, 129, 0.12), inset 0 1px 0 #ffffff;
}

html[data-theme="adults"] .honor-holo-card:hover,
.honor-holo-card[data-track="adults"]:hover {
  box-shadow: 0 22px 48px rgba(15, 23, 42, 0.12), 0 0 38px rgba(16, 185, 129, 0.18);
}

html[data-theme="adults"] .honor-holo-card::before,
.honor-holo-card[data-track="adults"]::before {
  background: linear-gradient(90deg, #059669 0%, #0ea5e9 50%, #4f46e5 100%);
}

html[data-theme="adults"] .brand-pill,
.honor-holo-card[data-track="adults"] .brand-pill {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #059669;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.08);
}

html[data-theme="adults"] .track-tag,
.honor-holo-card[data-track="adults"] .track-tag {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #334155;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
}

html[data-theme="adults"] .avatar-halo,
.honor-holo-card[data-track="adults"] .avatar-halo {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #e2e8f0 100%);
  border: 3px solid #059669;
  box-shadow: 0 0 24px rgba(16, 185, 129, 0.25), 0 4px 12px rgba(15, 23, 42, 0.06);
}

html[data-theme="adults"] .level-badge,
.honor-holo-card[data-track="adults"] .level-badge {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  border: 2px solid #ffffff;
  color: #ffffff;
  box-shadow: 0 3px 8px rgba(4, 120, 87, 0.3);
}

html[data-theme="adults"] .equipped-title-badge,
.honor-holo-card[data-track="adults"] .equipped-title-badge {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #047857;
}

html[data-theme="adults"] .player-name,
.honor-holo-card[data-track="adults"] .player-name {
  color: #0f172a !important;
}

html[data-theme="adults"] .honor-caption,
.honor-holo-card[data-track="adults"] .honor-caption {
  color: #475569 !important;
}

html[data-theme="adults"] .stat-box,
.honor-holo-card[data-track="adults"] .stat-box {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
}

html[data-theme="adults"] .stat-label,
.honor-holo-card[data-track="adults"] .stat-label {
  color: #64748b;
}

html[data-theme="adults"] .streak-box .stat-value,
.honor-holo-card[data-track="adults"] .streak-box .stat-value {
  color: #ea580c;
}

html[data-theme="adults"] .exp-box .stat-value,
.honor-holo-card[data-track="adults"] .exp-box .stat-value {
  color: #0284c7;
}

html[data-theme="adults"] .cards-box .stat-value,
.honor-holo-card[data-track="adults"] .cards-box .stat-value {
  color: #059669;
}

html[data-theme="adults"] .share-actions-card {
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
}

html[data-theme="adults"] .actions-title {
  color: #0f172a;
}

html[data-theme="adults"] .actions-subtitle {
  color: #475569;
}

html[data-theme="adults"] .copy-btn {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  color: #0f172a;
}

html[data-theme="adults"] .copy-btn:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

html[data-theme="adults"] .cta-divider {
  background: #e2e8f0;
}

html[data-theme="adults"] .cta-text {
  color: #334155;
}

html[data-theme="adults"] .play-now-btn {
  background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #0369a1 100%);
  color: #ffffff;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.25);
}

html[data-theme="adults"] .play-now-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.35);
}

/* ==========================================================================
   TRANSITIONS & RESPONSIVE BREAKPOINTS
   ========================================================================== */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .share-page-container {
    padding: 1.5rem 1rem 3rem;
  }

  .honor-holo-card {
    padding: 2rem 1.25rem;
  }

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
    gap: 0.75rem;
  }

  .social-btn-group {
    flex-direction: column;
  }

  .social-btn {
    width: 100%;
    justify-content: center;
  }

  .play-now-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
