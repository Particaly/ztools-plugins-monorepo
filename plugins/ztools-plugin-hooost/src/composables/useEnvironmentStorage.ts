import type { EnvironmentStore, Environment, BuiltinEnvironmentType } from '@/types/hosts'
import { parseSourceToLines, renderEntriesToSource } from '../lib/hosts'

const STORAGE_KEYS = {
  STORE: 'hooost:environment:store',
}

function createDefaultEnvironment(type: BuiltinEnvironmentType): Environment {
  const now = new Date().toISOString()
  const defaults: Record<BuiltinEnvironmentType, Environment> = {
    public: {
      id: 'env-public',
      name: 'hosts 文件',
      type: 'public',
      enabled: true,
      editMode: 'source',
      header: '#-------- 公共配置 --------',
      lines: [],
      updatedAt: now,
    },
    dev: {
      id: 'env-dev',
      name: '开发环境',
      type: 'dev',
      enabled: false,
      editMode: 'source',
      header: '#-------- 开发环境 --------',
      lines: [],
      updatedAt: now,
    },
    test: {
      id: 'env-test',
      name: '测试环境',
      type: 'test',
      enabled: false,
      editMode: 'source',
      header: '#-------- 测试环境 --------',
      lines: [],
      updatedAt: now,
    },
    prod: {
      id: 'env-prod',
      name: '生产环境',
      type: 'prod',
      enabled: false,
      editMode: 'source',
      header: '#-------- 生产环境 --------',
      lines: [],
      updatedAt: now,
    },
  }
  return defaults[type]
}

function createDefaultStore(): EnvironmentStore {
  return {
    activeEnvironmentIds: [],
    environments: [
      createDefaultEnvironment('public'),
      createDefaultEnvironment('dev'),
      createDefaultEnvironment('test'),
      createDefaultEnvironment('prod'),
    ],
  }
}

function normalizeStore(store: EnvironmentStore): EnvironmentStore {
  const orderWeight: Record<BuiltinEnvironmentType, number> = {
    public: 0,
    dev: 1,
    test: 2,
    prod: 3,
  }

  const environments = [...store.environments]
  const publicIndex = environments.findIndex(env => env.id === 'env-public' || env.type === 'public')

  if (publicIndex === -1) {
    environments.unshift(createDefaultEnvironment('public'))
  } else {
    const publicEnv = {
      ...environments[publicIndex],
      id: 'env-public',
      type: 'public' as const,
      enabled: true,
      header: '#-------- 公共配置 --------',
    }
    environments.splice(publicIndex, 1, publicEnv)
  }

  const orderedEnvironments = environments.sort((a, b) => {
    const aWeight = a.type === 'custom' ? Number.MAX_SAFE_INTEGER : orderWeight[a.type]
    const bWeight = b.type === 'custom' ? Number.MAX_SAFE_INTEGER : orderWeight[b.type]
    const weightDiff = aWeight - bWeight
    if (weightDiff !== 0) return weightDiff
    return a.updatedAt.localeCompare(b.updatedAt)
  })

  return {
    ...store,
    environments: orderedEnvironments,
  }
}

/** Migrate legacy store (entries[] + sourceContent?) to new lines[] format */
function migrateStore(store: any): EnvironmentStore {
  if (!Array.isArray(store.activeEnvironmentIds)) {
    store.activeEnvironmentIds = store.activeEnvironmentId ? [store.activeEnvironmentId] : []
  }
  delete store.activeEnvironmentId

  for (const env of store.environments) {
    if (env.header === undefined) {
      env.header = env.type === 'public'
        ? '#-------- 公共配置 --------'
        : env.type === 'dev'
          ? '#-------- 开发环境 --------'
          : env.type === 'test'
            ? '#-------- 测试环境 --------'
            : env.type === 'prod'
              ? '#-------- 生产环境 --------'
              : `#-------- ${env.name} --------`
    }
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
  return normalizeStore(store)
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

  return normalizeStore(defaults)
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
      return normalizeStore(createDefaultStore())
    }
  }

  const saveStore = (store: EnvironmentStore) => {
    window.ztools.dbStorage.setItem(STORAGE_KEYS.STORE, JSON.parse(JSON.stringify(normalizeStore(store))))
  }

  return { loadStore, saveStore }
}