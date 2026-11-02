import { computed } from 'vue';
import { useUserStore } from '~/stores/user';

/**
 * EngVerse - useSrsEngine Composable
 * High-level interface to interact with the Spaced Repetition System (SRS)
 * powered by the user's `srsBossQueue` in Pinia user store and Firestore.
 * 
 * Used across:
 * - Daily Challenge (Phase 1: Vocab Sprint - 50% words from SRS)
 * - Boss Rush Colosseum (Targeting player's weak points)
 * - Stage Post-Game Mastery Analysis
 * 
 * Reference: docs/roadmap_stage_depth_and_endgame.md - Sprint 8, Task 2.2
 */
export function useSrsEngine() {
  const userStore = useUserStore();

  const queue = computed<string[]>(() => userStore.srsBossQueue);
  const count = computed<number>(() => userStore.srsQueueCount);
  const hasPendingReview = computed<boolean>(() => userStore.hasPendingSrsReview);

  /**
   * Adds one or more item IDs into the SRS queue
   */
  function recordMistake(idOrIds: string | string[]): void {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const cleanedIds = ids.map((id) => String(id).trim()).filter(Boolean);
    if (cleanedIds.length > 0) {
      userStore.addWrongItemsToSrsQueue(cleanedIds);
    }
  }

  /**
   * Removes one or more mastered item IDs from the SRS queue
   */
  function recordMastery(idOrIds: string | string[]): void {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const cleanedIds = ids.map((id) => String(id).trim()).filter(Boolean);
    if (cleanedIds.length > 0) {
      userStore.removeClearedFromSrsQueue(cleanedIds);
    }
  }

  /**
   * Checks whether a specific item ID is queued for review
   */
  function isQueued(itemId: string): boolean {
    return userStore.isItemInSrsQueue(itemId);
  }

  /**
   * Retrieves priority item IDs for spaced repetition review
   */
  function getPriorityItems(limit: number = 3): string[] {
    return userStore.getSrsPriorityItems(limit);
  }

  /**
   * Clears the entire SRS queue
   */
  function clearQueue(): void {
    userStore.clearSrsQueue();
  }

  /**
   * Filters an array of objects to only those present in the SRS queue
   */
  function filterQueueItems<T extends { id: string }>(items: T[]): T[] {
    if (!items || items.length === 0 || count.value === 0) return [];
    const queueSet = new Set(queue.value);
    return items.filter((item) => queueSet.has(item.id));
  }

  /**
   * Assembles a balanced item set:
   * Up to `srsTargetCount` items drawn from the user's SRS queue,
   * filled up to `totalCount` with non-SRS items from `pool`.
   */
  function assembleSrsSessionPool<T extends { id: string }>(
    pool: T[],
    srsTargetCount: number = 3,
    totalCount: number = 6
  ): T[] {
    if (!pool || pool.length === 0) return [];

    const queueSet = new Set(queue.value);
    const srsCandidates = pool.filter((item) => queueSet.has(item.id));
    const nonSrsCandidates = pool.filter((item) => !queueSet.has(item.id));

    const selectedSrs = srsCandidates.slice(0, srsTargetCount);
    const neededNonSrs = Math.max(0, totalCount - selectedSrs.length);
    const selectedNonSrs = nonSrsCandidates.slice(0, neededNonSrs);

    const result = [...selectedSrs, ...selectedNonSrs];

    // If still not enough, grab remainder from pool ignoring duplicates
    if (result.length < totalCount) {
      const existingIds = new Set(result.map((r) => r.id));
      for (const item of pool) {
        if (!existingIds.has(item.id)) {
          result.push(item);
          existingIds.add(item.id);
          if (result.length >= totalCount) break;
        }
      }
    }

    return result;
  }

  return {
    queue,
    count,
    hasPendingReview,
    recordMistake,
    recordMastery,
    isQueued,
    getPriorityItems,
    clearQueue,
    filterQueueItems,
    assembleSrsSessionPool,
  };
}

