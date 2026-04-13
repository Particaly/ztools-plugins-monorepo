<script setup lang="ts">
import type { HostPreset } from '@/types/hosts'

defineProps<{
  presets: HostPreset[]
  activePresetId: string | null
  selectedPresetId: string | null
}>()

const emit = defineEmits<{
  create: []
  duplicate: [id: string]
  delete: [id: string]
  select: [id: string]
  apply: [id: string]
  deactivate: []
}>()
</script>

<template>
  <aside class="preset-list">
    <div class="preset-list-header">
      <span>预设列表</span>
      <button class="btn btn-sm" @click="emit('create')">+ 新建</button>
    </div>
    <ul class="preset-list-items">
      <li
        v-for="preset in presets"
        :key="preset.id"
        :class="[
          'preset-item',
          { 'preset-item--selected': preset.id === selectedPresetId },
          { 'preset-item--active': preset.id === activePresetId },
        ]"
        @click="emit('select', preset.id)"
      >
        <div class="preset-item-info">
          <span class="preset-item-name">{{ preset.name }}</span>
          <span class="preset-item-count">{{ preset.entries.filter(e => e.enabled).length }} 条</span>
        </div>
        <div class="preset-item-actions">
          <button
            v-if="preset.id === activePresetId"
            class="btn btn-sm btn-warning"
            @click.stop="emit('deactivate')"
          >停用</button>
          <button
            v-else
            class="btn btn-sm btn-primary"
            @click.stop="emit('apply', preset.id)"
          >应用</button>
          <button class="btn btn-sm" @click.stop="emit('duplicate', preset.id)">复制</button>
          <button class="btn btn-sm btn-danger" @click.stop="emit('delete', preset.id)">删除</button>
        </div>
      </li>
      <li v-if="presets.length === 0" class="preset-list-empty">
        暂无预设，点击新建
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.preset-list {
  width: 220px;
  border-right: 1px solid var(--border-color, #e0e0e0);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.preset-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  font-weight: 600;
  font-size: 12px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}
.preset-list-items {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  flex: 1;
}
.preset-item {
  padding: 6px 10px;
  cursor: pointer;
  border-left: 3px solid transparent;
}
.preset-item:hover { background: var(--bg-color-secondary, #f0f0f0); }
.preset-item--selected { border-left-color: #58a4f6; background: var(--bg-color-secondary, #f0f0f0); }
.preset-item--active .preset-item-name::after {
  content: ' *';
  color: #58a4f6;
}
.preset-item-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.preset-item-name { font-weight: 500; }
.preset-item-count { font-size: 11px; color: var(--text-color-secondary, #888); }
.preset-item-actions {
  display: flex;
  gap: 4px;
}
.preset-list-empty {
  padding: 16px 10px;
  text-align: center;
  color: var(--text-color-secondary, #888);
  font-size: 12px;
}
</style>
