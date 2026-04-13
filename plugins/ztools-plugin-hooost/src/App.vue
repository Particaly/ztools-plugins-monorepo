<script setup lang="ts">
import { onMounted, ref } from 'vue'

const route = ref('')
const enterAction = ref<any>({})

onMounted(() => {
  window.ztools.onPluginEnter((action) => {
    route.value = action.code
    enterAction.value = action
  })
  window.ztools.onPluginOut(() => {
    route.value = ''
  })
})
</script>

<template>
  <Hello v-if="route === 'hello'" :enter-action="enterAction" />
  <Read v-if="route === 'read'" :enter-action="enterAction" />
  <Write v-if="route === 'write'" :enter-action="enterAction" />
</template>
