/**
 * EngVerse - Game, Stage & Codex Types
 * Strictly typed schema for Static Stage JSON, Mini-game Engine & Codex 3D Cards
 * Reference: docs/ke_hoach.md - Section III.1, Sprint 2 & Sprint 3
 */

import type { WorldTrack, UserProfile } from './user';

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
  /**
   * Má»šI (Pha 1 - Task 1.1): 3 cá»¥m tá»« cá»‘ Ä‘á»‹nh (collocations / situational chunks) Ä‘i kÃ¨m tá»« nÃ y
   * VÃ­ dá»¥: ["claim my luggage", "excess luggage fee", "damaged luggage claim"]
   */
  collocations?: [string, string, string] | string[];
  /**
   * Má»šI (Pha 1 - Task 1.1): 1 cÃ¢u giao tiáº¿p Ä‘á»i thá»±c pháº£n xáº¡ chá»©a tá»« vá»±ng
   * VÃ­ dá»¥: "Excuse me, where can I claim my luggage?"
   */
  realWorldPhrase?: string;
  /**
   * Má»šI (Pha 1 - Task 1.1): Danh sÃ¡ch cÃ¡c tá»« Ä‘á»“ng nghÄ©a phá»• biáº¿n
   * VÃ­ dá»¥: ["baggage", "suitcase"]
   */
  synonyms?: string[];
  /**
   * Má»šI (Pha 1 - Task 1.1): Danh sÃ¡ch cÃ¡c tá»« trÃ¡i nghÄ©a phá»• biáº¿n (náº¿u cÃ³)
   */
  antonyms?: string[];
}

/**
 * Convenient alias for StageVocabItem matching roadmap documentation
 */
export type VocabItem = StageVocabItem;

/**
 * Má»šI (Pha 1 - Task 1.2): PhÃ¢n loáº¡i ngá»¯ phÃ¡p theo chá»©c nÄƒng giao tiáº¿p Ä‘á»i thá»±c
 * Categorizes patterns by real-world communicative intent rather than purely structural rules.
 */
export type FunctionalGrammarCategory =
  | 'asking'
  | 'refusing'
  | 'apologizing'
  | 'persuading'
  | 'clarifying'
  | 'describing'
  | 'narrating'
  | 'negotiating'
  | 'complaining'
  | 'thanking';

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
  /**
   * Má»šI (Pha 1 - Task 1.2): PhÃ¢n loáº¡i ngá»¯ phÃ¡p theo chá»©c nÄƒng giao tiáº¿p Ä‘á»i thá»±c
   * GiÃºp há»‡ thá»‘ng vÃ  AI lá»c cÃ¢u há»i theo má»¥c Ä‘Ã­ch Ä‘Ã m thoáº¡i (há»i, tá»« chá»‘i, lÃ m rÃµ...)
   */
  functionalCategory?: FunctionalGrammarCategory;
}

/**
 * Convenient alias for StageGrammarItem matching roadmap documentation
 */
export type GrammarItem = StageGrammarItem;

/**
 * Offline rule-based fallback when AI API encounters rate limits or errors
 */
export interface OfflineFallbackConfig {
  requiredKeywords: string[];
  successReply: string;
  retryReply: string;
}

/**
 * Má»šI (Pha 1 - Task 1.3): Biáº¿n sá»‘ ká»‹ch báº£n báº¥t ngá» trong AI Roleplay
 * KÃ­ch hoáº¡t sau lÆ°á»£t 2 hoáº·c 3 Ä‘á»ƒ Ã©p ngÆ°á»i chÆ¡i á»©ng biáº¿n tÃ¬nh huá»‘ng ngoÃ i dá»± tÃ­nh.
 */
export interface AiRoleplayPlotTwist {
  /** LÆ°á»£t kÃ­ch hoáº¡t biáº¿n cá»‘ (thÆ°á»ng lÃ  lÆ°á»£t 2 hoáº·c 3 cá»§a há»™i thoáº¡i) */
  triggerAfterTurn: number;
  /** TÃ¬nh huá»‘ng biáº¿n cá»‘ báº±ng tiáº¿ng Anh Ä‘á»ƒ Ä‘Æ°a vÃ o context cá»§a AI */
  twistScenario: string;
  /** Lá»i thoáº¡i / giáº£i thÃ­ch tÃ¬nh huá»‘ng biáº¿n cá»‘ báº±ng tiáº¿ng Viá»‡t cho ngÆ°á»i há»c */
  twistLineVi: string;
  /** Danh sÃ¡ch tá»« khÃ³a bá»• sung báº¯t buá»™c hoáº·c khuyáº¿n khÃ­ch dÃ¹ng khi xáº£y ra biáº¿n cá»‘ */
  bonusKeywords: string[];
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
  /**
   * Sá»‘ lÆ°á»£t thoáº¡i tá»‘i Ä‘a cá»§a ngÆ°á»i chÆ¡i trong mÃ n nÃ y.
   * MÃ n thÆ°á»ng nÃ¢ng tá»« 4 -> 6 lÆ°á»£t; MÃ n Boss nÃ¢ng tá»« 5 -> 8 lÆ°á»£t.
   * Máº·c Ä‘á»‹nh fallback lÃ  6 (hoáº·c 8 cho boss stage) náº¿u khÃ´ng Ä‘Æ°á»£c khai bÃ¡o.
   */
  maxTurns?: number;
  passScore?: number;
  /**
   * Má»šI (Pha 1 - Task 1.3): TÃ¬nh huá»‘ng báº¥t ngá» sau lÆ°á»£t 2-3 Ã©p ngÆ°á»i chÆ¡i á»©ng biáº¿n
   */
  plotTwist?: AiRoleplayPlotTwist;
}

/**
 * Convenient alias for StageAiMission matching roadmap documentation
 */
export type AiRoleplayMission = StageAiMission;

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
  collocations?: string[];
  realWorldPhrase?: string;
  synonyms?: string[];
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
 * Card item representation for Word Alchemy matching mini-game
 */
export interface AlchemyCard {
  id: string;
  vocabId: string;
  type: 'word' | 'meaning';
  text: string;
  subtext?: string;
  emoji?: string;
  isMatched: boolean;
  isSelected: boolean;
  isWrong: boolean;
}

/**
 * Runner obstacle definition for Voice Runner mini-game
 */
export interface RunnerObstacle {
  id: string;
  vocabItem: StageVocabItem;
  isDefeated: boolean;
  obstacleType: 'gate' | 'golem' | 'drone' | 'barrier';
}

/**
 * Scrambled ancient rune stone for Sentence Lock grammar puzzle
 */
export interface RuneStone {
  id: string;
  word: string;
  isDistractor: boolean;
  isPlaced: boolean;
  slotIndex: number | null;
}

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
 * Sound effect types supported by Web Audio API sound synthesizer
 */
export type SoundEffectType =
  | 'correct'
  | 'wrong'
  | 'combo'
  | 'combo_fever'
  | 'fanfare'
  | 'click'
  | 'hit'
  | 'rhythm_tap';

/**
 * Screen shake intensity options
 */
export type ScreenShakeIntensity = 'light' | 'medium' | 'heavy';

/**
 * Detailed log of each answered challenge within a gameplay session
 */
export interface AnswerLogEntry {
  questionId: string;
  itemType: 'vocab' | 'grammar' | 'voice' | 'roleplay';
  isCorrect: boolean;
  timeSpentMs: number;
  userResponse: string;
  expectedResponse: string;
  scoreAwarded: number;
  timestamp: number;
}

/**
 * Comprehensive stage completion summary for server validation & rewards
 */
export interface StageResultSummary {
  stageId: number;
  worldTrack: WorldTrack;
  score: number;
  starsEarned: number;
  isPerfect: boolean;
  accuracy: number;
  totalCorrect: number;
  totalQuestions: number;
  maxCombo: number;
  totalExpEarned: number;
  totalGoldEarned: number;
  wrongItems: string[];
  clearedSrsItems?: string[];
  aiCompletionProof: string | null;
  answersLog: AnswerLogEntry[];
}

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

/**
 * Payload sent to POST /api/game/complete upon finishing a stage
 */
export interface StageCompletePayload {
  worldTrack: WorldTrack;
  stageId: number;
  durationSeconds: number;
  answersLog: AnswerLogEntry[];
  aiCompletionProof?: string | null;
  newWrongIds?: string[];
  clearedSrsIds?: string[];
  idToken?: string;
}

/**
 * Server verification and reward response for POST /api/game/complete
 */
export interface StageCompleteResponse {
  success: boolean;
  starsEarned: number;
  totalExpEarned: number;
  totalGoldEarned: number;
  isReplay: boolean;
  isSpeedHack?: boolean;
  user: UserProfile;
  message?: string;
}

