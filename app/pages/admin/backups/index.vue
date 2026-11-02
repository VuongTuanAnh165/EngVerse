<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAdmin } from '~/composables/useAdmin';
import type { AdminBackupFileInfo } from '~/types/admin';

definePageMeta({
  layout: 'admin',
  middleware: 'admin-auth',
});

const { getBackups, restoreBackup, exportData } = useAdmin();

const isLoading = ref(true);
const backupsList = ref<AdminBackupFileInfo[]>([]);
const isExporting = ref(false);

// Restore confirmation modal
const selectedBackup = ref<AdminBackupFileInfo | null>(null);
const isRestoring = ref(false);
const restoreSuccess = ref('');
const restoreError = ref('');

async function loadBackups() {
  isLoading.value = true;
  try {
    backupsList.value = await getBackups();
  } catch (err) {
    console.error('[AdminBackups] Load error:', err);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadBackups();
});

async function handleExport() {
  isExporting.value = true;
  try {
    await exportData();
  } catch (err) {
    alert('Xuất dữ liệu thất bại: ' + (err instanceof Error ? err.message : String(err)));
  } finally {
    isExporting.value = false;
  }
}

function openRestoreModal(backup: AdminBackupFileInfo) {
  selectedBackup.value = backup;
  restoreSuccess.value = '';
  restoreError.value = '';
}

async function confirmRestore() {
  if (!selectedBackup.value) return;
  isRestoring.value = true;
  restoreError.value = '';
  restoreSuccess.value = '';

  try {
    const res = await restoreBackup(selectedBackup.value.filename);
    restoreSuccess.value = `Khôi phục thành công file "${res.targetFile}" từ bản snapshot!`;
    setTimeout(() => {
      selectedBackup.value = null;
      loadBackups();
    }, 1500);
  } catch (err) {
    restoreError.value = err instanceof Error ? err.message : String(err);
  } finally {
    isRestoring.value = false;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return isoStr;
  }
}
</script>

<template>
  <div class="admin-page-container">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Quản Lý Sao Lưu & Khôi Phục (Backups)</h1>
        <p class="page-desc">Tự động lưu trữ snapshot trước mỗi lần ghi đè, hỗ trợ Rollback 1-Click</p>
      </div>

      <div class="header-actions">
        <button
          type="button"
          class="btn btn-primary"
          :disabled="isExporting"
          @click="handleExport"
        >
          <span>📥</span>
          <span>{{ isExporting ? 'Đang xuất...' : 'Tải Gói Sao Lưu Toàn Bộ' }}</span>
        </button>

        <button type="button" class="btn btn-secondary" @click="loadBackups" :disabled="isLoading">
          <span>🔄</span>
          <span>Làm Mới</span>
        </button>
      </div>
    </div>

    <!-- Info Banner -->
    <div class="info-card">
      <span class="info-icon">🛡️</span>
      <div>
        <strong>Cơ Chế Bảo Vệ Toàn Vẹn Tự Động (Fail-Safe Snapshot)</strong>
        <p>Mỗi khi bạn thêm mới, chỉnh sửa hoặc xóa chặng/thẻ bài, hệ thống sẽ tự động tạo một bản sao lưu trước khi ghi đè. Nếu có bất kỳ sai sót nào, bạn có thể chọn bản sao lưu tương ứng bên dưới để hoàn tác ngay lập tức.</p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner-large"></div>
      <p>Đang tải danh sách snapshot sao lưu...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="backupsList.length === 0" class="empty-state">
      <span class="empty-icon">📂</span>
      <h3>Chưa có bản snapshot sao lưu nào</h3>
      <p>Bản snapshot sẽ tự động được tạo ngay khi bạn thực hiện lưu hoặc xóa chặng lần đầu tiên.</p>
    </div>

    <!-- Backups Table -->
    <div v-else class="backups-table-box">
      <table class="backups-table">
        <thead>
          <tr>
            <th>Tên File Snapshot</th>
            <th style="width: 140px;">Phân Loại</th>
            <th style="width: 130px;">Kích Thước</th>
            <th style="width: 200px;">Thời Điểm Sao Lưu</th>
            <th style="width: 140px; text-align: right;">Hành Động</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in backupsList" :key="b.filename">
            <td>
              <div class="file-title-group">
                <span class="file-icon">📄</span>
                <code class="file-name">{{ b.filename }}</code>
              </div>
            </td>
            <td>
              <span
                class="category-badge"
                :class="`badge-${b.worldTrack || b.category}`"
              >
                {{ (b.worldTrack || b.category).toUpperCase() }}
              </span>
            </td>
            <td>
              <span class="size-text">{{ formatBytes(b.sizeBytes) }}</span>
            </td>
            <td>
              <span class="time-text">{{ formatDate(b.updatedAt) }}</span>
            </td>
            <td style="text-align: right;">
              <button
                type="button"
                class="btn btn-rollback"
                @click="openRestoreModal(b)"
              >
                <span>🔄</span>
                <span>Khôi Phục</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Restore Confirmation Modal -->
    <div v-if="selectedBackup" class="modal-overlay" @click.self="!isRestoring && (selectedBackup = null)">
      <div class="modal-card">
        <div class="modal-header">
          <span class="warn-icon">⚠️</span>
          <h2>Xác Nhận Khôi Phục Dữ Liệu</h2>
        </div>

        <p class="modal-body-text">
          Bạn có chắc chắn muốn khôi phục dữ liệu từ bản snapshot <strong>"{{ selectedBackup.filename }}"</strong> không?
        </p>
        <p class="modal-sub-text">
          Dữ liệu hiện tại của file tương ứng sẽ được ghi đè bằng nội dung của bản sao lưu được tạo lúc <strong>{{ formatDate(selectedBackup.updatedAt) }}</strong>.
        </p>

        <div v-if="restoreSuccess" class="alert alert-success">
          {{ restoreSuccess }}
        </div>

        <div v-if="restoreError" class="alert alert-danger">
          {{ restoreError }}
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" :disabled="isRestoring" @click="selectedBackup = null">
            Hủy Bỏ
          </button>
          <button type="button" class="btn btn-primary" :disabled="isRestoring" @click="confirmRestore">
            {{ isRestoring ? 'Đang khôi phục...' : 'Xác Nhận Khôi Phục' }}
          </button>
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
  margin-bottom: 24px;
}

.page-title {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  color: #f8fafc;
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

/* Info Card */
.info-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 14px;
  padding: 16px 20px;
  margin-bottom: 24px;
}

.info-icon {
  font-size: 24px;
}

.info-card strong {
  display: block;
  font-size: 14px;
  color: #38bdf8;
  margin-bottom: 4px;
}

.info-card p {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
}

/* Backups Table */
.backups-table-box {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
}

.backups-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}

.backups-table th {
  background: rgba(255, 255, 255, 0.02);
  color: #94a3b8;
  font-weight: 700;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.backups-table td {
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  vertical-align: middle;
}

.backups-table tr:hover td {
  background: rgba(255, 255, 255, 0.02);
}

.file-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-icon {
  font-size: 16px;
}

.file-name {
  font-family: monospace;
  font-size: 13px;
  color: #f1f5f9;
}

.category-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 6px;
}

.badge-kids {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.badge-teens {
  background: rgba(139, 92, 246, 0.15);
  color: #c084fc;
}

.badge-adults {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
}

.badge-codex {
  background: rgba(236, 72, 153, 0.15);
  color: #f472b6;
}

.size-text {
  font-size: 12px;
  color: #94a3b8;
}

.time-text {
  font-size: 12px;
  color: #cbd5e1;
}

.btn-rollback {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: #38bdf8;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-rollback:hover {
  background: rgba(56, 189, 248, 0.2);
  transform: translateY(-1px);
}

.warn-icon {
  font-size: 24px;
}

.modal-sub-text {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 20px;
  line-height: 1.4;
}

/* Button UI Components */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  font-size: 13.5px;
  font-weight: 700;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  line-height: 1.4;
  white-space: nowrap;
  user-select: none;
  text-decoration: none;
  font-family: inherit;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
  outline: none;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.btn-secondary {
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #e2e8f0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(51, 65, 85, 0.95);
  border-color: rgba(255, 255, 255, 0.32);
  color: #ffffff;
  transform: translateY(-1.5px);
}

.btn-primary {
  background: linear-gradient(135deg, #0284c7 0%, #2563eb 55%, #4f46e5 100%);
  border: 1px solid rgba(56, 189, 248, 0.45);
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.38);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #0369a1 0%, #1d4ed8 55%, #4338ca 100%);
  border-color: rgba(56, 189, 248, 0.7);
  transform: translateY(-1.5px);
}

.btn-danger {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  border: 1px solid rgba(239, 68, 68, 0.45);
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(220, 38, 38, 0.35);
}

.btn-danger:hover:not(:disabled) {
  background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
  transform: translateY(-1.5px);
}
</style>

