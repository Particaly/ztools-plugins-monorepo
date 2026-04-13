<script setup lang="ts">
import type { Environment, HostEntry } from '@/types/hosts'
import { validateEntry, renderEntriesToSource } from '../lib/hosts'
import SourceModeEditor from './SourceModeEditor.vue'

const props = defineProps<{
  environment: Environment
  isActive: boolean
  publicContent: string
}>()

const emit = defineEmits<{
  update: [env: Environment]
  addEntry: [envId: string]
  updateEntry: [envId: string, entryId: string, field: keyof HostEntry, value: any]
  deleteEntry: [envId: string, entryId: string]
  toggleMode: [envId: string]
}>()

function onFieldChange(entryId: string, field: keyof HostEntry, event: Event) {
  const target = event.target as HTMLInputElement
  let value: any = target.value
  if (field === 'enabled') value = target.checked
  emit('updateEntry', props.environment.id, entryId, field, value)
}

function onSourceChange(content: string) {
  emit('update', { ...props.environment, sourceContent: content })
}
</script>

<template>
  <div class="env-editor">
    <div class="editor-header">
      <input
        v-if="environment.type !== 'public'"
        class="editor-name"
        :value="environment.name"
        placeholder="环境名称"
        @change="(e) => emit('update', { ...environment, name: (e.target as HTMLInputElement).value })"
      />
      <span v-else class="editor-name editor-name--readonly">{{ environment.name }}</span>
      <span v-if="isActive" class="active-tag">当前生效</span>
      <button
        v-if="environment.type !== 'public'"
        class="btn btn-sm btn-mode"
        @click="emit('toggleMode', environment.id)"
      >
        {{ environment.editMode === 'entry' ? '源码模式' : '条目模式' }}
      </button>
    </div>

    <!-- Public environment: show original hosts content (read-only) -->
    <div v-if="environment.type === 'public'" class="public-content">
      <div class="public-content-header">
        <span>原始 Hosts 内容</span>
        <span class="public-content-hint">（只读，不受管理）</span>
      </div>
      <pre class="public-content-body">{{ publicContent || '（空）' }}</pre>
    </div>

    <!-- Entry mode -->
    <template v-else-if="environment.editMode === 'entry'">
      <div class="entries-header">
        <span>IP / 域名映射</span>
        <button class="btn btn-sm btn-primary" @click="emit('addEntry', environment.id)">+ 添加条目</button>
      </div>

      <ul class="entries-list">
        <li v-for="entry in environment.entries" :key="entry.id" :class="['entry-row', { 'entry-row--disabled': !entry.enabled }]">
          <label class="toggle entry-toggle" @click.stop>
            <input type="checkbox" :checked="entry.enabled" @change="onFieldChange(entry.id, 'enabled', $event)" />
            <span class="toggle-slider"></span>
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
          <button class="btn btn-sm btn-danger entry-delete" @click="emit('deleteEntry', environment.id, entry.id)">x</button>
        </li>
      </ul>
      <div v-if="environment.entries.length === 0" class="entries-empty">
        暂无条目，点击上方添加
      </div>
    </template>

    <!-- Source mode -->
    <template v-else>
      <SourceModeEditor
        :model-value="environment.sourceContent ?? renderEntriesToSource(environment.entries)"
        @update:model-value="onSourceChange"
      />
    </template>
  </div>
</template>

<style scoped>
.env-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-height: 0;
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
.editor-name--readonly {
  border-bottom: none;
  cursor: default;
}
.active-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  background: #58a4f6;
  color: #fff;
  white-space: nowrap;
}
.btn-mode {
  white-space: nowrap;
  font-size: 11px;
}
.public-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}
.public-content-header {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
}
.public-content-hint {
  font-weight: 400;
  color: var(--text-color-secondary, #888);
  font-size: 11px;
}
.public-content-body {
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  padding: 8px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
  background: var(--bg-color-secondary, #f8f8f8);
  max-height: 400px;
  overflow-y: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
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
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.entry-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 0;
}
.entry-row--disabled { opacity: 0.5; }
.entry-toggle {
  transform: scale(0.75);
  transform-origin: left center;
}
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
