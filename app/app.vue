<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useUserStore } from '~/stores/user';

const userStore = useUserStore();

// Dynamically bind <html data-theme="..."> to active world track ('kids' | 'teens' | 'adults')
const currentTheme = computed(() => userStore.currentTrack || 'kids');

useHead({
  htmlAttrs: {
    'data-theme': currentTheme,
    lang: 'vi',
  },
  title: 'EngVerse - Nền tảng Game Học Tiếng Anh Đa Vũ Trụ',
  meta: [
    {
      name: 'description',
      content: 'Chinh phục tiếng Anh qua 3 vũ trụ: Đảo Thần Thoại, Cyber City và SimLife Global.',
    },
    {
      name: 'viewport',
      content: 'width=device-width, initial-scale=1, maximum-scale=1',
    },
  ],
});

onMounted(() => {
  userStore.initUserSession();
});
</script>

<template>
  <div id="engverse-app">
    <!-- Global In-App Browser Guard Banner (Zalo/FB/TikTok WebView Warning) -->
    <BrowserGuardBanner />

    <!-- Global Multi-Universe Navigation Header -->
    <Header />

    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<style>
html,
body {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

*,
*::before,
*::after {
  box-sizing: inherit;
}

/* Ensure buttons, inputs, textareas explicitly inherit font-family across all browsers */
button,
input,
optgroup,
select,
textarea {
  font-family: inherit;
  font-size: 100%;
  color: inherit;
}
</style>
