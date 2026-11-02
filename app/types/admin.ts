/**
 * EngVerse - Admin Management & CMS Types
 * Strictly typed definitions for Content Management, Auto-Sync & Backup operations.
 * Reference: docs/plan_admin_cms.md & .antigravity/rules.md
 */

import type { WorldTrack } from './user';
import type { StageData, CodexData, CodexCard } from './game';

export interface AdminAuthVerifyPayload {
  key: string;
}

export interface AdminAuthResponse {
  success: boolean;
  message?: string;
  role?: 'master_admin';
}

export interface AdminBackupFileInfo {
  filename: string;
  sizeBytes: number;
  updatedAt: string;
  category: 'stages' | 'codex' | 'export';
  worldTrack?: WorldTrack;
}

export interface AdminStageSavePayload {
  stage: StageData;
  autoSyncCodex?: boolean;
}

export interface AdminStageSaveResponse {
  success: boolean;
  stage: StageData;
  syncedCardsCount: number;
  backupCreated?: string;
}

export interface AdminStageDeleteResponse {
  success: boolean;
  deletedStageId: number;
  worldTrack: WorldTrack;
  cascadeCardsRemoved: number;
}

export interface AdminExportBundle {
  version: string;
  exportedAt: string;
  tracks: Record<WorldTrack, StageData[]>;
  codex: CodexData;
}

export interface AdminAiGeneratePayload {
  topic: string;
  worldTrack: WorldTrack;
  chapter?: number;
  cefrLevel?: string;
  vocabCount?: number;
  isBossStage?: boolean;
}

export interface AdminAiGenerateResponse {
  success: boolean;
  stage: StageData;
  providerUsed: 'gemini' | 'groq' | 'openrouter';
  latencyMs: number;
}

