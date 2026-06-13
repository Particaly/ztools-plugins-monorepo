<template>
  <aside class="left-panel">
    <InsertPanelContent
      variant="sidebar"
      :active-tab="activeTab"
      :basic-shapes="basicShapes"
      :shape-preview-paths="shapePreviewPaths"
      :text-presets="textPresets"
      :icon-templates="iconTemplates"
      :user-assets="userAssets"
      :iconify-search="iconifySearch"
      :filtered-iconify-results="filteredIconifyResults"
      :iconify-collection-options="iconifyCollectionOptions"
      @update:active-tab="$emit('update:active-tab', $event)"
      @add-shape="$emit('add-shape', $event)"
      @add-text="$emit('add-text', $event)"
      @insert-template="$emit('insert-template', $event)"
      @apply-template-as-document="$emit('apply-template-as-document', $event)"
      @insert-user-asset="$emit('insert-user-asset', $event)"
      @rename-user-asset="$emit('rename-user-asset', $event)"
      @delete-user-asset="$emit('delete-user-asset', $event)"
      @update:iconify-query="$emit('update:iconify-query', $event)"
      @search-iconify-icons="$emit('search-iconify-icons')"
      @update:iconify-collection-filter="$emit('update:iconify-collection-filter', $event)"
      @insert-iconify-icon="$emit('insert-iconify-icon', $event)"
    />
  </aside>
</template>

<script setup lang="ts">
import InsertPanelContent from './InsertPanelContent.vue'
import type { IconTemplateItem, ShapeId, ShapeLibraryItem, TextLibraryItem } from '../editorCatalog'
import type { IconifySearchState, LeftPanelTab, UserAssetItem } from '../types'

type SelectOption = {
  label: string
  value: string
}

defineProps<{
  activeTab: LeftPanelTab
  basicShapes: ShapeLibraryItem[]
  shapePreviewPaths: Record<ShapeId, string>
  textPresets: TextLibraryItem[]
  iconTemplates: IconTemplateItem[]
  userAssets: UserAssetItem[]
  iconifySearch: IconifySearchState
  filteredIconifyResults: string[]
  iconifyCollectionOptions: SelectOption[]
}>()

defineEmits<{
  (event: 'update:active-tab', tab: LeftPanelTab): void
  (event: 'add-shape', item: ShapeLibraryItem): void
  (event: 'add-text', item: TextLibraryItem): void
  (event: 'insert-template', template: IconTemplateItem): void
  (event: 'apply-template-as-document', template: IconTemplateItem): void
  (event: 'insert-user-asset', asset: UserAssetItem): void
  (event: 'rename-user-asset', asset: UserAssetItem): void
  (event: 'delete-user-asset', asset: UserAssetItem): void
  (event: 'update:iconify-query', value: string): void
  (event: 'search-iconify-icons'): void
  (event: 'update:iconify-collection-filter', value: string): void
  (event: 'insert-iconify-icon', name: string): void
}>()
</script>

<style lang="scss" scoped>
@use '../styles/tokens' as *;

.left-panel {
  width: $left-w;
  background: $panel-bg;
  border-right: $border;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
}
</style>
