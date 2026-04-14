export type BuiltinEnvironmentType = 'public' | 'dev' | 'test' | 'prod'
export type EnvironmentType = BuiltinEnvironmentType | 'custom'
export type EditMode = 'source'

export interface SourceLine {
  id: string
  type: 'host' | 'comment' | 'blank'
  raw: string // original line text for faithful round-trip
  ip?: string
  domain?: string
  enabled?: boolean
  comment?: string
}

export interface Environment {
  id: string
  name: string
  type: EnvironmentType
  enabled: boolean // public is always true and normalized in storage
  editMode: EditMode
  header: string
  lines: SourceLine[]
  updatedAt: string
}

export interface EnvironmentStore {
  activeEnvironmentIds: string[]
  environments: Environment[]
}

// Legacy types kept for migration / merge-hosts interop
export interface HostEntry {
  id: string
  ip: string
  domain: string
  comment?: string
  enabled: boolean
}

// Public environment stores the original hosts content (read-only)
export interface PublicContent {
  content: string // original hosts without managed block
  hash: string // for change detection
  updatedAt: string
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
