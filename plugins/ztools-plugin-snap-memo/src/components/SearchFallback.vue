<script setup lang="ts">
/**
 * 页面内搜索框：宿主子输入框不可用（浏览器开发态 / API 缺失）时的降级入口，
 * 与子输入框共用 store.query，行为一致。
 */
import { ref, watch } from 'vue'
import type { AppStore } from '../store/appStore'
import Icon from './Icon.vue'
import { t } from '../i18n/zh-CN'

const props = defineProps<{ store: AppStore }>()
const emit = defineEmits<{ (e: 'focused'): void }>()

const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.store.state.view,
  (v) => {
    if (v === 'list') {
      // 视图回到列表时自动聚焦，保证键盘可直接输入
      requestAnimationFrame(() => inputRef.value?.focus())
    }
  }
)

/** 供 App 在 '/' 或 Mod+F 时聚焦。 */
function focus(): void {
  inputRef.value?.focus()
  inputRef.value?.select()
}

defineExpose({ focus })

function onInput(e: Event): void {
  props.store.actions.setQuery((e.target as HTMLInputElement).value)
}

function clear(): void {
  props.store.actions.setQuery('')
  inputRef.value?.focus()
}
</script>

<template>
  <div class="fallback-search">
    <Icon name="search" :size="13" class="search-icon" />
    <input
      ref="inputRef"
      :value="store.state.query"
      class="fallback-input"
      :placeholder="t('searchPlaceholderFallback')"
      :aria-label="t('searchPlaceholderFallback')"
      @input="onInput"
      @focus="emit('focused')"
    />
    <button v-if="store.state.query" class="sm-icon-btn" :title="t('a11y.clearSearch')" :aria-label="t('a11y.clearSearch')" @click="clear">
      <Icon name="close" :size="13" />
    </button>
  </div>
</template>

<style scoped>
.fallback-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 10px 0;
  padding: 0 10px;
  border: 1px solid var(--sm-border);
  border-radius: var(--sm-radius-m);
  background: var(--sm-surface);
  flex: none;
}

.search-icon {
  color: var(--sm-text-3);
  flex: none;
}

.fallback-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  padding: 8px 0;
}

.fallback-input:focus {
  outline: none;
}
</style>
