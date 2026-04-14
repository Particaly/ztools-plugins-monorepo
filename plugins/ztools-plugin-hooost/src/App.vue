<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import type { Environment, EnvironmentStore, BackupInfo, SystemInfo } from '@/types/hosts'
  import { extractPublicContent, mergeHostsContent, normalizeHostsContent, parseEnvironmentBlocks, parseSourceToLines } from '@/lib/hosts'
  import { Toast, useToast, ConfirmDialog, useConfirmDialog } from '@/components'
  import { useEnvironmentStorage } from '@/composables'
  import EnvironmentList from '@/components/EnvironmentList.vue'
  import EnvironmentEditor from '@/components/EnvironmentEditor.vue'

  const { toastState, success, error: showError, confirm: toastConfirm, handleConfirm: handleToastConfirm, handleCancel: handleToastCancel } = useToast()
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog()
  const { loadStore, saveStore } = useEnvironmentStorage()

  const sysInfo = ref<SystemInfo | null>(null)
  const store = ref<EnvironmentStore>({ activeEnvironmentIds: [], environments: [] })
  const hostsBaseContent = ref('')
  const publicReadonlyContent = ref('')
  const selectedEnvironmentId = ref<string | null>(null)
  const backups = ref<BackupInfo[]>([])
  const loading = ref(false)
  const draftEnvironments = ref<Record<string, Environment>>({})

  function cloneEnvironment(env: Environment): Environment {
    return JSON.parse(JSON.stringify(env))
  }


  function normalizeEnvironment(env: Environment): string {
    return JSON.stringify({
      id: env.id,
      name: env.name,
      type: env.type,
      enabled: env.enabled,
      editMode: env.editMode,
      lines: env.lines,
    })
  }

  function getStoredEnvironment(envId: string) {
    return store.value.environments.find(e => e.id === envId) ?? null
  }

  function isPublicEnvironment(envId: string) {
    return getStoredEnvironment(envId)?.type === 'public'
  }

  function getEditableEnvironment(envId: string) {
    return draftEnvironments.value[envId] ?? getStoredEnvironment(envId)
  }

  function ensureDraft(envId: string) {
    if (isPublicEnvironment(envId)) return null
    const existingDraft = draftEnvironments.value[envId]
    if (existingDraft) return existingDraft
    const stored = getStoredEnvironment(envId)
    if (!stored) return null
    const draft = cloneEnvironment(stored)
    draftEnvironments.value = {
      ...draftEnvironments.value,
      [envId]: draft,
    }
    return draft
  }

  function clearDraft(envId: string) {
    const next = { ...draftEnvironments.value }
    delete next[envId]
    draftEnvironments.value = next
  }

  const selectedEnvironment = computed(() => {
    if (!selectedEnvironmentId.value) return null
    return getEditableEnvironment(selectedEnvironmentId.value)
  })

  const activeEnvironmentIds = computed(() => new Set(store.value.activeEnvironmentIds))

  const hasPendingChanges = computed(() => {
    if (!selectedEnvironmentId.value) return false
    const draft = draftEnvironments.value[selectedEnvironmentId.value]
    const stored = getStoredEnvironment(selectedEnvironmentId.value)
    if (!draft || !stored) return false
    return normalizeEnvironment(draft) !== normalizeEnvironment(stored)
  })

  function persistStore() {
    saveStore(store.value)
  }

  function syncEnvironmentsFromHosts(fullHosts: string) {
    const normalizedHosts = normalizeHostsContent(fullHosts)
    const parsedEnvironments = parseEnvironmentBlocks(normalizedHosts)
    const parsedById = new Map(parsedEnvironments.map(env => [env.id, env]))

    const mergedEnvironments = store.value.environments.map(env => {
      const parsed = parsedById.get(env.id)
      if (!parsed) {
        return {
          ...env,
          enabled: env.type === 'public' ? true : store.value.activeEnvironmentIds.includes(env.id),
        }
      }

      return {
        ...env,
        ...parsed,
        enabled: parsed.type === 'public' ? true : store.value.activeEnvironmentIds.includes(parsed.id),
        updatedAt: env.updatedAt ?? parsed.updatedAt,
      }
    })

    const existingIds = new Set(mergedEnvironments.map(env => env.id))
    const appendedEnvironments = parsedEnvironments.filter(env => !existingIds.has(env.id)).map(env => ({
      ...env,
      enabled: env.type === 'public' ? true : store.value.activeEnvironmentIds.includes(env.id),
    }))

    store.value.environments = [...mergedEnvironments, ...appendedEnvironments]

    const selectedExists = selectedEnvironmentId.value && store.value.environments.some(env => env.id === selectedEnvironmentId.value)
    selectedEnvironmentId.value = selectedExists
      ? selectedEnvironmentId.value
      : (store.value.environments[0]?.id ?? null)

    return normalizedHosts
  }

  function loadAll() {
    try {
      sysInfo.value = window.services.getSystemInfo()

      store.value = loadStore()
      refreshHostsContentFromSystem()

      store.value.activeEnvironmentIds = [
        'env-public',
        ...store.value.environments
          .filter(env => env.type !== 'public' && env.lines.some(line => line.type === 'host' && line.enabled))
          .map(env => env.id),
      ]

      store.value.environments = store.value.environments.map(env => ({
        ...env,
        enabled: store.value.activeEnvironmentIds.includes(env.id),
      }))

      backups.value = window.services.listBackups()
      draftEnvironments.value = {}
    } catch (err: any) {
      showError('加载数据失败: ' + (err.message || String(err)))
    }
  }


  function onSourceChange(envId: string, content: string) {
    if (isPublicEnvironment(envId)) return
    const env = ensureDraft(envId)
    if (!env) return
    env.lines = parseSourceToLines(content)
  }

  function updateName(envId: string, name: string) {
    if (isPublicEnvironment(envId)) return
    const env = ensureDraft(envId)
    if (!env) return
    env.name = name
  }


  function saveEnvironmentDraft(envId: string) {
    if (isPublicEnvironment(envId)) return
    const draft = draftEnvironments.value[envId]
    const envIndex = store.value.environments.findIndex(e => e.id === envId)
    if (!draft || envIndex === -1) return

    const updatedAt = new Date().toISOString()
    const saved = cloneEnvironment(draft)
    saved.updatedAt = updatedAt
    store.value.environments[envIndex] = saved
    persistStore()

    clearDraft(envId)
    success(`已保存环境「${saved.name}」`)
  }

  function cancelEnvironmentDraft(envId: string) {
    if (isPublicEnvironment(envId)) return
    const env = getStoredEnvironment(envId)
    clearDraft(envId)
    if (env) {
      success(`已取消环境「${env.name}」的未保存修改`)
    }
  }

  function createEnvironment() {
    const existingNames = new Set(store.value.environments.map(env => env.name))
    let name = '新环境'
    let index = 2
    while (existingNames.has(name)) {
      name = `新环境 ${index}`
      index += 1
    }

    const now = new Date().toISOString()
    const newEnvironment: Environment = {
      id: `env-custom-${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`,
      name,
      type: 'custom',
      enabled: false,
      editMode: 'source',
      header: `#-------- ${name} --------`,
      lines: [],
      updatedAt: now,
    }

    store.value.environments = [...store.value.environments, newEnvironment]
    persistStore()
    selectedEnvironmentId.value = newEnvironment.id
    success(`已新增环境「${newEnvironment.name}」`)
  }

  function getActiveEnvironments(nextActiveIds = store.value.activeEnvironmentIds) {
    return nextActiveIds
      .map(id => store.value.environments.find(env => env.id === id))
      .filter((env): env is Environment => !!env && env.type !== 'public')
  }

  function getMergedContent(nextActiveIds = store.value.activeEnvironmentIds) {
    const baseContent = hostsBaseContent.value || extractPublicContent(normalizeHostsContent(window.services.readHosts()))
    const activeEnvs = getActiveEnvironments(nextActiveIds)
    return mergeHostsContent(baseContent, activeEnvs).trimEnd() + '\n'
  }

  function refreshHostsContentFromSystem() {
    const fullHosts = window.services.readHosts()
    const normalizedHosts = syncEnvironmentsFromHosts(fullHosts)
    hostsBaseContent.value = extractPublicContent(normalizedHosts)
    publicReadonlyContent.value = fullHosts
  }

  async function deleteEnvironment(id: string) {
    const env = store.value.environments.find(e => e.id === id)
    if (!env || env.type === 'public') return

    const isActive = store.value.activeEnvironmentIds.includes(id)
    const ok = await confirm({
      title: '删除环境',
      message: isActive
        ? `环境「${env.name}」当前已启用，删除将同时停用。确定要删除吗？`
        : `确定要删除环境「${env.name}」吗？`,
      type: 'danger',
      confirmText: '删除',
      cancelText: '取消',
    })
    if (!ok) return

    loading.value = true
    try {
      const nextActiveIds = store.value.activeEnvironmentIds.filter(activeId => activeId !== id)
      const result = window.services.applyHosts(getMergedContent(nextActiveIds), isActive ? 'deactivate' : env.name)
      if (!result.success) {
        showError((isActive ? '停用失败: ' : '删除失败: ') + (result.error || '未知错误'))
        return
      }

      store.value.activeEnvironmentIds = nextActiveIds
      store.value.environments = store.value.environments.filter(e => e.id !== id)
      clearDraft(id)
      if (selectedEnvironmentId.value === id) {
        selectedEnvironmentId.value = store.value.environments.length > 0
          ? store.value.environments[0].id
          : null
      }
      persistStore()
      refreshHostsContentFromSystem()
      backups.value = window.services.listBackups()
      success(`已删除环境「${env.name}」`)
    } catch (err: any) {
      showError('删除失败: ' + (err.message || String(err)))
    } finally {
      loading.value = false
    }
  }


  function applyEnvironment(id: string) {
    const env = store.value.environments.find(e => e.id === id)
    if (!env || env.type === 'public') return

    const hostLines = env.lines.filter(l => l.type === 'host' && l.enabled && l.domain && l.ip)
    if (hostLines.length === 0) {
      showError('当前环境没有启用的条目')
      return
    }

    const nextActiveIds = store.value.activeEnvironmentIds.includes(id)
      ? store.value.activeEnvironmentIds
      : [...store.value.activeEnvironmentIds, id]

    loading.value = true
    try {
      const result = window.services.applyHosts(getMergedContent(nextActiveIds), env.name)

      if (result.success) {
        store.value.activeEnvironmentIds = nextActiveIds
        persistStore()
        refreshHostsContentFromSystem()
        backups.value = window.services.listBackups()
        success(`已启用环境「${env.name}」`)
      } else {
        showError('写入 hosts 失败: ' + (result.error || '未知错误'))
      }
    } catch (err: any) {
      showError('启用失败: ' + (err.message || String(err)))
    } finally {
      loading.value = false
    }
  }

  async function deactivateEnvironment(id: string) {
    const env = store.value.environments.find(e => e.id === id)
    if (!env || !store.value.activeEnvironmentIds.includes(id)) return

    const ok = await confirm({
      title: '停用环境',
      message: `确定要停用环境「${env.name}」吗？`,
      type: 'warning',
      confirmText: '停用',
      cancelText: '取消',
    })
    if (!ok) return

    loading.value = true
    try {
      const nextActiveIds = store.value.activeEnvironmentIds.filter(activeId => activeId !== id)
      const result = window.services.applyHosts(getMergedContent(nextActiveIds), 'deactivate')

      if (result.success) {
        store.value.activeEnvironmentIds = nextActiveIds
        persistStore()
        refreshHostsContentFromSystem()
        backups.value = window.services.listBackups()
        success(`已停用环境「${env.name}」`)
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
        refreshHostsContentFromSystem()

        store.value.activeEnvironmentIds = [
          'env-public',
          ...store.value.environments
            .filter(env => env.type !== 'public' && env.lines.some(line => line.type === 'host' && line.enabled))
            .map(env => env.id),
        ]
        store.value.environments = store.value.environments.map(env => ({
          ...env,
          enabled: store.value.activeEnvironmentIds.includes(env.id),
        }))
        draftEnvironments.value = {}
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
    document.documentElement.setAttribute('data-material', theme.windowMaterial)
    document.documentElement.classList.toggle('dark', theme.isDark)

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
    const theme = window.services.getThemeInfo()
    applyTheme(theme)
    window.services.onThemeChange((t) => applyTheme(t))

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
          :active-environment-ids="store.activeEnvironmentIds"
          :selected-environment-id="selectedEnvironmentId"
          @select="(id: string) => selectedEnvironmentId = id"
          @apply="applyEnvironment"
          @deactivate="deactivateEnvironment"
          @delete="deleteEnvironment"
          @create="createEnvironment"
        />

        <div class="app-main">
          <EnvironmentEditor
            v-if="selectedEnvironment"
            :environment="selectedEnvironment"
            :public-readonly-content="publicReadonlyContent"
            :is-active="activeEnvironmentIds.has(selectedEnvironment.id)"
            :has-pending-changes="hasPendingChanges"
            @source-change="onSourceChange"
            @update-name="updateName"
            @save-draft="saveEnvironmentDraft"
            @cancel-draft="cancelEnvironmentDraft"
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
