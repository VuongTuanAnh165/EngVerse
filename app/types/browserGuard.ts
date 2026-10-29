/**
 * EngVerse - Browser Guard Types
 * Strictly typed schema for in-app browser (WebView) detection and fallbacks
 * Reference: docs/ke_hoach.md - Sprint 1 (Task 3)
 */

export type InAppBrowserType =
  | 'Zalo'
  | 'Facebook'
  | 'Instagram'
  | 'TikTok'
  | 'Messenger'
  | 'Other'
  | null;

export interface BrowserGuardState {
  isRestrictedWebView: boolean;
  browserType: InAppBrowserType;
  isIos: boolean;
  isAndroid: boolean;
  currentUrl: string;
}

