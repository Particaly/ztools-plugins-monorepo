<script setup lang="ts">
/**
 * 批量操作浮条：多选模式（Mod+A / 分组栏按钮）开启时悬浮在列表底部。
 * 全选 / 移到分组 / 加标签 / 删除所选 / 退出多选；删除走应用内确认 + 撤销。
 */
import { computed, ref } from 'vue'
import type { AppStore } from '../store/appStore'
import SmSelect from './SmSelect.vue'
import Icon from './Icon.vue'
import { t } from '../i18n/zh-CN'

const props = defineProps<{ store: AppStore }>()

const tagText = ref('')

/** 移动分组选择器：无选中值（占位态），选完即执行并回到占位。 */
const groupOptions = computed(() =>
  props.store.computed.batchGroupOptions.value.map((opt) => ({ value: opt.id, label: opt.label }))
)

function onPickGroup(opt: { value: string | null }): void {
  props.store.actions.batchMoveToGroup(opt.value)
}

function addTag(): void {
  props.store.actions.batchAddTags(tagText.value)
  tagText.value = ''
}
</script>

<template>
  <!-- 多选模式进出：纯透明度淡入淡出（batch-bar 自带 translateX 定位，预设须无位移） -->
  <Transition name="fade">
    <div
      v-if="store.state.batchMode"
      class="batch-bar"
      role="toolbar"
      :aria-label="t('batch.selected', { count: store.state.batchSelection.size })"
    >
      <span class="count">{{ t('batch.selected', { count: store.state.batchSelection.size }) }}</span>
      <button class="sm-btn small" @click="store.actions.selectAllBatch()">{{ t('batch.selectAll') }}</button>
      <SmSelect
        class="batch-select"
        :options="groupOptions"
        :placeholder="t('batch.moveGroup')"
        dense
        :aria-label="t('batch.moveGroup')"
        @select="onPickGroup"
      />
      <input v-model="tagText" class="sm-input batch-tag" :placeholder="t('batch.tagPlaceholder')" @keydown.enter.prevent="addTag" />
      <button
        class="sm-btn small danger"
        :disabled="store.state.batchSelection.size === 0"
        @click="store.actions.batchDeleteSelected()"
      >
        <Icon name="trash" :size="12" />
        {{ t('batch.delete') }}
      </button>
      <span class="spacer" />
      <button class="sm-btn small" @click="store.actions.toggleBatchMode(false)">{{ t('batch.exit') }}</button>
    </div>
  </Transition>
</template>

<style scoped>
.batch-bar {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: 40px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--sm-radius-m);
  background: var(--sm-surface);
  border: 1px solid var(--sm-accent);
  box-shadow: var(--sm-shadow-2);
  z-index: 45;
  max-width: calc(100% - 24px);
}

.count {
  font-size: var(--sm-font-s);
  font-weight: 600;
  white-space: nowrap;
}

.batch-select {
  width: 120px;
}

.batch-tag {
  width: 96px;
  padding: 3px 8px;
}

.spacer {
  flex: 1;
}
</style>
