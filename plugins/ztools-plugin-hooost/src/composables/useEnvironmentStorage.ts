import type { EnvironmentStore, PublicContent } from '@/types/hosts'

const STORAGE_KEYS = {
  STORE: 'hooost:environment:store',
  PUBLIC_CONTENT: 'hooost:public:content',
}

function createDefaultStore(): EnvironmentStore {
  const now = new Date().toISOString()
  return {
    activeEnvironmentId: null,
    environments: [
      {
        id: 'env-public',
        name: '公共环境',
        type: 'public',
        enabled: true,
        editMode: 'entry',
        entries: [],
        updatedAt: now,
      },
      {
        id: 'env-dev',
        name: '开发环境',
        type: 'dev',
        enabled: false,
        editMode: 'entry',
        entries: [],
        updatedAt: now,
      },
      {
        id: 'env-test',
        name: '测试环境',
        type: 'test',
        enabled: false,
        editMode: 'entry',
        entries: [],
        updatedAt: now,
      },
      {
        id: 'env-prod',
        name: '生产环境',
        type: 'prod',
        enabled: false,
        editMode: 'entry',
        entries: [],
        updatedAt: now,
      },
    ],
  }
}

function migrateFromPresets(): EnvironmentStore {
  const oldStore = window.services.loadPresets()
  if (!oldStore || !oldStore.presets || !oldStore.presets.length) {
    return createDefaultStore()
  }

  const defaults = createDefaultStore()
  // Distribute existing presets across dev/test/prod environments
  oldStore.presets.forEach((preset: any, index: number) => {
    const env = defaults.environments[1 + (index % 3)] // dev/test/prod
    env.entries = preset.entries || []
    env.name = preset.name
  })

  return defaults
}

export function useEnvironmentStorage() {
  const loadStore = (): EnvironmentStore => {
    const stored = window.ztools.dbStorage.getItem<EnvironmentStore>(STORAGE_KEYS.STORE)
    if (stored) return stored

    // Try migrating from old presets
    try {
      const migrated = migrateFromPresets()
      saveStore(migrated)
      return migrated
    } catch {
      return createDefaultStore()
    }
  }

  const saveStore = (store: EnvironmentStore) => {
    window.ztools.dbStorage.setItem(STORAGE_KEYS.STORE, store)
  }

  const loadPublicContent = (): PublicContent | null => {
    return window.ztools.dbStorage.getItem<PublicContent>(STORAGE_KEYS.PUBLIC_CONTENT)
  }

  const savePublicContent = (content: PublicContent) => {
    window.ztools.dbStorage.setItem(STORAGE_KEYS.PUBLIC_CONTENT, content)
  }

  return { loadStore, saveStore, loadPublicContent, savePublicContent }
}
