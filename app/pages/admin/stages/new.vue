<script setup lang="ts">
import StageEditor from './[id].vue';

definePageMeta({
  layout: 'admin',
  middleware: 'admin-auth',
});
</script>

<template>
  <StageEditor />
</template>

