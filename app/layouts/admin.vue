<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAdmin } from '~/composables/useAdmin';

const route = useRoute();
const { logout, exportData } = useAdmin();

const isMobileMenuOpen = ref(false);
const isExporting = ref(false);

const navItems = [
  {
    path: '/admin',
    label: 'Tổng Quan',
    icon: '📊',
    exact: true,
  },
  {
    path: '/admin/stages',
    label: 'Quản Lý Chặng',
    icon: '🗺️',
    exact: false,
  },
  {
    path: '/admin/codex',
    label: 'Thẻ Bài Codex',
    icon: '🎴',
    exact: false,
  },
  {
    path: '/admin/backups',
    label: 'Sao Lưu & Khôi Phục',
    icon: '💾',
    exact: false,
  },
];

function isActive(item: { path: string; exact: boolean }) {
  if (item.exact) {
    return route.path === item.path;
  }
  return route.path.startsWith(item.path);
}

async function handleExport() {
  try {
    isExporting.value = true;
    await exportData();
  } catch (err) {
    alert('Xuất dữ liệu thất bại: ' + (err instanceof Error ? err.message : String(err)));
  } finally {
    isExporting.value = false;
  }
}
</script>

<template>
  <div class="admin-layout-root">
    <!-- Mobile Header -->
    <header class="admin-mobile-header">
      <div class="brand">
        <span class="brand-logo">⚡</span>
        <span class="brand-name">EngVerse CMS</span>
      </div>
      <button class="mobile-toggle-btn" @click="isMobileMenuOpen = !isMobileMenuOpen">
        {{ isMobileMenuOpen ? '✕' : '☰' }}
      </button>
    </header>

    <!-- Sidebar Backdrop for Mobile -->
    <div
      v-if="isMobileMenuOpen"
      class="sidebar-backdrop"
      @click="isMobileMenuOpen = false"
    ></div>

    <!-- Main Sidebar -->
    <aside class="admin-sidebar" :class="{ 'is-open': isMobileMenuOpen }">
      <div class="sidebar-header">
        <div class="logo-box">
          <span class="logo-icon">🪐</span>
          <div class="logo-text">
            <span class="title">EngVerse</span>
            <span class="subtitle">Master Admin CMS</span>
          </div>
        </div>
        <div class="env-tag">
          <span class="status-dot"></span>
          <span>DEV MODE • ACTIVE</span>
        </div>
      </div>

      <!-- Navigation Links -->
      <nav class="sidebar-nav">
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-link"
          :class="{ active: isActive(item) }"
          @click="isMobileMenuOpen = false"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <!-- Sidebar Footer -->
      <div class="sidebar-footer">
        <button
          class="action-btn export-btn"
          :disabled="isExporting"
          @click="handleExport"
        >
          <span>📥</span>
          <span>{{ isExporting ? 'Đang xuất...' : 'Sao Lưu JSON (.zip)' }}</span>
        </button>

        <NuxtLink to="/" target="_blank" class="action-btn play-btn">
          <span>🎮</span>
          <span>Vào Game Thử</span>
        </NuxtLink>

        <button class="action-btn logout-btn" @click="logout">
          <span>🚪</span>
          <span>Đăng Xuất</span>
        </button>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="admin-main-container">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.admin-layout-root {
  min-height: 100vh;
  display: flex;
  background-color: #07090e;
  color: #e2e8f0;
  font-family: 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* Mobile Header */
.admin-mobile-header {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: rgba(11, 15, 25, 0.95);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0 16px;
  align-items: center;
  justify-content: space-between;
  z-index: 100;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: #38bdf8;
}

.mobile-toggle-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 20px;
  padding: 4px 10px;
  border-radius: 8px;
  cursor: pointer;
}

/* Sidebar */
.admin-sidebar {
  width: 260px;
  background: #0b0f19;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  flex-shrink: 0;
  z-index: 90;
}

.sidebar-header {
  padding: 24px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.logo-box {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 28px;
}

.logo-text {
  display: flex;
  flex-direction: column;
}

.logo-text .title {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #38bdf8, #818cf8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.logo-text .subtitle {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.env-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 9999px;
  margin-top: 12px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

/* Nav */
.sidebar-nav {
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  color: #94a3b8;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  border-radius: 10px;
  transition: all 0.2s ease;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #f1f5f9;
}

.nav-link.active {
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(129, 140, 248, 0.15));
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
  font-weight: 700;
}

.nav-icon {
  font-size: 18px;
}

/* Footer buttons */
.sidebar-footer {
  padding: 16px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  text-decoration: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.export-btn {
  background: rgba(56, 189, 248, 0.1);
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.2);
}

.export-btn:hover:not(:disabled) {
  background: rgba(56, 189, 248, 0.2);
}

.play-btn {
  background: rgba(168, 85, 247, 0.1);
  color: #c084fc;
  border-color: rgba(168, 85, 247, 0.2);
}

.play-btn:hover {
  background: rgba(168, 85, 247, 0.2);
}

.logout-btn {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.2);
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}

/* Main Container */
.admin-main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow-x: hidden;
}

/* Responsive */
@media (max-width: 900px) {
  .admin-mobile-header {
    display: flex;
  }

  .admin-sidebar {
    position: fixed;
    top: 60px;
    bottom: 0;
    left: 0;
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 10px 0 30px rgba(0, 0, 0, 0.5);
  }

  .admin-sidebar.is-open {
    transform: translateX(0);
  }

  .sidebar-backdrop {
    position: fixed;
    inset: 60px 0 0 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 80;
  }

  .admin-main-container {
    margin-top: 60px;
  }
}
</style>

<style>
@import '~/assets/css/admin.css';
</style>

