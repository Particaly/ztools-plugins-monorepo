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

interface PresetStoreLegacy {
  activePresetId: string | null
  presets: any[]
}

interface ThemeInfo {
  isDark: boolean
  primaryColor: string
  customColor: string
  windowMaterial: string
}

interface Services {
  getSystemInfo(): import('./types/hosts').SystemInfo
  readHosts(): string
  loadPresets(): PresetStoreLegacy
  listBackups(): import('./types/hosts').BackupInfo[]
  applyHosts(content: string, envName: string): ApplyResult
  restoreBackup(backupPath: string): RestoreResult
  getThemeInfo(): ThemeInfo
  onThemeChange(callback: (theme: ThemeInfo) => void): void
}

declare global {
  interface Window {
    services: Services
  }
}

export {}
