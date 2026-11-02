import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useUserStore } from '~/stores/user';
import {
  type StreakMilestone,
  STREAK_MILESTONES,
  getDailyDateString,
  getYesterdayDateString,
} from '~/types/dailyChallenge';

/**
 * EngVerse - useDailyStreak Composable
 * Centralized reactive streak tracking, freeze shield inspection, and milestone progression
 * synchronized with Firestore 1-Doc-Per-User (`users/{uid}.dailyChallenge`).
 * 
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Section 6.2 & Sprint 8, Task 2.4
 */
export function useDailyStreak() {
  const userStore = useUserStore();

  // Streak Core Metrics
  const currentStreak = computed<number>(() => userStore.dailyStreak || 0);
  const longestStreak = computed<number>(() => {
    return Math.max(
      userStore.user.dailyChallenge?.longestStreak || 0,
      userStore.user.streak?.current || 0,
      currentStreak.value
    );
  });
  const lastCompletedDate = computed<string>(() => {
    return userStore.user.dailyChallenge?.lastCompletedDate || userStore.user.streak?.lastPlayedDate || '';
  });

  // Daily Status Checks
  const isCompletedToday = computed<boolean>(() => {
    return userStore.isDailyChallengeCompletedToday;
  });

  const isYesterdayCompleted = computed<boolean>(() => {
    return lastCompletedDate.value === getYesterdayDateString();
  });

  /**
   * Streak is broken if the last completed date is neither today nor yesterday.
   */
  const isStreakBroken = computed<boolean>(() => {
    if (!lastCompletedDate.value) return false;
    const today = getDailyDateString();
    const yesterday = getYesterdayDateString();
    return lastCompletedDate.value !== today && lastCompletedDate.value !== yesterday;
  });

  /**
   * Streak is considered 'at risk' if user has a running streak
   * but has not completed today's challenge yet.
   */
  const isStreakAtRisk = computed<boolean>(() => {
    return !isCompletedToday.value && (isYesterdayCompleted.value || currentStreak.value > 0);
  });

  // Freeze Shields
  const freezeShields = computed<number>(() => {
    return userStore.user.streak?.freezeShields || 0;
  });

  const hasFreezeShield = computed<boolean>(() => {
    return freezeShields.value > 0;
  });

  const canBeRescuedByShield = computed<boolean>(() => {
    return isStreakBroken.value && hasFreezeShield.value;
  });

  // Milestones Progression
  const allMilestones = STREAK_MILESTONES;

  const isMaxMilestoneReached = computed<boolean>(() => {
    return currentStreak.value >= allMilestones[allMilestones.length - 1]!.days;
  });

  const nextMilestone = computed<StreakMilestone>(() => {
    const next = allMilestones.find((m) => m.days > currentStreak.value);
    return next || allMilestones[allMilestones.length - 1]!;
  });

  const previousMilestoneDays = computed<number>(() => {
    const passed = allMilestones.filter((m) => m.days <= currentStreak.value);
    return passed.length > 0 ? passed[passed.length - 1]!.days : 0;
  });

  const daysRemainingToMilestone = computed<number>(() => {
    return Math.max(0, nextMilestone.value.days - currentStreak.value);
  });

  const milestoneProgressPercent = computed<number>(() => {
    if (isMaxMilestoneReached.value) return 100;
    const base = previousMilestoneDays.value;
    const target = nextMilestone.value.days;
    if (target <= base) return 100;
    const progress = Math.min(target, Math.max(base, currentStreak.value)) - base;
    const total = target - base;
    return Math.round((progress / total) * 100);
  });

  // 00:00 GMT+7 Countdown Calculation
  function calculateTimeUntilReset(): {
    hours: number;
    minutes: number;
    seconds: number;
    formatted: string;
  } {
    const now = new Date();
    // Vietnam is UTC+7
    const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const vnTomorrow = new Date(vnNow);
    vnTomorrow.setUTCHours(24, 0, 0, 0);

    const diffMs = Math.max(0, vnTomorrow.getTime() - vnNow.getTime());
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return { hours, minutes, seconds, formatted };
  }

  const timeUntilReset = ref<string>(
    typeof window !== 'undefined' ? calculateTimeUntilReset().formatted : '--:--:--'
  );
  let countdownTimer: ReturnType<typeof setInterval> | null = null;

  function updateCountdown(): void {
    timeUntilReset.value = calculateTimeUntilReset().formatted;
  }

  onMounted(() => {
    updateCountdown();
    countdownTimer = setInterval(updateCountdown, 1000);
  });

  onUnmounted(() => {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  });

  /**
   * Manually repair streak using a shield if available
   */
  function repairStreakWithShield() {
    return userStore.repairBrokenStreak(true);
  }

  /**
   * Consumes 1 freeze shield
   */
  function useFreezeShield(): boolean {
    return userStore.consumeFreezeShield();
  }

  // Milestone Claims & Buffs
  const claimedMilestoneDays = computed<number[]>(() => {
    return userStore.claimedMilestones || [];
  });

  const unclaimedMilestones = computed<StreakMilestone[]>(() => {
    return allMilestones.filter(
      (m) => m.days <= currentStreak.value && !claimedMilestoneDays.value.includes(m.days)
    );
  });

  const isExpBoostActive = computed<boolean>(() => {
    return userStore.isExpBoostActive;
  });

  const activeAvatarFrame = computed<string>(() => {
    return userStore.activeAvatarFrame;
  });

  function getMilestoneByDays(days: number): StreakMilestone | undefined {
    return allMilestones.find((m) => m.days === days);
  }

  function claimMilestone(days: number) {
    return userStore.claimStreakMilestone(days);
  }

  return {
    currentStreak,
    longestStreak,
    lastCompletedDate,
    isCompletedToday,
    isYesterdayCompleted,
    isStreakBroken,
    isStreakAtRisk,
    freezeShields,
    hasFreezeShield,
    canBeRescuedByShield,
    allMilestones,
    nextMilestone,
    previousMilestoneDays,
    daysRemainingToMilestone,
    milestoneProgressPercent,
    isMaxMilestoneReached,
    timeUntilReset,
    calculateTimeUntilReset,
    repairStreakWithShield,
    useFreezeShield,
    claimedMilestoneDays,
    unclaimedMilestones,
    isExpBoostActive,
    activeAvatarFrame,
    getMilestoneByDays,
    claimMilestone,
  };
}
