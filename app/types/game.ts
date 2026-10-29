/**
 * EngVerse - Game, Stage & Codex Types
 * Strictly typed schema for Static Stage JSON, Mini-game Engine & Codex 3D Cards
 * Reference: docs/ke_hoach.md - Section III.1, Sprint 2 & Sprint 3
 */

import type { WorldTrack } from './user';

export type CardRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'phrasal verb'
  | 'idiom'
  | 'expression'
  | string;

/**
 * Vocabulary item inside a Stage
 */
export interface StageVocabItem {
  id: string;
  word: string;
  ipa: string;
  phonicsFocus?: string;
  partOfSpeech: PartOfSpeech;
  meaning: string;
  distractorMeanings?: string[];
  example: string;
  exampleMeaning?: string;
  audioText: string;
  acceptedVoiceVariants?: string[];
  rhythmSyllables?: string[];
  emoji?: string;
  cardRarity: CardRarity;
  cardId?: string;
}

/**
 * Grammar puzzle item inside a Stage
 */
export interface StageGrammarItem {
  id: string;
  grammarPattern: string;
  vietnamesePrompt: string;
  correctSentence: string;
  punctuation?: string;
  distractorWords: string[];
  grammarTip: string;
}

/**
 * Offline rule-based fallback when AI API encounters rate limits or errors
 */
export interface OfflineFallbackConfig {
  requiredKeywords: string[];
  successReply: string;
  retryReply: string;
}

/**
 * AI Roleplay scenario and mission configuration
 */
export interface StageAiMission {
  npcName: string;
  npcTitle?: string;
  npcEmoji?: string;
  npcAvatar?: string;
  scenario: string;
  openingLine: string;
  openingLineVi: string;
  goal: string;
  recommendedWords: string[];
  targetKeywords?: string[]; // Alias for recommendedWords
  starterChips?: string[];
  offlineFallback?: OfflineFallbackConfig;
  maxTurns?: number;
  passScore?: number;
}

/**
 * Map coordinates for 2D/3D interactive stage map
 */
export interface StageMapPosition {
  x: number;
  y: number;
}

/**
 * Stage reward configuration
 */
export interface StageReward {
  baseExp: number;
  baseGold: number;
  firstClearBonusGold?: number;
  guaranteedCardId?: string;
}

/**
 * Stage gameplay mechanics configuration
 */
export interface StageConfig {
  vocabPickCount: number;
  grammarPickCount: number;
  voicePassThreshold: number;
  timeLimitSeconds: number;
}

/**
 * Complete Stage specification stored in public/data/{track}/stages.json
 */
export interface StageData {
  stageId: number;
  chapter: number;
  worldTrack: WorldTrack;
  track?: WorldTrack; // Backward-compatible alias
  cefrLevel?: string;
  title: string;
  subtitle?: string;
  isBossStage?: boolean;
  themeColor?: string;
  mapPosition: StageMapPosition;
  storyIntro: string;
  reward: StageReward;
  config: StageConfig;
  vocabPool: StageVocabItem[];
  vocabList?: StageVocabItem[]; // Convenient alias
  grammarPool: StageGrammarItem[];
  grammarChallenges?: StageGrammarItem[]; // Convenient alias
  aiRoleplayMission: StageAiMission;
  aiMission?: StageAiMission; // Convenient alias
}

/**
 * Visual styling configuration for each card rarity in the 3D Codex
 */
export interface CodexRarityConfig {
  label: string;
  labelVi: string;
  borderColor: string;
  glowColor: string;
  cardBonusExp: number;
}

/**
 * Metadata block inside public/data/cards/codex.json
 */
export interface CodexMetadata {
  version: string;
  totalCards: number;
  totalCollections: number;
  rarityConfig: Record<CardRarity, CodexRarityConfig>;
}

/**
 * Unlockable title in the Codex
 */
export interface CodexTitle {
  id: string;
  name: string;
  nameEn: string;
  badgeEmoji: string;
  worldTrack: WorldTrack | 'all';
  description: string;
}

/**
 * Themed card collection set
 */
export interface CodexCollection {
  setId: string;
  worldTrack: WorldTrack;
  stageId: number;
  title: string;
  description: string;
  rewardGold: number;
  rewardExp: number;
  unlockTitleId: string;
  cardIds: string[];
}

/**
 * Collectible 3D Card item in the Codex
 */
export interface CodexCard {
  id: string;
  vocabId: string;
  worldTrack: WorldTrack;
  stageId: number;
  setId: string;
  word: string;
  ipa: string;
  partOfSpeech: PartOfSpeech;
  meaning: string;
  example: string;
  exampleMeaning: string;
  audioText: string;
  emoji: string;
  rarity: CardRarity;
  lore: string;
}

/**
 * Complete Codex file schema stored in public/data/cards/codex.json
 */
export interface CodexData {
  metadata: CodexMetadata;
  titles: CodexTitle[];
  collections: CodexCollection[];
  cards: CodexCard[];
}

/**
 * Mini-game types supported by the core engine
 */
export type MiniGameType =
  | 'word_alchemy'
  | 'voice_runner'
  | 'sentence_lock'
  | 'ai_roleplay';

/**
 * In-game session stages
 */
export type GameSessionPhase =
  | 'ready'
  | 'word_alchemy'
  | 'voice_runner'
  | 'sentence_lock'
  | 'ai_roleplay'
  | 'victory'
  | 'gameover';

/**
 * Universal helper functions to safely extract stage items regardless of alias
 */
export function getStageVocabs(stage: StageData): StageVocabItem[] {
  return stage.vocabPool || stage.vocabList || [];
}

export function getStageGrammars(stage: StageData): StageGrammarItem[] {
  return stage.grammarPool || stage.grammarChallenges || [];
}

export function getStageAiMission(stage: StageData): StageAiMission {
  return stage.aiRoleplayMission || stage.aiMission;
}

