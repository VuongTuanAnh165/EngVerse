<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAdmin } from '~/composables/useAdmin';
import type { StageData, CodexData } from '~/types/game';

definePageMeta({
  layout: 'admin',
  middleware: 'admin-auth',
});

const { getStages, getCodex, exportData } = useAdmin();

const isLoading = ref(true);
const kidsStages = ref<StageData[]>([]);
const teensStages = ref<StageData[]>([]);
const adultsStages = ref<StageData[]>([]);
const codexData = ref<CodexData | null>(null);

async function loadDashboardData() {
  isLoading.value = true;
  try {
    const [kids, teens, adults, codex] = await Promise.all([
      getStages('kids'),
      getStages('teens'),
      getStages('adults'),
      getCodex(),
    ]);

    kidsStages.value = kids;
    teensStages.value = teens;
    adultsStages.value = adults;
    codexData.value = codex;
  } catch (err) {
    console.error('[AdminDashboard] Load error:', err);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadDashboardData();
});
</script>

<template>
  <div class="admin-page-container">
    <!-- Top Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Bảng Điều Khiển Tổng Quan</h1>
        <p class="page-desc">Thống kê hệ thống nội dung 3 vũ trụ và bộ thẻ bài Codex</p>
      </div>
      <div class="header-actions">
        <NuxtLink to="/admin/stages/new" class="btn btn-primary">
          <span>✨</span>
          <span>Tạo Chặng Mới</span>
        </NuxtLink>
        <button class="btn btn-secondary" @click="loadDashboardData" :disabled="isLoading">
          <span>🔄</span>
          <span>Làm Mới</span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner-large"></div>
      <p>Đang tải dữ liệu đa vũ trụ...</p>
    </div>

    <!-- Content State -->
    <div v-else class="dashboard-content">
      <!-- 4 Stats Cards Grid -->
      <div class="stats-grid">
        <!-- Kids Card -->
        <div class="stat-card track-kids">
          <div class="stat-icon-wrapper">🎈</div>
          <div class="stat-body">
            <span class="stat-label">Đảo Thần Thoại (Kids)</span>
            <div class="stat-value">
              <span>{{ kidsStages.length }}</span>
              <span class="stat-unit">chặng</span>
            </div>
            <span class="stat-sub">
              {{ kidsStages.reduce((acc, s) => acc + (s.vocabPool?.length || 0), 0) }} từ vựng hoạt hình
            </span>
          </div>
          <NuxtLink to="/admin/stages?track=kids" class="card-link">
            Xem danh sách →
          </NuxtLink>
        </div>

        <!-- Teens Card -->
        <div class="stat-card track-teens">
          <div class="stat-icon-wrapper">⚡</div>
          <div class="stat-body">
            <span class="stat-label">Cyber City (Teens)</span>
            <div class="stat-value">
              <span>{{ teensStages.length }}</span>
              <span class="stat-unit">chặng</span>
            </div>
            <span class="stat-sub">
              {{ teensStages.reduce((acc, s) => acc + (s.vocabPool?.length || 0), 0) }} từ vựng khoa học viễn tưởng
            </span>
          </div>
          <NuxtLink to="/admin/stages?track=teens" class="card-link">
            Xem danh sách →
          </NuxtLink>
        </div>

        <!-- Adults Card -->
        <div class="stat-card track-adults">
          <div class="stat-icon-wrapper">🏢</div>
          <div class="stat-body">
            <span class="stat-label">SimLife Global (Adults)</span>
            <div class="stat-value">
              <span>{{ adultsStages.length }}</span>
              <span class="stat-unit">chặng</span>
            </div>
            <span class="stat-sub">
              {{ adultsStages.reduce((acc, s) => acc + (s.vocabPool?.length || 0), 0) }} từ vựng công sở thực tế
            </span>
          </div>
          <NuxtLink to="/admin/stages?track=adults" class="card-link">
            Xem danh sách →
          </NuxtLink>
        </div>

        <!-- Codex Card -->
        <div class="stat-card track-codex">
          <div class="stat-icon-wrapper">🎴</div>
          <div class="stat-body">
            <span class="stat-label">Bộ Thẻ Bài Codex</span>
            <div class="stat-value">
              <span>{{ codexData?.cards?.length || 0 }}</span>
              <span class="stat-unit">thẻ bài</span>
            </div>
            <span class="stat-sub">
              {{ codexData?.collections?.length || 0 }} bộ sưu tập • {{ codexData?.titles?.length || 0 }} danh hiệu
            </span>
          </div>
          <NuxtLink to="/admin/codex" class="card-link">
            Mở Codex 3D →
          </NuxtLink>
        </div>
      </div>

      <!-- Quick Actions & System Info -->
      <div class="dashboard-columns">
        <!-- Left: Quick Navigation Panels -->
        <div class="panel-box">
          <h2 class="panel-title">Lối Tắt Thao Tác Nhanh</h2>
          <div class="action-tiles-grid">
            <NuxtLink to="/admin/stages/new?track=kids" class="tile-item">
              <span class="tile-icon">🎈</span>
              <div class="tile-info">
                <span class="tile-title">Thêm Chặng Kids</span>
                <span class="tile-desc">Soạn bài cho Đảo Thần Thoại</span>
              </div>
            </NuxtLink>

            <NuxtLink to="/admin/stages/new?track=teens" class="tile-item">
              <span class="tile-icon">⚡</span>
              <div class="tile-info">
                <span class="tile-title">Thêm Chặng Teens</span>
                <span class="tile-desc">Soạn bài Cyber City Hacker</span>
              </div>
            </NuxtLink>

            <NuxtLink to="/admin/stages/new?track=adults" class="tile-item">
              <span class="tile-icon">🏢</span>
              <div class="tile-info">
                <span class="tile-title">Thêm Chặng Adults</span>
                <span class="tile-desc">Soạn bài Giao tiếp Công sở</span>
              </div>
            </NuxtLink>

            <NuxtLink to="/admin/backups" class="tile-item">
              <span class="tile-icon">💾</span>
              <div class="tile-info">
                <span class="tile-title">Lịch Sử Snapshot</span>
                <span class="tile-desc">Phục hồi dữ liệu 1-Click</span>
              </div>
            </NuxtLink>
          </div>
        </div>

        <!-- Right: Storage & Zero Quota Architecture Status -->
        <div class="panel-box system-status">
          <h2 class="panel-title">Kiến Trúc & Trạng Thái</h2>
          <div class="status-list">
            <div class="status-row">
              <span class="status-name">Cơ Chế Lưu Trữ:</span>
              <span class="status-badge badge-green">Static JSON (0 Firebase Read)</span>
            </div>
            <div class="status-row">
              <span class="status-name">Bộ Đệm CDN:</span>
              <span class="status-badge badge-blue">Edge CDN 24 Giờ Cache</span>
            </div>
            <div class="status-row">
              <span class="status-name">Bảo Mật Ghi File:</span>
              <span class="status-badge badge-purple">Atomic Temp Write & Snapshot</span>
            </div>
            <div class="status-row">
              <span class="status-name">Tự Động Đồng Bộ Thẻ:</span>
              <span class="status-badge badge-green">Auto-Sync Codex Bật</span>
            </div>
            <div class="status-row">
              <span class="status-name">Mô Hình AI Soạn Bài:</span>
              <span class="status-badge badge-yellow">Gemini 3.1 Pro + Groq Fallback</span>
            </div>
          </div>

          <div class="status-footer">
            <button class="btn btn-block btn-secondary" @click="exportData">
              <span>📥</span>
              <span>Tải Bản Sao Lưu JSON Toàn Bộ</span>
            </button>
          </div>
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
  margin-bottom: 28px;
  gap: 16px;
}

.page-title {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  color: #f8fafc;
  letter-spacing: -0.02em;
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

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  text-decoration: none;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #0284c7, #6366f1);
  color: #fff;
  box-shadow: 0 4px 15px rgba(2, 132, 199, 0.3);
}

.btn-primary:hover {
  background: linear-gradient(135deg, #0369a1, #4f46e5);
  transform: translateY(-1px);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.12);
}

.btn-block {
  width: 100%;
  justify-content: center;
}

/* Loading */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: #94a3b8;
}

.spinner-large {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  position: relative;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: all 0.25s;
}

.stat-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.18);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
}

.track-kids {
  border-top: 3px solid #f59e0b;
}

.track-teens {
  border-top: 3px solid #8b5cf6;
}

.track-adults {
  border-top: 3px solid #3b82f6;
}

.track-codex {
  border-top: 3px solid #ec4899;
}

.stat-icon-wrapper {
  font-size: 28px;
}

.stat-body {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 13px;
  color: #94a3b8;
  font-weight: 600;
}

.stat-value {
  font-size: 32px;
  font-weight: 800;
  color: #f8fafc;
  line-height: 1.1;
  margin: 6px 0 4px 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.stat-unit {
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
}

.stat-sub {
  font-size: 12px;
  color: #64748b;
}

.card-link {
  font-size: 13px;
  font-weight: 600;
  color: #38bdf8;
  text-decoration: none;
  margin-top: auto;
}

.card-link:hover {
  text-decoration: underline;
}

/* 2 Columns */
.dashboard-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

@media (max-width: 1000px) {
  .dashboard-columns {
    grid-template-columns: 1fr;
  }
}

.panel-box {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 24px;
}

.panel-title {
  margin: 0 0 20px 0;
  font-size: 17px;
  font-weight: 700;
  color: #f1f5f9;
}

.action-tiles-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.tile-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 14px;
  text-decoration: none;
  transition: all 0.2s;
}

.tile-item:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(56, 189, 248, 0.3);
  transform: translateY(-1px);
}

.tile-icon {
  font-size: 24px;
}

.tile-info {
  display: flex;
  flex-direction: column;
}

.tile-title {
  font-size: 13px;
  font-weight: 700;
  color: #f1f5f9;
}

.tile-desc {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}

/* System Status List */
.status-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 13px;
}

.status-name {
  color: #94a3b8;
}

.status-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 9999px;
}

.badge-green {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.badge-blue {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
}

.badge-purple {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.3);
}

.badge-yellow {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}
</style>

