<script setup lang="ts">
/**
 * 底部精简提示栏：按当前视图给一组可发现的快捷键提示（键符按平台显示 ⌘/Ctrl）。
 * 空间不足时自动横向滚动而不是裁切；「?」入口在分组栏。
 */
import { computed } from 'vue'
import { platform } from '../platform'
import type { AppStore } from '../store/appStore'
import { t } from '../i18n/zh-CN'

const props = defineProps<{ store: AppStore }>()

const mod = platform.isMac ? '⌘' : 'Ctrl'

interface Hint {
  key: string
  label: string
}

const hints = computed<Hint[]>(() => {
  switch (props.store.state.view) {
    case 'list':
      return [
        { key: '↑↓', label: t('hints.nav') },
        { key: '↵', label: t('hints.enter') },
        { key: '⇧↵', label: t('hints.shiftEnter') },
        { key: 'Tab', label: t('hints.groups') },
        { key: `${mod}+N`, label: t('hints.new') },
        { key: `${mod}+A`, label: t('hints.batch') },
        { key: 'Del', label: t('hints.del') },
        { key: '?', label: t('hints.help') }
      ]
    case 'editor':
      return [
        { key: `${mod}↵`, label: t('editor.save') },
        { key: `${mod}⇧↵`, label: t('editor.saveNew') },
        { key: 'Esc', label: t('hints.close') }
      ]
    default:
      return [{ key: 'Esc', label: t('hints.close') }]
  }
})
</script>

<template>
  <footer class="hint-bar" aria-hidden="true">
    <span v-for="(hint, i) in hints" :key="i" class="hint">
      <span class="kbd">{{ hint.key }}</span>
      <span class="hint-label">{{ hint.label }}</span>
    </span>
  </footer>
</template>

<style scoped>
.hint-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 5px 12px;
  border-top: 1px solid var(--sm-border);
  background: var(--sm-surface);
  color: var(--sm-text-3);
  overflow-x: auto;
  overflow-y: hidden;
  flex: none;
  scrollbar-width: none;
  white-space: nowrap;
}

.hint-bar::-webkit-scrollbar {
  display: none;
}

.hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  flex: none;
}

.hint-label {
  font-size: 11px;
}

@media (max-width: 659px) {
  .hint-bar {
    gap: 9px;
    padding: 5px 10px;
  }
}
</style>
