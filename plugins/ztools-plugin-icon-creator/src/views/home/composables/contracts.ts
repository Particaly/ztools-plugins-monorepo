import type { Canvas, FabricObject } from 'fabric'
import type { Ref } from 'vue'
import type {
  IconCreatorProjectArtboard,
  IconCreatorProjectFile,
  KeylineTemplate,
  ProjectLoadOptions,
  SnapshotOptions
} from '../types'

export interface HistorySnapshot {
  json: string
  description: string
  timestamp: number
}

export interface HistoryState {
  undoStack: HistorySnapshot[]
  redoStack: HistorySnapshot[]
  historyIndex: number
}

export type HomeToastType = 'success' | 'error' | 'info' | 'warning'
export type HomeShowToast = (message: string, type?: HomeToastType, duration?: number) => void

export interface HomeSnapshotGate {
  get: () => boolean
  set: (value: boolean) => void
}

export interface HomeCanvasStateRefs {
  canvasWidth: Ref<number>
  canvasHeight: Ref<number>
  canvasBg: Ref<string>
  lastOpaqueCanvasBg: Ref<string>
  showPixelGrid: Ref<boolean>
  snapToPixelGrid: Ref<boolean>
  pixelGridSize: Ref<number>
  keylineTemplate: Ref<KeylineTemplate>
  keylineMargin: Ref<number>
  keylineOpacity: Ref<number>
}

export interface HomeArtboardStateRefs {
  artboards: Ref<IconCreatorProjectArtboard[]>
  activeArtboardId: Ref<string>
  showArtboardList: Ref<boolean>
}

export interface HomeCanvasRestoreCallbacks {
  clearBooleanPreview: () => void
  clearPointEditing: () => void
  syncPixelGridSizeInput: () => void
  syncKeylineMarginInput: () => void
  syncCanvasSizeInputs: () => void
  syncCanvasInteractionMode: () => void
  applyCanvasBgToFabric: (value: string) => void
  syncActiveObject: (obj: FabricObject | null) => void
  syncAllKaleidoscopes: () => Promise<void>
  ensureCanvasObjectMetadata: () => void
  applyProjectLayerOrder: (layerOrder: string[]) => void
  rehydrateCanvasGradientFills: () => void
  syncAllEndpointAttachments: () => void
  applyCanvasTheme: () => void
  refreshLayers: () => void
  fitCanvasInView: () => void
  markSmallPreviewsDirty: () => void
}

export interface UseHomeArtboardsOptions extends HomeCanvasRestoreCallbacks {
  artboardIdSeed: Ref<number>
  getFabricCanvas: () => Canvas | null
  serializeFabricCanvas: () => Record<string, unknown>
  snapshotGate: HomeSnapshotGate
  snapshot: (options?: SnapshotOptions) => void
  canvasState: HomeCanvasStateRefs
  showToast: HomeShowToast
  isBooleanPreviewObject: (obj: FabricObject | null | undefined) => boolean
  ensureEditorObjectId: (obj: FabricObject | null | undefined) => string
  isTransparentCanvasBg: (value: unknown) => boolean
}

export interface UseHomeArtboardsReturn extends HomeArtboardStateRefs {
  artboardRenameDialog: Ref<{ show: boolean; value: string; targetId: string }>
  captureCurrentArtboard: () => IconCreatorProjectArtboard
  loadArtboardContent: (artboard: IconCreatorProjectArtboard) => Promise<void>
  switchArtboard: (artboardId: string) => Promise<void>
  addArtboard: () => Promise<void>
  duplicateArtboard: (artboardId: string) => void
  renameArtboard: (artboardId: string) => void
  confirmArtboardRename: () => void
  handleArtboardRenameDialogShowChange: (show: boolean) => void
  deleteArtboard: (artboardId: string) => Promise<void>
}

export interface UseHomeDocumentOptions extends HomeCanvasRestoreCallbacks {
  getFabricCanvas: () => Canvas | null
  serializeFabricCanvas: () => Record<string, unknown>
  snapshotGate: HomeSnapshotGate
  canvasState: HomeCanvasStateRefs
  artboardState: HomeArtboardStateRefs
  captureCurrentArtboard: () => IconCreatorProjectArtboard
  loadArtboardContent: (artboard: IconCreatorProjectArtboard) => Promise<void>
  showToast: HomeShowToast
  clearBooleanPreview: () => void
  syncCanvasBgFromFabric: () => void
  isBooleanPreviewObject: (obj: FabricObject | null | undefined) => boolean
  ensureEditorObjectId: (obj: FabricObject | null | undefined) => string
  isTransparentCanvasBg: (value: unknown) => boolean
}

export interface UseHomeDocumentReturn {
  undoStack: HistorySnapshot[]
  historyIndex: Ref<number>
  canUndo: Ref<boolean>
  canRedo: Ref<boolean>
  snapshot: (options?: SnapshotOptions) => void
  createProjectFile: () => IconCreatorProjectFile
  captureHistoryState: () => HistoryState
  restoreHistoryState: (state: HistoryState) => void
  resetHistoryToCurrentCanvas: () => void
  loadProjectFile: (project: IconCreatorProjectFile, options?: ProjectLoadOptions) => Promise<void>
  scheduleDraftSave: () => void
  clearStoredDraft: () => void
  promptRestoreDraft: () => Promise<void>
  flushDraftBeforeDispose: () => void
  saveProject: () => void
  saveProjectAs: (onSaved?: (filePath: string) => void) => void
  saveProjectToPath: (filePath: string) => string | undefined
  undo: () => void
  redo: () => void
  jumpToHistory: (index: number) => void
}
