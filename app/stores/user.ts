import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { useFirebase } from '~/composables/useFirebase';
import {
  type UserProfile,
  type WorldTrack,
  type AuthInitResponse,
  createDefaultUserProfile,
} from '~/types/user';

const STORAGE_KEY = 'engverse_guest_profile';

/**
 * EngVerse - User Store (Pinia)
 * Manages User Profile, 3-Universe Track progress, Guest mode LocalStorage,
 * and zero-friction Google Auth cloud synchronization.
 * Reference: docs/ke_hoach.md - Sprint 1 (Task 4)
 */
export const useUserStore = defineStore('user', () => {
  const user = ref<UserProfile>(createDefaultUserProfile());
  const isLoading = ref<boolean>(false);
  const isSyncing = ref<boolean>(false);
  const error = ref<string | null>(null);
  let isInitialized = false;

  // Computed Getters
  const isGuest = computed<boolean>(() => !!user.value.isGuest);
  const isAuthenticated = computed<boolean>(
    () => !user.value.isGuest && !!user.value.uid && user.value.uid !== 'guest_user'
  );
  const currentTrack = computed<WorldTrack>(() => user.value.worldTrack);
  const currentTrackProgress = computed(() => {
    const track = user.value.worldTrack;
    return (
      user.value.progress.tracks[track] || {
        unlockedStage: 1,
        stageStars: {},
      }
    );
  });
  const energy = computed(() => user.value.energy);
  const streak = computed(() => user.value.streak);
  const gold = computed<number>(() => user.value.gold);
  const exp = computed<number>(() => user.value.exp);
  const level = computed<number>(() => user.value.level);
  const srsBossQueue = computed<string[]>(() => user.value.srsBossQueue || []);

  /**
   * Appends newly failed item IDs into SRS Boss queue for spaced repetition review
   */
  function addWrongItemsToSrsQueue(itemIds: string[]): void {
    if (!itemIds || itemIds.length === 0) return;
    if (!user.value.srsBossQueue) {
      user.value.srsBossQueue = [];
    }

    const set = new Set([...user.value.srsBossQueue, ...itemIds]);
    user.value.srsBossQueue = Array.from(set);
    user.value.updatedAt = Date.now();
    saveGuestState();
  }

  /**
   * Removes successfully mastered items from SRS Boss queue when cleared in Boss fights
   */
  function removeClearedFromSrsQueue(itemIds: string[]): void {
    if (!itemIds || itemIds.length === 0 || !user.value.srsBossQueue) return;
    const toRemove = new Set(itemIds);
    user.value.srsBossQueue = user.value.srsBossQueue.filter((id) => !toRemove.has(id));
    user.value.updatedAt = Date.now();
    saveGuestState();
  }

  /**
   * Persists guest progress to LocalStorage safely
   */
  function saveGuestState(): void {
    if (!import.meta.client || !user.value.isGuest) {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user.value));
    } catch (err) {
      console.warn('[UserStore] Failed to save guest state to LocalStorage:', err);
    }
  }

  /**
   * Restores guest state from LocalStorage
   */
  function loadGuestState(): boolean {
    if (!import.meta.client) {
      return false;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserProfile;
        if (parsed && parsed.progress && parsed.progress.tracks) {
          user.value = {
            ...createDefaultUserProfile(),
            ...parsed,
            isGuest: true,
          };
          return true;
        }
      }
    } catch (err) {
      console.warn('[UserStore] Failed to load guest state from LocalStorage:', err);
    }

    return false;
  }

  /**
   * Initializes user session from LocalStorage or Firebase Auth
   */
  function initUserSession(): void {
    if (!import.meta.client || isInitialized) {
      return;
    }
    isInitialized = true;

    // 1. Try loading cached guest progress
    loadGuestState();

    // 2. Listen to Firebase Client Auth state
    const { onClientAuthStateChanged } = useFirebase();

    onClientAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser && isGuest.value) {
        try {
          isLoading.value = true;
          const idToken = await firebaseUser.getIdToken();
          const response = await $fetch<AuthInitResponse>('/api/auth/init', {
            method: 'POST',
            body: {
              idToken,
              guestProgress: user.value,
            },
          });

          if (response && response.user) {
            user.value = {
              ...response.user,
              isGuest: false,
            };
            localStorage.removeItem(STORAGE_KEY);
          }
        } catch (fetchErr) {
          console.error('[UserStore] Auto-sync with existing Firebase user failed:', fetchErr);
        } finally {
          isLoading.value = false;
        }
      }
    });
  }

  /**
   * Switches the active universe track (kids | teens | adults)
   * Multi-track progress is strictly preserved.
   */
  function switchWorldTrack(newTrack: WorldTrack): void {
    if (user.value.worldTrack === newTrack) {
      return;
    }

    user.value.worldTrack = newTrack;
    user.value.updatedAt = Date.now();

    if (user.value.isGuest) {
      saveGuestState();
    }
  }

  /**
   * Records a stage victory during Guest onboarding (Stage 1 tutorial)
   */
  function recordGuestStageWin(
    track: WorldTrack,
    stageId: number | string,
    stars: number,
    rewardExp: number,
    rewardGold: number,
    cardId?: string,
    newWrongItems?: string[],
    clearedSrsIds?: string[]
  ): void {
    if (!user.value.isGuest) {
      return;
    }

    const sId = String(stageId);
    const trackProgress = user.value.progress.tracks[track];

    if (!trackProgress) {
      return;
    }

    // Update stars
    const currentStars = trackProgress.stageStars[sId] || 0;
    trackProgress.stageStars[sId] = Math.max(currentStars, Math.min(3, Math.max(1, stars)));

    // Unlock next stage
    const nextStage = Number(stageId) + 1;
    if (nextStage > trackProgress.unlockedStage) {
      trackProgress.unlockedStage = nextStage;
    }

    // Rewards
    user.value.exp += rewardExp;
    user.value.gold += rewardGold;

    // Level up calculation (every 250 exp = 1 level)
    user.value.level = Math.floor(user.value.exp / 250) + 1;

    // Collect card
    if (cardId && !user.value.collectedCards.includes(cardId)) {
      user.value.collectedCards.push(cardId);
    }

    // Sync SRS Boss Queue: append new mistakes & remove mastered items
    if (newWrongItems && newWrongItems.length > 0) {
      addWrongItemsToSrsQueue(newWrongItems);
    }
    if (clearedSrsIds && clearedSrsIds.length > 0) {
      removeClearedFromSrsQueue(clearedSrsIds);
    }

    user.value.updatedAt = Date.now();
    saveGuestState();
  }

  /**
   * Seamlessly migrates Guest progress to Cloud Firestore via Firebase Google Auth
   */
  async function syncGuestWithGoogle(turnstileToken?: string): Promise<AuthInitResponse> {
    isSyncing.value = true;
    error.value = null;

    try {
      const { signInWithGoogle } = useFirebase();
      const { idToken } = await signInWithGoogle();

      const response = await $fetch<AuthInitResponse>('/api/auth/init', {
        method: 'POST',
        body: {
          idToken,
          turnstileToken,
          guestProgress: user.value.isGuest ? user.value : null,
        },
      });

      if (!response.success || !response.user) {
        throw new Error(response.message || 'Đồng bộ tài khoản thất bại.');
      }

      // Update store with official server document
      user.value = {
        ...response.user,
        isGuest: false,
      };

      // Clean up guest local storage
      if (import.meta.client) {
        localStorage.removeItem(STORAGE_KEY);
      }

      return response;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Có lỗi xảy ra trong quá trình đăng nhập.';
      error.value = errorMessage;
      throw err;
    } finally {
      isSyncing.value = false;
    }
  }

  /**
   * Logs out from Google and resets state back to clean Guest profile
   */
  async function logout(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const { signOutClient } = useFirebase();
      await signOutClient();

      user.value = createDefaultUserProfile();

      if (import.meta.client) {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err: unknown) {
      console.error('[UserStore] Logout failed:', err);
    } finally {
      isLoading.value = false;
    }
  }

  return {
    user,
    isLoading,
    isSyncing,
    error,
    isGuest,
    isAuthenticated,
    currentTrack,
    currentTrackProgress,
    energy,
    streak,
    gold,
    exp,
    level,
    srsBossQueue,
    initUserSession,
    saveGuestState,
    loadGuestState,
    switchWorldTrack,
    addWrongItemsToSrsQueue,
    removeClearedFromSrsQueue,
    recordGuestStageWin,
    syncGuestWithGoogle,
    logout,
  };
});

