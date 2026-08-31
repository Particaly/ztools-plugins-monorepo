<!--
  UiSegmented：分段控件（替代 ztools-ui ZTabs type="segment"，reka-ui Tabs）。

  与原 ZTabs/ZTabPane 用法对齐但简化 API：options 数组代替 ZTabPane 子组件，
  modelValue + update:modelValue（恒 string）。消费场景：侧边栏「视图」
  并排 / 统一两段切换。

  视觉：浅米灰轨道（surface-2）+ 纸白活动片（1px 阴影）—— 北欧经典分段
  控件；活动片与轨道的对比就是全部层次，无多余描边。data-state 由 reka
  TabsTrigger 提供（active / inactive）。
-->
<script setup lang="ts">
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

defineProps<{
  modelValue: string
  options: { label: string; value: string }[]
  ariaLabel?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <TabsRoot
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', String($event))"
  >
    <TabsList class="ui-segmented" :aria-label="ariaLabel">
      <TabsTrigger
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        class="ui-segmented-item"
      >
        {{ option.label }}
      </TabsTrigger>
    </TabsList>
  </TabsRoot>
</template>

<style scoped>
/* 轨道：满宽浅米灰，2px 内衬让活动片有「嵌在槽里」的纸感 */
.ui-segmented {
  display: flex;
  width: 100%;
  padding: 2px;
  border-radius: var(--radius-s, 6px);
  background-color: var(--surface-2, #f1efe9);
}

/* 活动：纸白片 + 1px 阴影；非活动 hover 仅文字加深（极轻） */
.ui-segmented-item {
  flex: 1 1 0;
  min-width: 0;
  height: 22px;
  padding: 0 8px;
  border: none;
  border-radius: 4px;
  background-color: transparent;
  color: var(--text-secondary, #8a8377);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.12s var(--ease-quiet), color 0.12s var(--ease-quiet),
    box-shadow 0.12s var(--ease-quiet);
}

.ui-segmented-item:hover {
  color: var(--text-color, #2e2c28);
}

.ui-segmented-item:focus-visible {
  outline: 1.5px solid var(--primary-color);
  outline-offset: 1px;
}

.ui-segmented-item[data-state='active'] {
  background-color: var(--surface, #ffffff);
  color: var(--text-color, #2e2c28);
  font-weight: 600;
  box-shadow: var(--shadow-1);
}
</style>
