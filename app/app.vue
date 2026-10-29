<script setup lang="ts">
// EngVerse Root Application
</script>

<template>
  <div id="engverse-app">
    <!-- Global In-App Browser Guard Banner -->
    <BrowserGuardBanner />

    <NuxtRouteAnnouncer />
    <NuxtWelcome />
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
</style>
