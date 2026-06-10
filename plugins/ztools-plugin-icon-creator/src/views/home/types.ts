import type { Control, FabricObject, Point } from 'fabric'
import type { FabricBooleanStyleSnapshot } from './geometry/fabricToPathKit'
import type { EditablePathObject, EditableSegmentRef } from './geometry/editablePath'
import type { FillGradientStop, FillGradientType } from './fabric/objectMetadata'

export type FabricControls = Record<string, Control>

export type LeftPanelTab = 'shape' | 'text' | 'templates' | 'assets' | 'iconify'
export type RightPanelTab = 'properties' | 'preview' | 'checks' | 'layers' | 'history'

export type BooleanPreviewHiddenObject = {
  object: FabricObject
  visible: boolean
}

export type StrokeLineType = 'solid' | 'dashed'
export type CurveControlPointKey = 'cp1' | 'cp2'
export type FillModeOption = 'solid' | 'gradient'

export type UiFillGradientStop = FillGradientStop & {
  id: string
}

export type StyleTargetChannel = 'fill' | 'stroke'

export type ColorSwatchItem = {
  id: string
  name: string
  color: string
}

export type ColorPaletteGroup = {
  id: string
  name: string
  colors: ColorSwatchItem[]
}

export type GradientPresetItem = {
  id: string
  name: string
  type: FillGradientType
  stops: FillGradientStop[]
  angle?: number
  centerX?: number
  centerY?: number
  radius?: number
  userCreated?: boolean
}

export type UserStylePresets = {
  colors: ColorSwatchItem[]
  gradients: GradientPresetItem[]
}

export type ClipboardEntry = {
  object: Record<string, unknown>
  sourceName: string
  kaleidoscopeEnabled: boolean
  sourceMissing: boolean
}

export type UserAssetItem = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  objects: Record<string, unknown>[]
  layerOrder: string[]
  thumbnail: string
}

export type UserAssetDialogState = {
  show: boolean
  mode: 'create' | 'rename'
  name: string
  error: string
  targetId: string
}

export type InternalClipboard = {
  entries: ClipboardEntry[]
  pasteCount: number
}

export type ExportFormat = 'svg' | 'png'
export type PreviewBackgroundMode = 'transparent' | 'light' | 'dark'
export type KeylineTemplate = 'none' | 'material' | 'ios' | 'favicon' | 'custom'

export type IconCreatorProjectCanvas = {
  width: number
  height: number
  background: string
  gridSize?: number
  showPixelGrid?: boolean
  snapToPixelGrid?: boolean
  keylineTemplate?: KeylineTemplate
  keylineMargin?: number
}

export type IconCreatorProjectArtboard = {
  id: string
  name: string
  canvas: IconCreatorProjectCanvas
  fabric: Record<string, unknown>
  layerOrder: string[]
  thumbnail?: string
}

export type IconCreatorProjectFile = {
  app: 'icon-creator'
  schemaVersion: number
  createdAt: string
  updatedAt: string
  canvas: IconCreatorProjectCanvas
  fabric: Record<string, unknown>
  layerOrder: string[]
  artboards?: IconCreatorProjectArtboard[]
  activeArtboardId?: string
}

export type IconCreatorDraftFile = {
  app: 'icon-creator'
  schemaVersion: number
  updatedAt: string
  project: IconCreatorProjectFile
}

export type ParsedProjectFileResult = {
  project: IconCreatorProjectFile
  source: 'project' | 'draft'
}

export type ProjectLoadOptions = {
  keepDraft?: boolean
  resetHistory?: boolean
}

export type SnapshotOptions = {
  autoSave?: boolean
  description?: string
}

export type SpacePanStart = {
  pointerId: number
  x: number
  y: number
  scrollLeft: number
  scrollTop: number
}

export type EndpointAttachmentEdge = 'left' | 'right' | 'top' | 'bottom'
export type EndpointAttachmentRatio = number

export type BoundsEndpointAttachment = {
  targetId: string
  kind?: 'bounds'
  edge: EndpointAttachmentEdge
  ratio: EndpointAttachmentRatio
}

export type SegmentEndpointAttachment = {
  targetId: string
  kind: 'segment'
  contourIndex: number
  segmentIndex: number
  ratio: EndpointAttachmentRatio
  normalSign?: 1 | -1
}

export type EndpointAttachment = BoundsEndpointAttachment | SegmentEndpointAttachment
export type EndpointAttachmentMap = Record<string, EndpointAttachment | undefined>

export type EndpointSnapCandidate = {
  target: FabricObject
  attachment: EndpointAttachment
  scenePoint: Point
  distance: number
}

export type EditableSegmentRefWithTarget = EditableSegmentRef & {
  target: EditablePathObject
}

export type LayerContextMenuAction =
  | 'rename'
  | 'show'
  | 'hide'
  | 'lock'
  | 'unlock'
  | 'delete'
  | 'detach-source'
  | 'select-source'
  | 'move-up'
  | 'move-top'
  | 'move-down'
  | 'move-bottom'
  | 'duplicate'
  | 'group'
  | 'ungroup'

export type LayerItem = {
  id: string
  canvasIndex: number
  name: string
  obj: FabricObject
}

export type LayerContextMenuState = {
  show: boolean
  x: number
  y: number
}

export type LayerRenameDialogState = {
  show: boolean
  value: string
  target: FabricObject | null
}

export type PasteSVGDialogState = {
  show: boolean
  value: string
  error: string
  loading: boolean
}

export type IconifySearchState = {
  query: string
  lastQuery: string
  loading: boolean
  error: string
  results: string[]
  total: number
  inserting: string
  collectionFilter: string
}

export type IconifySearchResponse = {
  icons?: unknown
  total?: unknown
}

export type KeylineSafeArea = {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

export type IconCheckSeverity = 'warning' | 'info'

export type IconCheckIssue = {
  id: string
  severity: IconCheckSeverity
  title: string
  detail: string
  target?: FabricObject
  targetName?: string
}

export type ParsedCanvasColor = {
  r: number
  g: number
  b: number
  a: number
}

export type StrokeOutlineResult = {
  source: FabricObject
  outline: FabricObject
  sourceIndex: number
  keepFilledSource: boolean
  style: FabricBooleanStyleSnapshot
}

export type PreviewItem = {
  size: number
  width: number
  height: number
  dataUrl: string
}

export type ExportDialogState = {
  show: boolean
  svgEnabled: boolean
  svgIncludeBg: boolean
  pngEnabled: boolean
  pngSizes: number[]
  customSizeInput: string
  transparentBg: boolean
  filePrefix: string
  status: string
  loading: boolean
}
