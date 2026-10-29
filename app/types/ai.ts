/**
 * EngVerse - AI Roleplay Types & Contracts
 * Strict types for Gemini Flash AI NPC, Prompt Injection Guardrails,
 * Sliding Window Conversation History, and HMAC Completion Proofs.
 * Reference: docs/ke_hoach.md - Sprint 4, Task 1
 */

import type { WorldTrack } from './user';
import type { StageAiMission } from './game';

export interface AiChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp?: number;
}

/**
 * Payload sent to POST /api/ai/roleplay
 */
export interface AiRoleplayPayload {
  idToken?: string;
  isGuest?: boolean;
  guestId?: string;
  stageId: number;
  worldTrack: WorldTrack;
  playerInput: string;
  conversationHistory: AiChatMessage[];
  aiMission: StageAiMission;
}

/**
 * Raw structured JSON response expected from Gemini / OpenRouter models
 */
export interface AiRawModelResponse {
  npcReply: string;
  vietnameseHint: string;
  grammarCorrection: string;
  scoreDelta: number;
  isMissionCompleted: boolean;
}

export type AiProviderUsed = 'gemini' | 'openrouter' | 'offline';

/**
 * Clean response returned to client from POST /api/ai/roleplay
 */
export interface AiRoleplayResponse {
  success: boolean;
  npcReply: string;
  vietnameseHint: string;
  grammarCorrection: string;
  scoreDelta: number;
  isMissionCompleted: boolean;
  completionProof?: string;
  remainingTurns: number;
  usedFallback?: boolean;
  providerUsed?: AiProviderUsed;
  latencyMs?: number;
  errorMessage?: string;
}

