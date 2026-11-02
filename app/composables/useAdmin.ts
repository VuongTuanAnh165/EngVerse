/**
 * EngVerse - Admin Composable
 * Manages admin authentication state, API client wrapper with x-admin-key headers,
 * and unified admin operations.
 *
 * Strict TypeScript (0 any), Client/Universal.
 * Reference: docs/plan_admin_cms.md & .antigravity/rules.md
 */

import { computed } from 'vue';
import type { WorldTrack } from '~/types/user';
import type { StageData, CodexData, CodexCard } from '~/types/game';
import type {
  AdminAuthResponse,
  AdminStageSaveResponse,
  AdminStageDeleteResponse,
  AdminBackupFileInfo,
  AdminExportBundle,
} from '~/types/admin';

export function useAdmin() {
  const adminCookie = useCookie<string | null>('engverse_admin_token', {
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });

  const isAuthenticated = computed(() => Boolean(adminCookie.value && adminCookie.value.trim().length > 0));

  /**
   * Universal fetch wrapper that automatically attaches the x-admin-key header
   */
  async function adminFetch<T>(url: string, options: Parameters<typeof $fetch>[1] = {}): Promise<T> {
    const headers = {
      ...(options.headers || {}),
      'x-admin-key': adminCookie.value || '',
    };

    return await $fetch<T>(url, {
      ...options,
      headers,
    });
  }

  /**
   * Verifies an admin secret key and establishes the session cookie
   */
  async function login(key: string): Promise<AdminAuthResponse> {
    const res = await $fetch<AdminAuthResponse>('/api/admin/auth/verify', {
      method: 'POST',
      body: { key: key.trim() },
    });

    if (res.success) {
      adminCookie.value = key.trim();
    }

    return res;
  }

  /**
   * Clears the admin session and navigates to the login screen
   */
  function logout() {
    adminCookie.value = null;
    navigateTo('/admin/login');
  }

  /**
   * Fetches stages for a specific universe track with resilient fallback
   */
  async function getStages(track: WorldTrack): Promise<StageData[]> {
    try {
      return await adminFetch<StageData[]>('/api/admin/stages', {
        query: { track },
      });
    } catch (err) {
      console.warn(`[useAdmin] /api/admin/stages?track=${track} fallback to static CDN:`, err);
      return await $fetch<StageData[]>(`/data/${track}/stages.json`);
    }
  }

  /**
   * Creates a new stage (with auto-synced Codex cards)
   */
  async function createStage(stage: StageData): Promise<AdminStageSaveResponse> {
    return await adminFetch<AdminStageSaveResponse>('/api/admin/stages', {
      method: 'POST',
      body: { stage },
    });
  }

  /**
   * Updates an existing stage by ID
   */
  async function updateStage(stageId: number, stage: StageData): Promise<AdminStageSaveResponse> {
    return await adminFetch<AdminStageSaveResponse>(`/api/admin/stages/${stageId}`, {
      method: 'PUT',
      body: { stage },
    });
  }

  /**
   * Deletes a stage with optional cascade deletion of Codex cards
   */
  async function deleteStage(track: WorldTrack, stageId: number, cascadeCards: boolean = true): Promise<AdminStageDeleteResponse> {
    return await adminFetch<AdminStageDeleteResponse>(`/api/admin/stages/${stageId}`, {
      method: 'DELETE',
      query: { track, cascadeCards: cascadeCards ? 'true' : 'false' },
    });
  }

  /**
   * Fetches complete Codex dataset with resilient fallback
   */
  async function getCodex(): Promise<CodexData> {
    try {
      return await adminFetch<CodexData>('/api/admin/codex');
    } catch (err) {
      console.warn('[useAdmin] /api/admin/codex fallback to static CDN:', err);
      return await $fetch<CodexData>('/data/cards/codex.json');
    }
  }

  /**
   * Saves or updates a Codex card
   */
  async function saveCard(card: CodexCard): Promise<{ success: boolean; card: CodexCard }> {
    return await adminFetch<{ success: boolean; card: CodexCard }>('/api/admin/codex/cards', {
      method: 'POST',
      body: { card },
    });
  }

  /**
   * Deletes a card from Codex
   */
  async function deleteCard(cardId: string): Promise<{ success: boolean; deletedCardId: string }> {
    return await adminFetch<{ success: boolean; deletedCardId: string }>(`/api/admin/codex/cards/${cardId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Saves or updates a Codex collection set
   */
  async function saveCollection(collection: CodexCollection): Promise<{ success: boolean; collection: CodexCollection }> {
    return await adminFetch<{ success: boolean; collection: CodexCollection }>('/api/admin/codex/collections', {
      method: 'POST',
      body: { collection },
    });
  }

  /**
   * Saves or updates a Codex title
   */
  async function saveTitle(title: CodexTitle): Promise<{ success: boolean; title: CodexTitle }> {
    return await adminFetch<{ success: boolean; title: CodexTitle }>('/api/admin/codex/titles', {
      method: 'POST',
      body: { title },
    });
  }

  /**
   * Lists all available snapshot backups
   */
  async function getBackups(): Promise<AdminBackupFileInfo[]> {
    return await adminFetch<AdminBackupFileInfo[]>('/api/admin/backups');
  }

  /**
   * Restores a snapshot backup
   */
  async function restoreBackup(filename: string): Promise<{ success: boolean; targetFile: string }> {
    return await adminFetch<{ success: boolean; targetFile: string }>('/api/admin/backups/restore', {
      method: 'POST',
      body: { filename },
    });
  }

  /**
   * Exports complete data bundle as a JSON file download in browser
   */
  async function exportData(): Promise<void> {
    const bundle = await adminFetch<AdminExportBundle>('/api/admin/export');
    const jsonStr = JSON.stringify(bundle, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `engverse_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Generates a stage with AI (Gemini Flash / Groq / OpenRouter)
   */
  async function generateStageWithAi(payload: AdminAiGeneratePayload): Promise<AdminAiGenerateResponse> {
    return await adminFetch<AdminAiGenerateResponse>('/api/admin/generate-stage', {
      method: 'POST',
      body: payload,
    });
  }

  return {
    adminToken: adminCookie,
    isAuthenticated,
    adminFetch,
    login,
    logout,
    getStages,
    createStage,
    updateStage,
    deleteStage,
    generateStageWithAi,
    getCodex,
    saveCard,
    deleteCard,
    saveCollection,
    saveTitle,
    getBackups,
    restoreBackup,
    exportData,
  };
}

