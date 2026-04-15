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

interface ThemeInfo {
  isDark: boolean
  primaryColor: string
  customColor: string
  windowMaterial: string
}

declare global {
  interface ZToolsInternalApi {
    [key: string]: any
    analyzeImage?(src: string): Promise<{
      isSimpleIcon: boolean
      mainColor: string | null
      isDark: boolean
      needsAdaptation: boolean
    }>
    getPlatform?(): 'darwin' | 'win32' | 'linux' | string
    startHotkeyRecording?(): Promise<{ success: boolean; error?: string }>
    onHotkeyRecorded?(callback: (shortcut: string) => void): void
    dbGet?(key: string): Promise<any>
    dbPut?(key: string, value: any): Promise<any>
    getPluginReadme?(target: string): Promise<{ success: boolean; content?: string; error?: string }>
  }

  interface ZToolsApi {
    internal?: ZToolsInternalApi
  }

  interface Window {
    services: Services
  }
}

export {}
