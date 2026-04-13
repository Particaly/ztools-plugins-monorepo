<script setup lang="ts">
import type { HostPreset, HostEntry } from '@/types/hosts'
import { validateEntry } from '../lib/hosts'

const props = defineProps<{
  preset: HostPreset
  isActive: boolean
}>()

const emit = defineEmits<{
  update: [preset: HostPreset]
  addEntry: [presetId: string]
  updateEntry: [presetId: string, entryId: string, field: keyof HostEntry, value: any]
  deleteEntry: [presetId: string, entryId: string]
}>()

function onFieldChange(entryId: string, field: keyof HostEntry, event: Event) {
  const target = event.target as HTMLInputElement
  let value: any = target.value
  if (field === 'enabled') value = target.checked
  emit('updateEntry', props.preset.id, entryId, field, value)
}
</script>

<template>
  <div class="preset-editor">
    <div class="editor-header">
      <input
        class="editor-name"
        :value="preset.name"
        placeholder="预设名称"
        @change="(e) => emit('update', { ...preset, name: (e.target as HTMLInputElement).value })"
      />
      <span v-if="isActive" class="active-tag">当前生效</span>
    </div>
    <input
      class="editor-desc"
      :value="preset.description || ''"
      placeholder="备注说明（可选）"
      @change="(e) => emit('update', { ...preset, description: (e.target as HTMLInputElement).value || undefined })"
    />

    <div class="entries-header">
      <span>IP / 域名映射</span>
      <button class="btn btn-sm btn-primary" @click="emit('addEntry', preset.id)">+ 添加条目</button>
    </div>

    <ul class="entries-list">
      <li v-for="entry in preset.entries" :key="entry.id" :class="['entry-row', { 'entry-row--disabled': !entry.enabled }]">
        <label class="entry-toggle">
          <input type="checkbox" :checked="entry.enabled" @change="onFieldChange(entry.id, 'enabled', $event)" />
        </label>
        <input
          class="entry-ip"
          :value="entry.ip"
          placeholder="IP 地址"
          @change="onFieldChange(entry.id, 'ip', $event)"
        />
        <input
          class="entry-domain"
          :value="entry.domain"
          placeholder="域名"
          @change="onFieldChange(entry.id, 'domain', $event)"
        />
        <input
          class="entry-comment"
          :value="entry.comment || ''"
          placeholder="备注"
          @change="onFieldChange(entry.id, 'comment', $event)"
        />
        <button class="btn btn-sm btn-danger entry-delete" @click="emit('deleteEntry', preset.id, entry.id)">x</button>
      </li>
    </ul>
    <div v-if="preset.entries.length === 0" class="entries-empty">
      暂无条目，点击上方添加
    </div>
  </div>
</template>

<style scoped>
.preset-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.editor-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.editor-name {
  font-size: 14px;
  font-weight: 600;
  border: none;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  background: transparent;
  padding: 2px 4px;
  outline: none;
  flex: 1;
  color: inherit;
}
.editor-name:focus { border-bottom-color: #58a4f6; }
.active-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  background: #58a4f6;
  color: #fff;
  white-space: nowrap;
}
.editor-desc {
  font-size: 12px;
  border: none;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  background: transparent;
  padding: 2px 4px;
  outline: none;
  color: inherit;
}
.editor-desc:focus { border-bottom-color: #58a4f6; }
.entries-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 600;
}
.entries-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.entry-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 0;
}
.entry-row--disabled { opacity: 0.5; }
.entry-toggle { display: flex; align-items: center; }
.entry-ip, .entry-domain, .entry-comment {
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 12px;
  outline: none;
  background: transparent;
  color: inherit;
}
.entry-ip { width: 110px; }
.entry-domain { flex: 1; min-width: 80px; }
.entry-comment { width: 100px; }
.entry-ip:focus, .entry-domain:focus, .entry-comment:focus { border-color: #58a4f6; }
.entry-delete { font-size: 11px; padding: 0 4px; line-height: 1.8; }
.entries-empty {
  padding: 20px;
  text-align: center;
  color: var(--text-color-secondary, #888);
  font-size: 12px;
}
</style>
