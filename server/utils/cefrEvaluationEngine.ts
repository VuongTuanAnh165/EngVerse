/**
 * EngVerse - CEFR Scorecard Evaluation Engine
 * Authoritative evaluation engine assessing lifelong conversational simulations
 * across 4 core dimensions:
 * 1. Lexical Resource (0–100, upgrades, vocabulary diversity)
 * 2. Grammatical Accuracy (0–100, error analysis, bilingual explanations)
 * 3. Pronunciation & Fluency (0–100, phoneme flags, fluency rating)
 * 4. Communicative Competence (0–100, goal achievement, strengths & weaknesses)
 *
 * Strict TypeScript (0 any), Server-only, 3-tier smart fallback.
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.4, IV & Task 4.3
 */

import type {
  FreeSimEvaluatePayload,
  CEFRScorecard,
  CEFRLevel,
} from '~/types/freeSimulator';

/**
 * Universal isomorphic JSON POST fetcher supporting Nitro $fetch and native fetch
 */
async function httpPostJson<T>(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  signal: AbortSignal
): Promise<T> {
  const nitroFetch = (globalThis as unknown as { $fetch?: (u: string, o: unknown) => Promise<T> }).$fetch;
  if (typeof nitroFetch === 'function') {
    return await nitroFetch(url, {
      method: 'POST',
      signal,
      headers,
      body,
    });
  }

  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorText}`);
  }

  return (await response.json()) as T;
}

/**
 * Strips markdown code fences and validates CEFRScorecard schema
 */
export function sanitizeAndParseScorecard(rawText: string): CEFRScorecard | null {
  try {
    let text = rawText.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(text) as Record<string, unknown>;

    const validLevels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const overallLevel = typeof parsed.overallLevel === 'string' && validLevels.includes(parsed.overallLevel as CEFRLevel)
      ? (parsed.overallLevel as CEFRLevel)
      : 'B1';

    const overallScore = typeof parsed.overallScore === 'number'
      ? Math.min(100, Math.max(0, parsed.overallScore))
      : 75;

    const summary = typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
      ? parsed.summary.trim()
      : 'Bạn đã hoàn thành tốt phiên đàm thoại và thể hiện năng lực phản xạ tiếng Anh tự nhiên.';

    // 1. Lexical Resource
    const rawLex = (parsed.lexicalResource || {}) as Record<string, unknown>;
    const lexicalResource = {
      score: typeof rawLex.score === 'number' ? Math.min(100, Math.max(0, rawLex.score)) : 75,
      wordsUsed: Array.isArray(rawLex.wordsUsed)
        ? rawLex.wordsUsed.filter((w): w is string => typeof w === 'string')
        : [],
      suggestedUpgrades: Array.isArray(rawLex.suggestedUpgrades)
        ? rawLex.suggestedUpgrades
            .filter((u): u is { original: string; upgraded: string; contextVi: string } => {
              return typeof u === 'object' && u !== null && 'original' in u && 'upgraded' in u;
            })
            .slice(0, 5)
        : [],
    };

    // 2. Grammatical Accuracy
    const rawGram = (parsed.grammaticalAccuracy || {}) as Record<string, unknown>;
    const grammaticalAccuracy = {
      score: typeof rawGram.score === 'number' ? Math.min(100, Math.max(0, rawGram.score)) : 75,
      errorsFound: Array.isArray(rawGram.errorsFound)
        ? rawGram.errorsFound
            .filter((e): e is { userSaid: string; corrected: string; explanation: string } => {
              return typeof e === 'object' && e !== null && 'userSaid' in e && 'corrected' in e;
            })
            .slice(0, 5)
        : [],
    };

    // 3. Pronunciation & Fluency
    const rawPron = (parsed.pronunciation || {}) as Record<string, unknown>;
    const validRatings = ['choppy', 'fair', 'smooth', 'native-like'] as const;
    const fluencyRating = typeof rawPron.fluencyRating === 'string' && (validRatings as readonly string[]).includes(rawPron.fluencyRating)
      ? (rawPron.fluencyRating as 'choppy' | 'fair' | 'smooth' | 'native-like')
      : 'fair';

    const pronunciation = {
      score: typeof rawPron.score === 'number' ? Math.min(100, Math.max(0, rawPron.score)) : 80,
      fluencyRating,
      problematicSounds: Array.isArray(rawPron.problematicSounds)
        ? rawPron.problematicSounds.filter((s): s is string => typeof s === 'string')
        : ['/θ/', '/ð/'],
    };

    // 4. Communicative Competence
    const rawComm = (parsed.communicativeCompetence || {}) as Record<string, unknown>;
    const communicativeCompetence = {
      score: typeof rawComm.score === 'number' ? Math.min(100, Math.max(0, rawComm.score)) : 80,
      strengths: Array.isArray(rawComm.strengths)
        ? rawComm.strengths.filter((s): s is string => typeof s === 'string').slice(0, 3)
        : ['Phản xạ tự nhiên trước câu hỏi', 'Duy trì mạch đối thoại liên tục'],
      areasToImprove: Array.isArray(rawComm.areasToImprove)
        ? rawComm.areasToImprove.filter((a): a is string => typeof a === 'string').slice(0, 3)
        : ['Mở rộng thêm các từ nối học thuật', 'Đa dạng hóa thì và cấu trúc câu'],
    };

    return {
      overallLevel,
      overallScore,
      summary,
      lexicalResource,
      grammaticalAccuracy,
      pronunciation,
      communicativeCompetence,
    };
  } catch {
    return null;
  }
}

/**
 * Builds the comprehensive CEFR Evaluation System Prompt
 */
export function buildCefrEvaluationPrompt(payload: FreeSimEvaluatePayload): string {
  const userTurns = payload.conversationHistory
    .filter((m) => m.role === 'user')
    .map((m, idx) => `Turn ${idx + 1}: "${m.content}"`)
    .join('\n');

  const fullDialogue = payload.conversationHistory
    .map((m) => `${m.role === 'user' ? 'USER' : 'NPC'}: "${m.content}"`)
    .join('\n');

  const recommendedVocabStr = (payload.recommendedVocab || [])
    .map((v) => `"${v.word}" (${v.meaningVi})`)
    .join(', ');

  const objectivesStr = (payload.objectives || []).map((o, idx) => `${idx + 1}. ${o}`).join('\n');

  return `Bạn là Giám khảo Khảo thí Ngôn ngữ Quốc tế (Certified CEFR Language Assessor) hàng đầu của hệ thống "EngVerse".
Nhiệm vụ của bạn là đánh giá toàn diện năng lực tiếng Anh của người chơi sau một phiên đàm thoại giả lập thực tế.

THÔNG TIN PHIÊN GIẢ LẬP:
- Tình huống: "${payload.scenarioTitle}"
- Danh mục: "${payload.category}"
- Vai trò người chơi: "${payload.userRole}"
- Vai trò đối tác (NPC): "${payload.npcRole}"
- Chuẩn CEFR kỳ vọng: "${payload.targetCefr}"
- Tổng số lượt đàm thoại: ${payload.turnsCount}
- Mục tiêu cần đạt:
${objectivesStr || 'Giao tiếp giải quyết tình huống'}

DANH SÁCH TỪ VỰNG THEN CHỐT ĐÃ ĐỀ XUẤT:
${recommendedVocabStr || 'Không có'}

TOÀN BỘ CÁC CÂU NÓI CỦA NGƯỜI CHƠI (USER UTTERANCES):
${userTurns || 'Không có lượt nói'}

TOÀN CẢNH CUỘC HỘI THOẠI (FULL TRANSCRIPT):
${fullDialogue}

HÃY ĐÁNH GIÁ NGHIÊM NGẶT DỰA TRÊN 4 TIÊU CHUẨN KHẢO THÍ CEFR QUỐC TẾ:
1. Lexical Resource (0–100): Đánh giá vốn từ vựng, độ phong phú, tính chính xác và việc sử dụng các collocations/từ khóa. Đưa ra 2-4 đề xuất nâng cấp từ vựng (ví dụ: thay "good" bằng "outstanding", thay "problem" bằng "bottleneck").
2. Grammatical Accuracy (0–100): Phân tích các lỗi sai ngữ pháp (thì, chia động từ, giới từ, mạo từ, trật tự từ). Trích dẫn nguyên văn "userSaid", cung cấp "corrected" và "explanation" bằng tiếng Việt dễ hiểu.
3. Pronunciation & Fluency (0–100): Đánh giá độ trôi chảy dựa trên độ dài câu và cấu trúc, gán nhãn fluencyRating ('choppy' | 'fair' | 'smooth' | 'native-like') và liệt kê các âm IPA người học thường phát âm sai (problematicSounds e.g. ["/θ/", "/ð/"]).
4. Communicative Competence (0–100): Đánh giá khả năng hoàn thành mục tiêu tình huống, sự tương tác tự nhiên. Nêu 2-3 điểm mạnh và 2-3 điểm cần cải thiện.
5. Overall CEFR Level: Xác định cấp độ chính xác ('A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2') kèm overallScore (0-100) và 1 tóm tắt ngắn (summary) bằng tiếng Việt.

HÃY TRẢ VỀ DUY NHẤT MỘT ĐỐI TƯỢNG JSON HỢP LỆ VỚI SCHEMA SAU (KHÔNG DÙNG MARKDOWN CODE FENCE HAY LỜI MỞ ĐẦU):
{
  "overallLevel": "B1",
  "overallScore": 78,
  "summary": "Tóm tắt nhận xét tổng quan bằng tiếng Việt (1-2 câu súc tích)",
  "lexicalResource": {
    "score": 75,
    "wordsUsed": ["reservation", "upgrade"],
    "suggestedUpgrades": [
      {
        "original": "good room",
        "upgraded": "quiet deluxe suite",
        "contextVi": "Nâng cấp diễn đạt phòng nghỉ sang trọng và cụ thể hơn"
      }
    ]
  },
  "grammaticalAccuracy": {
    "score": 72,
    "errorsFound": [
      {
        "userSaid": "I have booking for tonight",
        "corrected": "I have a reservation for tonight",
        "explanation": "Cần mạo từ 'a' trước danh từ đếm được số ít, dùng 'reservation' tự nhiên hơn trong khách sạn"
      }
    ]
  },
  "pronunciation": {
    "score": 80,
    "fluencyRating": "fair",
    "problematicSounds": ["/θ/", "/ð/"]
  },
  "communicativeCompetence": {
    "score": 85,
    "strengths": ["Phản hồi tự tin", "Hiểu đúng ý đối phương"],
    "areasToImprove": ["Cần mở rộng câu dài hơn", "Chú ý mạo từ a/an/the"]
  }
}`;
}

/**
 * Deterministic offline rule-based CEFR evaluation algorithm
 */
export function executeOfflineCefrEvaluation(payload: FreeSimEvaluatePayload): CEFRScorecard {
  const userMessages = payload.conversationHistory.filter((m) => m.role === 'user');
  const userText = userMessages.map((m) => m.content).join(' ');
  const words = userText.toLowerCase().split(/\s+/).filter(Boolean);
  const uniqueWords = new Set(words);

  const totalWords = words.length;
  const lexicalDiversity = totalWords > 0 ? uniqueWords.size / totalWords : 0.5;

  // Match recommended vocabulary
  const matchedVocab = (payload.recommendedVocab || [])
    .filter((v) => userText.toLowerCase().includes(v.word.toLowerCase()))
    .map((v) => v.word);

  // Compute sub-scores
  let lexicalScore = Math.min(95, Math.max(50, Math.round(55 + matchedVocab.length * 10 + lexicalDiversity * 30)));
  let grammarScore = 75;
  let fluencyScore = 78;
  let commScore = 80;

  // Infer CEFR Level
  let overallLevel: CEFRLevel = 'B1';
  if (totalWords >= 80 && matchedVocab.length >= 3) {
    overallLevel = 'B2';
    lexicalScore = Math.max(lexicalScore, 82);
    grammarScore = 80;
    fluencyScore = 85;
    commScore = 88;
  } else if (totalWords >= 120 && matchedVocab.length >= 4) {
    overallLevel = 'C1';
    lexicalScore = Math.max(lexicalScore, 90);
    grammarScore = 88;
    fluencyScore = 90;
    commScore = 92;
  } else if (totalWords < 25) {
    overallLevel = 'A2';
    lexicalScore = Math.min(lexicalScore, 65);
    grammarScore = 68;
    fluencyScore = 65;
    commScore = 70;
  }

  const overallScore = Math.round(
    lexicalScore * 0.3 + grammarScore * 0.3 + fluencyScore * 0.2 + commScore * 0.2
  );

  const upgrades = [
    {
      original: 'I want',
      upgraded: 'I would appreciate it if',
      contextVi: 'Diễn đạt lời yêu cầu lịch sự và tinh tế hơn trong giao tiếp quốc tế',
    },
    {
      original: 'help me',
      upgraded: 'assist me with',
      contextVi: 'Sử dụng động từ trang trọng hơn phù hợp môi trường làm việc',
    },
  ];

  return {
    overallLevel,
    overallScore,
    summary: `Bạn đã hoàn thành xuất sắc tình huống "${payload.scenarioTitle}" đạt cấp độ CEFR ${overallLevel}. Khả năng tương tác tự nhiên và phản xạ câu linh hoạt!`,
    lexicalResource: {
      score: lexicalScore,
      wordsUsed: matchedVocab.length > 0 ? matchedVocab : ['please', 'thank you', 'reservation'],
      suggestedUpgrades: upgrades,
    },
    grammaticalAccuracy: {
      score: grammarScore,
      errorsFound: [],
    },
    pronunciation: {
      score: fluencyScore,
      fluencyRating: overallLevel === 'B2' || overallLevel === 'C1' ? 'smooth' : 'fair',
      problematicSounds: ['/θ/', '/ð/', '/ʃ/'],
    },
    communicativeCompetence: {
      score: commScore,
      strengths: [
        'Duy trì mạch đàm thoại liên tục từ đầu đến cuối phiên',
        'Tương tác đúng trọng tâm mục tiêu của kịch bản',
      ],
      areasToImprove: [
        'Thử áp dụng thêm các liên từ kết nối câu phức (Although, Furthermore)',
        'Rèn luyện phát âm chính xác các âm đuôi (ending sounds)',
      ],
    },
  };
}

/**
 * Dispatches evaluation across Gemini -> OpenRouter -> Offline Engine
 */
export async function dispatchCefrEvaluation(
  payload: FreeSimEvaluatePayload,
  config: {
    geminiApiKey?: string;
    geminiModel?: string;
    openrouterApiKey?: string;
    openrouterModel?: string;
    timeoutMs?: number;
  }
): Promise<{
  scorecard: CEFRScorecard;
  providerUsed: 'gemini' | 'openrouter' | 'offline_rule_engine';
  latencyMs: number;
  usedFallback: boolean;
}> {
  const startTime = Date.now();
  const timeoutMs = config.timeoutMs ?? 6000;
  const systemInstruction = buildCefrEvaluationPrompt(payload);

  // Tier 1: Gemini API
  if (config.geminiApiKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel || 'gemini-2.5-flash'}:generateContent?key=${config.geminiApiKey}`;

      const res = await httpPostJson<{
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      }>(
        endpoint,
        {
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: 'Evaluate this completed conversation and generate the detailed CEFR Scorecard in JSON format.' }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3,
            maxOutputTokens: 800,
          },
        },
        {
          'Content-Type': 'application/json',
        },
        controller.signal
      );

      const rawText = res.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = sanitizeAndParseScorecard(rawText);
        if (parsed) {
          return {
            scorecard: parsed,
            providerUsed: 'gemini',
            latencyMs: Date.now() - startTime,
            usedFallback: false,
          };
        }
      }
    } catch (err: unknown) {
      console.warn('[CefrEval] Gemini failed, attempting OpenRouter fallback:', err);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Tier 2: OpenRouter API Fallback
  if (config.openrouterApiKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const endpoint = 'https://openrouter.ai/api/v1/chat/completions';

      const res = await httpPostJson<{
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      }>(
        endpoint,
        {
          model: config.openrouterModel || 'google/gemini-2.0-flash-001',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: 'Generate the CEFR Scorecard evaluation JSON.' },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 800,
        },
        {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openrouterApiKey}`,
          'HTTP-Referer': 'https://engverse.app',
          'X-Title': 'EngVerse CEFR Evaluation',
        },
        controller.signal
      );

      const rawText = res.choices?.[0]?.message?.content;
      if (rawText) {
        const parsed = sanitizeAndParseScorecard(rawText);
        if (parsed) {
          return {
            scorecard: parsed,
            providerUsed: 'openrouter',
            latencyMs: Date.now() - startTime,
            usedFallback: true,
          };
        }
      }
    } catch (err: unknown) {
      console.warn('[CefrEval] OpenRouter failed, attempting offline engine:', err);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Tier 3: Deterministic Offline Rule-Based Fallback
  console.info('[CefrEval] Using deterministic offline scorecard engine.');
  const offlineScorecard = executeOfflineCefrEvaluation(payload);

  return {
    scorecard: offlineScorecard,
    providerUsed: 'offline_rule_engine',
    latencyMs: Date.now() - startTime,
    usedFallback: true,
  };
}

