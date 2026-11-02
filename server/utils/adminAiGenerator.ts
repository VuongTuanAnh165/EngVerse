/**
 * EngVerse - Admin AI Co-Pilot Stage Generator
 * Multi-Tier Resilient Architecture:
 * 1. Tier 1: Google Gemini (gemini-3.8-flash / gemini-3.1-pro-preview)
 * 2. Tier 2: Groq API (openai/gpt-oss-120b - sub-second generation)
 * 3. Tier 3: OpenRouter API (Fallback)
 *
 * Strict TypeScript (0 any), Server-only.
 * Reference: docs/plan_admin_cms.md & .antigravity/rules.md
 */

import type { WorldTrack } from '~/types/user';
import type {
  StageData,
  StageVocabItem,
  StageGrammarItem,
  CardRarity,
  PartOfSpeech,
  FunctionalGrammarCategory,
  AiRoleplayPlotTwist,
} from '~/types/game';
import type { AdminAiGeneratePayload } from '~/types/admin';

function getTrackInitial(track: WorldTrack): 'k' | 't' | 'a' {
  switch (track) {
    case 'kids':
      return 'k';
    case 'teens':
      return 't';
    case 'adults':
      return 'a';
  }
}

export interface AdminAiGenerateResult {
  stage: StageData;
  providerUsed: 'gemini' | 'groq' | 'openrouter';
  latencyMs: number;
}

/**
 * Builds the comprehensive generation prompt with strict JSON schema instructions
 */
function buildStageGenerationPrompt(options: AdminAiGeneratePayload): { system: string; user: string } {
  const { topic, worldTrack, cefrLevel = 'A1', vocabCount = 8 } = options;

  let universeContext = '';
  switch (worldTrack) {
    case 'kids':
      universeContext = 'Vũ trụ 1: Đảo Thần Thoại (Kids 5-12 tuổi). Không khí vui nhộn, kỳ ảo, rồng con, sinh vật phép thuật, hoa quả màu sắc, từ ngữ dễ nhớ, phát âm rõ ràng.';
      break;
    case 'teens':
      universeContext = 'Vũ trụ 2: Cyber City (Teens 13-18 tuổi). Không khí khoa học viễn tưởng, cyberpunk, công nghệ cao, hacker, AI, robot, tiếng lóng trẻ trung, năng động.';
      break;
    case 'adults':
      universeContext = 'Vũ trụ 3: SimLife Global (Người lớn 18+). Bối cảnh thực tế: công sở quốc tế, giao dịch, sân bay, đàm phán hợp đồng, du lịch, nhà hàng, phong thái chuyên nghiệp.';
      break;
  }

  const system = `Bạn là Giám đốc Học thuật & Trưởng Ban Thiết Kế Game tại EngVerse (Nền tảng Web Game học tiếng Anh đa vũ trụ).
Nhiệm vụ của bạn là tạo trọn gói 1 bài học / chặng thử thách (Stage) hoàn chỉnh dựa trên chủ đề được cung cấp.

BỐI CẢNH VŨ TRỤ:
${universeContext}

YÊU CẦU NỘI DUNG:
1. Trình độ mục tiêu: CEFR ${cefrLevel}.
2. Từ vựng (vocabPool): Đúng chính xác ${vocabCount} từ vựng tiếng Anh thực tế xoay quanh chủ đề.
   - Phiên âm IPA chuẩn xác quốc tế (ví dụ: /ˈdræɡ.ən/).
   - 3 nghĩa gây nhiễu (distractorMeanings) phải cùng loại từ và gần gũi nhưng không đúng nghĩa, phục vụ làm câu hỏi trắc nghiệm mini-game.
   - Câu ví dụ có ngữ cảnh hay, dịch nghĩa tiếng Việt chuẩn xác.
   - collocations: Đúng 3 cụm từ tiếng Anh cố định (situational chunks) hay đi kèm từ này (ví dụ: ["baby dragon", "dragon egg", "fire-breathing dragon"]).
   - realWorldPhrase: 1 câu giao tiếp đời thực tự nhiên chứa từ vựng (ví dụ: "Look at the cute baby dragon sleeping inside the egg!").
   - synonyms: 1-3 từ đồng nghĩa tiếng Anh phổ biến (nếu có).
   - 1 từ có cardRarity là "legendary" hoặc "epic", 2-3 từ "rare", các từ còn lại là "common".
   - Gán 1 emoji thích hợp cho mỗi từ.
3. Ngữ pháp (grammarPool): Đúng 3 câu đố sắp xếp câu (Sentence Lock Puzzle).
   - vietnamesePrompt: Câu tiếng Việt tự nhiên.
   - correctSentence: Câu tiếng Anh chuẩn xác.
   - distractorWords: 3-5 từ gây nhiễu để xáo trộn cho người chơi chọn.
   - grammarTip: Mẹo giải thích cấu trúc ngắn gọn, dễ hiểu.
   - functionalCategory: Phân loại chức năng giao tiếp thực tế, chọn 1 trong: "asking", "refusing", "apologizing", "persuading", "clarifying", "describing", "narrating", "negotiating", "complaining", "thanking".
4. Kịch bản AI Nhập vai (aiRoleplayMission):
   - Một nhân vật NPC ảo phù hợp chủ đề (npcName, npcTitle, npcEmoji).
   - scenario: Mô tả bối cảnh tình huống hấp dẫn bằng tiếng Việt.
   - openingLine: Lời thoại mở đầu của NPC bằng tiếng Anh.
   - openingLineVi: Dịch nghĩa câu mở đầu bằng tiếng Việt.
   - goal: Mục tiêu người chơi cần đạt được khi giao tiếp bằng tiếng Việt.
   - targetKeywords: 4-6 từ khóa tiếng Anh bắt buộc người chơi phải nói ra trong hội thoại.
   - starterChips: 3 câu gợi ý tiếng Anh cho người chơi bắt đầu.
   - maxTurns: Số lượt hội thoại tối đa (6 cho màn thường, 8 cho màn Boss).
   - plotTwist: Biến cố bất ngờ kịch tính kích hoạt sau lượt 2:
     {
       "triggerAfterTurn": 2,
       "twistScenario": "Kịch bản biến cố tiếng Anh cho AI context",
       "twistLineVi": "Lời thoại / tình huống biến cố tiếng Việt cho người học",
       "bonusKeywords": ["từ_khóa_1", "từ_khóa_2"]
     }

QUY TẮC BẮT BUỘC:
Trả về DUY NHẤT một chuỗi JSON hợp lệ, KHÔNG bọc trong markdown code fence, KHÔNG thêm bất kỳ lời dẫn nào ngoài JSON.`;

  const user = `Hãy tạo 1 chặng thử thách hoàn chỉnh với:
- Chủ đề: "${topic}"
- Vũ trụ: ${worldTrack}
- Trình độ CEFR: ${cefrLevel}
- Số lượng từ vựng: ${vocabCount} từ.`;

  return { system, user };
}

/**
 * Strips code fences and parses JSON safely
 */
function cleanAndParseJson<T>(raw: string): T {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return JSON.parse(cleaned) as T;
}

/**
 * Layer 1: Call Google Gemini Flash
 */
async function callGemini(
  system: string,
  user: string,
  apiKey: string,
  modelName: string = 'gemini-3.8-flash'
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 16000);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
          maxOutputTokens: 3500,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini trả về phản hồi rỗng.');
    }

    return cleanAndParseJson<Record<string, unknown>>(text);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Layer 2: Call Groq API
 */
async function callGroq(
  system: string,
  user: string,
  apiKey: string,
  modelName: string = 'openai/gpt-oss-120b'
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 3500,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('Groq trả về phản hồi rỗng.');
    }

    return cleanAndParseJson<Record<string, unknown>>(text);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Layer 3: Call OpenRouter API
 */
async function callOpenRouter(
  system: string,
  user: string,
  apiKey: string,
  modelName: string = 'google/gemini-2.0-flash-001'
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 14000);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://engverse.app',
        'X-Title': 'EngVerse Admin AI Generator',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 3500,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('OpenRouter trả về phản hồi rỗng.');
    }

    return cleanAndParseJson<Record<string, unknown>>(text);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normalizes raw LLM output into a strictly compliant StageData object
 */
export function normalizeGeneratedStage(
  raw: Record<string, unknown>,
  options: AdminAiGeneratePayload,
  nextStageId: number
): StageData {
  const track = options.worldTrack;
  const initial = getTrackInitial(track);
  const stageId = nextStageId;
  const chapter = options.chapter || Math.floor((stageId - 1) / 5) + 1;

  // 1. Normalize Vocabulary Items
  const rawVocab = Array.isArray(raw.vocabPool) ? raw.vocabPool : [];
  const vocabPool: StageVocabItem[] = rawVocab.map((item: Record<string, unknown>, idx: number) => {
    const itemNum = idx + 1;
    const idxStr = itemNum < 10 ? '0' + itemNum : String(itemNum);
    const vocabId = `v_${initial}_${stageId}${idxStr}`;
    const cardId = `card_${initial}_${stageId < 10 ? '0' + stageId : stageId}_${idxStr}`;

    const distractorMeanings = Array.isArray(item.distractorMeanings)
      ? item.distractorMeanings.map(String).slice(0, 3)
      : ['nghĩa khác 1', 'nghĩa khác 2', 'nghĩa khác 3'];

    while (distractorMeanings.length < 3) {
      distractorMeanings.push(`gợi ý gây nhiễu ${distractorMeanings.length + 1}`);
    }

    const rarity = (typeof item.cardRarity === 'string' && ['common', 'rare', 'epic', 'legendary'].includes(item.cardRarity)
      ? item.cardRarity
      : idx === 0 ? 'epic' : idx < 3 ? 'rare' : 'common') as CardRarity;

    return {
      id: vocabId,
      cardId,
      word: String(item.word || `word_${itemNum}`).toLowerCase().trim(),
      ipa: String(item.ipa || '/.../'),
      partOfSpeech: (item.partOfSpeech as PartOfSpeech) || 'noun',
      meaning: String(item.meaning || 'Nghĩa từ vựng'),
      distractorMeanings,
      example: String(item.example || 'Example sentence in English.'),
      exampleMeaning: String(item.exampleMeaning || 'Dịch nghĩa câu ví dụ.'),
      audioText: String(item.audioText || item.word || ''),
      emoji: String(item.emoji || '✨'),
      cardRarity: rarity,
      collocations: Array.isArray(item.collocations) ? item.collocations.map(String).slice(0, 3) : undefined,
      realWorldPhrase: typeof item.realWorldPhrase === 'string' && item.realWorldPhrase.trim() ? item.realWorldPhrase.trim() : undefined,
      synonyms: Array.isArray(item.synonyms) ? item.synonyms.map(String) : undefined,
    };
  });

  // 2. Normalize Grammar Items
  const rawGrammar = Array.isArray(raw.grammarPool) ? raw.grammarPool : [];
  const grammarPool: StageGrammarItem[] = rawGrammar.map((g: Record<string, unknown>, idx: number) => {
    const gNum = idx + 1;
    const distractorWords = Array.isArray(g.distractorWords)
      ? g.distractorWords.map(String)
      : ['a', 'the', 'is'];

    return {
      id: `g_${initial}_${stageId}${gNum}`,
      grammarPattern: String(g.grammarPattern || 'S + V + O'),
      vietnamesePrompt: String(g.vietnamesePrompt || 'Gợi ý câu tiếng Việt'),
      correctSentence: String(g.correctSentence || 'Target English sentence.'),
      distractorWords,
      grammarTip: String(g.grammarTip || 'Mẹo ngữ pháp ngắn gọn.'),
      functionalCategory: typeof g.functionalCategory === 'string' && g.functionalCategory.trim()
        ? (g.functionalCategory.trim() as FunctionalGrammarCategory)
        : undefined,
    };
  });

  // 3. Normalize AI Mission
  const rawAi = (raw.aiRoleplayMission as Record<string, unknown>) || {};
  const targetKeywords = Array.isArray(rawAi.targetKeywords)
    ? rawAi.targetKeywords.map(String)
    : vocabPool.slice(0, 4).map((v) => v.word);

  const starterChips = Array.isArray(rawAi.starterChips)
    ? rawAi.starterChips.map(String)
    : ['Hello!', 'I want to ask a question.', 'Thank you so much!'];

  let plotTwist: AiRoleplayPlotTwist | undefined;
  if (rawAi.plotTwist && typeof rawAi.plotTwist === 'object') {
    const pt = rawAi.plotTwist as Record<string, unknown>;
    plotTwist = {
      triggerAfterTurn: typeof pt.triggerAfterTurn === 'number' ? pt.triggerAfterTurn : 2,
      twistScenario: String(pt.twistScenario || ''),
      twistLineVi: String(pt.twistLineVi || ''),
      bonusKeywords: Array.isArray(pt.bonusKeywords) ? pt.bonusKeywords.map(String) : [],
    };
  }

  const aiRoleplayMission = {
    npcName: String(rawAi.npcName || 'NPC Guide'),
    npcTitle: String(rawAi.npcTitle || 'Người Hướng Dẫn'),
    npcEmoji: String(rawAi.npcEmoji || '🤖'),
    scenario: String(rawAi.scenario || `Tình huống luyện tập về chủ đề: ${options.topic}`),
    openingLine: String(rawAi.openingLine || 'Hello explorer! How can I help you today?'),
    openingLineVi: String(rawAi.openingLineVi || 'Xin chào nhà thám hiểm! Tôi có thể giúp gì cho bạn?'),
    goal: String(rawAi.goal || `Hoàn thành mục tiêu hội thoại bằng tiếng Anh.`),
    targetKeywords,
    recommendedWords: targetKeywords,
    starterChips,
    maxTurns: typeof rawAi.maxTurns === 'number' ? rawAi.maxTurns : (options.isBossStage ? 8 : 6),
    passScore: typeof rawAi.passScore === 'number' ? rawAi.passScore : (options.isBossStage ? 75 : 65),
    plotTwist,
  };

  // 4. Guaranteed Card ID
  const highestRarityCard = [...vocabPool].sort((a, b) => {
    const p: Record<string, number> = { legendary: 4, epic: 3, rare: 2, common: 1 };
    return (p[b.cardRarity] || 1) - (p[a.cardRarity] || 1);
  })[0];

  return {
    stageId,
    chapter,
    worldTrack: track,
    cefrLevel: options.cefrLevel || 'A1',
    title: String(raw.title || `Thử Thách: ${options.topic}`),
    subtitle: String(raw.subtitle || `Chinh phục bài học về ${options.topic}`),
    isBossStage: Boolean(raw.isBossStage),
    themeColor: String(raw.themeColor || (track === 'kids' ? '#f59e0b' : track === 'teens' ? '#8b5cf6' : '#3b82f6')),
    mapPosition: { x: 50, y: 50 },
    storyIntro: String(raw.storyIntro || `Chào mừng bạn bước vào chặng ${options.topic}!`),
    reward: {
      baseExp: 120,
      baseGold: 60,
      firstClearBonusGold: 40,
      guaranteedCardId: highestRarityCard?.cardId || vocabPool[0]?.cardId || '',
    },
    config: {
      vocabPickCount: Math.min(4, vocabPool.length),
      grammarPickCount: Math.min(3, grammarPool.length),
      voicePassThreshold: 0.7,
      timeLimitSeconds: 90,
    },
    vocabPool,
    grammarPool,
    aiRoleplayMission,
  };
}

/**
 * Master Dispatcher: Generates Stage with 3-Tier Fallback Resilience
 */
export async function generateStageWithAi(
  options: AdminAiGeneratePayload,
  nextStageId: number
): Promise<AdminAiGenerateResult> {
  const startTime = Date.now();
  let runtimeConfig: Record<string, unknown> = {};
  try {
    if (typeof useRuntimeConfig === 'function') {
      runtimeConfig = useRuntimeConfig() as unknown as Record<string, unknown>;
    }
  } catch {
    // Standalone Node context
  }

  const geminiKey = (runtimeConfig.geminiApiKey as string) || process.env.GEMINI_API_KEY || '';
  const geminiModel = (runtimeConfig.geminiModel as string) || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const groqKey = (runtimeConfig.groqApiKey as string) || process.env.GROQ_API_KEY || '';
  const openrouterKey = (runtimeConfig.openrouterApiKey as string) || process.env.OPENROUTER_API_KEY || '';

  const { system, user } = buildStageGenerationPrompt(options);

  // -------------------------------------------------------------------------
  // Tier 1: Google Gemini (geminiModel)
  // -------------------------------------------------------------------------
  if (geminiKey) {
    try {
      console.info(`[AdminAiGenerator] Calling Tier 1: Gemini (${geminiModel})...`);
      const rawOutput = await callGemini(system, user, geminiKey, geminiModel);
      const stage = normalizeGeneratedStage(rawOutput, options, nextStageId);
      return {
        stage,
        providerUsed: 'gemini',
        latencyMs: Date.now() - startTime,
      };
    } catch (geminiErr) {
      console.warn('[AdminAiGenerator] Gemini Tier 1 failed, trying fallback model or tier:', geminiErr instanceof Error ? geminiErr.message : geminiErr);
      // Try alternate gemini model if main model was 503
      try {
        const altModel = geminiModel === 'gemini-3.8-flash' ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash';
        console.info(`[AdminAiGenerator] Retrying with Gemini alternate (${altModel})...`);
        const rawOutput = await callGemini(system, user, geminiKey, altModel);
        const stage = normalizeGeneratedStage(rawOutput, options, nextStageId);
        return {
          stage,
          providerUsed: 'gemini',
          latencyMs: Date.now() - startTime,
        };
      } catch (geminiAltErr) {
        console.warn('[AdminAiGenerator] Gemini alternate also failed:', geminiAltErr instanceof Error ? geminiAltErr.message : geminiAltErr);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Tier 2: Groq High-Speed API (openai/gpt-oss-120b)
  // -------------------------------------------------------------------------
  if (groqKey) {
    try {
      console.info('[AdminAiGenerator] Fallback to Tier 2: Groq High-Speed...');
      const rawOutput = await callGroq(system, user, groqKey, 'openai/gpt-oss-120b');
      const stage = normalizeGeneratedStage(rawOutput, options, nextStageId);
      return {
        stage,
        providerUsed: 'groq',
        latencyMs: Date.now() - startTime,
      };
    } catch (groqErr) {
      console.warn('[AdminAiGenerator] Groq Tier 2 failed:', groqErr instanceof Error ? groqErr.message : groqErr);
    }
  }

  // -------------------------------------------------------------------------
  // Tier 3: OpenRouter API
  // -------------------------------------------------------------------------
  if (openrouterKey) {
    try {
      console.info('[AdminAiGenerator] Fallback to Tier 3: OpenRouter API...');
      const rawOutput = await callOpenRouter(system, user, openrouterKey, 'google/gemini-2.0-flash-001');
      const stage = normalizeGeneratedStage(rawOutput, options, nextStageId);
      return {
        stage,
        providerUsed: 'openrouter',
        latencyMs: Date.now() - startTime,
      };
    } catch (orErr) {
      console.warn('[AdminAiGenerator] OpenRouter Tier 3 failed:', orErr instanceof Error ? orErr.message : orErr);
    }
  }

  throw new Error('Tất cả các dịch vụ AI (Gemini, Groq, OpenRouter) đều gặp sự cố hoặc chưa cấu hình API Key.');
}
