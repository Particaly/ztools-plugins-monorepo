export interface HostEntry {
  id: string
  ip: string
  domain: string
  comment?: string
  enabled: boolean
}

export interface HostPreset {
  id: string
  name: string
  description?: string
  entries: HostEntry[]
  updatedAt: string
}

export interface PresetStore {
  activePresetId: string | null
  presets: HostPreset[]
}

export interface SystemInfo {
  platform: 'win32' | 'darwin' | 'linux'
  hostsPath: string
  dataDir: string
}

export interface BackupInfo {
  filename: string
  path: string
  createdAt: string
  presetName?: string
}
