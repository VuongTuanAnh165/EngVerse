/**
 * EngVerse - Robust Multi-Platform Speech Engine Composable
 * Combines High-Fidelity Text-to-Speech (TTS), Fuzzy Speech-to-Text (STT)
 * using Levenshtein distance, and Golden Fallback "Rhythm Tap" mechanics.
 *
 * Strict TypeScript (0 any), 100% memory leak free, SSR-safe.
 * Reference: docs/ke_hoach.md - Sprint 3, Task 1
 */

import { ref, computed, onMounted, onScopeDispose } from 'vue';
import type {
  SpeechPlaybackRate,
  SpeechEngineMode,
  SpeechRecognitionState,
  TtsOptions,
  SpeechEvaluationResult,
  RhythmSyllableItem,
  RhythmTapState,
  ISpeechRecognition,
  ISpeechRecognitionEvent,
  ISpeechRecognitionErrorEvent,
  SpeechRecognitionConstructor,
} from '~/types/speech';
import { HIGH_QUALITY_VOICE_PREFERENCES } from '~/types/speech';

/**
 * Normalizes text for audio comparison by stripping punctuation and extraneous spaces
 */
export function normalizeSpeechText(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accent diacritics if any accidental
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates Levenshtein Distance between two strings with O(min(m, n)) space complexity
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  const strA = a.toLowerCase();
  const strB = b.toLowerCase();

  const lenA = strA.length;
  const lenB = strB.length;

  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;
  if (strA === strB) return 0;

  // Optimize memory by ensuring strB is the shorter string
  let s1 = strA;
  let s2 = strB;
  let m = lenA;
  let n = lenB;

  if (m < n) {
    s1 = strB;
    s2 = strA;
    m = lenB;
    n = lenA;
  }

  const prevRow: number[] = Array.from({ length: n + 1 }, (_, idx) => idx);
  const currRow: number[] = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    const char1 = s1.charCodeAt(i - 1);

    for (let j = 1; j <= n; j++) {
      const prevJ = prevRow[j] ?? 0;
      const currPrev = currRow[j - 1] ?? 0;
      const prevPrev = prevRow[j - 1] ?? 0;
      const cost = char1 === s2.charCodeAt(j - 1) ? 0 : 1;
      currRow[j] = Math.min(
        prevJ + 1, // deletion
        currPrev + 1, // insertion
        prevPrev + cost // substitution
      );
    }

    for (let j = 0; j <= n; j++) {
      prevRow[j] = currRow[j] ?? 0;
    }
  }

  return prevRow[n] ?? 0;
}

/**
 * Evaluates speech transcript against expected target and optional accepted variants
 */
export function evaluateSpeechFuzzy(
  recognizedText: string,
  expectedTarget: string,
  acceptedVariants: string[] = [],
  threshold: number = 75
): SpeechEvaluationResult {
  const normRec = normalizeSpeechText(recognizedText);
  const normExp = normalizeSpeechText(expectedTarget);

  if (!normRec) {
    return {
      recognizedText,
      expectedText: expectedTarget,
      matchedVariant: expectedTarget,
      score: 0,
      levenshteinDistance: normExp.length,
      isPassed: false,
      threshold,
      feedbackVi: 'Chưa nhận diện được âm thanh. Hãy thử lại!',
    };
  }

  // Create pool of all valid answer variants
  const candidates: string[] = [normExp];
  for (const variant of acceptedVariants) {
    const normVar = normalizeSpeechText(variant);
    if (normVar && !candidates.includes(normVar)) {
      candidates.push(normVar);
    }
  }

  let bestScore = 0;
  let bestDistance = Number.MAX_SAFE_INTEGER;
  let bestMatched = expectedTarget;

  for (const candidate of candidates) {
    const dist = calculateLevenshteinDistance(normRec, candidate);
    const maxLen = Math.max(normRec.length, candidate.length);

    let similarity = maxLen > 0 ? (1 - dist / maxLen) * 100 : 0;

    // Bonus check: If target word is cleanly contained within recognized sentence
    // (e.g. recognized "a strawberry" when target is "strawberry")
    const words = normRec.split(' ');
    const candidateWords = candidate.split(' ');
    if (words.length > candidateWords.length && normRec.includes(candidate)) {
      const containmentScore = 85;
      if (containmentScore > similarity) {
        similarity = containmentScore;
      }
    }

    const roundedScore = Math.min(100, Math.max(0, Math.round(similarity)));

    if (roundedScore > bestScore || (roundedScore === bestScore && dist < bestDistance)) {
      bestScore = roundedScore;
      bestDistance = dist;
      bestMatched = candidate;
    }
  }

  const isPassed = bestScore >= threshold;

  let feedbackVi = 'Phát âm rất xuất sắc!';
  if (bestScore < 40) {
    feedbackVi = 'Phát âm chưa chính xác. Hãy nghe lại giọng mẫu nhé!';
  } else if (bestScore < threshold) {
    feedbackVi = 'Gần đúng rồi! Hãy chú ý âm đuôi và phát âm rõ hơn một chút.';
  } else if (bestScore < 90) {
    feedbackVi = 'Khá tốt! Bạn đã vượt qua thử thách phát âm.';
  }

  return {
    recognizedText,
    expectedText: expectedTarget,
    matchedVariant: bestMatched,
    score: bestScore,
    levenshteinDistance: bestDistance,
    isPassed,
    threshold,
    feedbackVi,
  };
}

/**
 * Intelligent fallback syllable splitter for English words
 */
export function splitWordIntoSyllables(word: string): string[] {
  const clean = word.trim();
  if (!clean) return [];

  // If word contains hyphens, use those
  if (clean.includes('-')) {
    return clean.split('-').map((s) => s.trim()).filter(Boolean);
  }

  // If multi-word phrase, split into individual words
  if (clean.includes(' ')) {
    return clean.split(/\s+/).filter(Boolean);
  }

  // Heuristic syllable segmenter for single words
  const normalized = clean.toLowerCase();
  const vowelRegex = /[aeiouy]{1,2}/g;
  const matches = [...normalized.matchAll(vowelRegex)];

  if (matches.length <= 1) {
    return [clean];
  }

  const result: string[] = [];
  let lastIndex = 0;

  for (let i = 0; i < matches.length - 1; i++) {
    const currentMatch = matches[i];
    const nextMatch = matches[i + 1];
    if (
      currentMatch &&
      nextMatch &&
      currentMatch.index !== undefined &&
      nextMatch.index !== undefined
    ) {
      const midPoint = Math.floor((currentMatch.index + currentMatch[0].length + nextMatch.index) / 2);
      result.push(clean.slice(lastIndex, midPoint));
      lastIndex = midPoint;
    }
  }
  result.push(clean.slice(lastIndex));

  return result.filter(Boolean);
}

/**
 * Fisher-Yates array shuffler
 */
function shuffleArray<T>(array: T[]): T[] {
  const result: T[] = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const itemI = result[i];
    const itemJ = result[j];
    if (itemI !== undefined && itemJ !== undefined) {
      result[i] = itemJ;
      result[j] = itemI;
    }
  }
  return result;
}

export function useSpeechEngine() {
  // -------------------------------------------------------------------------
  // 1. Text-to-Speech (TTS) Reactive State
  // -------------------------------------------------------------------------
  const availableVoices = ref<SpeechSynthesisVoice[]>([]);
  const selectedVoice = ref<SpeechSynthesisVoice | null>(null);
  const playbackRate = ref<SpeechPlaybackRate>(1.0);
  const isSpeaking = ref<boolean>(false);
  const isTtsSupported = ref<boolean>(false);

  // -------------------------------------------------------------------------
  // 2. Speech-to-Text (STT) Reactive State
  // -------------------------------------------------------------------------
  const isSttSupported = ref<boolean>(false);
  const recognitionState = ref<SpeechRecognitionState>('idle');
  const hasPermissionDenied = ref<boolean>(false);
  const currentTranscript = ref<string>('');
  const currentConfidence = ref<number>(0);
  const lastEvaluation = ref<SpeechEvaluationResult | null>(null);

  // Active Recognition Engine Instance
  let recognitionInstance: ISpeechRecognition | null = null;
  let activeExpectation: {
    target: string;
    variants: string[];
    threshold: number;
    onResult?: (res: SpeechEvaluationResult) => void;
    onError?: (err: string) => void;
  } | null = null;

  // -------------------------------------------------------------------------
  // 3. Golden Fallback: Rhythm Tap State
  // -------------------------------------------------------------------------
  const mode = ref<SpeechEngineMode>('voice');
  const rhythmState = ref<RhythmTapState | null>(null);
  let wrongTapTimeout: ReturnType<typeof setTimeout> | null = null;

  const isListening = computed(() => recognitionState.value === 'listening');

  // Fallback mode is active when user explicitly switched, or browser denies mic/lacks support
  const isFallbackMode = computed(() => {
    return (
      mode.value === 'rhythm_fallback' ||
      !isSttSupported.value ||
      hasPermissionDenied.value
    );
  });

  // -------------------------------------------------------------------------
  // TTS Voice Discovery & Selection Logic
  // -------------------------------------------------------------------------
  function discoverBestVoice(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      isTtsSupported.value = false;
      return;
    }

    isTtsSupported.value = true;
    const voices = window.speechSynthesis.getVoices();
    availableVoices.value = voices;

    if (voices.length === 0) return;

    // Filter English voices
    const englishVoices = voices.filter(
      (v) => v.lang.startsWith('en-') || v.lang.startsWith('en_') || v.lang === 'en'
    );

    // 1. Try to match preferred high-quality voices
    for (const pref of HIGH_QUALITY_VOICE_PREFERENCES) {
      const match = englishVoices.find((v) => v.name.toLowerCase().includes(pref.toLowerCase()));
      if (match) {
        selectedVoice.value = match;
        return;
      }
    }

    // 2. Try default en-US voice
    const defaultEnUs = englishVoices.find(
      (v) => v.lang === 'en-US' && (v.default || v.localService)
    );
    if (defaultEnUs) {
      selectedVoice.value = defaultEnUs;
      return;
    }

    // 3. Fallback to any en voice or first available voice
    selectedVoice.value = englishVoices[0] || voices[0] || null;
  }

  /**
   * Speak sample sentence or vocabulary word with high-fidelity TTS
   */
  function speak(text: string, options?: TtsOptions): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve(false);
        return;
      }

      if (!text || text.trim().length === 0) {
        resolve(false);
        return;
      }

      try {
        // Cancel any pending speech before starting new one
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = options?.rate ?? playbackRate.value;
        utterance.pitch = options?.pitch ?? 1.0;
        utterance.volume = options?.volume ?? 1.0;
        utterance.lang = options?.lang ?? 'en-US';

        if (selectedVoice.value) {
          utterance.voice = selectedVoice.value;
        }

        utterance.onstart = () => {
          isSpeaking.value = true;
        };

        utterance.onend = () => {
          isSpeaking.value = false;
          resolve(true);
        };

        utterance.onerror = (e) => {
          // 'canceled' is intentional when switching speech; don't treat as critical error
          if (e.error !== 'canceled') {
            console.warn('[useSpeechEngine] TTS error:', e.error);
          }
          isSpeaking.value = false;
          resolve(false);
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('[useSpeechEngine] Failed to execute TTS speak:', err);
        isSpeaking.value = false;
        resolve(false);
      }
    });
  }

  function stopSpeaking(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isSpeaking.value = false;
  }

  function setPlaybackRate(rate: SpeechPlaybackRate): void {
    playbackRate.value = rate;
  }

  function togglePlaybackRate(): void {
    playbackRate.value = playbackRate.value === 1.0 ? 0.75 : 1.0;
  }

  // -------------------------------------------------------------------------
  // STT Speech Recognition Initialization & Controller
  // -------------------------------------------------------------------------
  function initSpeechRecognition(): void {
    if (typeof window === 'undefined') return;

    const SpeechRecConstructor: SpeechRecognitionConstructor | undefined =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;

    if (!SpeechRecConstructor) {
      isSttSupported.value = false;
      recognitionState.value = 'unsupported';
      mode.value = 'rhythm_fallback';
      return;
    }

    isSttSupported.value = true;

    try {
      const recognition = new SpeechRecConstructor();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;

      recognition.onstart = () => {
        recognitionState.value = 'listening';
        currentTranscript.value = '';
        currentConfidence.value = 0;
      };

      recognition.onresult = (event: ISpeechRecognitionEvent) => {
        let interimText = '';
        let finalText = '';
        let highestConfidence = 0;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (!res || !res[0]) continue;
          if (res.isFinal) {
            finalText += res[0].transcript;
            highestConfidence = Math.max(highestConfidence, res[0].confidence || 0.85);
          } else {
            interimText += res[0].transcript;
          }
        }

        const activeText = (finalText || interimText).trim();
        currentTranscript.value = activeText;
        currentConfidence.value = highestConfidence;

        // If speech recognition produced final transcript, trigger evaluation
        if (finalText && activeExpectation) {
          recognitionState.value = 'processing';
          const evalResult = evaluateSpeechFuzzy(
            finalText,
            activeExpectation.target,
            activeExpectation.variants,
            activeExpectation.threshold
          );
          lastEvaluation.value = evalResult;
          recognitionState.value = evalResult.isPassed ? 'success' : 'error';

          if (activeExpectation.onResult) {
            activeExpectation.onResult(evalResult);
          }
        }
      };

      recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
        console.warn('[useSpeechEngine] Speech recognition error:', event.error);

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          hasPermissionDenied.value = true;
          recognitionState.value = 'permission_denied';
          // Golden Fallback: Automatically shift to Rhythm Tap
          mode.value = 'rhythm_fallback';
          if (activeExpectation?.onError) {
            activeExpectation.onError('Quyền micro bị từ chối. Đã chuyển sang chế độ Nhịp Điệu!');
          }
        } else if (event.error === 'no-speech') {
          recognitionState.value = 'idle';
          if (activeExpectation?.onError) {
            activeExpectation.onError('Chưa nghe thấy giọng nói. Hãy thử lại!');
          }
        } else if (event.error === 'aborted') {
          recognitionState.value = 'idle';
        } else {
          recognitionState.value = 'error';
          if (activeExpectation?.onError) {
            activeExpectation.onError('Không thể nhận diện giọng nói. Vui lòng thử lại.');
          }
        }
      };

      recognition.onend = () => {
        if (recognitionState.value === 'listening') {
          // If was listening and ended without final result, evaluate what we have
          if (currentTranscript.value && activeExpectation) {
            recognitionState.value = 'processing';
            const evalResult = evaluateSpeechFuzzy(
              currentTranscript.value,
              activeExpectation.target,
              activeExpectation.variants,
              activeExpectation.threshold
            );
            lastEvaluation.value = evalResult;
            recognitionState.value = evalResult.isPassed ? 'success' : 'error';
            if (activeExpectation.onResult) {
              activeExpectation.onResult(evalResult);
            }
          } else {
            recognitionState.value = 'idle';
          }
        }
      };

      recognitionInstance = recognition;
    } catch (err) {
      console.error('[useSpeechEngine] Initialization error:', err);
      isSttSupported.value = false;
      recognitionState.value = 'unsupported';
      mode.value = 'rhythm_fallback';
    }
  }

  /**
   * Start listening for player's speech to evaluate against expected text
   */
  function startListening(
    expectedText: string,
    options?: {
      acceptedVariants?: string[];
      threshold?: number;
      onResult?: (res: SpeechEvaluationResult) => void;
      onError?: (err: string) => void;
    }
  ): void {
    // If fallback mode is active, do not try microphone
    if (isFallbackMode.value) {
      initRhythmChallenge(expectedText);
      return;
    }

    if (!recognitionInstance) {
      initSpeechRecognition();
    }

    if (!recognitionInstance || !isSttSupported.value) {
      mode.value = 'rhythm_fallback';
      initRhythmChallenge(expectedText);
      return;
    }

    activeExpectation = {
      target: expectedText,
      variants: options?.acceptedVariants || [],
      threshold: options?.threshold ?? 75,
      onResult: options?.onResult,
      onError: options?.onError,
    };

    currentTranscript.value = '';
    lastEvaluation.value = null;

    try {
      recognitionInstance.abort();
      recognitionInstance.start();
    } catch (err) {
      console.warn('[useSpeechEngine] Failed to start recognition instance:', err);
      // If error occurs (e.g. already started), abort and restart safely
      try {
        recognitionInstance.abort();
        setTimeout(() => {
          recognitionInstance?.start();
        }, 100);
      } catch {
        mode.value = 'rhythm_fallback';
        initRhythmChallenge(expectedText);
      }
    }
  }

  function stopListening(): void {
    if (recognitionInstance && recognitionState.value === 'listening') {
      try {
        recognitionInstance.stop();
      } catch {
        recognitionInstance.abort();
      }
    }
  }

  function abortListening(): void {
    if (recognitionInstance) {
      try {
        recognitionInstance.abort();
      } catch {
        // no-op
      }
    }
    recognitionState.value = 'idle';
  }

  // -------------------------------------------------------------------------
  // 4. Golden Fallback: Rhythm Tap Engine
  // -------------------------------------------------------------------------
  /**
   * Initializes a Rhythm Tap mini-challenge for the target word
   */
  function initRhythmChallenge(targetWord: string, customSyllables?: string[]): RhythmTapState {
    if (wrongTapTimeout) {
      clearTimeout(wrongTapTimeout);
      wrongTapTimeout = null;
    }

    const syllables =
      customSyllables && customSyllables.length > 0
        ? customSyllables
        : splitWordIntoSyllables(targetWord);

    const items: RhythmSyllableItem[] = syllables.map((syl, idx) => ({
      id: `syl_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      syllable: syl,
      originalIndex: idx,
      isTapped: false,
      isCurrentTarget: idx === 0,
    }));

    // Shuffle syllables so player has to tap them in order
    const shuffled = items.length > 1 ? shuffleArray(items) : items;

    const state: RhythmTapState = {
      targetWord,
      originalSyllables: syllables,
      shuffledSyllables: shuffled,
      currentIndex: 0,
      isCompleted: false,
      wrongTapIndex: null,
      tapAttempts: 0,
    };

    rhythmState.value = state;

    // Automatically speak the target word once so player hears the rhythm
    void speak(targetWord);

    return state;
  }

  /**
   * Handles user tapping a syllable button in Rhythm Tap mode
   */
  function tapRhythmSyllable(
    syllableItem: RhythmSyllableItem
  ): { isCorrect: boolean; isComplete: boolean; isAlreadyTapped: boolean } {
    if (!rhythmState.value || rhythmState.value.isCompleted) {
      return { isCorrect: false, isComplete: false, isAlreadyTapped: false };
    }

    if (syllableItem.isTapped) {
      return { isCorrect: false, isComplete: false, isAlreadyTapped: true };
    }

    rhythmState.value.tapAttempts++;

    // Check if the tapped syllable is the expected next item
    if (syllableItem.originalIndex === rhythmState.value.currentIndex) {
      syllableItem.isTapped = true;
      rhythmState.value.currentIndex++;

      // Update current target indicator
      for (const item of rhythmState.value.shuffledSyllables) {
        item.isCurrentTarget = item.originalIndex === rhythmState.value.currentIndex;
      }

      // Speak syllable for auditory feedback
      void speak(syllableItem.syllable, { rate: 1.25 });

      // Check for completion
      if (rhythmState.value.currentIndex >= rhythmState.value.originalSyllables.length) {
        rhythmState.value.isCompleted = true;
        recognitionState.value = 'success';

        const evalResult: SpeechEvaluationResult = {
          recognizedText: rhythmState.value.targetWord,
          expectedText: rhythmState.value.targetWord,
          matchedVariant: rhythmState.value.targetWord,
          score: 100,
          levenshteinDistance: 0,
          isPassed: true,
          threshold: 75,
          feedbackVi: 'Tuyệt vời! Bạn đã bắt đúng nhịp điệu của từ!',
        };

        lastEvaluation.value = evalResult;

        if (activeExpectation?.onResult) {
          activeExpectation.onResult(evalResult);
        }

        return { isCorrect: true, isComplete: true, isAlreadyTapped: false };
      }

      return { isCorrect: true, isComplete: false, isAlreadyTapped: false };
    } else {
      // Incorrect tap: visual bump and brief timeout
      rhythmState.value.wrongTapIndex = syllableItem.originalIndex;
      if (wrongTapTimeout) clearTimeout(wrongTapTimeout);

      wrongTapTimeout = setTimeout(() => {
        if (rhythmState.value) {
          rhythmState.value.wrongTapIndex = null;
        }
      }, 500);

      return { isCorrect: false, isComplete: false, isAlreadyTapped: false };
    }
  }

  function resetRhythmChallenge(): void {
    if (!rhythmState.value) return;
    initRhythmChallenge(rhythmState.value.targetWord, rhythmState.value.originalSyllables);
  }

  function switchToVoiceMode(): void {
    mode.value = 'voice';
    hasPermissionDenied.value = false;
  }

  function switchToFallbackMode(): void {
    mode.value = 'rhythm_fallback';
    if (activeExpectation) {
      initRhythmChallenge(activeExpectation.target);
    }
  }

  // -------------------------------------------------------------------------
  // 5. Lifecycle & Zero-Memory-Leak Cleanup
  // -------------------------------------------------------------------------
  onMounted(() => {
    discoverBestVoice();
    initSpeechRecognition();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        discoverBestVoice();
      };
    }
  });

  onScopeDispose(() => {
    stopSpeaking();
    abortListening();

    if (wrongTapTimeout) {
      clearTimeout(wrongTapTimeout);
      wrongTapTimeout = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = null;
    }

    activeExpectation = null;
    recognitionInstance = null;
  });

  return {
    // Mode & Capabilities
    mode,
    isFallbackMode,
    isSttSupported,
    isTtsSupported,
    hasPermissionDenied,

    // Text-to-Speech
    availableVoices,
    selectedVoice,
    playbackRate,
    isSpeaking,
    speak,
    stopSpeaking,
    setPlaybackRate,
    togglePlaybackRate,
    discoverBestVoice,

    // Speech-to-Text
    recognitionState,
    isListening,
    currentTranscript,
    currentConfidence,
    lastEvaluation,
    startListening,
    stopListening,
    abortListening,

    // Fuzzy Matching Utilities
    normalizeText: normalizeSpeechText,
    levenshteinDistance: calculateLevenshteinDistance,
    evaluateSpeech: evaluateSpeechFuzzy,

    // Golden Fallback: Rhythm Tap
    rhythmState,
    initRhythmChallenge,
    tapRhythmSyllable,
    resetRhythmChallenge,
    switchToVoiceMode,
    switchToFallbackMode,
  };
}
