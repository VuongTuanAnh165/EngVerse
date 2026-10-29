/**
 * EngVerse - Low-Latency Web Audio API Sound Effects & Visual Juice Composable
 * Generates zero-latency procedural game sounds (Ting, Buzz, Combo Fever, Fanfare),
 * screen shake effects, and celebratory canvas confetti.
 *
 * Strict TypeScript (0 any), 100% memory leak free, SSR-safe.
 * Reference: docs/ke_hoach.md - Sprint 3, Task 2
 */

import { ref, onMounted, onScopeDispose } from 'vue';
import confetti from 'canvas-confetti';
import type { SoundEffectType, ScreenShakeIntensity } from '~/types/game';

// Global singleton audio context to prevent creating multiple hardware connections
let globalAudioCtx: AudioContext | null = null;

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!globalAudioCtx) {
    const AudioCtxConstructor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (AudioCtxConstructor) {
      globalAudioCtx = new AudioCtxConstructor();
    }
  }

  // Mobile browsers require resume() on user touch/click if suspended
  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    void globalAudioCtx.resume();
  }

  return globalAudioCtx;
}

export function useSoundEffects() {
  const isMuted = ref<boolean>(false);
  let shakeTimeout: ReturnType<typeof setTimeout> | null = null;
  let audioToggleHandler: ((event: Event) => void) | null = null;

  // -------------------------------------------------------------------------
  // Mute State Sync (LocalStorage & Window Events)
  // -------------------------------------------------------------------------
  function syncMuteState(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('engverse_audio_muted');
      isMuted.value = stored === 'true';
    } catch {
      // Ignore storage errors in restrictive environments
    }
  }

  function toggleMute(): void {
    isMuted.value = !isMuted.value;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('engverse_audio_muted', String(isMuted.value));
        window.dispatchEvent(
          new CustomEvent('engverse:audio-toggle', {
            detail: { isMuted: isMuted.value },
          })
        );
      } catch {
        // Ignore storage errors
      }
    }
  }

  // -------------------------------------------------------------------------
  // Procedural Web Audio API Synthesizers (Zero Network Lag, 0ms Delay)
  // -------------------------------------------------------------------------

  /**
   * Ting! (Correct answer) - Bright cheerful ascending chime
   */
  function playCorrect(): void {
    if (isMuted.value) return;
    const ctx = getOrCreateAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Dual-tone ascending arpeggio (E5 -> B5)
    const frequencies = [659.25, 987.77];
    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.25, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.36);
    });
  }

  /**
   * Buzz (Incorrect answer) - Low dissonant downward buzz
   */
  function playWrong(): void {
    if (isMuted.value) return;
    const ctx = getOrCreateAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.28);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.31);
  }

  /**
   * Combo Fever! (5x Streak Power-Up) - Sparkling celestial ascending chord
   */
  function playComboFever(): void {
    if (isMuted.value) return;
    const ctx = getOrCreateAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Pentatonic high power-up sweep (C5, E5, G5, A5, C6)
    const notes = [523.25, 659.25, 783.99, 880.0, 1046.5];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = idx === notes.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.001, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.2, now + idx * 0.06 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.42);
    });
  }

  /**
   * Victory Fanfare (Stage completion) - Majestic brass victory cadence
   */
  function playVictoryFanfare(): void {
    if (isMuted.value) return;
    const ctx = getOrCreateAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Classic game victory motif: C4, C4, C4, G4, A4, G4, C5 (held)
    const melody: Array<{ freq: number; start: number; duration: number }> = [
      { freq: 261.63, start: 0.0, duration: 0.12 },
      { freq: 261.63, start: 0.14, duration: 0.12 },
      { freq: 261.63, start: 0.28, duration: 0.12 },
      { freq: 392.0, start: 0.42, duration: 0.28 },
      { freq: 440.0, start: 0.72, duration: 0.14 },
      { freq: 392.0, start: 0.88, duration: 0.22 },
      { freq: 523.25, start: 1.12, duration: 0.65 },
    ];

    melody.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0.001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.28, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.18, now + start + duration * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + duration + 0.02);
    });
  }

  /**
   * Click / Tap - Tactile subtle button pop
   */
  function playClick(): void {
    if (isMuted.value) return;
    const ctx = getOrCreateAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  /**
   * Hit / Impact - Punchy low-end impact when hitting boss or taking damage
   */
  function playHit(): void {
    if (isMuted.value) return;
    const ctx = getOrCreateAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.2);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.24);
  }

  /**
   * Rhythm Tap - Tuned marimba chime for syllable tapping
   */
  function playRhythmTap(noteIndex: number = 0): void {
    if (isMuted.value) return;
    const ctx = getOrCreateAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Scale notes: C5, D5, E5, G5, A5, C6
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const freq = scale[noteIndex % scale.length] ?? 523.25;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.19);
  }

  /**
   * Unified audio dispatcher by effect type
   */
  function playSound(type: SoundEffectType, options?: { noteIndex?: number }): void {
    switch (type) {
      case 'correct':
        playCorrect();
        break;
      case 'wrong':
        playWrong();
        break;
      case 'combo_fever':
        playComboFever();
        break;
      case 'fanfare':
        playVictoryFanfare();
        break;
      case 'click':
        playClick();
        break;
      case 'hit':
        playHit();
        break;
      case 'rhythm_tap':
        playRhythmTap(options?.noteIndex ?? 0);
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Visual Juice Effects: Screen Shake & Confetti
  // -------------------------------------------------------------------------

  /**
   * Triggers GPU-accelerated screen shake animation (60FPS transform-based)
   */
  function triggerScreenShake(intensity: ScreenShakeIntensity = 'medium'): void {
    if (typeof document === 'undefined') return;

    const targetElement = document.getElementById('engverse-app') || document.body;
    if (!targetElement) return;

    // Mobile physical haptic vibration if available
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        const vibrationDurations: Record<ScreenShakeIntensity, number> = {
          light: 30,
          medium: 60,
          heavy: 100,
        };
        navigator.vibrate(vibrationDurations[intensity]);
      } catch {
        // Ignore haptic errors on unsupported devices
      }
    }

    const shakeClass = `shake-${intensity}`;
    targetElement.classList.remove('shake-light', 'shake-medium', 'shake-heavy');

    // Force reflow to restart animation if already shaking
    void targetElement.offsetWidth;
    targetElement.classList.add(shakeClass);

    if (shakeTimeout) {
      clearTimeout(shakeTimeout);
    }

    const durationMap: Record<ScreenShakeIntensity, number> = {
      light: 320,
      medium: 420,
      heavy: 520,
    };

    shakeTimeout = setTimeout(() => {
      targetElement.classList.remove(shakeClass);
      shakeTimeout = null;
    }, durationMap[intensity]);
  }

  /**
   * Fires a vibrant celebration confetti burst (canvas-confetti)
   */
  function triggerConfetti(options?: confetti.Options): void {
    if (typeof window === 'undefined') return;

    try {
      void confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#10B981', '#06B6D4', '#EC4899', '#3B82F6'],
        disableForReducedMotion: true,
        ...options,
      });
    } catch (err) {
      console.warn('[useSoundEffects] Confetti trigger failed:', err);
    }
  }

  /**
   * Fires a celebratory multi-angle cannon blast for Boss victory or Stage completion
   */
  function triggerVictoryConfetti(): void {
    if (typeof window === 'undefined') return;

    triggerConfetti({ particleCount: 100, spread: 100, origin: { y: 0.55 } });

    // Left and right side cannons with slight delays
    setTimeout(() => {
      triggerConfetti({
        particleCount: 60,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
      });
    }, 200);

    setTimeout(() => {
      triggerConfetti({
        particleCount: 60,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
      });
    }, 400);
  }

  // -------------------------------------------------------------------------
  // Lifecycle Management
  // -------------------------------------------------------------------------
  onMounted(() => {
    syncMuteState();

    if (typeof window !== 'undefined') {
      audioToggleHandler = (event: Event) => {
        const customEvent = event as CustomEvent<{ isMuted: boolean }>;
        if (customEvent.detail && typeof customEvent.detail.isMuted === 'boolean') {
          isMuted.value = customEvent.detail.isMuted;
        }
      };
      window.addEventListener('engverse:audio-toggle', audioToggleHandler);
    }
  });

  onScopeDispose(() => {
    if (shakeTimeout) {
      clearTimeout(shakeTimeout);
      shakeTimeout = null;
    }

    if (typeof window !== 'undefined' && audioToggleHandler) {
      window.removeEventListener('engverse:audio-toggle', audioToggleHandler);
      audioToggleHandler = null;
    }
  });

  return {
    isMuted,
    toggleMute,
    playSound,
    playCorrect,
    playWrong,
    playComboFever,
    playVictoryFanfare,
    playClick,
    playHit,
    playRhythmTap,
    triggerScreenShake,
    triggerConfetti,
    triggerVictoryConfetti,
  };
}

