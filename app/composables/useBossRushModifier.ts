/**
 * EngVerse - useBossRushModifier Composable
 * Encapsulates all hardcore rule modifier algorithms, stage data transformation,
 * stricter voice pass threshold calculations, and Colosseum scoring formulas.
 *
 * Strict TypeScript (0 any), pure SSR-safe composable, Vue 3.5+.
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.3 & Sprint 9, Task 3.3
 */

import { computed } from 'vue';
import type { StageData } from '~/types/game';
import {
  type BossRushHardcoreConfig,
  BOSS_RUSH_HARDCORE_MODIFIERS,
} from '~/types/bossRush';

export interface ModifierBadgeInfo {
  id: string;
  icon: string;
  title: string;
  shortLabel: string;
  description: string;
}

export function useBossRushModifier(customModifiers?: Partial<BossRushHardcoreConfig>) {
  const activeConfig: BossRushHardcoreConfig = {
    ...BOSS_RUSH_HARDCORE_MODIFIERS,
    ...customModifiers,
  };

  /**
   * Calculates the -30% compressed countdown duration
   * Formula: original * 0.70 (bounded at min 20 seconds for playability)
   */
  function calculateModifiedTime(originalTimeSeconds: number = 60): number {
    const reduced = Math.round(originalTimeSeconds * activeConfig.timeMultiplier);
    return Math.max(20, reduced);
  }

  /**
   * Calculates the +0.05 stricter voice pronunciation pass threshold
   * Base threshold 0.75 -> 0.80 (80% Levenshtein similarity)
   */
  function calculateModifiedVoiceThreshold(originalThreshold: number = 0.75): number {
    const stricter = originalThreshold + activeConfig.voicePassThresholdOffset;
    return Math.min(0.95, Number(stricter.toFixed(2)));
  }

  /**
   * Returns voice threshold as an integer percentage (e.g. 80) for useSpeechEngine
   */
  function getModifiedSpeechPassThreshold(stage?: StageData | null): number {
    const base = stage?.config?.voicePassThreshold ?? 0.75;
    const modified = calculateModifiedVoiceThreshold(base);
    return Math.round(modified * 100);
  }

  /**
   * Calculates the +2 extra vocab items to pick for Word Alchemy
   */
  function calculateModifiedVocabPickCount(
    originalPickCount: number = 4,
    availablePoolCount: number = 8
  ): number {
    const boosted = originalPickCount + activeConfig.extraVocabPickCount;
    return Math.min(availablePoolCount, boosted);
  }

  /**
   * Checks whether Starter Chips (prompt guidance chips) should be hidden
   */
  function shouldHideStarterChips(): boolean {
    return activeConfig.hideStarterChips;
  }

  /**
   * Clones and transforms a normal StageData into a Hardcore Boss Arena stage:
   * - Reduces countdown time by 30%
   * - Increases voice threshold by +0.05
   * - Boosts vocab pick count by +2
   * - Empties starterChips in AI roleplay mission
   */
  function applyHardcoreModifiers(baseStage: StageData): StageData {
    const cloned: StageData = JSON.parse(JSON.stringify(baseStage));

    const poolCount =
      cloned.vocabPool?.length || cloned.vocabList?.length || 8;

    const modifiedTime = calculateModifiedTime(cloned.config?.timeLimitSeconds ?? 60);
    const modifiedVoice = calculateModifiedVoiceThreshold(cloned.config?.voicePassThreshold ?? 0.75);
    const modifiedVocab = calculateModifiedVocabPickCount(
      cloned.config?.vocabPickCount ?? 4,
      poolCount
    );

    cloned.config = {
      ...cloned.config,
      timeLimitSeconds: modifiedTime,
      voicePassThreshold: modifiedVoice,
      vocabPickCount: modifiedVocab,
    };

    // Hide Starter Chips in AI Roleplay
    if (cloned.aiRoleplayMission && activeConfig.hideStarterChips) {
      cloned.aiRoleplayMission.starterChips = [];
    }
    if (cloned.aiMission && activeConfig.hideStarterChips) {
      cloned.aiMission.starterChips = [];
    }

    return cloned;
  }

  /**
   * Calculates the official Boss Rush Colosseum score according to Section 6.3:
   * finalScore = (bossesDefeated * 1000) + (accuracyPercent * 10) + (remainingHP * 500) + timeBonus
   */
  function calculateBossRushScore(params: {
    bossesDefeated: number;
    accuracyPercent: number;
    remainingHP: number;
    totalTimeMs: number;
  }): {
    finalScore: number;
    timeBonus: number;
    isPerfect: boolean;
  } {
    const { bossesDefeated, accuracyPercent, remainingHP, totalTimeMs } = params;

    // Time Bonus: Max 1,500 pts scaling down if run takes > 4 minutes (240s)
    const totalSeconds = Math.floor(totalTimeMs / 1000);
    const timeBonus = Math.max(0, Math.floor((360 - totalSeconds) * 8));

    const finalScore =
      bossesDefeated * 1000 +
      Math.round(accuracyPercent) * 10 +
      Math.max(0, remainingHP) * 500 +
      timeBonus;

    const isPerfect = bossesDefeated === 4 && remainingHP === 3;

    return {
      finalScore,
      timeBonus,
      isPerfect,
    };
  }

  /**
   * Visual descriptions for HUD & Portal Gate display
   */
  const activeModifierBadges = computed<ModifierBadgeInfo[]>(() => [
    {
      id: 'shared_hp',
      icon: '🩸',
      title: 'Shared HP 3 Tim',
      shortLabel: 'Shared 3 ❤️',
      description: 'Duy nhất 3 ❤️ cho cả 4 Boss, không hồi máu giữa các trận',
    },
    {
      id: 'time_reduced',
      icon: '⏱️',
      title: 'Thời Gian -30%',
      shortLabel: '-30% Time',
      description: 'Bộ đếm countdown áp lực cực độ trong mọi thử thách',
    },
    {
      id: 'voice_strict',
      icon: '🎙️',
      title: 'Chuẩn Âm +5%',
      shortLabel: '+5% Pronun',
      description: 'Ngưỡng nhận diện giọng nói khắt khe hơn (+0.05 pass threshold)',
    },
    {
      id: 'no_chips_extra_vocab',
      icon: '🧩',
      title: 'Ẩn Starter Chips & +2 Từ Vựng',
      shortLabel: 'No Chips & +2 Vocab',
      description: 'Không có câu mẫu gợi ý, thử thách từ vựng dày đặc hơn',
    },
  ]);

  return {
    config: activeConfig,
    activeModifierBadges,
    calculateModifiedTime,
    calculateModifiedVoiceThreshold,
    getModifiedSpeechPassThreshold,
    calculateModifiedVocabPickCount,
    shouldHideStarterChips,
    applyHardcoreModifiers,
    calculateBossRushScore,
  };
}

