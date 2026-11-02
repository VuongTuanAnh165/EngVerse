/**
 * EngVerse - Daily Challenge Generation Engine & Gemini AI Topic Generator
 * Multi-Tier Resilient Architecture:
 * 1. Tier 1: Google Gemini 2.0 / 2.5 Flash API (Sub-second response, 6s AbortController timeout)
 * 2. Tier 2: OpenRouter API (Smart Fallback on 429, 503, 404 or timeout)
 * 3. Tier 3: Deterministic Offline Preset Themes (Zero crash guarantee)
 *
 * Combines 50% Spaced Repetition (SRS Queue) + 50% AI-generated contextual Life-Skill content.
 * Strict TypeScript (0 any), Server-only, 24-hour Edge CDN / In-Memory Cache (Rule 2 & Rule 5).
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.2 & Sprint 8, Task 2.6
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

export interface DailyAiGenerationOptions {
  geminiApiKey?: string;
  geminiModel?: string;
  openrouterApiKey?: string;
}

export interface DailyAiThemeVocabItem {
  word: string;
  ipa: string;
  meaning: string;
  distractorMeanings: string[];
  example: string;
  exampleMeaning: string;
  collocations?: string[];
  realWorldPhrase?: string;
  emoji?: string;
}

export interface DailyAiThemeGrammarItem {
  pattern: string;
  vietnamesePrompt: string;
  correctSentence: string;
  distractorWords: string[];
  grammarTip: string;
  functionalCategory?: string;
}

export interface DailyAiThemeVoiceItem {
  sentence: string;
  translationVi: string;
  focusWord: string;
  ipa: string;
}

export interface DailyAiThemeResult {
  theme: string;
  themeVi: string;
  icon: string;
  description: string;
  vocabFocus?: DailyAiThemeVocabItem[];
  grammarFocus?: DailyAiThemeGrammarItem;
  voicePhrases?: DailyAiThemeVoiceItem[];
  roleplay: Omit<DailyQuickRoleplayConfig, 'theme' | 'maxTurns'>;
  providerUsed: 'gemini' | 'openrouter' | 'preset_fallback';
}

/**
 * 7 Preset Themes for each day of the week (Tier 3 Rock-Solid Fallback)
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
    theme: 'Multiverse Review & Social Connection',
    themeVi: 'Đại Chiến Ôn Tập & Kết Nối Đa Vũ Trụ',
    icon: '🎲',
    description: 'Thử thách tổng hợp kiến thức từ cả 3 vũ trụ trong tuần và chia sẻ trải nghiệm.',
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
    description: 'Luyện tập tình huống thực tế tại quán cà phê quốc tế, gọi món và yêu cầu khẩu vị.',
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
 * Strips markdown code blocks and safely parses JSON
 */
function cleanAndParseJson<T>(rawText: string): T | null {
  try {
    let text = rawText.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Builds the comprehensive pedagogical system prompt for Gemini API
 */
export function buildDailyChallengePrompt(dateStr: string, dayOfWeek: number): {
  systemPrompt: string;
  userPrompt: string;
} {
  const dayThemes = [
    'Chủ Nhật (Sunday) — Ôn tập tuần, tổng kết đa vũ trụ, giao lưu xã hội (Social connection & reflection)',
    'Thứ Hai (Monday) — Khởi đầu tuần mới, năng lượng, cà phê sáng, thói quen văn phòng & học tập (Morning routine & productivity)',
    'Thứ Ba (Tuesday) — Di chuyển, phương tiện công cộng, hỏi đường, sân bay & ga tàu (Transit & navigation)',
    'Thứ Tư (Wednesday) — Sức khỏe, y tế, khám bệnh, hiệu thuốc & lối sống lành mạnh (Health & wellness)',
    'Thứ Năm (Thursday) — Công sở, gọi điện thoại, đặt lịch hẹn, phỏng vấn & đàm phán (Professional communication)',
    'Thứ Sáu (Friday) — Mua sắm cuối tuần, trả giá, đổi trả hàng, thương mại & giải trí (Shopping & lifestyle)',
    'Thứ Bảy (Saturday) — Ăn uống, ẩm thực, gọi món giao hàng tận nơi (Food delivery & dining out)',
  ];
  const dayContext = dayThemes[dayOfWeek % 7] || dayThemes[1]!;

  const systemPrompt = `Bạn là Trưởng Ban Thiết Kế Giáo Trình & Game Master của EngVerse - Nền tảng game học tiếng Anh phản xạ hàng đầu.
Nhiệm vụ của bạn là sáng tạo chủ đề Thử Thách Hàng Ngày (Daily Challenge) cho ngày ${dateStr} thuộc nhóm: ${dayContext}.

YÊU CẦU THIẾT KẾ:
1. Chủ đề (theme & themeVi): Gần gũi với đời thực, phù hợp nhịp điệu sinh hoạt của thứ trong tuần. Tự nhiên, hiện đại, mang tính ứng dụng giao tiếp cao.
2. Từ vựng (vocabFocus): Đúng 3 từ vựng mới mẻ gắn liền với chủ đề.
   - word: Từ vựng tiếng Anh.
   - ipa: Phiên âm quốc tế chuẩn xác (ví dụ: /ˈlɑː.teɪ/).
   - meaning: Nghĩa tiếng Việt ngắn gọn, dễ hiểu.
   - distractorMeanings: Đúng 3 nghĩa tiếng Việt gây nhiễu cùng loại từ nhưng sai ngữ cảnh để làm câu hỏi trắc nghiệm mini-game.
   - example: 1 câu ví dụ tiếng Anh thực tế có ngữ cảnh rõ ràng.
   - exampleMeaning: Dịch câu ví dụ sang tiếng Việt.
   - collocations: Đúng 3 cụm từ cố định hay đi kèm (ví dụ: ["iced latte", "order a latte", "steamed milk"]).
   - realWorldPhrase: 1 câu giao tiếp đời thực phản xạ chứa từ này (ví dụ: "Could I have an iced latte with less sugar, please?").
   - emoji: 1 emoji đại diện phù hợp.
3. Ngữ pháp (grammarFocus): 1 câu đố ngữ pháp phản xạ tình huống:
   - pattern: Cấu trúc ngữ pháp trọng tâm (ví dụ: "Would you like...? / I would prefer...").
   - vietnamesePrompt: Câu tiếng Việt người học cần chuyển dịch sang tiếng Anh.
   - correctSentence: Câu tiếng Anh chuẩn xác (từ 5-8 từ).
   - distractorWords: 3-4 từ gây nhiễu xáo trộn.
   - grammarTip: Mẹo ngữ pháp ngắn gọn 1 câu bằng tiếng Việt.
   - functionalCategory: Phân loại chức năng (chọn 1 trong: asking, refusing, apologizing, persuading, clarifying, describing, narrating, negotiating, complaining, thanking).
4. Luyện phát âm (voicePhrases): Đúng 3 câu tiếng Anh đời thực tự nhiên (5-10 từ/câu), kèm dịch nghĩa, từ khóa nhấn âm (focusWord) và ipa của từ khóa.
5. Kịch bản nhập vai Quick Roleplay (roleplay): 3 lượt đối thoại nhanh:
   - npcName: Tên NPC ảo (ví dụ: "Barista Sam", "Dr. Sarah", "Clara").
   - npcTitle: Chức danh NPC bằng tiếng Việt.
   - npcEmoji: Emoji của NPC.
   - scenario: Mô tả bối cảnh tình huống ngắn gọn bằng tiếng Việt.
   - goal: Mục tiêu người chơi cần đạt được khi giao tiếp bằng tiếng Việt.
   - openingLine: Lời thoại mở đầu tự nhiên của NPC bằng tiếng Anh (dưới 20 từ).
   - openingLineVi: Dịch nghĩa tiếng Việt câu mở đầu.
   - targetKeywords: Đúng 4 từ khóa tiếng Anh người chơi cần nói trong 3 lượt.
   - starterChips: Đúng 3 câu tiếng Anh gợi ý mở đầu cho người chơi.

ĐỊNH DẠNG ĐẦU RA BẮT BUỘC:
Trả về DUY NHẤT một đối tượng JSON hợp lệ (không dùng markdown code blocks, không giải thích ngoài JSON):
{
  "theme": "English Theme Title",
  "themeVi": "Tiêu Đề Tiếng Việt",
  "icon": "☕",
  "description": "Mô tả ngắn gọn về bài học hôm nay (tiếng Việt)",
  "vocabFocus": [
    {
      "word": "...",
      "ipa": "...",
      "meaning": "...",
      "distractorMeanings": ["...", "...", "..."],
      "example": "...",
      "exampleMeaning": "...",
      "collocations": ["...", "...", "..."],
      "realWorldPhrase": "...",
      "emoji": "..."
    }
  ],
  "grammarFocus": {
    "pattern": "...",
    "vietnamesePrompt": "...",
    "correctSentence": "...",
    "distractorWords": ["...", "...", "..."],
    "grammarTip": "...",
    "functionalCategory": "asking"
  },
  "voicePhrases": [
    {
      "sentence": "...",
      "translationVi": "...",
      "focusWord": "...",
      "ipa": "..."
    }
  ],
  "roleplay": {
    "npcName": "...",
    "npcTitle": "...",
    "npcEmoji": "...",
    "scenario": "...",
    "goal": "...",
    "openingLine": "...",
    "openingLineVi": "...",
    "targetKeywords": ["...", "...", "...", "..."],
    "starterChips": ["...", "...", "..."]
  }
}`;

  const userPrompt = `Hãy sinh toàn bộ nội dung Daily Challenge cho ngày ${dateStr} (${dayContext}). Trả về đúng định dạng JSON.`;

  return { systemPrompt, userPrompt };
}

/**
 * Tier 1: Call Google Gemini API with 6-second timeout via AbortController
 */
async function fetchGeminiDailyTheme(
  dateStr: string,
  dayOfWeek: number,
  apiKey: string,
  modelName: string = 'gemini-2.5-flash'
): Promise<DailyAiThemeResult> {
  const { systemPrompt, userPrompt } = buildDailyChallengePrompt(dateStr, dayOfWeek);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
          maxOutputTokens: 2500,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini HTTP ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini returned empty text output');
    }

    const parsed = cleanAndParseJson<Record<string, unknown>>(text);
    if (!parsed || typeof parsed.theme !== 'string' || !parsed.roleplay) {
      throw new Error('Invalid JSON structure from Gemini');
    }

    return {
      ...(parsed as unknown as DailyAiThemeResult),
      providerUsed: 'gemini',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tier 2: Call OpenRouter API with 6-second timeout via AbortController
 */
async function fetchOpenRouterDailyTheme(
  dateStr: string,
  dayOfWeek: number,
  apiKey: string,
  modelName: string = 'google/gemini-2.0-flash-001'
): Promise<DailyAiThemeResult> {
  const { systemPrompt, userPrompt } = buildDailyChallengePrompt(dateStr, dayOfWeek);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://engverse.app',
        'X-Title': 'EngVerse Daily Theme Generator',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2500,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter HTTP ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('OpenRouter returned empty text output');
    }

    const parsed = cleanAndParseJson<Record<string, unknown>>(text);
    if (!parsed || typeof parsed.theme !== 'string' || !parsed.roleplay) {
      throw new Error('Invalid JSON structure from OpenRouter');
    }

    return {
      ...(parsed as unknown as DailyAiThemeResult),
      providerUsed: 'openrouter',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tier 3: Deterministic Preset Fallback
 */
function getPresetTheme(dayOfWeek: number): DailyAiThemeResult {
  const preset = DAILY_PRESET_THEMES.find((t) => t.dayOfWeek === dayOfWeek) || DAILY_PRESET_THEMES[1]!;
  return {
    theme: preset.theme,
    themeVi: preset.themeVi,
    icon: preset.icon,
    description: preset.description,
    roleplay: preset.roleplay,
    providerUsed: 'preset_fallback',
  };
}

/**
 * In-memory 24h cache for Daily AI Themes by date (YYYY-MM-DD)
 */
const dailyAiThemeCache = new Map<string, DailyAiThemeResult>();

/**
 * Retrieves cached AI theme or generates new theme through resilient 3-tier pipeline
 */
export async function getOrGenerateDailyAiTheme(
  dateStr: string,
  dayOfWeek: number,
  options?: DailyAiGenerationOptions
): Promise<DailyAiThemeResult> {
  // 1. Check in-memory 24h cache (Rule 2: 0 redundant reads/calls)
  if (dailyAiThemeCache.has(dateStr)) {
    return dailyAiThemeCache.get(dateStr)!;
  }

  let result: DailyAiThemeResult | null = null;

  // 2. Tier 1: Gemini API
  if (options?.geminiApiKey) {
    try {
      result = await fetchGeminiDailyTheme(
        dateStr,
        dayOfWeek,
        options.geminiApiKey,
        options.geminiModel || 'gemini-2.5-flash'
      );
    } catch (geminiErr) {
      console.warn('[DailyThemeAI] Gemini generation failed, switching to OpenRouter:', geminiErr);
    }
  }

  // 3. Tier 2: OpenRouter Smart Fallback
  if (!result && options?.openrouterApiKey) {
    try {
      result = await fetchOpenRouterDailyTheme(
        dateStr,
        dayOfWeek,
        options.openrouterApiKey
      );
    } catch (openRouterErr) {
      console.warn('[DailyThemeAI] OpenRouter fallback failed, switching to Preset:', openRouterErr);
    }
  }

  // 4. Tier 3: Deterministic Preset Fallback
  if (!result) {
    result = getPresetTheme(dayOfWeek);
  }

  // 5. Store in 24h cache for today
  dailyAiThemeCache.set(dateStr, result);

  return result;
}

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
 * Generates an end-to-end Daily Challenge bundle with personalized SRS Queue
 */
export async function generateDailyChallenge(
  dateStr: string = getVietnamDateString(),
  srsVocabIds: string[] = [],
  aiOptions?: DailyAiGenerationOptions
): Promise<DailyChallengeData> {
  const dateObj = new Date(dateStr + 'T00:00:00Z');
  const dayOfWeek = isNaN(dateObj.getUTCDay()) ? 1 : dateObj.getUTCDay();

  // 1. Obtain AI-generated or Preset Theme
  const aiTheme = await getOrGenerateDailyAiTheme(dateStr, dayOfWeek, aiOptions);

  // 2. Load all stages across 3 universes (Kids, Teens, Adults)
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
  // Phase 1: Vocab Sprint (6 words - 50% SRS Queue + 50% AI Theme / Stages)
  // -------------------------------------------------------------------------
  const vocabSprint: DailyVocabSprintItem[] = [];
  const pickedWordsSet = new Set<string>();

  // 1A. Pick up to 3 words from user's SRS Boss Queue (Spaced Repetition priority)
  if (srsVocabIds && srsVocabIds.length > 0) {
    const srsSet = new Set(srsVocabIds);
    const matchedSrs = allVocabs.filter((v) => srsSet.has(v.id) || srsSet.has(v.word.toLowerCase()));
    const shuffledSrs = seededShuffle(matchedSrs).slice(0, 3);

    for (const v of shuffledSrs) {
      pickedWordsSet.add(v.word.toLowerCase());
      const otherMeanings = allVocabs
        .filter((other) => other.id !== v.id && other.meaning !== v.meaning)
        .map((other) => other.meaning);
      const shuffledMeanings = seededShuffle(otherMeanings).slice(0, 3);

      vocabSprint.push({
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
      });
    }
  }

  // 1B. Add words from AI-generated theme vocabFocus
  if (aiTheme.vocabFocus && Array.isArray(aiTheme.vocabFocus)) {
    for (const aiV of aiTheme.vocabFocus) {
      if (vocabSprint.length >= 6) break;
      if (!pickedWordsSet.has(aiV.word.toLowerCase())) {
        pickedWordsSet.add(aiV.word.toLowerCase());
        vocabSprint.push({
          id: `v_daily_ai_${dateStr}_${vocabSprint.length + 1}`,
          word: aiV.word,
          ipa: aiV.ipa,
          meaning: aiV.meaning,
          collocations: aiV.collocations ? [...aiV.collocations] : undefined,
          realWorldPhrase: aiV.realWorldPhrase,
          emoji: aiV.emoji || aiTheme.icon,
          distractorMeanings: aiV.distractorMeanings.slice(0, 3),
        });
      }
    }
  }

  // 1C. Fill remaining slots from allVocabs to guarantee strictly 6 items
  if (vocabSprint.length < 6) {
    const remainingCount = 6 - vocabSprint.length;
    const availableVocabs = allVocabs.filter((v) => !pickedWordsSet.has(v.word.toLowerCase()));
    const randomPicks = seededShuffle(availableVocabs).slice(0, remainingCount);

    for (const v of randomPicks) {
      pickedWordsSet.add(v.word.toLowerCase());
      const otherMeanings = allVocabs
        .filter((other) => other.id !== v.id && other.meaning !== v.meaning)
        .map((other) => other.meaning);
      const shuffledMeanings = seededShuffle(otherMeanings).slice(0, 3);

      vocabSprint.push({
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
      });
    }
  }

  // -------------------------------------------------------------------------
  // Phase 2: Grammar Flash (4 puzzles)
  // -------------------------------------------------------------------------
  const grammarFlash: DailyGrammarFlashItem[] = [];

  // 2A. Prepend AI-generated contextual grammar puzzle if available
  if (aiTheme.grammarFocus) {
    grammarFlash.push({
      id: `g_daily_ai_${dateStr}`,
      grammarPattern: aiTheme.grammarFocus.pattern,
      vietnamesePrompt: aiTheme.grammarFocus.vietnamesePrompt,
      correctSentence: aiTheme.grammarFocus.correctSentence,
      distractorWords: aiTheme.grammarFocus.distractorWords,
      grammarTip: aiTheme.grammarFocus.grammarTip,
      functionalCategory: aiTheme.grammarFocus.functionalCategory,
    });
  }

  // 2B. Fill remaining slots up to 4 from stages grammar pool
  const neededGrammar = 4 - grammarFlash.length;
  const shuffledGrammar = seededShuffle(allGrammar).slice(0, neededGrammar);
  for (const g of shuffledGrammar) {
    grammarFlash.push({
      id: g.id,
      grammarPattern: g.grammarPattern,
      vietnamesePrompt: g.vietnamesePrompt,
      correctSentence: g.correctSentence,
      distractorWords: g.distractorWords || ['is', 'are', 'not'],
      grammarTip: g.grammarTip || 'Chú ý cấu trúc câu và thì ngữ pháp.',
      functionalCategory: g.functionalCategory,
    });
  }

  // -------------------------------------------------------------------------
  // Phase 3: Voice Challenge (3 read-aloud phrases)
  // -------------------------------------------------------------------------
  let voiceChallenge: DailyVoiceChallengeItem[] = [];

  // 3A. Use AI-generated voice phrases if provided
  if (aiTheme.voicePhrases && Array.isArray(aiTheme.voicePhrases) && aiTheme.voicePhrases.length >= 3) {
    voiceChallenge = aiTheme.voicePhrases.slice(0, 3).map((v, idx) => ({
      id: `daily_voice_ai_${dateStr}_${idx + 1}`,
      sentence: v.sentence,
      translationVi: v.translationVi,
      focusWord: v.focusWord,
      ipa: v.ipa,
    }));
  } else {
    // 3B. Fallback to high-quality realWorldPhrases from stages
    const vocabsWithPhrases = allVocabs.filter(
      (v) => (v.realWorldPhrase && v.realWorldPhrase.trim().length > 5) || (v.example && v.example.trim().length > 5)
    );
    const selectedVoiceVocabs = seededShuffle(vocabsWithPhrases).slice(0, 3);
    voiceChallenge = selectedVoiceVocabs.map((v, idx) => ({
      id: `daily_voice_${v.id}_${idx + 1}`,
      sentence: v.realWorldPhrase || v.example,
      translationVi: v.exampleMeaning || v.meaning,
      focusWord: v.word,
      ipa: v.ipa,
    }));
  }

  // -------------------------------------------------------------------------
  // Phase 4: Quick Roleplay (3 turns)
  // -------------------------------------------------------------------------
  const quickRoleplay: DailyQuickRoleplayConfig = {
    theme: aiTheme.theme,
    npcName: aiTheme.roleplay.npcName,
    npcTitle: aiTheme.roleplay.npcTitle,
    npcEmoji: aiTheme.roleplay.npcEmoji,
    scenario: aiTheme.roleplay.scenario,
    goal: aiTheme.roleplay.goal,
    openingLine: aiTheme.roleplay.openingLine,
    openingLineVi: aiTheme.roleplay.openingLineVi,
    targetKeywords: aiTheme.roleplay.targetKeywords,
    starterChips: aiTheme.roleplay.starterChips,
    maxTurns: 3,
  };

  return {
    date: dateStr,
    dayOfWeek,
    theme: aiTheme.theme,
    themeVi: aiTheme.themeVi,
    icon: aiTheme.icon,
    description: aiTheme.description,
    vocabSprint,
    grammarFlash,
    voiceChallenge,
    quickRoleplay,
  };
}
