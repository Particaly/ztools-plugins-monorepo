import type { ComputedRef, Ref } from 'vue'
import type { Canvas, FabricObject } from 'fabric'
import type {
  ClipboardEntry,
  ExportDialogState,
  ExportFormat,
  IconCreatorProjectArtboard,
  IconCreatorProjectFile,
  InternalClipboard,
  ProjectLoadOptions
} from '../../../types'
import type { EditorPlatform, ShortcutActionDefinition, ShortcutActionId, ShortcutGroupDefinition } from '../../../shortcuts'

export interface HomeExportDeliveryState {
  exportDialog: ExportDialogState
  exportDialogCanExport: ComputedRef<boolean>
  exportDialogSelectedPreset: Ref<string>
  filteredShortcutGroups: ComputedRef<Array<ShortcutGroupDefinition & { actions: ShortcutActionDefinition[] }>>
  shortcutBindings: Record<ShortcutActionId, string[]>
  shortcutDrawerOpen: Ref<boolean>
  shortcutPlatform: EditorPlatform
  shortcutSearch: Ref<string>
}

export interface HomeExportDeliveryCommands {
  addShortcutBinding: (actionId: ShortcutActionId) => void
  applyShortcutBinding: (actionId: ShortcutActionId, oldValue: string, nextValue: string) => void
  closeShortcutDrawer: () => void
  copyAsPNG: () => Promise<void>
  copyAsSVG: () => Promise<void>
  executeShortcutAction: (actionId: ShortcutActionId) => Promise<void>
  getShortcutActionByEvent: (event: KeyboardEvent) => ShortcutActionDefinition | null
  handleExportDialogShowChange: (show: boolean) => void
  handleExportPresetSelect: (presetId: string) => void
  loadShortcutBindings: () => void
  openExportDialog: () => void
  openShortcutDrawer: () => void
  removeShortcutBinding: (actionId: ShortcutActionId, binding: string) => void
  resetShortcutBindingsToDefault: () => void
  runExportDialogExport: () => Promise<void>
  setExportFormatEnabled: (format: ExportFormat, enabled: boolean) => void
  toggleExportPngSize: (size: number) => void
}

export interface HomeExportDeliveryHelpers {
  copySelectionToInternalClipboard: () => boolean
  createCanvasSVGPreview: (includeBackground?: boolean) => Promise<string>
  duplicateSelection: () => Promise<boolean>
  exportPNG: (size?: number, fileName?: string, transparentBackground?: boolean) => string
  exportSVG: (fileName?: string, includeBackground?: boolean) => Promise<string>
  pasteInternalClipboard: (clipboard?: InternalClipboard | null) => Promise<boolean>
  renderPNGDataUrl: (size: number, transparentBackground: boolean) => string
}

export interface HomeExportDeliveryController {
  commands: HomeExportDeliveryCommands
  helpers: HomeExportDeliveryHelpers
  state: HomeExportDeliveryState
}

export type HomeExportDeliveryLayoutActions = {
  canGroup: { value: boolean }
  canUngroup: { value: boolean }
  fitCanvasInView: () => void
  groupObjects: () => void
  layerBottom: () => void
  layerDown: () => void
  layerTop: () => void
  layerUp: () => void
  selectAllByMode: () => void
  setSelectionMode: (mode: 'shape' | 'point' | 'segment') => void
  setZoom: (value: number) => void
  toggleRuler: () => void
  ungroupObject: () => void
  zoom: { value: number }
}

export interface HomeExportDeliveryClipboardOptions {
  applyActiveObjectsSelection: (objects: FabricObject[]) => void
  applyCanvasThemeToObject: (obj: FabricObject | null | undefined) => void
  applyDefaultKaleidoscopeMetadata: (obj: FabricObject) => void
  applyGradientMetadataToCanvasObject: (obj: FabricObject | null | undefined) => void
  canUseKaleidoscopeAsSource: (obj: FabricObject | null | undefined) => boolean
  clearBooleanPreview: () => void
  clearKaleidoscopeMetadata: (obj: FabricObject) => void
  clearPointEditing: () => void
  createClipboardEntry: (obj: FabricObject) => ClipboardEntry
  createKaleidoscopeSourceId: () => string
  getCurrentCopyTargets: () => FabricObject[]
  getFabricCanvas: () => Canvas | null
  getKaleidoscopeEffectiveCenter: (obj: FabricObject) => { x: number; y: number }
  getKaleidoscopeMetadata: (obj: FabricObject) => Record<string, any> | null | undefined
  isKaleidoscopeSource: (obj: FabricObject | null | undefined) => boolean
  nextName: (type: string) => string
  normalizeKaleidoscopeCount: (value: unknown) => number
  prepareClonedObjectMetadata: (obj: FabricObject) => void
  rebuildKaleidoscopeInstances: (obj: FabricObject) => Promise<void>
  refreshLayers: () => void
  setSelectionMode: (mode: 'shape' | 'point' | 'segment') => void
  snapshot: () => void
  snapshotGate: { get: () => boolean; set: (value: boolean) => void }
}

export interface HomeExportDeliveryExportOptions {
  activeArtboardId: { value: string }
  artboards: { value: IconCreatorProjectArtboard[] }
  canvasBg: { value: string }
  canvasWidth: { value: number }
  canvasHeight: { value: number }
  captureCurrentArtboard: () => IconCreatorProjectArtboard
  clearBooleanPreview: () => void
  createProjectFile: () => IconCreatorProjectFile
  getFabricCanvas: () => Canvas | null
  getObjectsCombinedBounds: (objects: FabricObject[]) => { left: number; top: number; width: number; height: number } | null
  isTransparentCanvasBg: (value: unknown) => boolean
  loadArtboardContent: (artboard: IconCreatorProjectArtboard) => Promise<void>
  loadProjectFile: (project: IconCreatorProjectFile, options?: ProjectLoadOptions) => Promise<void>
}

export interface HomeExportDeliveryShortcutOptions extends HomeExportDeliveryLayoutActions {
  activeObject: { value: FabricObject | null }
  canRedo: { value: boolean }
  canUndo: { value: boolean }
  deleteObject: () => void
  activatePenTool: () => void
  saveProject: () => void
  selectionMode: { value: 'shape' | 'point' | 'segment' }
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', duration?: number) => void
  undo: () => void
  redo: () => void
}
