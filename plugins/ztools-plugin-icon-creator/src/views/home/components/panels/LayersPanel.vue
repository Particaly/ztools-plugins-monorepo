<template>
  <div class="right-panel-scroll">
    <!-- 图层区 -->
    <div class="section-title">
      <span>图层</span>
    </div>
    <div class="layer-toolbar">
      <ZButton class="layer-toolbar-btn" size="small" title="上移" @click="$emit('layer-up')"><Icon icon="mdi:arrow-up" /></ZButton>
      <ZButton class="layer-toolbar-btn" size="small" title="下移" @click="$emit('layer-down')"><Icon icon="mdi:arrow-down" /></ZButton>
      <ZButton class="layer-toolbar-btn" size="small" title="置顶" @click="$emit('layer-top')"><Icon icon="mdi:arrow-collapse-up" /></ZButton>
      <ZButton class="layer-toolbar-btn" size="small" title="置底" @click="$emit('layer-bottom')"><Icon icon="mdi:arrow-collapse-down" /></ZButton>
      <ZInput class="layer-search" size="small" type="text" placeholder="搜索" :model-value="layerSearch" @update:model-value="$emit('update:layer-search', String($event))" />
    </div>
    <div v-if="filteredLayers.length" class="layer-list">
      <VueDraggable
        v-model="localDragItems"
        class="layer-draggable-list"
        item-key="id"
        handle=".layer-drag-handle"
        :disabled="isLayerDragDisabled"
        @start="$emit('drag-start')"
        @end="$emit('reorder-layers')"
      >
        <div
          v-for="item in localDragItems" :key="item.id"
          class="layer-item"
          :class="{ active: isLayerActive(item.obj), 'is-drag-disabled': isLayerDragDisabled }"
          @mousedown="$emit('layer-mouse-down', item.obj, $event)"
          @contextmenu.prevent.stop="$emit('open-context-menu', item.obj, $event)"
        >
          <button class="layer-drag-handle" type="button" title="拖动排序" :disabled="isLayerDragDisabled">
            <Icon icon="mdi:drag-vertical" />
          </button>
          <span class="layer-name">{{ item.name }}</span>
          <button class="layer-icon-btn" @click.stop="$emit('toggle-visible', item.obj)">
            <Icon :icon="item.obj.visible !== false ? 'mdi:eye-outline' : 'mdi:eye-off-outline'" />
          </button>
          <button class="layer-icon-btn" @click.stop="$emit('toggle-lock', item.obj)">
            <Icon :icon="item.obj.lockMovementX ? 'mdi:lock' : 'mdi:lock-open-variant'" />
          </button>
          <button class="layer-icon-btn danger" @click.stop="$emit('remove-object', item.obj)"><Icon icon="mdi:close" /></button>
        </div>
      </VueDraggable>
    </div>
    <div v-else class="layer-empty">
      {{ layerSearch.trim() ? '未找到匹配的图层' : '当前没有图层' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { Icon } from '@iconify/vue'
import type { FabricObject } from 'fabric'
import { ZButton, ZInput } from 'ztools-ui'
import type { LayerItem } from '../../types'

const props = defineProps<{
  filteredLayers: LayerItem[]
  layerDragItems: LayerItem[]
  isLayerDragDisabled: boolean
  layerSearch: string
  isLayerActive: (obj: FabricObject) => boolean
}>()

const emit = defineEmits<{
  (event: 'update:layer-drag-items', items: LayerItem[]): void
  (event: 'update:layer-search', value: string): void
  (event: 'layer-up'): void
  (event: 'layer-down'): void
  (event: 'layer-top'): void
  (event: 'layer-bottom'): void
  (event: 'drag-start'): void
  (event: 'reorder-layers'): void
  (event: 'layer-mouse-down', obj: FabricObject, mouseEvent: MouseEvent): void
  (event: 'open-context-menu', obj: FabricObject, mouseEvent: MouseEvent): void
  (event: 'toggle-visible', obj: FabricObject): void
  (event: 'toggle-lock', obj: FabricObject): void
  (event: 'remove-object', obj: FabricObject): void
}>()

// 为 VueDraggable 提供本地 v-model 桥接，实际图层顺序仍由父组件统一提交和快照。
const localDragItems = computed({
  get: () => props.layerDragItems,
  set: (items: LayerItem[]) => emit('update:layer-drag-items', items)
})
</script>

<style lang="scss" scoped>
@use '../../styles/tokens' as *;

.right-panel-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.section-title {
  font-weight: 700;
  font-size: 12px;
  padding: 6px 4px;
  color: #555;
}
.layer-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  .layer-search {
    flex: 1;
    min-width: 0;
  }
}
.layer-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  min-width: 28px;
  height: 28px;
  padding: 0;
  box-sizing: border-box;
  border: 2px solid var(--control-border);
  border-radius: 6px;
  background: #fafafa;
  box-shadow: none;
  color: #555;
  font-size: 14px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease, background-color 0.15s ease;

  &:hover:not(:disabled) {
    background: #fafafa;
    border-color: color-mix(in srgb, var(--primary-color), black 15%);
    color: #333;
  }

  &:disabled {
    box-shadow: none;
  }

  :deep(svg) {
    width: 14px;
    height: 14px;
  }
}
.layer-list {
  display: flex;
  flex-direction: column;
}
.layer-draggable-list {
  display: flex;
  flex-direction: column;
  user-select: none;
}
.layer-empty {
  padding: 10px 8px 12px;
  font-size: 12px;
  color: #888;
}
.layer-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  cursor: pointer;
  user-select: none;
  &.active { background: #d0e0ff; }
  &:hover { background: #e8e8e8; }
  &.is-drag-disabled .layer-drag-handle {
    cursor: not-allowed;
    color: #bbb;
  }
  .layer-name {
    flex: 1;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    user-select: none;
  }
}
.layer-drag-handle {
  width: 20px;
  height: 20px;
  border: none;
  background: none;
  color: #888;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  &:disabled {
    cursor: not-allowed;
  }
  &:active:not(:disabled) {
    cursor: grabbing;
  }
}
.layer-icon-btn {
  width: 22px;
  height: 22px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  padding: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  &.danger:hover { color: #c00; }
}
</style>
