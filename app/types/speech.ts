/**
 * EngVerse - Speech Engine Types & Interfaces
 * Comprehensive type definitions for Web Speech API (TTS & STT),
 * Fuzzy Matching (Levenshtein), and Rhythm Tap Fallback Mechanics.
 * Reference: docs/ke_hoach.md - Sprint 3, Task 1
 */

export type SpeechPlaybackRate = 0.75 | 1.0 | 1.25 | 1.5;

export type SpeechEngineMode = 'voice' | 'rhythm_fallback';

export type SpeechRecognitionState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'success'
  | 'error'
  | 'unsupported'
  | 'permission_denied';

/**
 * Text-to-Speech configuration options
 */
export interface TtsOptions {
  rate?: SpeechPlaybackRate | number;
  pitch?: number;
  volume?: number;
  lang?: string;
  voiceName?: string;
}

/**
 * Result returned by the fuzzy Levenshtein evaluator
 */
export interface SpeechEvaluationResult {
  recognizedText: string;
  expectedText: string;
  matchedVariant: string;
  score: number; // 0 to 100
  levenshteinDistance: number;
  isPassed: boolean;
  threshold: number; // e.g. 75
  feedbackVi: string;
}

/**
 * Individual syllable piece for Rhythm Tap fallback mode
 */
export interface RhythmSyllableItem {
  id: string;
  syllable: string;
  originalIndex: number;
  isTapped: boolean;
  isCurrentTarget: boolean;
}

/**
 * State of the Rhythm Tap fallback game
 */
export interface RhythmTapState {
  targetWord: string;
  originalSyllables: string[];
  shuffledSyllables: RhythmSyllableItem[];
  currentIndex: number;
  isCompleted: boolean;
  wrongTapIndex: number | null;
  tapAttempts: number;
}

/**
 * High quality voice recommendation list
 */
export const HIGH_QUALITY_VOICE_PREFERENCES: string[] = [
  'Google US English',
  'Samantha',
  'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft Jenny Online (Natural) - English (United States)',
  'Microsoft Guy Online (Natural) - English (United States)',
  'Microsoft Zira - English (United States)',
  'Daniel',
  'Karen',
  'Victoria',
];

/**
 * Browser SpeechRecognition Web API interface definitions
 * Compliant with W3C Web Speech API Specification
 */
export interface ISpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface ISpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: ISpeechRecognitionAlternative;
}

export interface ISpeechRecognitionResultList {
  length: number;
  [index: number]: ISpeechRecognitionResult;
}

export interface ISpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: ISpeechRecognitionResultList;
}

export interface ISpeechRecognitionErrorEvent extends Event {
  error:
    | 'no-speech'
    | 'aborted'
    | 'audio-capture'
    | 'network'
    | 'not-allowed'
    | 'service-not-allowed'
    | 'bad-grammar'
    | 'language-not-supported';
  message?: string;
}

export interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onaudiostart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: ISpeechRecognitionErrorEvent) => void) | null;
  onnomatch: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: ISpeechRecognition, ev: ISpeechRecognitionEvent) => void) | null;
  onsoundend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onsoundstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onspeechstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  abort(): void;
  start(): void;
  stop(): void;
}

export type SpeechRecognitionConstructor = new () => ISpeechRecognition;

