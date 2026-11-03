import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { useFirebase } from '~/composables/useFirebase';
import { useAnalytics } from '~/composables/useAnalytics';
import {
  type UserProfile,
  type WorldTrack,
  type AuthInitResponse,
  type BuyItemPayload,
  type BuyItemResponse,
  createDefaultUserProfile,
} from '~/types/user';
import {
  type UserDailyChallenge,
  type DailyChallengeSubmitResponse,
  getDailyDateString,
  getYesterdayDateString,
} from '~/types/dailyChallenge';

import { getTitleDisplayName } from '~/types/rewards';
import {
  type FreeSimSessionRecord,
  MAX_DAILY_FREE_SIM_SESSIONS,
} from '~/types/freeSimulator';

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
  const srsQueueCount = computed<number>(() => srsBossQueue.value.length);
  const hasPendingSrsReview = computed<boolean>(() => srsBossQueue.value.length > 0);

  // Daily Challenge Getters
  const dailyChallenge = computed<UserDailyChallenge | undefined>(() => user.value.dailyChallenge);
  const dailyStreak = computed<number>(() => {
    if (typeof user.value.dailyChallenge?.currentStreak === 'number' && user.value.dailyChallenge.currentStreak > 0) {
      return user.value.dailyChallenge.currentStreak;
    }
    return user.value.streak?.current || 0;
  });
  const isDailyChallengeCompletedToday = computed<boolean>(() => {
    const today = getDailyDateString();
    return user.value.dailyChallenge?.lastCompletedDate === today;
  });
  const isExpBoostActive = computed<boolean>(() => {
    return Boolean(user.value.expBoostUntil && user.value.expBoostUntil > Date.now());
  });
  const activeAvatarFrame = computed<string>(() => {
    return user.value.avatarFrame || 'default';
  });
  const claimedMilestones = computed<number[]>(() => {
    return user.value.claimedMilestones || [];
  });

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
   * Checks whether an item ID is present in the SRS Boss queue
   */
  function isItemInSrsQueue(itemId: string): boolean {
    if (!itemId || !user.value.srsBossQueue) return false;
    return user.value.srsBossQueue.includes(itemId);
  }

  /**
   * Clears all items currently awaiting SRS review
   */
  function clearSrsQueue(): void {
    user.value.srsBossQueue = [];
    user.value.updatedAt = Date.now();
    saveGuestState();
  }

  /**
   * Retrieves priority SRS items to be reviewed (e.g. for Daily Challenge Phase 1 or Boss fights)
   */
  function getSrsPriorityItems(limit: number = 3): string[] {
    if (!user.value.srsBossQueue || user.value.srsBossQueue.length === 0) return [];
    return user.value.srsBossQueue.slice(0, limit);
  }

  /**
   * Directly updates user's daily challenge progress
   */
  function setDailyChallengeProgress(data: UserDailyChallenge): void {
    user.value.dailyChallenge = { ...data };
    user.value.updatedAt = Date.now();
    saveGuestState();
  }

  /**
   * Records daily challenge completion results into user store
   * Updates EXP, Gold, Level, Daily Challenge streak & history, and syncs SRS queue
   */
  function recordDailyChallengeCompletion(res: DailyChallengeSubmitResponse): void {
    if (!res) return;
    const today = getDailyDateString();

    // Reward EXP & Gold
    user.value.exp = (user.value.exp || 0) + (res.earnedExp || 0);
    user.value.gold = (user.value.gold || 0) + (res.earnedGold || 0);
    user.value.level = Math.floor(user.value.exp / 250) + 1;

    // Daily Challenge streak progress
    const currentHistory = user.value.dailyChallenge?.history
      ? [...user.value.dailyChallenge.history]
      : [];
    const totalCompleted = (user.value.dailyChallenge?.totalCompleted || 0) + 1;

    user.value.dailyChallenge = {
      lastCompletedDate: today,
      currentStreak: res.currentStreak,
      longestStreak: res.longestStreak,
      totalCompleted,
      history: [
        {
          date: today,
          score: res.earnedExp || 0,
          stars: 3,
          durationSeconds: 120,
          completedAt: Date.now(),
          theme: 'Daily Challenge',
        },
        ...currentHistory.filter((h) => h.date !== today),
      ].slice(0, 7),
    };

    // Keep user.value.streak in perfect sync
    if (user.value.streak) {
      user.value.streak.current = Math.max(user.value.streak.current || 0, res.currentStreak);
      user.value.streak.lastPlayedDate = today;
      if (res.shieldUsed && user.value.streak.freezeShields > 0) {
        user.value.streak.freezeShields -= 1;
      }
      if (res.rewardUnlocked && (res.rewardUnlocked.includes('Shield') || res.rewardUnlocked.includes('streak_shield'))) {
        user.value.streak.freezeShields = Math.min(3, (user.value.streak.freezeShields || 0) + 1);
      }
    }

    // Handle reward perks & titles
    if (res.rewardUnlocked) {
      if (res.rewardUnlocked.includes('x2 EXP') || res.rewardUnlocked.includes('exp_x2')) {
        user.value.expBoostUntil = Math.max(user.value.expBoostUntil || 0, Date.now() + 24 * 60 * 60 * 1000);
      }
      if (res.rewardUnlocked.includes('avatar_frame_gold') || res.rewardUnlocked.includes('Khung Avatar Vàng')) {
        const frames = new Set(user.value.unlockedAvatarFrames || ['default']);
        frames.add('avatar_frame_gold');
        user.value.unlockedAvatarFrames = Array.from(frames);
        user.value.avatarFrame = 'avatar_frame_gold';
      }
    }


    // If server returned updated user profile (e.g. from authenticated POST response), merge it
    if (res.user) {
      user.value = {
        ...user.value,
        ...res.user,
      };
    }

    user.value.updatedAt = Date.now();
    saveGuestState();
  }

  /**
   * Consumes one freeze shield to rescue or protect streak
   * Returns true if successfully consumed, false if no shield was available
   */
  function consumeFreezeShield(): boolean {
    if (!user.value.streak || user.value.streak.freezeShields <= 0) {
      return false;
    }
    user.value.streak.freezeShields -= 1;
    user.value.updatedAt = Date.now();
    saveGuestState();
    return true;
  }

  /**
   * Verifies streak continuity against yesterday and today dates (GMT+7).
   * If streak is broken but freeze shields exist, automatically applies a shield rescue.
   */
  function repairBrokenStreak(rescueWithShield: boolean = true): {
    isBroken: boolean;
    rescued: boolean;
    currentStreak: number;
  } {
    const today = getDailyDateString();
    const yesterday = getYesterdayDateString();
    const lastDate = user.value.dailyChallenge?.lastCompletedDate || '';

    // If last date is today or yesterday, streak is actively intact
    if (!lastDate || lastDate === today || lastDate === yesterday) {
      return {
        isBroken: false,
        rescued: false,
        currentStreak: user.value.dailyChallenge?.currentStreak || 0,
      };
    }

    // Streak broken: more than 1 day missed
    if (rescueWithShield && (user.value.streak?.freezeShields || 0) > 0) {
      // Consume shield to rescue streak
      consumeFreezeShield();
      if (user.value.dailyChallenge) {
        // Shift last completed date to yesterday so today's completion continues streak
        user.value.dailyChallenge.lastCompletedDate = yesterday;
      }
      user.value.updatedAt = Date.now();
      saveGuestState();
      return {
        isBroken: true,
        rescued: true,
        currentStreak: user.value.dailyChallenge?.currentStreak || 0,
      };
    }

    // No shield available: reset streak to 0
    if (user.value.dailyChallenge) {
      user.value.dailyChallenge.currentStreak = 0;
    }
    if (user.value.streak) {
      user.value.streak.current = 0;
    }
    user.value.updatedAt = Date.now();
    saveGuestState();

    return {
      isBroken: true,
      rescued: false,
      currentStreak: 0,
    };
  }

  /**
   * Claims a streak milestone reward (3, 7, 14, 30, 60 days) and applies the benefit
   */
  function claimStreakMilestone(milestoneDays: number): {
    success: boolean;
    rewardTitle: string;
    description: string;
  } {
    const claimed = new Set(user.value.claimedMilestones || []);
    if (claimed.has(milestoneDays)) {
      return { success: false, rewardTitle: '', description: 'Mốc thưởng này đã được nhận trước đó.' };
    }

    claimed.add(milestoneDays);
    user.value.claimedMilestones = Array.from(claimed);

    let rewardTitle = '';
    let description = '';

    if (milestoneDays === 3) {
      if (user.value.streak) {
        user.value.streak.freezeShields = Math.min(3, (user.value.streak.freezeShields || 0) + 1);
      }
      rewardTitle = 'Khiên Băng Bảo Vệ 🛡️';
      description = 'Đã cộng thêm 1 Khiên Băng vào kho bảo vệ chuỗi ngày học!';
    } else if (milestoneDays === 7) {
      user.value.expBoostUntil = Math.max(user.value.expBoostUntil || 0, Date.now() + 24 * 60 * 60 * 1000);
      const titles = new Set(user.value.unlockedTitles || ['rookie_explorer']);
      titles.add('daily_devotee');
      user.value.unlockedTitles = Array.from(titles);
      rewardTitle = 'Hào Quang Tri Thức ⚡ (x2 EXP 24h)';
      description = 'Kích hoạt nhân đôi EXP nhận được trong 24 giờ tiếp theo!';
    } else if (milestoneDays === 14) {
      const titles = new Set(user.value.unlockedTitles || ['rookie_explorer']);
      titles.add('codex_connoisseur');
      user.value.unlockedTitles = Array.from(titles);
      rewardTitle = 'Gói Thẻ Sử Thi 🃏 (Codex Epic Pack)';
      description = 'Mở khóa danh hiệu Nhà Sưu Tầm Thẻ Sử Thi!';
    } else if (milestoneDays === 30) {
      const titles = new Set(user.value.unlockedTitles || ['rookie_explorer']);
      titles.add('discipline_master');
      user.value.unlockedTitles = Array.from(titles);
      rewardTitle = 'Thẻ Bài Huyền Thoại 👑 (Codex Legendary)';
      description = 'Nhận danh hiệu Bậc Thầy Kỷ Luật!';
    } else if (milestoneDays === 60) {
      const frames = new Set(user.value.unlockedAvatarFrames || ['default']);
      frames.add('avatar_frame_gold');
      user.value.unlockedAvatarFrames = Array.from(frames);
      user.value.avatarFrame = 'avatar_frame_gold';
      const titles = new Set(user.value.unlockedTitles || ['rookie_explorer']);
      titles.add('streak_immortal');
      user.value.unlockedTitles = Array.from(titles);
      rewardTitle = 'Khung Avatar Vàng Hoàng Gia ✨';
      description = 'Đã mở khóa & trang bị Khung Avatar Hoàng Kim Bất Tử!';
    }

    user.value.updatedAt = Date.now();
    saveGuestState();
    return { success: true, rewardTitle, description };
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
            const analytics = useAnalytics();
            analytics.setUserId(response.user.uid);
            analytics.setUserProperties({
              world_track: response.user.worldTrack,
              level: response.user.level,
            });
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

    const previousTrack = user.value.worldTrack;
    user.value.worldTrack = newTrack;
    user.value.updatedAt = Date.now();

    const analytics = useAnalytics();
    analytics.trackUniverseSwitch({
      from_track: previousTrack,
      to_track: newTrack,
    });
    analytics.setUserProperties({
      world_track: newTrack,
    });

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
   * Purchases shop items (freeze shields or energy refills) atomically
   */
  async function buyShopItem(itemType: 'freeze_shield' | 'refill_energy'): Promise<BuyItemResponse> {
    if (isGuest.value) {
      const cost = itemType === 'freeze_shield' ? 100 : 50;
      if (user.value.gold < cost) {
        throw new Error(`Bạn không đủ Vàng để mua vật phẩm (Cần ${cost} Vàng).`);
      }
      user.value.gold -= cost;
      if (itemType === 'freeze_shield') {
        const currentShields = user.value.streak?.freezeShields || 0;
        if (currentShields >= 3) {
          user.value.gold += cost; // refund
          throw new Error('Bạn đã đạt giới hạn tối đa 3 Khiên Băng!');
        }
        user.value.streak.freezeShields = currentShields + 1;
      } else {
        user.value.energy.current = 5;
        user.value.energy.lastRefillAt = Date.now();
      }
      user.value.updatedAt = Date.now();
      saveGuestState();

      const analytics = useAnalytics();
      analytics.trackShopPurchase({
        item_type: itemType,
        gold_spent: cost,
        world_track: user.value.worldTrack,
      });

      return {
        success: true,
        gold: user.value.gold,
        freezeShields: user.value.streak?.freezeShields,
        energy: user.value.energy,
        message: 'Mua vật phẩm thành công!',
      };
    }

    // Authenticated user cloud transaction
    const { getClientAuth } = useFirebase();
    const currentUser = getClientAuth()?.currentUser;
    const token = currentUser ? await currentUser.getIdToken() : '';

    const res = await $fetch<BuyItemResponse>('/api/shop/buy-shield', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: { itemType },
    });

    if (res.success) {
      user.value.gold = res.gold;
      if (typeof res.freezeShields === 'number') {
        user.value.streak.freezeShields = res.freezeShields;
      }
      if (res.energy) {
        user.value.energy = res.energy;
      }

      const analytics = useAnalytics();
      analytics.trackShopPurchase({
        item_type: itemType,
        gold_spent: itemType === 'freeze_shield' ? 100 : 50,
        world_track: user.value.worldTrack,
      });
    }
    return res;
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

      // Telemetry: bind user ID and track onboarding complete via Google sign-in
      const analytics = useAnalytics();
      analytics.setUserId(response.user.uid);
      analytics.setUserProperties({
        world_track: response.user.worldTrack,
        level: response.user.level,
      });
      analytics.trackOnboardingComplete({
        world_track: response.user.worldTrack,
        auth_method: 'google',
      });

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

  // Boss Rush Colosseum Getters & Actions
  const bossRush = computed(() => user.value.bossRush);

  function isBossRushUnlocked(track: WorldTrack): boolean {
    const trackProgress = user.value.progress.tracks[track];
    if (!trackProgress) return false;
    return (
      trackProgress.unlockedStage > 20 ||
      (trackProgress.stageStars && (trackProgress.stageStars['20'] || 0) > 0)
    );
  }

  function recordBossRushRun(result: BossRushResult): void {
    if (!user.value.bossRush) {
      user.value.bossRush = {
        tracks: {
          kids: { bestScore: 0, bestTimeMs: 0, bossesDefeated: 0, isCleared: false, isPerfect: false },
          teens: { bestScore: 0, bestTimeMs: 0, bossesDefeated: 0, isCleared: false, isPerfect: false },
          adults: { bestScore: 0, bestTimeMs: 0, bossesDefeated: 0, isCleared: false, isPerfect: false },
        },
        totalClears: 0,
      };
    }

    const currentTrackRecord = user.value.bossRush.tracks[result.worldTrack] || {
      bestScore: 0,
      bestTimeMs: 0,
      bossesDefeated: 0,
      isCleared: false,
      isPerfect: false,
    };

    const isNewBestTime =
      currentTrackRecord.bestTimeMs === 0 ||
      (result.totalTimeMs < currentTrackRecord.bestTimeMs &&
        result.bossesDefeated >= currentTrackRecord.bossesDefeated);

    user.value.bossRush.tracks[result.worldTrack] = {
      bestScore: Math.max(currentTrackRecord.bestScore, result.finalScore),
      bestTimeMs: isNewBestTime ? result.totalTimeMs : currentTrackRecord.bestTimeMs,
      bossesDefeated: Math.max(currentTrackRecord.bossesDefeated, result.bossesDefeated),
      isCleared: currentTrackRecord.isCleared || result.isCleared,
      isPerfect: currentTrackRecord.isPerfect || result.isPerfect,
      clearedAt: result.isCleared ? Date.now() : currentTrackRecord.clearedAt,
    };

    if (result.isCleared) {
      user.value.bossRush.totalClears = (user.value.bossRush.totalClears || 0) + 1;

      if (
        result.rewardsUnlocked.titleId &&
        !user.value.unlockedTitles.includes(result.rewardsUnlocked.titleId)
      ) {
        user.value.unlockedTitles.push(result.rewardsUnlocked.titleId);
      }
      if (result.rewardsUnlocked.avatarFrame) {
        if (!user.value.unlockedAvatarFrames) {
          user.value.unlockedAvatarFrames = ['default'];
        }
        if (!user.value.unlockedAvatarFrames.includes(result.rewardsUnlocked.avatarFrame)) {
          user.value.unlockedAvatarFrames.push(result.rewardsUnlocked.avatarFrame);
        }
      }
      if (
        result.rewardsUnlocked.cardId &&
        !user.value.collectedCards.includes(result.rewardsUnlocked.cardId)
      ) {
        user.value.collectedCards.push(result.rewardsUnlocked.cardId);
      }

      const allCleared = (['kids', 'teens', 'adults'] as WorldTrack[]).every(
        (t) => user.value.bossRush?.tracks[t]?.isCleared
      );
      if (allCleared && !user.value.unlockedTitles.includes('title_multiverse_champion')) {
        user.value.unlockedTitles.push('title_multiverse_champion');
      }
    }

    user.value.bossRush.lastPlayedDate = getDailyDateString();
    user.value.updatedAt = Date.now();
    saveGuestState();
  }

  // ---------------------------------------------------------------------------
  // AI Free Simulator (Task 4.1 & 4.5)
  // ---------------------------------------------------------------------------
  const freeSimulator = computed(() => user.value.freeSimulator);

  function getFreeSimDailyRemaining(): number {
    if (!user.value.freeSimulator) return MAX_DAILY_FREE_SIM_SESSIONS;
    const today = getDailyDateString();
    if (user.value.freeSimulator.lastPlayedDate !== today) {
      return MAX_DAILY_FREE_SIM_SESSIONS;
    }
    const used = user.value.freeSimulator.dailySessionsCount || 0;
    return Math.max(0, MAX_DAILY_FREE_SIM_SESSIONS - used);
  }

  function recordFreeSimSession(record: FreeSimSessionRecord): void {
    const today = getDailyDateString();
    if (!user.value.freeSimulator) {
      user.value.freeSimulator = {
        dailySessionsCount: 0,
        lastPlayedDate: today,
        totalSessionsCompleted: 0,
        history: [],
      };
    }

    if (user.value.freeSimulator.lastPlayedDate !== today) {
      user.value.freeSimulator.dailySessionsCount = 0;
      user.value.freeSimulator.lastPlayedDate = today;
    }

    user.value.freeSimulator.dailySessionsCount += 1;
    user.value.freeSimulator.totalSessionsCompleted += 1;

    if (!user.value.freeSimulator.history) {
      user.value.freeSimulator.history = [];
    }

    // Prepend session to history (capped at 5 recent sessions, 0 subcollection)
    user.value.freeSimulator.history.unshift(record);
    if (user.value.freeSimulator.history.length > 5) {
      user.value.freeSimulator.history = user.value.freeSimulator.history.slice(0, 5);
    }

    user.value.updatedAt = Date.now();
    saveGuestState();
  }

  // ---------------------------------------------------------------------------
  // Cosmetics & Rewards Customization (Task 3.5)
  // ---------------------------------------------------------------------------
  const equippedTitleDisplayName = computed<string>(() => {
    return getTitleDisplayName(user.value.equippedTitle);
  });

  const unlockedAvatarFramesList = computed<string[]>(() => {
    return user.value.unlockedAvatarFrames || ['default'];
  });

  const unlockedTitlesList = computed<string[]>(() => {
    return user.value.unlockedTitles || ['rookie_explorer'];
  });

  async function equipTitle(titleId: string): Promise<boolean> {
    const available = user.value.unlockedTitles || ['rookie_explorer'];
    const isRookie = titleId === 'rookie_explorer' || titleId === 'Tân Binh';
    if (!isRookie && !available.includes(titleId)) {
      console.warn(`[UserStore] Title not unlocked: ${titleId}`);
      return false;
    }

    user.value.equippedTitle = titleId;
    user.value.updatedAt = Date.now();

    if (user.value.isGuest) {
      saveGuestState();
      return true;
    }

    try {
      const { getClientAuth } = useFirebase();
      const auth = getClientAuth();
      const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : undefined;

      await $fetch('/api/user/profile', {
        method: 'POST',
        body: { idToken, equippedTitle: titleId },
      });
      return true;
    } catch (err: unknown) {
      console.error('[UserStore] Failed to sync equipped title:', err);
      return false;
    }
  }

  async function equipAvatarFrame(frameId: string): Promise<boolean> {
    const available = user.value.unlockedAvatarFrames || ['default'];
    if (frameId !== 'default' && !available.includes(frameId)) {
      console.warn(`[UserStore] Frame not unlocked: ${frameId}`);
      return false;
    }

    user.value.avatarFrame = frameId;
    user.value.updatedAt = Date.now();

    if (user.value.isGuest) {
      saveGuestState();
      return true;
    }

    try {
      const { getClientAuth } = useFirebase();
      const auth = getClientAuth();
      const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : undefined;

      await $fetch('/api/user/profile', {
        method: 'POST',
        body: { idToken, avatarFrame: frameId },
      });
      return true;
    } catch (err: unknown) {
      console.error('[UserStore] Failed to sync avatar frame:', err);
      return false;
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
    // SRS Spaced Repetition Engine
    srsBossQueue,
    srsQueueCount,
    hasPendingSrsReview,
    isItemInSrsQueue,
    clearSrsQueue,
    getSrsPriorityItems,
    addWrongItemsToSrsQueue,
    removeClearedFromSrsQueue,
    // Daily Challenge
    dailyChallenge,
    dailyStreak,
    isDailyChallengeCompletedToday,
    isExpBoostActive,
    activeAvatarFrame,
    claimedMilestones,
    setDailyChallengeProgress,
    recordDailyChallengeCompletion,
    consumeFreezeShield,
    repairBrokenStreak,
    claimStreakMilestone,
    // Boss Rush Colosseum
    bossRush,
    isBossRushUnlocked,
    recordBossRushRun,
    // AI Free Simulator (Task 4.1 & 4.5)
    freeSimulator,
    getFreeSimDailyRemaining,
    recordFreeSimSession,
    // Cosmetics & Rewards (Task 3.5)
    equippedTitleDisplayName,
    unlockedAvatarFramesList,
    unlockedTitlesList,
    equipTitle,
    equipAvatarFrame,
    // Operations
    initUserSession,
    saveGuestState,
    loadGuestState,
    switchWorldTrack,
    recordGuestStageWin,
    buyShopItem,
    syncGuestWithGoogle,
    logout,
  };
});

