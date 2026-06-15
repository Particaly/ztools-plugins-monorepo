import { ref, shallowRef, triggerRef, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useZtoolsTheme } from 'ztools-ui'
import { Canvas, Control, FabricObject, Gradient, Textbox, Group, ActiveSelection, FabricImage, Path, Point, Rect, Circle, Triangle, Polygon, Line, StaticCanvas, util, loadSVGFromString } from 'fabric'
import { basicShapes, textPresets, canvasPresets, shapePreviewPaths, iconTemplates, colorPaletteGroups as defaultColorPaletteGroups, gradientPresets as defaultGradientPresets } from './editorCatalog'
import type { ShapeLibraryItem, TextLibraryItem, IconTemplateItem } from './editorCatalog'
import {
  DEFAULT_FILL_GRADIENT_ANGLE,
  DEFAULT_FILL_GRADIENT_RADIUS,
  DEFAULT_FILL_GRADIENT_TYPE,
  DEFAULT_KALEIDOSCOPE_COUNT,
  DEFAULT_FILL_MODE,
  EDITOR_OBJECT_ID_PREFIX,
  SERIALIZED_OBJECT_PROPS,
  applyDefaultEndpointSnapMargin,
  applyDefaultFillGradientMetadata,
  applyDefaultKaleidoscopeMetadata,
  applyDefaultSizeRatioLockMetadata,
  clearKaleidoscopeMetadata,
  cloneFillGradientStops,
  createGradientFromMetadata,
  getEndpointSnapMarginMetadata,
  getFillGradientMetadata,
  getNormalizedGradientOffsetSlots,
  getKaleidoscopeMetadata,
  getObjectEndpointSnapMargin,
  isObjectSizeRatioLocked,
  markObjectSizeRatioLocked,
  normalizeEndpointSnapMargin,
  normalizeKaleidoscopeCount,
  type AnyFabricObject,
  type FillGradientStop,
  type FillGradientType
} from './fabric/objectMetadata'
import { createShape } from './fabric/shapeFactories'
import {
  BITMAP_VECTOR_ALPHA_THRESHOLD,
  BITMAP_VECTOR_DEFAULT_THRESHOLD,
  BITMAP_VECTOR_MAX_TRACE_SIDE,
  BITMAP_VECTOR_TRACE_MULTIPLIER,
  DEFAULT_COLOR_PALETTE_COLUMNS,
  DEFAULT_KEYLINE_MARGIN,
  DEFAULT_KEYLINE_OPACITY,
  DEFAULT_KEYLINE_TEMPLATE,
  DEFAULT_PIXEL_GRID_SIZE,
  EXPORT_PNG_SIZE_OPTIONS,
  GRADIENT_PRESET_GRID_COLUMNS,
  ICONIFY_SEARCH_LIMIT,
  MAX_COLOR_PALETTE_COLUMNS,
  MAX_GRADIENT_PRESET_ROWS,
  MIN_COLOR_PALETTE_COLUMNS,
  MIN_GRADIENT_PRESET_ROWS,
  MIN_PIXEL_GRID_VISIBLE_STEP,
  SMALL_PREVIEW_SIZE_OPTIONS,
  STYLE_PRESET_STORAGE_SCHEMA_VERSION,
  TEXT_OUTLINE_ALPHA_THRESHOLD,
  TEXT_OUTLINE_TRACE_MULTIPLIER,
  USER_ASSET_MAX_THUMBNAIL_SOURCE_SIZE,
  USER_ASSET_STORAGE_KEY,
  USER_ASSET_THUMBNAIL_SIZE,
  USER_STYLE_PRESET_STORAGE_KEY
} from './constants'
import type {
  BooleanPreviewHiddenObject,
  BitmapTraceMode,
  BoundsEndpointAttachment,
  ClipboardEntry,
  ColorPaletteGroup,
  ColorSwatchItem,
  CurveControlPointKey,
  EditableSegmentRefWithTarget,
  EndpointAttachment,
  EndpointAttachmentEdge,
  EndpointAttachmentMap,
  EndpointAttachmentRatio,
  EndpointSnapCandidate,
  FabricControls,
  FillModeOption,
  GradientPresetItem,
  IconCreatorProjectFile,
  IconCreatorProjectSvgPreviewMode,
  IconCreatorProjectViewMode,
  IconCheckIssue,
  IconifySearchResponse,
  KeylineSafeArea,
  KeylineTemplate,
  LeftPanelTab,
  PasteSVGDialogState,
  PreviewBackgroundMode,
  PreviewItem,
  RightPanelTab,
  SegmentEndpointAttachment,
  SpacePanStart,
  StrokeLineType,
  StrokeOutlineResult,
  StylePresetManagerTab,
  StylePresetSettings,
  StyleTargetChannel,
  UiFillGradientStop,
  UserAssetItem
} from './types'
import { isTransparentCanvasBg, normalizeCanvasBg, normalizeKeylineMargin, normalizeKeylineOpacity, normalizeKeylineTemplate, normalizePixelGridSize } from './canvasSettings'
import { buildIconCheckIssues as buildIconCheckIssuesFromContext } from './iconChecks'
import { commitNumericInput, commitPositiveNumericInput, formatNumericInputValue, normalizeInputValue } from './inputUtils'
import { isBooleanCandidate, fabricObjectToPathKitWithApi, fabricStrokeToPathKitWithApi, type FabricBooleanStyleSnapshot } from './geometry/fabricToPathKit'
import { applyBooleanOperation, computeBooleanResult } from './geometry/booleanOps'
import type { BooleanOperation, SubtractDirection } from './geometry/booleanOps'
import { pathKitToEditablePathObject, pathKitToFabricPath } from './geometry/pathKitToFabric'
import { getPathKit, peekPathKit } from './geometry/pathkit'
import type { HistoryState } from './composables/contracts'
import { createHomeWorkspaceModule } from './editor/modules/workspace/createHomeWorkspaceModule'
import { createHomeCanvasKernelModule } from './editor/modules/canvas/createHomeCanvasKernelModule'
import { createHomeAssetsImportModule } from './editor/modules/assets-import/createHomeAssetsImportModule'
import { createHomeExportDeliveryModule } from './editor/modules/export-delivery/createHomeExportDeliveryModule'
import { createHomeSelectionModule } from './editor/modules/selection/createHomeSelectionModule'
import { createHomeLayersModule } from './editor/modules/layers/createHomeLayersModule'
import { createHomeDirectEditModule } from './editor/modules/direct-edit/createHomeDirectEditModule'
import { createHomePenToolModule } from './editor/modules/pen-tool/createHomePenToolModule'
import { createEditorRuntime } from './editor/runtime/createEditorRuntime'
import { createEditorServices } from './editor/runtime/editorServices'
import type { EditorModule, EditorRuntime } from './editor/runtime/editorTypes'
import { createEditorCommands } from './editor/state/editorCommands'
import { createEditorSelectors } from './editor/state/editorSelectors'
import { createEditorStore } from './editor/state/editorStore'
import {
  editablePointToLocalObjectPoint,
  getArrowRenderMode,
  getEditablePointArrowHead,
  getHollowShaftArrowLineWidth,
  getHollowShaftArrowSideAngle,
  getHollowShaftArrowTipAngle,
  getEditablePointEndpointInfo,
  getEditableSegmentByLocalPoint,
  getEditableSegmentMidpoint,
  getEditableSegments,
  getPointRadius,
  getSelectableEditablePoints,
  isEditablePathObject,
  isEditablePointOpenEndpoint,
  isSameEditableSegmentRef,
  moveEditablePoint,
  moveEditablePoints,
  pathHasSolidArrowHead,
  rebuildEditablePathObject,
  rebuildEditablePathObjectFromPoint,
  resolveEditableSegmentRef,
  setEditablePointsArrowHead,
  setEditableSegmentControlPoint,
  setEditableSegmentType,
  createDefaultArrowHead,
  pathEditableModel,
  polygonEditablePath,
  createEditablePathObject,
  setObjectCornerRadius,
  setPointCornerRadius,
  setPointsCornerRadius,
  type ArrowHead,
  type ArrowHeadShape,
  type ArrowRenderMode,
  type EditablePathObject,
  type EditablePoint,
  type EditableSegmentRef
} from './geometry/editablePath'

/**
 * 创建 Home 页面壳层所需的编辑器运行时绑定。
 * index.vue 只负责模板布局和事件转发，遗留桥接逻辑集中在这里继续向领域模块迁移。
 */
export function useHomeEditorRuntime() {
  // ── 类型工具 ──
  const KALEIDOSCOPE_CENTER_CONTROL_KEY = 'kaleidoscopeCenter'
  const RADIAL_GRADIENT_CENTER_CONTROL_KEY = 'radialGradientCenter'
  const DIRECT_EDIT_SHAPE_IDS = new Set(['base-line', 'base-arrow-right', 'base-solid-shaft-arrow', 'base-double-solid-shaft-arrow'])
  const FABRIC_TRANSFORM_CONTROL_KEYS = ['tl', 'tr', 'br', 'bl', 'ml', 'mt', 'mr', 'mb', 'mtr']
  const ENDPOINT_SNAP_MARGIN = 4
  let editorObjectIdSeed = 0

  // ── refs ──
  const canvasElRef = ref<HTMLCanvasElement | null>(null)
  const canvasAreaRef = ref<HTMLElement | null>(null)
  const canvasWrapperRef = ref<HTMLElement | null>(null)
  const svgInputRef = ref<HTMLInputElement | null>(null)
  const imgInputRef = ref<HTMLInputElement | null>(null)
  const projectInputRef = ref<HTMLInputElement | null>(null)

  // ── 状态 ──
  let fabricCanvas: Canvas | null = null
  let editorRuntime: EditorRuntime | null = null
  let spacePanStart: SpacePanStart | null = null
  const fabricCanvasVersion = ref(0)
  const artboardIdSeed = ref(0)

  const leftTab = ref<LeftPanelTab>('shape')
  const leftPanelCollapsed = ref(false)
  const activeRightTab = ref<RightPanelTab>('properties')
  const showRuler = ref(true)
  const showPixelGrid = ref(false)
  const snapToPixelGrid = ref(false)
  const pixelGridSize = ref(DEFAULT_PIXEL_GRID_SIZE)
  const pixelGridSizeInput = ref(String(pixelGridSize.value))
  const keylineTemplate = ref<KeylineTemplate>(DEFAULT_KEYLINE_TEMPLATE)
  const keylineMargin = ref(DEFAULT_KEYLINE_MARGIN)
  const keylineOpacity = ref(DEFAULT_KEYLINE_OPACITY)
  const keylineMarginInput = ref(String(keylineMargin.value))
  const zoom = ref(1)
  const canvasPanX = ref(20)
  const canvasPanY = ref(20)
  const spacePanReady = ref(false)
  const isSpacePanning = ref(false)
  const rulerModifierKeys = reactive({ shift: false, ctrl: false, alt: false, meta: false })
  const rulerModifierActive = computed(() => rulerModifierKeys.shift || rulerModifierKeys.ctrl || rulerModifierKeys.alt || rulerModifierKeys.meta)
  const rulerCoordinateHintActive = computed(() => showRuler.value && (rulerModifierActive.value || spacePanReady.value || isSpacePanning.value))
  const activeObject = shallowRef<FabricObject | null>(null)
  const canvasWidth = ref(512)
  const canvasHeight = ref(512)
  const canvasWidthInput = ref(String(canvasWidth.value))
  const canvasHeightInput = ref(String(canvasHeight.value))
  const canvasBg = ref('#ffffff')
  const lastOpaqueCanvasBg = ref('#ffffff')
  const canvasPresetValue = ref('512x512')
  const canvasPresetOptions = computed(() => canvasPresets.map(({ label, value }) => ({ label, value })))
  const isCanvasBgTransparent = computed(() => isTransparentCanvasBg(canvasBg.value))
  const currentFillStyleMode = computed<'solid' | FillGradientType>(() => {
    if (objProps.fillMode !== 'gradient') return 'solid'
    return objProps.fillGradientType === 'radial' ? 'radial' : 'linear'
  })
  const canvasBgPickerValue = computed(() => (isCanvasBgTransparent.value ? lastOpaqueCanvasBg.value : canvasBg.value))
  // 根据当前缩放渲染像素网格叠层；缩小时自动合并多格为一格，避免密集线条糊成色块。
  const pixelGridStepMultiplier = computed(() => {
    const baseStep = Math.max(0.0001, pixelGridSize.value * zoom.value)
    return Math.max(1, Math.ceil(MIN_PIXEL_GRID_VISIBLE_STEP / baseStep))
  })
  const effectivePixelGridStep = computed(() => Math.max(0.0001, pixelGridSize.value * zoom.value) * pixelGridStepMultiplier.value)
  const pixelGridOverlayStyle = computed(() => {
    const step = effectivePixelGridStep.value
    return {
      width: `${canvasWidth.value * zoom.value}px`,
      height: `${canvasHeight.value * zoom.value}px`,
      backgroundSize: `${step}px ${step}px`,
      opacity: pixelGridStepMultiplier.value > 1 ? 0.42 : 1
    }
  })
  const keylineOverlayStyle = computed(() => ({
    width: `${canvasWidth.value * zoom.value}px`,
    height: `${canvasHeight.value * zoom.value}px`,
    opacity: keylineOpacity.value
  }))
  const canvasWrapperStyle = computed(() => ({
    transform: `translate(${canvasPanX.value}px, ${canvasPanY.value}px)`
  }))
  const keylineSafeArea = computed<KeylineSafeArea>(() => {
    const width = canvasWidth.value
    const height = canvasHeight.value
    if (keylineTemplate.value === 'material') {
      const margin = Math.min(width, height) * 0.125
      return { x: margin, y: margin, width: Math.max(0, width - margin * 2), height: Math.max(0, height - margin * 2), radius: 0 }
    }
    if (keylineTemplate.value === 'ios') {
      const margin = Math.min(width, height) * 0.09
      return { x: margin, y: margin, width: Math.max(0, width - margin * 2), height: Math.max(0, height - margin * 2), radius: Math.min(width, height) * 0.19 }
    }
    if (keylineTemplate.value === 'favicon') {
      const margin = Math.min(width, height) * 0.18
      return { x: margin, y: margin, width: Math.max(0, width - margin * 2), height: Math.max(0, height - margin * 2), radius: 0 }
    }
    const margin = Math.min(keylineMargin.value, width / 2, height / 2)
    return { x: margin, y: margin, width: Math.max(0, width - margin * 2), height: Math.max(0, height - margin * 2), radius: 0 }
  })
  const iconCheckIssues = computed<IconCheckIssue[]>(() => buildIconCheckIssues())
  const booleanBusy = ref(false)
  const strokeOutlineBusy = ref(false)
  const textOutlineBusy = ref(false)
  const bitmapTraceBusy = ref(false)
  const booleanError = ref('')
  const subtractPopoverVisible = ref(false)
  const booleanPreviewObjects = shallowRef<FabricObject[]>([])
  const booleanPreviewHiddenObjects = shallowRef<BooleanPreviewHiddenObject[]>([])
  let booleanPreviewToken = 0

  const objProps = reactive({
    left: 0, top: 0, width: 0, height: 0,
    leftInput: '0', topInput: '0',
    widthInput: '0', heightInput: '0',
    scaleX: 1, scaleY: 1, angle: 0,
    fill: '#000000', fillEnabled: true, fillMode: 'solid' as FillModeOption, fillGradientType: DEFAULT_FILL_GRADIENT_TYPE as FillGradientType, fillGradientAngle: DEFAULT_FILL_GRADIENT_ANGLE, fillGradientAngleInput: String(DEFAULT_FILL_GRADIENT_ANGLE), fillGradientStops: decorateGradientStops(cloneFillGradientStops(undefined)), fillGradientCenterX: 0.5, fillGradientCenterY: 0.5, fillGradientRadius: DEFAULT_FILL_GRADIENT_RADIUS,
    stroke: '#000000', strokeEnabled: true, strokeWidth: 0, strokeWidthInput: '0', strokeLineType: 'solid' as StrokeLineType, strokeDashLength: 6, strokeDashGap: 4, strokeDashLengthInput: '6', strokeDashGapInput: '4', opacity: 1,
    bitmapTraceMode: 'alpha' as BitmapTraceMode,
    bitmapTraceThreshold: BITMAP_VECTOR_DEFAULT_THRESHOLD,
    bitmapTraceThresholdInput: String(BITMAP_VECTOR_DEFAULT_THRESHOLD),
    cornerRadius: 0,
    pointCornerRadius: 0,
    endpointSnapMargin: 0,
    arrowLineWidth: 0,
    arrowTipAngle: 0,
    arrowSideAngle: 0,
    cornerRadiusInput: '0',
    pointCornerRadiusInput: '0',
    endpointSnapMarginInput: '0',
    arrowLengthInput: '16',
    arrowLineWidthInput: '0',
    arrowTipAngleInput: '0',
    arrowSideAngleInput: '0',
    curveEnabled: false,
    curveCp1XInput: '0',
    curveCp1YInput: '0',
    curveCp2XInput: '0',
    curveCp2YInput: '0',
    kaleidoscopeEnabled: false,
    kaleidoscopeCenterXInput: '0',
    kaleidoscopeCenterYInput: '0',
    kaleidoscopeFollowRotation: false,
    kaleidoscopeCountInput: String(DEFAULT_KALEIDOSCOPE_COUNT)
  })
  const sizeRatioLocked = ref(false)
  const lockedAspectRatio = ref(1)

  const { isDark, primaryColor, customColor } = useZtoolsTheme()

  function getCssVar(name: string, fallback: string, scopeEl?: Element | null) {
    if (typeof window === 'undefined') return fallback
    const candidates = [scopeEl, document.body, document.documentElement]
    for (const candidate of candidates) {
      if (!candidate) continue
      const value = getComputedStyle(candidate).getPropertyValue(name).trim()
      if (value) return value
    }
    return fallback
  }

  function hexToRgba(hex: string, alpha: number) {
    const normalized = hex.trim().replace('#', '')
    const full = normalized.length === 3
      ? normalized.split('').map((char) => char + char).join('')
      : normalized
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return hex
    const r = Number.parseInt(full.slice(0, 2), 16)
    const g = Number.parseInt(full.slice(2, 4), 16)
    const b = Number.parseInt(full.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  function getCanvasAssistColors() {
    const dark = isDark.value
    const primary = getCssVar('--primary-color', '#0284c7', document.body)
    const border = getCssVar('--border-color', dark ? '#374151' : '#e5e7eb', document.body)
    const textOnPrimary = getCssVar('--text-on-primary', '#ffffff', document.body)
    return {
      primary,
      primarySoft: hexToRgba(primary, dark ? 0.22 : 0.18),
      primaryOverlay: hexToRgba(primary, dark ? 0.18 : 0.10),
      primaryStrong: hexToRgba(primary, 0.85),
      neutralSurface: getCssVar('--control-bg', dark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.035)', document.body),
      neutralBorder: border,
      textOnPrimary,
    }
  }

  const homeDirectEdit = createHomeDirectEditModule({
    activeObject,
    getArrowRenderMode,
    getCanvasAssistColors,
    getFabricCanvas: () => fabricCanvas,
    getSelectableEditablePoints,
    getViewportPointForEditablePoint,
    isEditablePathObject,
    isKaleidoscopeInstance,
    resolveEditableSegmentRef,
    syncCanvasInteractionMode: () => syncCanvasInteractionMode(),
    syncObjProps,
    updateCurveControls
  })
  const homePenTool = createHomePenToolModule({
    getFabricCanvas: () => fabricCanvas,
    getCanvasAssistColors,
    getZoom: () => zoom.value,
    snapScenePoint: (point) => getPixelGridAdjustedScenePoint(point),
    addPenPathObject,
    discardActiveObject: () => fabricCanvas?.discardActiveObject()
  })
  const penToolActive = homePenTool.controller.state.penToolActive
  const penCommands = homePenTool.controller.commands
  const directEditState = homeDirectEdit.controller.state
  const directEditCommands = homeDirectEdit.controller.commands
  const {
    activeEditablePathObject,
    editablePathMetadataVersion,
    hasEditablePoints,
    hasSelectedPoint,
    selectedEditableSegment,
    selectedPointIndex,
    selectedPointIndices,
    selectedSegmentRef,
    selectionMode
  } = directEditState
  const {
    beginBlankPointGesture,
    beginPointControlGesture,
    clearEditableAssistSelection,
    clearPointEditing,
    clearSelectedPoint,
    clearSelectedSegment,
    cloneCurrentControls,
    consumePointModeSwitchPending,
    consumeRestoreActiveObjectAfterSelectionClear,
    drawPointGestureMarquee,
    finishPointGesture,
    getLiveEditableSegmentRef,
    getPointGestureState,
    handlePointGestureCanvasMove,
    installTemporaryControls,
    isMultiSelectModifierPressed,
    isPointModeSwitchPending,
    normalizeSelectedPointIndices,
    refreshEditablePathMetadata,
    renderPointControl,
    restorePointControls,
    setPointModeSwitchPending,
    setRestoreActiveObjectAfterSelectionClear,
    setSelectedEditablePoints,
    setSelectedEditableSegment,
    setSelectionMode: setSelectionModeDirect,
    shouldProtectPointGestureSelection
  } = directEditCommands
  const pointGestureState = getPointGestureState()

  // 钢笔工具与点位/线段模式互斥：切换到非 shape 模式时先退出钢笔态（不生成图形），避免覆盖层残留。
  function setSelectionMode(mode: 'shape' | 'point' | 'segment') {
    if (mode !== 'shape' && penToolActive.value) penCommands.deactivate(false)
    return setSelectionModeDirect(mode)
  }

  const homeCanvasKernel = createHomeCanvasKernelModule({
    getCanvas: () => fabricCanvas,
    setCanvas: (canvas) => {
      fabricCanvas = canvas
      fabricCanvasVersion.value += 1
    },
    canvasElRef,
    canvasAreaRef,
    canvasWidth,
    canvasHeight,
    canvasBg,
    lastOpaqueCanvasBg,
    zoom,
    panX: canvasPanX,
    panY: canvasPanY,
    sizeRatioLocked,
    selectionMode,
    snapToPixelGrid,
    isTransparentCanvasBg,
    getCanvasAssistColors,
    getAligningObjectsByTarget,
    ensureCanvasObjectMetadata,
    setupCanvasEvents
  })

  const {
    applyBackground: applyCanvasBgToFabric,
    applyTheme: applyCanvasTheme,
    applyThemeToObject: applyCanvasThemeToObject,
    fitInView: fitCanvasInView,
    setZoom: applyCanvasZoom,
    syncBackgroundFromCanvas: syncCanvasBgFromFabric,
    syncInteractionMode: syncCanvasInteractionMode
  } = homeCanvasKernel.controller

  const homeSelection = createHomeSelectionModule({
    activeObject,
    getCurrentCopyTargets,
    getFabricCanvas: () => fabricCanvas,
    getSelectedLayoutTargets,
    getStrokeOutlineUnsupportedReason,
    isBitmapObject: (obj) => obj instanceof FabricImage,
    isKaleidoscopeObject,
    isKaleidoscopeInstance,
    isTextObject: (obj) => obj instanceof Textbox,
    isBooleanCandidate,
    bitmapTraceBusy,
    booleanBusy,
    strokeOutlineBusy,
    textOutlineBusy
  })
  const selectionState = homeSelection.controller.state
  const selectionCommands = homeSelection.controller.commands
  const {
    canAlignSelection,
    canBoolean,
    canConvertStrokeSelection,
    canConvertTextSelection,
    canDirectionalSubtract,
    canDistributeSelection,
    canGroup,
    canSaveUserAsset,
    canUngroup,
    canVectorizeBitmapSelection,
    layerVersion,
    selectedObjects
  } = selectionState

  const homeLayers = createHomeLayersModule({
    activeObject,
    applyActiveObjectsSelection,
    canGroup,
    canSaveUserAsset,
    canUngroup,
    clearBooleanPreview,
    clearKaleidoscopeMetadata,
    deleteObjects,
    duplicateSelection: () => duplicateSelection(),
    ensureEditorObjectId,
    findKaleidoscopeSourceById,
    getFabricCanvas: () => fabricCanvas,
    getKaleidoscopeInstanceSourceId,
    groupObjects,
    isBooleanPreviewObject,
    isKaleidoscopeInstance,
    layerBottom,
    layerDown,
    layerTop,
    layerUp,
    layerVersion,
    openCreateUserAssetDialog,
    refreshActiveObject,
    refreshLayers,
    selectedObjects,
    selectionMode,
    setKaleidoscopeInstanceManagedState,
    setSelectionMode,
    snapshot: () => snapshot(),
    syncObjProps,
    triggerKaleidoscopeVisibilitySync,
    ungroupObject,
    withSnapshotSuppressed
  })
  const layersState = homeLayers.controller.state
  const layersCommands = homeLayers.controller.commands
  const {
    filteredLayers,
    isLayerDragDisabled,
    isLayerDragging,
    layerContextMenu,
    layerContextMenuItems,
    layerDragItems,
    layerRenameDialog,
    layerSearch
  } = layersState
  const {
    confirmLayerRename,
    handleLayerContextMenuSelect,
    handleLayerMouseDown,
    handleLayerRenameDialogShowChange,
    isLayerActive,
    openLayerContextMenu,
    removeObject,
    reorderLayers,
    toggleLock,
    toggleVisible
  } = layersCommands


  // 撤销重做
  let skipSnapshot = false
  function withSnapshotSuppressed<T>(callback: () => T) {
    const previous = skipSnapshot
    skipSnapshot = true
    try {
      return callback()
    } finally {
      skipSnapshot = previous
    }
  }

  // 图层搜索
  const stylePresetSettings = reactive<StylePresetSettings>({
    colorPaletteGroups: defaultColorPaletteGroups.map((group) => ({
      ...group,
      colors: group.colors.map((color) => ({ ...color }))
    })),
    gradientPresets: defaultGradientPresets.map((preset) => ({
      ...preset,
      stops: preset.stops.map((stop) => ({ ...stop }))
    })),
    colorColumns: DEFAULT_COLOR_PALETTE_COLUMNS,
    gradientPresetRows: Math.max(
      MIN_GRADIENT_PRESET_ROWS,
      Math.ceil(defaultGradientPresets.length / GRADIENT_PRESET_GRID_COLUMNS)
    )
  })
  const stylePresetManagerState = reactive<{
    show: boolean
    initialTab: StylePresetManagerTab
  }>({
    show: false,
    initialTab: 'colors'
  })

  // Toast 通知状态
  const toast = reactive<{
    message: string
    type: 'success' | 'error' | 'info' | 'warning'
    duration: number
    key: number
  }>({
    message: '',
    type: 'info',
    duration: 3000,
    key: 0
  })

  // 显示 Toast 通知
  function showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration = 3000) {
    toast.message = message
    toast.type = type
    toast.duration = duration
    toast.key = Date.now() // 强制重新渲染
  }

  const snapshotGate = {
    get: () => skipSnapshot,
    set: (value: boolean) => {
      skipSnapshot = value
    }
  }
  const canvasState = {
    canvasWidth,
    canvasHeight,
    canvasBg,
    lastOpaqueCanvasBg,
    showPixelGrid,
    snapToPixelGrid,
    pixelGridSize,
    keylineTemplate,
    keylineMargin,
    keylineOpacity
  }
  const homeWorkspace = createHomeWorkspaceModule({
    artboardIdSeed,
    getFabricCanvas: () => fabricCanvas,
    serializeFabricCanvas,
    snapshotGate,
    canvasState,
    showToast,
    clearBooleanPreview,
    clearPointEditing,
    syncPixelGridSizeInput,
    syncKeylineMarginInput,
    syncCanvasSizeInputs,
    syncCanvasInteractionMode,
    applyCanvasBgToFabric,
    syncCanvasBgFromFabric,
    syncActiveObject,
    syncAllKaleidoscopes,
    ensureCanvasObjectMetadata,
    applyProjectLayerOrder,
    rehydrateCanvasGradientFills,
    syncAllEndpointAttachments,
    applyCanvasTheme,
    refreshLayers,
    fitCanvasInView,
    markSmallPreviewsDirty,
    isBooleanPreviewObject,
    ensureEditorObjectId,
    isTransparentCanvasBg,
    endSpacePan,
    cancelSmallPreviewsRefresh,
    projectInputRef,
    afterInitialDocumentReady: initializeProjectTabs
  })
  const {
    artboards,
    activeArtboardId,
    showArtboardList,
    artboardRenameDialog,
    undoStack,
    historyIndex,
    canUndo,
    canRedo
  } = homeWorkspace.controller.state
  const {
    addArtboard,
    captureHistoryState,
    clearStoredDraft,
    confirmArtboardRename,
    deleteArtboard,
    duplicateArtboard,
    handleArtboardRenameDialogShowChange,
    jumpToHistory,
    loadProjectFile,
    newDoc,
    onProjectFileChosen,
    openProject,
    redo,
    renameArtboard,
    resetHistoryToCurrentCanvas,
    restoreHistoryState,
    saveProject,
    scheduleDraftSave,
    snapshot,
    switchArtboard,
    undo
  } = homeWorkspace.controller.commands
  const {
    captureCurrentArtboard,
    createProjectFile,
    loadArtboardContent
  } = homeWorkspace.controller.helpers

  const keylineTemplateOptions: Array<{ value: KeylineTemplate; label: string }> = [
    { value: 'none', label: '无参考线' },
    { value: 'material', label: 'Material Keyline' },
    { value: 'ios', label: 'iOS / macOS 安全区' },
    { value: 'favicon', label: 'Favicon 安全区' },
    { value: 'custom', label: '自定义安全区' }
  ]
  const previewBackgroundOptions: Array<{ value: PreviewBackgroundMode; label: string }> = [
    { value: 'transparent', label: '透明' },
    { value: 'light', label: '浅色' },
    { value: 'dark', label: '深色' }
  ]
  const svgPreviewModeOptions: Array<{ value: 'graphic' | 'code'; label: string; description: string; icon: string }> = [
    { value: 'graphic', label: '图形模式', description: '以图形方式预览当前 SVG 输出结果。', icon: 'mdi:image-outline' },
    { value: 'code', label: '代码模式', description: '只读查看 SVG 源码，并提供语法高亮。', icon: 'mdi:code-tags' }
  ]
  const previewBackgroundMode = ref<PreviewBackgroundMode>('transparent')
  const canvasViewMode = ref<IconCreatorProjectViewMode>('canvas')
  const svgPreviewMode = ref<IconCreatorProjectSvgPreviewMode>('graphic')
  const previewItems = shallowRef<PreviewItem[]>([])
  const previewPopoverVisible = ref(false)
  const previewDirty = ref(true)
  let previewRenderTimer: ReturnType<typeof window.setTimeout> | null = null

  type ProjectTabState = {
    id: string
    name: string
    project: IconCreatorProjectFile
    selectedObjectIds: string[]
    zoom: number
    panX: number
    panY: number
    viewMode: IconCreatorProjectViewMode
    svgPreviewMode: IconCreatorProjectSvgPreviewMode
    history: HistoryState
    dirty: boolean
  }

  const projectTabs = ref<ProjectTabState[]>([])
  const activeProjectTabId = ref('')
  let projectTabSeed = 0
  let switchingProjectTab = false
  let projectTabSnapshotReady = false
  let suppressProjectTabAutoSave = false
  const hasMultipleProjectTabs = computed(() => projectTabs.value.length > 1)
  const activeProjectTab = computed(() => projectTabs.value.find((tab) => tab.id === activeProjectTabId.value) ?? null)
  const visibleColorPaletteGroups = computed(() => stylePresetSettings.colorPaletteGroups)
  const visibleGradientPresets = computed(() => {
    const maxCount = Math.max(
      GRADIENT_PRESET_GRID_COLUMNS,
      stylePresetSettings.gradientPresetRows * GRADIENT_PRESET_GRID_COLUMNS
    )
    return stylePresetSettings.gradientPresets.slice(0, maxCount)
  })
  const stylePresetColorColumns = computed(() => stylePresetSettings.colorColumns)
  const stylePresetGradientPresets = computed(() => stylePresetSettings.gradientPresets)
  const stylePresetGradientRows = computed(() => stylePresetSettings.gradientPresetRows)
  const defaultStylePresetColorPaletteGroups = computed(() => cloneManagedColorPaletteGroups(defaultColorPaletteGroups))
  const defaultStylePresetGradientPresets = computed(() => cloneManagedGradientPresets(defaultGradientPresets))
  const defaultStylePresetColorColumns = DEFAULT_COLOR_PALETTE_COLUMNS
  const defaultStylePresetGradientRows = Math.max(
    MIN_GRADIENT_PRESET_ROWS,
    Math.ceil(defaultGradientPresets.length / GRADIENT_PRESET_GRID_COLUMNS)
  )
  function refreshLayers() {
    selectionCommands.refreshLayers()
  }

  function createEditorObjectId() {
    editorObjectIdSeed += 1
    return `${EDITOR_OBJECT_ID_PREFIX}${Date.now().toString(36)}-${editorObjectIdSeed.toString(36)}`
  }

  function ensureEditorObjectId(obj: FabricObject | null | undefined) {
    if (!obj) return ''
    const target = obj as AnyFabricObject
    const current = typeof target.editorObjectId === 'string' ? target.editorObjectId.trim() : ''
    if (current) return current
    const next = createEditorObjectId()
    target.editorObjectId = next
    return next
  }

  function getEndpointAttachmentMap(obj: FabricObject | null | undefined): EndpointAttachmentMap {
    if (!obj) return {}
    const target = obj as AnyFabricObject
    const raw = target.endpointAttachments
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      target.endpointAttachments = {}
      return target.endpointAttachments as EndpointAttachmentMap
    }
    return raw as EndpointAttachmentMap
  }

  function getEndpointAttachmentKey(pointIndex: number) {
    return String(pointIndex)
  }

  function setEndpointAttachment(obj: FabricObject, pointIndex: number, attachment: EndpointAttachment | null) {
    const target = obj as AnyFabricObject
    const map = getEndpointAttachmentMap(target)
    const key = getEndpointAttachmentKey(pointIndex)
    if (attachment) {
      map[key] = attachment
    } else {
      delete map[key]
    }
    target.endpointAttachments = { ...map }
  }

  function clearEndpointAttachmentsForPoints(obj: FabricObject, pointIndices: number[]) {
    const target = obj as AnyFabricObject
    const map = getEndpointAttachmentMap(target)
    let touched = false
    pointIndices.forEach((index) => {
      const key = getEndpointAttachmentKey(index)
      if (map[key]) {
        delete map[key]
        touched = true
      }
    })
    if (touched) target.endpointAttachments = { ...map }
  }

  function clearAllEndpointAttachments(obj: FabricObject | null | undefined) {
    if (!obj) return
    const target = obj as AnyFabricObject
    const raw = target.endpointAttachments
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return
    if (!Object.keys(raw).length) return
    target.endpointAttachments = {}
  }

  function clearOwnedEndpointAttachmentsForTransformedObject(target: FabricObject | null | undefined) {
    if (!target) return
    if (target instanceof ActiveSelection || target instanceof Group) {
      ;(target as ActiveSelection | Group).getObjects().forEach((child) => clearAllEndpointAttachments(child))
    }
    clearAllEndpointAttachments(target)
  }

  function getObjectSceneBounds(object: FabricObject) {
    object.setCoords()
    const points = object.getCoords()
    if (!points.length) return null
    let left = Infinity
    let right = -Infinity
    let top = Infinity
    let bottom = -Infinity
    for (const point of points) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
      left = Math.min(left, point.x)
      right = Math.max(right, point.x)
      top = Math.min(top, point.y)
      bottom = Math.max(bottom, point.y)
    }
    if (![left, right, top, bottom].every(Number.isFinite)) return null
    return { left, right, top, bottom, width: right - left, height: bottom - top, points }
  }

  function clampEndpointAttachmentRatio(value: number) {
    if (!Number.isFinite(value)) return 0
    return Math.max(0, Math.min(1, value))
  }

  function lerpScenePoint(from: Point, to: Point, ratio: number) {
    const amount = clampEndpointAttachmentRatio(ratio)
    return new Point(
      from.x + (to.x - from.x) * amount,
      from.y + (to.y - from.y) * amount
    )
  }

  function getObjectSceneEdge(bounds: NonNullable<ReturnType<typeof getObjectSceneBounds>>, edge: EndpointAttachmentEdge): [Point, Point] {
    if (bounds.points.length >= 4) {
      const [topLeft, topRight, bottomRight, bottomLeft] = bounds.points
      if (edge === 'left') return [topLeft, bottomLeft]
      if (edge === 'right') return [topRight, bottomRight]
      if (edge === 'top') return [topLeft, topRight]
      return [bottomLeft, bottomRight]
    }
    if (edge === 'left') return [new Point(bounds.left, bounds.top), new Point(bounds.left, bounds.bottom)]
    if (edge === 'right') return [new Point(bounds.right, bounds.top), new Point(bounds.right, bounds.bottom)]
    if (edge === 'top') return [new Point(bounds.left, bounds.top), new Point(bounds.right, bounds.top)]
    return [new Point(bounds.left, bounds.bottom), new Point(bounds.right, bounds.bottom)]
  }

  function normalizeSceneVector(dx: number, dy: number) {
    const length = Math.hypot(dx, dy)
    if (!Number.isFinite(length) || length <= 0) return null
    return { x: dx / length, y: dy / length }
  }

  function offsetScenePoint(point: Point, normal: { x: number; y: number } | null, offset: number) {
    if (!normal || !Number.isFinite(offset) || offset === 0) return new Point(point.x, point.y)
    return new Point(point.x + normal.x * offset, point.y + normal.y * offset)
  }

  function getBoundsEdgeOutwardNormal(bounds: NonNullable<ReturnType<typeof getObjectSceneBounds>>, edge: EndpointAttachmentEdge) {
    const [from, to] = getObjectSceneEdge(bounds, edge)
    const edgeVector = normalizeSceneVector(to.x - from.x, to.y - from.y)
    if (!edgeVector) return null
    const center = new Point((bounds.left + bounds.right) / 2, (bounds.top + bounds.bottom) / 2)
    let normal = { x: edgeVector.y, y: -edgeVector.x }
    const midpoint = new Point((from.x + to.x) / 2, (from.y + to.y) / 2)
    const toCenter = { x: center.x - midpoint.x, y: center.y - midpoint.y }
    if (normal.x * toCenter.x + normal.y * toCenter.y > 0) {
      normal = { x: -normal.x, y: -normal.y }
    }
    return normal
  }

  function getEditableContourSignedArea(points: EditablePoint[]) {
    if (points.length < 3) return 0
    let area = 0
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index]
      const next = points[(index + 1) % points.length]
      area += current.x * next.y - next.x * current.y
    }
    return area / 2
  }

  function getEditableSegmentOutwardNormal(segmentRef: EditableSegmentRefWithTarget) {
    const from = getEditableSegmentScenePoint(segmentRef.target, segmentRef, 0)
    const to = getEditableSegmentScenePoint(segmentRef.target, segmentRef, 1)
    const edgeVector = normalizeSceneVector(to.x - from.x, to.y - from.y)
    if (!edgeVector) return null
    if (!segmentRef.contour.closed) {
      return { x: edgeVector.y, y: -edgeVector.x }
    }
    const signedArea = getEditableContourSignedArea(segmentRef.contour.points)
    if (signedArea === 0) {
      return { x: edgeVector.y, y: -edgeVector.x }
    }
    return signedArea > 0
      ? { x: edgeVector.y, y: -edgeVector.x }
      : { x: -edgeVector.y, y: edgeVector.x }
  }

  function projectScenePointToSegment(point: Point, from: Point, to: Point) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const lenSq = dx * dx + dy * dy
    const ratio = lenSq > 0 ? clampEndpointAttachmentRatio(((point.x - from.x) * dx + (point.y - from.y) * dy) / lenSq) : 0
    const scenePoint = lerpScenePoint(from, to, ratio)
    const distance = Math.hypot(scenePoint.x - point.x, scenePoint.y - point.y)
    return { ratio, scenePoint, distance }
  }

  function resolveBoundsEndpointAttachmentPoint(target: FabricObject, attachment: BoundsEndpointAttachment) {
    const bounds = getObjectSceneBounds(target)
    if (!bounds) return null
    const [from, to] = getObjectSceneEdge(bounds, attachment.edge)
    const basePoint = lerpScenePoint(from, to, attachment.ratio)
    return offsetScenePoint(basePoint, getBoundsEdgeOutwardNormal(bounds, attachment.edge), getObjectEndpointSnapMargin(target))
  }

  function getEditableSegmentPoint(segmentRef: EditableSegmentRef, ratio: number): EditablePoint {
    const amount = clampEndpointAttachmentRatio(ratio)
    const segment = segmentRef.segment
    if (segment.type === 'cubic' && segment.cp1 && segment.cp2) {
      const inverse = 1 - amount
      return {
        x: inverse ** 3 * segmentRef.fromPoint.x
          + 3 * inverse ** 2 * amount * segment.cp1.x
          + 3 * inverse * amount ** 2 * segment.cp2.x
          + amount ** 3 * segmentRef.toPoint.x,
        y: inverse ** 3 * segmentRef.fromPoint.y
          + 3 * inverse ** 2 * amount * segment.cp1.y
          + 3 * inverse * amount ** 2 * segment.cp2.y
          + amount ** 3 * segmentRef.toPoint.y
      }
    }
    return lerpEditablePoint(segmentRef.fromPoint, segmentRef.toPoint, amount)
  }

  function getEditableSegmentScenePoint(obj: EditablePathObject, segmentRef: EditableSegmentRef, ratio: number) {
    const point = getEditableSegmentPoint(segmentRef, ratio)
    return new Point(point.x, point.y)
      .subtract(obj.pathOffset)
      .transform(obj.calcTransformMatrix())
  }

  function getEditablePathScenePoint(obj: EditablePathObject, point: EditablePoint) {
    return new Point(point.x, point.y)
      .subtract(obj.pathOffset)
      .transform(obj.calcTransformMatrix())
  }

  function intersectSceneSegments(fromA: Point, toA: Point, fromB: Point, toB: Point) {
    const ax = toA.x - fromA.x
    const ay = toA.y - fromA.y
    const bx = toB.x - fromB.x
    const by = toB.y - fromB.y
    const denominator = ax * by - ay * bx
    if (Math.abs(denominator) < 1e-6) return null
    const cx = fromB.x - fromA.x
    const cy = fromB.y - fromA.y
    const ratioA = (cx * by - cy * bx) / denominator
    const ratioB = (cx * ay - cy * ax) / denominator
    if (ratioA < -1e-6 || ratioA > 1 + 1e-6 || ratioB < -1e-6 || ratioB > 1 + 1e-6) return null
    const lineRatio = clampEndpointAttachmentRatio(ratioA)
    const segmentRatio = clampEndpointAttachmentRatio(ratioB)
    return {
      lineRatio,
      segmentRatio,
      scenePoint: lerpScenePoint(fromA, toA, lineRatio)
    }
  }

  function getEndpointReferenceScenePoint(obj: EditablePathObject, pointIndex: number) {
    const endpointInfo = getEditablePointEndpointInfo(obj, pointIndex)
    if (!endpointInfo.isEndpoint) return null
    const segmentRef = getEditableSegments(obj).find((item) => (
      endpointInfo.isStart ? item.fromGlobalIndex === pointIndex : item.toGlobalIndex === pointIndex
    ))
    if (!segmentRef) return null
    const endpointPoint = endpointInfo.isStart ? segmentRef.fromPoint : segmentRef.toPoint
    const candidates: EditablePoint[] = []
    if (segmentRef.segment.type === 'cubic') {
      if (endpointInfo.isStart) {
        candidates.push(segmentRef.segment.cp1, segmentRef.segment.cp2)
      } else {
        candidates.push(segmentRef.segment.cp2, segmentRef.segment.cp1)
      }
    }
    candidates.push(endpointInfo.isStart ? segmentRef.toPoint : segmentRef.fromPoint)
    const referencePoint = candidates.find((candidate) => Math.hypot(candidate.x - endpointPoint.x, candidate.y - endpointPoint.y) > 1e-6)
    return referencePoint ? getEditablePathScenePoint(obj, referencePoint) : null
  }

  function buildExpandedSnapOutlineHelper(target: FabricObject) {
    const pathKit = peekPathKit()
    if (!pathKit) return null
    const converted = fabricObjectToPathKitWithApi(pathKit, target)
    if (!converted.path) return null
    const snapMargin = getObjectEndpointSnapMargin(target)
    const basePath = converted.path
    let expandedPath: ReturnType<typeof basePath.copy> | null = null
    let strokePath: ReturnType<typeof basePath.copy> | null = null
    try {
      expandedPath = basePath.copy()
      if (snapMargin > 0) {
        strokePath = basePath.copy()
        if (!strokePath.stroke({
          width: snapMargin * 2,
          cap: pathKit.StrokeCap.ROUND,
          join: pathKit.StrokeJoin.ROUND,
          miter_limit: 4
        })) return null
        if (!expandedPath.op(strokePath, pathKit.PathOp.UNION)) return null
        if (!expandedPath.simplify()) return null
      }
      return pathKitToEditablePathObject(expandedPath)
    } finally {
      basePath.delete()
      strokePath?.delete()
      expandedPath?.delete()
    }
  }

  function findCenterDirectedSnapOutlineAttachmentCandidate(
    target: FabricObject,
    targetId: string,
    referenceScenePoint: Point
  ) {
    const helper = buildExpandedSnapOutlineHelper(target)
    if (!helper) return null
    const center = getObjectCenter(target)
    let best: { lineRatio: number, scenePoint: Point } | null = null
    for (const segmentRef of getEditableSegments(helper)) {
      if (!segmentRef.contour.closed) continue
      const steps = segmentRef.segment.type === 'cubic' ? 24 : 1
      let previousRatio = 0
      let previousPoint = getEditableSegmentScenePoint(helper, segmentRef, previousRatio)
      for (let index = 1; index <= steps; index += 1) {
        const nextRatio = index / steps
        const nextPoint = getEditableSegmentScenePoint(helper, segmentRef, nextRatio)
        const intersection = intersectSceneSegments(referenceScenePoint, center, previousPoint, nextPoint)
        if (intersection && (!best || intersection.lineRatio < best.lineRatio)) {
          best = {
            lineRatio: intersection.lineRatio,
            scenePoint: intersection.scenePoint
          }
        }
        previousRatio = nextRatio
        previousPoint = nextPoint
      }
    }
    if (!best) return null
    const baseCandidate = findBestEndpointAttachmentCandidateOnTarget(target, best.scenePoint)
    if (!baseCandidate) return null
    return {
      target,
      attachment: baseCandidate.attachment,
      scenePoint: best.scenePoint,
      distance: 0
    } satisfies EndpointSnapCandidate
  }

  function findCenterDirectedBoundsAttachmentCandidate(target: FabricObject, targetId: string, referenceScenePoint: Point) {
    const bounds = getObjectSceneBounds(target)
    if (!bounds) return null
    const center = getObjectCenter(target)
    const snapMargin = getObjectEndpointSnapMargin(target)
    const edges: EndpointAttachmentEdge[] = ['left', 'right', 'top', 'bottom']
    let best: { lineRatio: number, candidate: EndpointSnapCandidate } | null = null
    for (const edge of edges) {
      const [from, to] = getObjectSceneEdge(bounds, edge)
      const normal = getBoundsEdgeOutwardNormal(bounds, edge)
      const intersection = intersectSceneSegments(referenceScenePoint, center, from, to)
      if (!intersection) continue
      const candidate: EndpointSnapCandidate = {
        target,
        attachment: { targetId, kind: 'bounds', edge, ratio: intersection.segmentRatio },
        scenePoint: offsetScenePoint(intersection.scenePoint, normal, snapMargin),
        distance: 0
      }
      if (!best || intersection.lineRatio < best.lineRatio) {
        best = { lineRatio: intersection.lineRatio, candidate }
      }
    }
    return best?.candidate ?? null
  }

  function findCenterDirectedEditableAttachmentCandidate(target: EditablePathObject, targetId: string, referenceScenePoint: Point) {
    const center = getObjectCenter(target)
    const snapMargin = getObjectEndpointSnapMargin(target)
    let best: { lineRatio: number, candidate: EndpointSnapCandidate } | null = null
    for (const segmentRef of getEditableSegments(target)) {
      if (!segmentRef.contour.closed) continue
      const normal = getEditableSegmentOutwardNormal({ ...segmentRef, target })
      if (!normal) continue
      const steps = segmentRef.segment.type === 'cubic' ? 24 : 1
      let previousRatio = 0
      let previousPoint = getEditableSegmentScenePoint(target, segmentRef, previousRatio)
      for (let index = 1; index <= steps; index += 1) {
        const nextRatio = index / steps
        const nextPoint = getEditableSegmentScenePoint(target, segmentRef, nextRatio)
        const intersection = intersectSceneSegments(referenceScenePoint, center, previousPoint, nextPoint)
        if (intersection && (!best || intersection.lineRatio < best.lineRatio)) {
          const ratio = clampEndpointAttachmentRatio(previousRatio + (nextRatio - previousRatio) * intersection.segmentRatio)
          const basePoint = getEditableSegmentScenePoint(target, segmentRef, ratio)
          best = {
            lineRatio: intersection.lineRatio,
            candidate: {
              target,
              attachment: {
                targetId,
                kind: 'segment',
                contourIndex: segmentRef.contourIndex,
                segmentIndex: segmentRef.segmentIndex,
                ratio,
                normalSign: 1
              },
              scenePoint: offsetScenePoint(basePoint, normal, snapMargin),
              distance: 0
            }
          }
        }
        previousRatio = nextRatio
        previousPoint = nextPoint
      }
    }
    return best?.candidate ?? null
  }

  function findCenterDirectedEndpointAttachmentCandidateOnTarget(target: FabricObject, referenceScenePoint: Point) {
    const targetId = ensureEditorObjectId(target)
    if (!targetId) return null
    const helperCandidate = findCenterDirectedSnapOutlineAttachmentCandidate(target, targetId, referenceScenePoint)
    if (helperCandidate) return helperCandidate
    if (isEditablePathObject(target)) {
      return findCenterDirectedEditableAttachmentCandidate(target, targetId, referenceScenePoint)
    }
    return findCenterDirectedBoundsAttachmentCandidate(target, targetId, referenceScenePoint)
  }

  function findBestEndpointAttachmentCandidateOnTarget(target: FabricObject, scenePoint: Point) {
    const targetId = ensureEditorObjectId(target)
    if (!targetId) return null
    const candidates: EndpointSnapCandidate[] = []
    addEditableSegmentSnapCandidates(target, targetId, scenePoint, Infinity, candidates)
    if (!isEditablePathObject(target)) {
      addBoundsSnapCandidates(target, targetId, scenePoint, Infinity, candidates)
    }
    candidates.sort((a, b) => a.distance - b.distance)
    return candidates[0] ?? null
  }

  function resolveDynamicEndpointAttachment(target: FabricObject, owner: EditablePathObject, pointIndex: number) {
    const referenceScenePoint = getEndpointReferenceScenePoint(owner, pointIndex)
    if (!referenceScenePoint) return null
    return findCenterDirectedEndpointAttachmentCandidateOnTarget(target, referenceScenePoint)
      ?? findBestEndpointAttachmentCandidateOnTarget(target, referenceScenePoint)
  }

  function projectScenePointToEditableSegment(obj: EditablePathObject, segmentRef: EditableSegmentRef, point: Point) {
    if (segmentRef.segment.type !== 'cubic') {
      return projectScenePointToSegment(
        point,
        getEditableSegmentScenePoint(obj, segmentRef, 0),
        getEditableSegmentScenePoint(obj, segmentRef, 1)
      )
    }
    const steps = 24
    let best: ReturnType<typeof projectScenePointToSegment> | null = null
    for (let index = 0; index < steps; index += 1) {
      const fromRatio = index / steps
      const toRatio = (index + 1) / steps
      const projected = projectScenePointToSegment(
        point,
        getEditableSegmentScenePoint(obj, segmentRef, fromRatio),
        getEditableSegmentScenePoint(obj, segmentRef, toRatio)
      )
      const resolved = {
        ...projected,
        ratio: fromRatio + (toRatio - fromRatio) * projected.ratio
      }
      if (!best || resolved.distance < best.distance) best = resolved
    }
    return best ?? projectScenePointToSegment(
      point,
      getEditableSegmentScenePoint(obj, segmentRef, 0),
      getEditableSegmentScenePoint(obj, segmentRef, 1)
    )
  }

  function resolveSegmentEndpointAttachmentPoint(target: FabricObject, attachment: SegmentEndpointAttachment) {
    if (!isEditablePathObject(target)) return null
    const segments = getEditableSegments(target)
    const segmentRef = segments.find((item) => item.contourIndex === attachment.contourIndex && item.segmentIndex === attachment.segmentIndex)
    if (!segmentRef) return null
    const basePoint = getEditableSegmentScenePoint(target, segmentRef, attachment.ratio)
    const normalSign = attachment.normalSign === -1 ? -1 : 1
    const normal = getEditableSegmentOutwardNormal({ ...segmentRef, target })
    return offsetScenePoint(basePoint, normal ? { x: normal.x * normalSign, y: normal.y * normalSign } : null, getObjectEndpointSnapMargin(target))
  }

  function resolveEndpointAttachmentPoint(target: FabricObject, attachment: EndpointAttachment) {
    if (attachment.kind === 'segment') return resolveSegmentEndpointAttachmentPoint(target, attachment)
    return resolveBoundsEndpointAttachmentPoint(target, attachment)
  }


  function getEditableLocalPointFromScene(obj: EditablePathObject, point: Point) {
    return point.transform(util.invertTransform(obj.calcOwnMatrix())).add(obj.pathOffset)
  }

  // 将场景坐标吸附到当前像素网格；未开启吸附时直接返回原点位，供对象和点位拖拽共用。
  function snapScenePointToPixelGrid(point: Point) {
    if (!snapToPixelGrid.value) return point
    const step = normalizePixelGridSize(pixelGridSize.value)
    return new Point(
      Math.round(point.x / step) * step,
      Math.round(point.y / step) * step
    )
  }

  // 根据目标包围盒左上角计算吸附偏移量，避免旋转对象直接改写 left/top 后出现基准点偏差。
  function getObjectPixelGridSnapDelta(obj: FabricObject) {
    if (!snapToPixelGrid.value) return null
    const bounds = obj.getBoundingRect()
    const snapped = snapScenePointToPixelGrid(new Point(bounds.left, bounds.top))
    const dx = snapped.x - bounds.left
    const dy = snapped.y - bounds.top
    if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return null
    return { dx, dy }
  }

  // 把移动中的对象或选区整体对齐到网格左上角，保持对象内部相对位置不变。
  function snapObjectPositionToPixelGrid(obj: FabricObject | null | undefined) {
    if (!obj) return false
    const delta = getObjectPixelGridSnapDelta(obj)
    if (!delta) return false
    obj.set({
      left: (obj.left ?? 0) + delta.dx,
      top: (obj.top ?? 0) + delta.dy
    })
    obj.setCoords()
    return true
  }

  // 缩放时把对象当前显示宽高量化到网格，保证缩放后的边界尺寸更容易落在像素整数倍上。
  function snapObjectSizeToPixelGrid(obj: FabricObject | null | undefined) {
    if (!obj || !snapToPixelGrid.value) return false
    const currentWidth = obj.getScaledWidth()
    const currentHeight = obj.getScaledHeight()
    if (currentWidth <= 0 || currentHeight <= 0) return false
    const step = normalizePixelGridSize(pixelGridSize.value)
    const snappedWidth = Math.max(step, Math.round(currentWidth / step) * step)
    const snappedHeight = Math.max(step, Math.round(currentHeight / step) * step)
    const nextScaleX = (obj.scaleX ?? 1) * (snappedWidth / currentWidth)
    const nextScaleY = (obj.scaleY ?? 1) * (snappedHeight / currentHeight)
    if (!Number.isFinite(nextScaleX) || !Number.isFinite(nextScaleY)) return false
    if (Math.abs(nextScaleX - (obj.scaleX ?? 1)) < 0.0001 && Math.abs(nextScaleY - (obj.scaleY ?? 1)) < 0.0001) return false
    obj.set({ scaleX: nextScaleX, scaleY: nextScaleY })
    obj.setCoords()
    return true
  }

  // 将传入的拖拽场景点按当前吸附设置归一化，供点位、端点和曲线控制柄编辑使用。
  function getPixelGridAdjustedScenePoint(point: Point) {
    return snapScenePointToPixelGrid(point)
  }

  function addEditableSegmentSnapCandidates(target: FabricObject, targetId: string, scenePoint: Point, snapDistance: number, candidates: EndpointSnapCandidate[]) {
    if (!isEditablePathObject(target)) return
    const segments = getEditableSegments(target)
    const snapMargin = getObjectEndpointSnapMargin(target)
    for (const segmentRef of segments) {
      const projected = projectScenePointToEditableSegment(target, segmentRef, scenePoint)
      if (projected.distance > snapDistance) continue
      const normal = getEditableSegmentOutwardNormal({ ...segmentRef, target })
      const sign = segmentRef.contour.closed || !normal
        ? 1
        : ((scenePoint.x - projected.scenePoint.x) * normal.x + (scenePoint.y - projected.scenePoint.y) * normal.y) < 0 ? -1 : 1
      const snappedPoint = offsetScenePoint(
        projected.scenePoint,
        normal ? { x: normal.x * sign, y: normal.y * sign } : null,
        snapMargin
      )
      candidates.push({
        target,
        attachment: {
          targetId,
          kind: 'segment',
          contourIndex: segmentRef.contourIndex,
          segmentIndex: segmentRef.segmentIndex,
          ratio: projected.ratio,
          normalSign: sign as 1 | -1
        },
        scenePoint: snappedPoint,
        distance: projected.distance
      })
    }
  }

  function addBoundsSnapCandidates(target: FabricObject, targetId: string, scenePoint: Point, snapDistance: number, candidates: EndpointSnapCandidate[]) {
    const bounds = getObjectSceneBounds(target)
    if (!bounds) return
    const snapMargin = getObjectEndpointSnapMargin(target)
    const edges: EndpointAttachmentEdge[] = ['left', 'right', 'top', 'bottom']
    for (const edge of edges) {
      const [from, to] = getObjectSceneEdge(bounds, edge)
      const projected = projectScenePointToSegment(scenePoint, from, to)
      if (projected.distance > snapDistance) continue
      const snappedPoint = offsetScenePoint(projected.scenePoint, getBoundsEdgeOutwardNormal(bounds, edge), snapMargin)
      candidates.push({
        target,
        attachment: { targetId, kind: 'bounds', edge, ratio: projected.ratio },
        scenePoint: snappedPoint,
        distance: projected.distance
      })
    }
  }


  function getEndpointSnapCandidates(owner: EditablePathObject, scenePoint: Point) {
    if (!fabricCanvas) return []
    const snapDistance = ENDPOINT_SNAP_MARGIN / (fabricCanvas.getZoom() || 1)
    const candidates: EndpointSnapCandidate[] = []
    const objects = fabricCanvas.getObjects()
    for (let i = objects.length - 1; i >= 0; i--) {
      const target = objects[i]
      if (target === owner) continue
      if (isBooleanPreviewObject(target)) continue
      const targetId = ensureEditorObjectId(target)
      if (!targetId) continue
      addEditableSegmentSnapCandidates(target, targetId, scenePoint, snapDistance, candidates)
      if (!isEditablePathObject(target)) {
        addBoundsSnapCandidates(target, targetId, scenePoint, snapDistance, candidates)
      }
    }
    candidates.sort((a, b) => a.distance - b.distance)
    return candidates
  }

  function findEndpointSnapCandidate(owner: EditablePathObject, scenePoint: Point) {
    return getEndpointSnapCandidates(owner, scenePoint)[0] ?? null
  }

  function normalizeEndpointAttachments(obj: FabricObject) {
    const target = obj as AnyFabricObject
    const raw = target.endpointAttachments
    const next: EndpointAttachmentMap = {}
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
        const attachment = value as Partial<EndpointAttachment> | null
        if (!attachment || typeof attachment.targetId !== 'string') return
        if (!Number.isFinite(attachment.ratio)) return
        if (attachment.kind === 'segment') {
          const contourIndex = Number(attachment.contourIndex)
          const segmentIndex = Number(attachment.segmentIndex)
          if (!Number.isFinite(contourIndex) || !Number.isFinite(segmentIndex)) return
          const normalSign = attachment.normalSign === -1 ? -1 : 1
          next[key] = {
            targetId: attachment.targetId,
            kind: 'segment',
            contourIndex: Math.max(0, Math.round(contourIndex)),
            segmentIndex: Math.max(0, Math.round(segmentIndex)),
            ratio: clampEndpointAttachmentRatio(attachment.ratio),
            normalSign
          }
          return
        }
        if (attachment.edge !== 'left' && attachment.edge !== 'right' && attachment.edge !== 'top' && attachment.edge !== 'bottom') return
        next[key] = {
          targetId: attachment.targetId,
          kind: 'bounds',
          edge: attachment.edge,
          ratio: clampEndpointAttachmentRatio(attachment.ratio)
        }
      })
    }
    target.endpointAttachments = next
  }

  function ensureCanvasObjectMetadata() {
    if (!fabricCanvas) return
    const seen = new Set<string>()
    fabricCanvas.getObjects().forEach((obj) => {
      let id = String((obj as AnyFabricObject).editorObjectId || '').trim()
      if (!id || seen.has(id)) {
        id = createEditorObjectId()
        ;(obj as AnyFabricObject).editorObjectId = id
      }
      seen.add(id)
      applyDefaultEndpointSnapMargin(obj)
      applyDefaultFillGradientMetadata(obj)
      normalizeEndpointAttachments(obj)
    })
  }

  function removeEndpointAttachmentsReferencing(target: FabricObject) {
    if (!fabricCanvas) return
    const targetId = (target as AnyFabricObject).editorObjectId
    if (typeof targetId !== 'string' || !targetId) return
    fabricCanvas.getObjects().forEach((obj) => {
      if (obj === target) return
      const raw = (obj as AnyFabricObject).endpointAttachments
      if (!raw || typeof raw !== 'object') return
      const map = raw as EndpointAttachmentMap
      let touched = false
      Object.entries(map).forEach(([key, attachment]) => {
        if (attachment?.targetId === targetId) {
          delete map[key]
          touched = true
        }
      })
      if (touched) (obj as AnyFabricObject).endpointAttachments = { ...map }
    })
  }

  function moveEndpointToScenePoint(obj: EditablePathObject, pointIndex: number, scenePoint: Point) {
    moveEditablePoint(obj, pointIndex, getEditableLocalPointFromScene(obj, scenePoint))
  }

  // 端点拖拽时优先处理像素网格吸附；未开启网格吸附时继续保留原有的端点贴附到对象边界 / 线段能力。
  function moveEndpointWithSnap(obj: EditablePathObject, pointIndex: number, scenePoint: Point) {
    const adjustedScenePoint = getPixelGridAdjustedScenePoint(scenePoint)
    if (!isEditablePointOpenEndpoint(obj, pointIndex)) {
      moveEndpointToScenePoint(obj, pointIndex, adjustedScenePoint)
      setEndpointAttachment(obj, pointIndex, null)
      return null
    }
    const candidate = snapToPixelGrid.value ? null : findEndpointSnapCandidate(obj, adjustedScenePoint)
    if (!candidate) {
      moveEndpointToScenePoint(obj, pointIndex, adjustedScenePoint)
      setEndpointAttachment(obj, pointIndex, null)
      return null
    }
    moveEndpointToScenePoint(obj, pointIndex, candidate.scenePoint)
    ensureEditorObjectId(candidate.target)
    setEndpointAttachment(obj, pointIndex, candidate.attachment)
    return candidate
  }

  function syncEndpointsAttachedToTarget(target: FabricObject) {
    if (!fabricCanvas) return false
    const targetId = (target as AnyFabricObject).editorObjectId
    if (typeof targetId !== 'string' || !targetId) return false
    let touched = false
    fabricCanvas.getObjects().forEach((obj) => {
      if (obj === target || !isEditablePathObject(obj)) return
      const map = getEndpointAttachmentMap(obj)
      Object.entries(map).forEach(([key, attachment]) => {
        if (!attachment || attachment.targetId !== targetId) return
        const pointIndex = Number(key)
        if (!Number.isInteger(pointIndex) || !isEditablePointOpenEndpoint(obj, pointIndex)) return
        const dynamicCandidate = resolveDynamicEndpointAttachment(target, obj, pointIndex)
        if (dynamicCandidate) {
          moveEndpointToScenePoint(obj, pointIndex, dynamicCandidate.scenePoint)
          setEndpointAttachment(obj, pointIndex, dynamicCandidate.attachment)
          touched = true
          return
        }
        const scenePoint = resolveEndpointAttachmentPoint(target, attachment)
        if (!scenePoint) return
        moveEndpointToScenePoint(obj, pointIndex, scenePoint)
        touched = true
      })
    })
    return touched
  }

  function syncEndpointsForChangedObject(target: FabricObject | null | undefined) {
    if (!target) return false
    if (target instanceof ActiveSelection || target instanceof Group) {
      let touched = false
      ;(target as ActiveSelection | Group).getObjects().forEach((child) => {
        touched = syncEndpointsAttachedToTarget(child) || touched
      })
      touched = syncEndpointsAttachedToTarget(target) || touched
      return touched
    }
    return syncEndpointsAttachedToTarget(target)
  }

  function syncAllEndpointAttachments() {
    if (!fabricCanvas) return false
    let touched = false
    fabricCanvas.getObjects().forEach((obj) => {
      touched = syncEndpointsAttachedToTarget(obj) || touched
    })
    return touched
  }

  /**
   * 为克隆对象补齐新的内部标识与默认元数据，避免粘贴/复制后的对象继续复用源对象 id 或缺失比例锁定状态。
   */
  function prepareClonedObjectMetadata(obj: FabricObject) {
    ensureEditorObjectId(obj)
    ;(obj as AnyFabricObject).editorObjectId = createEditorObjectId()
    ;(obj as AnyFabricObject).endpointAttachments = {}
    applyDefaultFillGradientMetadata(obj)
    applyDefaultSizeRatioLockMetadata(obj)
  }

  // 对象命名计数
  let objCounter = 0
  function nextName(type: string) {
    return `${type} ${++objCounter}`
  }

  function createKaleidoscopeSourceId() {
    return `kaleidoscope-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }

  function canUseKaleidoscopeAsSource(obj: FabricObject | null | undefined) {
    if (!obj) return false
    if (obj instanceof Group || obj instanceof ActiveSelection) return false
    applyDefaultKaleidoscopeMetadata(obj)
    return getKaleidoscopeMetadata(obj)?.kaleidoscopeManaged !== true
  }

  function isKaleidoscopeInstance(obj: FabricObject | null | undefined) {
    if (!obj) return false
    applyDefaultKaleidoscopeMetadata(obj)
    const target = getKaleidoscopeMetadata(obj)
    return !!target && target.kaleidoscopeManaged === true && !!target.kaleidoscopeInstanceOf
  }

  function isKaleidoscopeSource(obj: FabricObject | null | undefined) {
    if (!obj || !canUseKaleidoscopeAsSource(obj)) return false
    applyDefaultKaleidoscopeMetadata(obj)
    return getKaleidoscopeMetadata(obj)?.kaleidoscopeEnabled === true
  }

  function isKaleidoscopeObject(obj: FabricObject | null | undefined) {
    return isKaleidoscopeSource(obj) || isKaleidoscopeInstance(obj)
  }

  function canMutateKaleidoscopeObject(obj: FabricObject | null | undefined) {
    return !!obj && !isKaleidoscopeInstance(obj)
  }

  function getKaleidoscopeSourceId(obj: FabricObject | null | undefined) {
    if (!obj) return ''
    applyDefaultKaleidoscopeMetadata(obj)
    return getKaleidoscopeMetadata(obj)?.kaleidoscopeSourceId || ''
  }

  function getKaleidoscopeInstanceSourceId(obj: FabricObject | null | undefined) {
    if (!obj) return ''
    applyDefaultKaleidoscopeMetadata(obj)
    return getKaleidoscopeMetadata(obj)?.kaleidoscopeInstanceOf || ''
  }

  function ensureKaleidoscopeSourceId(obj: FabricObject) {
    applyDefaultKaleidoscopeMetadata(obj)
    const target = getKaleidoscopeMetadata(obj)
    if (!target) return ''
    if (!target.kaleidoscopeSourceId) {
      target.kaleidoscopeSourceId = createKaleidoscopeSourceId()
    }
    return target.kaleidoscopeSourceId
  }

  function getObjectCenter(obj: FabricObject) {
    return obj.getCenterPoint()
  }

  function initializeKaleidoscopeSource(obj: FabricObject) {
    if (!canUseKaleidoscopeAsSource(obj)) return
    applyDefaultKaleidoscopeMetadata(obj)
    const target = getKaleidoscopeMetadata(obj)
    if (!target) return
    if (!target.kaleidoscopeSourceId) {
      target.kaleidoscopeSourceId = createKaleidoscopeSourceId()
      const center = getObjectCenter(obj)
      target.kaleidoscopeCenterX = center.x
      target.kaleidoscopeCenterY = center.y
    }
    target.kaleidoscopeCount = normalizeKaleidoscopeCount(target.kaleidoscopeCount)
    target.kaleidoscopeManaged = false
    target.kaleidoscopeInstanceOf = ''
    target.kaleidoscopeInstanceIndex = 0
  }

  function getKaleidoscopeCount(obj: FabricObject) {
    applyDefaultKaleidoscopeMetadata(obj)
    return normalizeKaleidoscopeCount(getKaleidoscopeMetadata(obj)?.kaleidoscopeCount)
  }

  function getKaleidoscopeEffectiveCenter(obj: FabricObject) {
    applyDefaultKaleidoscopeMetadata(obj)
    const target = getKaleidoscopeMetadata(obj)
    if (target?.kaleidoscopeSourceId) {
      return new Point(target.kaleidoscopeCenterX || 0, target.kaleidoscopeCenterY || 0)
    }
    return getObjectCenter(obj)
  }

  function findKaleidoscopeSourceById(sourceId: string) {
    if (!fabricCanvas || !sourceId) return null
    return fabricCanvas.getObjects().find((obj) => {
      if (isBooleanPreviewObject(obj)) return false
      if (obj instanceof ActiveSelection) return false
      applyDefaultKaleidoscopeMetadata(obj)
      const target = getKaleidoscopeMetadata(obj)
      return !!target && target.kaleidoscopeManaged !== true && target.kaleidoscopeSourceId === sourceId
    }) ?? null
  }

  function findKaleidoscopeInstancesBySourceId(sourceId: string) {
    if (!fabricCanvas || !sourceId) return []
    return fabricCanvas.getObjects()
      .filter((obj) => {
        if (isBooleanPreviewObject(obj)) return false
        return isKaleidoscopeInstance(obj) && getKaleidoscopeInstanceSourceId(obj) === sourceId
      })
      .sort((a, b) => {
        const aIndex = getKaleidoscopeMetadata(a)?.kaleidoscopeInstanceIndex || 0
        const bIndex = getKaleidoscopeMetadata(b)?.kaleidoscopeInstanceIndex || 0
        return aIndex - bIndex
      })
  }

  function setKaleidoscopeInstanceManagedState(obj: FabricObject, managed: boolean) {
    obj.set({
      lockMovementX: managed,
      lockMovementY: managed,
      lockScalingX: managed,
      lockScalingY: managed,
      lockRotation: managed,
      hasControls: !managed,
      selectable: true,
      evented: true
    })
  }

  function positionKaleidoscopeInstance(source: FabricObject, instance: FabricObject, instanceIndex: number) {
    const count = getKaleidoscopeCount(source)
    if (count <= 0) return
    const baseCenter = source.getCenterPoint()
    const pivot = getKaleidoscopeEffectiveCenter(source)
    const step = 360 / count
    const delta = step * instanceIndex
    const radians = delta * Math.PI / 180
    const offsetX = baseCenter.x - pivot.x
    const offsetY = baseCenter.y - pivot.y
    const nextCenter = new Point(
      pivot.x + (offsetX * Math.cos(radians) - offsetY * Math.sin(radians)),
      pivot.y + (offsetX * Math.sin(radians) + offsetY * Math.cos(radians))
    )
    const sourceAngle = source.angle ?? 0
    const followRotation = getKaleidoscopeMetadata(source)?.kaleidoscopeFollowRotation === true

    instance.set({
      scaleX: source.scaleX ?? 1,
      scaleY: source.scaleY ?? 1,
      skewX: source.skewX ?? 0,
      skewY: source.skewY ?? 0,
      flipX: source.flipX,
      flipY: source.flipY,
      visible: source.visible !== false,
      opacity: source.opacity ?? 1,
      angle: followRotation ? sourceAngle + delta : sourceAngle
    })
    instance.setPositionByOrigin(nextCenter, 'center', 'center')
    instance.dirty = true
    instance.setCoords()
  }

  function setKaleidoscopeInstanceMetadata(source: FabricObject, instance: FabricObject, instanceIndex: number) {
    const sourceId = ensureKaleidoscopeSourceId(source)
    clearKaleidoscopeMetadata(instance)
    const target = getKaleidoscopeMetadata(instance)
    if (!target) return
    target.kaleidoscopeManaged = true
    target.kaleidoscopeInstanceOf = sourceId
    target.kaleidoscopeInstanceIndex = instanceIndex
    applyDefaultEndpointSnapMargin(source)
    applyDefaultEndpointSnapMargin(instance)
    ;(instance as AnyFabricObject).endpointSnapMargin = getObjectEndpointSnapMargin(source)
    setKaleidoscopeInstanceManagedState(instance, true)
    ;(instance as AnyFabricObject).name = `${(source as AnyFabricObject).name || source.type || '对象'} · ${instanceIndex}`
  }

  const kaleidoscopeSyncTokens = new Map<string, number>()

  function nextKaleidoscopeSyncToken(sourceId: string) {
    const next = (kaleidoscopeSyncTokens.get(sourceId) || 0) + 1
    kaleidoscopeSyncTokens.set(sourceId, next)
    return next
  }

  function moveKaleidoscopeInstanceNearSource(source: FabricObject, instance: FabricObject, instanceIndex: number) {
    if (!fabricCanvas) return
    const sourceIndex = fabricCanvas.getObjects().indexOf(source)
    if (sourceIndex < 0) return
    const nextIndex = Math.min(sourceIndex + instanceIndex, fabricCanvas.getObjects().length - 1)
    fabricCanvas.moveObjectTo(instance, nextIndex)
  }

  const KALEIDOSCOPE_INSTANCE_OWN_KEYS = new Set([
    'editorObjectId',
    'endpointAttachments',
    'name',
    'kaleidoscopeEnabled',
    'kaleidoscopeCenterX',
    'kaleidoscopeCenterY',
    'kaleidoscopeFollowRotation',
    'kaleidoscopeCount',
    'kaleidoscopeSourceId',
    'kaleidoscopeManaged',
    'kaleidoscopeInstanceOf',
    'kaleidoscopeInstanceIndex',
    'path'
  ])

  function cloneKaleidoscopeSyncValue<T>(value: T): T {
    if (value == null || typeof value !== 'object') return value
    if (typeof structuredClone === 'function') return structuredClone(value)
    return JSON.parse(JSON.stringify(value)) as T
  }

  function applyKaleidoscopeSourceContentToInstance(source: FabricObject, instance: FabricObject) {
    if (source.type !== instance.type) return false
    const serialized = (source as AnyFabricObject).toObject(SERIALIZED_OBJECT_PROPS as unknown as string[]) as Record<string, unknown>
    const patch: Record<string, unknown> = {}
    Object.entries(serialized).forEach(([key, value]) => {
      if (KALEIDOSCOPE_INSTANCE_OWN_KEYS.has(key)) return
      patch[key] = cloneKaleidoscopeSyncValue(value)
    })
    instance.set(patch as any)
    if (source instanceof Path && instance instanceof Path) {
      const pathData = Array.isArray(serialized.path) && serialized.path.length
        ? cloneKaleidoscopeSyncValue(serialized.path)
        : [['M', 0, 0]]
      ;(instance as AnyFabricObject)._setPath(pathData, false)
    }
    applyGradientMetadataToCanvasObject(instance)
    instance.dirty = true
    instance.setCoords()
    return true
  }

  function syncKaleidoscopeContent(source: FabricObject) {
    if (!fabricCanvas || !isKaleidoscopeSource(source)) return false
    const sourceId = ensureKaleidoscopeSourceId(source)
    const expectedCount = getKaleidoscopeCount(source) - 1
    const instances = findKaleidoscopeInstancesBySourceId(sourceId)
    if (expectedCount <= 0) return false
    if (instances.length !== expectedCount) {
      void rebuildKaleidoscopeInstances(source)
      return false
    }
    let requiresRebuild = false
    instances.forEach((instance) => {
      const instanceIndex = getKaleidoscopeMetadata(instance)?.kaleidoscopeInstanceIndex || 1
      if (!applyKaleidoscopeSourceContentToInstance(source, instance)) {
        requiresRebuild = true
        return
      }
      applyDefaultKaleidoscopeMetadata(instance)
      setKaleidoscopeInstanceMetadata(source, instance, instanceIndex)
      positionKaleidoscopeInstance(source, instance, instanceIndex)
    })
    if (requiresRebuild) {
      void rebuildKaleidoscopeInstances(source)
      return false
    }
    fabricCanvas.requestRenderAll()
    refreshLayers()
    return true
  }

  function removeKaleidoscopeInstancesBySourceId(sourceId: string) {
    if (!fabricCanvas || !sourceId) return []
    const instances = findKaleidoscopeInstancesBySourceId(sourceId)
    if (!instances.length) return []
    withSnapshotSuppressed(() => {
      instances.forEach((instance) => fabricCanvas!.remove(instance as AnyFabricObject))
    })
    return instances
  }

  function removeKaleidoscopeInstancesForRemovedSource(obj: FabricObject | null | undefined) {
    if (!obj || !fabricCanvas || !isKaleidoscopeSource(obj)) return []
    const sourceId = getKaleidoscopeSourceId(obj)
    if (!sourceId) return []
    return removeKaleidoscopeInstancesBySourceId(sourceId)
  }

  async function rebuildKaleidoscopeInstances(source: FabricObject) {
    if (!fabricCanvas || !canUseKaleidoscopeAsSource(source)) return
    initializeKaleidoscopeSource(source)
    const target = getKaleidoscopeMetadata(source)
    if (!target) return
    const sourceId = ensureKaleidoscopeSourceId(source)
    const token = nextKaleidoscopeSyncToken(sourceId)
    removeKaleidoscopeInstancesBySourceId(sourceId)

    if (target.kaleidoscopeEnabled !== true || getKaleidoscopeCount(source) <= 1 || !fabricCanvas.getObjects().includes(source)) {
      fabricCanvas.requestRenderAll()
      refreshLayers()
      return
    }

    const clones = await Promise.all(
      Array.from({ length: getKaleidoscopeCount(source) - 1 }, () => source.clone())
    )

    if (!fabricCanvas || kaleidoscopeSyncTokens.get(sourceId) !== token || !fabricCanvas.getObjects().includes(source) || !isKaleidoscopeSource(source)) {
      return
    }

    skipSnapshot = true
    try {
      clones.forEach((clone, offset) => {
        applyDefaultKaleidoscopeMetadata(clone)
        applyDefaultFillGradientMetadata(clone)
        applyGradientMetadataToCanvasObject(clone)
        setKaleidoscopeInstanceMetadata(source, clone, offset + 1)
        positionKaleidoscopeInstance(source, clone, offset + 1)
        fabricCanvas!.add(clone as AnyFabricObject)
        moveKaleidoscopeInstanceNearSource(source, clone, offset + 1)
      })
    } finally {
      skipSnapshot = false
    }

    fabricCanvas.requestRenderAll()
    refreshLayers()
  }

  function syncKaleidoscopeTransforms(source: FabricObject) {
    if (!fabricCanvas || !isKaleidoscopeSource(source)) return
    const sourceId = ensureKaleidoscopeSourceId(source)
    const expectedCount = getKaleidoscopeCount(source) - 1
    const instances = findKaleidoscopeInstancesBySourceId(sourceId)

    if (expectedCount <= 0) {
      if (instances.length) {
        removeKaleidoscopeInstancesBySourceId(sourceId)
        fabricCanvas.requestRenderAll()
        refreshLayers()
      }
      return
    }

    if (instances.length !== expectedCount) {
      void rebuildKaleidoscopeInstances(source)
      return
    }

    instances.forEach((instance) => {
      applyDefaultKaleidoscopeMetadata(instance)
      setKaleidoscopeInstanceManagedState(instance, true)
      positionKaleidoscopeInstance(source, instance, getKaleidoscopeMetadata(instance)?.kaleidoscopeInstanceIndex || 1)
    })
    fabricCanvas.requestRenderAll()
  }

  async function syncAllKaleidoscopes() {
    if (!fabricCanvas) return
    const objects = fabricCanvas.getObjects().filter((obj) => !isBooleanPreviewObject(obj))
    objects.forEach((obj) => applyDefaultKaleidoscopeMetadata(obj))

    const activeSources = objects.filter((obj) => isKaleidoscopeSource(obj))
    const sourceIds = new Set(activeSources.map((obj) => ensureKaleidoscopeSourceId(obj)))
    const orphanInstances = objects.filter((obj) => isKaleidoscopeInstance(obj) && !sourceIds.has(getKaleidoscopeInstanceSourceId(obj)))

    if (orphanInstances.length) {
      skipSnapshot = true
      try {
        orphanInstances.forEach((obj) => fabricCanvas!.remove(obj as AnyFabricObject))
      } finally {
        skipSnapshot = false
      }
    }

    for (const source of activeSources) {
      await rebuildKaleidoscopeInstances(source)
    }

    fabricCanvas.requestRenderAll()
    refreshLayers()
  }

  function triggerKaleidoscopeTransformSync(obj: FabricObject | null | undefined) {
    if (obj && isKaleidoscopeSource(obj)) {
      syncKaleidoscopeTransforms(obj)
    }
  }

  function triggerKaleidoscopeContentSync(obj: FabricObject | null | undefined) {
    if (obj && isKaleidoscopeSource(obj)) {
      syncKaleidoscopeContent(obj)
    }
  }

  function triggerKaleidoscopeRebuild(obj: FabricObject | null | undefined) {
    if (obj && isKaleidoscopeSource(obj)) {
      void rebuildKaleidoscopeInstances(obj)
    }
  }

  function triggerKaleidoscopeVisibilitySync(obj: FabricObject | null | undefined) {
    if (!obj || !isKaleidoscopeSource(obj)) return
    findKaleidoscopeInstancesBySourceId(ensureKaleidoscopeSourceId(obj)).forEach((instance) => {
      instance.set('visible', obj.visible !== false)
      instance.setCoords()
    })
    fabricCanvas?.requestRenderAll()
  }

  // 保留 Fabric 的原始选择结果，不再把万花筒实例压回单选，方便图层里对多个实例做批量脱离。
  function applyKaleidoscopeSelectionConstraints(obj: FabricObject | null, event?: Event | MouseEvent) {
    if (!fabricCanvas || !obj) return obj
    return obj
  }

  // 切换画板列表显隐，作为顶栏命令入口隔离 UI 事件和底层 showArtboardList 状态写入。
  // 即将展开列表时若还没有任何画板，先自动创建一个默认画板，否则面板因 artboards.length === 0 不渲染，按钮看起来无反应。
  async function toggleArtboardList() {
    const next = !showArtboardList.value
    showArtboardList.value = next
    if (next && artboards.value.length === 0) {
      await addArtboard()
    }
  }

  function getDefaultStrokeDashArray(strokeWidth: unknown = 2): [number, number] {
    const width = Number(strokeWidth)
    const safeWidth = Number.isFinite(width) && width > 0 ? width : 2
    return [Math.max(1, safeWidth * 3), Math.max(1, safeWidth * 2)]
  }

  function createGradientStopId(index: number) {
    return `gradient-stop-${index}-${Math.random().toString(36).slice(2, 8)}`
  }

  function decorateGradientStops(stops: FillGradientStop[], previousStops: UiFillGradientStop[] = []) {
    return cloneFillGradientStops(stops).map((stop, index) => ({
      ...stop,
      id: previousStops[index]?.id ?? createGradientStopId(index)
    }))
  }

  function normalizeGradientOffsetPercentInput(value: string | number, fallback: number, min = 0, max = 100) {
    const normalized = normalizeInputValue(value)
    const parsed = Number(normalized)
    if (normalized === '' || !Number.isFinite(parsed)) return fallback
    return Math.min(max, Math.max(min, parsed))
  }

  function normalizeFillGradientRadiusInput(value: number) {
    if (!Number.isFinite(value)) return DEFAULT_FILL_GRADIENT_RADIUS
    return Math.min(2, Math.max(0.05, value))
  }

  function getFillGradientStopMinPercent(index: number) {
    const previousStop = objProps.fillGradientStops[index - 1]
    return previousStop ? Math.round(previousStop.offset * 100) : 0
  }

  function getFillGradientStopMaxPercent(index: number) {
    const nextStop = objProps.fillGradientStops[index + 1]
    return nextStop ? Math.round(nextStop.offset * 100) : 100
  }

  function isFillGradientStopPercentDisabled(index: number, value: number) {
    if (index === 0 || index === objProps.fillGradientStops.length - 1) return true
    return value < getFillGradientStopMinPercent(index) || value > getFillGradientStopMaxPercent(index)
  }

  function normalizeStrokeDashArray(
    value: unknown,
    fallback: [number, number] | null = null
  ): [number, number] | null {
    if (!Array.isArray(value)) return fallback
    const numeric = value
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0)
    if (!numeric.length) return fallback
    return [numeric[0], numeric[1] ?? numeric[0]]
  }

  function getStrokeDashPair(target?: FabricObject | null) {
    if (!target) return getDefaultStrokeDashArray(objProps.strokeWidth)
    return normalizeStrokeDashArray(target.strokeDashArray)
      ?? normalizeStrokeDashArray((target as AnyFabricObject).lastStrokeDashArray)
      ?? getDefaultStrokeDashArray(target.strokeWidth ?? objProps.strokeWidth)
  }

  // ── 计算属性 ──

  // 判断对象是否属于描边转轮廓的可处理类型，供按钮启用和批量转换前置校验共用。
  function isStrokeOutlineSupportedObject(obj: FabricObject) {
    return obj instanceof Rect
      || obj instanceof Circle
      || obj instanceof Triangle
      || obj instanceof Polygon
      || obj instanceof Line
      || obj instanceof Path
  }

  // 返回对象无法执行描边转轮廓的具体原因；返回 null 表示可安全进入 PathKit 转换流程。
  function getStrokeOutlineUnsupportedReason(obj: FabricObject): string | null {
    if (obj instanceof Textbox || obj instanceof FabricImage) return '文字和图片暂不支持描边转轮廓'
    if (obj instanceof Group || obj instanceof ActiveSelection) return '成组对象暂不支持描边转轮廓，请先解组'
    if (isKaleidoscopeObject(obj)) return '万花筒对象暂不支持描边转轮廓，请先脱离源对象'
    if (!isStrokeEnabled(obj.stroke, obj.strokeWidth)) return '对象没有可转换的可见描边'
    if (normalizeStrokeDashArray(obj.strokeDashArray)?.length) return '虚线描边暂不支持转轮廓，请先改为实线'
    if (!isStrokeOutlineSupportedObject(obj)) return '该对象类型暂不支持描边转轮廓'
    return null
  }

  const homeAssetsImport = createHomeAssetsImportModule({
    svgInputRef,
    imgInputRef,
    getFabricCanvas: () => fabricCanvas,
    canvasWidth,
    canvasHeight,
    canvasBg,
    lastOpaqueCanvasBg,
    canSaveUserAsset,
    snapshotGate,
    snapshot,
    newDoc,
    clearStoredDraft,
    resetHistoryToCurrentCanvas,
    createProjectFile,
    loadProjectFile,
    showToast,
    clearBooleanPreview,
    clearPointEditing,
    addShape,
    addText,
    refreshLayers,
    syncActiveObjectPreservingPointMode,
    setSelectionMode,
    applyActiveObjectsSelection,
    applyCanvasBgToFabric,
    applyCanvasSize,
    ensureEditorObjectId,
    nextName,
    prepareClonedObjectMetadata,
    normalizeEndpointAttachments,
    applyCanvasThemeToObject,
    createKaleidoscopeSourceId,
    canUseKaleidoscopeAsSource,
    isKaleidoscopeSource,
    getCurrentCopyTargets,
    createClipboardEntry,
    getObjectDisplayName,
    cloneSerializedObjectData,
    getObjectsCombinedBounds,
    rebuildKaleidoscopeInstances,
    markObjectSizeRatioLocked
  })
  const assetsImportState = homeAssetsImport.controller.state
  const assetsImportCommands = homeAssetsImport.controller.commands
  const importedUserAssets = assetsImportState.userAssets
  const importedUserAssetDialog = assetsImportState.userAssetDialog
  const importedPasteSVGDialog = assetsImportState.pasteSVGDialog
  const iconifyImportState = assetsImportState.iconifySearch
  const importedFilteredIconifyResults = assetsImportState.filteredIconifyResults
  const importedIconifyCollectionOptions = assetsImportState.iconifyCollectionOptions
  const userAssets = importedUserAssets
  const userAssetDialog = importedUserAssetDialog
  const pasteSVGDialog = importedPasteSVGDialog
  const iconifySearch = iconifyImportState

  const homeExportDelivery = createHomeExportDeliveryModule({
    clipboard: {
      applyActiveObjectsSelection,
      applyCanvasThemeToObject,
      applyDefaultKaleidoscopeMetadata,
      applyGradientMetadataToCanvasObject,
      canUseKaleidoscopeAsSource,
      clearBooleanPreview,
      clearKaleidoscopeMetadata,
      clearPointEditing,
      createClipboardEntry,
      createKaleidoscopeSourceId,
      getCurrentCopyTargets,
      getFabricCanvas: () => fabricCanvas,
      getKaleidoscopeEffectiveCenter,
      getKaleidoscopeMetadata: (obj) => getKaleidoscopeMetadata(obj),
      isKaleidoscopeSource,
      nextName,
      normalizeKaleidoscopeCount,
      prepareClonedObjectMetadata,
      rebuildKaleidoscopeInstances,
      refreshLayers,
      setSelectionMode,
      snapshot,
      snapshotGate
    },
    exportWorkflow: {
      activeArtboardId,
      artboards,
      canvasBg,
      canvasHeight,
      canvasWidth,
      captureCurrentArtboard,
      clearBooleanPreview,
      createProjectFile,
      getFabricCanvas: () => fabricCanvas,
      getObjectsCombinedBounds,
      isTransparentCanvasBg,
      loadArtboardContent,
      loadProjectFile
    },
    shortcut: {
      activeObject,
      canGroup,
      canRedo,
      canUndo,
      canUngroup,
      deleteObject,
      activatePenTool: () => penCommands.activate(),
      fitCanvasInView,
      groupObjects,
      layerBottom,
      layerDown,
      layerTop,
      layerUp,
      redo,
      selectAllByMode,
      selectionMode,
      setSelectionMode,
      setZoom,
      showToast,
      toggleRuler,
      undo,
      ungroupObject,
      zoom
    }
  })
  const exportDeliveryState = homeExportDelivery.controller.state
  const exportDeliveryCommands = homeExportDelivery.controller.commands
  const exportDeliveryHelpers = homeExportDelivery.controller.helpers
  const exportDialog = exportDeliveryState.exportDialog
  const exportDialogCanExport = exportDeliveryState.exportDialogCanExport
  const exportDialogSelectedPreset = exportDeliveryState.exportDialogSelectedPreset
  const filteredShortcutGroups = exportDeliveryState.filteredShortcutGroups
  const shortcutBindings = exportDeliveryState.shortcutBindings
  const shortcutDrawerOpen = exportDeliveryState.shortcutDrawerOpen
  const shortcutPlatform = exportDeliveryState.shortcutPlatform
  const shortcutSearch = exportDeliveryState.shortcutSearch
  const {
    addShortcutBinding,
    applyShortcutBinding,
    closeShortcutDrawer,
    copyAsPNG,
    copyAsSVG,
    executeShortcutAction,
    getShortcutActionByEvent,
    handleExportDialogShowChange,
    handleExportPresetSelect,
    loadShortcutBindings,
    openExportDialog,
    openShortcutDrawer,
    removeShortcutBinding,
    resetShortcutBindingsToDefault,
    runExportDialogExport,
    setExportFormatEnabled,
    toggleExportPngSize
  } = exportDeliveryCommands
  const {
    copySelectionToInternalClipboard,
    createCanvasSVGPreview,
    duplicateSelection,
    exportPNG,
    exportSVG,
    pasteInternalClipboard,
    renderPNGDataUrl
  } = exportDeliveryHelpers

  let svgPreviewRequestId = 0
  const svgPreviewSource = ref('')

  async function refreshSvgPreviewSource() {
    const requestId = ++svgPreviewRequestId
    if (canvasViewMode.value !== 'svg') {
      svgPreviewSource.value = ''
      return
    }
    try {
      const source = await createCanvasSVGPreview(false)
      if (requestId === svgPreviewRequestId && canvasViewMode.value === 'svg') {
        svgPreviewSource.value = source
      }
    } catch {
      if (requestId === svgPreviewRequestId) svgPreviewSource.value = ''
    }
  }

  watch([canvasViewMode, layerVersion, canvasWidth, canvasHeight, canvasBg], () => {
    void refreshSvgPreviewSource()
  }, { immediate: true })

  const svgPreviewDataUrl = computed(() => (
    svgPreviewSource.value ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgPreviewSource.value)}` : ''
  ))

  // 将 SVG 源码转成分段高亮的 HTML，保持代码模式只读展示且不执行源码中的 SVG 内容。
  function highlightSvgSource(source: string) {
    const escapeHtml = (value: string) => value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    const tagPattern = /<\/?[\w:-]+(?:\s+[\w:-]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*\s*\/?>/g
    let highlighted = ''
    let lastIndex = 0
    for (const match of source.matchAll(tagPattern)) {
      const tagSource = match[0]
      const index = match.index ?? 0
      highlighted += escapeHtml(source.slice(lastIndex, index))
      const escapedTag = escapeHtml(tagSource)
      const highlightedAttrs = escapedTag.replace(
        /([\w:-]+)(=)("[^"]*"|'[^']*'|[^\s]+)/g,
        '<span class="svg-code-attr">$1</span>$2<span class="svg-code-string">$3</span>'
      )
      highlighted += highlightedAttrs
        .replace(/^(&lt;\/?)([\w:-]+)/, '<span class="svg-code-bracket">$1</span><span class="svg-code-tag">$2</span>')
        .replace(/(\/??&gt;)$/, '<span class="svg-code-bracket">$1</span>')
      lastIndex = index + tagSource.length
    }
    highlighted += escapeHtml(source.slice(lastIndex))
    return highlighted
  }

  const highlightedSvgPreviewSource = computed(() => highlightSvgSource(svgPreviewSource.value))

  const svgModeTooltipTitle = computed(() => svgPreviewMode.value === 'graphic' ? 'SVG 图形模式' : 'SVG 代码模式')
  const svgModeTooltipDetail = computed(() => (
    svgPreviewMode.value === 'graphic'
      ? '悬浮可切换为代码模式；当前以图形方式预览导出结果。'
      : '悬浮可切换为图形模式；当前只读查看带高亮的 SVG 源码。'
  ))

  // 切换 SVG 二级预览模式；该状态只影响 SVG 页签下的展示方式，不修改画布或导出内容。
  function setSvgPreviewMode(mode: IconCreatorProjectSvgPreviewMode) {
    svgPreviewMode.value = mode
    canvasViewMode.value = 'svg'
  }

  // 生成项目标签的本地唯一 id，标签只在当前编辑会话内隔离不同项目状态。
  function createProjectTabId() {
    projectTabSeed += 1
    return `project-tab-${projectTabSeed}-${Date.now()}`
  }

  // 使用顺序编号生成默认项目名，避免多个未保存标签都显示成难以区分的空名称。
  function createProjectTabName() {
    return `项目 ${projectTabs.value.length + 1}`
  }

  // 深拷贝工程对象，避免 inactive 标签与当前画布恢复流程共享可变引用。
  function cloneProjectFile(project: IconCreatorProjectFile): IconCreatorProjectFile {
    return JSON.parse(JSON.stringify(project)) as IconCreatorProjectFile
  }

  // 收集当前选区对象 id，切换回标签时尽量恢复用户离开前的选择上下文。
  function captureSelectedObjectIds() {
    if (!fabricCanvas) return []
    return fabricCanvas.getActiveObjects()
      .filter((obj) => !isBooleanPreviewObject(obj))
      .map((obj) => ensureEditorObjectId(obj))
      .filter(Boolean)
  }

  // 根据保存的对象 id 恢复标签选区；对象已删除或无法恢复时自动退化为空选择。
  function restoreSelectedObjectsByIds(ids: string[]) {
    if (!fabricCanvas || !ids.length) {
      fabricCanvas?.discardActiveObject()
      syncActiveObject(null)
      fabricCanvas?.requestRenderAll()
      return
    }
    const idSet = new Set(ids)
    const targets = fabricCanvas.getObjects()
      .filter((obj) => !isBooleanPreviewObject(obj) && idSet.has(String((obj as AnyFabricObject).editorObjectId || '')))
    applyActiveObjectsSelection(targets)
  }

  // 捕获指定项目标签的完整编辑现场，包括工程内容、选择态、视口、视图模式和历史栈。
  function captureCurrentProjectTabState(tab: ProjectTabState) {
    if (!fabricCanvas) return
    tab.project = cloneProjectFile(createProjectFile())
    tab.selectedObjectIds = captureSelectedObjectIds()
    tab.zoom = zoom.value
    tab.panX = canvasPanX.value
    tab.panY = canvasPanY.value
    tab.viewMode = canvasViewMode.value
    tab.svgPreviewMode = svgPreviewMode.value
    tab.history = captureHistoryState()
  }

  // 在离开当前标签前保存现场，确保再次切换回来时不会丢失编辑状态。
  function persistActiveProjectTabState() {
    const tab = activeProjectTab.value
    if (!tab || !fabricCanvas) return
    captureCurrentProjectTabState(tab)
  }

  // 将标签中保存的完整项目状态恢复到当前 Fabric 画布，并还原独立历史与视口。
  async function loadProjectTabState(tab: ProjectTabState) {
    if (!fabricCanvas) return
    switchingProjectTab = true
    try {
      activeProjectTabId.value = tab.id
      await loadProjectFile(cloneProjectFile(tab.project), { keepDraft: true, resetHistory: false })
      restoreHistoryState(tab.history)
      canvasViewMode.value = tab.viewMode
      svgPreviewMode.value = tab.svgPreviewMode
      setZoom(tab.zoom)
      canvasPanX.value = tab.panX
      canvasPanY.value = tab.panY
      restoreSelectedObjectsByIds(tab.selectedObjectIds)
      markSmallPreviewsDirty()
    } finally {
      switchingProjectTab = false
    }
  }

  // 初始化第一个项目标签，将当前启动后的画布包装成可切换项目。
  function initializeProjectTabs() {
    if (projectTabs.value.length || !fabricCanvas) return
    const id = createProjectTabId()
    const tab: ProjectTabState = {
      id,
      name: createProjectTabName(),
      project: cloneProjectFile(createProjectFile()),
      selectedObjectIds: captureSelectedObjectIds(),
      zoom: zoom.value,
      panX: canvasPanX.value,
      panY: canvasPanY.value,
      viewMode: canvasViewMode.value,
      svgPreviewMode: svgPreviewMode.value,
      history: captureHistoryState(),
      dirty: false
    }
    projectTabs.value = [tab]
    activeProjectTabId.value = id
    projectTabSnapshotReady = true
  }

  // 新建独立项目标签，并把画布重置为新的空项目现场。
  async function addProjectTab() {
    if (!fabricCanvas) return
    if (!projectTabs.value.length) initializeProjectTabs()
    persistActiveProjectTabState()
    const id = createProjectTabId()
    const name = createProjectTabName()
    switchingProjectTab = true
    suppressProjectTabAutoSave = true
    try {
      newDoc()
      canvasViewMode.value = 'canvas'
      svgPreviewMode.value = 'graphic'
      fitCanvasInView()
      const tab: ProjectTabState = {
        id,
        name,
        project: cloneProjectFile(createProjectFile()),
        selectedObjectIds: [],
        zoom: zoom.value,
        panX: canvasPanX.value,
        panY: canvasPanY.value,
        viewMode: canvasViewMode.value,
        svgPreviewMode: svgPreviewMode.value,
        history: captureHistoryState(),
        dirty: false
      }
      projectTabs.value = [...projectTabs.value, tab]
      activeProjectTabId.value = id
      showToast('已新建项目标签', 'success')
    } finally {
      suppressProjectTabAutoSave = false
      switchingProjectTab = false
    }
  }

  // 切换到目标项目标签；当前标签会先保存现场，目标标签再恢复自己的项目、历史与视图状态。
  async function switchProjectTab(tabId: string) {
    if (switchingProjectTab || tabId === activeProjectTabId.value) return
    const target = projectTabs.value.find((tab) => tab.id === tabId)
    if (!target) return
    persistActiveProjectTabState()
    await loadProjectTabState(target)
  }

  // 关闭项目标签；关闭含未保存提示的标签前做轻量确认，至少保留一个项目标签。
  async function closeProjectTab(tabId: string) {
    if (projectTabs.value.length <= 1) return
    const index = projectTabs.value.findIndex((tab) => tab.id === tabId)
    if (index < 0) return
    const target = projectTabs.value[index]
    if (target.dirty && !window.confirm(`项目“${target.name}”存在未保存修改，确定关闭吗？`)) return
    const wasActive = tabId === activeProjectTabId.value
    const nextTab = wasActive
      ? projectTabs.value[index + 1] ?? projectTabs.value[index - 1]
      : null
    projectTabs.value = projectTabs.value.filter((tab) => tab.id !== tabId)
    if (wasActive && nextTab) await loadProjectTabState(nextTab)
  }

  watch(historyIndex, () => {
    if (!projectTabSnapshotReady || switchingProjectTab || suppressProjectTabAutoSave) return
    const tab = activeProjectTab.value
    if (tab) tab.dirty = true
  })

  watch([canvasViewMode, svgPreviewMode, zoom, canvasPanX, canvasPanY], () => {
    if (switchingProjectTab) return
    const tab = activeProjectTab.value
    if (!tab) return
    tab.viewMode = canvasViewMode.value
    tab.svgPreviewMode = svgPreviewMode.value
    tab.zoom = zoom.value
    tab.panX = canvasPanX.value
    tab.panY = canvasPanY.value
  })

  // 顶栏“新建”命令在当前标签内重置项目内容，并同步更新该标签保存的初始历史。
  function resetActiveProjectTabDocument() {
    newDoc()
    canvasViewMode.value = 'canvas'
    svgPreviewMode.value = 'graphic'
    const tab = activeProjectTab.value
    if (!tab || !fabricCanvas) return
    captureCurrentProjectTabState(tab)
    tab.dirty = false
  }

  // 保存当前项目标签并清除未保存提示；实际文件落盘仍复用既有工程保存流程。
  function saveActiveProjectTab() {
    saveProject()
    const tab = activeProjectTab.value
    if (!tab || !fabricCanvas) return
    captureCurrentProjectTabState(tab)
    tab.dirty = false
  }

  // 打开工程入口会先保存当前标签现场，再复用文件选择器加载到当前项目标签。
  function openProjectForActiveTab() {
    persistActiveProjectTabState()
    openProject()
  }

  async function onProjectFileChosenForActiveTab(event: Event) {
    await onProjectFileChosen(event)
    const tab = activeProjectTab.value
    if (!tab || !fabricCanvas) return
    tab.name = '导入项目'
    captureCurrentProjectTabState(tab)
    tab.dirty = false
  }

  const iconCheckSummary = computed(() => {
    const count = iconCheckIssues.value.length
    if (!count) {
      return {
        title: '当前没有检测到问题',
        detail: '检查结果会根据画布、安全区、颜色和小尺寸表现自动刷新。'
      }
    }
    return {
      title: `检测到 ${count} 项问题`,
      detail: '悬浮查看问题列表，点击具体问题可直接定位到关联对象。'
    }
  })

  const activeKaleidoscopeInstance = computed(() => {
    const obj = activeObject.value
    return obj && isKaleidoscopeInstance(obj) ? obj : null
  })

  const activeKaleidoscopeSource = computed(() => {
    const obj = activeObject.value
    return obj && isKaleidoscopeSource(obj) ? obj : null
  })

  const activeKaleidoscopeEditableSource = computed(() => {
    const obj = activeObject.value
    return obj && canUseKaleidoscopeAsSource(obj) ? obj : null
  })

  const activeKaleidoscopeInstanceSource = computed(() => {
    const instance = activeKaleidoscopeInstance.value
    return instance ? findKaleidoscopeSourceById(getKaleidoscopeInstanceSourceId(instance)) : null
  })

  const activeKaleidoscopePanelSource = computed(() => activeKaleidoscopeEditableSource.value ?? activeKaleidoscopeInstanceSource.value)

  const activeArrowRenderMode = computed<ArrowRenderMode>(() => {
    const obj = activeEditablePathObject.value
    return obj ? getArrowRenderMode(obj) : 'standard'
  })

  const isHollowShaftArrow = computed(() => activeArrowRenderMode.value === 'hollow-shaft')

  const hasSelectedCurveSegment = computed(() => {
    if (isHollowShaftArrow.value) return false
    return !!selectedEditableSegment.value
  })

  const selectedArrowEndpointIndices = computed<number[]>(() => {
    void editablePathMetadataVersion.value
    const obj = activeEditablePathObject.value
    const indices = selectedPointIndices.value
    if (!obj || !indices.length) return []
    const result: number[] = []
    for (const index of indices) {
      if (!isEditablePointOpenEndpoint(obj, index)) return []
      result.push(index)
    }
    return result
  })

  const hasSelectedArrowEndpoint = computed(() => selectedArrowEndpointIndices.value.length > 0)

  const editorStore = createEditorStore({
    activeObject,
    activeRightTab,
    canRedo,
    canUndo,
    canvasBg,
    canvasHeight,
    canvasWidth,
    hasEditablePoints,
    keylineTemplate,
    selectionMode,
    shortcutDrawerOpen,
    showArtboardList,
    showPixelGrid,
    showRuler,
    snapToPixelGrid,
    zoom
  })
  const editorSelectors = createEditorSelectors(editorStore)
  const editorCommands = createEditorCommands({
    addShape,
    addText,
    applyIconTemplateAsDocument: assetsImportCommands.applyIconTemplateAsDocument,
    closeShortcutDrawer,
    copyAsPNG,
    copyAsSVG,
    deleteUserAsset: assetsImportCommands.deleteUserAsset,
    importImage: assetsImportCommands.importImage,
    importSVG: assetsImportCommands.importSVG,
    insertIconTemplate: assetsImportCommands.insertIconTemplate,
    insertIconifyIcon: assetsImportCommands.insertIconifyIcon,
    insertUserAsset: assetsImportCommands.insertUserAsset,
    newDoc: resetActiveProjectTabDocument,
    openCreateUserAssetDialog: assetsImportCommands.openCreateUserAssetDialog,
    openExportDialog,
    openPasteSVGDialog: assetsImportCommands.openPasteSVGDialog,
    openProject: openProjectForActiveTab,
    openRenameUserAssetDialog: assetsImportCommands.openRenameUserAssetDialog,
    openShortcutDrawer,
    redo,
    saveProject: saveActiveProjectTab,
    searchIconifyIcons: assetsImportCommands.searchIconifyIcons,
    setSelectionMode,
    setZoom,
    toggleArtboardList,
    toggleKeylineOverlay,
    togglePixelGrid,
    toggleRuler,
    toggleSnapToPixelGrid,
    undo
  })

  type ArrowAggregated = {
    enabled: boolean | null
    shape: ArrowHeadShape | null
    angle: number | null
    length: number | null
  }

  const arrowAggregated = computed<ArrowAggregated>(() => {
    void editablePathMetadataVersion.value
    const obj = activeEditablePathObject.value
    const indices = selectedArrowEndpointIndices.value
    const empty: ArrowAggregated = { enabled: null, shape: null, angle: null, length: null }
    if (!obj || !indices.length) return empty
    let enabled: boolean | null = null
    let shape: ArrowHeadShape | null = null
    let angle: number | null = null
    let length: number | null = null
    let first = true
    for (const index of indices) {
      const head: ArrowHead | null = getEditablePointArrowHead(obj, index)
      const e = !!head?.enabled
      const s = head?.shape ?? 'hollow'
      const a = head?.angle ?? 60
      const l = head?.length ?? 16
      if (first) {
        enabled = e
        shape = s
        angle = a
        length = l
        first = false
      } else {
        if (enabled !== e) enabled = null
        if (shape !== s) shape = null
        if (angle !== a) angle = null
        if (length !== l) length = null
      }
    }
    return { enabled, shape, angle, length }
  })

  function getSelectableCanvasObjects() {
    if (!fabricCanvas) return []
    return fabricCanvas.getObjects().filter((obj) => {
      if (isBooleanPreviewObject(obj)) return false
      if (isKaleidoscopeInstance(obj)) return false
      return obj.selectable !== false
    })
  }

  function getCurrentCopyTargets() {
    if (!fabricCanvas) return []
    const objects = fabricCanvas.getActiveObjects()
    const targets = objects.length ? objects : activeObject.value ? [activeObject.value] : []
    const expanded = targets.map((obj) => {
      if (!isKaleidoscopeInstance(obj)) return obj
      return findKaleidoscopeSourceById(getKaleidoscopeInstanceSourceId(obj)) ?? obj
    })
    const unique = Array.from(new Set(expanded))
    return fabricCanvas.getObjects().filter((obj) => unique.includes(obj) && !isBooleanPreviewObject(obj))
  }

  function createClipboardEntry(obj: FabricObject): ClipboardEntry {
    const source = isKaleidoscopeInstance(obj)
      ? findKaleidoscopeSourceById(getKaleidoscopeInstanceSourceId(obj))
      : obj
    const target = source ?? obj
    const serialized = (target as AnyFabricObject).toObject(SERIALIZED_OBJECT_PROPS as unknown as string[]) as Record<string, unknown>
    return {
      object: serialized,
      sourceName: String((target as AnyFabricObject).name || target.type || '对象'),
      kaleidoscopeEnabled: source ? isKaleidoscopeSource(source) : false,
      sourceMissing: !source && isKaleidoscopeInstance(obj)
    }
  }

  // 生成个人素材唯一标识，避免重启后素材重命名或重新排序影响插入与编辑操作。
  function createUserAssetId() {
    return `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }

  // 规范用户输入的素材名；空名称会回退到可读默认名，避免素材库出现不可点击的空标题。
  function normalizeUserAssetName(value: string, fallback = '素材') {
    const trimmed = value.trim()
    return trimmed || fallback
  }

  // 根据当前选区生成新素材的默认名称，多对象选区使用统一名称，单对象选区沿用图层显示名。
  function getDefaultUserAssetName() {
    const targets = getCurrentCopyTargets()
    if (targets.length === 1) return getObjectDisplayName(targets[0])
    return `素材 ${userAssets.value.length + 1}`
  }

  // 深拷贝 Fabric 序列化结果，确保写入 localStorage 的素材不再引用当前画布对象状态。
  function cloneSerializedObjectData(value: Record<string, unknown>) {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
  }

  // 把当前选区序列化为素材对象列表，保留渐变、可编辑路径等自定义元数据并记录原始图层顺序。
  function serializeCurrentSelectionForUserAsset() {
    const targets = getCurrentCopyTargets()
    const objects = targets.map((obj) => cloneSerializedObjectData((obj as AnyFabricObject).toObject(SERIALIZED_OBJECT_PROPS as unknown as string[]) as Record<string, unknown>))
    const layerOrder = targets.map((obj) => ensureEditorObjectId(obj))
    return { objects, layerOrder }
  }

  // 计算一组对象的联合包围盒，供素材缩略图生成和插入居中复用；无有效尺寸时返回 null。
  function getObjectsCombinedBounds(objects: FabricObject[]) {
    if (!objects.length) return null
    let left = Number.POSITIVE_INFINITY
    let top = Number.POSITIVE_INFINITY
    let right = Number.NEGATIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY
    objects.forEach((obj) => {
      obj.setCoords()
      const bounds = obj.getBoundingRect()
      if (![bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite)) return
      left = Math.min(left, bounds.left)
      top = Math.min(top, bounds.top)
      right = Math.max(right, bounds.left + bounds.width)
      bottom = Math.max(bottom, bounds.top + bounds.height)
    })
    if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) return null
    return { left, top, width: right - left, height: bottom - top }
  }

  // 为素材列表生成透明 PNG 缩略图；通过临时 StaticCanvas 渲染克隆对象，不污染当前编辑画布。
  async function createUserAssetThumbnail(serializedObjects: Record<string, unknown>[]) {
    const objects = await util.enlivenObjects(serializedObjects.map(cloneSerializedObjectData)) as FabricObject[]
    const bounds = getObjectsCombinedBounds(objects)
    if (!bounds) return ''
    const sourceMaxSize = Math.max(bounds.width, bounds.height)
    const sourceScale = sourceMaxSize > USER_ASSET_MAX_THUMBNAIL_SOURCE_SIZE
      ? USER_ASSET_MAX_THUMBNAIL_SOURCE_SIZE / sourceMaxSize
      : 1
    const renderWidth = Math.max(1, Math.ceil(bounds.width * sourceScale))
    const renderHeight = Math.max(1, Math.ceil(bounds.height * sourceScale))
    const sourceCanvasEl = document.createElement('canvas')
    const sourceCanvas = new StaticCanvas(sourceCanvasEl, {
      width: renderWidth,
      height: renderHeight,
      backgroundColor: ''
    })
    sourceCanvas.viewportTransform = [sourceScale, 0, 0, sourceScale, -bounds.left * sourceScale, -bounds.top * sourceScale]
    objects.forEach((obj) => sourceCanvas.add(obj as AnyFabricObject))
    sourceCanvas.renderAll()

    const thumbCanvas = document.createElement('canvas')
    thumbCanvas.width = USER_ASSET_THUMBNAIL_SIZE
    thumbCanvas.height = USER_ASSET_THUMBNAIL_SIZE
    const ctx = thumbCanvas.getContext('2d')
    if (!ctx) {
      sourceCanvas.dispose()
      return ''
    }
    const padding = 8
    const drawScale = Math.min(
      (USER_ASSET_THUMBNAIL_SIZE - padding * 2) / Math.max(1, renderWidth),
      (USER_ASSET_THUMBNAIL_SIZE - padding * 2) / Math.max(1, renderHeight)
    )
    const drawWidth = Math.max(1, renderWidth * drawScale)
    const drawHeight = Math.max(1, renderHeight * drawScale)
    ctx.clearRect(0, 0, USER_ASSET_THUMBNAIL_SIZE, USER_ASSET_THUMBNAIL_SIZE)
    ctx.drawImage(
      sourceCanvas.getElement(),
      (USER_ASSET_THUMBNAIL_SIZE - drawWidth) / 2,
      (USER_ASSET_THUMBNAIL_SIZE - drawHeight) / 2,
      drawWidth,
      drawHeight
    )
    const dataUrl = thumbCanvas.toDataURL('image/png')
    sourceCanvas.dispose()
    return dataUrl
  }

  // 读取 localStorage 中的素材条目并做最小校验，坏数据会被忽略以免阻塞编辑器启动。
  function normalizeStoredUserAsset(value: unknown): UserAssetItem | null {
    const source = value && typeof value === 'object' ? value as Partial<UserAssetItem> : null
    if (!source || typeof source.id !== 'string' || typeof source.name !== 'string') return null
    if (!Array.isArray(source.objects) || !source.objects.length) return null
    const objects = source.objects.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    if (!objects.length) return null
    const now = new Date().toISOString()
    return {
      id: source.id,
      name: normalizeUserAssetName(source.name),
      createdAt: typeof source.createdAt === 'string' ? source.createdAt : now,
      updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : now,
      objects,
      layerOrder: Array.isArray(source.layerOrder) ? source.layerOrder.filter((id): id is string => typeof id === 'string') : [],
      thumbnail: typeof source.thumbnail === 'string' ? source.thumbnail : ''
    }
  }

  // 启动时加载本地个人素材；解析失败时只清空内存列表，不删除原始存储，方便后续排查。
  function loadUserAssets() {
    try {
      const raw = window.localStorage.getItem(USER_ASSET_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { assets?: unknown } | unknown[]
      const rawAssets = Array.isArray(parsed) ? parsed : Array.isArray(parsed.assets) ? parsed.assets : []
      userAssets.value = rawAssets
        .map(normalizeStoredUserAsset)
        .filter((asset): asset is UserAssetItem => !!asset)
    } catch (error) {
      console.warn('读取个人素材失败', error)
      userAssets.value = []
    }
  }

  // 将当前素材列表持久化到 localStorage，使用户重启插件后仍能继续插入常用素材。
  function saveUserAssets() {
    try {
      window.localStorage.setItem(USER_ASSET_STORAGE_KEY, JSON.stringify({
        schemaVersion: 1,
        assets: userAssets.value
      }))
    } catch (error) {
      console.warn('保存个人素材失败', error)
      throw new Error('保存个人素材失败，请检查浏览器本地存储空间')
    }
  }

  // 为样式预设生成稳定 id，避免分组、颜色和渐变在排序、编辑或二次保存后互相覆盖。
  function createUserStylePresetId(kind: 'color' | 'gradient' | 'color-group') {
    return `${kind}-preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }

  // 深拷贝色板分组，保证管理弹窗和持久化写入都不会复用编辑器内置配置的对象引用。
  function cloneManagedColorPaletteGroups(groups: ColorPaletteGroup[]) {
    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      colors: group.colors.map((color) => ({ ...color }))
    }))
  }

  // 深拷贝渐变预设及其色标，避免应用预设或弹窗编辑时直接改写当前运行中的列表源数据。
  function cloneManagedGradientPresets(presets: GradientPresetItem[]) {
    return presets.map((preset) => ({
      ...preset,
      stops: preset.stops.map((stop) => ({ ...stop }))
    }))
  }

  // 规范用户样式预设名称；本地旧数据缺失名称时回退到便于识别的默认标题。
  function normalizeUserStylePresetName(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback
  }

  // 规范可保存的颜色值；保持 hex / rgba 等 CSS 字符串原样，空值返回空串表示不可保存。
  function normalizeSavedColor(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : ''
  }

  // 将色板列数限制在可读范围内，避免配置异常时把属性面板挤成无法点击的极窄色块。
  function normalizeColorPaletteColumns(value: unknown, fallback = DEFAULT_COLOR_PALETTE_COLUMNS) {
    const parsed = Math.round(Number(value))
    if (!Number.isFinite(parsed)) return fallback
    return Math.min(MAX_COLOR_PALETTE_COLUMNS, Math.max(MIN_COLOR_PALETTE_COLUMNS, parsed))
  }

  // 将渐变展示行数限制在合理范围内，结合固定两列布局控制右侧面板露出的预设数量。
  function normalizeGradientPresetRows(
    value: unknown,
    fallback = Math.ceil(defaultGradientPresets.length / GRADIENT_PRESET_GRID_COLUMNS)
  ) {
    const parsed = Math.round(Number(value))
    if (!Number.isFinite(parsed)) return fallback
    return Math.min(MAX_GRADIENT_PRESET_ROWS, Math.max(MIN_GRADIENT_PRESET_ROWS, parsed))
  }

  // 按固定两列网格把预设数量折算为展示行数，兼容默认值计算和旧版“展示条数”配置迁移。
  function getGradientPresetRowsFromCount(count: unknown) {
    const parsed = Math.max(0, Math.round(Number(count) || 0))
    return normalizeGradientPresetRows(Math.ceil(parsed / GRADIENT_PRESET_GRID_COLUMNS))
  }

  // 读取本地颜色预设时执行最小校验，过滤空颜色并为旧数据补齐名称和 id。
  function normalizeStoredColorSwatch(value: unknown, index: number): ColorSwatchItem | null {
    const source = value && typeof value === 'object' ? value as Partial<ColorSwatchItem> : null
    const color = normalizeSavedColor(source?.color)
    if (!source || !color) return null
    return {
      id: typeof source.id === 'string' && source.id.trim() ? source.id : createUserStylePresetId('color'),
      name: normalizeUserStylePresetName(source.name, `颜色 ${index + 1}`),
      color
    }
  }

  // 读取本地色板分组时保留空分类，便于用户先搭好结构再逐步补颜色。
  function normalizeStoredColorPaletteGroup(value: unknown, index: number): ColorPaletteGroup | null {
    const source = value && typeof value === 'object' ? value as Partial<ColorPaletteGroup> : null
    if (!source) return null
    const colors = Array.isArray(source.colors)
      ? source.colors
        .map(normalizeStoredColorSwatch)
        .filter((item): item is ColorSwatchItem => !!item)
      : []
    return {
      id: typeof source.id === 'string' && source.id.trim() ? source.id : createUserStylePresetId('color-group'),
      name: normalizeUserStylePresetName(source.name, `分类 ${index + 1}`),
      colors
    }
  }

  // 将角度预设归一到 0-359，避免手写或旧版本数据导致 Fabric 渐变方向异常。
  function normalizeGradientPresetAngle(value: unknown, fallback = DEFAULT_FILL_GRADIENT_ANGLE) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return fallback
    const normalized = parsed % 360
    return normalized < 0 ? normalized + 360 : normalized
  }

  // 将渐变中心比例限制在对象内部，保证径向渐变预设应用后控制点仍可见可拖拽。
  function normalizeGradientPresetUnit(value: unknown, fallback = 0.5) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return fallback
    return Math.min(1, Math.max(0, parsed))
  }

  // 读取本地渐变预设时补齐类型、色标和径向参数，坏数据会被降级为安全的默认渐变。
  function normalizeStoredGradientPreset(value: unknown, index: number): GradientPresetItem | null {
    const source = value && typeof value === 'object' ? value as Partial<GradientPresetItem> : null
    if (!source) return null
    const type = source.type === 'radial' ? 'radial' : 'linear'
    const stopsSource = Array.isArray(source.stops) ? source.stops : undefined
    const stops = cloneFillGradientStops(stopsSource)
    if (!stops.length) return null
    return {
      id: typeof source.id === 'string' && source.id.trim() ? source.id : createUserStylePresetId('gradient'),
      name: normalizeUserStylePresetName(source.name, `渐变 ${index + 1}`),
      type,
      stops,
      angle: normalizeGradientPresetAngle(source.angle),
      centerX: normalizeGradientPresetUnit(source.centerX),
      centerY: normalizeGradientPresetUnit(source.centerY),
      radius: normalizeFillGradientRadiusInput(Number(source.radius ?? DEFAULT_FILL_GRADIENT_RADIUS)),
      userCreated: source.userCreated === true
    }
  }

  // 恢复为编辑器内置色板和渐变基线；重置操作与异常回退都复用这一份默认构建逻辑。
  function resetStylePresetSettingsToDefault() {
    stylePresetSettings.colorPaletteGroups = cloneManagedColorPaletteGroups(defaultColorPaletteGroups)
    stylePresetSettings.gradientPresets = cloneManagedGradientPresets(defaultGradientPresets)
    stylePresetSettings.colorColumns = DEFAULT_COLOR_PALETTE_COLUMNS
    stylePresetSettings.gradientPresetRows = Math.max(
      MIN_GRADIENT_PRESET_ROWS,
      Math.ceil(defaultGradientPresets.length / GRADIENT_PRESET_GRID_COLUMNS)
    )
  }

  // 旧版本仅保存“我的颜色/渐变”，迁移时把颜色合并成独立分组并追加到系统预设后面。
  function buildMigratedColorPaletteGroups(legacyColors: ColorSwatchItem[]) {
    const groups = cloneManagedColorPaletteGroups(defaultColorPaletteGroups)
    if (!legacyColors.length) return groups
    groups.push({
      id: createUserStylePresetId('color-group'),
      name: '我的颜色',
      colors: legacyColors.map((item) => ({ ...item }))
    })
    return groups
  }

  // 启动时加载用户保存的样式预设；兼容旧版仅有 colors/gradients 的结构，并允许新版保存空分组或空预设。
  function loadUserStylePresets() {
    try {
      const raw = window.localStorage.getItem(USER_STYLE_PRESET_STORAGE_KEY)
      if (!raw) {
        resetStylePresetSettingsToDefault()
        return
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const isManagedSchema = Number(parsed.schemaVersion) >= STYLE_PRESET_STORAGE_SCHEMA_VERSION
        || Object.prototype.hasOwnProperty.call(parsed, 'colorPaletteGroups')
        || Object.prototype.hasOwnProperty.call(parsed, 'gradientPresets')

      if (isManagedSchema) {
        const groups = Array.isArray(parsed.colorPaletteGroups)
          ? parsed.colorPaletteGroups
            .map(normalizeStoredColorPaletteGroup)
            .filter((item): item is ColorPaletteGroup => !!item)
          : cloneManagedColorPaletteGroups(defaultColorPaletteGroups)
        const presets = Array.isArray(parsed.gradientPresets)
          ? parsed.gradientPresets
            .map(normalizeStoredGradientPreset)
            .filter((item): item is GradientPresetItem => !!item)
          : cloneManagedGradientPresets(defaultGradientPresets)
        stylePresetSettings.colorPaletteGroups = groups
        stylePresetSettings.gradientPresets = presets
        stylePresetSettings.colorColumns = normalizeColorPaletteColumns(parsed.colorColumns)
        stylePresetSettings.gradientPresetRows = normalizeGradientPresetRows(
          parsed.gradientPresetRows,
          Object.prototype.hasOwnProperty.call(parsed, 'gradientPresetVisibleCount')
            ? getGradientPresetRowsFromCount(parsed.gradientPresetVisibleCount)
            : Math.ceil((presets.length || defaultGradientPresets.length) / GRADIENT_PRESET_GRID_COLUMNS)
        )
        return
      }

      const legacyColors = Array.isArray(parsed.colors)
        ? parsed.colors
          .map(normalizeStoredColorSwatch)
          .filter((item): item is ColorSwatchItem => !!item)
        : []
      const legacyGradients = Array.isArray(parsed.gradients)
        ? parsed.gradients
          .map(normalizeStoredGradientPreset)
          .filter((item): item is GradientPresetItem => !!item)
        : []
      stylePresetSettings.colorPaletteGroups = buildMigratedColorPaletteGroups(legacyColors)
      stylePresetSettings.gradientPresets = [
        ...cloneManagedGradientPresets(defaultGradientPresets),
        ...legacyGradients
      ]
      stylePresetSettings.colorColumns = DEFAULT_COLOR_PALETTE_COLUMNS
      stylePresetSettings.gradientPresetRows = normalizeGradientPresetRows(
        parsed.gradientPresetRows,
        getGradientPresetRowsFromCount(parsed.gradientPresetVisibleCount)
      )
    } catch (error) {
      console.warn('读取样式预设失败', error)
      resetStylePresetSettingsToDefault()
    }
  }

  // 将当前样式预设完整写回 localStorage，保存失败时抛出错误供弹窗或按钮操作提示用户。
  function saveUserStylePresets() {
    try {
      window.localStorage.setItem(USER_STYLE_PRESET_STORAGE_KEY, JSON.stringify({
        schemaVersion: STYLE_PRESET_STORAGE_SCHEMA_VERSION,
        colorPaletteGroups: stylePresetSettings.colorPaletteGroups,
        gradientPresets: stylePresetSettings.gradientPresets,
        colorColumns: stylePresetSettings.colorColumns,
        gradientPresetRows: stylePresetSettings.gradientPresetRows
      }))
    } catch (error) {
      console.warn('保存样式预设失败', error)
      throw new Error('保存样式预设失败，请检查浏览器本地存储空间')
    }
  }

  // 获取或创建“我的颜色”分组，供快捷保存当前填充/描边色以及旧功能迁移复用。
  function getOrCreateUserColorPaletteGroup() {
    const existing = stylePresetSettings.colorPaletteGroups.find((group) => group.name === '我的颜色')
    if (existing) return existing
    const group: ColorPaletteGroup = {
      id: createUserStylePresetId('color-group'),
      name: '我的颜色',
      colors: []
    }
    stylePresetSettings.colorPaletteGroups = [...stylePresetSettings.colorPaletteGroups, group]
    return group
  }

  // 构造当前对象的渐变快照，供管理弹窗“取当前渐变”和旧快捷保存逻辑复用。
  function createCurrentGradientPreset(name = '当前渐变'): GradientPresetItem | null {
    if (!activeObject.value || objProps.fillMode !== 'gradient') return null
    return {
      id: createUserStylePresetId('gradient'),
      name,
      type: objProps.fillGradientType === 'radial' ? 'radial' : 'linear',
      stops: cloneFillGradientStops(objProps.fillGradientStops.map(({ color, offset }) => ({ color, offset }))),
      angle: normalizeGradientPresetAngle(objProps.fillGradientAngle),
      centerX: normalizeGradientPresetUnit(objProps.fillGradientCenterX),
      centerY: normalizeGradientPresetUnit(objProps.fillGradientCenterY),
      radius: normalizeFillGradientRadiusInput(objProps.fillGradientRadius),
      userCreated: true
    }
  }

  // 打开样式预设管理弹窗，并记住入口来源，便于直接切到色板或渐变管理页签。
  function openStylePresetManager(tab: StylePresetManagerTab) {
    stylePresetManagerState.initialTab = tab
    stylePresetManagerState.show = true
  }

  // 统一同步样式预设管理弹窗显隐，供外层 Modal 的 v-model 透传使用。
  function handleStylePresetManagerShowChange(show: boolean) {
    stylePresetManagerState.show = show
  }

  // 应用管理弹窗提交的完整配置；这里只更新本地样式体系，不写入撤销栈也不改动画板数据。
  function applyStylePresetSettings(next: StylePresetSettings) {
    try {
      stylePresetSettings.colorPaletteGroups = Array.isArray(next.colorPaletteGroups)
        ? next.colorPaletteGroups
          .map(normalizeStoredColorPaletteGroup)
          .filter((item): item is ColorPaletteGroup => !!item)
        : cloneManagedColorPaletteGroups(defaultColorPaletteGroups)
      stylePresetSettings.gradientPresets = Array.isArray(next.gradientPresets)
        ? next.gradientPresets
          .map(normalizeStoredGradientPreset)
          .filter((item): item is GradientPresetItem => !!item)
        : cloneManagedGradientPresets(defaultGradientPresets)
      stylePresetSettings.colorColumns = normalizeColorPaletteColumns(next.colorColumns)
      stylePresetSettings.gradientPresetRows = normalizeGradientPresetRows(
        next.gradientPresetRows,
        Math.ceil((stylePresetSettings.gradientPresets.length || defaultGradientPresets.length) / GRADIENT_PRESET_GRID_COLUMNS)
      )
      saveUserStylePresets()
      stylePresetManagerState.show = false
      showToast('样式预设已保存', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存样式预设失败', 'error')
    }
  }

  const stylePresetCurrentFillColor = computed(() => normalizeSavedColor(objProps.fill))
  const stylePresetCurrentStrokeColor = computed(() => normalizeSavedColor(objProps.stroke))
  const stylePresetCurrentGradientPreset = computed(() => createCurrentGradientPreset())

  // 应用描边色板时同步补齐描边宽度，确保从无描边对象点击色板也能立即看到效果。
  function applyStrokeColorSwatch(color: string) {
    const obj = activeObject.value
    if (!obj || !fabricCanvas) return
    getStyleTargets(obj).forEach((target) => {
      const typedTarget = target as AnyFabricObject
      typedTarget.lastStroke = color
      const patch: Record<string, unknown> = { stroke: color }
      if (!isStrokeEnabled(color, target.strokeWidth)) {
        const fallbackWidth = Number(typedTarget.lastStrokeWidth ?? objProps.strokeWidth)
        patch.strokeWidth = Number.isFinite(fallbackWidth) && fallbackWidth > 0 ? fallbackWidth : 2
        typedTarget.lastStrokeWidth = patch.strokeWidth
      }
      target.set(patch as any)
      typedTarget.lastStrokeDashArray = normalizeStrokeDashArray(typedTarget.lastStrokeDashArray)
        ?? getDefaultStrokeDashArray(target.strokeWidth)
      target.dirty = true
      target.setCoords()
    })
    if (obj instanceof Group) obj.triggerLayout()
    obj.dirty = true
    obj.setCoords()
    triggerKaleidoscopeContentSync(obj)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  // 根据用户选择把色板颜色应用到填充或描边；填充复用纯色逻辑，描边使用上面的宽度补齐策略。
  function applyColorSwatch(channel: StyleTargetChannel, color: string) {
    const normalized = normalizeSavedColor(color)
    if (!normalized) return
    if (channel === 'stroke') {
      applyStrokeColorSwatch(normalized)
      return
    }
    setSolidFillColor(normalized)
  }

  // 兼容旧快捷保存入口：把当前填充色或描边色加入“我的颜色”，重复颜色会前置刷新名称。
  function saveCurrentColorSwatch(channel: StyleTargetChannel) {
    const color = normalizeSavedColor(channel === 'stroke' ? objProps.stroke : objProps.fill)
    if (!color) return
    const group = getOrCreateUserColorPaletteGroup()
    const name = `${channel === 'stroke' ? '描边色' : '填充色'} ${group.colors.length + 1}`
    const existingIndex = group.colors.findIndex((item) => item.color.toLowerCase() === color.toLowerCase())
    if (existingIndex >= 0) {
      const [existing] = group.colors.splice(existingIndex, 1)
      existing.name = name
      group.colors.unshift(existing)
    } else {
      group.colors.unshift({ id: createUserStylePresetId('color'), name, color })
    }
    stylePresetSettings.colorPaletteGroups = [...stylePresetSettings.colorPaletteGroups]
    saveUserStylePresets()
    showToast('已保存到我的颜色', 'success')
  }

  // 将渐变预设写入当前填充，保留对象原位置尺寸并刷新径向渐变控制点和万花筒同步内容。
  function applyGradientPreset(preset: GradientPresetItem) {
    const obj = activeObject.value
    if (!obj || !fabricCanvas) return
    getStyleTargets(obj).forEach((target) => {
      const typedTarget = target as AnyFabricObject
      applyDefaultFillGradientMetadata(typedTarget)
      typedTarget.fillMode = 'gradient'
      typedTarget.fillGradientType = preset.type === 'radial' ? 'radial' : 'linear'
      typedTarget.fillGradientStops = cloneFillGradientStops(preset.stops)
      typedTarget.fillGradientAngle = normalizeGradientPresetAngle(preset.angle)
      typedTarget.fillGradientCenterX = normalizeGradientPresetUnit(preset.centerX)
      typedTarget.fillGradientCenterY = normalizeGradientPresetUnit(preset.centerY)
      typedTarget.fillGradientRadius = normalizeFillGradientRadiusInput(Number(preset.radius ?? DEFAULT_FILL_GRADIENT_RADIUS))
      applyGradientFillToTarget(target)
      target.dirty = true
      target.setCoords()
    })
    if (obj instanceof Group) obj.triggerLayout()
    objProps.fillEnabled = true
    objProps.fillMode = 'gradient'
    objProps.fillGradientType = preset.type === 'radial' ? 'radial' : 'linear'
    triggerKaleidoscopeContentSync(obj)
    updateCurveControls()
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  // 兼容旧快捷保存入口：把当前对象渐变插到预设列表前面，便于立刻在右侧面板再次复用。
  function saveCurrentGradientPreset() {
    const preset = createCurrentGradientPreset(`渐变 ${stylePresetSettings.gradientPresets.length + 1}`)
    if (!preset) return
    stylePresetSettings.gradientPresets = [preset, ...stylePresetSettings.gradientPresets]
    saveUserStylePresets()
    showToast('已保存当前渐变', 'success')
  }

  // 打开保存素材弹窗，并使用当前选区名称作为默认值以减少重复输入。
  function openCreateUserAssetDialog() {
    if (!canSaveUserAsset.value) return
    userAssetDialog.mode = 'create'
    userAssetDialog.name = getDefaultUserAssetName()
    userAssetDialog.targetId = ''
    userAssetDialog.error = ''
    userAssetDialog.show = true
  }

  // 打开素材重命名弹窗，保留目标 id，确认时只修改素材库数据而不影响画布上已插入对象。
  function openRenameUserAssetDialog(asset: UserAssetItem) {
    userAssetDialog.mode = 'rename'
    userAssetDialog.name = asset.name
    userAssetDialog.targetId = asset.id
    userAssetDialog.error = ''
    userAssetDialog.show = true
  }

  // 关闭素材弹窗时清空临时状态，避免下一次保存或重命名沿用旧错误信息。
  function handleUserAssetDialogShowChange(show: boolean) {
    userAssetDialog.show = show
    if (show) return
    userAssetDialog.name = ''
    userAssetDialog.error = ''
    userAssetDialog.targetId = ''
  }

  // 基于当前选区创建一条个人素材，包含可编辑对象 JSON、图层顺序和列表缩略图。
  async function createUserAssetFromSelection(name: string) {
    const { objects, layerOrder } = serializeCurrentSelectionForUserAsset()
    if (!objects.length) throw new Error('请先选中要保存的对象')
    const now = new Date().toISOString()
    const asset: UserAssetItem = {
      id: createUserAssetId(),
      name: normalizeUserAssetName(name, getDefaultUserAssetName()),
      createdAt: now,
      updatedAt: now,
      objects,
      layerOrder,
      thumbnail: await createUserAssetThumbnail(objects)
    }
    userAssets.value = [asset, ...userAssets.value]
    saveUserAssets()
  }

  // 确认保存或重命名素材；失败时把错误留在弹窗内，便于用户改名或释放存储空间后重试。
  async function confirmUserAssetDialog() {
    const name = normalizeUserAssetName(userAssetDialog.name)
    try {
      if (userAssetDialog.mode === 'create') {
        await createUserAssetFromSelection(name)
      } else {
        const asset = userAssets.value.find((item) => item.id === userAssetDialog.targetId)
        if (!asset) throw new Error('素材不存在')
        asset.name = name
        asset.updatedAt = new Date().toISOString()
        userAssets.value = [...userAssets.value]
        saveUserAssets()
      }
      handleUserAssetDialogShowChange(false)
    } catch (error) {
      userAssetDialog.error = error instanceof Error ? error.message : '保存素材失败'
    }
  }

  // 删除素材前进行二次确认，防止误删本地收藏；删除后立即写回 localStorage。
  function deleteUserAsset(asset: UserAssetItem) {
    const confirmed = window.confirm(`确定删除素材“${asset.name}”吗？`)
    if (!confirmed) return
    userAssets.value = userAssets.value.filter((item) => item.id !== asset.id)
    saveUserAssets()
  }

  // 插入素材前为克隆对象换新内部 id、清理外部端点引用，并递归处理组内子对象元数据。
  function prepareUserAssetObjectForInsert(obj: FabricObject, assetName: string, index: number, isRoot = true) {
    prepareClonedObjectMetadata(obj)
    applyDefaultKaleidoscopeMetadata(obj)
    applyDefaultEndpointSnapMargin(obj)
    normalizeEndpointAttachments(obj)
    applyGradientMetadataToCanvasObject(obj)
    if (isRoot) {
      ;(obj as AnyFabricObject).name = nextName(index === 0 ? assetName : `${assetName} 元素`)
    } else if (!String((obj as AnyFabricObject).name || '').trim()) {
      ;(obj as AnyFabricObject).name = nextName(`${assetName} 元素`)
    }
    if (obj instanceof Group) {
      obj.getObjects().forEach((child, childIndex) => prepareUserAssetObjectForInsert(child, assetName, childIndex, false))
    }
    applyCanvasThemeToObject(obj)
    obj.setCoords()
  }

  // 将素材对象整体移动到当前画布中心，若素材明显大于画布则等比缩小以保证插入后可见。
  function placeUserAssetObjects(objects: FabricObject[]) {
    const bounds = getObjectsCombinedBounds(objects)
    if (!bounds) return { dx: 0, dy: 0 }
    const maxWidth = canvasWidth.value * 0.82
    const maxHeight = canvasHeight.value * 0.82
    const scaleRatio = Math.min(
      1,
      bounds.width > 0 ? maxWidth / bounds.width : 1,
      bounds.height > 0 ? maxHeight / bounds.height : 1
    )
    if (Number.isFinite(scaleRatio) && scaleRatio > 0 && scaleRatio < 1) {
      objects.forEach((obj) => {
        obj.set({
          left: bounds.left + ((obj.left ?? 0) - bounds.left) * scaleRatio,
          top: bounds.top + ((obj.top ?? 0) - bounds.top) * scaleRatio,
          scaleX: (obj.scaleX || 1) * scaleRatio,
          scaleY: (obj.scaleY || 1) * scaleRatio
        })
        obj.setCoords()
      })
    }
    const nextBounds = getObjectsCombinedBounds(objects) ?? bounds
    const dx = canvasWidth.value / 2 - (nextBounds.left + nextBounds.width / 2)
    const dy = canvasHeight.value / 2 - (nextBounds.top + nextBounds.height / 2)
    objects.forEach((obj) => {
      obj.set({
        left: (obj.left || 0) + dx,
        top: (obj.top || 0) + dy
      })
      obj.setCoords()
    })
    return { dx, dy }
  }

  // 素材插入后重置万花筒源 id，并把中心点随对象移动，避免新素材继续引用旧画布中的源对象。
  function resetInsertedAssetKaleidoscopeMetadata(obj: FabricObject, dx: number, dy: number) {
    if (obj instanceof Group) {
      obj.getObjects().forEach((child) => resetInsertedAssetKaleidoscopeMetadata(child, dx, dy))
    }
    applyDefaultKaleidoscopeMetadata(obj)
    const metadata = getKaleidoscopeMetadata(obj)
    if (!metadata) return
    if (metadata.kaleidoscopeManaged || metadata.kaleidoscopeInstanceOf) {
      clearKaleidoscopeMetadata(obj)
      return
    }
    if (metadata.kaleidoscopeEnabled && canUseKaleidoscopeAsSource(obj)) {
      metadata.kaleidoscopeSourceId = createKaleidoscopeSourceId()
      metadata.kaleidoscopeCenterX = (metadata.kaleidoscopeCenterX || 0) + dx
      metadata.kaleidoscopeCenterY = (metadata.kaleidoscopeCenterY || 0) + dy
      metadata.kaleidoscopeCount = normalizeKaleidoscopeCount(metadata.kaleidoscopeCount)
      metadata.kaleidoscopeManaged = false
      metadata.kaleidoscopeInstanceOf = ''
      metadata.kaleidoscopeInstanceIndex = 0
    }
  }

  // 将个人素材重新反序列化为 Fabric 对象插入画布，插入后保持可编辑并生成一次撤销快照。
  async function insertUserAsset(asset: UserAssetItem) {
    if (!fabricCanvas) return
    clearBooleanPreview()
    clearPointEditing()
    const objects = await util.enlivenObjects(asset.objects.map(cloneSerializedObjectData)) as FabricObject[]
    if (!objects.length) return
    const inserted: FabricObject[] = []
    skipSnapshot = true
    try {
      objects.forEach((obj, index) => {
        prepareUserAssetObjectForInsert(obj, asset.name, index)
        inserted.push(obj)
      })
      const { dx, dy } = placeUserAssetObjects(inserted)
      inserted.forEach((obj) => resetInsertedAssetKaleidoscopeMetadata(obj, dx, dy))
      for (const obj of inserted) {
        fabricCanvas.add(obj as AnyFabricObject)
        if (isKaleidoscopeSource(obj)) {
          await rebuildKaleidoscopeInstances(obj)
        }
      }
    } finally {
      skipSnapshot = false
    }
    setSelectionMode('shape')
    applyActiveObjectsSelection(inserted)
    refreshLayers()
    fabricCanvas.requestRenderAll()
    snapshot()
  }

  function selectAllByMode() {
    if (!fabricCanvas) return
    if (selectionMode.value === 'shape') {
      applyActiveObjectsSelection(getSelectableCanvasObjects())
      return
    }
    if (selectionMode.value === 'point') {
      const obj = activeEditablePathObject.value
      if (!obj) return
      setSelectedEditablePoints(obj, getSelectableEditablePoints(obj).map((item) => item.index))
    }
  }

  function toggleRuler() {
    showRuler.value = !showRuler.value
  }

  // 同步网格间距输入框显示，保证工程恢复、预设切换和非法输入回退后界面数值一致。
  function syncPixelGridSizeInput() {
    pixelGridSizeInput.value = formatNumericInputValue(pixelGridSize.value)
  }

  // 开关像素网格可见性；该状态属于工程辅助设置，会写入草稿和工程文件但不进入撤销栈。
  function setPixelGridVisible(visible: boolean) {
    showPixelGrid.value = visible
    scheduleDraftSave()
  }

  // 控制移动和点位编辑是否吸附到当前网格；该辅助状态随工程保存，便于恢复编辑环境。
  function setSnapToPixelGrid(enabled: boolean) {
    snapToPixelGrid.value = enabled
    syncCanvasInteractionMode()
    scheduleDraftSave()
  }

  // 更新网格间距并同步输入框，后续对象移动和点位拖拽都会使用这个间距进行吸附。
  function setPixelGridSize(value: number) {
    pixelGridSize.value = normalizePixelGridSize(value)
    syncPixelGridSizeInput()
    scheduleDraftSave()
  }

  // 提交网格间距输入，非法内容回退到当前间距，避免输入错误时把吸附间距改成不可用值。
  function setPixelGridSizeFromInput(value: string | number) {
    commitNumericInput(
      value,
      pixelGridSize.value,
      setPixelGridSize,
      (next) => { pixelGridSizeInput.value = formatNumericInputValue(normalizePixelGridSize(next)) }
    )
  }

  // 顶栏快捷入口用于快速显示或隐藏像素网格，不影响真实画布对象和最终导出内容。
  function togglePixelGrid() {
    setPixelGridVisible(!showPixelGrid.value)
  }

  // 顶栏快捷入口用于快速启停吸附，方便在自由编辑和像素对齐之间切换。
  function toggleSnapToPixelGrid() {
    setSnapToPixelGrid(!snapToPixelGrid.value)
  }

  // 同步安全区输入框显示，保证工程恢复和非法输入回退后仍展示真实生效值。
  function syncKeylineMarginInput() {
    keylineMarginInput.value = formatNumericInputValue(keylineMargin.value)
  }

  // 统一更新参考线透明度，供属性面板、工程恢复和画板切换复用，避免 overlay 留下越界透明值。
  function setKeylineOpacity(value: number) {
    keylineOpacity.value = normalizeKeylineOpacity(value)
    scheduleDraftSave()
  }

  // 切换 Keyline / 安全区模板；Material / iOS / Favicon 使用内置规则，自定义模式使用用户边距。
  function setKeylineTemplate(template: KeylineTemplate) {
    keylineTemplate.value = normalizeKeylineTemplate(template)
    scheduleDraftSave()
  }

  // 更新自定义安全区边距，模板未切到自定义时仍保留该值，便于稍后切回。
  function setKeylineMargin(value: number) {
    keylineMargin.value = normalizeKeylineMargin(value)
    syncKeylineMarginInput()
    scheduleDraftSave()
  }

  // 提交安全区边距输入，非法内容回退到当前值，避免参考线被错误参数移出画布。
  function setKeylineMarginFromInput(value: string | number) {
    commitNumericInput(
      value,
      keylineMargin.value,
      setKeylineMargin,
      (next) => { keylineMarginInput.value = formatNumericInputValue(normalizeKeylineMargin(next)) }
    )
  }

  // 顶栏参考线按钮在无参考线和 Material Keyline 间快速切换，不参与导出。
  function toggleKeylineOverlay() {
    setKeylineTemplate(keylineTemplate.value === 'none' ? 'material' : 'none')
  }

  // 获取对象在图层面板中的显示名，规范检查定位问题时复用同一套命名策略。
  function getObjectDisplayName(obj: FabricObject) {
    return String((obj as AnyFabricObject).name || obj.type || '对象')
  }

  // 汇总当前画布状态并委托纯检查模块生成规范问题，选择定位等副作用仍留在编辑器壳层。
  function buildIconCheckIssues(): IconCheckIssue[] {
    void fabricCanvasVersion.value
    void layerVersion.value
    if (!fabricCanvas) return []
    return buildIconCheckIssuesFromContext({
      canvasBg: canvasBg.value,
      canvasWidth: canvasWidth.value,
      keylineTemplate: keylineTemplate.value,
      keylineSafeArea: keylineSafeArea.value,
      objects: fabricCanvas.getObjects(),
      isBooleanPreviewObject,
      isStrokeEnabled,
      getStyleTargets,
      getObjectDisplayName
    })
  }

  // 点击检查项时定位到关联对象，方便用户直接调整越界、描边过细或非整数坐标问题。
  function selectIconCheckIssue(issue: IconCheckIssue) {
    if (!issue.target || !fabricCanvas) return
    previewPopoverVisible.value = false
    applyActiveObjectsSelection([issue.target])
  }

  // 生成适合目录或文件名使用的画板名称，避免多画板 ZIP 内出现路径分隔符和空名称。
  function sanitizeExportEntryName(value: string, fallback: string) {
    const normalized = value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, '-')
    return normalized || fallback
  }

  // 为 ZIP 条目路径追加序号，确保同名画板或重复尺寸不会在压缩包内互相覆盖。
  function createUniqueZipEntryName(name: string, usedNames: Set<string>) {
    const normalized = name.replace(/\\/g, '/')
    if (!usedNames.has(normalized)) {
      usedNames.add(normalized)
      return normalized
    }
    const slashIndex = normalized.lastIndexOf('/')
    const directory = slashIndex >= 0 ? normalized.slice(0, slashIndex + 1) : ''
    const fileName = slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized
    const dotIndex = fileName.lastIndexOf('.')
    const base = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
    const ext = dotIndex > 0 ? fileName.slice(dotIndex) : ''
    let index = 1
    let candidate = `${directory}${base}-${index}${ext}`
    while (usedNames.has(candidate)) {
      index += 1
      candidate = `${directory}${base}-${index}${ext}`
    }
    usedNames.add(candidate)
    return candidate
  }

  // 将 dataURL 转为 ZIP 可直接写入的 base64 内容，过滤异常渲染结果以便导出流程报错。
  function getBase64PayloadFromDataUrl(dataUrl: string) {
    const match = /^data:[^;]+;base64,(.*)$/i.exec(dataUrl)
    if (!match) throw new Error('PNG 渲染结果无效')
    return match[1]
  }

  function isBooleanPreviewObject(obj: FabricObject | null | undefined): obj is AnyFabricObject {
    return !!obj && !!(obj as AnyFabricObject).booleanPreview
  }

  function getBooleanPreviewStrokeColor(style: FabricBooleanStyleSnapshot) {
    const candidates = [style.stroke, style.lastStroke, style.fill, style.lastFill]
    for (const candidate of candidates) {
      if (typeof candidate !== 'string') continue
      const normalized = candidate.trim().toLowerCase()
      if (normalized && normalized !== 'none' && normalized !== 'transparent') return candidate
    }
    return getCanvasAssistColors().primary
  }

  function getBooleanPreviewStrokeWidth(style: FabricBooleanStyleSnapshot) {
    const width = Number(style.strokeWidth || 0)
    if (!Number.isFinite(width) || width <= 0) return 2
    return Math.max(2, Math.min(width, 4))
  }

  function getViewportPointForEditablePathPoint(obj: EditablePathObject, point: EditablePoint) {
    return new Point(point.x, point.y)
      .subtract(obj.pathOffset)
      .transform(util.multiplyTransformMatrices(obj.getViewportTransform(), obj.calcTransformMatrix()))
  }

  function getViewportPointForEditablePoint(obj: EditablePathObject, pointIndex: number) {
    return editablePointToLocalObjectPoint(obj, pointIndex).transform(
      util.multiplyTransformMatrices(obj.getViewportTransform(), obj.calcTransformMatrix())
    )
  }

  function lerpEditablePoint(fromPoint: EditablePoint, toPoint: EditablePoint, amount: number): EditablePoint {
    return {
      x: fromPoint.x + (toPoint.x - fromPoint.x) * amount,
      y: fromPoint.y + (toPoint.y - fromPoint.y) * amount
    }
  }

  function getLiveEditableSegment(segmentRef: EditableSegmentRef | null) {
    const liveSegmentRef = getLiveEditableSegmentRef(segmentRef)
    if (!liveSegmentRef) return null
    return liveSegmentRef.segment
  }

  function getEditableSegmentControlPoint(segmentRef: EditableSegmentRef, controlPoint: CurveControlPointKey): EditablePoint {
    const liveSegmentRef = getLiveEditableSegmentRef(segmentRef)
    if (!liveSegmentRef) {
      return controlPoint === 'cp1'
        ? lerpEditablePoint(segmentRef.fromPoint, segmentRef.toPoint, 1 / 3)
        : lerpEditablePoint(segmentRef.fromPoint, segmentRef.toPoint, 2 / 3)
    }
    const liveSegment = liveSegmentRef.segment
    if (liveSegment.type === 'cubic') return liveSegment[controlPoint]
    if (liveSegment[controlPoint]) return liveSegment[controlPoint]
    return controlPoint === 'cp1'
      ? lerpEditablePoint(liveSegmentRef.fromPoint, liveSegmentRef.toPoint, 1 / 3)
      : lerpEditablePoint(liveSegmentRef.fromPoint, liveSegmentRef.toPoint, 2 / 3)
  }

  function resetCurveProps() {
    objProps.curveEnabled = false
    objProps.curveCp1XInput = '0'
    objProps.curveCp1YInput = '0'
    objProps.curveCp2XInput = '0'
    objProps.curveCp2YInput = '0'
  }

  function resetKaleidoscopeProps() {
    objProps.kaleidoscopeEnabled = false
    objProps.kaleidoscopeCenterXInput = '0'
    objProps.kaleidoscopeCenterYInput = '0'
    objProps.kaleidoscopeFollowRotation = false
    objProps.kaleidoscopeCountInput = String(DEFAULT_KALEIDOSCOPE_COUNT)
  }

  function createRadialGradientCenterControl(source: FabricObject) {
    return new Control({
      actionName: 'moveRadialGradientCenter',
      cursorStyle: 'move',
      sizeX: 14,
      sizeY: 14,
      touchSizeX: 20,
      touchSizeY: 20,
      positionHandler: () => {
        const target = getGradientTarget(source)
        if (!target) return new Point(0, 0)
        applyDefaultFillGradientMetadata(target)
        const localPoint = new Point(
          (target.fillGradientCenterX ?? 0.5) * (source.width ?? 0) - (source.width ?? 0) / 2,
          (target.fillGradientCenterY ?? 0.5) * (source.height ?? 0) - (source.height ?? 0) / 2
        )
        return localPoint.transform(util.multiplyTransformMatrices(source.getViewportTransform(), source.calcTransformMatrix()))
      },
      getVisibility: () => (
        activeObject.value === source
        && selectionMode.value === 'shape'
        && objProps.fillEnabled
        && objProps.fillMode === 'gradient'
        && objProps.fillGradientType === 'radial'
      ),
      actionHandler: (_eventData, _transform, x, y) => {
        const target = getGradientTarget(source)
        if (!target || !fabricCanvas) return false
        const local = getPixelGridAdjustedScenePoint(new Point(x, y)).transform(util.invertTransform(source.calcTransformMatrix()))
        const width = Math.max(1, source.width ?? 1)
        const height = Math.max(1, source.height ?? 1)
        target.fillGradientCenterX = Math.min(1, Math.max(0, (local.x + width / 2) / width))
        target.fillGradientCenterY = Math.min(1, Math.max(0, (local.y + height / 2) / height))
        objProps.fillGradientCenterX = target.fillGradientCenterX
        objProps.fillGradientCenterY = target.fillGradientCenterY
        applyGradientFillToTarget(source)
        triggerKaleidoscopeContentSync(source)
        source.canvas?.requestRenderAll()
        return true
      },
      mouseUpHandler: () => {
        snapshot()
        syncObjProps()
        return false
      },
      render: (ctx, left, top) => {
        const colors = getCanvasAssistColors()
        ctx.save()
        ctx.beginPath()
        ctx.arc(left, top, 5, 0, Math.PI * 2)
        ctx.fillStyle = colors.textOnPrimary
        ctx.strokeStyle = colors.primary
        ctx.lineWidth = 2
        ctx.fill()
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(left - 7, top)
        ctx.lineTo(left + 7, top)
        ctx.moveTo(left, top - 7)
        ctx.lineTo(left, top + 7)
        ctx.strokeStyle = colors.primaryStrong
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.restore()
      }
    } as Partial<Control>)
  }

  function formatKaleidoscopeInputValue(value: number) {
    return String(Math.round(value * 100) / 100)
  }

  function createKaleidoscopeCenterControl(source: FabricObject) {
    return new Control({
      actionName: 'moveKaleidoscopeCenter',
      cursorStyle: 'move',
      sizeX: 14,
      sizeY: 14,
      touchSizeX: 20,
      touchSizeY: 20,
      positionHandler: () => {
        const pivot = getKaleidoscopeEffectiveCenter(source)
        return pivot.transform(source.getViewportTransform())
      },
      getVisibility: () => (
        activeKaleidoscopeSource.value === source
        && selectionMode.value === 'shape'
        && objProps.kaleidoscopeEnabled
      ),
      actionHandler: (_eventData, _transform, x, y) => {
        const target = getKaleidoscopeMetadata(source)
        if (!target) return false
        target.kaleidoscopeCenterX = x
        target.kaleidoscopeCenterY = y
        objProps.kaleidoscopeCenterXInput = formatKaleidoscopeInputValue(x)
        objProps.kaleidoscopeCenterYInput = formatKaleidoscopeInputValue(y)
        syncKaleidoscopeTransforms(source)
        source.canvas?.requestRenderAll()
        return true
      },
      mouseUpHandler: () => {
        snapshot()
        syncObjProps()
        return false
      },
      render: (ctx, left, top) => {
        ctx.save()
        ctx.beginPath()
        ctx.arc(left, top, 5, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = '#ff4d4f'
        ctx.lineWidth = 2
        ctx.fill()
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(left - 8, top)
        ctx.lineTo(left + 8, top)
        ctx.moveTo(left, top - 8)
        ctx.lineTo(left, top + 8)
        ctx.strokeStyle = '#ff4d4f'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.restore()
      }
    } as Partial<Control>)
  }

  function attachKaleidoscopeCenterControl(obj: FabricObject | null) {
    restorePointControls()
    if (!obj || selectionMode.value !== 'shape') return
    const controls: FabricControls = cloneCurrentControls(obj)
    if (isKaleidoscopeSource(obj)) {
      controls[KALEIDOSCOPE_CENTER_CONTROL_KEY] = createKaleidoscopeCenterControl(obj)
    }
    if (activeObject.value === obj && objProps.fillEnabled && objProps.fillMode === 'gradient' && objProps.fillGradientType === 'radial') {
      controls[RADIAL_GRADIENT_CENTER_CONTROL_KEY] = createRadialGradientCenterControl(obj)
    }
    installTemporaryControls(obj, controls)
  }

  function setKaleidoscopeCenterValue(axis: 'x' | 'y', value: number) {
    const source = activeKaleidoscopeEditableSource.value
    if (!source || !fabricCanvas) return
    initializeKaleidoscopeSource(source)
    const target = getKaleidoscopeMetadata(source)
    if (!target) return
    if (axis === 'x') target.kaleidoscopeCenterX = value
    else target.kaleidoscopeCenterY = value
    syncKaleidoscopeTransforms(source)
    fabricCanvas.requestRenderAll()
    snapshot()
    syncObjProps()
  }

  function setKaleidoscopeCenterFromInput(axis: 'x' | 'y', value: string | number) {
    const source = activeKaleidoscopeEditableSource.value
    if (!source) return
    initializeKaleidoscopeSource(source)
    const center = getKaleidoscopeEffectiveCenter(source)
    const fallback = axis === 'x' ? center.x : center.y
    commitNumericInput(
      value,
      fallback,
      (next) => { setKaleidoscopeCenterValue(axis, next) },
      (next) => {
        if (axis === 'x') objProps.kaleidoscopeCenterXInput = next
        else objProps.kaleidoscopeCenterYInput = next
      }
    )
  }

  function setKaleidoscopeCountValue(value: number) {
    const source = activeKaleidoscopeEditableSource.value
    if (!source || !fabricCanvas) return
    initializeKaleidoscopeSource(source)
    const target = getKaleidoscopeMetadata(source)
    if (!target) return
    target.kaleidoscopeCount = normalizeKaleidoscopeCount(value)
    objProps.kaleidoscopeCountInput = String(target.kaleidoscopeCount)
    triggerKaleidoscopeRebuild(source)
    snapshot()
    syncObjProps()
  }

  function setKaleidoscopeCountFromInput(value: string | number) {
    const source = activeKaleidoscopeEditableSource.value
    if (!source) return
    commitNumericInput(
      value,
      getKaleidoscopeCount(source),
      (next) => { setKaleidoscopeCountValue(next) },
      (next) => { objProps.kaleidoscopeCountInput = String(normalizeKaleidoscopeCount(next)) }
    )
  }

  function setKaleidoscopeEnabled(enabled: boolean) {
    const source = activeKaleidoscopeEditableSource.value
    if (!source || !fabricCanvas) return
    initializeKaleidoscopeSource(source)
    const target = getKaleidoscopeMetadata(source)
    if (!target) return
    target.kaleidoscopeEnabled = enabled
    objProps.kaleidoscopeEnabled = enabled
    if (!enabled) {
      removeKaleidoscopeInstancesBySourceId(ensureKaleidoscopeSourceId(source))
      fabricCanvas.requestRenderAll()
      refreshLayers()
    } else {
      triggerKaleidoscopeRebuild(source)
    }
    updateCurveControls()
    snapshot()
    syncObjProps()
  }

  function setKaleidoscopeFollowRotation(enabled: boolean) {
    const source = activeKaleidoscopeEditableSource.value
    if (!source || !fabricCanvas) return
    initializeKaleidoscopeSource(source)
    const target = getKaleidoscopeMetadata(source)
    if (!target) return
    target.kaleidoscopeFollowRotation = enabled
    objProps.kaleidoscopeFollowRotation = enabled
    syncKaleidoscopeTransforms(source)
    snapshot()
    syncObjProps()
  }


  function selectKaleidoscopeSourceFromInstance() {
    const source = activeKaleidoscopeInstanceSource.value
    if (!source) return
    applyActiveObjectsSelection([source])
  }

  function detachKaleidoscopeInstance() {
    const instance = activeKaleidoscopeInstance.value
    if (!instance || !fabricCanvas) return
    clearBooleanPreview()
    withSnapshotSuppressed(() => {
      clearKaleidoscopeMetadata(instance)
      setKaleidoscopeInstanceManagedState(instance, false)
      instance.setCoords()
    })
    fabricCanvas.requestRenderAll()
    refreshLayers()
    refreshActiveObject()
    snapshot()
    syncObjProps()
  }
  // 将场景坐标转换为路径本地坐标，不经过网格吸附；用于命中测试等只读判断。
  function getRawLocalPointFromCanvas(obj: EditablePathObject, x: number, y: number) {
    return new Point(x, y)
      .transform(util.invertTransform(obj.calcOwnMatrix()))
      .add(obj.pathOffset)
  }

  // 将编辑拖拽坐标转换为路径本地坐标；启用吸附时先按场景网格对齐，再写回点位模型。
  function getLocalPointFromCanvas(obj: EditablePathObject, x: number, y: number) {
    return getPixelGridAdjustedScenePoint(new Point(x, y))
      .transform(util.invertTransform(obj.calcOwnMatrix()))
      .add(obj.pathOffset)
  }

  function canEditPoints(editable: EditablePathObject) {
    return activeEditablePathObject.value === editable && selectionMode.value === 'point'
  }

  function canEditSegments(editable: EditablePathObject) {
    return activeEditablePathObject.value === editable
      && selectionMode.value === 'segment'
      && getArrowRenderMode(editable) !== 'hollow-shaft'
  }

  function getViewportPointForLocalEditablePoint(obj: EditablePathObject, point: EditablePoint) {
    return getViewportPointForEditablePathPoint(obj, point)
  }

  function createSegmentSelectControl(editable: EditablePathObject, segmentRef: EditableSegmentRef) {
    const segmentKey = `${segmentRef.contourIndex}:${segmentRef.segmentIndex}`
    return new Control({
      actionName: 'selectEditableSegment',
      cursorStyle: 'pointer',
      sizeX: 12,
      sizeY: 12,
      touchSizeX: 22,
      touchSizeY: 22,
      segmentKey,
      positionHandler: () => {
        const liveSegmentRef = resolveEditableSegmentRef(editable, segmentRef)
        if (!liveSegmentRef) return new Point(0, 0)
        return getViewportPointForLocalEditablePoint(editable, getEditableSegmentMidpoint(liveSegmentRef))
      },
      getVisibility: () => {
        if (!canEditSegments(editable)) return false
        // 隐藏当前已选中边的中点辅助器，由 cp1/cp2 等控件接管
        if (isSameEditableSegmentRef(selectedSegmentRef.value, segmentRef)) return false
        return !!resolveEditableSegmentRef(editable, segmentRef)
      },
      mouseDownHandler: () => {
        if (!canEditSegments(editable)) return false
        const liveSegmentRef = resolveEditableSegmentRef(editable, segmentRef)
        if (!liveSegmentRef) return false
        setSelectedEditableSegment(editable, liveSegmentRef)
        return false
      },
      render: (ctx, left, top) => {
        const isSelected = isSameEditableSegmentRef(selectedSegmentRef.value, segmentRef)
        const size = isSelected ? 6 : 5
        const colors = getCanvasAssistColors()
        ctx.save()
        ctx.beginPath()
        ctx.rect(left - size, top - size, size * 2, size * 2)
        ctx.fillStyle = isSelected ? colors.primary : colors.textOnPrimary
        ctx.strokeStyle = colors.primary
        ctx.lineWidth = 1.5
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      }
    } as Partial<Control> & { segmentKey: string })
  }

  function createCurveHandleControl(editable: EditablePathObject, controlPoint: CurveControlPointKey) {
    return new Control({
      actionName: 'modifyEditableCurve',
      cursorStyle: 'crosshair',
      sizeX: 10,
      sizeY: 10,
      touchSizeX: 18,
      touchSizeY: 18,
      pointIndex: controlPoint,
      positionHandler: () => {
        const segmentRef = selectedEditableSegment.value
        if (!segmentRef) return new Point(0, 0)
        return getViewportPointForEditablePathPoint(editable, getEditableSegmentControlPoint(segmentRef, controlPoint))
      },
      getVisibility: () => canEditSegments(editable) && !!getLiveEditableSegment(selectedEditableSegment.value),
      actionHandler: (_eventData, _transform, x, y) => {
        if (!canEditSegments(editable)) return false
        const segmentRef = selectedEditableSegment.value
        if (!segmentRef) return false
        setEditableSegmentControlPoint(editable, segmentRef, controlPoint, getLocalPointFromCanvas(editable, x, y))
        triggerKaleidoscopeContentSync(editable)
        // 拖动过程中保持 segmentRef 与最新模型同步
        const liveSegmentRef = resolveEditableSegmentRef(editable, segmentRef)
        if (liveSegmentRef) selectedSegmentRef.value = liveSegmentRef
        syncObjProps()
        fabricCanvas?.requestRenderAll()
        return true
      },
      mouseUpHandler: () => {
        snapshot()
        return false
      },
      render: (ctx, left, top) => {
        const segmentRef = selectedEditableSegment.value
        const liveSegmentRef = getLiveEditableSegmentRef(segmentRef)
        if (!liveSegmentRef) return
        const colors = getCanvasAssistColors()
        const anchorPoint = controlPoint === 'cp1' ? liveSegmentRef.fromPoint : liveSegmentRef.toPoint
        const anchorViewportPoint = getViewportPointForEditablePathPoint(editable, anchorPoint)
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(anchorViewportPoint.x, anchorViewportPoint.y)
        ctx.lineTo(left, top)
        ctx.strokeStyle = colors.primaryStrong
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(left, top, 4, 0, Math.PI * 2)
        ctx.fillStyle = colors.textOnPrimary
        ctx.strokeStyle = colors.primary
        ctx.lineWidth = 2
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      }
    } as Partial<Control> & { pointIndex: CurveControlPointKey })
  }

  function setSelectedDirectSegmentEditablePoints(obj: EditablePathObject, indices: number[]) {
    const segment = getSpecialDirectEditSegment(obj)
    if (!segment) return
    selectedSegmentRef.value = segment
    selectedPointIndices.value = normalizeSelectedPointIndices(obj, indices)
    syncObjProps()
    obj.canvas?.requestRenderAll()
  }

  function selectDirectSegmentEditablePoint(obj: EditablePathObject, pointIndex: number, multi = false) {
    const next = multi
      ? selectedPointIndices.value.includes(pointIndex)
        ? selectedPointIndices.value.filter((index) => index !== pointIndex)
        : [...selectedPointIndices.value, pointIndex]
      : [pointIndex]
    setSelectedDirectSegmentEditablePoints(obj, next)
  }

  function canEditDirectSegmentPoints(editable: EditablePathObject) {
    return canEditSegments(editable) && !!getSpecialDirectEditSegment(editable)
  }

  // 将选中点整体移动到网格对齐后的锚点，保持多点相对形状并同步清理旧端点吸附关系。
  function moveEditablePointsWithPixelGridSnap(editable: EditablePathObject, indices: number[], anchorIndex: number, scenePoint: Point) {
    moveEditablePoints(editable, indices, anchorIndex, getEditableLocalPointFromScene(editable, getPixelGridAdjustedScenePoint(scenePoint)))
    clearEndpointAttachmentsForPoints(editable, indices)
  }

  function createDirectSegmentPointControl(editable: EditablePathObject, index: number) {
    return new Control({
      actionName: 'modifyEditablePath',
      cursorStyle: 'crosshair',
      sizeX: 10,
      sizeY: 10,
      touchSizeX: 18,
      touchSizeY: 18,
      pointIndex: index,
      positionHandler: () => getViewportPointForEditablePoint(editable, index),
      getVisibility: () => canEditDirectSegmentPoints(editable),
      mouseDownHandler: (eventData) => {
        if (!canEditDirectSegmentPoints(editable)) return false
        selectDirectSegmentEditablePoint(editable, index, isMultiSelectModifierPressed(eventData as MouseEvent))
        return false
      },
      actionHandler: (_eventData, _transform, x, y) => {
        if (!canEditDirectSegmentPoints(editable)) return false
        const indices = normalizeSelectedPointIndices(editable, selectedPointIndices.value)
        const moveIndices = indices.includes(index) ? indices : [index]
        const scenePoint = new Point(x, y)
        if (moveIndices.length > 1) {
          moveEditablePointsWithPixelGridSnap(editable, moveIndices, index, scenePoint)
        } else {
          moveEndpointWithSnap(editable, index, scenePoint)
        }
        const segment = getSpecialDirectEditSegment(editable)
        if (segment) selectedSegmentRef.value = segment
        syncObjProps()
        triggerKaleidoscopeContentSync(editable)
        fabricCanvas?.requestRenderAll()
        return true
      },
      mouseUpHandler: () => {
        snapshot()
        return false
      },
      render: renderPointControl
    } as Partial<Control> & { pointIndex: number })
  }

  function attachPointControls(obj: FabricObject | null) {
    restorePointControls()
    if (!obj || !isEditablePathObject(obj) || getSelectableEditablePoints(obj).length === 0) return
    if (selectionMode.value === 'shape') return
    const editable = obj
    const showPointControlsInSegmentMode = selectionMode.value === 'segment' && !!getSpecialDirectEditSegment(editable)
    const controls: FabricControls = cloneCurrentControls(editable)
    const hideTransformControls = shouldHideTransformControlsInEditMode(editable)
    if (hideTransformControls) {
      hideFabricTransformControls(controls)
    }
    // 边选择模式下，不展示选点的辅助点，仅展示每条边的中点辅助器，方便直接点击边来选中
    if (selectionMode.value === 'segment') {
      getEditableSegments(editable).forEach((segmentRef) => {
        const key = `es${segmentRef.contourIndex}_${segmentRef.segmentIndex}`
        controls[key] = createSegmentSelectControl(editable, segmentRef)
      })
      if (showPointControlsInSegmentMode) {
        getSelectableEditablePoints(editable).forEach(({ index }) => {
          controls[`ep${index}`] = createDirectSegmentPointControl(editable, index)
        })
      }
    }
    else {
      getSelectableEditablePoints(editable).forEach(({ index }) => {
        controls[`ep${index}`] = new Control({
          actionName: 'modifyEditablePath',
          cursorStyle: 'crosshair',
          sizeX: 10,
          sizeY: 10,
          touchSizeX: 18,
          touchSizeY: 18,
          pointIndex: index,
          positionHandler: () => getViewportPointForEditablePoint(editable, index),
          mouseDownHandler: (eventData) => {
            if (!canEditPoints(editable)) return false
            beginPointControlGesture(editable, index, eventData as MouseEvent)
            return false
          },
          actionHandler: (_eventData, _transform, x, y) => {
            if (!canEditPoints(editable)) return false
            // 修饰键起拖：始终交给 mouse:move 切到 box-select；不做任何点位移动
            if (pointGestureState.modifierAtStart) {
              return true
            }
            // box-select 进行中：不移动点
            if (pointGestureState.kind === 'box-select') {
              return true
            }
            // 整组拖拽
            if (pointGestureState.kind === 'group-drag') {
              const indices = pointGestureState.initialSelection.length
                ? pointGestureState.initialSelection
                : [index]
              const scenePoint = new Point(x, y)
              moveEditablePointsWithPixelGridSnap(editable, indices, index, scenePoint)
              updateCurveControls()
              syncObjProps()
              triggerKaleidoscopeContentSync(editable)
              return true
            }
            // 单点拖拽
            if (pointGestureState.kind === 'single-drag') {
              moveEndpointWithSnap(editable, index, new Point(x, y))
              updateCurveControls()
              syncObjProps()
              triggerKaleidoscopeContentSync(editable)
              return true
            }
            // 仍处在 pending：等 mouse:move 越过阈值后决议手势类型
            return true
          },
          mouseUpHandler: () => {
            // 拖拽类手势完成后 snapshot；最终的选点决议由 mouse:up 全局回调统一处理
            if (
              pointGestureState.kind === 'single-drag'
              || pointGestureState.kind === 'group-drag'
            ) {
              snapshot()
            }
            return false
          },
          render: renderPointControl
        } as Partial<Control> & { pointIndex: number })
      })
    }
    controls.curveCp1 = createCurveHandleControl(editable, 'cp1')
    controls.curveCp2 = createCurveHandleControl(editable, 'cp2')
    installTemporaryControls(editable, controls, { hideBorders: hideTransformControls })
  }

  function applyBooleanPreviewStyle(preview: FabricObject, kind: 'kept' | 'removed', style: FabricBooleanStyleSnapshot) {
    const strokeWidth = getBooleanPreviewStrokeWidth(style)
    const stroke = getBooleanPreviewStrokeColor(style)
    preview.set({
      fill: 'transparent',
      stroke,
      strokeWidth,
      strokeDashArray: kind === 'removed' ? [strokeWidth * 3, strokeWidth * 2] : null,
      opacity: 1,
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false
    })
    ;(preview as AnyFabricObject).booleanPreview = true
  }

  function restoreBooleanPreviewSourceObjects() {
    const hiddenObjects = booleanPreviewHiddenObjects.value
    booleanPreviewHiddenObjects.value = []
    hiddenObjects.forEach(({ object, visible }) => {
      object.set('visible', visible)
      object.setCoords()
    })
    return hiddenObjects.length > 0
  }

  function hideBooleanPreviewSourceObjects(objects: FabricObject[]) {
    restoreBooleanPreviewSourceObjects()
    const uniqueObjects = Array.from(new Set(objects))
    booleanPreviewHiddenObjects.value = uniqueObjects.map((object) => ({
      object,
      visible: object.visible !== false
    }))
    uniqueObjects.forEach((object) => {
      object.set('visible', false)
      object.setCoords()
    })
  }

  function nextBooleanPreviewToken() {
    booleanPreviewToken += 1
    return booleanPreviewToken
  }

  function handleSubtractPopoverShowChange(show: boolean) {
    subtractPopoverVisible.value = show
    if (!show) clearBooleanPreview()
  }

  function clearBooleanPreview(invalidate: boolean | Event = true) {
    const shouldInvalidate = typeof invalidate === 'boolean' ? invalidate : true
    if (shouldInvalidate) nextBooleanPreviewToken()
    const previews = booleanPreviewObjects.value
    const restoredSources = restoreBooleanPreviewSourceObjects()
    booleanPreviewObjects.value = []
    if (!fabricCanvas) return
    previews.forEach((preview) => {
      if (fabricCanvas.getObjects().includes(preview)) {
        fabricCanvas.remove(preview as AnyFabricObject)
      }
    })
    if (previews.length || restoredSources) {
      fabricCanvas.requestRenderAll()
    }
  }

  async function showBooleanPreview(operation: BooleanOperation, subtractDirection: SubtractDirection = 'forward') {
    if (!fabricCanvas || !canBoolean.value || booleanBusy.value) {
      clearBooleanPreview()
      return
    }

    const token = nextBooleanPreviewToken()
    const objects = fabricCanvas.getActiveObjects()
    const { result: computed, error } = await computeBooleanResult({
      canvas: fabricCanvas,
      operation,
      objects,
      subtractDirection,
      includePreviewRemovedPath: true
    })
    if (token !== booleanPreviewToken) {
      computed?.removedPath?.delete()
      computed?.path.delete()
      return
    }
    if (error || !computed) {
      clearBooleanPreview(false)
      return
    }

    try {
      const previews: FabricObject[] = []
      if (computed.removedPath) {
        const removedPreview = pathKitToFabricPath(computed.removedPath, {
          style: computed.style,
          preview: true
        })
        if (removedPreview) {
          applyBooleanPreviewStyle(removedPreview, 'removed', computed.style)
          previews.push(removedPreview)
        }
      }

      const keptPreview = pathKitToFabricPath(computed.path, {
        style: computed.style,
        preview: true
      })
      if (keptPreview) {
        applyBooleanPreviewStyle(keptPreview, 'kept', computed.style)
        previews.push(keptPreview)
      }

      if (token !== booleanPreviewToken) return
      clearBooleanPreview(false)
      if (!previews.length || !fabricCanvas) return
      hideBooleanPreviewSourceObjects(objects)
      previews.forEach((preview) => fabricCanvas.add(preview as AnyFabricObject))
      booleanPreviewObjects.value = previews
      fabricCanvas.requestRenderAll()
    } finally {
      computed.removedPath?.delete()
      computed.path.delete()
    }
  }

  function serializeFabricCanvas() {
    ensureCanvasObjectMetadata()
    return (fabricCanvas as any).toObject(SERIALIZED_OBJECT_PROPS as unknown as string[]) as Record<string, unknown>
  }

  function applyProjectLayerOrder(layerOrder: string[]) {
    if (!fabricCanvas || !layerOrder.length) return
    const orderMap = new Map(layerOrder.map((id, index) => [id, index]))
    const objects = fabricCanvas.getObjects().filter((obj) => !isBooleanPreviewObject(obj))
    const fallbackIndexMap = new Map(objects.map((obj, index) => [obj, index]))
    const sorted = [...objects].sort((a, b) => {
      const aId = String((a as AnyFabricObject).editorObjectId || '')
      const bId = String((b as AnyFabricObject).editorObjectId || '')
      const aOrder = orderMap.get(aId) ?? Number.MAX_SAFE_INTEGER
      const bOrder = orderMap.get(bId) ?? Number.MAX_SAFE_INTEGER
      if (aOrder !== bOrder) return aOrder - bOrder
      return (fallbackIndexMap.get(a) ?? 0) - (fallbackIndexMap.get(b) ?? 0)
    })
    sorted.forEach((obj, index) => fabricCanvas!.moveObjectTo(obj as AnyFabricObject, index))
  }

  // ── 对象样式辅助 ──
  function getStyleTargets(obj: FabricObject) {
    return obj instanceof Group ? obj.getObjects() : [obj]
  }

  function getSelectedPointRadiusState(obj: EditablePathObject) {
    const indices = normalizeSelectedPointIndices(obj, selectedPointIndices.value)
    if (!indices.length) {
      return { hasSelection: false, mixed: false, value: 0 }
    }
    const value = getPointRadius(obj, indices[0])
    const mixed = indices.some((index) => Math.abs(getPointRadius(obj, index) - value) > 0.0001)
    return { hasSelection: true, mixed, value }
  }

  // 预览浮层展开时立即刷新过期缩略图；关闭后保留 dirty 标记，等下次查看时再补齐。
  watch(previewPopoverVisible, (show) => {
    if (show && previewDirty.value) refreshSmallPreviews()
  })

  // 保留多对象选择结果，让图层面板可以批量选中万花筒实例后执行脱离、隐藏、锁定等操作。
  function applyActiveObjectsSelection(objects: FabricObject[], event?: MouseEvent) {
    if (!fabricCanvas) return
    const uniqueObjects = Array.from(new Set(objects))
      .filter((obj) => fabricCanvas!.getObjects().includes(obj))
    if (!uniqueObjects.length) {
      fabricCanvas.discardActiveObject(event)
      syncActiveObject(null)
      fabricCanvas.requestRenderAll()
      return
    }

    if (uniqueObjects.length === 1) {
      fabricCanvas.setActiveObject(uniqueObjects[0], event)
      syncActiveObject(fabricCanvas.getActiveObject() ?? uniqueObjects[0])
      fabricCanvas.requestRenderAll()
      return
    }
    const orderedObjects = fabricCanvas.getObjects().filter((obj) => uniqueObjects.includes(obj))
    const selection = new ActiveSelection(orderedObjects, { canvas: fabricCanvas })
    fabricCanvas.setActiveObject(selection, event)
    syncActiveObject(fabricCanvas.getActiveObject() ?? selection)
    fabricCanvas.requestRenderAll()
  }

  function isFillEnabled(fill: unknown) {
    if (fill == null) return false
    if (typeof fill !== 'string') return true
    const normalized = fill.trim().toLowerCase()
    return normalized !== '' && normalized !== 'none' && normalized !== 'transparent'
  }

  function isGradientFill(value: unknown): value is Gradient<Record<string, unknown>> {
    return value instanceof Gradient
  }

  function getGradientTarget(obj: FabricObject | null | undefined) {
    return obj ? (obj as AnyFabricObject) : null
  }

  function getGradientFillMode(obj: FabricObject | null | undefined): FillModeOption {
    const target = getGradientTarget(obj)
    if (!target) return 'solid'
    applyDefaultFillGradientMetadata(target)
    return target.fillMode === 'gradient' ? 'gradient' : 'solid'
  }

  function applyGradientFillToTarget(target: FabricObject | null | undefined) {
    const typedTarget = getGradientTarget(target)
    if (!typedTarget) return false
    applyDefaultFillGradientMetadata(typedTarget)
    if (typedTarget.fillMode === 'gradient') {
      const gradient = createGradientFromMetadata(typedTarget)
      typedTarget.set('fill', gradient)
      return true
    }
    const solid = typeof typedTarget.lastFill === 'string' && typedTarget.lastFill.trim()
      ? typedTarget.lastFill
      : objProps.fill || '#000000'
    typedTarget.set('fill', solid)
    return false
  }

  function syncGradientPropsFromObject(obj: FabricObject | null | undefined) {
    const target = getGradientTarget(obj)
    if (!target) return
    applyDefaultFillGradientMetadata(target)
    objProps.fillMode = target.fillMode === 'gradient' ? 'gradient' : 'solid'
    objProps.fillGradientType = target.fillGradientType ?? DEFAULT_FILL_GRADIENT_TYPE
    objProps.fillGradientAngle = Number(target.fillGradientAngle ?? DEFAULT_FILL_GRADIENT_ANGLE) || DEFAULT_FILL_GRADIENT_ANGLE
    objProps.fillGradientAngleInput = formatNumericInputValue(objProps.fillGradientAngle)
    objProps.fillGradientStops = decorateGradientStops(target.fillGradientStops ?? [], objProps.fillGradientStops as UiFillGradientStop[])
    objProps.fillGradientCenterX = Number(target.fillGradientCenterX ?? 0.5) || 0.5
    objProps.fillGradientCenterY = Number(target.fillGradientCenterY ?? 0.5) || 0.5
    objProps.fillGradientRadius = Number(target.fillGradientRadius ?? DEFAULT_FILL_GRADIENT_RADIUS) || DEFAULT_FILL_GRADIENT_RADIUS
  }

  function rebuildObjectGradientFill(target: FabricObject | null | undefined) {
    if (!target) return
    if (target instanceof Group || target instanceof ActiveSelection) {
      target.getObjects().forEach((child) => rebuildObjectGradientFill(child))
      target.setCoords()
      return
    }
    if (getGradientFillMode(target) !== 'gradient') return
    applyGradientFillToTarget(target)
    target.dirty = true
    target.setCoords()
  }

  function applyGradientMetadataToCanvasObject(target: FabricObject | null | undefined) {
    if (!target) return
    applyDefaultFillGradientMetadata(target)
    rebuildObjectGradientFill(target)
  }

  function rehydrateCanvasGradientFills() {
    if (!fabricCanvas) return
    fabricCanvas.getObjects().forEach((obj) => applyGradientMetadataToCanvasObject(obj))
  }

  function isStrokeEnabled(stroke: unknown, strokeWidth: unknown) {
    if (stroke == null) return false
    if (typeof stroke === 'string') {
      const normalized = stroke.trim().toLowerCase()
      if (normalized === '' || normalized === 'none' || normalized === 'transparent') return false
    }
    return Number(strokeWidth ?? 0) > 0
  }

  function getObjectAspectRatio(obj: FabricObject) {
    const height = obj.getScaledHeight()
    const width = obj.getScaledWidth()
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 1
    return width / height
  }

  /**
   * 将对象当前的宽高比例锁定状态同步到运行时与 Fabric 交互配置。
   * 这样无论对象来自新建、导入还是剪贴板恢复，属性面板与拖拽缩放都会基于对象自身状态保持一致。
   */
  function syncSizeRatioLockFromObject(obj: FabricObject | null | undefined) {
    const locked = isObjectSizeRatioLocked(obj)
    sizeRatioLocked.value = locked
    lockedAspectRatio.value = obj && locked ? getObjectAspectRatio(obj) : 1
    syncCanvasInteractionMode()
  }

  function collectAligningObjectsFromGroup(group: Group, objects: Set<FabricObject>, excludedObjects: Set<FabricObject>) {
    group.getObjects().forEach((child) => {
      if (excludedObjects.has(child) || child.visible === false || isBooleanPreviewObject(child)) return
      if (child instanceof Group) {
        collectAligningObjectsFromGroup(child, objects, excludedObjects)
        return
      }
      objects.add(child)
    })
  }

  function getAligningObjectsByTarget(target: FabricObject) {
    const objects = new Set<FabricObject>()
    const canvas = target.canvas
    if (!canvas) return objects

    const excludedObjects = new Set<FabricObject>(canvas.getActiveObjects())
    excludedObjects.add(target)
    if (target instanceof ActiveSelection) {
      target.getObjects().forEach((obj) => excludedObjects.add(obj))
    }

    canvas.forEachObject((obj) => {
      if (obj.visible === false || !obj.isOnScreen() || excludedObjects.has(obj) || isBooleanPreviewObject(obj)) return
      if (obj instanceof Group) {
        collectAligningObjectsFromGroup(obj, objects, excludedObjects)
        return
      }
      objects.add(obj)
    })

    return objects
  }

  function scaleObjectToDisplaySize(obj: FabricObject, width: number, height: number) {
    const currentWidth = obj.getScaledWidth()
    const currentHeight = obj.getScaledHeight()
    if (currentWidth > 0) obj.set('scaleX', (obj.scaleX ?? 1) * (width / currentWidth))
    if (currentHeight > 0) obj.set('scaleY', (obj.scaleY ?? 1) * (height / currentHeight))
  }

  function toggleSizeRatioLock() {
    const obj = activeObject.value
    const nextLocked = !sizeRatioLocked.value
    sizeRatioLocked.value = nextLocked
    if (obj) {
      markObjectSizeRatioLocked(obj, nextLocked)
      lockedAspectRatio.value = nextLocked ? getObjectAspectRatio(obj) : 1
    } else if (!nextLocked) {
      lockedAspectRatio.value = 1
    }
    syncCanvasInteractionMode()
  }

  // ── 同步选中对象属性 ──
  function getSegmentPickTolerance(obj: EditablePathObject) {
    const scaling = obj.getTotalObjectScaling()
    const maxScale = Math.max(Math.abs(scaling.x), Math.abs(scaling.y), 1)
    return 10 / maxScale
  }

  function handleSegmentPointerDown(sceneX: number, sceneY: number) {
    const obj = activeEditablePathObject.value
    if (!obj || selectionMode.value !== 'segment' || getArrowRenderMode(obj) === 'hollow-shaft') return false
    const segmentRef = getEditableSegmentByLocalPoint(
      obj,
      getRawLocalPointFromCanvas(obj, sceneX, sceneY),
      getSegmentPickTolerance(obj)
    )
    if (!segmentRef) return false
    setSelectedEditableSegment(obj, segmentRef)
    updateCurveControls()
    return true
  }

  function syncObjProps() {
    const obj = activeObject.value
    if (!obj) return
    applyDefaultKaleidoscopeMetadata(obj)
    objProps.left = obj.left ?? 0
    objProps.top = obj.top ?? 0
    objProps.leftInput = formatNumericInputValue(objProps.left)
    objProps.topInput = formatNumericInputValue(objProps.top)
    objProps.width = obj.getScaledWidth()
    objProps.height = obj.getScaledHeight()
    objProps.widthInput = formatNumericInputValue(objProps.width)
    objProps.heightInput = formatNumericInputValue(objProps.height)
    objProps.scaleX = obj.scaleX ?? 1
    objProps.scaleY = obj.scaleY ?? 1
    objProps.angle = obj.angle ?? 0
    objProps.opacity = obj.opacity ?? 1
    objProps.endpointSnapMargin = getObjectEndpointSnapMargin(obj)
    objProps.endpointSnapMarginInput = formatNumericInputValue(objProps.endpointSnapMargin)

    const panelSource = activeKaleidoscopePanelSource.value
    if (panelSource) {
      initializeKaleidoscopeSource(panelSource)
      const center = getKaleidoscopeEffectiveCenter(panelSource)
      objProps.kaleidoscopeEnabled = getKaleidoscopeMetadata(panelSource)?.kaleidoscopeEnabled === true
      objProps.kaleidoscopeCenterXInput = formatKaleidoscopeInputValue(center.x)
      objProps.kaleidoscopeCenterYInput = formatKaleidoscopeInputValue(center.y)
      objProps.kaleidoscopeFollowRotation = getKaleidoscopeMetadata(panelSource)?.kaleidoscopeFollowRotation === true
      objProps.kaleidoscopeCountInput = String(getKaleidoscopeCount(panelSource))
    } else {
      resetKaleidoscopeProps()
    }

    const targets = getStyleTargets(obj)
    const first = targets[0]
    const fill = first?.fill
    const enabled = isFillEnabled(fill)
    objProps.fillEnabled = enabled
    objProps.fill = enabled && typeof fill === 'string'
      ? fill
      : typeof (first as AnyFabricObject | undefined)?.lastFill === 'string'
        ? (first as AnyFabricObject).lastFill
        : '#000000'
    syncGradientPropsFromObject(first)
    objProps.stroke = first && typeof first.stroke === 'string'
      ? first.stroke
      : typeof (first as AnyFabricObject | undefined)?.lastStroke === 'string'
        ? (first as AnyFabricObject).lastStroke
        : '#333333'
    objProps.strokeWidth = first?.strokeWidth ?? (first as AnyFabricObject | undefined)?.lastStrokeWidth ?? 0
    objProps.strokeWidthInput = formatNumericInputValue(objProps.strokeWidth)
    objProps.strokeEnabled = isStrokeEnabled(first?.stroke, first?.strokeWidth)
    const currentStrokeDashArray = normalizeStrokeDashArray(first?.strokeDashArray)
    const rememberedStrokeDashArray = getStrokeDashPair(first)
    objProps.strokeLineType = currentStrokeDashArray ? 'dashed' : 'solid'
    objProps.strokeDashLength = rememberedStrokeDashArray[0]
    objProps.strokeDashGap = rememberedStrokeDashArray[1]
    objProps.strokeDashLengthInput = String(rememberedStrokeDashArray[0])
    objProps.strokeDashGapInput = String(rememberedStrokeDashArray[1])

    if (isEditablePathObject(obj)) {
      if (selectionMode.value === 'shape') {
        clearEditableAssistSelection()
      } else if (selectionMode.value === 'point') {
        clearSelectedSegment()
      } else if (!getSpecialDirectEditSegment(obj)) {
        clearSelectedPoint()
      }
      objProps.cornerRadius = obj.cornerRadius ?? 0
      const pointRadiusState = getSelectedPointRadiusState(obj)
      objProps.pointCornerRadius = pointRadiusState.value
      objProps.cornerRadiusInput = String(Math.round(objProps.cornerRadius))
      objProps.pointCornerRadiusInput = pointRadiusState.hasSelection
        ? pointRadiusState.mixed
          ? ''
          : String(Math.round(pointRadiusState.value))
        : '0'

      const arrowLength = arrowAggregated.value.length
      objProps.arrowLengthInput = arrowLength == null
        ? ''
        : String(Math.round(arrowLength))
      objProps.arrowLineWidth = isHollowShaftArrow.value ? getHollowShaftArrowLineWidth(obj) : 0
      objProps.arrowLineWidthInput = isHollowShaftArrow.value
        ? formatNumericInputValue(objProps.arrowLineWidth)
        : '0'
      objProps.arrowTipAngle = isHollowShaftArrow.value ? getHollowShaftArrowTipAngle(obj) : 0
      objProps.arrowSideAngle = isHollowShaftArrow.value ? getHollowShaftArrowSideAngle(obj) : 0
      objProps.arrowTipAngleInput = isHollowShaftArrow.value ? formatNumericInputValue(objProps.arrowTipAngle) : '0'
      objProps.arrowSideAngleInput = isHollowShaftArrow.value ? formatNumericInputValue(objProps.arrowSideAngle) : '0'

      const segmentRef = isHollowShaftArrow.value ? null : selectedEditableSegment.value
      const segment = getLiveEditableSegment(segmentRef)
      objProps.curveEnabled = !isHollowShaftArrow.value && segment?.type === 'cubic'
      if (segmentRef && segment) {
        const cp1 = getEditableSegmentControlPoint(segmentRef, 'cp1')
        const cp2 = getEditableSegmentControlPoint(segmentRef, 'cp2')
        objProps.curveCp1XInput = formatNumericInputValue(cp1.x)
        objProps.curveCp1YInput = formatNumericInputValue(cp1.y)
        objProps.curveCp2XInput = formatNumericInputValue(cp2.x)
        objProps.curveCp2YInput = formatNumericInputValue(cp2.y)
      } else {
        resetCurveProps()
      }
    } else {
      objProps.cornerRadius = 0
      objProps.pointCornerRadius = 0
      objProps.arrowLineWidth = 0
      objProps.arrowTipAngle = 0
      objProps.arrowSideAngle = 0
      objProps.cornerRadiusInput = '0'
      objProps.pointCornerRadiusInput = '0'
      objProps.arrowLengthInput = '16'
      objProps.arrowLineWidthInput = '0'
      objProps.arrowTipAngleInput = '0'
      objProps.arrowSideAngleInput = '0'
      resetCurveProps()
    }
  }

  // ── 属性设置 ──
  function setObjProp(prop: string, value: any) {
    const obj = activeObject.value
    if (!obj || !fabricCanvas) return
    if (prop === 'fill') {
      getStyleTargets(obj).forEach((target) => {
        const typedTarget = target as AnyFabricObject
        typedTarget.fillMode = 'solid'
        typedTarget.lastFill = value
        target.set('fill', value)
        target.dirty = true
        target.setCoords()
      })
      objProps.fillEnabled = true
      objProps.fillMode = 'solid'
    } else if (prop === 'stroke') {
      getStyleTargets(obj).forEach((target) => {
        ;(target as AnyFabricObject).lastStroke = value
        target.set('stroke', value)
        target.dirty = true
        target.setCoords()
      })
      objProps.strokeEnabled = true
    } else if (prop === 'strokeWidth') {
      getStyleTargets(obj).forEach((target) => {
        const typedTarget = target as AnyFabricObject
        typedTarget.lastStrokeWidth = value
        target.set('strokeWidth', value)
        typedTarget.lastStrokeDashArray = normalizeStrokeDashArray(typedTarget.lastStrokeDashArray)
          ?? getDefaultStrokeDashArray(value)
        target.dirty = true
        target.setCoords()
      })
      objProps.strokeEnabled = Number(value) > 0
      objProps.strokeWidthInput = formatNumericInputValue(Number(value) || 0)
    } else {
      obj.set(prop as any, value)
    }
    if (obj instanceof Group && (prop === 'fill' || prop === 'stroke' || prop === 'strokeWidth')) {
      obj.triggerLayout()
    }
    if (prop === 'left' || prop === 'top' || prop === 'angle') {
      clearOwnedEndpointAttachmentsForTransformedObject(obj)
    }
    obj.dirty = true
    obj.setCoords()
    syncEndpointsForChangedObject(obj)
    if (prop === 'fill' || prop === 'stroke' || prop === 'strokeWidth' || prop === 'opacity') {
      triggerKaleidoscopeContentSync(obj)
    } else {
      triggerKaleidoscopeTransformSync(obj)
    }
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  // 将对象位置输入提交为数值，非法输入回退到当前坐标
  function setObjPropFromInput(prop: 'left' | 'top', value: string | number) {
    const fallback = prop === 'left' ? objProps.left : objProps.top
    commitNumericInput(
      value,
      fallback,
      (next) => { setObjProp(prop, next) },
      (next) => {
        if (prop === 'left') objProps.leftInput = formatNumericInputValue(Number(next))
        else objProps.topInput = formatNumericInputValue(Number(next))
      }
    )
  }

  function setEndpointSnapMargin(value: number) {
    const obj = activeObject.value
    if (!obj || !fabricCanvas || obj instanceof ActiveSelection) return
    const next = normalizeEndpointSnapMargin(value)
    const target = getEndpointSnapMarginMetadata(obj)
    if (!target) return
    target.endpointSnapMargin = next
    objProps.endpointSnapMargin = next
    objProps.endpointSnapMarginInput = formatNumericInputValue(next)
    obj.dirty = true
    obj.setCoords()
    const endpointsTouched = syncEndpointsForChangedObject(obj)
    if (isKaleidoscopeSource(obj)) {
      const contentSynced = syncKaleidoscopeContent(obj)
      if (contentSynced) syncEndpointsForChangedObject(obj)
    }
    fabricCanvas.requestRenderAll()
    refreshLayers()
    if (endpointsTouched) refreshEditablePathMetadata()
    snapshot()
    syncObjProps()
  }

  function setEndpointSnapMarginFromInput(value: string | number) {
    commitNumericInput(
      value,
      objProps.endpointSnapMargin,
      setEndpointSnapMargin,
      (next) => { objProps.endpointSnapMarginInput = formatNumericInputValue(normalizeEndpointSnapMargin(next)) }
    )
  }

  function setCornerRadius(value: number) {
    const obj = activeEditablePathObject.value
    if (!obj || !fabricCanvas) return
    setObjectCornerRadius(obj, value)
    triggerKaleidoscopeContentSync(obj)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  function setCornerRadiusFromInput(value: string | number) {
    commitNumericInput(
      value,
      objProps.cornerRadius,
      setCornerRadius,
      (next) => { objProps.cornerRadiusInput = next }
    )
  }

  function setSelectedPointCornerRadius(value: number) {
    const obj = activeEditablePathObject.value
    const pointIndices = normalizeSelectedPointIndices(obj!, selectedPointIndices.value)
    if (!obj || !pointIndices.length || !fabricCanvas) return
    if (pointIndices.length === 1) {
      setPointCornerRadius(obj, pointIndices[0], value)
    } else {
      setPointsCornerRadius(obj, pointIndices, value)
    }
    triggerKaleidoscopeContentSync(obj)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  function setSelectedPointCornerRadiusFromInput(value: string | number) {
    if (normalizeInputValue(value) === '' && selectedPointIndices.value.length > 1) {
      syncObjProps()
      return
    }
    commitNumericInput(
      value,
      objProps.pointCornerRadius,
      setSelectedPointCornerRadius,
      (next) => { objProps.pointCornerRadiusInput = next }
    )
  }

  function ensureFillForSolidArrow(obj: EditablePathObject) {
    if (!pathHasSolidArrowHead(obj)) return
    const target = obj as AnyFabricObject
    const stroke = typeof target.stroke === 'string' ? target.stroke : ''
    if (!isFillEnabled(stroke)) return
    if (isFillEnabled(target.fill)) return
    target.set('fill', stroke)
    target.autoFillForSolidArrow = true
  }

  function clearAutoFillForHollowArrow(obj: EditablePathObject) {
    const target = obj as AnyFabricObject
    if (pathHasSolidArrowHead(obj)) return
    if (!target.autoFillForSolidArrow) return
    if (isFillEnabled(target.fill)) target.lastFill = target.fill
    target.set('fill', 'transparent')
    target.autoFillForSolidArrow = false
  }

  function applyArrowChange(partial: Partial<ArrowHead>) {
    const obj = activeEditablePathObject.value
    const indices = selectedArrowEndpointIndices.value
    if (!obj || !indices.length || !fabricCanvas) return
    setEditablePointsArrowHead(obj, indices, partial)
    refreshEditablePathMetadata()
    if (getArrowRenderMode(obj) === 'hollow-shaft') {
      clearAutoFillForHollowArrow(obj)
    } else if (partial.shape === 'hollow' || partial.enabled === false) {
      clearAutoFillForHollowArrow(obj)
    } else {
      ensureFillForSolidArrow(obj)
    }
    obj.dirty = true
    obj.setCoords()
    triggerKaleidoscopeContentSync(obj)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  function toggleSelectedArrowEnabled(enabled: boolean) {
    applyArrowChange({ enabled: !!enabled })
  }

  function setSelectedArrowShape(shape: ArrowHeadShape) {
    if (isHollowShaftArrow.value) return
    applyArrowChange({ shape })
  }

  function setSelectedArrowAngle(angle: number) {
    if (isHollowShaftArrow.value || !Number.isFinite(angle)) return
    applyArrowChange({ angle: Math.max(15, Math.min(150, angle)) })
  }

  function setSelectedArrowLength(length: number) {
    if (!Number.isFinite(length)) return
    applyArrowChange({ length: Math.max(0, length) })
  }

  function setSelectedArrowLengthFromInput(value: string | number) {
    const trimmed = normalizeInputValue(value)
    if (trimmed === '' && selectedArrowEndpointIndices.value.length > 1) {
      syncObjProps()
      return
    }
    const fallback = arrowAggregated.value.length ?? 16
    commitNumericInput(
      value,
      fallback,
      setSelectedArrowLength,
      (next) => { objProps.arrowLengthInput = next }
    )
  }

  function setHollowArrowLineWidth(lineWidth: number) {
    const obj = activeEditablePathObject.value
    if (!obj || !fabricCanvas || getArrowRenderMode(obj) !== 'hollow-shaft' || !Number.isFinite(lineWidth)) return
    ;(obj as AnyFabricObject).arrowLineWidth = Math.max(0, lineWidth)
    refreshEditablePathMetadata()
    rebuildEditablePathObjectFromPoint(obj, 0)
    obj.dirty = true
    obj.setCoords()
    triggerKaleidoscopeContentSync(obj)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  function setHollowArrowTipAngle(angle: number) {
    const obj = activeEditablePathObject.value
    if (!obj || !fabricCanvas || getArrowRenderMode(obj) !== 'hollow-shaft' || !Number.isFinite(angle)) return
    ;(obj as AnyFabricObject).arrowTipAngle = Math.max(15, Math.min(165, angle))
    refreshEditablePathMetadata()
    rebuildEditablePathObjectFromPoint(obj, 0)
    obj.dirty = true
    obj.setCoords()
    triggerKaleidoscopeContentSync(obj)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  function setHollowArrowSideAngle(angle: number) {
    const obj = activeEditablePathObject.value
    if (!obj || !fabricCanvas || getArrowRenderMode(obj) !== 'hollow-shaft' || !Number.isFinite(angle)) return
    ;(obj as AnyFabricObject).arrowSideAngle = Math.max(15, Math.min(90, angle))
    refreshEditablePathMetadata()
    rebuildEditablePathObjectFromPoint(obj, 0)
    obj.dirty = true
    obj.setCoords()
    triggerKaleidoscopeContentSync(obj)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  function setHollowArrowLineWidthFromInput(value: string | number) {
    const obj = activeEditablePathObject.value
    if (!obj || getArrowRenderMode(obj) !== 'hollow-shaft') return
    const fallback = getHollowShaftArrowLineWidth(obj)
    commitNumericInput(
      value,
      fallback,
      setHollowArrowLineWidth,
      (next) => { objProps.arrowLineWidthInput = next }
    )
  }

  function updateCurveControls() {
    const shapeObj = activeObject.value
    if (shapeObj && selectionMode.value === 'shape') {
      attachKaleidoscopeCenterControl(shapeObj)
      shapeObj.canvas?.requestRenderAll()
      return
    }

    const obj = activeEditablePathObject.value
    if (!obj) {
      restorePointControls()
      fabricCanvas?.requestRenderAll()
      return
    }
    if (selectionMode.value !== 'point' && selectionMode.value !== 'segment') {
      restorePointControls()
      obj.canvas?.requestRenderAll()
      return
    }
    attachPointControls(obj)
    obj.canvas?.requestRenderAll()
  }

  function setSelectedSegmentCurveEnabled(enabled: boolean) {
    const obj = activeEditablePathObject.value
    const segmentRef = selectedEditableSegment.value
    if (!obj || getArrowRenderMode(obj) === 'hollow-shaft' || !segmentRef || !fabricCanvas) return
    setEditableSegmentType(obj, segmentRef, enabled ? 'cubic' : 'line')
    triggerKaleidoscopeContentSync(obj)
    // 重新解析为最新的 segmentRef，避免后续操作引用过期数据
    const liveSegmentRef = resolveEditableSegmentRef(obj, segmentRef)
    if (liveSegmentRef) selectedSegmentRef.value = liveSegmentRef
    updateCurveControls()
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  function setSelectedSegmentControlPoint(controlPoint: CurveControlPointKey, nextPoint: EditablePoint) {
    const obj = activeEditablePathObject.value
    const segmentRef = selectedEditableSegment.value
    if (!obj || getArrowRenderMode(obj) === 'hollow-shaft' || !segmentRef || !fabricCanvas) return
    setEditableSegmentControlPoint(obj, segmentRef, controlPoint, nextPoint)
    triggerKaleidoscopeContentSync(obj)
    // 操作后路径数据已更新，刷新 segmentRef 以引用最新模型
    const liveSegmentRef = resolveEditableSegmentRef(obj, segmentRef)
    if (liveSegmentRef) selectedSegmentRef.value = liveSegmentRef
    updateCurveControls()
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  function setSelectedSegmentControlPointCoord(controlPoint: CurveControlPointKey, axis: 'x' | 'y', value: number) {
    const segmentRef = selectedEditableSegment.value
    if (!segmentRef) return
    const point = getEditableSegmentControlPoint(segmentRef, controlPoint)
    setSelectedSegmentControlPoint(controlPoint, {
      ...point,
      [axis]: value
    })
  }

  function setSelectedSegmentControlPointCoordFromInput(
    controlPoint: CurveControlPointKey,
    axis: 'x' | 'y',
    value: string | number
  ) {
    const segmentRef = selectedEditableSegment.value
    if (!segmentRef) return
    const point = getEditableSegmentControlPoint(segmentRef, controlPoint)
    const fallback = axis === 'x' ? point.x : point.y
    const key = `curve${controlPoint === 'cp1' ? 'Cp1' : 'Cp2'}${axis.toUpperCase()}Input` as const
    commitNumericInput(
      value,
      fallback,
      (next) => { setSelectedSegmentControlPointCoord(controlPoint, axis, next) },
      (next) => { objProps[key] = next }
    )
  }

  function setStrokeWidthFromInput(value: string | number) {
    commitNumericInput(
      value,
      objProps.strokeWidth,
      (next) => { setObjProp('strokeWidth', next) },
      (next) => { objProps.strokeWidthInput = next }
    )
  }

  function setStrokeLineType(value: string) {
    const obj = activeObject.value
    if (!obj || !fabricCanvas) return
    const nextType: StrokeLineType = value === 'dashed' ? 'dashed' : 'solid'
    getStyleTargets(obj).forEach((target) => {
      const typedTarget = target as AnyFabricObject
      if (nextType === 'solid') {
        const activeDash = normalizeStrokeDashArray(target.strokeDashArray)
        if (activeDash) typedTarget.lastStrokeDashArray = activeDash
        target.set('strokeDashArray', null)
      } else {
        const nextDash = normalizeStrokeDashArray(typedTarget.lastStrokeDashArray)
          ?? getDefaultStrokeDashArray(target.strokeWidth ?? objProps.strokeWidth)
        typedTarget.lastStrokeDashArray = nextDash
        target.set('strokeDashArray', nextDash)
      }
      target.dirty = true
      target.setCoords()
    })
    if (obj instanceof Group) obj.triggerLayout()
    obj.dirty = true
    obj.setCoords()
    triggerKaleidoscopeContentSync(obj)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  function setStrokeDashValue(index: 0 | 1, value: number) {
    const obj = activeObject.value
    if (!obj || !fabricCanvas) return
    const nextValue = Number.isFinite(value) && value > 0 ? value : (index === 0 ? objProps.strokeDashLength : objProps.strokeDashGap)
    getStyleTargets(obj).forEach((target) => {
      const typedTarget = target as AnyFabricObject
      const nextDash = [...getStrokeDashPair(target)] as [number, number]
      nextDash[index] = nextValue
      typedTarget.lastStrokeDashArray = nextDash
      if (normalizeStrokeDashArray(target.strokeDashArray)) {
        target.set('strokeDashArray', nextDash)
      }
      target.dirty = true
      target.setCoords()
    })
    if (obj instanceof Group) obj.triggerLayout()
    obj.dirty = true
    obj.setCoords()
    triggerKaleidoscopeContentSync(obj)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  function setStrokeDashLengthFromInput(value: string | number) {
    commitNumericInput(
      value,
      objProps.strokeDashLength,
      (next) => { setStrokeDashValue(0, Math.max(1, next)) },
      (next) => {
        const normalized = String(Math.max(1, Number(next) || objProps.strokeDashLength))
        objProps.strokeDashLengthInput = normalized
      }
    )
  }

  function setStrokeDashGapFromInput(value: string | number) {
    commitNumericInput(
      value,
      objProps.strokeDashGap,
      (next) => { setStrokeDashValue(1, Math.max(1, next)) },
      (next) => {
        const normalized = String(Math.max(1, Number(next) || objProps.strokeDashGap))
        objProps.strokeDashGapInput = normalized
      }
    )
  }

  function toggleFill(enabled: boolean) {
    const obj = activeObject.value
    if (!obj || !fabricCanvas) return
    getStyleTargets(obj).forEach((target) => {
      const t = target as AnyFabricObject
      applyDefaultFillGradientMetadata(t)
      if (enabled) {
        if (t.fillMode === 'gradient') applyGradientFillToTarget(target)
        else target.set('fill', t.lastFill || objProps.fill || '#000000')
      } else {
        if (typeof target.fill === 'string' && isFillEnabled(target.fill)) t.lastFill = target.fill
        target.set('fill', 'transparent')
      }
      target.dirty = true
      target.setCoords()
    })
    if (obj instanceof Group) obj.triggerLayout()
    obj.dirty = true
    obj.setCoords()
    triggerKaleidoscopeContentSync(obj)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  function updateFillGradientStops(mutator: (stops: FillGradientStop[]) => FillGradientStop[]) {
    const obj = activeObject.value
    if (!obj || !fabricCanvas) return
    getStyleTargets(obj).forEach((target) => {
      const typedTarget = target as AnyFabricObject
      applyDefaultFillGradientMetadata(typedTarget)
      typedTarget.fillMode = 'gradient'
      typedTarget.fillGradientStops = mutator(cloneFillGradientStops(typedTarget.fillGradientStops))
      applyGradientFillToTarget(target)
      target.dirty = true
      target.setCoords()
    })
    objProps.fillEnabled = true
    objProps.fillMode = 'gradient'
    triggerKaleidoscopeContentSync(obj)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  function setSolidFillColor(value: string) {
    setObjProp('fill', value)
  }

  function setFillStyleMode(mode: 'solid' | FillGradientType) {
    if (mode === 'solid') {
      setFillMode('solid')
      return
    }
    setFillGradientTypeValue(mode)
  }

  function setFillMode(mode: FillModeOption) {
    const obj = activeObject.value
    if (!obj || !fabricCanvas) return
    getStyleTargets(obj).forEach((target) => {
      const typedTarget = target as AnyFabricObject
      applyDefaultFillGradientMetadata(typedTarget)
      typedTarget.fillMode = mode
      if (mode === 'gradient') applyGradientFillToTarget(target)
      else target.set('fill', typedTarget.lastFill || objProps.fill || '#000000')
      target.dirty = true
      target.setCoords()
    })
    objProps.fillEnabled = true
    objProps.fillMode = mode
    triggerKaleidoscopeContentSync(obj)
    updateCurveControls()
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  function setFillGradientTypeValue(value: FillGradientType) {
    const obj = activeObject.value
    if (!obj || !fabricCanvas) return
    getStyleTargets(obj).forEach((target) => {
      const typedTarget = target as AnyFabricObject
      applyDefaultFillGradientMetadata(typedTarget)
      typedTarget.fillMode = 'gradient'
      typedTarget.fillGradientType = value
      applyGradientFillToTarget(target)
      target.dirty = true
      target.setCoords()
    })
    objProps.fillMode = 'gradient'
    objProps.fillGradientType = value
    triggerKaleidoscopeContentSync(obj)
    updateCurveControls()
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  function setFillGradientStopColor(index: number, color: string) {
    updateFillGradientStops((stops) => {
      if (!stops[index]) return stops
      stops[index] = { ...stops[index], color }
      return stops
    })
  }

  function reorderFillGradientStops() {
    const reorderedStops = objProps.fillGradientStops.map(({ color, offset }) => ({ color, offset }))
    const offsetSlots = getNormalizedGradientOffsetSlots(reorderedStops, objProps.fill || '#000000')
    updateFillGradientStops(() => reorderedStops.map((stop, index) => ({
      ...stop,
      offset: offsetSlots[index] ?? stop.offset
    })))
  }

  function setFillGradientStopOffset(index: number, value: string | number) {
    updateFillGradientStops((stops) => {
      if (!stops[index]) return stops
      if (index === 0 || index === stops.length - 1) return stops
      const fallback = Math.round(stops[index].offset * 100)
      const min = Math.round(stops[index - 1].offset * 100)
      const max = Math.round(stops[index + 1].offset * 100)
      const nextPercent = normalizeGradientOffsetPercentInput(value, fallback, min, max)
      stops[index] = { ...stops[index], offset: nextPercent / 100 }
      return stops
    })
  }

  function addFillGradientStop() {
    updateFillGradientStops((stops) => {
      if (stops.length < 2) return [...stops, { color: objProps.fill || '#000000', offset: 1 }]
      const prev = stops[stops.length - 2]
      const next = stops[stops.length - 1]
      return [
        ...stops.slice(0, -1),
        { color: next.color, offset: (prev.offset + next.offset) / 2 },
        next
      ].sort((a, b) => a.offset - b.offset)
    })
  }

  function removeFillGradientStop(index: number) {
    updateFillGradientStops((stops) => stops.filter((_, stopIndex) => stopIndex !== index))
  }

  function setFillGradientAngleValue(value: number) {
    const obj = activeObject.value
    if (!obj || !fabricCanvas) return
    getStyleTargets(obj).forEach((target) => {
      const typedTarget = target as AnyFabricObject
      applyDefaultFillGradientMetadata(typedTarget)
      typedTarget.fillMode = 'gradient'
      typedTarget.fillGradientType = 'linear'
      typedTarget.fillGradientAngle = value
      applyGradientFillToTarget(target)
      target.dirty = true
      target.setCoords()
    })
    objProps.fillMode = 'gradient'
    objProps.fillGradientType = 'linear'
    objProps.fillGradientAngle = value
    objProps.fillGradientAngleInput = formatNumericInputValue(value)
    triggerKaleidoscopeContentSync(obj)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  function setFillGradientRadiusValue(value: number) {
    const obj = activeObject.value
    if (!obj || !fabricCanvas) return
    const normalized = normalizeFillGradientRadiusInput(value)
    getStyleTargets(obj).forEach((target) => {
      const typedTarget = target as AnyFabricObject
      applyDefaultFillGradientMetadata(typedTarget)
      typedTarget.fillMode = 'gradient'
      typedTarget.fillGradientType = 'radial'
      typedTarget.fillGradientRadius = normalized
      applyGradientFillToTarget(target)
      target.dirty = true
      target.setCoords()
    })
    objProps.fillMode = 'gradient'
    objProps.fillGradientType = 'radial'
    objProps.fillGradientRadius = normalized
    triggerKaleidoscopeContentSync(obj)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }


  function toggleStroke(enabled: boolean) {
    const obj = activeObject.value
    if (!obj || !fabricCanvas) return
    getStyleTargets(obj).forEach((target) => {
      const t = target as AnyFabricObject
      if (enabled) {
        target.set({
          stroke: t.lastStroke || objProps.stroke || '#333333',
          strokeWidth: (t.lastStrokeWidth ?? objProps.strokeWidth) || 2
        })
        t.lastStrokeDashArray = normalizeStrokeDashArray(t.lastStrokeDashArray)
          ?? getDefaultStrokeDashArray(t.lastStrokeWidth ?? objProps.strokeWidth)
      } else {
        if (isStrokeEnabled(target.stroke, target.strokeWidth)) {
          t.lastStroke = target.stroke
          t.lastStrokeWidth = target.strokeWidth
        }
        target.set('strokeWidth', 0)
      }
      target.dirty = true
      target.setCoords()
    })
    if (obj instanceof Group) obj.triggerLayout()
    obj.dirty = true
    obj.setCoords()
    triggerKaleidoscopeContentSync(obj)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  // 按属性面板输入缩放当前对象；开启网格吸附时会继续量化显示尺寸和边界位置。
  function setObjSize(dim: 'width' | 'height', value: number) {
    const obj = activeObject.value
    if (!obj || !Number.isFinite(value) || value <= 0) return
    if (sizeRatioLocked.value) {
      const ratio = lockedAspectRatio.value || getObjectAspectRatio(obj)
      const safeRatio = ratio > 0 ? ratio : 1
      const width = dim === 'width' ? value : value * safeRatio
      const height = dim === 'width' ? value / safeRatio : value
      scaleObjectToDisplaySize(obj, width, height)
    } else if (dim === 'width') {
      obj.scaleToWidth(value)
    } else {
      obj.scaleToHeight(value)
    }
    rebuildObjectGradientFill(obj)
    snapObjectSizeToPixelGrid(obj)
    snapObjectPositionToPixelGrid(obj)
    clearOwnedEndpointAttachmentsForTransformedObject(obj)
    obj.dirty = true
    obj.setCoords()
    syncEndpointsForChangedObject(obj)
    triggerKaleidoscopeTransformSync(obj)
    fabricCanvas?.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  // 将对象尺寸输入提交为正数，非法输入回退到当前显示尺寸
  function setObjSizeFromInput(dim: 'width' | 'height', value: string | number) {
    const fallback = dim === 'width' ? objProps.width : objProps.height
    commitPositiveNumericInput(
      value,
      fallback,
      (next) => { setObjSize(dim, next) },
      (next) => {
        if (dim === 'width') objProps.widthInput = next
        else objProps.heightInput = next
      }
    )
  }

  // ── 对齐到画布 ──
  type AlignPositionId =
    | 'top-left' | 'top-center' | 'top-right'
    | 'middle-left' | 'middle-center' | 'middle-right'
    | 'bottom-left' | 'bottom-center' | 'bottom-right'

  interface AlignPositionMeta {
    id: AlignPositionId
    label: string
    hAxis: 'left' | 'center' | 'right'
    vAxis: 'top' | 'middle' | 'bottom'
    svgX: number
    svgY: number
  }

  const alignPositions: AlignPositionMeta[] = [
    { id: 'top-left',      label: '左上对齐', hAxis: 'left',   vAxis: 'top',    svgX: 2,  svgY: 2 },
    { id: 'top-center',    label: '中上对齐', hAxis: 'center', vAxis: 'top',    svgX: 6,  svgY: 2 },
    { id: 'top-right',     label: '右上对齐', hAxis: 'right',  vAxis: 'top',    svgX: 10, svgY: 2 },
    { id: 'middle-left',   label: '左中对齐', hAxis: 'left',   vAxis: 'middle', svgX: 2,  svgY: 7 },
    { id: 'middle-center', label: '正中对齐', hAxis: 'center', vAxis: 'middle', svgX: 6,  svgY: 7 },
    { id: 'middle-right',  label: '右中对齐', hAxis: 'right',  vAxis: 'middle', svgX: 10, svgY: 7 },
    { id: 'bottom-left',   label: '左下对齐', hAxis: 'left',   vAxis: 'bottom', svgX: 2,  svgY: 12 },
    { id: 'bottom-center', label: '中下对齐', hAxis: 'center', vAxis: 'bottom', svgX: 6,  svgY: 12 },
    { id: 'bottom-right',  label: '右下对齐', hAxis: 'right',  vAxis: 'bottom', svgX: 10, svgY: 12 }
  ]

  const alignPopoverVisible = ref(false)

  const detectedAlignId = computed<AlignPositionId | null>(() => {
    void layerVersion.value
    const obj = activeObject.value
    if (!obj) return null
    const bounds = obj.getBoundingRect()
    const tolerance = 0.5
    let hAxis: AlignPositionMeta['hAxis'] | null = null
    let vAxis: AlignPositionMeta['vAxis'] | null = null
    if (Math.abs(bounds.left) <= tolerance) hAxis = 'left'
    else if (Math.abs(bounds.left + bounds.width - canvasWidth.value) <= tolerance) hAxis = 'right'
    else if (Math.abs(bounds.left + bounds.width / 2 - canvasWidth.value / 2) <= tolerance) hAxis = 'center'
    if (Math.abs(bounds.top) <= tolerance) vAxis = 'top'
    else if (Math.abs(bounds.top + bounds.height - canvasHeight.value) <= tolerance) vAxis = 'bottom'
    else if (Math.abs(bounds.top + bounds.height / 2 - canvasHeight.value / 2) <= tolerance) vAxis = 'middle'
    if (!hAxis || !vAxis) return null
    return alignPositions.find((item) => item.hAxis === hAxis && item.vAxis === vAxis)?.id ?? null
  })

  const currentAlignId = computed<AlignPositionId>(() => detectedAlignId.value ?? 'middle-center')

  const currentAlignPosition = computed<AlignPositionMeta>(() => (
    alignPositions.find((item) => item.id === currentAlignId.value) ?? alignPositions[4]
  ))

  function alignToCanvas(positionId: AlignPositionId) {
    const obj = activeObject.value
    if (!obj || !fabricCanvas) return
    const meta = alignPositions.find((item) => item.id === positionId)
    if (!meta) return
    const bounds = obj.getBoundingRect()
    let targetLeft = bounds.left
    let targetTop = bounds.top
    if (meta.hAxis === 'left') targetLeft = 0
    else if (meta.hAxis === 'center') targetLeft = (canvasWidth.value - bounds.width) / 2
    else targetLeft = canvasWidth.value - bounds.width
    if (meta.vAxis === 'top') targetTop = 0
    else if (meta.vAxis === 'middle') targetTop = (canvasHeight.value - bounds.height) / 2
    else targetTop = canvasHeight.value - bounds.height
    const dx = targetLeft - bounds.left
    const dy = targetTop - bounds.top
    if (dx === 0 && dy === 0) return
    obj.set({ left: (obj.left ?? 0) + dx, top: (obj.top ?? 0) + dy })
    clearOwnedEndpointAttachmentsForTransformedObject(obj)
    obj.setCoords()
    syncEndpointsForChangedObject(obj)
    triggerKaleidoscopeTransformSync(obj)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  function selectAlign(positionId: AlignPositionId) {
    alignPopoverVisible.value = false
    alignToCanvas(positionId)
  }

  type SelectionAlignAxis = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
  type SelectionDistributeAxis = 'horizontal' | 'vertical'

  type ObjectLayoutBounds = {
    object: FabricObject
    left: number
    top: number
    right: number
    bottom: number
    width: number
    height: number
    centerX: number
    centerY: number
  }

  type LayoutSelectionBounds = {
    left: number
    top: number
    right: number
    bottom: number
    width: number
    height: number
  }

  // 收集当前多选中可参与排版的顶层对象；万花筒实例由源对象托管，避免手动对齐后被同步逻辑覆盖或产生双重偏移。
  function getSelectedLayoutTargets() {
    if (!fabricCanvas) return []
    const canvasObjects = fabricCanvas.getObjects()
    return fabricCanvas.getActiveObjects()
      .filter((obj) => canvasObjects.includes(obj))
      .filter((obj) => !isBooleanPreviewObject(obj) && !isKaleidoscopeInstance(obj))
  }

  // 获取对象在画布场景坐标中的包围盒，统一处理旋转、缩放和 ActiveSelection 内部对象的坐标换算。
  function getObjectLayoutBounds(object: FabricObject): ObjectLayoutBounds | null {
    object.setCoords()
    const bounds = object.getBoundingRect()
    const values = [bounds.left, bounds.top, bounds.width, bounds.height]
    if (!values.every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) return null
    const right = bounds.left + bounds.width
    const bottom = bounds.top + bounds.height
    return {
      object,
      left: bounds.left,
      top: bounds.top,
      right,
      bottom,
      width: bounds.width,
      height: bounds.height,
      centerX: bounds.left + bounds.width / 2,
      centerY: bounds.top + bounds.height / 2
    }
  }

  // 合并多对象的初始包围盒，作为“以选区为参考”的对齐和分布基准。
  function getLayoutSelectionBounds(items: ObjectLayoutBounds[]): LayoutSelectionBounds | null {
    if (!items.length) return null
    const left = Math.min(...items.map((item) => item.left))
    const top = Math.min(...items.map((item) => item.top))
    const right = Math.max(...items.map((item) => item.right))
    const bottom = Math.max(...items.map((item) => item.bottom))
    const values = [left, top, right, bottom]
    if (!values.every(Number.isFinite) || right <= left || bottom <= top) return null
    return { left, top, right, bottom, width: right - left, height: bottom - top }
  }

  // 按场景坐标偏移对象；使用 Fabric 的 getXY / setXY 让 ActiveSelection 子对象自动转换到当前父级坐标系。
  function moveObjectBySceneDelta(object: FabricObject, dx: number, dy: number) {
    if ((dx === 0 && dy === 0) || !Number.isFinite(dx) || !Number.isFinite(dy)) return false
    const current = object.getXY()
    const nextX = object.lockMovementX ? current.x : current.x + dx
    const nextY = object.lockMovementY ? current.y : current.y + dy
    if (nextX === current.x && nextY === current.y) return false
    object.setXY(new Point(nextX, nextY))
    clearOwnedEndpointAttachmentsForTransformedObject(object)
    object.setCoords()
    syncEndpointsForChangedObject(object)
    triggerKaleidoscopeTransformSync(object)
    return true
  }

  // 完成多对象排版后的统一收尾：刷新 ActiveSelection 尺寸、图层、属性和撤销快照。
  function finalizeSelectionLayoutTransform(targets: FabricObject[]) {
    if (!fabricCanvas) return
    const active = fabricCanvas.getActiveObject()
    if (active instanceof ActiveSelection || active instanceof Group) {
      active.triggerLayout()
      active.setCoords()
    }
    targets.forEach((target) => target.setCoords())
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
    syncObjProps()
  }

  // 以当前选区包围盒为参考执行多对象对齐，支持左右 / 水平居中 / 上下 / 垂直居中六个方向并保持操作可撤销。
  function alignSelection(axis: SelectionAlignAxis) {
    if (!fabricCanvas) return
    const targets = getSelectedLayoutTargets()
    if (targets.length < 2) return
    const items = targets
      .map(getObjectLayoutBounds)
      .filter((item): item is ObjectLayoutBounds => !!item)
    const selectionBounds = getLayoutSelectionBounds(items)
    if (!selectionBounds) return

    clearBooleanPreview()
    let moved = false
    items.forEach((item) => {
      let dx = 0
      let dy = 0
      if (axis === 'left') dx = selectionBounds.left - item.left
      else if (axis === 'center') dx = selectionBounds.left + selectionBounds.width / 2 - item.centerX
      else if (axis === 'right') dx = selectionBounds.right - item.right
      else if (axis === 'top') dy = selectionBounds.top - item.top
      else if (axis === 'middle') dy = selectionBounds.top + selectionBounds.height / 2 - item.centerY
      else if (axis === 'bottom') dy = selectionBounds.bottom - item.bottom
      moved = moveObjectBySceneDelta(item.object, dx, dy) || moved
    })
    if (!moved) return
    finalizeSelectionLayoutTransform(targets)
  }

  // 在选区首尾对象之间按对象包围盒间距做等距分布，首尾位置保持不变，便于稳定整理图标元素阵列。
  function distributeSelection(axis: SelectionDistributeAxis) {
    if (!fabricCanvas) return
    const targets = getSelectedLayoutTargets()
    if (targets.length < 3) return
    const items = targets
      .map(getObjectLayoutBounds)
      .filter((item): item is ObjectLayoutBounds => !!item)
    if (items.length < 3) return

    clearBooleanPreview()
    const sorted = [...items].sort((a, b) => axis === 'horizontal'
      ? (a.left === b.left ? a.centerX - b.centerX : a.left - b.left)
      : (a.top === b.top ? a.centerY - b.centerY : a.top - b.top)
    )
    const totalSize = sorted.reduce((sum, item) => sum + (axis === 'horizontal' ? item.width : item.height), 0)
    const start = axis === 'horizontal' ? sorted[0].left : sorted[0].top
    const end = axis === 'horizontal' ? sorted[sorted.length - 1].right : sorted[sorted.length - 1].bottom
    const gap = (end - start - totalSize) / (sorted.length - 1)
    if (!Number.isFinite(gap)) return

    let moved = false
    let cursor = start
    sorted.forEach((item, index) => {
      if (index === 0) {
        cursor = (axis === 'horizontal' ? item.right : item.bottom) + gap
        return
      }
      if (index === sorted.length - 1) return
      if (axis === 'horizontal') {
        moved = moveObjectBySceneDelta(item.object, cursor - item.left, 0) || moved
        cursor += item.width + gap
      } else {
        moved = moveObjectBySceneDelta(item.object, 0, cursor - item.top) || moved
        cursor += item.height + gap
      }
    })
    if (!moved) return
    finalizeSelectionLayoutTransform(targets)
  }

  // ── 画布尺寸 ──
  function syncCanvasSizeInputs() {
    canvasWidthInput.value = String(canvasWidth.value)
    canvasHeightInput.value = String(canvasHeight.value)
  }

  function setCanvasSize(dim: 'width' | 'height', value: number) {
    if (!fabricCanvas) return
    if (!Number.isFinite(value) || value <= 0) {
      syncCanvasSizeInputs()
      return
    }
    if (dim === 'width') canvasWidth.value = value
    else canvasHeight.value = value
    applyCanvasSize()
  }

  function setCanvasSizeFromInput(dim: 'width' | 'height', value: string | number) {
    const fallback = dim === 'width' ? canvasWidth.value : canvasHeight.value
    commitNumericInput(
      value,
      fallback,
      (next) => { setCanvasSize(dim, next) },
      (next) => {
        if (dim === 'width') canvasWidthInput.value = next
        else canvasHeightInput.value = next
      }
    )
  }

  function applyCanvasSize() {
    if (!fabricCanvas) return
    syncCanvasSizeInputs()
    fabricCanvas.setDimensions({ width: canvasWidth.value, height: canvasHeight.value })
    fitCanvasInView()
    snapshot()
  }

  function setCanvasBg(color: string) {
    if (!fabricCanvas) return
    const next = normalizeCanvasBg(color)
    canvasBg.value = next
    if (!isTransparentCanvasBg(next)) lastOpaqueCanvasBg.value = next
    applyCanvasBgToFabric(next)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
  }

  function applyCanvasPreset(val: string) {
    canvasPresetValue.value = val
    const preset = canvasPresets.find(p => p.value === val)
    if (preset) {
      canvasWidth.value = preset.width
      canvasHeight.value = preset.height
      applyCanvasSize()
    }
  }

  // ── 缩放 ──
  function setZoom(value: number) {
    applyCanvasZoom(value)
  }

  function getSpecialDirectEditSegment(obj: FabricObject | null | undefined) {
    if (!obj || !isEditablePathObject(obj) || !DIRECT_EDIT_SHAPE_IDS.has(String((obj as AnyFabricObject).shapeId ?? ''))) return null
    const segments = getEditableSegments(obj)
    return segments.length === 1 ? segments[0] : null
  }

  function getSpecialDirectEditMode(obj: FabricObject | null | undefined): 'point' | 'segment' | null {
    const segment = getSpecialDirectEditSegment(obj)
    if (!segment) return null
    return segment.segment.type === 'cubic' ? 'segment' : 'point'
  }

  function shouldHideTransformControlsInEditMode(obj: FabricObject | null | undefined) {
    return selectionMode.value !== 'shape' && !!getSpecialDirectEditSegment(obj)
  }

  function hideFabricTransformControls(controls: FabricControls) {
    FABRIC_TRANSFORM_CONTROL_KEYS.forEach((key) => {
      delete controls[key]
    })
  }

  function syncActiveObject(obj: FabricObject | null) {
    clearPointEditing()
    const constrained = applyKaleidoscopeSelectionConstraints(obj)
    const directEditMode = getSpecialDirectEditMode(constrained)
    if (directEditMode) {
      selectionMode.value = directEditMode
    } else if (constrained && isKaleidoscopeInstance(constrained)) {
      selectionMode.value = 'shape'
    }
    if (!constrained) selectionMode.value = 'shape'
    activeObject.value = constrained
    booleanError.value = ''
    if (constrained) {
      applyCanvasThemeToObject(constrained)
      applyDefaultSizeRatioLockMetadata(constrained)
    } else {
      sizeRatioLocked.value = false
      lockedAspectRatio.value = 1
    }
    syncCanvasInteractionMode()
    if (directEditMode === 'segment' && isEditablePathObject(constrained)) {
      setSelectedEditableSegment(constrained, getSpecialDirectEditSegment(constrained))
    } else {
      updateCurveControls()
    }
    refreshLayers()
    if (constrained) {
      syncSizeRatioLockFromObject(constrained)
      syncObjProps()
    }
  }

  // 在 point 模式下创建/切换到新对象时，尝试让新对象继续停留在 point 模式
  // (若新对象不可编辑，setSelectionMode 会自动降级为 shape 模式)
  function syncActiveObjectPreservingPointMode(obj: FabricObject | null) {
    const wantPointMode = selectionMode.value === 'point'
    syncActiveObject(obj)
    if (wantPointMode && obj) {
      setSelectionMode('point')
    }
  }

  function refreshActiveObject() {
    triggerRef(activeObject)
    refreshLayers()
  }

  // ── 添加元素 ──
  /**
   * 把钢笔描点的场景坐标生成为可编辑路径对象。
   * 直接以场景坐标作为路径点：rebuildEditablePathObject(obj, true) 会把对象中心定位到路径包围盒中心，
   * 使每个点正好渲染在其原始场景坐标处（Fabric Path 默认 originX/originY=center）。
   */
  function addPenPathObject(rawScenePoints: { x: number; y: number }[], closed: boolean) {
    if (!fabricCanvas) return
    const snapped = rawScenePoints.map((p) => getPixelGridAdjustedScenePoint(new Point(p.x, p.y)))
    if (snapped.length < 2) return
    const obj = createEditablePathObject(polygonEditablePath(snapped, closed), 0)
    obj.set({
      stroke: '#333333',
      strokeWidth: 2,
      strokeUniform: true,
      fill: 'transparent',
      strokeLineCap: 'round' as CanvasLineCap,
      strokeLineJoin: 'round' as CanvasLineJoin,
      strokeMiterLimit: 4,
      name: nextName('钢笔图形')
    })
    const target = obj as AnyFabricObject
    target.shapeId = 'base-pen'
    target.lastFill = '#000000'
    target.fillMode = DEFAULT_FILL_MODE
    target.booleanEligible = true
    target.lastStrokeDashArray = [6, 4]
    applyDefaultFillGradientMetadata(obj)
    applyDefaultKaleidoscopeMetadata(obj)
    applyDefaultEndpointSnapMargin(obj)
    markObjectSizeRatioLocked(obj)
    ensureEditorObjectId(obj)
    obj.setCoords()
    fabricCanvas.add(obj)
    refreshLayers()
    fabricCanvas.setActiveObject(obj)
    syncActiveObjectPreservingPointMode(obj)
    fabricCanvas.requestRenderAll()
  }

  /**
   * 添加基础图形；拖拽插入时优先把图形中心放到落点，普通点击则保持原有画布中心插入行为。
   */
  function addShape(item: ShapeLibraryItem, scenePoint: { x: number; y: number } | null = null) {
    if (penToolActive.value) penCommands.deactivate(true)
    if (!fabricCanvas) return
    const shape = createShape(item)
    markObjectSizeRatioLocked(shape)
    const left = scenePoint?.x ?? canvasWidth.value / 2
    const top = scenePoint?.y ?? canvasHeight.value / 2
    shape.set({
      left,
      top,
      name: nextName(item.label)
    })
    ensureEditorObjectId(shape)
    shape.setCoords()
    fabricCanvas.add(shape)
    refreshLayers()
    fabricCanvas.setActiveObject(shape)
    syncActiveObjectPreservingPointMode(shape)
    fabricCanvas.requestRenderAll()
  }

  /**
   * 添加文字预设；拖拽插入时以鼠标落点为文本框中心，点击插入时沿用原有默认位置。
   */
  function addText(preset: TextLibraryItem, scenePoint: { x: number; y: number } | null = null) {
    if (penToolActive.value) penCommands.deactivate(true)
    if (!fabricCanvas) return
    const width = 200
    const left = scenePoint ? scenePoint.x - width / 2 : canvasWidth.value / 2 - width / 2
    const top = scenePoint ? scenePoint.y - preset.fontSize / 2 : canvasHeight.value / 2 - preset.fontSize / 2
    const t = new Textbox(preset.text, {
      left,
      top,
      fontSize: preset.fontSize,
      fontWeight: preset.fontWeight as any,
      fill: '#000000',
      name: nextName(preset.label),
      width
    })
    applyDefaultKaleidoscopeMetadata(t)
    applyDefaultEndpointSnapMargin(t)
    ensureEditorObjectId(t)
    fabricCanvas.add(t)
    refreshLayers()
    fabricCanvas.setActiveObject(t)
    syncActiveObjectPreservingPointMode(t)
    fabricCanvas.requestRenderAll()
  }

  // ── 模板 ──
  // 把模板 SVG 插入当前画布，作为普通可编辑对象继续参与图层、属性、导出和撤销流程。
  async function insertIconTemplate(template: IconTemplateItem) {
    await importSVGText(template.svg, template.name)
  }

  // 用模板尺寸、背景和 SVG 内容创建一份新文档；应用失败时保留已有画布，避免误清空当前作品。
  async function applyIconTemplateAsDocument(template: IconTemplateItem) {
    if (!fabricCanvas) return
    const previousProject = createProjectFile()
    try {
      newDoc()
      canvasWidth.value = template.width
      canvasHeight.value = template.height
      canvasBg.value = normalizeCanvasBg(template.background)
      if (!isTransparentCanvasBg(canvasBg.value)) lastOpaqueCanvasBg.value = canvasBg.value
      applyCanvasBgToFabric(canvasBg.value)
      applyCanvasSize()
      await importSVGText(template.svg, template.name)
      clearStoredDraft()
      resetHistoryToCurrentCanvas()
    } catch (error) {
      await loadProjectFile(previousProject, { keepDraft: true })
      showToast(error instanceof Error ? error.message : '应用模板失败', 'error')
    }
  }

  // ── 导入 ──
  // 打开隐藏的 SVG 文件选择器，保持顶栏导入入口和文件读取逻辑解耦。
  function importSVG() {
    svgInputRef.value?.click()
  }

  // 打开粘贴导入弹窗，用户可输入完整 SVG、path 标签或 path d 数据后复用同一套导入流程。
  function openPasteSVGDialog() {
    pasteSVGDialog.show = true
    pasteSVGDialog.error = ''
  }

  function importImage() {
    imgInputRef.value?.click()
  }

  // 从文件输入读取本地 SVG，导入失败时只重置输入框并保留当前画布内容。
  async function onSVGFileChosen(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      await importSVGFile(file)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '导入 SVG 失败', 'error')
    } finally {
      input.value = ''
    }
  }

  // 判断用户选择的文件是否可以按 SVG 文本解析，兼容系统 MIME 为空时的扩展名识别。
  function isSVGFile(file: File) {
    return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
  }

  // 从文件名提取导入对象的基础图层名，避免把扩展名展示到图层面板里。
  function getImportSVGDisplayName(fileName: string) {
    const baseName = fileName.replace(/\.svg$/i, '').trim()
    return baseName || 'SVG'
  }

  // 根据 Iconify 图标名生成简短图层名；保留集合前缀方便区分不同来源的同名图标。
  function getIconifyDisplayName(iconName: string) {
    const normalized = iconName.trim()
    return normalized ? `Iconify ${normalized}` : 'Iconify 图标'
  }

  // 借助浏览器实体解析能力解码 path 标签里的 d 属性，避免 &quot; 等实体进入 Fabric 解析。
  function decodeSVGAttribute(value: string) {
    const textarea = document.createElement('textarea')
    textarea.innerHTML = value
    return textarea.value
  }

  // 转义裸 path 数据后再包裹到 SVG 属性中，避免引号或尖括号破坏临时 SVG 结构。
  function escapeSVGAttribute(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  // 从单个 path 标签中提取 d 属性，支持单双引号并忽略其他属性。
  function extractPathDataFromPathElement(input: string) {
    const match = input.match(/<path\b[^>]*\sd\s*=\s*(["'])([\s\S]*?)\1[^>]*>/i)
    return match ? decodeSVGAttribute(match[2]).trim() : ''
  }

  // 粗略判断一段纯文本是否像 SVG path d 数据，防止普通文本被错误包裹成 SVG。
  function looksLikeSVGPathData(input: string) {
    if (!input || /<[^>]+>/.test(input)) return false
    if (!/[a-zA-Z]/.test(input) || !/[\d.]/.test(input)) return false
    return /^[\sMmZzLlHhVvCcSsQqTtAa\d.,+\-eE]+$/.test(input)
  }

  // 将粘贴内容归一为完整 SVG 文本，允许用户直接粘贴完整 SVG、path 标签或裸 path d 数据。
  function normalizePastedSVGText(input: string) {
    const text = input.trim()
    if (!text) throw new Error('请输入 SVG 代码或 path 数据')
    if (/<svg[\s>]/i.test(text)) return text
    const pathData = extractPathDataFromPathElement(text) || (looksLikeSVGPathData(text) ? text : '')
    if (!pathData) throw new Error('未识别到有效的 SVG 或 path d 数据')
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="${escapeSVGAttribute(pathData)}" fill="#000000" /></svg>`
  }

  // 为导入对象补齐编辑器自定义元数据和可读图层名，确保后续图层、草稿和属性面板都能识别。
  function prepareImportedSVGObjectMetadata(obj: FabricObject, displayName: string, isRoot = true) {
    const target = obj as AnyFabricObject
    applyDefaultFillGradientMetadata(obj)
    applyDefaultKaleidoscopeMetadata(obj)
    applyDefaultEndpointSnapMargin(obj)
    normalizeEndpointAttachments(obj)
    ensureEditorObjectId(obj)
    if (isRoot) {
      target.name = nextName(displayName)
    } else if (!String(target.name || '').trim()) {
      target.name = nextName('SVG 元素')
    }
    if (isFillEnabled(obj.fill) && typeof obj.fill === 'string') {
      target.lastFill = obj.fill
    }
    if (isStrokeEnabled(obj.stroke, obj.strokeWidth)) {
      if (typeof obj.stroke === 'string') target.lastStroke = obj.stroke
      target.lastStrokeWidth = obj.strokeWidth || target.lastStrokeWidth || 1
      target.lastStrokeDashArray = normalizeStrokeDashArray(obj.strokeDashArray)
        ?? getDefaultStrokeDashArray(target.lastStrokeWidth)
    }
    if (obj instanceof Group) {
      obj.getObjects().forEach((child) => prepareImportedSVGObjectMetadata(child, displayName, false))
    }
    obj.setCoords()
  }

  // 将导入 SVG 放到画布中心，超出画布时按比例缩小以便用户导入后能立即看到和操作。
  function placeImportedSVGObject(obj: FabricObject) {
    obj.setCoords()
    let bounds = obj.getBoundingRect()
    const maxWidth = canvasWidth.value * 0.82
    const maxHeight = canvasHeight.value * 0.82
    const scaleRatio = Math.min(
      1,
      bounds.width > 0 ? maxWidth / bounds.width : 1,
      bounds.height > 0 ? maxHeight / bounds.height : 1
    )
    if (Number.isFinite(scaleRatio) && scaleRatio > 0 && scaleRatio < 1) {
      obj.set({
        scaleX: (obj.scaleX || 1) * scaleRatio,
        scaleY: (obj.scaleY || 1) * scaleRatio
      })
      obj.setCoords()
      bounds = obj.getBoundingRect()
    }
    const dx = canvasWidth.value / 2 - (bounds.left + bounds.width / 2)
    const dy = canvasHeight.value / 2 - (bounds.top + bounds.height / 2)
    obj.set({
      left: (obj.left || 0) + dx,
      top: (obj.top || 0) + dy
    })
    obj.setCoords()
  }

  // 使用 Fabric 的 SVG 解析能力把完整 SVG 文本转换成一个可编辑对象，并加入当前画布。
  async function importSVGText(svgText: string, displayName: string) {
    if (!fabricCanvas) return
    clearBooleanPreview()
    clearPointEditing()
    const normalizedText = svgText.trim()
    if (!normalizedText) throw new Error('SVG 内容为空')
    if (!/<svg[\s>]/i.test(normalizedText)) throw new Error('未找到有效的 <svg> 内容')
    const { objects, options } = await loadSVGFromString(normalizedText)
    const svgObjects = objects.filter((obj): obj is FabricObject => !!obj)
    if (!svgObjects.length) throw new Error('SVG 中没有可导入的图形')
    const imported = util.groupSVGElements(svgObjects, options) as FabricObject
    prepareImportedSVGObjectMetadata(imported, displayName)
    placeImportedSVGObject(imported)
    fabricCanvas.add(imported as AnyFabricObject)
    refreshLayers()
    fabricCanvas.setActiveObject(imported)
    syncActiveObjectPreservingPointMode(imported)
    fabricCanvas.requestRenderAll()
  }

  // 使用 Fabric 的 SVG 解析能力把本地 SVG 文本转换成一个可编辑对象，并加入当前画布。
  async function importSVGFile(file: File) {
    if (!fabricCanvas) return
    if (!isSVGFile(file)) throw new Error('请选择 .svg 文件')
    await importSVGText(await file.text(), getImportSVGDisplayName(file.name))
  }

  // 调用 Iconify 在线搜索接口并展示前若干个图标名；失败时保留上一次输入，方便用户换关键词重试。
  async function searchIconifyIcons() {
    const query = iconifySearch.query.trim()
    if (!query || iconifySearch.loading) return
    iconifySearch.loading = true
    iconifySearch.error = ''
    iconifySearch.lastQuery = query
    try {
      const response = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=${ICONIFY_SEARCH_LIMIT}`)
      if (!response.ok) throw new Error(`Iconify 搜索失败：${response.status}`)
      const data = await response.json() as IconifySearchResponse
      const icons = Array.isArray(data.icons) ? data.icons.filter((item): item is string => typeof item === 'string') : []
      iconifySearch.results = icons
      iconifySearch.collectionFilter = ''
      iconifySearch.total = Number.isFinite(Number(data.total)) ? Number(data.total) : icons.length
    } catch (error) {
      iconifySearch.results = []
      iconifySearch.collectionFilter = ''
      iconifySearch.total = 0
      iconifySearch.error = error instanceof Error ? error.message : 'Iconify 搜索失败'
    } finally {
      iconifySearch.loading = false
    }
  }

  // 将 Iconify 的 `collection:name` 图标名转换成 SVG API 地址，并指定黑色填充便于 Fabric 正确解析为可编辑颜色。
  function buildIconifySVGUrl(iconName: string) {
    const [prefix, ...nameParts] = iconName.split(':')
    const name = nameParts.join(':')
    if (!prefix || !name) throw new Error('Iconify 图标名格式无效')
    const path = `${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`
    return `https://api.iconify.design/${path}?width=64&height=64&color=%23000000`
  }

  // 获取指定 Iconify 图标的 SVG 并复用 SVG 导入流程，使插入结果保持可改色、缩放和导出。
  async function insertIconifyIcon(iconName: string) {
    if (!fabricCanvas || iconifySearch.inserting) return
    iconifySearch.inserting = iconName
    iconifySearch.error = ''
    try {
      const response = await fetch(buildIconifySVGUrl(iconName))
      if (!response.ok) throw new Error(`Iconify 图标获取失败：${response.status}`)
      await importSVGText(await response.text(), getIconifyDisplayName(iconName))
    } catch (error) {
      iconifySearch.error = error instanceof Error ? error.message : 'Iconify 图标插入失败'
    } finally {
      iconifySearch.inserting = ''
    }
  }

  // 关闭粘贴弹窗时清理临时输入和错误状态，避免下一次打开沿用旧数据。
  function handlePasteSVGDialogShowChange(show: boolean) {
    pasteSVGDialog.show = show
    if (show) return
    pasteSVGDialog.value = ''
    pasteSVGDialog.error = ''
    pasteSVGDialog.loading = false
  }

  // 主动读取系统剪贴板文本填入弹窗；浏览器权限或空内容异常会展示在弹窗内。
  async function readClipboardIntoPasteSVGDialog() {
    pasteSVGDialog.error = ''
    try {
      const text = await navigator.clipboard?.readText?.()
      if (!text || !text.trim()) throw new Error('剪贴板中没有可读取的文本')
      pasteSVGDialog.value = text
    } catch (error) {
      pasteSVGDialog.error = error instanceof Error ? error.message : '读取剪贴板失败'
    }
  }

  // 校验并导入弹窗内的 SVG / path 文本，失败时保留输入以便用户继续修改。
  async function confirmPasteSVGImport() {
    if (pasteSVGDialog.loading) return
    pasteSVGDialog.error = ''
    pasteSVGDialog.loading = true
    try {
      await importSVGText(normalizePastedSVGText(pasteSVGDialog.value), '粘贴 SVG')
      handlePasteSVGDialogShowChange(false)
    } catch (error) {
      pasteSVGDialog.error = error instanceof Error ? error.message : '导入 SVG 失败'
    } finally {
      pasteSVGDialog.loading = false
    }
  }

  // 监听画布区域拖入文件，支持 SVG 和位图导入。
  function handleCanvasDragOver(e: DragEvent) {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
  }

  // 处理文件拖放导入，按类型分发到 SVG 或位图导入流程。
  async function handleCanvasDrop(e: DragEvent) {
    e.preventDefault()
    const files = Array.from(e.dataTransfer?.files ?? [])
    if (!files.length) return
    for (const file of files) {
      if (isSVGFile(file)) {
        try {
          await importSVGFile(file)
        } catch (error) {
          showToast(error instanceof Error ? error.message : '导入 SVG 失败', 'error')
        }
      } else if (file.type.startsWith('image/')) {
        try {
          await importImageFile(file)
        } catch (error) {
          showToast(error instanceof Error ? error.message : '导入图片失败', 'error')
        }
      }
    }
  }

  // 把本地图片文件导入为 Fabric Image，并补齐编辑器元数据后放到画布中心附近。
  async function importImageFile(file: File) {
    if (!fabricCanvas) return
    const url = URL.createObjectURL(file)
    try {
      const img = await FabricImage.fromURL(url)
      applyDefaultKaleidoscopeMetadata(img)
      applyDefaultEndpointSnapMargin(img)
      img.set({
        left: canvasWidth.value / 2 - (img.width || 60) / 2,
        top: canvasHeight.value / 2 - (img.height || 60) / 2,
        name: nextName(file.name)
      })
      ensureEditorObjectId(img)
      img.setCoords()
      fabricCanvas.add(img)
      refreshLayers()
      fabricCanvas.setActiveObject(img)
      syncActiveObjectPreservingPointMode(img)
      fabricCanvas.requestRenderAll()
      snapshot()
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  // 把本地图片文件导入为 Fabric Image，并补齐编辑器元数据后放到画布中心附近。
  async function onImageFileChosen(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      await importImageFile(file)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '导入图片失败', 'error')
    } finally {
      ;(e.target as HTMLInputElement).value = ''
    }
  }

  // 监听全局粘贴事件，支持从剪贴板导入 SVG 文本或位图。
  async function handleWindowPaste(e: ClipboardEvent) {
    if (!fabricCanvas) return
    const activeElement = document.activeElement
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) return
    const items = Array.from(e.clipboardData?.items ?? [])
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (!file) continue
        try {
          await importImageFile(file)
          return
        } catch (error) {
          console.error('粘贴图片失败:', error)
        }
      }
    }
    const text = e.clipboardData?.getData('text/plain')?.trim()
    if (!text) return
    if (/<svg[\s>]/i.test(text) || /<path[\s>]/i.test(text)) {
      try {
        await importSVGText(normalizePastedSVGText(text), '粘贴 SVG')
      } catch (error) {
        console.error('粘贴 SVG 失败:', error)
      }
    }
  }

  // ── 导出 ──
  const previewStageClass = computed(() => `preview-bg-${previewBackgroundMode.value}`)

  // 控制小尺寸预览背景，不影响真实画布背景，仅用于透明、浅色和深色环境下检查可读性。
  function setPreviewBackgroundMode(mode: PreviewBackgroundMode) {
    previewBackgroundMode.value = mode
  }

  // 标记小尺寸预览需要更新，并用短延迟合并连续编辑产生的多次画布事件。
  function scheduleSmallPreviewsRefresh() {
    previewDirty.value = true
    if (previewRenderTimer != null) window.clearTimeout(previewRenderTimer)
    previewRenderTimer = window.setTimeout(() => {
      previewRenderTimer = null
      refreshSmallPreviews()
    }, 120)
  }

  // 取消等待中的预览刷新计时器，组件卸载或画布销毁前调用以避免访问失效画布。
  function cancelSmallPreviewsRefresh() {
    if (previewRenderTimer == null) return
    window.clearTimeout(previewRenderTimer)
    previewRenderTimer = null
  }

  // 按 16/24/32/48 等标准小图标尺寸生成预览缩略图，复用 PNG 渲染逻辑保证和导出效果一致。
  function refreshSmallPreviews() {
    if (!fabricCanvas) return
    cancelSmallPreviewsRefresh()
    const aspectRatio = canvasHeight.value / canvasWidth.value
    previewItems.value = SMALL_PREVIEW_SIZE_OPTIONS.map((size) => ({
      size,
      width: size,
      height: Math.max(1, Math.round(size * aspectRatio)),
      dataUrl: renderPNGDataUrl(size, true)
    }))
    previewDirty.value = false
  }

  // 在预览浮层可见时立即补齐过期缩略图；关闭时只记录 dirty，避免后台频繁生成 dataURL。
  function markSmallPreviewsDirty() {
    previewDirty.value = true
    if (previewPopoverVisible.value) scheduleSmallPreviewsRefresh()
  }

  // ── 对象操作 ──
  function deleteObjects(objects?: FabricObject[]) {
    if (!fabricCanvas) return
    const selectedObjects = fabricCanvas.getActiveObjects()
    const targets = (objects ?? selectedObjects).filter((obj) => fabricCanvas!.getObjects().includes(obj))
    if (!targets.length) return
    const shouldClearSelection = !objects || targets.some((obj) => selectedObjects.includes(obj))
    if (shouldClearSelection) {
      clearPointEditing()
      fabricCanvas.discardActiveObject()
      syncActiveObject(null)
    }
    withSnapshotSuppressed(() => {
      targets.forEach((obj) => {
        removeEndpointAttachmentsReferencing(obj)
        fabricCanvas!.remove(obj as AnyFabricObject)
      })
    })
    refreshLayers()
    if (shouldClearSelection) {
      fabricCanvas.discardActiveObject()
      syncActiveObject(null)
    }
    fabricCanvas.requestRenderAll()
    snapshot()
  }

  function deleteObject() {
    deleteObjects()
  }

  function lockObject() {
    const obj = activeObject.value
    if (!obj) return
    const locked = !obj.lockMovementX
    obj.set({
      lockMovementX: locked,
      lockMovementY: locked,
      lockScalingX: locked,
      lockScalingY: locked,
      lockRotation: locked,
      hasControls: !locked,
      selectable: true
    })
    fabricCanvas?.requestRenderAll()
    refreshActiveObject()
    snapshot()
  }

  function groupObjects() {
    const obj = activeObject.value
    if (!(obj instanceof ActiveSelection) || !fabricCanvas) return
    const objs = obj.removeAll() as AnyFabricObject[]
    const group = new Group(objs, {
      canvas: fabricCanvas as any
    } as any)
    ;(group as any).name = nextName('组')
    withSnapshotSuppressed(() => {
      fabricCanvas!.remove(...objs)
      fabricCanvas!.add(group)
    })
    refreshLayers()
    fabricCanvas.setActiveObject(group)
    syncActiveObject(group)
    fabricCanvas.requestRenderAll()
    snapshot()
  }

  function ungroupObject() {
    const obj = activeObject.value
    if (!(obj instanceof Group) || !fabricCanvas) return
    const items = obj.removeAll()
    withSnapshotSuppressed(() => {
      fabricCanvas!.remove(obj)
      for (const item of items) {
        fabricCanvas!.add(item)
      }
    })
    fabricCanvas.discardActiveObject()
    syncActiveObject(null)
    refreshLayers()
    fabricCanvas.requestRenderAll()
    snapshot()
  }

  async function runBooleanOperation(operation: BooleanOperation, subtractDirection: SubtractDirection = 'forward') {
    if (!fabricCanvas || booleanBusy.value) return
    clearBooleanPreview()
    clearPointEditing()
    subtractPopoverVisible.value = false
    const objects = fabricCanvas.getActiveObjects()
    if (objects.length < 2) {
      booleanError.value = '请至少选择 2 个对象'
      return
    }

    booleanBusy.value = true
    booleanError.value = ''
    skipSnapshot = true
    try {
      const { result, error } = await applyBooleanOperation({
        canvas: fabricCanvas,
        operation,
        objects,
        makeName: nextName,
        subtractDirection
      })
      if (error || !result) {
        booleanError.value = error || '布尔运算失败'
        return
      }
      syncActiveObject(result)
      refreshLayers()
    } finally {
      skipSnapshot = false
      booleanBusy.value = false
    }
    snapshot()
  }

  // 生成描边轮廓对象使用的填充样式：用原描边色填充轮廓，并关闭新对象自身描边。
  function createStrokeOutlineStyle(style: FabricBooleanStyleSnapshot): FabricBooleanStyleSnapshot {
    const fill = typeof style.stroke === 'string' && isFillEnabled(style.stroke)
      ? style.stroke
      : style.lastStroke || '#000000'
    return {
      ...style,
      fill,
      stroke: 'transparent',
      strokeWidth: 0,
      strokeDashArray: null,
      lastFill: fill,
      fillMode: 'solid',
      fillGradientType: undefined,
      fillGradientStops: undefined,
      fillGradientAngle: undefined,
      fillGradientCenterX: undefined,
      fillGradientCenterY: undefined,
      fillGradientRadius: undefined
    }
  }

  // 批量描边转轮廓失败时回滚已完成的对象替换，尽量恢复到转换前的画布结构和源对象描边状态。
  function rollbackStrokeOutlineConversions(results: StrokeOutlineResult[]) {
    if (!fabricCanvas) return
    results.slice().reverse().forEach(({ source, outline, sourceIndex, keepFilledSource, style }) => {
      if (fabricCanvas!.getObjects().includes(outline)) {
        fabricCanvas!.remove(outline as AnyFabricObject)
      }
      if (keepFilledSource) {
        source.set({
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          strokeDashArray: style.strokeDashArray ? [...style.strokeDashArray] : null
        })
        ;(source as AnyFabricObject).lastStroke = style.lastStroke
        ;(source as AnyFabricObject).lastStrokeWidth = style.lastStrokeWidth
        ;(source as AnyFabricObject).lastStrokeDashArray = style.lastStrokeDashArray ? [...style.lastStrokeDashArray] : null
      } else if (!fabricCanvas!.getObjects().includes(source)) {
        fabricCanvas!.insertAt(Math.min(sourceIndex, fabricCanvas!.getObjects().length), source as AnyFabricObject)
      }
      source.dirty = true
      source.setCoords()
    })
  }

  // 把单个对象的可见描边转换成独立可编辑路径；有填充的源对象保留填充但移除描边以维持视觉效果。
  async function convertObjectStrokeToOutline(obj: FabricObject): Promise<StrokeOutlineResult> {
    if (!fabricCanvas) throw new Error('画布尚未初始化')
    const pathKit = await getPathKit()
    const sourceIndex = Math.max(0, fabricCanvas.getObjects().indexOf(obj))
    const converted = fabricStrokeToPathKitWithApi(pathKit, obj)
    if (converted.error) throw new Error(converted.error)
    if (!converted.path || !converted.style) throw new Error('描边轮廓转换失败')
    try {
      const outline = pathKitToFabricPath(converted.path, {
        name: nextName(`${getObjectDisplayName(obj)} 轮廓`),
        shapeId: 'stroke-outline',
        style: createStrokeOutlineStyle(converted.style),
        sourceCornerRadius: null
      })
      if (!outline) throw new Error('描边轮廓转换失败')
      applyDefaultEndpointSnapMargin(outline)
      ensureEditorObjectId(outline)
      applyCanvasThemeToObject(outline)
      const keepFilledSource = isFillEnabled(obj.fill)
      if (keepFilledSource) {
        obj.set({ stroke: 'transparent', strokeWidth: 0, strokeDashArray: null })
        ;(obj as AnyFabricObject).lastStroke = converted.style.lastStroke
        ;(obj as AnyFabricObject).lastStrokeWidth = converted.style.lastStrokeWidth
        obj.dirty = true
        obj.setCoords()
        fabricCanvas.insertAt(Math.min(sourceIndex + 1, fabricCanvas.getObjects().length), outline as AnyFabricObject)
      } else {
        removeEndpointAttachmentsReferencing(obj)
        fabricCanvas.remove(obj as AnyFabricObject)
        fabricCanvas.insertAt(Math.min(sourceIndex, fabricCanvas.getObjects().length), outline as AnyFabricObject)
      }
      return { source: obj, outline, sourceIndex, keepFilledSource, style: converted.style }
    } finally {
      converted.path.delete()
    }
  }

  // 对当前选择批量执行描边转轮廓；转换前先完整校验所有对象，避免一部分对象已转换后才因后续对象失败而留下半成品。
  async function convertSelectionStrokeToOutline() {
    if (!fabricCanvas || strokeOutlineBusy.value) return
    const canvasObjects = fabricCanvas.getObjects()
    const targets = fabricCanvas.getActiveObjects()
      .filter((obj) => canvasObjects.includes(obj) && !isBooleanPreviewObject(obj))
      .sort((a, b) => canvasObjects.indexOf(a) - canvasObjects.indexOf(b))
    if (!targets.length) return

    const unsupportedReason = targets
      .map((target) => getStrokeOutlineUnsupportedReason(target))
      .find((reason): reason is string => !!reason)
    if (unsupportedReason) {
      booleanError.value = unsupportedReason
      return
    }

    strokeOutlineBusy.value = true
    booleanError.value = ''
    clearBooleanPreview()
    clearPointEditing()
    const outlines: FabricObject[] = []
    const convertedResults: StrokeOutlineResult[] = []
    skipSnapshot = true
    try {
      fabricCanvas.discardActiveObject()
      for (const target of targets) {
        const result = await convertObjectStrokeToOutline(target)
        convertedResults.push(result)
        outlines.push(result.outline)
      }
    } catch (error) {
      rollbackStrokeOutlineConversions(convertedResults)
      outlines.length = 0
      booleanError.value = error instanceof Error ? error.message : '描边转轮廓失败'
    } finally {
      skipSnapshot = false
      strokeOutlineBusy.value = false
    }
    if (!outlines.length) {
      fabricCanvas.requestRenderAll()
      return
    }
    setSelectionMode('shape')
    applyActiveObjectsSelection(outlines)
    refreshLayers()
    fabricCanvas.requestRenderAll()
    snapshot()
  }

  // 根据当前画布尺寸选择文字追踪倍率，避免超大画布在文字转轮廓时生成过大的离屏位图。
  function getTextOutlineTraceMultiplier() {
    const maxSide = Math.max(canvasWidth.value, canvasHeight.value, 1)
    return Math.max(0.5, Math.min(TEXT_OUTLINE_TRACE_MULTIPLIER, 1536 / maxSide))
  }

  // 仅渲染目标文字到透明离屏画布，后续通过 alpha 蒙版追踪出近似轮廓路径。
  function renderTextObjectMaskCanvas(text: Textbox, multiplier: number) {
    if (!fabricCanvas) return null
    const currentZoom = fabricCanvas.getZoom()
    const currentWidth = fabricCanvas.getWidth()
    const currentHeight = fabricCanvas.getHeight()
    const currentBg = fabricCanvas.backgroundColor
    const visibility = new Map<FabricObject, boolean | undefined>()
    fabricCanvas.getObjects().forEach((obj) => visibility.set(obj, obj.visible))
    try {
      text.exitEditing?.()
      fabricCanvas.discardActiveObject()
      fabricCanvas.setZoom(1)
      fabricCanvas.setDimensions({ width: canvasWidth.value, height: canvasHeight.value })
      fabricCanvas.backgroundColor = ''
      fabricCanvas.getObjects().forEach((obj) => {
        obj.visible = obj === text
      })
      text.visible = true
      fabricCanvas.requestRenderAll()
      return (fabricCanvas as any).toCanvasElement({ multiplier, enableRetinaScaling: false }) as HTMLCanvasElement
    } finally {
      visibility.forEach((visible, obj) => { obj.visible = visible })
      fabricCanvas.backgroundColor = currentBg
      fabricCanvas.setZoom(currentZoom)
      fabricCanvas.setDimensions({ width: currentWidth, height: currentHeight })
      fabricCanvas.requestRenderAll()
    }
  }

  // 将文字位图的 alpha 蒙版按横向连续像素段写成 PathKit 矩形路径，再交给 simplify 合并为轮廓。
  function createPathFromTextMask(pathKit: any, maskCanvas: HTMLCanvasElement, multiplier: number) {
    const ctx = maskCanvas.getContext('2d')
    if (!ctx) return null
    const { width, height } = maskCanvas
    const data = ctx.getImageData(0, 0, width, height).data
    const path = pathKit.NewPath()
    let hasPixels = false
    for (let y = 0; y < height; y += 1) {
      let x = 0
      while (x < width) {
        const alpha = data[(y * width + x) * 4 + 3]
        if (alpha <= TEXT_OUTLINE_ALPHA_THRESHOLD) {
          x += 1
          continue
        }
        const startX = x
        while (x < width && data[(y * width + x) * 4 + 3] > TEXT_OUTLINE_ALPHA_THRESHOLD) x += 1
        path.rect(startX / multiplier, y / multiplier, (x - startX) / multiplier, 1 / multiplier)
        hasPixels = true
      }
    }
    if (!hasPixels) {
      path.delete()
      return null
    }
    path.simplify?.()
    return path
  }

  // 生成文字轮廓路径的样式，使用原文字填充色或描边色作为轮廓填充色。
  function createTextOutlineStyle(text: Textbox): FabricBooleanStyleSnapshot {
    const fill = typeof text.fill === 'string' && isFillEnabled(text.fill)
      ? text.fill
      : typeof text.stroke === 'string' && isFillEnabled(text.stroke)
        ? text.stroke
        : '#000000'
    return {
      fill,
      stroke: 'transparent',
      strokeWidth: 0,
      strokeDashArray: null,
      opacity: text.opacity ?? 1,
      strokeUniform: false,
      fillRule: 'nonzero',
      lastFill: fill,
      lastStroke: typeof text.stroke === 'string' ? text.stroke : undefined,
      lastStrokeWidth: Number(text.strokeWidth || 0),
      lastStrokeDashArray: null,
      fillMode: 'solid'
    }
  }

  // 将单个 Fabric Textbox 近似追踪为可编辑填充路径，并放回原文字所在图层位置。
  async function convertTextObjectToOutline(text: Textbox) {
    if (!fabricCanvas) throw new Error('画布尚未初始化')
    const sourceIndex = Math.max(0, fabricCanvas.getObjects().indexOf(text))
    const multiplier = getTextOutlineTraceMultiplier()
    const maskCanvas = renderTextObjectMaskCanvas(text, multiplier)
    if (!maskCanvas) throw new Error('文字轮廓渲染失败')
    const pathKit = await getPathKit()
    const tracedPath = createPathFromTextMask(pathKit, maskCanvas, multiplier)
    if (!tracedPath) throw new Error('未识别到可转换的文字轮廓')
    try {
      const outline = pathKitToFabricPath(tracedPath, {
        name: nextName(`${getObjectDisplayName(text)} 轮廓`),
        shapeId: 'text-outline',
        style: createTextOutlineStyle(text),
        sourceCornerRadius: null
      })
      if (!outline) throw new Error('文字轮廓转换失败')
      applyDefaultEndpointSnapMargin(outline)
      ensureEditorObjectId(outline)
      applyCanvasThemeToObject(outline)
      removeEndpointAttachmentsReferencing(text)
      fabricCanvas.remove(text as AnyFabricObject)
      fabricCanvas.insertAt(Math.min(sourceIndex, fabricCanvas.getObjects().length), outline as AnyFabricObject)
      return outline
    } finally {
      tracedPath.delete()
    }
  }

  // 对当前选中文字批量执行文字转轮廓，输出为可点位编辑、可导出的近似矢量路径。
  async function convertSelectionTextToOutline() {
    if (!fabricCanvas || textOutlineBusy.value) return
    const canvasObjects = fabricCanvas.getObjects()
    const targets = fabricCanvas.getActiveObjects()
      .filter((obj): obj is Textbox => obj instanceof Textbox && canvasObjects.includes(obj))
      .sort((a, b) => canvasObjects.indexOf(a) - canvasObjects.indexOf(b))
    if (!targets.length) return

    textOutlineBusy.value = true
    booleanError.value = ''
    clearBooleanPreview()
    clearPointEditing()
    const outlines: FabricObject[] = []
    skipSnapshot = true
    try {
      fabricCanvas.discardActiveObject()
      for (const target of targets) {
        outlines.push(await convertTextObjectToOutline(target))
      }
    } catch (error) {
      booleanError.value = error instanceof Error ? error.message : '文字转轮廓失败'
    } finally {
      skipSnapshot = false
      textOutlineBusy.value = false
    }
    if (!outlines.length) {
      fabricCanvas.requestRenderAll()
      return
    }
    setSelectionMode('shape')
    applyActiveObjectsSelection(outlines)
    refreshLayers()
    fabricCanvas.requestRenderAll()
    snapshot()
  }

  // 将图片转矢量阈值限制在 0-255，避免无效输入导致黑白追踪结果全空或全满。
  function normalizeBitmapTraceThreshold(value: unknown) {
    const parsed = Math.round(Number(value))
    if (!Number.isFinite(parsed)) return BITMAP_VECTOR_DEFAULT_THRESHOLD
    return Math.max(0, Math.min(255, parsed))
  }

  // 切换位图追踪模式：透明模式提取非透明轮廓，黑白模式按亮度阈值提取深色区域。
  function setBitmapTraceMode(mode: BitmapTraceMode) {
    objProps.bitmapTraceMode = mode
  }

  // 提交黑白位图追踪阈值输入，非法值回退到默认阈值并同步面板显示。
  function setBitmapTraceThresholdFromInput(value: string | number) {
    const normalized = normalizeBitmapTraceThreshold(value)
    objProps.bitmapTraceThreshold = normalized
    objProps.bitmapTraceThresholdInput = String(normalized)
  }

  // 根据画布尺寸选择位图追踪倍率，控制离屏像素总量，避免大画布转换时占用过多内存。
  function getBitmapVectorTraceMultiplier() {
    const maxSide = Math.max(canvasWidth.value, canvasHeight.value, 1)
    return Math.max(0.25, Math.min(BITMAP_VECTOR_TRACE_MULTIPLIER, BITMAP_VECTOR_MAX_TRACE_SIDE / maxSide))
  }

  // 仅渲染目标图片到透明离屏画布，保留其缩放、旋转和位置后再进行像素蒙版追踪。
  function renderBitmapObjectMaskCanvas(image: FabricImage, multiplier: number) {
    if (!fabricCanvas) return null
    const currentZoom = fabricCanvas.getZoom()
    const currentWidth = fabricCanvas.getWidth()
    const currentHeight = fabricCanvas.getHeight()
    const currentBg = fabricCanvas.backgroundColor
    const visibility = new Map<FabricObject, boolean | undefined>()
    fabricCanvas.getObjects().forEach((obj) => visibility.set(obj, obj.visible))
    try {
      fabricCanvas.discardActiveObject()
      fabricCanvas.setZoom(1)
      fabricCanvas.setDimensions({ width: canvasWidth.value, height: canvasHeight.value })
      fabricCanvas.backgroundColor = ''
      fabricCanvas.getObjects().forEach((obj) => {
        obj.visible = obj === image
      })
      image.visible = true
      fabricCanvas.requestRenderAll()
      return (fabricCanvas as any).toCanvasElement({ multiplier, enableRetinaScaling: false }) as HTMLCanvasElement
    } finally {
      visibility.forEach((visible, obj) => { obj.visible = visible })
      fabricCanvas.backgroundColor = currentBg
      fabricCanvas.setZoom(currentZoom)
      fabricCanvas.setDimensions({ width: currentWidth, height: currentHeight })
      fabricCanvas.requestRenderAll()
    }
  }

  // 判断位图像素是否应进入追踪蒙版；透明模式看 alpha，黑白模式额外按亮度阈值筛选深色像素。
  function shouldTraceBitmapPixel(data: Uint8ClampedArray, offset: number, mode: BitmapTraceMode, threshold: number) {
    const alpha = data[offset + 3]
    if (alpha <= BITMAP_VECTOR_ALPHA_THRESHOLD) return false
    if (mode === 'alpha') return true
    const luminance = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722
    return luminance <= threshold
  }

  // 将位图蒙版按横向连续像素段写成 PathKit 矩形路径，再简化为可编辑矢量轮廓。
  function createPathFromBitmapMask(pathKit: any, maskCanvas: HTMLCanvasElement, multiplier: number, mode: BitmapTraceMode, threshold: number) {
    const ctx = maskCanvas.getContext('2d')
    if (!ctx) return null
    const { width, height } = maskCanvas
    const data = ctx.getImageData(0, 0, width, height).data
    const path = pathKit.NewPath()
    let hasPixels = false
    for (let y = 0; y < height; y += 1) {
      let x = 0
      while (x < width) {
        const offset = (y * width + x) * 4
        if (!shouldTraceBitmapPixel(data, offset, mode, threshold)) {
          x += 1
          continue
        }
        const startX = x
        while (x < width && shouldTraceBitmapPixel(data, (y * width + x) * 4, mode, threshold)) x += 1
        path.rect(startX / multiplier, y / multiplier, (x - startX) / multiplier, 1 / multiplier)
        hasPixels = true
      }
    }
    if (!hasPixels) {
      path.delete()
      return null
    }
    path.simplify?.()
    return path
  }

  // 生成图片追踪结果的基础样式，默认以黑色填充输出，保留源图片透明度便于视觉对照。
  function createBitmapVectorStyle(image: FabricImage): FabricBooleanStyleSnapshot {
    return {
      fill: '#000000',
      stroke: 'transparent',
      strokeWidth: 0,
      strokeDashArray: null,
      opacity: image.opacity ?? 1,
      strokeUniform: false,
      fillRule: 'nonzero',
      lastFill: '#000000',
      lastStroke: 'transparent',
      lastStrokeWidth: 0,
      lastStrokeDashArray: null,
      fillMode: 'solid'
    }
  }

  // 将单个 Fabric Image 栅格化追踪成可编辑路径，并替换到源图片所在图层位置。
  async function vectorizeBitmapObject(image: FabricImage) {
    if (!fabricCanvas) throw new Error('画布尚未初始化')
    const sourceIndex = Math.max(0, fabricCanvas.getObjects().indexOf(image))
    const multiplier = getBitmapVectorTraceMultiplier()
    const maskCanvas = renderBitmapObjectMaskCanvas(image, multiplier)
    if (!maskCanvas) throw new Error('图片追踪渲染失败')
    const pathKit = await getPathKit()
    const tracedPath = createPathFromBitmapMask(
      pathKit,
      maskCanvas,
      multiplier,
      objProps.bitmapTraceMode,
      normalizeBitmapTraceThreshold(objProps.bitmapTraceThreshold)
    )
    if (!tracedPath) throw new Error('未识别到可转换的图片轮廓，请调整追踪模式或阈值')
    try {
      const outline = pathKitToFabricPath(tracedPath, {
        name: nextName(`${getObjectDisplayName(image)} 矢量`),
        shapeId: 'bitmap-vector',
        style: createBitmapVectorStyle(image),
        sourceCornerRadius: null
      })
      if (!outline) throw new Error('图片转矢量失败')
      applyDefaultEndpointSnapMargin(outline)
      ensureEditorObjectId(outline)
      applyCanvasThemeToObject(outline)
      removeEndpointAttachmentsReferencing(image)
      fabricCanvas.remove(image as AnyFabricObject)
      fabricCanvas.insertAt(Math.min(sourceIndex, fabricCanvas.getObjects().length), outline as AnyFabricObject)
      return outline
    } finally {
      tracedPath.delete()
    }
  }

  // 对当前选中的一张或多张图片执行位图追踪，输出可点位编辑、可导出的黑白矢量路径。
  async function vectorizeSelectionBitmap() {
    if (!fabricCanvas || bitmapTraceBusy.value) return
    const canvasObjects = fabricCanvas.getObjects()
    const targets = fabricCanvas.getActiveObjects()
      .filter((obj): obj is FabricImage => obj instanceof FabricImage && canvasObjects.includes(obj))
      .sort((a, b) => canvasObjects.indexOf(a) - canvasObjects.indexOf(b))
    if (!targets.length) return

    bitmapTraceBusy.value = true
    booleanError.value = ''
    clearBooleanPreview()
    clearPointEditing()
    const outlines: FabricObject[] = []
    skipSnapshot = true
    try {
      fabricCanvas.discardActiveObject()
      for (const target of targets) {
        outlines.push(await vectorizeBitmapObject(target))
      }
    } catch (error) {
      booleanError.value = error instanceof Error ? error.message : '图片转矢量失败'
    } finally {
      skipSnapshot = false
      bitmapTraceBusy.value = false
    }
    if (!outlines.length) {
      fabricCanvas.requestRenderAll()
      return
    }
    setSelectionMode('shape')
    applyActiveObjectsSelection(outlines)
    refreshLayers()
    fabricCanvas.requestRenderAll()
    snapshot()
  }

  // ── 图层 ──
  function isLayerKaleidoscopeLocked(obj: FabricObject) {
    return isKaleidoscopeInstance(obj)
  }

  function layerUp() {
    const obj = activeObject.value
    if (!obj || !fabricCanvas) return
    fabricCanvas.bringObjectForward(obj as AnyFabricObject)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
  }

  function layerDown() {
    const obj = activeObject.value
    if (!obj || !fabricCanvas) return
    fabricCanvas.sendObjectBackwards(obj as AnyFabricObject)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
  }

  function layerTop() {
    const obj = activeObject.value
    if (!obj || !fabricCanvas) return
    fabricCanvas.bringObjectToFront(obj as AnyFabricObject)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
  }

  function layerBottom() {
    const obj = activeObject.value
    if (!obj || !fabricCanvas) return
    fabricCanvas.sendObjectToBack(obj as AnyFabricObject)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    snapshot()
  }

  // 切换左侧插入面板显隐；仅调整壳层布局，不重置标签状态，确保当前插入分类在再次展开后保持原样。
  function toggleLeftPanel() {
    leftPanelCollapsed.value = !leftPanelCollapsed.value
  }

  // 切换钢笔描点工具：激活或退出（退出时按确认生成语义提交当前描点）。
  function togglePenTool() {
    if (penToolActive.value) {
      penCommands.deactivate(true)
    } else {
      penCommands.activate()
    }
  }

  // 切换底部轻量预览浮层显隐；展开时触发预览更新，收起时合并掉等待中的刷新计时器。
  function handlePreviewPopoverShowChange(show: boolean) {
    previewPopoverVisible.value = show
    if (!show) cancelSmallPreviewsRefresh()
  }

  // 在画布对象上打开与图层面板复用的快捷菜单；兼容 Fabric 命中结果，空白区或预览对象不触发菜单。
  function openCanvasObjectContextMenu(event: MouseEvent) {
    if (penToolActive.value) return
    if (!fabricCanvas) return
    const targetInfo = fabricCanvas.findTarget(event) as unknown
    const foundTarget = targetInfo && typeof targetInfo === 'object' && 'target' in targetInfo
      ? (targetInfo as { target?: FabricObject | ActiveSelection | null }).target
      : targetInfo as FabricObject | ActiveSelection | null | undefined
    const target = foundTarget instanceof ActiveSelection
      ? fabricCanvas.getActiveObjects().find((obj) => !isBooleanPreviewObject(obj))
      : foundTarget
    if (!target || isBooleanPreviewObject(target)) return
    openLayerContextMenu(target, event)
  }

  // 切换画布视图模式；SVG 模式只读展示当前画布导出的文本结果，不销毁真实 Fabric 画布节点。
  function setCanvasViewMode(mode: 'canvas' | 'svg') {
    canvasViewMode.value = mode
  }

  function isEditableTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false
    const tag = target.tagName.toLowerCase()
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
  }

  function isFabricTextboxEditing() {
    const obj = fabricCanvas?.getActiveObject() ?? activeObject.value
    return obj instanceof Textbox && obj.isEditing
  }

  function shouldIgnoreEditorShortcut(event: KeyboardEvent) {
    if (pasteSVGDialog.show || exportDialog.show) return true
    if (event.isComposing) return true
    if (isEditableTarget(event.target)) return true
    const target = event.target
    if (target instanceof HTMLElement) {
      if (target.closest('.shortcut-drawer') || target.closest('.zt-drawer__mask')) return true
      if (target.closest('.zt-hotkey-input')) return true
    }
    return isFabricTextboxEditing()
  }

  function getArrowNudgeDelta(key: string) {
    if (key === 'ArrowUp') return { dx: 0, dy: -1 }
    if (key === 'ArrowDown') return { dx: 0, dy: 1 }
    if (key === 'ArrowLeft') return { dx: -1, dy: 0 }
    if (key === 'ArrowRight') return { dx: 1, dy: 0 }
    return null
  }

  // 在画布区域按住 Ctrl + 滚轮时，以指针位置为锚点缩放并同步平移偏移，避免浏览器接管页面缩放。
  function handleCanvasAreaWheel(event: WheelEvent) {
    if (!event.ctrlKey || !canvasAreaRef.value) return
    event.preventDefault()
    const area = canvasAreaRef.value
    const rect = area.getBoundingClientRect()
    const pointerOffsetX = event.clientX - rect.left
    const pointerOffsetY = event.clientY - rect.top
    const currentZoom = zoom.value
    const logicalX = (pointerOffsetX - canvasPanX.value) / currentZoom
    const logicalY = (pointerOffsetY - canvasPanY.value) / currentZoom
    setZoom(currentZoom * Math.exp(-event.deltaY * 0.002))
    canvasPanX.value = pointerOffsetX - logicalX * zoom.value
    canvasPanY.value = pointerOffsetY - logicalY * zoom.value
  }

  // 仅在空格平移模式下接管指针并记录起始偏移，保证任意缩放级别都能拖动画板。
  function handleCanvasAreaPointerDown(event: PointerEvent) {
    if (!spacePanReady.value || !canvasAreaRef.value) return
    event.preventDefault()
    event.stopPropagation()
    const area = canvasAreaRef.value
    area.setPointerCapture?.(event.pointerId)
    spacePanStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: canvasPanX.value,
      panY: canvasPanY.value
    }
    isSpacePanning.value = true
    window.addEventListener('pointermove', handleSpacePanPointerMove, true)
    window.addEventListener('pointerup', handleSpacePanPointerEnd, true)
    window.addEventListener('pointercancel', handleSpacePanPointerEnd, true)
  }

  // 按指针位移直接更新画布包裹层平移量，避免依赖容器滚动条才能看到拖动画布结果。
  function handleSpacePanPointerMove(event: PointerEvent) {
    if (!spacePanStart || event.pointerId !== spacePanStart.pointerId) return
    event.preventDefault()
    canvasPanX.value = spacePanStart.panX + (event.clientX - spacePanStart.x)
    canvasPanY.value = spacePanStart.panY + (event.clientY - spacePanStart.y)
  }

  function handleSpacePanPointerEnd(event?: PointerEvent) {
    if (event && spacePanStart && event.pointerId !== spacePanStart.pointerId) return
    if (spacePanStart && canvasAreaRef.value) {
      try { canvasAreaRef.value.releasePointerCapture?.(spacePanStart.pointerId) } catch {}
    }
    spacePanStart = null
    isSpacePanning.value = false
    window.removeEventListener('pointermove', handleSpacePanPointerMove, true)
    window.removeEventListener('pointerup', handleSpacePanPointerEnd, true)
    window.removeEventListener('pointercancel', handleSpacePanPointerEnd, true)
  }

  function endSpacePan() {
    spacePanReady.value = false
    handleSpacePanPointerEnd()
  }

  function nudgeActiveObject(dx: number, dy: number) {
    const obj = fabricCanvas?.getActiveObject() ?? activeObject.value
    if (!obj || !fabricCanvas) return false
    const currentLeft = obj.left ?? 0
    const currentTop = obj.top ?? 0
    const nextLeft = obj.lockMovementX ? currentLeft : currentLeft + dx
    const nextTop = obj.lockMovementY ? currentTop : currentTop + dy
    if (nextLeft === currentLeft && nextTop === currentTop) return false
    clearBooleanPreview()
    obj.set({ left: nextLeft, top: nextTop })
    snapObjectPositionToPixelGrid(obj)
    clearOwnedEndpointAttachmentsForTransformedObject(obj)
    obj.setCoords()
    syncEndpointsForChangedObject(obj)
    fabricCanvas.requestRenderAll()
    triggerKaleidoscopeTransformSync(obj)
    refreshLayers()
    syncObjProps()
    snapshot()
    return true
  }

  function handleKeydown(e: KeyboardEvent) {
    if (shouldIgnoreEditorShortcut(e)) return
    if (e.key === ' ' && !e.repeat) {
      spacePanReady.value = true
      e.preventDefault()
      return
    }
    if (e.key === 'Shift') rulerModifierKeys.shift = true
    if (e.key === 'Control') rulerModifierKeys.ctrl = true
    if (e.key === 'Alt') rulerModifierKeys.alt = true
    if (e.key === 'Meta') rulerModifierKeys.meta = true
    // 钢笔工具下 ESC 退出并生成图形（>=2 点）；右键撤销上一点不经过键盘。
    if (penToolActive.value && e.key === 'Escape') {
      e.preventDefault()
      penCommands.deactivate(true)
      return
    }
    const action = getShortcutActionByEvent(e)
    if (action) {
      e.preventDefault()
      void executeShortcutAction(action.id)
      return
    }
    const activeObjects = fabricCanvas?.getActiveObjects() ?? []
    if (!activeObjects.length || selectionMode.value !== 'shape' || e.altKey || e.ctrlKey || e.metaKey) return
    const delta = getArrowNudgeDelta(e.key)
    if (!delta) return
    e.preventDefault()
    const step = e.shiftKey ? 10 : 1
    nudgeActiveObject(delta.dx * step, delta.dy * step)
  }

  function handleKeyup(e: KeyboardEvent) {
    if (e.key === ' ') endSpacePan()
    if (e.key === 'Shift') rulerModifierKeys.shift = false
    if (e.key === 'Control') rulerModifierKeys.ctrl = false
    if (e.key === 'Alt') rulerModifierKeys.alt = false
    if (e.key === 'Meta') rulerModifierKeys.meta = false
  }

  function handleWindowBlur() {
    rulerModifierKeys.shift = false
    rulerModifierKeys.ctrl = false
    rulerModifierKeys.alt = false
    rulerModifierKeys.meta = false
    endSpacePan()
  }

  // ── Fabric 事件 ──
  function setupCanvasEvents() {
    if (!fabricCanvas) return

    fabricCanvas.on('mouse:down:before', (event) => {
      // ── 钢笔工具（正交开关，优先于选择模式判定） ──
      if (penToolActive.value) {
        const penEvent = event.e as MouseEvent
        if (penEvent.button === 2) {
          penCommands.handlePenRightClick()
          return
        }
        if (penEvent.button === 0) {
          const scenePoint = event.scenePoint ?? fabricCanvas.getScenePoint(event.e)
          penCommands.handlePenLeftDown({ x: scenePoint.x, y: scenePoint.y })
        }
        return
      }
      // 重置上一轮残留 (例如 selection 事件没正常 fire 时)
      setPointModeSwitchPending(false)
      if (!fabricCanvas || !activeObject.value) return
      if (selectionMode.value === 'shape') return
      const scenePoint = event.scenePoint ?? fabricCanvas.getScenePoint(event.e)
      const viewportPoint = event.viewportPoint ?? fabricCanvas.getViewportPoint(event.e)
      if (selectionMode.value === 'segment') {
        // 若点击落在 active 对象的控件上（如 cp1/cp2 辅助点或边中点辅助器），交给控件自身处理，
        // 避免误触发 handleSegmentPointerDown 导致选中相邻边、控件被重建后无法继续拖动
        const active = activeObject.value as AnyFabricObject | null
        if (active && typeof active.findControl === 'function') {
          const hit = active.findControl(viewportPoint, util.isTouchEvent(event.e))
          if (hit) return
        }
        const handled = handleSegmentPointerDown(scenePoint.x, scenePoint.y)
        if (handled) {
          setRestoreActiveObjectAfterSelectionClear()
          fabricCanvas.discardActiveObject(event.e)
          return
        }
        const target = event.target
        if (target && target !== activeObject.value) {
          setRestoreActiveObjectAfterSelectionClear()
          fabricCanvas.discardActiveObject(event.e)
        }
        return
      }
      // ── point 模式 ──
      const editable = activeEditablePathObject.value
      const target = event.target
      const nativeMouseEvent = event.e as MouseEvent
      const multiSelectModifier = isMultiSelectModifierPressed(nativeMouseEvent)
      if (editable && typeof editable.findControl === 'function') {
        const hit = editable.findControl(viewportPoint, util.isTouchEvent(event.e))
        if (hit) {
          // 命中点控件 -> 由 control 自身的 mouseDownHandler 调用 beginPointControlGesture
          return
        }
      }
      if (multiSelectModifier) {
        // 修饰键: 维持 box-select / 加法选点流程
        beginBlankPointGesture(nativeMouseEvent)
        setRestoreActiveObjectAfterSelectionClear()
        fabricCanvas.discardActiveObject(event.e)
        return
      }
      // 无修饰键, 点击其它图形 -> 切换到对应图形的点位模式
      if (target && target !== activeObject.value) {
        setPointModeSwitchPending()
        return
      }
      // 无修饰键, 点击当前 active 对象本体 / 空白区 -> 不做任何操作 (保持 active 与已选点)
      setRestoreActiveObjectAfterSelectionClear()
      fabricCanvas.discardActiveObject(event.e)
    })

    fabricCanvas.on('mouse:move', (event) => {
      if (penToolActive.value) {
        penCommands.handlePenPointerMove(event)
        return
      }
      handlePointGestureCanvasMove(event)
    })

    fabricCanvas.on('mouse:up', () => {
      finishPointGesture()
    })

    fabricCanvas.on('after:render', () => {
      drawPointGestureMarquee()
      if (penToolActive.value) penCommands.drawPenOverlay()
    })

    fabricCanvas.on('selection:created', () => {
      clearBooleanPreview()
      if (consumePointModeSwitchPending()) {
        const next = fabricCanvas!.getActiveObject() ?? null
        // 切换到新对象, 然后尝试回到 point 模式 (新对象不可编辑时会自动降级为 shape)
        syncActiveObject(next)
        if (next) setSelectionMode('point')
        return
      }
      if (selectionMode.value !== 'shape') {
        const active = fabricCanvas!.getActiveObject()
        if (active && active !== activeObject.value) {
          fabricCanvas!.discardActiveObject()
          fabricCanvas!.requestRenderAll()
          return
        }
        // 非 shape 模式下若 active 仍等于我们追踪的 activeObject（典型场景：
        // 我们在 selection:cleared 里把焦点 restore 回了同一对象），
        // 直接返回——syncActiveObject 会通过 clearPointEditing 清除已选点
        // 与正在进行的 point 手势状态，从而把焦点/已选状态打没。
        if (active && active === activeObject.value) {
          return
        }
      }
      syncActiveObject(fabricCanvas!.getActiveObject() ?? null)
    })
    fabricCanvas.on('selection:updated', () => {
      clearBooleanPreview()
      if (consumePointModeSwitchPending()) {
        const next = fabricCanvas!.getActiveObject() ?? null
        syncActiveObject(next)
        if (next) setSelectionMode('point')
        return
      }
      if (selectionMode.value !== 'shape') {
        const active = fabricCanvas!.getActiveObject()
        if (activeObject.value && active && active !== activeObject.value) {
          fabricCanvas!.setActiveObject(activeObject.value)
          fabricCanvas!.requestRenderAll()
          return
        }
        // 同上：同一对象时不再 syncActiveObject，避免清除点选/手势状态
        if (active && active === activeObject.value) {
          return
        }
      }
      syncActiveObject(fabricCanvas!.getActiveObject() ?? null)
    })
    fabricCanvas.on('selection:cleared', () => {
      clearBooleanPreview()
      // point 模式下点击切换到其他图形时, Fabric 会先 discardActiveObject 再 setActiveObject(target),
      // 这里跳过中间一拍, 让 selection:created/updated 完成 mode 切换
      if (isPointModeSwitchPending()) {
        return
      }
      // point 模式下若我们正在自定义手势中（无论 blank 还是 point-control），都要保住 active editable
      const protectingPointGesture = shouldProtectPointGestureSelection()
      if ((consumeRestoreActiveObjectAfterSelectionClear() || protectingPointGesture) && activeObject.value && fabricCanvas) {
        fabricCanvas.setActiveObject(activeObject.value)
        updateCurveControls()
        syncObjProps()
        fabricCanvas.requestRenderAll()
        return
      }
      syncActiveObject(null)
    })
    fabricCanvas.on('object:modified', (event) => {
      const target = event.target ?? null
      if (isBooleanPreviewObject(target)) return
      clearBooleanPreview()
      if (target) {
        snapObjectSizeToPixelGrid(target)
        snapObjectPositionToPixelGrid(target)
        target.setCoords()
      }
      syncEndpointsForChangedObject(target)
      triggerKaleidoscopeContentSync(target)
      triggerKaleidoscopeTransformSync(target)
      snapshot()
      syncObjProps()
      refreshLayers()
    })
    // Real-time sync during drag interactions
    fabricCanvas.on('object:scaling', (event) => {
      clearBooleanPreview()
      snapObjectSizeToPixelGrid(event.target ?? null)
      clearOwnedEndpointAttachmentsForTransformedObject(event.target ?? null)
      syncEndpointsForChangedObject(event.target ?? null)
      syncObjProps()
      triggerKaleidoscopeTransformSync(event.target ?? null)
    })
    fabricCanvas.on('object:moving', (event) => {
      clearBooleanPreview()
      snapObjectPositionToPixelGrid(event.target ?? null)
      clearOwnedEndpointAttachmentsForTransformedObject(event.target ?? null)
      syncEndpointsForChangedObject(event.target ?? null)
      syncObjProps()
      triggerKaleidoscopeTransformSync(event.target ?? null)
    })
    fabricCanvas.on('object:rotating', (event) => {
      clearBooleanPreview()
      clearOwnedEndpointAttachmentsForTransformedObject(event.target ?? null)
      syncEndpointsForChangedObject(event.target ?? null)
      syncObjProps()
      triggerKaleidoscopeTransformSync(event.target ?? null)
    })

    // 对象添加/删除时快照
    fabricCanvas.on('object:added', (event) => {
      const target = event.target ?? null
      if (isBooleanPreviewObject(target)) return
      if (target) {
        ensureEditorObjectId(target)
        normalizeEndpointAttachments(target)
        applyDefaultSizeRatioLockMetadata(target)
        applyCanvasThemeToObject(target)
        target.snapAngle = snapToPixelGrid.value ? 15 : undefined
      }
      refreshLayers()
      snapshot()
    })
    fabricCanvas.on('object:removed', (event) => {
      const target = event.target ?? null
      if (isBooleanPreviewObject(target)) return
      if (target) removeEndpointAttachmentsReferencing(target)
      removeKaleidoscopeInstancesForRemovedSource(target)
      refreshLayers()
      snapshot()
    })
  }

  // ── 初始化 ──
  // Canvas Kernel 模块负责 Fabric Canvas 生命周期与基础视口行为；页面仅保留业务回调和运行时注册。
  function createHomeCanvasLifecycleModule(): EditorModule {
    return homeCanvasKernel.module
  }

  // 创建启动数据模块，集中加载不会直接创建画布对象的编辑器基础数据。
  function createHomeStartupDataModule(): EditorModule {
    return {
      name: 'home-startup-data',
      onMount(context) {
        if (!context.getCanvas()) return
        void getPathKit()
        loadUserStylePresets()
      }
    }
  }

  // 创建窗口事件模块，统一注册和释放编辑器级全局监听，避免页面卸载时遗漏清理。
  function createHomeWindowEventsModule(): EditorModule {
    return {
      name: 'home-window-events',
      onDocumentReady(context) {
        const targetWindow = context.services.window
        targetWindow.addEventListener('resize', fitCanvasInView)
        targetWindow.addEventListener('keydown', handleKeydown)
        targetWindow.addEventListener('keyup', handleKeyup)
        targetWindow.addEventListener('blur', handleWindowBlur)
        targetWindow.addEventListener('paste', assetsImportCommands.handleWindowPaste)
      },
      onDispose(context) {
        const targetWindow = context.services.window
        targetWindow.removeEventListener('resize', fitCanvasInView)
        targetWindow.removeEventListener('keydown', handleKeydown)
        targetWindow.removeEventListener('keyup', handleKeyup)
        targetWindow.removeEventListener('blur', handleWindowBlur)
        targetWindow.removeEventListener('paste', assetsImportCommands.handleWindowPaste)
      }
    }
  }

  // 创建 Home 编辑器运行时并注册当前阶段已迁入的生命周期模块。
  function createHomeEditorRuntime(): EditorRuntime {
    const runtime = createEditorRuntime({
      services: createEditorServices(),
      state: {
        store: editorStore,
        commands: editorCommands,
        selectors: editorSelectors
      }
    })
    runtime.register(createHomeCanvasLifecycleModule())
    runtime.register(homeDirectEdit.module)
    runtime.register(homePenTool.module)
    runtime.register(homeWorkspace.module)
    runtime.register(homeAssetsImport.module)
    runtime.register(homeExportDelivery.module)
    runtime.register(createHomeStartupDataModule())
    runtime.register(createHomeWindowEventsModule())
    return runtime
  }

  onMounted(() => {
    editorRuntime = createHomeEditorRuntime()
    void editorRuntime.mount()
  })

  watch(
    () => [isDark.value, primaryColor.value, customColor.value],
    () => {
      applyCanvasTheme()
      fabricCanvas?.requestRenderAll()
    }
  )

  onBeforeUnmount(() => {
    void editorRuntime?.dispose()
    editorRuntime = null
  })

  return {
    canvasElRef,
    canvasAreaRef,
    canvasWrapperRef,
    svgInputRef,
    imgInputRef,
    projectInputRef,
    leftPanelCollapsed,
    leftTab,
    activeRightTab,
    showPixelGrid,
    snapToPixelGrid,
    pixelGridSizeInput,
    keylineTemplate,
    keylineMarginInput,
    keylineOpacity,
    spacePanReady,
    isSpacePanning,
    rulerCoordinateHintActive,
    canvasWidth,
    canvasHeight,
    canvasWidthInput,
    canvasHeightInput,
    canvasPresetValue,
    canvasPresetOptions,
    isCanvasBgTransparent,
    currentFillStyleMode,
    canvasBgPickerValue,
    pixelGridOverlayStyle,
    keylineOverlayStyle,
    canvasWrapperStyle,
    keylineSafeArea,
    iconCheckIssues,
    iconCheckSummary,
    booleanBusy,
    strokeOutlineBusy,
    textOutlineBusy,
    bitmapTraceBusy,
    booleanError,
    subtractPopoverVisible,
    objProps,
    sizeRatioLocked,
    hasSelectedPoint,
    canAlignSelection,
    canBoolean,
    canConvertStrokeSelection,
    canConvertTextSelection,
    canDirectionalSubtract,
    canDistributeSelection,
    canGroup,
    canSaveUserAsset,
    canUngroup,
    canVectorizeBitmapSelection,
    filteredLayers,
    isLayerDragDisabled,
    isLayerDragging,
    layerContextMenu,
    layerContextMenuItems,
    layerDragItems,
    layerRenameDialog,
    layerSearch,
    confirmLayerRename,
    handleLayerContextMenuSelect,
    handleLayerMouseDown,
    handleLayerRenameDialogShowChange,
    isLayerActive,
    openLayerContextMenu,
    removeObject,
    reorderLayers,
    toggleLock,
    toggleVisible,
    toast,
    projectTabs,
    activeProjectTabId,
    hasMultipleProjectTabs,
    addProjectTab,
    switchProjectTab,
    closeProjectTab,
    artboards,
    activeArtboardId,
    artboardRenameDialog,
    undoStack,
    historyIndex,
    addArtboard,
    deleteArtboard,
    duplicateArtboard,
    jumpToHistory,
    onProjectFileChosen: onProjectFileChosenForActiveTab,
    renameArtboard,
    confirmArtboardRename,
    handleArtboardRenameDialogShowChange,
    switchArtboard,
    keylineTemplateOptions,
    previewBackgroundOptions,
    svgPreviewModeOptions,
    previewBackgroundMode,
    canvasViewMode,
    previewPopoverVisible,
    previewItems,
    visibleColorPaletteGroups,
    visibleGradientPresets,
    stylePresetManagerState,
    stylePresetColorColumns,
    stylePresetGradientPresets,
    stylePresetGradientRows,
    defaultStylePresetColorPaletteGroups,
    defaultStylePresetGradientPresets,
    defaultStylePresetColorColumns,
    defaultStylePresetGradientRows,
    stylePresetCurrentFillColor,
    stylePresetCurrentStrokeColor,
    stylePresetCurrentGradientPreset,
    isFillGradientStopPercentDisabled,
    assetsImportCommands,
    importedUserAssets,
    importedUserAssetDialog,
    importedPasteSVGDialog,
    iconifyImportState,
    importedFilteredIconifyResults,
    importedIconifyCollectionOptions,
    exportDialog,
    exportDialogCanExport,
    exportDialogSelectedPreset,
    filteredShortcutGroups,
    shortcutBindings,
    shortcutDrawerOpen,
    shortcutPlatform,
    shortcutSearch,
    addShortcutBinding,
    applyShortcutBinding,
    handleExportDialogShowChange,
    handleExportPresetSelect,
    removeShortcutBinding,
    resetShortcutBindingsToDefault,
    runExportDialogExport,
    setExportFormatEnabled,
    toggleExportPngSize,
    activeKaleidoscopeInstance,
    activeKaleidoscopeEditableSource,
    isHollowShaftArrow,
    hasSelectedCurveSegment,
    hasSelectedArrowEndpoint,
    editorSelectors,
    editorCommands,
    arrowAggregated,
    applyColorSwatch,
    saveCurrentColorSwatch,
    applyGradientPreset,
    saveCurrentGradientPreset,
    openStylePresetManager,
    applyStylePresetSettings,
    handleStylePresetManagerShowChange,
    setPixelGridVisible,
    setSnapToPixelGrid,
    setPixelGridSizeFromInput,
    setKeylineTemplate,
    setKeylineMarginFromInput,
    setKeylineOpacity,
    selectIconCheckIssue,
    setKaleidoscopeCenterFromInput,
    setKaleidoscopeCountFromInput,
    setKaleidoscopeEnabled,
    setKaleidoscopeFollowRotation,
    selectKaleidoscopeSourceFromInstance,
    detachKaleidoscopeInstance,
    handleSubtractPopoverShowChange,
    clearBooleanPreview,
    showBooleanPreview,
    toggleSizeRatioLock,
    setObjProp,
    setObjPropFromInput,
    setEndpointSnapMarginFromInput,
    setCornerRadiusFromInput,
    setSelectedPointCornerRadiusFromInput,
    toggleSelectedArrowEnabled,
    setSelectedArrowShape,
    setSelectedArrowAngle,
    setSelectedArrowLengthFromInput,
    setHollowArrowTipAngle,
    setHollowArrowSideAngle,
    setHollowArrowLineWidthFromInput,
    setSelectedSegmentCurveEnabled,
    setSelectedSegmentControlPointCoordFromInput,
    setStrokeWidthFromInput,
    setStrokeLineType,
    setStrokeDashLengthFromInput,
    setStrokeDashGapFromInput,
    toggleFill,
    setSolidFillColor,
    setFillStyleMode,
    setFillGradientStopColor,
    reorderFillGradientStops,
    setFillGradientStopOffset,
    addFillGradientStop,
    removeFillGradientStop,
    setFillGradientAngleValue,
    setFillGradientRadiusValue,
    toggleStroke,
    setObjSizeFromInput,
    alignPositions,
    alignPopoverVisible,
    currentAlignId,
    currentAlignPosition,
    alignToCanvas,
    selectAlign,
    alignSelection,
    distributeSelection,
    setCanvasSizeFromInput,
    setCanvasBg,
    applyCanvasPreset,
    previewStageClass,
    svgPreviewSource,
    svgPreviewDataUrl,
    highlightedSvgPreviewSource,
    svgPreviewMode,
    svgModeTooltipTitle,
    svgModeTooltipDetail,
    setPreviewBackgroundMode,
    setCanvasViewMode,
    setSvgPreviewMode,
    handlePreviewPopoverShowChange,
    toggleLeftPanel,
    deleteObject,
    lockObject,
    groupObjects,
    ungroupObject,
    runBooleanOperation,
    convertSelectionStrokeToOutline,
    convertSelectionTextToOutline,
    setBitmapTraceMode,
    setBitmapTraceThresholdFromInput,
    vectorizeSelectionBitmap,
    layerUp,
    layerDown,
    layerTop,
    layerBottom,
    openCanvasObjectContextMenu,
    handleCanvasAreaPointerDown,
    handleCanvasAreaWheel,
    penToolActive,
    togglePenTool
  }
}
