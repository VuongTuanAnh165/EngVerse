<script setup lang="ts">
import { computed } from 'vue';
import { useUserStore } from '~/stores/user';

const userStore = useUserStore();

const currentTrack = computed(() => userStore.currentTrack);
const collectedCardsCount = computed(() => userStore.user.collectedCards?.length || 0);

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
          <span>VŨ TRỤ ĐANG CHỌN: {{ currentTrack.toUpperCase() }}</span>
        </div>

        <h1 class="hero-title">
          Chinh Phục Ngôn Ngữ Bằng Phản Xạ Game
        </h1>

        <p class="hero-desc">
          Mỗi từ vựng bạn làm chủ sẽ hóa thành Thẻ Bài 3D gia tăng sức mạnh. Vượt qua 5 chặng
          để diện kiến Boss Ôn Tập và khẳng định vị thế trên Bảng Xếp Hạng toàn cầu!
        </p>

        <div class="hero-quick-stats">
          <div class="quick-stat-box">
            <span class="quick-stat-val">5</span>
            <span class="quick-stat-label">Chặng Thử Thách</span>
          </div>
          <div class="quick-stat-box">
            <span class="quick-stat-val">{{ collectedCardsCount }}/120</span>
            <span class="quick-stat-label">Thẻ Bài Đã Có</span>
          </div>
          <div class="quick-stat-box">
            <span class="quick-stat-val">1</span>
            <span class="quick-stat-label">Boss Ôn Tập</span>
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
  min-height: calc(100vh - 70px);
}

.universe-hero {
  background: linear-gradient(180deg, var(--bg-secondary) 0%, transparent 100%);
  padding: 2.5rem 1.25rem 1.5rem;
  text-align: center;
}

.hero-content {
  max-width: 760px;
  margin: 0 auto;
}

.hero-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-surface-translucent);
  border: 1px solid var(--border-color);
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-pill);
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--accent-primary);
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
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
  margin: 0 0 0.875rem 0;
  font-size: 2.25rem;
  font-weight: 900;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.hero-desc {
  margin: 0 0 1.5rem 0;
  font-size: 1rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.hero-quick-stats {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.quick-stat-box {
  background: var(--bg-surface-translucent);
  border: 1px solid var(--border-color);
  padding: 0.5rem 1.25rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.quick-stat-val {
  font-size: 1.25rem;
  font-weight: 900;
  color: var(--text-primary);
}

.quick-stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .hero-title {
    font-size: 1.75rem;
  }
  .hero-quick-stats {
    gap: 0.75rem;
  }
  .quick-stat-box {
    padding: 0.4rem 0.85rem;
  }
}
</style>

