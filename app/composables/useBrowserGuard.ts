import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { InAppBrowserType } from '~/types/browserGuard';

/**
 * EngVerse - useBrowserGuard Composable
 * Detects restricted in-app WebViews (Zalo, Facebook, Instagram, TikTok)
 * that block microphone permissions and SpeechRecognition.
 * Reference: docs/ke_hoach.md - Sprint 1 (Task 3)
 */
export function useBrowserGuard() {
  const isRestrictedWebView = ref<boolean>(false);
  const browserType = ref<InAppBrowserType>(null);
  const isIos = ref<boolean>(false);
  const isAndroid = ref<boolean>(false);
  const isDismissed = ref<boolean>(false);
  const isCopied = ref<boolean>(false);
  let copyTimeoutId: ReturnType<typeof setTimeout> | null = null;

  function detectInAppBrowser(): void {
    if (!import.meta.client) {
      return;
    }

    const ua = navigator.userAgent || navigator.vendor || '';

    // Detect operating system
    isIos.value =
      /(iPhone|iPod|iPad)/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    isAndroid.value = /Android/i.test(ua);

    // Detect in-app webviews
    if (/zalo/i.test(ua)) {
      browserType.value = 'Zalo';
      isRestrictedWebView.value = true;
    } else if (/FBAN|FBAV/i.test(ua)) {
      browserType.value = 'Facebook';
      isRestrictedWebView.value = true;
    } else if (/Instagram/i.test(ua)) {
      browserType.value = 'Instagram';
      isRestrictedWebView.value = true;
    } else if (/musical_ly|TikTok|ByteDance/i.test(ua)) {
      browserType.value = 'TikTok';
      isRestrictedWebView.value = true;
    } else if (/Messenger|FB_IAB/i.test(ua)) {
      browserType.value = 'Messenger';
      isRestrictedWebView.value = true;
    } else {
      browserType.value = null;
      isRestrictedWebView.value = false;
    }

    // Check if user previously dismissed banner in current session
    try {
      const storedDismiss = sessionStorage.getItem('engverse_browser_guard_dismissed');
      if (storedDismiss === 'true') {
        isDismissed.value = true;
      }
    } catch {
      // Ignore sessionStorage exceptions (e.g. strict security settings)
    }
  }

  function dismissBanner(): void {
    isDismissed.value = true;
    try {
      sessionStorage.setItem('engverse_browser_guard_dismissed', 'true');
    } catch {
      // Ignore sessionStorage write errors
    }
  }

  async function copyCurrentUrl(): Promise<boolean> {
    if (!import.meta.client) {
      return false;
    }

    const url = window.location.href;
    let succeeded = false;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        succeeded = true;
      } else {
        // Fallback for older WebViews lacking modern Clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        textArea.style.left = '-9999px';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.select();
        succeeded = document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch {
      succeeded = false;
    }

    if (succeeded) {
      isCopied.value = true;
      if (copyTimeoutId) {
        clearTimeout(copyTimeoutId);
      }
      copyTimeoutId = setTimeout(() => {
        isCopied.value = false;
      }, 3000);
    }

    return succeeded;
  }

  function openInExternalBrowser(): void {
    if (!import.meta.client) {
      return;
    }

    const currentUrl = window.location.href;

    if (isAndroid.value) {
      // Android Chrome Intent deep-link
      const cleanUrl = currentUrl.replace(/^https?:\/\//, '');
      const chromeIntent = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
      window.location.href = chromeIntent;
    } else {
      // On iOS, WebViews do not allow programmatically launching Safari.
      // Copy URL and guide user to open Safari manually.
      void copyCurrentUrl();
    }
  }

  onMounted(() => {
    detectInAppBrowser();
  });

  onUnmounted(() => {
    if (copyTimeoutId) {
      clearTimeout(copyTimeoutId);
      copyTimeoutId = null;
    }
  });

  const shouldShowBanner = computed<boolean>(() => {
    return isRestrictedWebView.value && !isDismissed.value;
  });

  return {
    isRestrictedWebView,
    browserType,
    isIos,
    isAndroid,
    isDismissed,
    isCopied,
    shouldShowBanner,
    dismissBanner,
    copyCurrentUrl,
    openInExternalBrowser,
  };
}

