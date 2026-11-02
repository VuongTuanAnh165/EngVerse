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
   * MỚI (Pha 1 - Task 1.1): 3 cụm từ cố định (collocations / situational chunks) đi kèm từ này
   * Ví dụ: ["claim my luggage", "excess luggage fee", "damaged luggage claim"]
   */
  collocations?: [string, string, string] | string[];
  /**
   * MỚI (Pha 1 - Task 1.1): 1 câu giao tiếp đời thực phản xạ chứa từ vựng
   * Ví dụ: "Excuse me, where can I claim my luggage?"
   */
  realWorldPhrase?: string;
  /**
   * MỚI (Pha 1 - Task 1.1): Danh sách các từ đồng nghĩa phổ biến
   * Ví dụ: ["baggage", "suitcase"]
   */
  synonyms?: string[];
  /**
   * MỚI (Pha 1 - Task 1.1): Danh sách các từ trái nghĩa phổ biến (nếu có)
   */
  antonyms?: string[];
}

/**
 * Convenient alias for StageVocabItem matching roadmap documentation
 */
export type VocabItem = StageVocabItem;

/**
 * MỚI (Pha 1 - Task 1.2): Phân loại ngữ pháp theo chức năng giao tiếp đời thực
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
   * MỚI (Pha 1 - Task 1.2): Phân loại ngữ pháp theo chức năng giao tiếp đời thực
   * Giúp hệ thống và AI lọc câu hỏi theo mục đích đàm thoại (hỏi, từ chối, làm rõ...)
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
 * MỚI (Pha 1 - Task 1.3): Biến số kịch bản bất ngờ trong AI Roleplay
 * Kích hoạt sau lượt 2 hoặc 3 để ép người chơi ứng biến tình huống ngoài dự tính.
 */
export interface AiRoleplayPlotTwist {
  /** Lượt kích hoạt biến cố (thường là lượt 2 hoặc 3 của hội thoại) */
  triggerAfterTurn: number;
  /** Tình huống biến cố bằng tiếng Anh để đưa vào context của AI */
  twistScenario: string;
  /** Lời thoại / giải thích tình huống biến cố bằng tiếng Việt cho người học */
  twistLineVi: string;
  /** Danh sách từ khóa bổ sung bắt buộc hoặc khuyến khích dùng khi xảy ra biến cố */
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
   * Số lượt thoại tối đa của người chơi trong màn này.
   * Màn thường nâng từ 4 -> 6 lượt; Màn Boss nâng từ 5 -> 8 lượt.
   * Mặc định fallback là 6 (hoặc 8 cho boss stage) nếu không được khai báo.
   */
  maxTurns?: number;
  passScore?: number;
  /**
   * MỚI (Pha 1 - Task 1.3): Tình huống bất ngờ sau lượt 2-3 ép người chơi ứng biến
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

