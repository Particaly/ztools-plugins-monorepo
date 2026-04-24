<script setup lang="ts">
import { onMounted } from 'vue'
import router from './router'
import { useZtoolsTheme } from 'ztools-ui'

onMounted(() => {
  useZtoolsTheme();
  window.ztools.onPluginEnter((action) => {
    // window.ztools.resizeWindow(1440, 768)
    router.replace({
      name: 'icon-creator',
      state: { action }
    })
  })

  window.ztools.onPluginOut(() => {
    router.replace({ name: 'icon-creator' })
  })
})
</script>

<template>
  <router-view />
</template>

<style>
* {
  box-sizing: border-box;
}
</style>