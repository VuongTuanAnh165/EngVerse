<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAdmin } from '~/composables/useAdmin';

definePageMeta({
  layout: false,
});

const route = useRoute();
const { login } = useAdmin();

const adminKey = ref('');
const showPassword = ref(false);
const isLoading = ref(false);
const errorMessage = ref('');

async function handleLogin() {
  if (!adminKey.value.trim()) {
    errorMessage.value = 'Vui lòng nhập mã khóa Quản trị viên.';
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';

  try {
    const res = await login(adminKey.value);
    if (res.success) {
      const redirectPath = (route.query.redirect as string) || '/admin';
      navigateTo(redirectPath);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Mã khóa không chính xác.';
    errorMessage.value = msg.includes('401')
      ? 'Mã khóa Quản trị viên không chính xác. Vui lòng kiểm tra lại.'
      : msg;
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="admin-login-wrapper">
    <div class="login-card">
      <div class="card-glow"></div>
      
      <div class="login-header">
        <div class="icon-orb">🔐</div>
        <h1>EngVerse CMS</h1>
        <p>Cổng Quản Trị Hệ Thống Đa Vũ Trụ</p>
      </div>

      <form class="login-form" @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="adminKey">Mã Khóa Bí Mật (Master Admin Key)</label>
          <div class="input-container">
            <input
              id="adminKey"
              v-model="adminKey"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Nhập ADMIN_SECRET_KEY..."
              autocomplete="current-password"
              :disabled="isLoading"
              autofocus
            />
            <button
              type="button"
              class="toggle-eye-btn"
              @click="showPassword = !showPassword"
              tabindex="-1"
            >
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
          <span class="hint">Khóa mặc định trong .env: engverse_master_admin_2026</span>
        </div>

        <div v-if="errorMessage" class="error-banner">
          <span>⚠️</span>
          <span>{{ errorMessage }}</span>
        </div>

        <button type="submit" class="submit-btn" :disabled="isLoading">
          <span v-if="isLoading" class="spinner"></span>
          <span>{{ isLoading ? 'Đang mở khóa...' : 'Mở Khóa Quản Trị' }}</span>
        </button>

        <NuxtLink to="/" class="back-link">
          ← Quay lại trang chủ EngVerse
        </NuxtLink>
      </form>
    </div>
  </div>
</template>

<style scoped>
.admin-login-wrapper {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 20%, #1e1b4b 0%, #07090e 70%);
  padding: 20px;
  font-family: 'Be Vietnam Pro', sans-serif;
  box-sizing: border-box;
}

.login-card {
  position: relative;
  width: 100%;
  max-width: 440px;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: 20px;
  padding: 36px 32px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.1);
  box-sizing: border-box;
}

.card-glow {
  position: absolute;
  top: -2px;
  left: 20%;
  right: 20%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #38bdf8, transparent);
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.icon-orb {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.3);
  font-size: 32px;
  margin-bottom: 16px;
  box-shadow: 0 0 20px rgba(56, 189, 248, 0.2);
}

.login-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: #f8fafc;
  letter-spacing: -0.02em;
}

.login-header p {
  margin: 6px 0 0 0;
  font-size: 13px;
  color: #94a3b8;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: #cbd5e1;
}

.input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.input-container input {
  width: 100%;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 12px 44px 12px 14px;
  color: #fff;
  font-size: 14px;
  transition: all 0.2s;
  box-sizing: border-box;
}

.input-container input:focus {
  outline: none;
  border-color: #38bdf8;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
  background: rgba(30, 41, 59, 0.9);
}

.toggle-eye-btn {
  position: absolute;
  right: 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 16px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.toggle-eye-btn:hover {
  opacity: 1;
}

.hint {
  font-size: 11px;
  color: #64748b;
  font-style: italic;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
}

.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, #0284c7, #6366f1);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 14px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 15px rgba(2, 132, 199, 0.3);
}

.submit-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #0369a1, #4f46e5);
  box-shadow: 0 6px 20px rgba(2, 132, 199, 0.45);
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.back-link {
  text-align: center;
  color: #94a3b8;
  text-decoration: none;
  font-size: 13px;
  transition: color 0.2s;
}

.back-link:hover {
  color: #38bdf8;
}
</style>

