<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { HostEntry, HostPreset, PresetStore, BackupInfo, SystemInfo } from '@/types/hosts'
import { mergeHostsContent } from '@/lib/hosts'
import { Toast, useToast, ConfirmDialog, useConfirmDialog } from '@/components'
import PresetList from '@/components/PresetList.vue'
import PresetEditor from '@/components/PresetEditor.vue'

const { toastState, success, error: showError, confirm: toastConfirm, handleConfirm: handleToastConfirm, handleCancel: handleToastCancel } = useToast()
const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog()

const sysInfo = ref<SystemInfo | null>(null)
const store = ref<PresetStore>({ activePresetId: null, presets: [] })
const hostsContent = ref('')
const selectedPresetId = ref<string | null>(null)
const backups = ref<BackupInfo[]>([])
const loading = ref(false)

const selectedPreset = computed(() =>
  store.value.presets.find(p => p.id === selectedPresetId.value) ?? null
)

const activePreset = computed(() =>
  store.value.presets.find(p => p.id === store.value.activePresetId) ?? null
)

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

function saveStore() {
  window.services.savePresets(store.value)
}

function loadAll() {
  try {
    sysInfo.value = window.services.getSystemInfo()
    hostsContent.value = window.services.readHosts()
    store.value = window.services.loadPresets()
    backups.value = window.services.listBackups()
    if (!selectedPresetId.value && store.value.presets.length > 0) {
      selectedPresetId.value = store.value.activePresetId || store.value.presets[0].id
    }
  } catch (err: any) {
    showError('加载数据失败: ' + (err.message || String(err)))
  }
}

function createPreset() {
  const preset: HostPreset = {
    id: generateId(),
    name: '新预设',
    entries: [],
    updatedAt: new Date().toISOString(),
  }
  store.value.presets.push(preset)
  selectedPresetId.value = preset.id
  saveStore()
}

function duplicatePreset(id: string) {
  const source = store.value.presets.find(p => p.id === id)
  if (!source) return
  const copy: HostPreset = {
    ...JSON.parse(JSON.stringify(source)),
    id: generateId(),
    name: source.name + ' (副本)',
    updatedAt: new Date().toISOString(),
  }
  copy.entries.forEach(e => { e.id = generateId() })
  store.value.presets.push(copy)
  selectedPresetId.value = copy.id
  saveStore()
}

async function deletePreset(id: string) {
  const preset = store.value.presets.find(p => p.id === id)
  if (!preset) return
  const ok = await confirm({
    title: '删除预设',
    message: `确定要删除预设「${preset.name}」吗？此操作不可撤销。`,
    type: 'danger',
    confirmText: '删除',
    cancelText: '取消',
  })
  if (!ok) return
  store.value.presets = store.value.presets.filter(p => p.id !== id)
  if (store.value.activePresetId === id) store.value.activePresetId = null
  if (selectedPresetId.value === id) {
    selectedPresetId.value = store.value.presets.length > 0 ? store.value.presets[0].id : null
  }
  saveStore()
  success('已删除预设')
}

function updatePreset(updated: HostPreset) {
  const idx = store.value.presets.findIndex(p => p.id === updated.id)
  if (idx !== -1) {
    updated.updatedAt = new Date().toISOString()
    store.value.presets[idx] = updated
    saveStore()
  }
}

function addEntry(presetId: string) {
  const preset = store.value.presets.find(p => p.id === presetId)
  if (!preset) return
  const entry: HostEntry = {
    id: generateId(),
    ip: '127.0.0.1',
    domain: '',
    enabled: true,
  }
  preset.entries.push(entry)
  preset.updatedAt = new Date().toISOString()
  saveStore()
}

function updateEntry(presetId: string, entryId: string, field: keyof HostEntry, value: any) {
  const preset = store.value.presets.find(p => p.id === presetId)
  if (!preset) return
  const entry = preset.entries.find(e => e.id === entryId)
  if (!entry) return
  ;(entry as any)[field] = value
  preset.updatedAt = new Date().toISOString()
  saveStore()
}

function deleteEntry(presetId: string, entryId: string) {
  const preset = store.value.presets.find(p => p.id === presetId)
  if (!preset) return
  preset.entries = preset.entries.filter(e => e.id !== entryId)
  preset.updatedAt = new Date().toISOString()
  saveStore()
}

function applyPreset(id: string) {
  const preset = store.value.presets.find(p => p.id === id)
  if (!preset) return

  const enabledCount = preset.entries.filter(e => e.enabled).length
  if (enabledCount === 0) {
    showError('当前预设没有启用的条目')
    return
  }

  loading.value = true
  try {
    const currentHosts = window.services.readHosts()
    const newContent = mergeHostsContent(currentHosts, preset)
    const result = window.services.applyHosts(newContent, preset.name)

    if (result.success) {
      store.value.activePresetId = id
      hostsContent.value = newContent
      saveStore()
      backups.value = window.services.listBackups()
      success(`已应用预设「${preset.name}」`)
    } else {
      showError('写入 hosts 失败: ' + (result.error || '未知错误'))
    }
  } catch (err: any) {
    showError('应用失败: ' + (err.message || String(err)))
  } finally {
    loading.value = false
  }
}

async function deactivatePreset() {
  if (!activePreset.value) return
  const ok = await confirm({
    title: '停用预设',
    message: `确定要停用当前预设「${activePreset.value.name}」吗？`,
    type: 'warning',
    confirmText: '停用',
    cancelText: '取消',
  })
  if (!ok) return

  loading.value = true
  try {
    // 应用空区块来清除受控内容
    const emptyPreset: HostPreset = {
      id: '__deactivate__',
      name: activePreset.value.name,
      entries: [],
      updatedAt: new Date().toISOString(),
    }
    const currentHosts = window.services.readHosts()
    const newContent = mergeHostsContent(currentHosts, emptyPreset)
    const result = window.services.applyHosts(newContent, 'deactivate')

    if (result.success) {
      store.value.activePresetId = null
      hostsContent.value = newContent
      saveStore()
      backups.value = window.services.listBackups()
      success('已停用当前预设')
    } else {
      showError('停用失败: ' + (result.error || '未知错误'))
    }
  } catch (err: any) {
    showError('停用失败: ' + (err.message || String(err)))
  } finally {
    loading.value = false
  }
}

async function restoreBackup(backupPath: string) {
  const ok = await confirm({
    title: '恢复备份',
    message: '确定要恢复此备份吗？当前 hosts 文件将被覆盖。',
    type: 'warning',
    confirmText: '恢复',
    cancelText: '取消',
  })
  if (!ok) return

  loading.value = true
  try {
    const result = window.services.restoreBackup(backupPath)
    if (result.success) {
      hostsContent.value = window.services.readHosts()
      store.value.activePresetId = null
      saveStore()
      backups.value = window.services.listBackups()
      success('已恢复备份')
    } else {
      showError('恢复失败: ' + (result.error || '未知错误'))
    }
  } catch (err: any) {
    showError('恢复失败: ' + (err.message || String(err)))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  window.ztools.onPluginEnter(() => {
    loadAll()
  })
  window.ztools.onPluginOut(() => {})
  loadAll()
})
</script>

<template>
  <div class="app" :class="{ 'app--loading': loading }">
    <div class="app-body">
      <PresetList
        :presets="store.presets"
        :active-preset-id="store.activePresetId"
        :selected-preset-id="selectedPresetId"
        @create="createPreset"
        @duplicate="duplicatePreset"
        @delete="deletePreset"
        @select="(id: string) => selectedPresetId = id"
        @apply="applyPreset"
        @deactivate="deactivatePreset"
      />

      <div class="app-main">
        <PresetEditor
          v-if="selectedPreset"
          :preset="selectedPreset"
          :is-active="selectedPreset.id === store.activePresetId"
          @update="updatePreset"
          @add-entry="addEntry"
          @update-entry="updateEntry"
          @delete-entry="deleteEntry"
        />
        <div v-else class="app-empty">
          <p>选择或创建一个预设开始管理</p>
        </div>
      </div>
    </div>

    <Toast
      :message="toastState.message"
      :type="toastState.type"
      :duration="toastState.duration"
      :visible="toastState.visible"
      @update:visible="(v: boolean) => { if (!v) toastState.visible = false }"
    />
    <ConfirmDialog
      :visible="confirmState.visible"
      :title="confirmState.title"
      :message="confirmState.message"
      :type="confirmState.type"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      @confirm="handleConfirm"
      @cancel="handleCancel"
      @update:visible="(v: boolean) => { if (!v) handleCancel() }"
    />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
}
.app--loading { opacity: 0.7; pointer-events: none; }
.app-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}
.app-header h1 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.app-platform {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--bg-color-secondary, #f0f0f0);
  color: var(--text-color-secondary, #888);
}
.app-active-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  background: #58a4f6;
  color: #fff;
}
.app-body {
  display: flex;
  flex: 1;
  min-height: 0;
}
.app-main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 8px 12px;
}
.app-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  color: var(--text-color-secondary, #888);
}
</style>
