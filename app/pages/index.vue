<script setup lang="ts">
import { computed } from 'vue';
import { useUserStore } from '~/stores/user';

const userStore = useUserStore();

const currentTrack = computed(() => userStore.currentTrack);
const collectedCardsCount = computed(() => userStore.user.collectedCards?.length || 0);

const trackDisplay = computed(() => {
  switch (currentTrack.value) {
    case 'kids':
      return { name: 'Đảo Thần Thoại', badge: 'KIDS (5-12T)' };
    case 'teens':
      return { name: 'Cyber City', badge: 'TEENS (13-22T)' };
    case 'adults':
      return { name: 'SimLife Global', badge: 'ADULTS (23+)' };
    default:
      return { name: 'Đa Vũ Trụ', badge: 'ALL' };
  }
});

useHead({
  title: 'Bản Đồ Thế Giới - EngVerse',
  meta: [
    {
      name: 'description',
      content: 'Chinh phục các chặng thử thách tiếng Anh trên Bản Đồ Đa Vũ Trụ EngVerse.',
    },
  ],
});
</script>

<template>
  <main class="home-page-container">
    <!-- Universe Hero Banner -->
    <section class="universe-hero">
      <div class="hero-content">
        <div class="hero-tag">
          <span class="pulse-dot" />
          <span>VŨ TRỤ: {{ trackDisplay.name.toUpperCase() }} ({{ trackDisplay.badge }})</span>
        </div>

        <h1 class="hero-title">
          Chinh Phục Ngôn Ngữ Bằng Phản Xạ Game
        </h1>

        <p class="hero-desc">
          Mỗi từ vựng bạn làm chủ sẽ hóa thành Thẻ Bài 3D gia tăng sức mạnh. Vượt qua 5 chặng
          để diện kiến Boss Ôn Tập và khẳng định vị thế trên Bảng Xếp Hạng toàn cầu!
        </p>

        <div class="hero-quick-stats">
          <div class="quick-stat-box theme-card">
            <span class="quick-stat-icon" aria-hidden="true">🗺️</span>
            <div class="quick-stat-info">
              <span class="quick-stat-val">5</span>
              <span class="quick-stat-label">Chặng Thử Thách</span>
            </div>
          </div>

          <div class="quick-stat-box theme-card">
            <span class="quick-stat-icon" aria-hidden="true">🃏</span>
            <div class="quick-stat-info">
              <span class="quick-stat-val">{{ collectedCardsCount }}/120</span>
              <span class="quick-stat-label">Thẻ Bài Đã Có</span>
            </div>
          </div>

          <div class="quick-stat-box theme-card">
            <span class="quick-stat-icon" aria-hidden="true">👑</span>
            <div class="quick-stat-info">
              <span class="quick-stat-val">1 Boss</span>
              <span class="quick-stat-label">Thử Thách Cuối</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Interactive Stage Map -->
    <WorldMap />
  </main>
</template>

<style scoped>
.home-page-container {
  min-height: calc(100vh - 65px);
  padding-bottom: 2rem;
}

.universe-hero {
  background: linear-gradient(180deg, var(--bg-secondary) 0%, transparent 100%);
  padding: 2.25rem 1rem 1.25rem;
  text-align: center;
}

.hero-content {
  max-width: 800px;
  margin: 0 auto;
}

.hero-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-surface-translucent);
  border: 1px solid var(--border-color);
  padding: 0.3rem 0.85rem;
  border-radius: var(--radius-pill);
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--accent-primary);
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
  box-shadow: var(--shadow-sm);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 6px #10b981;
  animation: pulse-green 1.5s infinite ease-in-out;
}

@keyframes pulse-green {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.hero-title {
  margin: 0 0 0.75rem 0;
  font-size: 2.25rem;
  font-weight: 900;
  line-height: 1.25;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.hero-desc {
  margin: 0 auto 1.5rem auto;
  max-width: 680px;
  font-size: 1rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.hero-quick-stats {
  display: flex;
  justify-content: center;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.quick-stat-box {
  background: var(--bg-surface);
  border: 1.5px solid var(--border-color);
  padding: 0.6rem 1.25rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.quick-stat-box:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--border-focus);
}

.quick-stat-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.quick-stat-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.quick-stat-val {
  font-size: 1.15rem;
  font-weight: 900;
  color: var(--text-primary);
  line-height: 1.2;
}

.quick-stat-label {
  font-size: 0.725rem;
  font-weight: 700;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .universe-hero {
    padding: 1.5rem 0.75rem 1rem;
  }
  .hero-title {
    font-size: 1.65rem;
  }
  .hero-desc {
    font-size: 0.9rem;
    margin-bottom: 1.25rem;
  }
  .hero-quick-stats {
    gap: 0.5rem;
  }
  .quick-stat-box {
    padding: 0.45rem 0.85rem;
    gap: 0.5rem;
  }
  .quick-stat-icon {
    font-size: 1.25rem;
  }
  .quick-stat-val {
    font-size: 1rem;
  }
}
</style>
