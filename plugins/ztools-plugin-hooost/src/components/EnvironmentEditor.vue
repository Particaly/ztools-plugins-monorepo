<script setup lang="ts">
import { computed } from 'vue'
import type { Environment, SourceLine } from '@/types/hosts'
import { renderLinesToSource } from '../lib/hosts'
import { Switch } from '@/components'
import SourceModeEditor from './SourceModeEditor.vue'

const props = defineProps<{
  environment: Environment
  isActive: boolean
}>()

const emit = defineEmits<{
  addEntry: [envId: string]
  updateEntry: [envId: string, entryId: string, field: keyof SourceLine, value: any]
  deleteEntry: [envId: string, entryId: string]
  toggleMode: [envId: string]
  sourceChange: [envId: string, content: string]
  updateName: [envId: string, name: string]
}>()

function onFieldChange(entryId: string, field: keyof SourceLine, event: Event) {
  const target = event.target as HTMLInputElement
  let value: any = target.value
  if (field === 'enabled') value = target.checked
  emit('updateEntry', props.environment.id, entryId, field, value)
}

function onSourceChange(content: string) {
  emit('sourceChange', props.environment.id, content)
}

const hostLines = computed(() =>
  props.environment.lines.filter(l => l.type === 'host')
)
</script>

<template>
  <div class="env-editor">
    <div class="editor-header">
      <input
        v-if="environment.type !== 'public'"
        class="editor-name"
        :value="environment.name"
        placeholder="环境名称"
        @change="(e) => emit('updateName', environment.id, (e.target as HTMLInputElement).value)"
      />
      <span v-else class="editor-name editor-name--readonly">{{ environment.name }}</span>
      <span v-if="isActive" class="active-tag">当前生效</span>
      <span class="mode-switch">
        <Switch
          :model-value="environment.editMode === 'source'"
          active-text="源码"
          inactive-text="条目"
          @update:model-value="emit('toggleMode', environment.id)"
        />
      </span>
    </div>

    <!-- Entry mode: only show host-type lines -->
    <template v-if="environment.editMode === 'entry'">
      <div class="entries-header">
        <span>IP / 域名映射</span>
        <button v-if="environment.type !== 'public'" class="btn btn-sm btn-primary" @click="emit('addEntry', environment.id)">+ 添加条目</button>
      </div>

      <ul class="entries-list">
        <li v-for="entry in hostLines" :key="entry.id" :class="['entry-row', { 'entry-row--disabled': !entry.enabled }]">
          <label v-if="environment.type !== 'public'" class="toggle entry-toggle" @click.stop>
            <input type="checkbox" :checked="entry.enabled" @change="onFieldChange(entry.id, 'enabled', $event)" />
            <span class="toggle-slider"></span>
          </label>
          <input
            class="entry-ip input"
            :value="entry.ip"
            placeholder="IP 地址"
            @change="onFieldChange(entry.id, 'ip', $event)"
          />
          <input
            class="entry-domain input"
            :value="entry.domain"
            placeholder="域名"
            @change="onFieldChange(entry.id, 'domain', $event)"
          />
          <input
            class="entry-comment input"
            :value="entry.comment || ''"
            placeholder="备注"
            @change="onFieldChange(entry.id, 'comment', $event)"
          />
          <button v-if="environment.type !== 'public'" class="btn btn-sm btn-danger entry-delete" @click="emit('deleteEntry', environment.id, entry.id)">x</button>
        </li>
      </ul>
      <div v-if="hostLines.length === 0" class="entries-empty">
        暂无条目
      </div>
    </template>

    <!-- Source mode: show full source content -->
    <template v-else>
      <SourceModeEditor
        :model-value="renderLinesToSource(environment.lines)"
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
  background: transparent;
  padding: 2px 4px;
  outline: none;
  flex: 1;
  color: inherit;
}
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
.mode-switch {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
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
.entry-ip { width: 150px; }
.entry-domain { min-width: 80px; }
.entry-comment { width: 180px; }
.entry-delete { font-size: 11px; padding: 0 4px; line-height: 1.8; }
.entries-empty {
  padding: 20px;
  text-align: center;
  color: var(--text-color-secondary, #888);
  font-size: 12px;
}
</style>