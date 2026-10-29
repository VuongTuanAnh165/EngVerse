/**
 * EngVerse - Global UI State Management
 * Coordinates shared modal/drawer states across Header, BottomNav, and WorldMap.
 * Uses Nuxt useState for seamless SSR and reactive cross-component synchronization.
 */

import { useState } from '#app';

export function useUiState() {
  const isLeaderboardOpen = useState<boolean>('engverse_leaderboard_open', () => false);
  const isMobileMenuOpen = useState<boolean>('engverse_mobile_menu_open', () => false);

  function openLeaderboard(): void {
    isLeaderboardOpen.value = true;
  }

  function closeLeaderboard(): void {
    isLeaderboardOpen.value = false;
  }

  function openMobileMenu(): void {
    isMobileMenuOpen.value = true;
  }

  function closeMobileMenu(): void {
    isMobileMenuOpen.value = false;
  }

  function toggleMobileMenu(): void {
    isMobileMenuOpen.value = !isMobileMenuOpen.value;
  }

  return {
    isLeaderboardOpen,
    isMobileMenuOpen,
    openLeaderboard,
    closeLeaderboard,
    openMobileMenu,
    closeMobileMenu,
    toggleMobileMenu,
  };
}

