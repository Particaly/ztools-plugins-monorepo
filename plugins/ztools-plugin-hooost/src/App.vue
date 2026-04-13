<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { HostEntry, Environment, EnvironmentStore, BackupInfo, SystemInfo } from '@/types/hosts'
import { mergeHostsContent, extractPublicContent, parseSourceToEntries, renderEntriesToSource } from '@/lib/hosts'
import { Toast, useToast, ConfirmDialog, useConfirmDialog } from '@/components'
import { useEnvironmentStorage } from '@/composables'
import EnvironmentList from '@/components/EnvironmentList.vue'
import EnvironmentEditor from '@/components/EnvironmentEditor.vue'

const { toastState, success, error: showError, confirm: toastConfirm, handleConfirm: handleToastConfirm, handleCancel: handleToastCancel } = useToast()
const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog()
const { loadStore, saveStore, loadPublicContent, savePublicContent } = useEnvironmentStorage()

const sysInfo = ref<SystemInfo | null>(null)
const store = ref<EnvironmentStore>({ activeEnvironmentId: null, environments: [] })
const publicContent = ref('')
const selectedEnvironmentId = ref<string | null>(null)
const backups = ref<BackupInfo[]>([])
const loading = ref(false)

const selectedEnvironment = computed(() =>
  store.value.environments.find(e => e.id === selectedEnvironmentId.value) ?? null
)

const activeEnvironment = computed(() =>
  store.value.environments.find(e => e.id === store.value.activeEnvironmentId) ?? null
)

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

function persistStore() {
  saveStore(store.value)
}

function loadAll() {
  try {
    sysInfo.value = window.services.getSystemInfo()
    const fullHosts = window.services.readHosts()

    // Load or initialize store from dbStorage
    store.value = loadStore()

    // Extract and save public content
    const extracted = extractPublicContent(fullHosts)
    publicContent.value = extracted
    savePublicContent({
      content: extracted,
      hash: btoa(extracted).substring(0, 16),
      updatedAt: new Date().toISOString(),
    })

    // Load backups
    backups.value = window.services.listBackups()

    // Auto-select first environment if none selected
    if (!selectedEnvironmentId.value && store.value.environments.length > 0) {
      selectedEnvironmentId.value = store.value.environments[0].id
    }
  } catch (err: any) {
    showError('加载数据失败: ' + (err.message || String(err)))
  }
}

function addEntry(envId: string) {
  const env = store.value.environments.find(e => e.id === envId)
  if (!env) return
  const entry: HostEntry = {
    id: generateId(),
    ip: '127.0.0.1',
    domain: '',
    enabled: true,
  }
  env.entries.push(entry)
  env.updatedAt = new Date().toISOString()
  persistStore()
}

function updateEntry(envId: string, entryId: string, field: keyof HostEntry, value: any) {
  const env = store.value.environments.find(e => e.id === envId)
  if (!env) return
  const entry = env.entries.find(e => e.id === entryId)
  if (!entry) return
  ;(entry as any)[field] = value
  env.updatedAt = new Date().toISOString()
  persistStore()
}

function deleteEntry(envId: string, entryId: string) {
  const env = store.value.environments.find(e => e.id === envId)
  if (!env) return
  env.entries = env.entries.filter(e => e.id !== entryId)
  env.updatedAt = new Date().toISOString()
  persistStore()
}

function updateEnvironment(updated: Environment) {
  const idx = store.value.environments.findIndex(e => e.id === updated.id)
  if (idx !== -1) {
    updated.updatedAt = new Date().toISOString()
    store.value.environments[idx] = updated
    persistStore()
  }
}

async function deleteEnvironment(id: string) {
  const env = store.value.environments.find(e => e.id === id)
  if (!env || env.type === 'public') return

  if (store.value.activeEnvironmentId === id) {
    const ok = await confirm({
      title: '删除环境',
      message: `环境「${env.name}」当前正在生效，删除将同时停用。确定要删除吗？`,
      type: 'danger',
      confirmText: '删除',
      cancelText: '取消',
    })
    if (!ok) return

    loading.value = true
    try {
      const publicContentData = loadPublicContent()
      const content = publicContentData?.content || window.services.readHosts()
      const result = window.services.applyHosts(content, 'deactivate')
      if (!result.success) {
        showError('停用失败: ' + (result.error || '未知错误'))
        return
      }
      store.value.activeEnvironmentId = null
    } catch (err: any) {
      showError('停用失败: ' + (err.message || String(err)))
      return
    } finally {
      loading.value = false
    }
  } else {
    const ok = await confirm({
      title: '删除环境',
      message: `确定要删除环境「${env.name}」吗？`,
      type: 'danger',
      confirmText: '删除',
      cancelText: '取消',
    })
    if (!ok) return
  }

  store.value.environments = store.value.environments.filter(e => e.id !== id)
  if (selectedEnvironmentId.value === id) {
    selectedEnvironmentId.value = store.value.environments.length > 0
      ? store.value.environments[0].id
      : null
  }
  persistStore()
  success(`已删除环境「${env.name}」`)
}

function toggleEditMode(envId: string) {
  const env = store.value.environments.find(e => e.id === envId)
  if (!env || env.type === 'public') return

  if (env.editMode === 'entry') {
    // Switching to source mode: render entries to source content
    env.sourceContent = renderEntriesToSource(env.entries)
    env.editMode = 'source'
  } else {
    // Switching to entry mode: parse source content to entries
    if (env.sourceContent) {
      env.entries = parseSourceToEntries(env.sourceContent)
    }
    env.editMode = 'entry'
  }
  env.updatedAt = new Date().toISOString()
  persistStore()
}

function applyEnvironment(id: string) {
  const env = store.value.environments.find(e => e.id === id)
  if (!env || env.type === 'public') return

  if (!env.enabled) {
    showError('请先启用该环境')
    return
  }

  // Sync source mode to entries before applying
  if (env.editMode === 'source' && env.sourceContent) {
    env.entries = parseSourceToEntries(env.sourceContent)
  }

  const enabledCount = env.entries.filter(e => e.enabled).length
  if (enabledCount === 0) {
    showError('当前环境没有启用的条目')
    return
  }

  loading.value = true
  try {
    const publicContentData = loadPublicContent()
    const baseContent = publicContentData?.content || window.services.readHosts()

    const newBlock = mergeHostsContent(baseContent, env)
    const newContent = newBlock.trimEnd() + '\n'

    const result = window.services.applyHosts(newContent, env.name)

    if (result.success) {
      store.value.activeEnvironmentId = id
      persistStore()
      backups.value = window.services.listBackups()
      success(`已应用环境「${env.name}」`)
    } else {
      showError('写入 hosts 失败: ' + (result.error || '未知错误'))
    }
  } catch (err: any) {
    showError('应用失败: ' + (err.message || String(err)))
  } finally {
    loading.value = false
  }
}

async function deactivateEnvironment() {
  if (!activeEnvironment.value) return
  const ok = await confirm({
    title: '停用环境',
    message: `确定要停用当前环境「${activeEnvironment.value.name}」吗？`,
    type: 'warning',
    confirmText: '停用',
    cancelText: '取消',
  })
  if (!ok) return

  loading.value = true
  try {
    const publicContentData = loadPublicContent()
    const content = publicContentData?.content || window.services.readHosts()

    const result = window.services.applyHosts(content, 'deactivate')

    if (result.success) {
      store.value.activeEnvironmentId = null
      persistStore()
      backups.value = window.services.listBackups()
      success('已停用当前环境')
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
      // Reload public content from restored hosts
      const fullHosts = window.services.readHosts()
      const extracted = extractPublicContent(fullHosts)
      publicContent.value = extracted
      savePublicContent({
        content: extracted,
        hash: btoa(extracted).substring(0, 16),
        updatedAt: new Date().toISOString(),
      })

      store.value.activeEnvironmentId = null
      persistStore()
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

function applyTheme(theme: { isDark: boolean; windowMaterial: string }) {
  console.log(theme);
  document.documentElement.setAttribute('data-material', theme.windowMaterial)
  document.documentElement.classList.toggle('dark', theme.isDark)
}

onMounted(() => {
  // Theme
  const theme = window.services.getThemeInfo()
  applyTheme(theme)
  window.services.onThemeChange((t) => applyTheme(t))

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
      <EnvironmentList
        :environments="store.environments"
        :active-environment-id="store.activeEnvironmentId"
        :selected-environment-id="selectedEnvironmentId"
        @select="(id: string) => selectedEnvironmentId = id"
        @apply="applyEnvironment"
        @deactivate="deactivateEnvironment"
        @delete="deleteEnvironment"
      />

      <div class="app-main">
        <EnvironmentEditor
          v-if="selectedEnvironment"
          :environment="selectedEnvironment"
          :is-active="selectedEnvironment.id === store.activeEnvironmentId"
          :public-content="publicContent"
          @update="updateEnvironment"
          @add-entry="addEntry"
          @update-entry="updateEntry"
          @delete-entry="deleteEntry"
          @toggle-mode="toggleEditMode"
        />
        <div v-else class="app-empty">
          <p>选择一个环境开始管理</p>
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
.app-body {
  display: flex;
  flex: 1;
  min-height: 0;
}
.app-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-y: hidden;
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
