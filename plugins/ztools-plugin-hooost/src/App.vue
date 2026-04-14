<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import type { SourceLine, Environment, EnvironmentStore, BackupInfo, SystemInfo } from '@/types/hosts'
  import { mergeHostsContent, extractPublicContent, parseSourceToLines, renderLinesToSource } from '@/lib/hosts'
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
  
  function simpleHash(str: string): string {
    let h = 0
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0
    }
    return (h >>> 0).toString(36).padStart(8, '0')
  }
  
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
  
      store.value = loadStore()
  
      const extracted = extractPublicContent(fullHosts)
      publicContent.value = extracted
      savePublicContent({
        content: extracted,
        hash: simpleHash(extracted),
        updatedAt: new Date().toISOString(),
      })
  
      backups.value = window.services.listBackups()
  
      if (!selectedEnvironmentId.value && store.value.environments.length > 0) {
        selectedEnvironmentId.value = store.value.environments[0].id
      }
  
      // Sync public content into the public environment's lines
      const publicEnv = store.value.environments.find(e => e.id === 'env-public')
      if (publicEnv) {
        publicEnv.lines = parseSourceToLines(publicContent.value)
      }
    } catch (err: any) {
      showError('加载数据失败: ' + (err.message || String(err)))
    }
  }
  
  function addEntry(envId: string) {
    const env = store.value.environments.find(e => e.id === envId)
    if (!env) return
    const line: SourceLine = {
      id: generateId(),
      type: 'host',
      raw: '127.0.0.1\t',
      ip: '127.0.0.1',
      domain: '',
      enabled: true,
    }
    env.lines.push(line)
    env.updatedAt = new Date().toISOString()
    persistStore()
  }
  
  function updateEntry(envId: string, entryId: string, field: keyof SourceLine, value: any) {
    const env = store.value.environments.find(e => e.id === envId)
    if (!env) return
    const line = env.lines.find(l => l.id === entryId)
    if (!line || line.type !== 'host') return
    ;(line as any)[field] = value
    // Keep raw in sync for source-mode round-trip when not edited via source
    line.raw = line.enabled ? `${line.ip}\t${line.domain}` : `# ${line.ip}\t${line.domain}`
    env.updatedAt = new Date().toISOString()
    persistStore()
  }
  
  function deleteEntry(envId: string, entryId: string) {
    const env = store.value.environments.find(e => e.id === envId)
    if (!env) return
    env.lines = env.lines.filter(l => l.id !== entryId)
    env.updatedAt = new Date().toISOString()
    persistStore()
  }
  
  function onSourceChange(envId: string, content: string) {
    const env = store.value.environments.find(e => e.id === envId)
    if (!env) return
    env.lines = parseSourceToLines(content)
    env.updatedAt = new Date().toISOString()
    persistStore()
    if (env.type === 'public') {
      publicContent.value = content
      savePublicContent({
        content,
        hash: simpleHash(content),
        updatedAt: env.updatedAt,
      })
    }
  }
  
  function updateName(envId: string, name: string) {
    const env = store.value.environments.find(e => e.id === envId)
    if (!env) return
    env.name = name
    env.updatedAt = new Date().toISOString()
    persistStore()
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
    if (!env) return
    env.editMode = env.editMode === 'entry' ? 'source' : 'entry'
    env.updatedAt = new Date().toISOString()
    persistStore()
  }
  
  function applyEnvironment(id: string) {
    const env = store.value.environments.find(e => e.id === id)
    if (!env) return
  
    if (!env.enabled) {
      showError('请先启用该环境')
      return
    }
  
    const hostLines = env.lines.filter(l => l.type === 'host')
    const enabledCount = hostLines.filter(l => l.enabled).length
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
        const fullHosts = window.services.readHosts()
        const extracted = extractPublicContent(fullHosts)
        publicContent.value = extracted
        savePublicContent({
          content: extracted,
          hash: simpleHash(extracted),
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
  
  function applyTheme(theme: { isDark: boolean; windowMaterial: string; primaryColor?: string; customColor?: string }) {
    console.log(theme);
    document.documentElement.setAttribute('data-material', theme.windowMaterial)
    document.documentElement.classList.toggle('dark', theme.isDark)
  
    // Remove existing theme-* classes from body
    const themeClass = [
      'theme-blue',
      'theme-purple',
      'theme-green',
      'theme-orange',
      'theme-red',
      'theme-pink',
      'theme-custom'
    ]
    document.body.classList.remove(...themeClass)
  
    // Apply theme color class on body so CSS variables cascade correctly
    document.body.classList.add(`theme-${theme.primaryColor}`)
  
    if (theme.customColor) {
      document.documentElement.style.setProperty('--primary-color', theme.customColor)
    }
  }
  
  function applyOsClass(platform: string) {
    document.documentElement.classList.remove('os-mac', 'os-windows', 'os-linux')
    if (platform === 'darwin') {
      document.documentElement.classList.add('os-mac')
    } else if (platform === 'win32') {
      document.documentElement.classList.add('os-windows')
    } else {
      document.documentElement.classList.add('os-linux')
    }
  }
  
  onMounted(() => {
    // Theme
    const theme = window.services.getThemeInfo()
    applyTheme(theme)
    window.services.onThemeChange((t) => applyTheme(t))
  
    // OS class
    const sys = window.services.getSystemInfo()
    applyOsClass(sys.platform)
  
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
            @add-entry="addEntry"
            @update-entry="updateEntry"
            @delete-entry="deleteEntry"
            @toggle-mode="toggleEditMode"
            @source-change="onSourceChange"
            @update-name="updateName"
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