import type { Canvas, FabricObject } from 'fabric'
import type { Ref } from 'vue'
import type { DocumentCanvasSnapshot } from '../documentSnapshots'
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
  /**
   * 读取文档级样式元数据（命名色板与自定义样式预设）。
   * 提供后随撤销快照（editorMeta 字段）与工程 JSON（meta 字段）一起持久化。
   */
  getDocumentStyleMeta?: () => unknown
  /** 把工程 JSON 的 meta 字段写入运行时文档状态（loadProjectFile 时调用）。 */
  applyDocumentStyleMeta?: (value: unknown) => void
  /** 从撤销快照 JSON 中还原文档级样式元数据（undo/redo/jumpToHistory 时调用）。 */
  restoreDocumentStyleMetaFromSnapshot?: (snapshotJson: string) => void
  /**
   * 读取文档级命名画布快照列表。
   * 数据量大只随工程 JSON（meta.snapshots 字段）持久化，不进入撤销快照。
   */
  getDocumentSnapshots?: () => DocumentCanvasSnapshot[]
  /** 把工程 JSON 的命名画布快照写入运行时状态（loadProjectFile 时调用，传空值表示清空）。 */
  applyDocumentSnapshots?: (value: unknown) => void
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
