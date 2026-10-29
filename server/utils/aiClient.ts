/**
 * EngVerse - Robust AI Client with Smart Fallback Engine
 * Hierarchical Multi-Model Dispatcher:
 * 1. Primary: Google Gemini Flash (Sub-1.2s response, 6s timeout via AbortController)
 * 2. Secondary: OpenRouter API (Smart Fallback on 429, 503, 404 or timeout)
 * 3. Tertiary: Deterministic Offline Rule-Based Fallback (Zero crash guarantee)
 *
 * Strict TypeScript (0 any), Server-only.
 * Reference: docs/ke_hoach.md - Sprint 4, Task 2 & Rules.md Rule 5
 */

import type {
  AiRawModelResponse,
  AiChatMessage,
  AiProviderUsed,
  AiRoleplayPayload,
} from '~/types/ai';

export interface AiCallOptions {
  systemInstruction: string;
  slidingWindow: AiChatMessage[];
  playerInput: string;
  geminiApiKey?: string;
  geminiModel?: string;
  openrouterApiKey?: string;
  openrouterModel?: string;
  payload: AiRoleplayPayload;
  timeoutMs?: number;
}

export interface AiCallResult {
  response: AiRawModelResponse;
  providerUsed: AiProviderUsed;
  latencyMs: number;
  usedFallback: boolean;
  errorLog?: string[];
}

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
 * Strips markdown code fences from JSON output
 */
export function sanitizeAndParseJson(rawText: string): AiRawModelResponse | null {
  try {
    let text = rawText.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(text) as Record<string, unknown>;

    if (typeof parsed.npcReply === 'string') {
      return {
        npcReply: parsed.npcReply,
        vietnameseHint: typeof parsed.vietnameseHint === 'string' ? parsed.vietnameseHint : '',
        grammarCorrection:
          typeof parsed.grammarCorrection === 'string' ? parsed.grammarCorrection : '',
        scoreDelta: typeof parsed.scoreDelta === 'number' ? parsed.scoreDelta : 25,
        isMissionCompleted: Boolean(parsed.isMissionCompleted),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Executes deterministic offline fallback using stage keywords
 */
export function executeOfflineRuleBasedFallback(
  payload: AiRoleplayPayload,
  sanitizedInput: string
): AiRawModelResponse {
  const mission = payload.aiMission;
  const keywords =
    mission.targetKeywords ||
    mission.recommendedWords ||
    mission.offlineFallback?.requiredKeywords ||
    [];

  const lowerInput = sanitizedInput.toLowerCase();
  const matchedKeywords = keywords.filter((k) => lowerInput.includes(k.toLowerCase()));

  const hasMatched = matchedKeywords.length > 0 || lowerInput.split(' ').length >= 3;
  const isComplete =
    matchedKeywords.length >= 2 || (hasMatched && payload.conversationHistory.length >= 3);

  if (isComplete) {
    return {
      npcReply:
        mission.offlineFallback?.successReply ||
        `Impressive! You accomplished the mission: "${mission.goal}". Well done!`,
      vietnameseHint: 'Bạn đã hoàn thành xuất sắc thử thách nhập vai!',
      grammarCorrection: '',
      scoreDelta: 50,
      isMissionCompleted: true,
    };
  }

  if (hasMatched) {
    return {
      npcReply: `I see what you mean. Now continue and tell me more about ${keywords[0] || 'your goal'}!`,
      vietnameseHint: `Gợi ý: Thử dùng từ "${keywords[0] || 'please'}" để hoàn thành nhiệm vụ!`,
      grammarCorrection: '',
      scoreDelta: 25,
      isMissionCompleted: false,
    };
  }

  return {
    npcReply:
      mission.offlineFallback?.retryReply ||
      `Can you say that in English? Tell me how you will achieve: ${mission.goal}`,
    vietnameseHint: `Hãy cố gắng diễn đạt bằng tiếng Anh và sử dụng từ gợi ý: ${keywords.slice(0, 2).join(', ')}`,
    grammarCorrection: '',
    scoreDelta: 10,
    isMissionCompleted: false,
  };
}

/**
 * Layer 1: Call Google Gemini Flash API with 6-second AbortController
 */
export async function callGeminiApi(
  systemInstruction: string,
  slidingWindow: AiChatMessage[],
  playerInput: string,
  apiKey: string,
  modelName: string = 'gemini-2.5-flash',
  timeoutMs: number = 6000
): Promise<AiRawModelResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Add sliding window turns
    for (const msg of slidingWindow) {
      contents.push({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    // Add current player input wrapped in guardrail tag
    contents.push({
      role: 'user',
      parts: [{ text: `<player_input>${playerInput}</player_input>` }],
    });

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

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
        contents,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
          maxOutputTokens: 300,
        },
      },
      {
        'Content-Type': 'application/json',
      },
      controller.signal
    );

    const rawOutput = res.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawOutput) {
      throw new Error('[Gemini] Empty candidate output received.');
    }

    const parsed = sanitizeAndParseJson(rawOutput);
    if (!parsed) {
      throw new Error(`[Gemini] Failed to parse model output as JSON: ${rawOutput.slice(0, 80)}`);
    }

    return parsed;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Layer 2: Smart Fallback - Call OpenRouter API with 6-second AbortController
 */
export async function callOpenRouterApi(
  systemInstruction: string,
  slidingWindow: AiChatMessage[],
  playerInput: string,
  apiKey: string,
  modelName: string = 'google/gemini-2.0-flash-001',
  timeoutMs: number = 6000
): Promise<AiRawModelResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const messages = [
      { role: 'system', content: systemInstruction },
      ...slidingWindow.map((m) => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.content,
      })),
      { role: 'user', content: `<player_input>${playerInput}</player_input>` },
    ];

    const res = await httpPostJson<{
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    }>(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: modelName,
        messages,
        response_format: { type: 'json_object' },
        max_tokens: 300,
        temperature: 0.7,
      },
      {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://engverse.app',
        'X-Title': 'EngVerse AI Roleplay',
      },
      controller.signal
    );

    const content = res.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('[OpenRouter] Empty choices content received.');
    }

    const parsed = sanitizeAndParseJson(content);
    if (!parsed) {
      throw new Error(`[OpenRouter] Failed to parse model output as JSON: ${content.slice(0, 80)}`);
    }

    return parsed;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Master Smart Fallback Dispatcher
 * Automatically transitions through Gemini -> OpenRouter -> Offline with high resilience
 */
export async function callAiWithSmartFallback(options: AiCallOptions): Promise<AiCallResult> {
  const startTime = Date.now();
  const errorLog: string[] = [];

  const timeoutMs = options.timeoutMs ?? 6000;
  const geminiApiKey = options.geminiApiKey;
  const geminiModel = options.geminiModel || 'gemini-2.5-flash';
  const openrouterApiKey = options.openrouterApiKey;
  const openrouterModel = options.openrouterModel || 'google/gemini-2.0-flash-001';

  // -------------------------------------------------------------------------
  // 1. Primary Attempt: Google Gemini Flash
  // -------------------------------------------------------------------------
  if (geminiApiKey) {
    try {
      const response = await callGeminiApi(
        options.systemInstruction,
        options.slidingWindow,
        options.playerInput,
        geminiApiKey,
        geminiModel,
        timeoutMs
      );

      return {
        response,
        providerUsed: 'gemini',
        latencyMs: Date.now() - startTime,
        usedFallback: false,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isTimeout = errMsg.includes('aborted') || errMsg.includes('AbortError');
      const isRateLimit = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');
      const isServiceUnavailable = errMsg.includes('503') || errMsg.includes('500');
      const isNotFound = errMsg.includes('404');
      const isAuthError = errMsg.includes('400') || errMsg.includes('403') || errMsg.includes('API_KEY_INVALID');

      const reasonTag = isTimeout
        ? 'TIMEOUT (>6s)'
        : isRateLimit
        ? 'RATE_LIMIT (429)'
        : isServiceUnavailable
        ? 'SERVICE_UNAVAILABLE (503)'
        : isNotFound
        ? 'MODEL_NOT_FOUND (404)'
        : isAuthError
        ? 'AUTH_ERROR (400/403)'
        : 'NETWORK_ERROR';

      const logMsg = `[SmartFallback] Gemini ${reasonTag}: ${errMsg}`;
      console.warn(logMsg);
      errorLog.push(logMsg);
    }
  } else {
    errorLog.push('[SmartFallback] Gemini API key not configured.');
  }

  // -------------------------------------------------------------------------
  // 2. Secondary Attempt: OpenRouter Smart Fallback
  // -------------------------------------------------------------------------
  if (openrouterApiKey) {
    try {
      console.info('[SmartFallback] Seamlessly pivoting to OpenRouter fallback...');
      const response = await callOpenRouterApi(
        options.systemInstruction,
        options.slidingWindow,
        options.playerInput,
        openrouterApiKey,
        openrouterModel,
        timeoutMs
      );

      return {
        response,
        providerUsed: 'openrouter',
        latencyMs: Date.now() - startTime,
        usedFallback: true,
        errorLog,
      };
    } catch (openRouterErr: unknown) {
      const openRouterMsg = openRouterErr instanceof Error ? openRouterErr.message : String(openRouterErr);
      const logMsg = `[SmartFallback] OpenRouter fallback failed: ${openRouterMsg}`;
      console.warn(logMsg);
      errorLog.push(logMsg);
    }
  } else {
    errorLog.push('[SmartFallback] OpenRouter API key not configured.');
  }

  // -------------------------------------------------------------------------
  // 3. Tertiary Attempt: Deterministic Offline Rule-Based Fallback
  // -------------------------------------------------------------------------
  console.info('[SmartFallback] Both AI APIs unavailable. Activating Deterministic Offline Engine...');
  const offlineResponse = executeOfflineRuleBasedFallback(options.payload, options.playerInput);

  return {
    response: offlineResponse,
    providerUsed: 'offline',
    latencyMs: Date.now() - startTime,
    usedFallback: true,
    errorLog,
  };
}

