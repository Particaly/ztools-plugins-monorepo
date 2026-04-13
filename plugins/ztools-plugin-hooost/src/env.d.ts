/// <reference types="vite/client" />
/// <reference types="@ztools-center/ztools-api-types" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

interface ApplyResult {
  success: boolean
  error?: string
  backupPath?: string
  tmpFile?: string
}

interface RestoreResult {
  success: boolean
  error?: string
}

interface Services {
  getSystemInfo(): import('./types/hosts').SystemInfo
  readHosts(): string
  loadPresets(): import('./types/hosts').PresetStore
  savePresets(store: import('./types/hosts').PresetStore): void
  listBackups(): import('./types/hosts').BackupInfo[]
  applyHosts(content: string, presetName: string): ApplyResult
  restoreBackup(backupPath: string): RestoreResult
}

declare global {
  interface Window {
    services: Services
  }
}

export {}
