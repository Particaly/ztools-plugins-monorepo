import type { EnvironmentStore, PublicContent, SourceLine } from '@/types/hosts'
import { parseSourceToLines, renderEntriesToSource } from '../lib/hosts'

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
        editMode: 'source',
        lines: [],
        updatedAt: now,
      },
      {
        id: 'env-dev',
        name: '开发环境',
        type: 'dev',
        enabled: false,
        editMode: 'source',
        lines: [],
        updatedAt: now,
      },
      {
        id: 'env-test',
        name: '测试环境',
        type: 'test',
        enabled: false,
        editMode: 'source',
        lines: [],
        updatedAt: now,
      },
      {
        id: 'env-prod',
        name: '生产环境',
        type: 'prod',
        enabled: false,
        editMode: 'source',
        lines: [],
        updatedAt: now,
      },
    ],
  }
}

/** Migrate legacy store (entries[] + sourceContent?) to new lines[] format */
function migrateStore(store: any): EnvironmentStore {
  for (const env of store.environments) {
    if (env.lines !== undefined) continue // already migrated
    // Prefer sourceContent (preserves comments/blanks), fall back to entries
    if (env.sourceContent) {
      env.lines = parseSourceToLines(env.sourceContent)
    } else if (env.entries && env.entries.length) {
      env.lines = parseSourceToLines(renderEntriesToSource(env.entries))
    } else {
      env.lines = []
    }
    delete env.entries
    delete env.sourceContent
  }
  return store
}

function migrateFromPresets(): EnvironmentStore {
  const oldStore = window.services.loadPresets()
  if (!oldStore || !oldStore.presets || !oldStore.presets.length) {
    return createDefaultStore()
  }

  const defaults = createDefaultStore()
  oldStore.presets.forEach((preset: any, index: number) => {
    const env = defaults.environments[1 + (index % 3)]
    if (preset.entries && preset.entries.length) {
      env.lines = parseSourceToLines(renderEntriesToSource(preset.entries))
    }
    env.name = preset.name
  })

  return defaults
}

export function useEnvironmentStorage() {
  const loadStore = (): EnvironmentStore => {
    const stored = window.ztools.dbStorage.getItem<EnvironmentStore>(STORAGE_KEYS.STORE)
    if (stored) return migrateStore(stored)

    try {
      const migrated = migrateFromPresets()
      saveStore(migrated)
      return migrated
    } catch {
      return createDefaultStore()
    }
  }

  const saveStore = (store: EnvironmentStore) => {
    window.ztools.dbStorage.setItem(STORAGE_KEYS.STORE, JSON.parse(JSON.stringify(store)))
  }

  const loadPublicContent = (): PublicContent | null => {
    return window.ztools.dbStorage.getItem<PublicContent>(STORAGE_KEYS.PUBLIC_CONTENT)
  }

  const savePublicContent = (content: PublicContent) => {
    window.ztools.dbStorage.setItem(STORAGE_KEYS.PUBLIC_CONTENT, content)
  }

  return { loadStore, saveStore, loadPublicContent, savePublicContent }
}