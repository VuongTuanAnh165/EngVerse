/**
 * EngVerse - Daily Challenge Generation Engine
 * Generates personalized daily challenges (4 phases: Vocab Sprint, Grammar Flash, Voice Challenge, Quick Roleplay)
 * based on GMT+7 calendar reset and 50% SRS Queue priority.
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.2 & Sprint 8, Task 2.1
 */

import { readStages } from './adminStorage';
import type { StageData, StageVocabItem, StageGrammarItem } from '~/types/game';
import type {
  DailyChallengeData,
  DailyVocabSprintItem,
  DailyGrammarFlashItem,
  DailyVoiceChallengeItem,
  DailyQuickRoleplayConfig,
} from '~/types/dailyChallenge';

/**
 * Gets current date string formatted as YYYY-MM-DD in Vietnam Timezone (GMT+7)
 */
export function getVietnamDateString(dateObj: Date = new Date()): string {
  // GMT+7 is UTC + 7 hours
  const vnTime = new Date(dateObj.getTime() + 7 * 60 * 60 * 1000);
  return vnTime.toISOString().slice(0, 10);
}

/**
 * Gets yesterday date string formatted as YYYY-MM-DD in Vietnam Timezone (GMT+7)
 */
export function getYesterdayVietnamDateString(): string {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return getVietnamDateString(yesterday);
}

/**
 * 7 Preset Themes for each day of the week
 */
export const DAILY_PRESET_THEMES: Array<{
  dayOfWeek: number;
  theme: string;
  themeVi: string;
  icon: string;
  description: string;
  roleplay: Omit<DailyQuickRoleplayConfig, 'theme' | 'maxTurns'>;
}> = [
  {
    dayOfWeek: 0, // Sunday
    theme: 'Multiverse Review & Mixed Battle',
    themeVi: 'Đại Chiến Ôn Tập Đa Vũ Trụ',
    icon: '🎲',
    description: 'Thử thách tổng hợp kiến thức từ cả 3 vũ trụ trong tuần.',
    roleplay: {
      npcName: 'Omni Guide',
      npcTitle: 'Sứ Giả Đa Vũ Trụ',
      npcEmoji: '🌌',
      scenario: 'Bạn gặp Sứ Giả Đa Vũ Trụ tại giao điểm không gian để tổng kết hành trình học tập trong tuần.',
      goal: 'Nói về những điều thú vị bạn đã học được và mục tiêu tuần tới bằng tiếng Anh.',
      openingLine: 'Greetings, explorer! What was the most exciting thing you learned this week?',
      openingLineVi: 'Chào nhà thám hiểm! Điều thú vị nhất bạn đã học được trong tuần này là gì?',
      targetKeywords: ['learn', 'improve', 'challenge', 'future'],
      starterChips: ['I learned many new words.', 'I practiced speaking every day.', 'My goal is to be fluent.'],
    },
  },
  {
    dayOfWeek: 1, // Monday
    theme: 'Ordering Coffee at a Café',
    themeVi: 'Gọi Cà Phê & Bữa Sáng Đầu Tuần',
    icon: '☕',
    description: 'Luyện tập tình huống thực tế tại quán cà phê quốc tế.',
    roleplay: {
      npcName: 'Barista Sam',
      npcTitle: 'Nhân Viên Quán Cà Phê',
      npcEmoji: '☕',
      scenario: 'Bạn bước vào một quán cà phê hiện đại tại trung tâm thành phố để gọi thức uống cho buổi sáng.',
      goal: 'Gọi 1 món đồ uống yêu thích kèm yêu cầu kích cỡ và xin hóa đơn bằng tiếng Anh.',
      openingLine: 'Good morning! Welcome to Central Brew. What can I get started for you today?',
      openingLineVi: 'Chào buổi sáng! Chào mừng bạn đến Central Brew. Tôi có thể lấy gì cho bạn hôm nay?',
      targetKeywords: ['coffee', 'latte', 'receipt', 'sugar'],
      starterChips: ['I would like an iced latte.', 'Can I have it with less sugar?', 'Could I get the receipt please?'],
    },
  },
  {
    dayOfWeek: 2, // Tuesday
    theme: 'Asking for Directions & Public Transit',
    themeVi: 'Hỏi Đường & Phương Tiện Công Cộng',
    icon: '🚌',
    description: 'Kỹ năng hỏi đường và đón xe bus, tàu điện ngầm khi đi nước ngoài.',
    roleplay: {
      npcName: 'Officer Miller',
      npcTitle: 'Cảnh Sát Giao Thông',
      npcEmoji: '👮',
      scenario: 'Bạn đang đứng ở ngã tư trung tâm và cần tìm đường đến ga tàu điện ngầm gần nhất.',
      goal: 'Hỏi đường đến ga tàu và hỏi thời gian tàu chạy bằng tiếng Anh.',
      openingLine: 'Excuse me! You seem a bit lost. Where are you trying to go?',
      openingLineVi: 'Xin lỗi! Bạn trông có vẻ hơi lạc đường. Bạn đang muốn đi đâu vậy?',
      targetKeywords: ['station', 'direction', 'straight', 'subway'],
      starterChips: ['Where is the nearest subway station?', 'How long does it take on foot?', 'Thank you for your help!'],
    },
  },
  {
    dayOfWeek: 3, // Wednesday
    theme: 'Visiting Clinic & Pharmacy',
    themeVi: 'Khám Bệnh & Mua Thuốc Tại Hiệu Thuốc',
    icon: '🏥',
    description: 'Giao tiếp tình huống khẩn cấp, mô tả triệu chứng và mua thuốc cần thiết.',
    roleplay: {
      npcName: 'Dr. Sarah',
      npcTitle: 'Bác Sĩ Trực Phòng Khám',
      npcEmoji: '👩‍⚕️',
      scenario: 'Bạn cảm thấy đau đầu và hơi sốt nhẹ nên đến phòng khám quốc tế để kiểm tra.',
      goal: 'Mô tả triệu chứng bệnh của bạn và xin đơn thuốc bằng tiếng Anh.',
      openingLine: 'Hello there. Please have a seat. What seems to be the problem today?',
      openingLineVi: 'Xin chào. Mời bạn ngồi. Hôm nay bạn cảm thấy không khỏe ở đâu vậy?',
      targetKeywords: ['headache', 'fever', 'medicine', 'prescription'],
      starterChips: ['I have had a headache since morning.', 'Do I need to take medicine?', 'How many times a day?'],
    },
  },
  {
    dayOfWeek: 4, // Thursday
    theme: 'Scheduling an Appointment',
    themeVi: 'Gọi Điện Đặt Lịch Hẹn & Xác Nhận',
    icon: '📱',
    description: 'Kỹ năng gọi điện thoại chuyên nghiệp, hẹn giờ và xử lý thay đổi lịch.',
    roleplay: {
      npcName: 'Clara',
      npcTitle: 'Lễ Tân Tiếp Nhận Lịch',
      npcEmoji: '📞',
      scenario: 'Bạn gọi điện đến văn phòng để đặt lịch hẹn phỏng vấn hoặc gặp mặt cố vấn.',
      goal: 'Đề xuất thời gian rảnh của bạn và xác nhận ngày giờ hẹn chính xác bằng tiếng Anh.',
      openingLine: 'Thank you for calling Apex Advisory. How may I direct your call today?',
      openingLineVi: 'Cảm ơn đã gọi cho Apex Advisory. Tôi có thể chuyển máy giúp bạn đến đâu?',
      targetKeywords: ['appointment', 'schedule', 'available', 'confirm'],
      starterChips: ['I would like to make an appointment.', 'Are you available on Friday morning?', 'Please confirm my booking.'],
    },
  },
  {
    dayOfWeek: 5, // Friday
    theme: 'Shopping, Discounts & Returns',
    themeVi: 'Mua Sắm, Hỏi Giảm Giá & Đổi Trả',
    icon: '🛒',
    description: 'Thương lượng giá, hỏi chính sách khuyến mãi và mua sắm thông minh.',
    roleplay: {
      npcName: 'Alex',
      npcTitle: 'Quản Lý Cửa Hàng Thời Trang',
      npcEmoji: '🛍️',
      scenario: 'Bạn đang chọn đồ tại trung tâm thương mại và muốn hỏi xem có chương trình giảm giá hay không.',
      goal: 'Hỏi giá, xin thử size khác và hỏi về khuyến mãi bằng tiếng Anh.',
      openingLine: 'Welcome to Urban Style! Are you looking for anything in particular today?',
      openingLineVi: 'Chào mừng bạn đến Urban Style! Bạn đang tìm kiếm món đồ đặc biệt nào hôm nay không?',
      targetKeywords: ['discount', 'price', 'size', 'receipt'],
      starterChips: ['Is there a discount on this item?', 'Do you have this in a medium size?', 'Can I pay by card?'],
    },
  },
  {
    dayOfWeek: 6, // Saturday
    theme: 'Food Delivery & Dining Out',
    themeVi: 'Đặt Đồ Ăn Giao Hàng & Ăn Tối',
    icon: '🍕',
    description: 'Gọi món ăn ngon cuối tuần, yêu cầu đặc biệt và chỉ dẫn địa chỉ giao hàng.',
    roleplay: {
      npcName: 'Chef Luigi',
      npcTitle: 'Chủ Nhà Hàng Pizza & Pasta',
      npcEmoji: '👨‍🍳',
      scenario: 'Bạn liên hệ với nhà hàng để đặt đồ ăn giao tận nơi cho buổi tối thứ Bảy cùng bạn bè.',
      goal: 'Gọi 2 món ăn kèm đồ uống và cung cấp địa chỉ giao hàng bằng tiếng Anh.',
      openingLine: 'Buonasera! Luigi Pizza & Pasta hotline. What delicious food would you like to order?',
      openingLineVi: 'Chào buổi tối! Đường dây nóng Luigi Pizza & Pasta. Bạn muốn gọi món ngon gì hôm nay?',
      targetKeywords: ['order', 'delivery', 'address', 'delicious'],
      starterChips: ['I would like to order a large pizza.', 'Please deliver it to apartment 4B.', 'How long will delivery take?'],
    },
  },
];

/**
 * Deterministic pseudo-random number generator using seed string
 */
function createSeededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  let state = Math.abs(hash) || 123456789;

  return function next(): number {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * In-memory 24h cache for Base Daily Challenge by date
 */
const dailyBaseCache = new Map<string, DailyChallengeData>();

/**
 * Generates an end-to-end Daily Challenge bundle
 */
export async function generateDailyChallenge(
  dateStr: string = getVietnamDateString(),
  srsVocabIds: string[] = []
): Promise<DailyChallengeData> {
  const dateObj = new Date(dateStr + 'T00:00:00Z');
  // 0 = Sunday, 1 = Monday, ...
  const dayOfWeek = isNaN(dateObj.getUTCDay()) ? 1 : dateObj.getUTCDay();
  const themePreset = DAILY_PRESET_THEMES.find((t) => t.dayOfWeek === dayOfWeek) || DAILY_PRESET_THEMES[1]!;

  // Load all stages across 3 universes
  const [kidsStages, teensStages, adultsStages] = await Promise.all([
    readStages('kids'),
    readStages('teens'),
    readStages('adults'),
  ]);

  const allStages: StageData[] = [...kidsStages, ...teensStages, ...adultsStages];
  const allVocabs: StageVocabItem[] = [];
  const allGrammar: StageGrammarItem[] = [];

  for (const s of allStages) {
    if (Array.isArray(s.vocabPool)) allVocabs.push(...s.vocabPool);
    if (Array.isArray(s.grammarPool)) allGrammar.push(...s.grammarPool);
  }

  const rng = createSeededRandom(`${dateStr}_engverse_daily`);

  // Helper shuffle array
  function seededShuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = copy[i]!;
      copy[i] = copy[j]!;
      copy[j] = tmp;
    }
    return copy;
  }

  // -------------------------------------------------------------------------
  // Phase 1: Vocab Sprint (6 words - 50% SRS + 50% Random / Theme)
  // -------------------------------------------------------------------------
  const selectedVocabPool: StageVocabItem[] = [];

  // Try to pick up to 3 words from user's SRS queue if provided
  if (srsVocabIds && srsVocabIds.length > 0) {
    const srsSet = new Set(srsVocabIds);
    const matchedSrs = allVocabs.filter((v) => srsSet.has(v.id) || srsSet.has(v.word.toLowerCase()));
    const shuffledSrs = seededShuffle(matchedSrs).slice(0, 3);
    selectedVocabPool.push(...shuffledSrs);
  }

  // Fill remainder from allVocabs to reach exactly 6 words
  const remainingCount = 6 - selectedVocabPool.length;
  const pickedIds = new Set(selectedVocabPool.map((v) => v.id));
  const availableVocabs = allVocabs.filter((v) => !pickedIds.has(v.id));
  const randomPicks = seededShuffle(availableVocabs).slice(0, remainingCount);
  selectedVocabPool.push(...randomPicks);

  // Build Vocab Sprint Items with 3 distractor meanings each
  const vocabSprint: DailyVocabSprintItem[] = selectedVocabPool.map((v) => {
    // Pick 3 distractors from other vocabs
    const otherMeanings = allVocabs
      .filter((other) => other.id !== v.id && other.meaning !== v.meaning)
      .map((other) => other.meaning);
    const shuffledMeanings = seededShuffle(otherMeanings).slice(0, 3);

    return {
      id: v.id,
      word: v.word,
      ipa: v.ipa,
      meaning: v.meaning,
      collocations: v.collocations ? [...v.collocations] : undefined,
      realWorldPhrase: v.realWorldPhrase,
      emoji: v.emoji || '✨',
      distractorMeanings:
        v.distractorMeanings && v.distractorMeanings.length >= 3
          ? v.distractorMeanings.slice(0, 3)
          : shuffledMeanings,
    };
  });

  // -------------------------------------------------------------------------
  // Phase 2: Grammar Flash (4 puzzles)
  // -------------------------------------------------------------------------
  const shuffledGrammar = seededShuffle(allGrammar).slice(0, 4);
  const grammarFlash: DailyGrammarFlashItem[] = shuffledGrammar.map((g) => ({
    id: g.id,
    grammarPattern: g.grammarPattern,
    vietnamesePrompt: g.vietnamesePrompt,
    correctSentence: g.correctSentence,
    distractorWords: g.distractorWords || ['is', 'are', 'not'],
    grammarTip: g.grammarTip || 'Chú ý cấu trúc câu và thì ngữ pháp.',
    functionalCategory: g.functionalCategory,
  }));

  // -------------------------------------------------------------------------
  // Phase 3: Voice Challenge (3 read-aloud phrases)
  // -------------------------------------------------------------------------
  // Prefer realWorldPhrase, fallback to example
  const vocabsWithPhrases = allVocabs.filter(
    (v) => (v.realWorldPhrase && v.realWorldPhrase.trim().length > 5) || (v.example && v.example.trim().length > 5)
  );
  const selectedVoiceVocabs = seededShuffle(vocabsWithPhrases).slice(0, 3);

  const voiceChallenge: DailyVoiceChallengeItem[] = selectedVoiceVocabs.map((v, idx) => ({
    id: `daily_voice_${v.id}_${idx + 1}`,
    sentence: v.realWorldPhrase || v.example,
    translationVi: v.exampleMeaning || v.meaning,
    focusWord: v.word,
    ipa: v.ipa,
  }));

  // -------------------------------------------------------------------------
  // Phase 4: Quick Roleplay (3 turns)
  // -------------------------------------------------------------------------
  const quickRoleplay: DailyQuickRoleplayConfig = {
    theme: themePreset.theme,
    npcName: themePreset.roleplay.npcName,
    npcTitle: themePreset.roleplay.npcTitle,
    npcEmoji: themePreset.roleplay.npcEmoji,
    scenario: themePreset.roleplay.scenario,
    goal: themePreset.roleplay.goal,
    openingLine: themePreset.roleplay.openingLine,
    openingLineVi: themePreset.roleplay.openingLineVi,
    targetKeywords: themePreset.roleplay.targetKeywords,
    starterChips: themePreset.roleplay.starterChips,
    maxTurns: 3,
  };

  const challengeData: DailyChallengeData = {
    date: dateStr,
    dayOfWeek,
    theme: themePreset.theme,
    themeVi: themePreset.themeVi,
    icon: themePreset.icon,
    description: themePreset.description,
    vocabSprint,
    grammarFlash,
    voiceChallenge,
    quickRoleplay,
  };

  // Cache base challenge for the day
  if (!srsVocabIds || srsVocabIds.length === 0) {
    dailyBaseCache.set(dateStr, challengeData);
  }

  return challengeData;
}

