<template>
  <div
    class="editor-root"
    :class="{
      'space-pan-ready': spacePanReady,
      'space-panning': isSpacePanning
    }"
  >
    <!-- 顶栏 -->
    <HomeTopBar
      :can-undo="canUndo"
      :can-redo="canRedo"
      :show-ruler="showRuler"
      :show-pixel-grid="showPixelGrid"
      :snap-to-pixel-grid="snapToPixelGrid"
      :keyline-active="keylineTemplate !== 'none'"
      :shortcut-drawer-open="shortcutDrawerOpen"
      :selection-mode="selectionMode"
      :has-editable-points="hasEditablePoints"
      :zoom="zoom"
      @new-doc="newDoc"
      @open-project="openProject"
      @save-project="saveProject"
      @import-svg="importSVG"
      @open-paste-svg="openPasteSVGDialog"
      @import-image="importImage"
      @copy-as-svg="copyAsSVG"
      @copy-as-png="copyAsPNG"
      @open-export="openExportDialog"
      @undo="undo"
      @redo="redo"
      @toggle-ruler="toggleRuler"
      @toggle-pixel-grid="togglePixelGrid"
      @toggle-snap-to-pixel-grid="toggleSnapToPixelGrid"
      @toggle-keyline-overlay="toggleKeylineOverlay"
      @open-shortcut-drawer="openShortcutDrawer"
      @set-selection-mode="setSelectionMode"
      @set-zoom="setZoom"
    />

    <div class="editor-body">
      <!-- 左栏 -->
      <LeftPanel
        :active-tab="leftTab"
        :basic-shapes="basicShapes"
        :shape-preview-paths="shapePreviewPaths"
        :text-presets="textPresets"
        :icon-templates="iconTemplates"
        :user-assets="userAssets"
        :can-save-user-asset="canSaveUserAsset"
        :iconify-search="iconifySearch"
        :filtered-iconify-results="filteredIconifyResults"
        :iconify-collection-options="iconifyCollectionOptions"
        @update:active-tab="leftTab = $event"
        @add-shape="addShape"
        @add-text="addText"
        @insert-template="insertIconTemplate"
        @apply-template-as-document="applyIconTemplateAsDocument"
        @open-create-user-asset-dialog="openCreateUserAssetDialog"
        @insert-user-asset="insertUserAsset"
        @rename-user-asset="openRenameUserAssetDialog"
        @delete-user-asset="deleteUserAsset"
        @update:iconify-query="iconifySearch.query = $event"
        @search-iconify-icons="searchIconifyIcons"
        @update:iconify-collection-filter="iconifySearch.collectionFilter = $event"
        @insert-iconify-icon="insertIconifyIcon"
      />

      <!-- 中间画布区 -->
      <div class="canvas-frame" :class="{ 'with-ruler': showRuler }">
        <main
          class="canvas-area"
          ref="canvasAreaRef"
          @pointerdown.capture="handleCanvasAreaPointerDown"
          @dragover.prevent="handleCanvasDragOver"
          @drop.prevent="handleCanvasDrop"
        >
          <div class="canvas-wrapper" ref="canvasWrapperRef" :class="{ 'transparent-bg': isCanvasBgTransparent }">
            <div
              v-if="showPixelGrid"
              class="pixel-grid-overlay"
              :style="pixelGridOverlayStyle"
              aria-hidden="true"
            ></div>
            <svg
              v-if="keylineTemplate !== 'none'"
              class="keyline-overlay"
              :viewBox="`0 0 ${canvasWidth} ${canvasHeight}`"
              :style="keylineOverlayStyle"
              aria-hidden="true"
            >
              <rect
                class="keyline-safe-area"
                :x="keylineSafeArea.x"
                :y="keylineSafeArea.y"
                :width="keylineSafeArea.width"
                :height="keylineSafeArea.height"
                :rx="keylineSafeArea.radius"
                :ry="keylineSafeArea.radius"
              />
              <template v-if="keylineTemplate === 'material'">
                <circle class="keyline-shape" :cx="canvasWidth / 2" :cy="canvasHeight / 2" :r="keylineSafeArea.width / 2" />
                <rect class="keyline-shape" :x="keylineSafeArea.x" :y="keylineSafeArea.y" :width="keylineSafeArea.width" :height="keylineSafeArea.height" />
                <line class="keyline-axis" :x1="canvasWidth / 2" y1="0" :x2="canvasWidth / 2" :y2="canvasHeight" />
                <line class="keyline-axis" x1="0" :y1="canvasHeight / 2" :x2="canvasWidth" :y2="canvasHeight / 2" />
              </template>
            </svg>
            <canvas ref="canvasElRef"></canvas>
          </div>
        </main>
        <Ruler
          v-if="showRuler"
          :scroll-el="canvasAreaRef"
          :wrapper-el="canvasWrapperRef"
          :zoom="zoom"
          :coordinate-hint-active="rulerCoordinateHintActive"
        />
      </div>

      <!-- 右栏 -->
      <RightPanel
        :active-tab="activeRightTab"
        @update:active-tab="activeRightTab = $event"
      >
        <template #properties>
          <PropertiesPanel
            :active-object="activeObject"
            :active-kaleidoscope-instance="activeKaleidoscopeInstance"
            :active-kaleidoscope-editable-source="activeKaleidoscopeEditableSource"
            :obj-props="objProps"
            :size-ratio-locked="sizeRatioLocked"
            :align-popover-visible="alignPopoverVisible"
            :current-align-position="currentAlignPosition"
            :align-positions="alignPositions"
            :current-align-id="currentAlignId"
            :current-fill-style-mode="currentFillStyleMode"
            :has-editable-points="hasEditablePoints"
            :has-selected-point="hasSelectedPoint"
            :has-selected-arrow-endpoint="hasSelectedArrowEndpoint"
            :arrow-aggregated="arrowAggregated"
            :is-hollow-shaft-arrow="isHollowShaftArrow"
            :has-selected-curve-segment="hasSelectedCurveSegment"
            :can-boolean="canBoolean"
            :can-directional-subtract="canDirectionalSubtract"
            :subtract-popover-visible="subtractPopoverVisible"
            :boolean-busy="booleanBusy"
            :boolean-error="booleanError"
            :can-group="canGroup"
            :can-ungroup="canUngroup"
            :can-align-selection="canAlignSelection"
            :can-distribute-selection="canDistributeSelection"
            :can-convert-stroke-selection="canConvertStrokeSelection"
            :stroke-outline-busy="strokeOutlineBusy"
            :can-convert-text-selection="canConvertTextSelection"
            :text-outline-busy="textOutlineBusy"
            :canvas-preset-value="canvasPresetValue"
            :canvas-preset-options="canvasPresetOptions"
            :canvas-width-input="canvasWidthInput"
            :canvas-height-input="canvasHeightInput"
            :canvas-bg-picker-value="canvasBgPickerValue"
            :is-canvas-bg-transparent="isCanvasBgTransparent"
            :show-pixel-grid="showPixelGrid"
            :snap-to-pixel-grid="snapToPixelGrid"
            :pixel-grid-size-input="pixelGridSizeInput"
            :keyline-template="keylineTemplate"
            :keyline-template-options="keylineTemplateOptions"
            :keyline-margin-input="keylineMarginInput"
            :color-palette-groups="visibleColorPaletteGroups"
            :gradient-presets="visibleGradientPresets"
            :select-kaleidoscope-source-from-instance="selectKaleidoscopeSourceFromInstance"
            :detach-kaleidoscope-instance="detachKaleidoscopeInstance"
            :set-obj-prop-from-input="setObjPropFromInput"
            :set-obj-size-from-input="setObjSizeFromInput"
            :toggle-size-ratio-lock="toggleSizeRatioLock"
            :set-obj-prop="setObjProp"
            :set-endpoint-snap-margin-from-input="setEndpointSnapMarginFromInput"
            :align-to-canvas="alignToCanvas"
            :select-align="selectAlign"
            :toggle-fill="toggleFill"
            :set-fill-style-mode="setFillStyleMode"
            :set-solid-fill-color="setSolidFillColor"
            :reorder-fill-gradient-stops="reorderFillGradientStops"
            :set-fill-gradient-stop-color="setFillGradientStopColor"
            :is-fill-gradient-stop-percent-disabled="isFillGradientStopPercentDisabled"
            :set-fill-gradient-stop-offset="setFillGradientStopOffset"
            :remove-fill-gradient-stop="removeFillGradientStop"
            :add-fill-gradient-stop="addFillGradientStop"
            :set-fill-gradient-angle-value="setFillGradientAngleValue"
            :set-fill-gradient-radius-value="setFillGradientRadiusValue"
            :apply-color-swatch="applyColorSwatch"
            :save-current-color-swatch="saveCurrentColorSwatch"
            :apply-gradient-preset="applyGradientPreset"
            :save-current-gradient-preset="saveCurrentGradientPreset"
            :toggle-stroke="toggleStroke"
            :set-stroke-width-from-input="setStrokeWidthFromInput"
            :set-stroke-line-type="setStrokeLineType"
            :set-stroke-dash-length-from-input="setStrokeDashLengthFromInput"
            :set-stroke-dash-gap-from-input="setStrokeDashGapFromInput"
            :set-corner-radius-from-input="setCornerRadiusFromInput"
            :set-selected-point-corner-radius-from-input="setSelectedPointCornerRadiusFromInput"
            :toggle-selected-arrow-enabled="toggleSelectedArrowEnabled"
            :set-selected-arrow-shape="setSelectedArrowShape"
            :set-selected-arrow-angle="setSelectedArrowAngle"
            :set-hollow-arrow-line-width-from-input="setHollowArrowLineWidthFromInput"
            :set-hollow-arrow-tip-angle="setHollowArrowTipAngle"
            :set-hollow-arrow-side-angle="setHollowArrowSideAngle"
            :set-selected-arrow-length-from-input="setSelectedArrowLengthFromInput"
            :set-selected-segment-curve-enabled="setSelectedSegmentCurveEnabled"
            :set-selected-segment-control-point-coord-from-input="setSelectedSegmentControlPointCoordFromInput"
            :set-kaleidoscope-enabled="setKaleidoscopeEnabled"
            :set-kaleidoscope-center-from-input="setKaleidoscopeCenterFromInput"
            :set-kaleidoscope-follow-rotation="setKaleidoscopeFollowRotation"
            :set-kaleidoscope-count-from-input="setKaleidoscopeCountFromInput"
            :show-boolean-preview="showBooleanPreview"
            :clear-boolean-preview="clearBooleanPreview"
            :run-boolean-operation="runBooleanOperation"
            :handle-subtract-popover-show-change="handleSubtractPopoverShowChange"
            :group-objects="groupObjects"
            :ungroup-object="ungroupObject"
            :align-selection="alignSelection"
            :distribute-selection="distributeSelection"
            :convert-selection-stroke-to-outline="convertSelectionStrokeToOutline"
            :convert-selection-text-to-outline="convertSelectionTextToOutline"
            :lock-object="lockObject"
            :delete-object="deleteObject"
            :apply-canvas-preset="applyCanvasPreset"
            :set-canvas-size-from-input="setCanvasSizeFromInput"
            :set-canvas-bg="setCanvasBg"
            :set-pixel-grid-visible="setPixelGridVisible"
            :set-snap-to-pixel-grid="setSnapToPixelGrid"
            :set-pixel-grid-size-from-input="setPixelGridSizeFromInput"
            :set-keyline-template="setKeylineTemplate"
            :set-keyline-margin-from-input="setKeylineMarginFromInput"
            @update:align-popover-visible="alignPopoverVisible = $event"
            @update:canvas-width-input="canvasWidthInput = $event"
            @update:canvas-height-input="canvasHeightInput = $event"
            @update:pixel-grid-size-input="pixelGridSizeInput = $event"
            @update:keyline-margin-input="keylineMarginInput = $event"
          />
        </template>
        <template #preview>
          <PreviewPanel
            :background-options="previewBackgroundOptions"
            :background-mode="previewBackgroundMode"
            :items="previewItems"
            :stage-class="previewStageClass"
            @set-background-mode="setPreviewBackgroundMode"
          />
        </template>
        <template #checks>
          <IconChecksPanel
            :issues="iconCheckIssues"
            @select-issue="selectIconCheckIssue"
          />
        </template>
        <template #layers>
          <LayersPanel
            :filtered-layers="filteredLayers"
            :layer-drag-items="layerDragItems"
            :is-layer-drag-disabled="isLayerDragDisabled"
            :layer-search="layerSearch"
            :layer-context-menu="layerContextMenu"
            :layer-context-menu-items="layerContextMenuItems"
            :is-layer-active="isLayerActive"
            @update:layer-drag-items="layerDragItems = $event"
            @update:layer-search="layerSearch = $event"
            @layer-up="layerUp"
            @layer-down="layerDown"
            @layer-top="layerTop"
            @layer-bottom="layerBottom"
            @drag-start="isLayerDragging = true"
            @reorder-layers="reorderLayers"
            @layer-mouse-down="handleLayerMouseDown"
            @open-context-menu="openLayerContextMenu"
            @toggle-visible="toggleVisible"
            @toggle-lock="toggleLock"
            @remove-object="removeObject"
            @update-context-menu-show="layerContextMenu.show = $event"
            @context-menu-select="handleLayerContextMenuSelect"
          />
        </template>
      </RightPanel>
    </div>

    <ShortcutDrawer
      v-model:show="shortcutDrawerOpen"
      v-model:search="shortcutSearch"
      :groups="filteredShortcutGroups"
      :bindings="shortcutBindings"
      :platform="shortcutPlatform"
      @close="closeShortcutDrawer"
      @reset="resetShortcutBindingsToDefault"
      @apply-binding="applyShortcutBinding"
      @add-binding="addShortcutBinding"
      @remove-binding="removeShortcutBinding"
    />

    <PasteSvgModal
      :show="pasteSVGDialog.show"
      v-model:value="pasteSVGDialog.value"
      :error="pasteSVGDialog.error"
      :loading="pasteSVGDialog.loading"
      @update:show="handlePasteSVGDialogShowChange"
      @read-clipboard="readClipboardIntoPasteSVGDialog"
      @confirm="confirmPasteSVGImport"
    />

    <ExportModal
      :show="exportDialog.show"
      :dialog="exportDialog"
      :size-options="EXPORT_PNG_SIZE_OPTIONS"
      :selected-png-sizes="exportDialog.pngSizes"
      :can-export="exportDialogCanExport"
      @update:show="handleExportDialogShowChange"
      @set-format-enabled="setExportFormatEnabled"
      @update:svg-include-bg="exportDialog.svgIncludeBg = $event"
      @toggle-png-size="toggleExportPngSize"
      @update:custom-size-input="exportDialog.customSizeInput = $event"
      @update:transparent-bg="exportDialog.transparentBg = $event"
      @update:file-prefix="exportDialog.filePrefix = $event"
      @export="runExportDialogExport"
    />

    <LayerRenameModal
      :show="layerRenameDialog.show"
      v-model:value="layerRenameDialog.value"
      @update:show="handleLayerRenameDialogShowChange"
      @confirm="confirmLayerRename"
    />

    <UserAssetModal
      :show="userAssetDialog.show"
      v-model:name="userAssetDialog.name"
      :mode="userAssetDialog.mode"
      :error="userAssetDialog.error"
      @update:show="handleUserAssetDialogShowChange"
      @confirm="confirmUserAssetDialog"
    />

        <!-- 隐藏的文件输入 -->
    <input ref="projectInputRef" type="file" accept=".iconcreator.json,application/json" style="display:none" @change="onProjectFileChosen" />
    <input ref="svgInputRef" type="file" accept=".svg,image/svg+xml" style="display:none" @change="onSVGFileChosen" />
    <input ref="imgInputRef" type="file" accept="image/*" style="display:none" @change="onImageFileChosen" />
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, triggerRef, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useZtoolsTheme } from 'ztools-ui'
import { Canvas, Control, FabricObject, Gradient, Textbox, Group, ActiveSelection, FabricImage, Path, Point, Rect, Circle, Triangle, Polygon, Line, StaticCanvas, util, loadSVGFromString } from 'fabric'
import { AligningGuidelines } from '../../fabric-aligning-guidelines'
import { basicShapes, textPresets, canvasPresets, shapePreviewPaths, iconTemplates, colorPaletteGroups, gradientPresets } from './editorCatalog'
import type { ShapeLibraryItem, TextLibraryItem, IconTemplateItem } from './editorCatalog'
import {
  DEFAULT_FILL_GRADIENT_ANGLE,
  DEFAULT_FILL_GRADIENT_RADIUS,
  DEFAULT_FILL_GRADIENT_TYPE,
  DEFAULT_KALEIDOSCOPE_COUNT,
  EDITOR_OBJECT_ID_PREFIX,
  SERIALIZED_OBJECT_PROPS,
  applyDefaultEndpointSnapMargin,
  applyDefaultFillGradientMetadata,
  applyDefaultKaleidoscopeMetadata,
  clearKaleidoscopeMetadata,
  cloneFillGradientStops,
  createGradientFromMetadata,
  getEndpointSnapMarginMetadata,
  getFillGradientMetadata,
  getNormalizedGradientOffsetSlots,
  getKaleidoscopeMetadata,
  getObjectEndpointSnapMargin,
  normalizeEndpointSnapMargin,
  normalizeKaleidoscopeCount,
  type AnyFabricObject,
  type FillGradientStop,
  type FillGradientType
} from './fabric/objectMetadata'
import { createShape } from './fabric/shapeFactories'
import {
  SHORTCUT_ACTIONS,
  SHORTCUT_DISPLAY_GROUPS,
  SHORTCUT_STORAGE_KEY,
  createDefaultShortcutBindings,
  formatShortcutForDisplay,
  getEditorPlatform,
  normalizeKeyboardEventShortcut,
  normalizeShortcutString,
  sanitizeShortcutBindings,
  type ShortcutActionDefinition,
  type ShortcutActionId,
  type ShortcutGroupId
} from './shortcuts'
import HomeTopBar from './components/HomeTopBar.vue'
import LeftPanel from './components/LeftPanel.vue'
import Ruler from './components/Ruler.vue'
import ShortcutDrawer from './components/ShortcutDrawer.vue'
import ExportModal from './components/modals/ExportModal.vue'
import LayerRenameModal from './components/modals/LayerRenameModal.vue'
import PasteSvgModal from './components/modals/PasteSvgModal.vue'
import UserAssetModal from './components/modals/UserAssetModal.vue'
import IconChecksPanel from './components/panels/IconChecksPanel.vue'
import LayersPanel from './components/panels/LayersPanel.vue'
import PreviewPanel from './components/panels/PreviewPanel.vue'
import PropertiesPanel from './components/panels/PropertiesPanel.vue'
import RightPanel from './components/panels/RightPanel.vue'
import {
  DEFAULT_KEYLINE_MARGIN,
  DEFAULT_KEYLINE_TEMPLATE,
  DEFAULT_PIXEL_GRID_SIZE,
  DRAFT_SAVE_DELAY,
  DRAFT_STORAGE_KEY,
  EXPORT_PNG_SIZE_OPTIONS,
  ICONIFY_SEARCH_LIMIT,
  MIN_PIXEL_GRID_VISIBLE_STEP,
  PROJECT_FILE_EXTENSION,
  PROJECT_SCHEMA_VERSION,
  SMALL_PREVIEW_SIZE_OPTIONS,
  TEXT_OUTLINE_ALPHA_THRESHOLD,
  TEXT_OUTLINE_TRACE_MULTIPLIER,
  USER_ASSET_MAX_THUMBNAIL_SOURCE_SIZE,
  USER_ASSET_STORAGE_KEY,
  USER_ASSET_THUMBNAIL_SIZE,
  USER_STYLE_PRESET_STORAGE_KEY
} from './constants'
import type {
  BooleanPreviewHiddenObject,
  BoundsEndpointAttachment,
  ClipboardEntry,
  ColorSwatchItem,
  CurveControlPointKey,
  EditableSegmentRefWithTarget,
  EndpointAttachment,
  EndpointAttachmentEdge,
  EndpointAttachmentMap,
  EndpointAttachmentRatio,
  EndpointSnapCandidate,
  ExportDialogState,
  ExportFormat,
  FabricControls,
  FillModeOption,
  GradientPresetItem,
  IconCheckIssue,
  IconCreatorDraftFile,
  IconCreatorProjectFile,
  IconifySearchResponse,
  IconifySearchState,
  InternalClipboard,
  KeylineSafeArea,
  KeylineTemplate,
  LeftPanelTab,
  LayerContextMenuAction,
  LayerContextMenuState,
  LayerItem,
  LayerRenameDialogState,
  PasteSVGDialogState,
  PreviewBackgroundMode,
  PreviewItem,
  RightPanelTab,
  ProjectLoadOptions,
  SnapshotOptions,
  SegmentEndpointAttachment,
  SpacePanStart,
  StrokeLineType,
  StrokeOutlineResult,
  StyleTargetChannel,
  UiFillGradientStop,
  UserAssetDialogState,
  UserAssetItem,
  UserStylePresets
} from './types'
import { isTransparentCanvasBg, normalizeCanvasBg, normalizeKeylineMargin, normalizeKeylineTemplate, normalizePixelGridSize } from './canvasSettings'
import { ensureOptimizedSVGRoot, stripFabricSVGNoise, svgEscapeText, trimSVGWhitespace } from './exportUtils'
import { buildIconCheckIssues as buildIconCheckIssuesFromContext } from './iconChecks'
import { commitNumericInput, commitPositiveNumericInput, formatNumericInputValue, normalizeInputValue } from './inputUtils'
import { normalizeProjectCanvasSettings, parseProjectFileText, stringifyProjectFile } from './projectFile'
import { isBooleanCandidate, fabricObjectToPathKitWithApi, fabricStrokeToPathKitWithApi, type FabricBooleanStyleSnapshot } from './geometry/fabricToPathKit'
import { applyBooleanOperation, computeBooleanResult } from './geometry/booleanOps'
import type { BooleanOperation, SubtractDirection } from './geometry/booleanOps'
import { pathKitToEditablePathObject, pathKitToFabricPath } from './geometry/pathKitToFabric'
import { getPathKit, peekPathKit } from './geometry/pathkit'
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
let aligningGuidelines: AligningGuidelines | null = null
let restoreActiveObjectAfterSelectionClear = false
let pointModeSwitchPending = false
let internalClipboard: InternalClipboard | null = null
let spacePanStart: SpacePanStart | null = null
let draftSaveTimer: ReturnType<typeof window.setTimeout> | null = null
let draftDirty = false
let restoringDraftPromptShown = false
let artboardIdSeed = 0

const leftTab = ref<LeftPanelTab>('shape')
const activeRightTab = ref<RightPanelTab>('properties')
const showRuler = ref(true)
const showPixelGrid = ref(false)
const snapToPixelGrid = ref(false)
const pixelGridSize = ref(DEFAULT_PIXEL_GRID_SIZE)
const pixelGridSizeInput = ref(String(pixelGridSize.value))
const keylineTemplate = ref<KeylineTemplate>(DEFAULT_KEYLINE_TEMPLATE)
const keylineMargin = ref(DEFAULT_KEYLINE_MARGIN)
const keylineMarginInput = ref(String(keylineMargin.value))
const zoom = ref(1)
const shortcutDrawerOpen = ref(false)
const shortcutSearch = ref('')
const shortcutPlatform = getEditorPlatform()
const shortcutBindings = reactive<Record<ShortcutActionId, string[]>>(createDefaultShortcutBindings(shortcutPlatform))
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
  height: `${canvasHeight.value * zoom.value}px`
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
const selectedPointIndices = ref<number[]>([])
const editablePathMetadataVersion = ref(0)
const selectedSegmentRef = shallowRef<EditableSegmentRef | null>(null)
const selectionMode = ref<'shape' | 'point' | 'segment'>('shape')
const pointControlsOwner = shallowRef<FabricObject | null>(null)
const originalControlsMap = new WeakMap<FabricObject, FabricControls>()
const originalHasBordersMap = new WeakMap<FabricObject, boolean | undefined>()
const sizeRatioLocked = ref(false)
const lockedAspectRatio = ref(1)

// ── point 模式手势状态（拖拽/框选交互期使用，独立于已提交的 selectedPointIndices） ──
// 触发框选 / 单点 / 整组拖拽的位移阈值（viewport 像素）
const POINT_GESTURE_DRAG_THRESHOLD = 4
type PointGestureSource = 'blank' | 'point-control'
type PointGestureKind = 'none' | 'pending' | 'box-select' | 'single-drag' | 'group-drag'
type PointGestureState = {
  active: boolean
  source: PointGestureSource
  kind: PointGestureKind
  modifierAtStart: boolean
  startedFromSelectedPoint: boolean
  startPointIndex: number | null
  // 起始已提交点选快照，用于 box-select 加法
  initialSelection: number[]
  // viewport 坐标
  startViewport: { x: number; y: number } | null
  currentViewport: { x: number; y: number } | null
  // scene 坐标，仅供拖拽 helper 使用
  startScene: { x: number; y: number } | null
  currentScene: { x: number; y: number } | null
  // 框选预览中的命中点（不含 initialSelection）
  previewHitIndices: number[]
  // 是否已越过拖拽阈值
  thresholdExceeded: boolean
  // 多选状态下点击已选点，但尚未确定是 collapse 还是 group-drag
  pendingCollapseIndex: number | null
  // 单点拖拽时记录拖拽前的选择，供 mouseup 决议
  preDragSelection: number[] | null
  // 整组拖拽期间是否已经由我们自己派发过 setSelectedEditablePoints
  // 用于判断 mouseup 时是否需要补一次 snapshot（实际由 actionHandler 即时调用 helper）
}
function createInitialPointGestureState(): PointGestureState {
  return {
    active: false,
    source: 'blank',
    kind: 'none',
    modifierAtStart: false,
    startedFromSelectedPoint: false,
    startPointIndex: null,
    initialSelection: [],
    startViewport: null,
    currentViewport: null,
    startScene: null,
    currentScene: null,
    previewHitIndices: [],
    thresholdExceeded: false,
    pendingCollapseIndex: null,
    preDragSelection: null
  }
}
const pointGestureState = createInitialPointGestureState()
// 用于触发 marquee 重新渲染的版本号（修改 viewport / preview 命中后递增）
const pointGestureRenderTick = ref(0)

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

function applyCanvasThemeToObject(obj: FabricObject | null | undefined) {
  if (!obj) return
  const colors = getCanvasAssistColors()
  obj.set({
    borderColor: colors.primaryStrong,
    cornerColor: colors.primary,
    cornerStrokeColor: colors.primary,
    transparentCorners: true,
    cornerStyle: 'rect'
  })
  obj.setCoords()
}

function applyCanvasTheme() {
  if (!fabricCanvas) return
  const colors = getCanvasAssistColors()
  fabricCanvas.selectionColor = colors.primaryOverlay
  fabricCanvas.selectionBorderColor = colors.primaryStrong
  fabricCanvas.selectionLineWidth = 1

  fabricCanvas.forEachObject((obj) => {
    applyCanvasThemeToObject(obj)
  })
}


function bumpPointGestureRender() {
  pointGestureRenderTick.value = (pointGestureRenderTick.value + 1) | 0
}
function resetPointGestureState() {
  const next = createInitialPointGestureState()
  Object.assign(pointGestureState, next)
}

// 撤销重做
const undoStack: string[] = []
const redoStack: string[] = []
const canUndo = ref(false)
const canRedo = ref(false)
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
const layerSearch = ref('')
const layerVersion = ref(0)
const layerSelectionAnchorId = ref('')
const layerDragItems = shallowRef<LayerItem[]>([])
const isLayerDragging = ref(false)
const layerContextMenu = reactive<LayerContextMenuState>({
  show: false,
  x: 0,
  y: 0
})
const layerRenameDialog = reactive<LayerRenameDialogState>({
  show: false,
  value: '',
  target: null
})
const pasteSVGDialog = reactive<PasteSVGDialogState>({
  show: false,
  value: '',
  error: '',
  loading: false
})
const userAssets = ref<UserAssetItem[]>([])
const userStylePresets = reactive<UserStylePresets>({
  colors: [],
  gradients: []
})
const userAssetDialog = reactive<UserAssetDialogState>({
  show: false,
  mode: 'create',
  name: '',
  error: '',
  targetId: ''
})
const iconifySearch = reactive<IconifySearchState>({
  query: '',
  lastQuery: '',
  loading: false,
  error: '',
  results: [],
  total: 0,
  inserting: '',
  collectionFilter: ''
})
const exportDialog = reactive<ExportDialogState>({
  show: false,
  svgEnabled: true,
  svgIncludeBg: false,
  pngEnabled: true,
  pngSizes: [64, 128, 256],
  customSizeInput: '',
  transparentBg: false,
  filePrefix: 'icon',
  status: '',
  loading: false
})
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
const previewBackgroundMode = ref<PreviewBackgroundMode>('transparent')
const previewItems = shallowRef<PreviewItem[]>([])
const previewDirty = ref(true)
let previewRenderTimer: ReturnType<typeof window.setTimeout> | null = null
const visibleColorPaletteGroups = computed(() => {
  const groups = [...colorPaletteGroups]
  if (userStylePresets.colors.length) {
    groups.push({
      id: 'user',
      name: '我的颜色',
      colors: userStylePresets.colors
    })
  }
  return groups
})
const visibleGradientPresets = computed(() => [...gradientPresets, ...userStylePresets.gradients])
function refreshLayers() {
  layerVersion.value += 1
}

function refreshEditablePathMetadata() {
  editablePathMetadataVersion.value += 1
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

function prepareClonedObjectMetadata(obj: FabricObject) {
  ensureEditorObjectId(obj)
  ;(obj as AnyFabricObject).editorObjectId = createEditorObjectId()
  ;(obj as AnyFabricObject).endpointAttachments = {}
  applyDefaultFillGradientMetadata(obj)
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

function assignShortcutBindings(next: Record<ShortcutActionId, string[]>) {
  SHORTCUT_ACTIONS.forEach((action) => {
    shortcutBindings[action.id] = [...next[action.id]]
  })
}

function loadShortcutBindings() {
  const defaults = createDefaultShortcutBindings(shortcutPlatform)
  const storage = window.ztools?.dbStorage
  if (!storage) {
    assignShortcutBindings(defaults)
    return
  }
  try {
    const stored = storage.getItem(SHORTCUT_STORAGE_KEY)
    assignShortcutBindings(sanitizeShortcutBindings(stored, defaults))
  } catch {
    assignShortcutBindings(defaults)
  }
}

function saveShortcutBindings() {
  const storage = window.ztools?.dbStorage
  if (!storage) return
  const payload = {
    version: 1,
    bindings: Object.fromEntries(SHORTCUT_ACTIONS.map((action) => [action.id, shortcutBindings[action.id]]))
  }
  try {
    storage.setItem(SHORTCUT_STORAGE_KEY, payload)
  } catch {
    // 存储不可用时保留内存配置
  }
}

function findShortcutConflict(binding: string, exceptActionId?: ShortcutActionId) {
  return SHORTCUT_ACTIONS.find((action) => action.id !== exceptActionId && shortcutBindings[action.id].includes(binding)) ?? null
}

function applyShortcutBinding(actionId: ShortcutActionId, oldValue: string, nextValue: string) {
  const next = normalizeShortcutString(nextValue)
  const current = normalizeShortcutString(oldValue)
  const bindings = shortcutBindings[actionId]
  const currentIndex = current ? bindings.indexOf(current) : bindings.indexOf('')
  if (!next) {
    if (currentIndex >= 0) bindings.splice(currentIndex, 1)
    saveShortcutBindings()
    return
  }
  if (bindings.includes(next) && next !== current) {
    if (currentIndex >= 0) bindings.splice(currentIndex, 1)
    saveShortcutBindings()
    return
  }
  const conflict = findShortcutConflict(next, actionId)
  if (conflict) {
    const confirmed = window.confirm(`快捷键 ${formatShortcutForDisplay(next, shortcutPlatform)} 已分配给“${conflict.name}”。是否覆盖？`)
    if (!confirmed) {
      if (currentIndex >= 0 && bindings[currentIndex] === '') {
        bindings.splice(currentIndex, 1)
        saveShortcutBindings()
      }
      return
    }
    shortcutBindings[conflict.id] = shortcutBindings[conflict.id].filter((binding) => binding !== next)
  }
  if (currentIndex >= 0) {
    bindings[currentIndex] = next
  } else if (!bindings.includes(next)) {
    bindings.push(next)
  }
  saveShortcutBindings()
}

function addShortcutBinding(actionId: ShortcutActionId) {
  if (shortcutBindings[actionId].includes('')) return
  shortcutBindings[actionId].push('')
}

function removeShortcutBinding(actionId: ShortcutActionId, binding: string) {
  shortcutBindings[actionId] = shortcutBindings[actionId].filter((item) => item !== binding)
  saveShortcutBindings()
}

function resetShortcutBindingsToDefault() {
  assignShortcutBindings(createDefaultShortcutBindings(shortcutPlatform))
  saveShortcutBindings()
}

function getShortcutActionByEvent(event: KeyboardEvent) {
  const shortcut = normalizeKeyboardEventShortcut(event)
  if (!shortcut) return null
  return SHORTCUT_ACTIONS.find((action) => shortcutBindings[action.id].includes(shortcut)) ?? null
}

function getShortcutGroupLabel(groupId: ShortcutGroupId) {
  return SHORTCUT_DISPLAY_GROUPS.find((group) => group.id === groupId)?.label ?? groupId
}

function shortcutMatchesSearch(action: ShortcutActionDefinition) {
  const query = shortcutSearch.value.trim().toLowerCase()
  if (!query) return true
  const groupLabel = getShortcutGroupLabel(action.group)
  const bindingsText = shortcutBindings[action.id].map((binding) => formatShortcutForDisplay(binding, shortcutPlatform)).join(' ')
  return [action.name, action.description, groupLabel, bindingsText]
    .some((text) => text.toLowerCase().includes(query))
}

const filteredShortcutGroups = computed(() => SHORTCUT_DISPLAY_GROUPS
  .map((group) => ({
    ...group,
    actions: SHORTCUT_ACTIONS.filter((action) => action.group === group.id && shortcutMatchesSearch(action))
  }))
  .filter((group) => group.actions.length > 0)
)

function openShortcutDrawer() {
  shortcutDrawerOpen.value = true
}

function closeShortcutDrawer() {
  shortcutDrawerOpen.value = false
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
const selectedObjects = computed(() => {
  void layerVersion.value
  return fabricCanvas?.getActiveObjects() ?? []
})

const hasKaleidoscopeSelection = computed(() => selectedObjects.value.some((obj) => isKaleidoscopeObject(obj)))

const canGroup = computed(() => {
  const obj = activeObject.value
  return obj instanceof ActiveSelection && (obj as ActiveSelection).size() > 1
})

const canUngroup = computed(() => {
  const obj = activeObject.value
  return obj instanceof Group && !(obj instanceof ActiveSelection)
})

const canAlignSelection = computed(() => {
  void activeObject.value
  void layerVersion.value
  return getSelectedLayoutTargets().length >= 2
})

const canDistributeSelection = computed(() => {
  void activeObject.value
  void layerVersion.value
  return getSelectedLayoutTargets().length >= 3
})

const isLayerDragDisabled = computed(() => !!layerSearch.value.trim())

const layerContextMenuTargets = computed(() => {
  const objects = selectedObjects.value.filter((obj) => !isBooleanPreviewObject(obj))
  if (objects.length) return objects
  const active = activeObject.value
  return active && !isBooleanPreviewObject(active) ? [active] : []
})

const singleLayerContextTarget = computed(() => (
  layerContextMenuTargets.value.length === 1 ? layerContextMenuTargets.value[0] : null
))

const layerContextMenuSourceTarget = computed(() => {
  const target = singleLayerContextTarget.value
  return target && isKaleidoscopeInstance(target)
    ? findKaleidoscopeSourceById(getKaleidoscopeInstanceSourceId(target))
    : null
})

const canLayerContextGroup = computed(() => canGroup.value)
const canLayerContextUngroup = computed(() => canUngroup.value)
const canLayerContextDetach = computed(() => layerContextMenuTargets.value.some((obj) => isKaleidoscopeInstance(obj)))
const canLayerContextSelectSource = computed(() => !!layerContextMenuSourceTarget.value)
const canLayerContextMove = computed(() => {
  const target = singleLayerContextTarget.value
  return !!target && !isLayerKaleidoscopeLocked(target)
})

const layerContextMenuItems = computed(() => {
  const targets = layerContextMenuTargets.value
  if (!targets.length) return []
  if (targets.length === 1) {
    const target = targets[0]
    const visible = target.visible !== false
    const locked = !!target.lockMovementX
    return [
      { key: 'rename', label: '重命名' },
      { key: visible ? 'hide' : 'show', label: visible ? '隐藏' : '显示' },
      { key: locked ? 'unlock' : 'lock', label: locked ? '解锁' : '锁定' },
      { type: 'separator' as const },
      { key: 'delete', label: '删除', danger: true },
      { key: 'detach-source', label: '脱离源对象', disabled: !isKaleidoscopeInstance(target) },
      { key: 'select-source', label: '选中源对象', disabled: !canLayerContextSelectSource.value },
      { type: 'separator' as const },
      { key: 'move-up', label: '上移一层', disabled: !canLayerContextMove.value || target === filteredLayers.value[0]?.obj },
      { key: 'move-top', label: '上移到最顶层', disabled: !canLayerContextMove.value || target === filteredLayers.value[0]?.obj },
      { key: 'move-down', label: '下移一层', disabled: !canLayerContextMove.value || target === filteredLayers.value[filteredLayers.value.length - 1]?.obj },
      { key: 'move-bottom', label: '下移到最底层', disabled: !canLayerContextMove.value || target === filteredLayers.value[filteredLayers.value.length - 1]?.obj },
      { type: 'separator' as const },
      { key: 'duplicate', label: '复制图层' }
    ]
  }
  return [
    { key: 'group', label: '成组', disabled: !canLayerContextGroup.value },
    { key: 'ungroup', label: '解组', disabled: !canLayerContextUngroup.value },
    { key: 'duplicate', label: '复制' },
    { key: 'delete', label: '删除', danger: true },
    { type: 'separator' as const },
    { key: 'hide', label: '隐藏', disabled: !targets.some((obj) => obj.visible !== false) },
    { key: 'lock', label: '锁定', disabled: !targets.some((obj) => !obj.lockMovementX) },
    { key: 'unlock', label: '解锁', disabled: !targets.some((obj) => !!obj.lockMovementX) },
    { key: 'detach-source', label: '脱离源对象', disabled: !canLayerContextDetach.value }
  ]
})

const canBoolean = computed(() => {
  return !hasKaleidoscopeSelection.value && !booleanBusy.value && selectedObjects.value.length >= 2 && selectedObjects.value.every(isBooleanCandidate)
})

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

const canConvertStrokeSelection = computed(() => {
  return !strokeOutlineBusy.value
    && selectedObjects.value.length > 0
    && selectedObjects.value.every((obj) => getStrokeOutlineUnsupportedReason(obj) == null)
})

const canConvertTextSelection = computed(() => {
  return !textOutlineBusy.value
    && selectedObjects.value.length > 0
    && selectedObjects.value.every((obj) => obj instanceof Textbox)
})
const canSaveUserAsset = computed(() => {
  void activeObject.value
  void layerVersion.value
  return getCurrentCopyTargets().length > 0
})

const canDirectionalSubtract = computed(() => {
  return canBoolean.value && selectedObjects.value.length === 2
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

const activeEditablePathObject = computed(() => {
  const obj = activeObject.value
  return obj && !isKaleidoscopeInstance(obj) && isEditablePathObject(obj) ? obj : null
})

const hasEditablePoints = computed(() => {
  const obj = activeEditablePathObject.value
  return !!obj && getSelectableEditablePoints(obj).length > 0
})

const selectedPointIndex = computed(() => (
  selectedPointIndices.value.length === 1 ? selectedPointIndices.value[0] : null
))

const hasSelectedPoint = computed(() => selectedPointIndices.value.length > 0)

function getLiveEditableSegmentRef(segmentRef: EditableSegmentRef | null) {
  const obj = activeEditablePathObject.value
  if (!obj) return null
  return resolveEditableSegmentRef(obj, segmentRef)
}

function resolveSelectedEditableSegment() {
  const obj = activeEditablePathObject.value
  if (!obj) return null
  if (selectionMode.value === 'segment') {
    return getLiveEditableSegmentRef(selectedSegmentRef.value)
  }
  // point 模式不再把两个相邻点自动推导为 segment 选择，保持 point-only 语义
  return null
}

const selectedEditableSegment = computed(() => resolveSelectedEditableSegment())

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

async function cloneClipboardEntry(entry: ClipboardEntry, offset: number) {
  const [clone] = await util.enlivenObjects([entry.object]) as FabricObject[]
  clone.set({
    left: (clone.left ?? 0) + offset,
    top: (clone.top ?? 0) + offset,
    name: nextName(`${entry.sourceName} 副本`)
  })
  prepareClonedObjectMetadata(clone)
  applyCanvasThemeToObject(clone)
  applyDefaultKaleidoscopeMetadata(clone)
  applyGradientMetadataToCanvasObject(clone)
  const metadata = getKaleidoscopeMetadata(clone)
  if (entry.kaleidoscopeEnabled && !entry.sourceMissing && canUseKaleidoscopeAsSource(clone)) {
    const center = getKaleidoscopeEffectiveCenter(clone)
    metadata!.kaleidoscopeEnabled = true
    metadata!.kaleidoscopeSourceId = createKaleidoscopeSourceId()
    metadata!.kaleidoscopeManaged = false
    metadata!.kaleidoscopeInstanceOf = ''
    metadata!.kaleidoscopeInstanceIndex = 0
    metadata!.kaleidoscopeCenterX = center.x + offset
    metadata!.kaleidoscopeCenterY = center.y + offset
    metadata!.kaleidoscopeCount = normalizeKaleidoscopeCount(metadata!.kaleidoscopeCount)
  } else {
    clearKaleidoscopeMetadata(clone)
  }
  clone.setCoords()
  return clone
}

function copySelectionToInternalClipboard() {
  const targets = getCurrentCopyTargets()
  if (!targets.length) return false
  internalClipboard = {
    entries: targets.map(createClipboardEntry),
    pasteCount: 0
  }
  return true
}

async function pasteInternalClipboard(clipboard = internalClipboard) {
  if (!fabricCanvas || !clipboard?.entries.length) return false
  clearBooleanPreview()
  clearPointEditing()
  const offset = 16 * (clipboard.pasteCount + 1)
  const pasted: FabricObject[] = []
  skipSnapshot = true
  try {
    for (const entry of clipboard.entries) {
      const clone = await cloneClipboardEntry(entry, offset)
      pasted.push(clone)
      fabricCanvas.add(clone as AnyFabricObject)
      if (isKaleidoscopeSource(clone)) {
        await rebuildKaleidoscopeInstances(clone)
      }
    }
  } finally {
    skipSnapshot = false
  }
  clipboard.pasteCount += 1
  setSelectionMode('shape')
  applyActiveObjectsSelection(pasted)
  refreshLayers()
  fabricCanvas.requestRenderAll()
  snapshot()
  return true
}

async function duplicateSelection() {
  const targets = getCurrentCopyTargets()
  if (!targets.length) return false
  const tempClipboard: InternalClipboard = {
    entries: targets.map(createClipboardEntry),
    pasteCount: 0
  }
  return pasteInternalClipboard(tempClipboard)
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

// 为用户保存的颜色和渐变生成稳定 id，避免同名预设在列表渲染和再次应用时互相覆盖。
function createUserStylePresetId(kind: 'color' | 'gradient') {
  return `${kind}-preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// 规范用户样式预设名称；本地旧数据缺失名称时回退到便于识别的默认标题。
function normalizeUserStylePresetName(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

// 规范可保存的颜色值；保持 hex / rgba 等 CSS 字符串原样，空值返回空串表示不可保存。
function normalizeSavedColor(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
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
    userCreated: true
  }
}

// 启动时加载用户保存的颜色和渐变预设；解析失败只清空内存状态，避免影响编辑器主体功能。
function loadUserStylePresets() {
  try {
    const raw = window.localStorage.getItem(USER_STYLE_PRESET_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<UserStylePresets>
    const rawColors = Array.isArray(parsed.colors) ? parsed.colors : []
    const rawGradients = Array.isArray(parsed.gradients) ? parsed.gradients : []
    userStylePresets.colors = rawColors
      .map(normalizeStoredColorSwatch)
      .filter((item): item is ColorSwatchItem => !!item)
    userStylePresets.gradients = rawGradients
      .map(normalizeStoredGradientPreset)
      .filter((item): item is GradientPresetItem => !!item)
  } catch (error) {
    console.warn('读取样式预设失败', error)
    userStylePresets.colors = []
    userStylePresets.gradients = []
  }
}

// 将用户自定义颜色和渐变写入 localStorage，供重启插件后继续复用个人配色风格。
function saveUserStylePresets() {
  try {
    window.localStorage.setItem(USER_STYLE_PRESET_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      colors: userStylePresets.colors,
      gradients: userStylePresets.gradients
    }))
  } catch (error) {
    console.warn('保存样式预设失败', error)
  }
}

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

// 把当前填充色或描边色保存到“我的颜色”，重复颜色会前置更新名称，避免本地色板堆积重复项。
function saveCurrentColorSwatch(channel: StyleTargetChannel) {
  const color = normalizeSavedColor(channel === 'stroke' ? objProps.stroke : objProps.fill)
  if (!color) return
  const name = `${channel === 'stroke' ? '描边色' : '填充色'} ${userStylePresets.colors.length + 1}`
  const existingIndex = userStylePresets.colors.findIndex((item) => item.color.toLowerCase() === color.toLowerCase())
  if (existingIndex >= 0) {
    const [existing] = userStylePresets.colors.splice(existingIndex, 1)
    existing.name = name
    userStylePresets.colors = [existing, ...userStylePresets.colors]
  } else {
    userStylePresets.colors = [{ id: createUserStylePresetId('color'), name, color }, ...userStylePresets.colors]
  }
  saveUserStylePresets()
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

// 保存当前对象填充渐变为用户预设；只有处于渐变填充模式时才会生成可复用条目。
function saveCurrentGradientPreset() {
  if (!activeObject.value || objProps.fillMode !== 'gradient') return
  const name = `渐变 ${userStylePresets.gradients.length + 1}`
  const preset: GradientPresetItem = {
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
  userStylePresets.gradients = [preset, ...userStylePresets.gradients]
  saveUserStylePresets()
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
  if (!fabricCanvas) return []
  void layerVersion.value
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
  activeRightTab.value = 'properties'
  applyActiveObjectsSelection([issue.target])
}

async function executeShortcutAction(actionId: ShortcutActionId) {
  switch (actionId) {
    case 'edit.copy':
      copySelectionToInternalClipboard()
      break
    case 'edit.paste':
      await pasteInternalClipboard()
      break
    case 'edit.duplicate':
      await duplicateSelection()
      break
    case 'edit.delete':
      deleteObject()
      break
    case 'edit.undo':
      undo()
      break
    case 'edit.redo':
      redo()
      break
    case 'mode.shape':
      setSelectionMode('shape')
      break
    case 'mode.point':
      setSelectionMode('point')
      break
    case 'mode.segment':
      setSelectionMode('segment')
      break
    case 'select.all':
      selectAllByMode()
      break
    case 'organize.group':
      if (selectionMode.value === 'shape' && canGroup.value) groupObjects()
      break
    case 'organize.ungroup':
      if (selectionMode.value === 'shape' && canUngroup.value) ungroupObject()
      break
    case 'layer.up':
      if (selectionMode.value === 'shape') layerUp()
      break
    case 'layer.down':
      if (selectionMode.value === 'shape') layerDown()
      break
    case 'layer.top':
      if (selectionMode.value === 'shape') layerTop()
      break
    case 'layer.bottom':
      if (selectionMode.value === 'shape') layerBottom()
      break
    case 'view.zoomIn':
      setZoom(zoom.value + 0.1)
      break
    case 'view.zoomOut':
      setZoom(zoom.value - 0.1)
      break
    case 'view.fit':
      fitCanvasInView()
      break
    case 'view.actualSize':
      setZoom(1)
      break
    case 'view.toggleRuler':
      toggleRuler()
      break
  }
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
  const controlsOwner = obj
  originalControlsMap.set(controlsOwner, controlsOwner.controls as FabricControls)
  const controls: FabricControls = { ...(controlsOwner.controls as FabricControls) }
  if (isKaleidoscopeSource(obj)) {
    controls[KALEIDOSCOPE_CENTER_CONTROL_KEY] = createKaleidoscopeCenterControl(obj)
  }
  if (activeObject.value === obj && objProps.fillEnabled && objProps.fillMode === 'gradient' && objProps.fillGradientType === 'radial') {
    controls[RADIAL_GRADIENT_CENTER_CONTROL_KEY] = createRadialGradientCenterControl(obj)
  }
  obj.controls = controls
  pointControlsOwner.value = obj
  obj.setCoords()
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
  detachLayerSources([instance])
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

function restorePointControls() {
  const owner = pointControlsOwner.value
  if (!owner) return
  const original = originalControlsMap.get(owner)
  if (original) {
    owner.controls = original
    originalControlsMap.delete(owner)
  }
  if (originalHasBordersMap.has(owner)) {
    owner.set('hasBorders', originalHasBordersMap.get(owner) ?? true)
    originalHasBordersMap.delete(owner)
  }
  owner.setCoords()
  pointControlsOwner.value = null
}

function isMultiSelectModifierPressed(
  event?: Partial<Pick<MouseEvent, 'ctrlKey' | 'shiftKey' | 'metaKey'>> | null
) {
  return !!event && !!(event.ctrlKey || event.shiftKey || event.metaKey)
}

function normalizeSelectedPointIndices(obj: EditablePathObject, indices: number[]) {
  const selectable = new Set(getSelectableEditablePoints(obj).map(({ index }) => index))
  return Array.from(new Set(indices))
    .filter((index) => selectable.has(index))
    .sort((a, b) => a - b)
}

function clearSelectedPoint() {
  selectedPointIndices.value = []
}

function clearSelectedSegment() {
  selectedSegmentRef.value = null
}

function clearEditableAssistSelection() {
  clearSelectedPoint()
  clearSelectedSegment()
}

function clearPointEditing() {
  clearEditableAssistSelection()
  resetPointGestureState()
  bumpPointGestureRender()
  restorePointControls()
}

function setSelectedEditablePoints(obj: EditablePathObject, indices: number[]) {
  selectedSegmentRef.value = null
  selectedPointIndices.value = normalizeSelectedPointIndices(obj, indices)
  syncObjProps()
  obj.canvas?.requestRenderAll()
}

function setSelectedEditableSegment(obj: EditablePathObject, segmentRef: EditableSegmentRef | null) {
  clearSelectedPoint()
  selectedSegmentRef.value = resolveEditableSegmentRef(obj, segmentRef)
  updateCurveControls()
  syncObjProps()
  obj.canvas?.requestRenderAll()
}

function selectEditablePoint(obj: EditablePathObject, pointIndex: number, multi = false) {
  if (!multi) {
    setSelectedEditablePoints(obj, [pointIndex])
    return
  }
  const next = selectedPointIndices.value.includes(pointIndex)
    ? selectedPointIndices.value.filter((index) => index !== pointIndex)
    : [...selectedPointIndices.value, pointIndex]
  setSelectedEditablePoints(obj, next)
}

// ── point 模式手势工具 ──
function getPointerViewportFromEvent(event: MouseEvent | TouchEvent | null | undefined) {
  if (!fabricCanvas || !event) return { x: 0, y: 0 }
  const point = fabricCanvas.getViewportPoint(event as MouseEvent)
  return { x: point.x, y: point.y }
}

function getPointerSceneFromEvent(event: MouseEvent | TouchEvent | null | undefined) {
  if (!fabricCanvas || !event) return { x: 0, y: 0 }
  const point = fabricCanvas.getScenePoint(event as MouseEvent)
  return { x: point.x, y: point.y }
}

function exceededViewportThreshold(start: { x: number; y: number }, current: { x: number; y: number }) {
  const dx = current.x - start.x
  const dy = current.y - start.y
  return Math.hypot(dx, dy) >= POINT_GESTURE_DRAG_THRESHOLD
}

function beginPointControlGesture(
  editable: EditablePathObject,
  pointIndex: number,
  event: MouseEvent | TouchEvent | null | undefined
) {
  // 由 fabric control mouseDownHandler 调用：拖拽过程之前的状态已被 selectedPointIndices 记录
  resetPointGestureState()
  const modifier = isMultiSelectModifierPressed(event as MouseEvent | undefined)
  const initialSelection = [...selectedPointIndices.value]
  const startedFromSelectedPoint = initialSelection.includes(pointIndex)
  const viewport = getPointerViewportFromEvent(event ?? null)
  const scene = getPointerSceneFromEvent(event ?? null)
  pointGestureState.active = true
  pointGestureState.source = 'point-control'
  pointGestureState.kind = 'pending'
  pointGestureState.modifierAtStart = modifier
  pointGestureState.startedFromSelectedPoint = startedFromSelectedPoint
  pointGestureState.startPointIndex = pointIndex
  pointGestureState.initialSelection = initialSelection
  pointGestureState.startViewport = viewport
  pointGestureState.currentViewport = viewport
  pointGestureState.startScene = scene
  pointGestureState.currentScene = scene
  pointGestureState.previewHitIndices = []
  pointGestureState.thresholdExceeded = false
  pointGestureState.pendingCollapseIndex = null
  pointGestureState.preDragSelection = initialSelection

  if (modifier) {
    // 修饰键 + 点击点位：mousedown 阶段先按 toggle 应用一次（与现有 click 行为一致），
    // 若后续拖拽超过阈值则在 mouse:move 中切换为 box-select 并恢复 initialSelection
    selectEditablePoint(editable, pointIndex, true)
    // pendingCollapse 不适用
    return
  }

  if (startedFromSelectedPoint && initialSelection.length > 1) {
    // 多选状态下普通点击一个已选点：暂不 collapse，先标记 pending，等 mouseup 决议
    pointGestureState.pendingCollapseIndex = pointIndex
    // 不修改 selectedPointIndices
    return
  }

  // 单选 / 普通点击未选中点：直接走原 collapse 行为
  selectEditablePoint(editable, pointIndex, false)
}

function updatePointGestureFromCanvasCoord(_x: number, _y: number) {
  // 备用：actionHandler 触发时手动同步重绘（当前不再使用，由 mouse:move 主动触发）
  bumpPointGestureRender()
  fabricCanvas?.requestRenderAll()
}

function beginBlankPointGesture(event: MouseEvent | TouchEvent | null | undefined) {
  resetPointGestureState()
  const modifier = isMultiSelectModifierPressed(event as MouseEvent | undefined)
  const initialSelection = [...selectedPointIndices.value]
  const viewport = getPointerViewportFromEvent(event ?? null)
  const scene = getPointerSceneFromEvent(event ?? null)
  pointGestureState.active = true
  pointGestureState.source = 'blank'
  pointGestureState.kind = 'pending'
  pointGestureState.modifierAtStart = modifier
  pointGestureState.startedFromSelectedPoint = false
  pointGestureState.startPointIndex = null
  pointGestureState.initialSelection = initialSelection
  pointGestureState.startViewport = viewport
  pointGestureState.currentViewport = viewport
  pointGestureState.startScene = scene
  pointGestureState.currentScene = scene
  pointGestureState.previewHitIndices = []
  pointGestureState.thresholdExceeded = false
  pointGestureState.pendingCollapseIndex = null
  pointGestureState.preDragSelection = null
}

function getMarqueeViewportBounds() {
  const start = pointGestureState.startViewport
  const current = pointGestureState.currentViewport
  if (!start || !current) return null
  const x1 = Math.min(start.x, current.x)
  const y1 = Math.min(start.y, current.y)
  const x2 = Math.max(start.x, current.x)
  const y2 = Math.max(start.y, current.y)
  return { x1, y1, x2, y2 }
}

function computeBoxSelectPreviewHits(): number[] {
  const editable = activeEditablePathObject.value
  if (!editable) return []
  const bounds = getMarqueeViewportBounds()
  if (!bounds) return []
  const hits: number[] = []
  for (const { index } of getSelectableEditablePoints(editable)) {
    const vp = getViewportPointForEditablePoint(editable, index)
    if (vp.x >= bounds.x1 && vp.x <= bounds.x2 && vp.y >= bounds.y1 && vp.y <= bounds.y2) {
      hits.push(index)
    }
  }
  return hits
}

function unionBoxSelectFinalIndices(): number[] {
  const set = new Set<number>(pointGestureState.initialSelection)
  for (const i of pointGestureState.previewHitIndices) set.add(i)
  return Array.from(set).sort((a, b) => a - b)
}

function drawPointGestureMarquee() {
  if (!fabricCanvas) return
  if (selectionMode.value !== 'point') return
  if (pointGestureState.kind !== 'box-select') return
  const bounds = getMarqueeViewportBounds()
  if (!bounds) return
  const ctx = (fabricCanvas as any).getTopContext?.() ?? fabricCanvas.contextTop
  if (!ctx) return
  const x = bounds.x1
  const y = bounds.y1
  const w = bounds.x2 - bounds.x1
  const h = bounds.y2 - bounds.y1
  if (w <= 0 || h <= 0) return
  const colors = getCanvasAssistColors()
  ctx.save()
  ctx.fillStyle = colors.primaryOverlay
  ctx.strokeStyle = colors.primaryStrong
  ctx.lineWidth = 1
  ctx.fillRect(x, y, w, h)
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1))
  ctx.restore()
}

function renderPointControl(ctx: CanvasRenderingContext2D, left: number, top: number) {
  const key = (this as Control & { pointIndex?: number }).pointIndex
  const committed = key != null && selectedPointIndices.value.includes(key)
  const previewAdded = !committed
    && pointGestureState.kind === 'box-select'
    && key != null
    && pointGestureState.previewHitIndices.includes(key)
  // 强引用一下渲染版本号，让 fabric 在 marquee 改变时也重绘点控件
  // （after:render 会显式 requestRenderAll，这里只是保持响应式依赖）
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  pointGestureRenderTick.value
  const colors = getCanvasAssistColors()
  ctx.save()
  ctx.beginPath()
  if (previewAdded) {
    ctx.arc(left, top, 5, 0, Math.PI * 2)
    ctx.fillStyle = colors.primarySoft
    ctx.strokeStyle = colors.primary
    ctx.lineWidth = 2
  } else if (committed) {
    ctx.arc(left, top, 5, 0, Math.PI * 2)
    ctx.fillStyle = colors.primary
    ctx.strokeStyle = colors.primary
    ctx.lineWidth = 2
  } else {
    ctx.arc(left, top, 4, 0, Math.PI * 2)
    ctx.fillStyle = colors.textOnPrimary
    ctx.strokeStyle = colors.primary
    ctx.lineWidth = 2
  }
  ctx.fill()
  ctx.stroke()
  ctx.restore()
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
  originalControlsMap.set(editable, editable.controls as FabricControls)
  const controls: FabricControls = { ...(editable.controls as FabricControls) }
  if (shouldHideTransformControlsInEditMode(editable)) {
    originalHasBordersMap.set(editable, editable.hasBorders)
    editable.set('hasBorders', false)
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
  editable.controls = controls
  pointControlsOwner.value = editable
  editable.setCoords()
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

const filteredLayers = computed(() => {
  void layerVersion.value
  if (!fabricCanvas) return []
  const q = layerSearch.value.toLowerCase()
  const objects = fabricCanvas.getObjects()
  const items: LayerItem[] = []
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i]
    if (isBooleanPreviewObject(obj)) continue
    const name = (obj as AnyFabricObject).name || obj.type || '对象'
    if (!q || String(name).toLowerCase().includes(q)) {
      items.push({
        id: ensureEditorObjectId(obj),
        canvasIndex: i,
        name: String(name),
        obj
      })
    }
  }
  return items
})

// ── 快照（撤销重做） ──
// 序列化当前 Fabric 画布，统一保留项目需要的自定义对象元数据。
function serializeFabricCanvas() {
  ensureCanvasObjectMetadata()
  return (fabricCanvas as any).toObject(SERIALIZED_OBJECT_PROPS as unknown as string[]) as Record<string, unknown>
}

// 记录一次可撤销快照，并在真实编辑后触发草稿自动保存和小尺寸预览刷新。
function snapshot(options: SnapshotOptions = {}) {
  if (skipSnapshot || !fabricCanvas) return
  undoStack.push(JSON.stringify(serializeFabricCanvas()))
  if (undoStack.length > 60) undoStack.shift()
  redoStack.length = 0
  canUndo.value = undoStack.length > 1
  canRedo.value = false
  markSmallPreviewsDirty()
  if (options.autoSave !== false) scheduleDraftSave()
}

function applyCanvasBgToFabric(value: string) {
  if (!fabricCanvas) return
  fabricCanvas.backgroundColor = isTransparentCanvasBg(value) ? '' : value
}

function syncCanvasBgFromFabric() {
  if (!fabricCanvas) return
  const bg = fabricCanvas.backgroundColor
  if (isTransparentCanvasBg(bg)) {
    canvasBg.value = 'transparent'
    return
  }
  const next = String(bg)
  canvasBg.value = next
  lastOpaqueCanvasBg.value = next
}

// 基于当前编辑器状态生成工程文件数据，供手动保存与自动草稿复用同一份 schema。
function createProjectFile(): IconCreatorProjectFile {
  if (!fabricCanvas) throw new Error('画布尚未初始化')
  const now = new Date().toISOString()
  const layerOrder = fabricCanvas.getObjects()
    .filter((obj) => !isBooleanPreviewObject(obj))
    .map((obj) => ensureEditorObjectId(obj))
  return {
    app: 'icon-creator',
    schemaVersion: PROJECT_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    canvas: {
      width: canvasWidth.value,
      height: canvasHeight.value,
      background: canvasBg.value,
      gridSize: pixelGridSize.value,
      showPixelGrid: showPixelGrid.value,
      snapToPixelGrid: snapToPixelGrid.value,
      keylineTemplate: keylineTemplate.value,
      keylineMargin: keylineMargin.value
    },
    fabric: serializeFabricCanvas(),
    layerOrder
  }
}

// 重置撤销重做栈，并把当前画布状态作为打开工程后的初始快照。
function resetHistoryToCurrentCanvas() {
  undoStack.length = 0
  redoStack.length = 0
  canUndo.value = false
  canRedo.value = false
  snapshot({ autoSave: false })
}

// 根据工程中记录的 editorObjectId 顺序恢复图层，缺失或新增对象保留当前相对顺序追加。
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

// 将工程数据恢复到 Fabric 画布，并同步尺寸、背景、图层、自定义元数据和小尺寸预览状态。
async function loadProjectFile(project: IconCreatorProjectFile, options: ProjectLoadOptions = {}) {
  if (!fabricCanvas) return
  clearBooleanPreview()
  clearPointEditing()
  const settings = normalizeProjectCanvasSettings(project.canvas)
  canvasWidth.value = settings.width
  canvasHeight.value = settings.height
  canvasBg.value = settings.background
  pixelGridSize.value = normalizePixelGridSize(settings.gridSize)
  showPixelGrid.value = settings.showPixelGrid === true
  snapToPixelGrid.value = settings.snapToPixelGrid === true
  keylineTemplate.value = normalizeKeylineTemplate(settings.keylineTemplate)
  keylineMargin.value = normalizeKeylineMargin(settings.keylineMargin)
  syncPixelGridSizeInput()
  syncKeylineMarginInput()
  syncCanvasInteractionMode()
  if (!isTransparentCanvasBg(settings.background)) lastOpaqueCanvasBg.value = settings.background
  syncCanvasSizeInputs()
  skipSnapshot = true
  try {
    fabricCanvas.clear()
    fabricCanvas.setDimensions({ width: canvasWidth.value, height: canvasHeight.value })
    await fabricCanvas.loadFromJSON(project.fabric)
    applyCanvasBgToFabric(canvasBg.value)
    await syncAllKaleidoscopes()
    ensureCanvasObjectMetadata()
    applyProjectLayerOrder(project.layerOrder)
    rehydrateCanvasGradientFills()
    syncAllEndpointAttachments()
    applyCanvasTheme()
    syncCanvasInteractionMode()
    fabricCanvas.discardActiveObject()
    syncActiveObject(null)
    fabricCanvas.requestRenderAll()
    refreshLayers()
    fitCanvasInView()
    markSmallPreviewsDirty()
  } finally {
    skipSnapshot = false
  }
  if (options.resetHistory !== false) resetHistoryToCurrentCanvas()
  if (!options.keepDraft) clearStoredDraft()
}

// 延迟写入自动草稿，避免拖拽或连续属性调整时频繁访问 localStorage。
function scheduleDraftSave() {
  if (!fabricCanvas || typeof window === 'undefined') return
  draftDirty = true
  if (draftSaveTimer != null) window.clearTimeout(draftSaveTimer)
  draftSaveTimer = window.setTimeout(() => {
    draftSaveTimer = null
    saveDraftNow()
  }, DRAFT_SAVE_DELAY)
}

// 立即把当前工程状态写入本地草稿；失败时静默保留编辑流程不中断。
function saveDraftNow() {
  if (!fabricCanvas || typeof window === 'undefined') return
  try {
    const project = createProjectFile()
    const draft: IconCreatorDraftFile = {
      app: 'icon-creator',
      schemaVersion: PROJECT_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      project
    }
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
    draftDirty = false
  } catch (error) {
    console.warn('保存自动草稿失败', error)
  }
}

// 清理本地草稿和等待中的写入计时器，用于新建、打开、显式保存后的草稿状态重置。
function clearStoredDraft() {
  if (draftSaveTimer != null) {
    window.clearTimeout(draftSaveTimer)
    draftSaveTimer = null
  }
  draftDirty = false
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY)
  } catch (error) {
    console.warn('清理自动草稿失败', error)
  }
}

// 组件卸载前只取消计时器；若有未落盘编辑，先同步保存最后一版草稿。
function flushDraftBeforeDispose() {
  if (draftSaveTimer != null) {
    window.clearTimeout(draftSaveTimer)
    draftSaveTimer = null
  }
  if (draftDirty) saveDraftNow()
}

// 启动时读取本地草稿，解析失败会丢弃，避免坏数据反复打断初始化。
function readStoredDraft() {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    return parseProjectFileText(raw).project
  } catch (error) {
    console.warn('读取自动草稿失败', error)
    clearStoredDraft()
    return null
  }
}

// 首次进入编辑器时询问是否恢复草稿；拒绝恢复则清理旧草稿，形成明确的新建策略。
async function promptRestoreDraft() {
  if (restoringDraftPromptShown) return
  restoringDraftPromptShown = true
  const draft = readStoredDraft()
  if (!draft) return
  const shouldRestore = window.confirm('检测到上次未保存的自动草稿，是否恢复？')
  if (shouldRestore) {
    await loadProjectFile(draft, { keepDraft: true })
    saveDraftNow()
  } else {
    clearStoredDraft()
  }
}

// 回退到上一份画布快照，恢复后同步图层、背景和小尺寸预览状态。
function undo() {
  if (undoStack.length <= 1 || !fabricCanvas) return
  clearPointEditing()
  redoStack.push(undoStack.pop()!)
  canRedo.value = true
  skipSnapshot = true
  fabricCanvas.loadFromJSON(undoStack[undoStack.length - 1]).then(async () => {
    await syncAllKaleidoscopes()
    ensureCanvasObjectMetadata()
    rehydrateCanvasGradientFills()
    syncAllEndpointAttachments()
    fabricCanvas!.discardActiveObject()
    syncActiveObject(null)
    syncCanvasBgFromFabric()
    fabricCanvas!.requestRenderAll()
    skipSnapshot = false
    refreshLayers()
    markSmallPreviewsDirty()
    canUndo.value = undoStack.length > 1
  })
}

// 重新应用被撤销的画布快照，恢复后同步图层、背景和小尺寸预览状态。
function redo() {
  if (!redoStack.length || !fabricCanvas) return
  clearPointEditing()
  const json = redoStack.pop()!
  undoStack.push(json)
  skipSnapshot = true
  fabricCanvas.loadFromJSON(json).then(async () => {
    await syncAllKaleidoscopes()
    ensureCanvasObjectMetadata()
    rehydrateCanvasGradientFills()
    syncAllEndpointAttachments()
    fabricCanvas!.discardActiveObject()
    syncActiveObject(null)
    syncCanvasBgFromFabric()
    fabricCanvas!.requestRenderAll()
    skipSnapshot = false
    refreshLayers()
    markSmallPreviewsDirty()
    canUndo.value = undoStack.length > 1
    canRedo.value = redoStack.length > 0
  })
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

function syncLayerDragItems() {
  if (isLayerDragging.value) return
  layerDragItems.value = filteredLayers.value.map((item) => ({ ...item }))
}

watch(filteredLayers, () => {
  syncLayerDragItems()
}, { immediate: true })

// 切换到预览 Tab 时立即刷新过期缩略图，保持隐藏状态下不做额外渲染。
watch(activeRightTab, (tab) => {
  if (tab === 'preview' && previewDirty.value) refreshSmallPreviews()
})

function ensureShapeSelectionForLayerActions() {
  if (selectionMode.value !== 'shape') {
    setSelectionMode('shape')
  }
}

function getLayerRangeObjects(target: FabricObject) {
  const anchorId = layerSelectionAnchorId.value
  const items = filteredLayers.value
  const targetIndex = items.findIndex((item) => item.obj === target)
  const anchorIndex = items.findIndex((item) => item.id === anchorId)
  if (targetIndex < 0 || anchorIndex < 0) return [target]
  const [start, end] = anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex]
  return items.slice(start, end + 1).map((item) => item.obj)
}

function setLayerSelectionAnchor(obj: FabricObject) {
  layerSelectionAnchorId.value = ensureEditorObjectId(obj)
}

function getCurrentLayerContextTargets() {
  return layerContextMenuTargets.value
}

function closeLayerContextMenu() {
  layerContextMenu.show = false
}

function setObjectsVisible(objects: FabricObject[], visible: boolean) {
  if (!fabricCanvas) return
  withSnapshotSuppressed(() => {
    objects.forEach((obj) => {
      obj.visible = visible
      triggerKaleidoscopeVisibilitySync(obj)
    })
  })
  fabricCanvas.requestRenderAll()
  refreshActiveObject()
  snapshot()
}

function setObjectsLocked(objects: FabricObject[], locked: boolean) {
  if (!fabricCanvas) return
  withSnapshotSuppressed(() => {
    objects.forEach((obj) => {
      obj.set({
        lockMovementX: locked,
        lockMovementY: locked,
        lockScalingX: locked,
        lockScalingY: locked,
        lockRotation: locked,
        hasControls: !locked,
        selectable: true
      })
    })
  })
  fabricCanvas.requestRenderAll()
  refreshActiveObject()
  snapshot()
}

// 通过页面内输入确认框重命名图层，避免浏览器原生 prompt 打断编辑流程。
function openLayerRenameDialog(obj: FabricObject) {
  layerRenameDialog.target = obj
  layerRenameDialog.value = String((obj as AnyFabricObject).name || obj.type || '对象')
  layerRenameDialog.show = true
}

// 关闭重命名弹窗时同步清空临时输入与目标对象，避免旧状态污染下一次重命名。
function handleLayerRenameDialogShowChange(show: boolean) {
  layerRenameDialog.show = show
  if (show) return
  layerRenameDialog.value = ''
  layerRenameDialog.target = null
}

// 提交图层重命名，只在有目标对象且名称有效时落盘并生成一次快照。
function confirmLayerRename() {
  const obj = layerRenameDialog.target
  if (!obj) {
    handleLayerRenameDialogShowChange(false)
    return
  }
  const currentName = String((obj as AnyFabricObject).name || obj.type || '对象')
  const trimmed = layerRenameDialog.value.trim()
  if (!trimmed || trimmed === currentName) {
    handleLayerRenameDialogShowChange(false)
    return
  }
  ;(obj as AnyFabricObject).name = trimmed
  refreshLayers()
  refreshActiveObject()
  snapshot()
  handleLayerRenameDialogShowChange(false)
}

function selectLayerSourceObject(obj: FabricObject) {
  const source = isKaleidoscopeInstance(obj)
    ? findKaleidoscopeSourceById(getKaleidoscopeInstanceSourceId(obj))
    : null
  if (!source) return
  ensureShapeSelectionForLayerActions()
  applyActiveObjectsSelection([source])
  setLayerSelectionAnchor(source)
}

function detachLayerSources(objects: FabricObject[]) {
  const targets = objects.filter((obj) => isKaleidoscopeInstance(obj))
  if (!targets.length || !fabricCanvas) return
  withSnapshotSuppressed(() => {
    targets.forEach((instance) => {
      clearKaleidoscopeMetadata(instance)
      setKaleidoscopeInstanceManagedState(instance, false)
      instance.setCoords()
    })
  })
  fabricCanvas.requestRenderAll()
  refreshLayers()
  refreshActiveObject()
  snapshot()
  syncObjProps()
}

function moveObjectsToLayerOrder(items: LayerItem[]) {
  if (!fabricCanvas) return
  const reversed = [...items].reverse()
  reversed.forEach((item, index) => {
    fabricCanvas!.moveObjectTo(item.obj as AnyFabricObject, index)
  })
}

function reorderLayers() {
  isLayerDragging.value = false
  if (!fabricCanvas) return
  if (isLayerDragDisabled.value) {
    syncLayerDragItems()
    return
  }
  clearBooleanPreview()
  withSnapshotSuppressed(() => {
    moveObjectsToLayerOrder(layerDragItems.value)
  })
  fabricCanvas.requestRenderAll()
  refreshLayers()
  snapshot()
}

function openLayerContextMenu(obj: FabricObject, event: MouseEvent) {
  ensureShapeSelectionForLayerActions()
  const activeObjects = fabricCanvas?.getActiveObjects() ?? []
  if (!activeObjects.includes(obj)) {
    applyActiveObjectsSelection([obj], event)
    setLayerSelectionAnchor(obj)
  }
  layerContextMenu.x = event.clientX
  layerContextMenu.y = event.clientY
  layerContextMenu.show = true
}

function handleLayerContextMenuSelect(key: string) {
  const action = key as LayerContextMenuAction
  const targets = getCurrentLayerContextTargets()
  const single = singleLayerContextTarget.value
  closeLayerContextMenu()
  if (!targets.length) return
  switch (action) {
    case 'rename':
      if (single) openLayerRenameDialog(single)
      return
    case 'show':
      setObjectsVisible(targets, true)
      return
    case 'hide':
      setObjectsVisible(targets, false)
      return
    case 'lock':
      setObjectsLocked(targets, true)
      return
    case 'unlock':
      setObjectsLocked(targets, false)
      return
    case 'delete':
      deleteObjects(targets)
      return
    case 'detach-source':
      detachLayerSources(targets)
      return
    case 'select-source':
      if (single) selectLayerSourceObject(single)
      return
    case 'move-up':
      layerUp()
      return
    case 'move-top':
      layerTop()
      return
    case 'move-down':
      layerDown()
      return
    case 'move-bottom':
      layerBottom()
      return
    case 'duplicate':
      void duplicateSelection()
      return
    case 'group':
      groupObjects()
      return
    case 'ungroup':
      ungroupObject()
      return
  }
}


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

function initAligningGuidelines() {
  if (!fabricCanvas) return
  aligningGuidelines?.dispose()
  aligningGuidelines = new AligningGuidelines(fabricCanvas, {
    margin: 4,
    width: 1,
    color: () => getCanvasAssistColors().primaryStrong,
    getObjectsByTarget: getAligningObjectsByTarget
  })
}

function scaleObjectToDisplaySize(obj: FabricObject, width: number, height: number) {
  const currentWidth = obj.getScaledWidth()
  const currentHeight = obj.getScaledHeight()
  if (currentWidth > 0) obj.set('scaleX', (obj.scaleX ?? 1) * (width / currentWidth))
  if (currentHeight > 0) obj.set('scaleY', (obj.scaleY ?? 1) * (height / currentHeight))
}

function toggleSizeRatioLock() {
  sizeRatioLocked.value = !sizeRatioLocked.value
  if (sizeRatioLocked.value && activeObject.value) {
    lockedAspectRatio.value = getObjectAspectRatio(activeObject.value)
  }
  if (fabricCanvas) {
    fabricCanvas.uniformScaling = sizeRatioLocked.value
  }
}

// ── 同步选中对象属性 ──
// 同步 Fabric 的交互模式；除选择模式外，也把当前网格吸附状态映射到对象旋转角度吸附。
function syncCanvasInteractionMode() {
  if (!fabricCanvas) return
  fabricCanvas.selection = selectionMode.value === 'shape'
  fabricCanvas.getObjects().forEach((obj) => {
    obj.snapAngle = snapToPixelGrid.value ? 15 : undefined
  })
}

function setSelectionMode(mode: 'shape' | 'point' | 'segment') {
  const editable = activeEditablePathObject.value
  const nextMode = mode === 'segment' && editable && getArrowRenderMode(editable) === 'hollow-shaft'
    ? 'point'
    : mode
  if (nextMode === 'shape' || editable) {
    selectionMode.value = nextMode
  } else {
    selectionMode.value = 'shape'
  }
  if (mode === 'shape') {
    clearEditableAssistSelection()
  } else if (mode === 'point') {
    clearSelectedSegment()
  } else {
    clearSelectedPoint()
  }
  restoreActiveObjectAfterSelectionClear = false
  // 切换模式时也清掉任何残留的 point 模式手势状态
  resetPointGestureState()
  bumpPointGestureRender()
  syncCanvasInteractionMode()
  if (fabricCanvas && activeObject.value) {
    fabricCanvas.setActiveObject(activeObject.value)
  }
  updateCurveControls()
  if (activeObject.value) {
    syncObjProps()
  }
}

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

    const segmentRef = isHollowShaftArrow.value ? null : resolveSelectedEditableSegment()
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
function applyCanvasZoom(value: number) {
  if (!fabricCanvas) return
  zoom.value = Math.round(Math.max(0.1, Math.min(5, value)) * 100) / 100
  fabricCanvas.setZoom(zoom.value)
  fabricCanvas.setDimensions({
    width: canvasWidth.value * zoom.value,
    height: canvasHeight.value * zoom.value
  })
  fabricCanvas.requestRenderAll()
}

function fitCanvasInView() {
  if (!fabricCanvas || !canvasAreaRef.value) return
  const area = canvasAreaRef.value
  const scaleX = (area.clientWidth - 40) / canvasWidth.value
  const scaleY = (area.clientHeight - 40) / canvasHeight.value
  applyCanvasZoom(Math.min(scaleX, scaleY, 1))
}

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
  }
  syncCanvasInteractionMode()
  if (directEditMode === 'segment' && isEditablePathObject(constrained)) {
    setSelectedEditableSegment(constrained, getSpecialDirectEditSegment(constrained))
  } else {
    updateCurveControls()
  }
  refreshLayers()
  if (constrained) {
    if (sizeRatioLocked.value) {
      lockedAspectRatio.value = getObjectAspectRatio(constrained)
    }
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
function addShape(item: ShapeLibraryItem) {
  if (!fabricCanvas) return
  const shape = createShape(item)
  shape.set({
    left: canvasWidth.value / 2,
    top: canvasHeight.value / 2,
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

function addText(preset: TextLibraryItem) {
  if (!fabricCanvas) return
  const t = new Textbox(preset.text, {
    left: canvasWidth.value / 2 - 100,
    top: canvasHeight.value / 2 - preset.fontSize / 2,
    fontSize: preset.fontSize,
    fontWeight: preset.fontWeight as any,
    fill: '#000000',
    name: nextName(preset.label),
    width: 200
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
    window.alert(error instanceof Error ? error.message : '应用模板失败')
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

// 打开隐藏的工程文件选择器，读取逻辑交给 onProjectFileChosen 统一处理。
function openProject() {
  projectInputRef.value?.click()
}

// 从文件输入读取工程 JSON，恢复失败时保留当前画布并给出错误提示。
async function onProjectFileChosen(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const { project } = parseProjectFileText(await file.text())
    await loadProjectFile(project)
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '打开工程失败')
  } finally {
    input.value = ''
  }
}

// 从文件输入读取本地 SVG，导入失败时只重置输入框并保留当前画布内容。
async function onSVGFileChosen(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    await importSVGFile(file)
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '导入 SVG 失败')
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
        window.alert(error instanceof Error ? error.message : '导入 SVG 失败')
      }
    } else if (file.type.startsWith('image/')) {
      try {
        await importImageFile(file)
      } catch (error) {
        window.alert(error instanceof Error ? error.message : '导入图片失败')
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
    window.alert(error instanceof Error ? error.message : '导入图片失败')
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
// 手动保存当前工程文件，成功后清理自动草稿，表示当前编辑状态已有明确落盘版本。
function saveProject() {
  if (!fabricCanvas) return
  clearBooleanPreview()
  try {
    const filePath = window.services?.writeTextFile?.(stringifyProjectFile(createProjectFile()), PROJECT_FILE_EXTENSION)
    clearStoredDraft()
    if (filePath) window.alert(`工程已保存：${filePath}`)
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '保存工程失败')
  }
}

// 规范导出文件名前缀，避免空值或非法文件名字符影响下载目录写入。
function getExportFilePrefix() {
  const normalized = exportDialog.filePrefix.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
  return normalized || 'icon'
}

// 将用户输入的 PNG 尺寸约束到可导出的安全整数范围，非法值返回 null 供上层忽略。
function normalizeExportPngSize(value: unknown) {
  const parsed = Math.round(Number(value))
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.min(4096, Math.max(1, parsed))
}

// 合并预设尺寸和自定义尺寸，去重后升序输出，作为批量 PNG 导出的最终尺寸列表。
function getExportPngSizes() {
  const sizes = new Set<number>()
  exportDialog.pngSizes.forEach((size) => {
    const normalized = normalizeExportPngSize(size)
    if (normalized) sizes.add(normalized)
  })
  const customSize = normalizeExportPngSize(exportDialog.customSizeInput.trim())
  if (customSize) sizes.add(customSize)
  return Array.from(sizes).sort((a, b) => a - b)
}

const exportDialogCanExport = computed(() => (
  exportDialog.svgEnabled || (exportDialog.pngEnabled && getExportPngSizes().length > 0)
))
const previewStageClass = computed(() => `preview-bg-${previewBackgroundMode.value}`)
const iconifyCollectionOptions = computed(() => {
  const collections = Array.from(new Set(iconifySearch.results.map((name) => name.split(':')[0]).filter(Boolean))).sort()
  return [
    { label: '全部图标集', value: '' },
    ...collections.map((collection) => ({ label: collection, value: collection }))
  ]
})
const filteredIconifyResults = computed(() => {
  const collection = iconifySearch.collectionFilter
  if (!collection) return iconifySearch.results
  return iconifySearch.results.filter((name) => name.startsWith(`${collection}:`))
})

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

// 在预览 Tab 可见时立即补齐过期缩略图；隐藏时只记录 dirty，避免后台频繁生成 dataURL。
function markSmallPreviewsDirty() {
  previewDirty.value = true
  if (activeRightTab.value === 'preview') scheduleSmallPreviewsRefresh()
}

// 打开导出面板并清空上一次状态，保留用户上次选择的格式、尺寸和文件名前缀。
function openExportDialog() {
  exportDialog.show = true
  exportDialog.status = ''
}

// 关闭导出面板时结束加载状态；导出结果文本会在下一次打开时重置。
function handleExportDialogShowChange(show: boolean) {
  exportDialog.show = show
  if (!show) exportDialog.loading = false
}

// 控制导出格式开关，允许临时全部取消，此时导出按钮会被禁用。
function setExportFormatEnabled(format: ExportFormat, enabled: boolean) {
  if (format === 'svg') exportDialog.svgEnabled = enabled
  else exportDialog.pngEnabled = enabled
  exportDialog.status = ''
}

// 根据导出选项生成画布背景矩形；透明背景或未勾选保留背景时不输出额外节点。
function getOptimizedSVGBackgroundMarkup(includeBackground: boolean) {
  if (!includeBackground || isTransparentCanvasBg(canvasBg.value)) return ''
  return `<rect width="100%" height="100%" fill="${svgEscapeText(canvasBg.value)}"/>`
}

// 将 Fabric 原始 SVG 输出压缩为更适合交付的图标资源：规范根节点、viewBox、可选背景并移除冗余元数据。
function createOptimizedSVG(includeBackground = false) {
  if (!fabricCanvas) return ''
  const currentBg = fabricCanvas.backgroundColor
  try {
    fabricCanvas.backgroundColor = ''
    const rawSvg = fabricCanvas.toSVG({
      suppressPreamble: true,
      viewBox: { x: 0, y: 0, width: canvasWidth.value, height: canvasHeight.value },
      width: String(canvasWidth.value),
      height: String(canvasHeight.value)
    })
    return trimSVGWhitespace(ensureOptimizedSVGRoot(
      stripFabricSVGNoise(rawSvg),
      canvasWidth.value,
      canvasHeight.value,
      getOptimizedSVGBackgroundMarkup(includeBackground)
    ))
  } finally {
    fabricCanvas.backgroundColor = currentBg
  }
}

// 切换预设 PNG 尺寸并保持尺寸列表升序，便于导出状态和文件名稳定可读。
function toggleExportPngSize(size: number) {
  const normalized = normalizeExportPngSize(size)
  if (!normalized) return
  if (exportDialog.pngSizes.includes(normalized)) {
    exportDialog.pngSizes = exportDialog.pngSizes.filter((item) => item !== normalized)
  } else {
    exportDialog.pngSizes = [...exportDialog.pngSizes, normalized].sort((a, b) => a - b)
  }
  exportDialog.status = ''
}

// 导出优化后的 SVG 到下载目录，支持导出面板传入自定义文件名和是否保留画布背景。
function exportSVG(fileName?: string, includeBackground = false) {
  if (!fabricCanvas) return ''
  clearBooleanPreview()
  return window.services?.writeSvgFile?.(createOptimizedSVG(includeBackground), fileName) || ''
}

// 在不改变当前编辑视图的前提下渲染指定宽度的 PNG，并可临时移除背景色实现透明导出。
function renderPNGDataUrl(size: number, transparentBackground: boolean) {
  if (!fabricCanvas) return ''
  const currentZoom = fabricCanvas.getZoom()
  const currentWidth = fabricCanvas.getWidth()
  const currentHeight = fabricCanvas.getHeight()
  const currentBg = fabricCanvas.backgroundColor
  const multiplier = size / canvasWidth.value
  try {
    fabricCanvas.setZoom(1)
    fabricCanvas.setDimensions({ width: canvasWidth.value, height: canvasHeight.value })
    if (transparentBackground) fabricCanvas.backgroundColor = ''
    fabricCanvas.requestRenderAll()
    return fabricCanvas.toDataURL({ format: 'png', multiplier })
  } finally {
    fabricCanvas.backgroundColor = currentBg
    fabricCanvas.setZoom(currentZoom)
    fabricCanvas.setDimensions({ width: currentWidth, height: currentHeight })
    fabricCanvas.requestRenderAll()
  }
}

// 导出单个 PNG 到下载目录，size 表示输出宽度，文件名由导出面板生成。
function exportPNG(size = canvasWidth.value, fileName?: string, transparentBackground = false) {
  if (!fabricCanvas) return ''
  clearBooleanPreview()
  const normalizedSize = normalizeExportPngSize(size) ?? canvasWidth.value
  const dataUrl = renderPNGDataUrl(normalizedSize, transparentBackground)
  return dataUrl ? window.services?.writeImageFile?.(dataUrl, fileName) || '' : ''
}

// 创建仅包含选中对象的临时画布，用于复制为 SVG/PNG 时生成裁剪后的内容。
function createSelectionCanvas(objects: FabricObject[]) {
  if (!objects.length) return null
  const bounds = getObjectsCombinedBounds(objects)
  if (!bounds) return null
  const tempCanvas = new fabric.Canvas(null as unknown as HTMLCanvasElement, {
    width: bounds.width,
    height: bounds.height,
    backgroundColor: ''
  })
  objects.forEach((obj) => {
    const clone = fabric.util.object.clone(obj)
    clone.set({
      left: (clone.left ?? 0) - bounds.left,
      top: (clone.top ?? 0) - bounds.top
    })
    tempCanvas.add(clone)
  })
  tempCanvas.requestRenderAll()
  return tempCanvas
}

// 复制当前画布或选中对象为 SVG 到剪贴板。
async function copyAsSVG() {
  if (!fabricCanvas) return
  clearBooleanPreview()
  const selectedObjects = fabricCanvas.getActiveObjects()
  let svgContent = ''
  if (selectedObjects.length > 0) {
    const tempCanvas = createSelectionCanvas(selectedObjects)
    if (!tempCanvas) {
      window.alert('无法复制选中对象：边界无效')
      return
    }
    try {
      const rawSvg = tempCanvas.toSVG({
        suppressPreamble: true,
        viewBox: { x: 0, y: 0, width: tempCanvas.width!, height: tempCanvas.height! },
        width: String(tempCanvas.width),
        height: String(tempCanvas.height)
      })
      svgContent = trimSVGWhitespace(ensureOptimizedSVGRoot(
        stripFabricSVGNoise(rawSvg),
        tempCanvas.width!,
        tempCanvas.height!,
        ''
      ))
    } finally {
      tempCanvas.dispose()
    }
  } else {
    svgContent = createOptimizedSVG(false)
  }
  if (!svgContent) {
    window.alert('生成 SVG 失败')
    return
  }
  try {
    await navigator.clipboard.writeText(svgContent)
    console.log('已复制 SVG 到剪贴板')
  } catch (error) {
    window.alert('复制到剪贴板失败：' + (error instanceof Error ? error.message : '未知错误'))
  }
}

// 复制当前画布或选中对象为 PNG 到剪贴板。
async function copyAsPNG() {
  if (!fabricCanvas) return
  clearBooleanPreview()
  const selectedObjects = fabricCanvas.getActiveObjects()
  let dataUrl = ''
  if (selectedObjects.length > 0) {
    const tempCanvas = createSelectionCanvas(selectedObjects)
    if (!tempCanvas) {
      window.alert('无法复制选中对象：边界无效')
      return
    }
    try {
      dataUrl = tempCanvas.toDataURL({ format: 'png', multiplier: 1 })
    } finally {
      tempCanvas.dispose()
    }
  } else {
    dataUrl = renderPNGDataUrl(canvasWidth.value, true)
  }
  if (!dataUrl) {
    window.alert('生成 PNG 失败')
    return
  }
  try {
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ])
    console.log('已复制 PNG 到剪贴板')
  } catch (error) {
    window.alert('复制到剪贴板失败：' + (error instanceof Error ? error.message : '未知错误'))
  }
}

// 按导出面板配置批量输出 SVG 和多尺寸 PNG，并在面板内展示保存路径或错误信息。
async function runExportDialogExport() {
  if (!fabricCanvas || exportDialog.loading) return
  const pngSizes = getExportPngSizes()
  if (!exportDialog.svgEnabled && (!exportDialog.pngEnabled || !pngSizes.length)) {
    exportDialog.status = '请至少选择一种导出格式或一个 PNG 尺寸。'
    return
  }
  exportDialog.loading = true
  exportDialog.status = ''
  try {
    const prefix = getExportFilePrefix()
    const paths: string[] = []
    if (exportDialog.svgEnabled) {
      const path = exportSVG(`${prefix}.svg`, exportDialog.svgIncludeBg)
      if (path) paths.push(path)
    }
    if (exportDialog.pngEnabled) {
      pngSizes.forEach((size) => {
        const path = exportPNG(size, `${prefix}-${size}.png`, exportDialog.transparentBg)
        if (path) paths.push(path)
      })
    }
    exportDialog.status = paths.length
      ? `导出成功：\n${paths.join('\n')}`
      : '导出失败：未生成任何文件。'
  } catch (error) {
    exportDialog.status = error instanceof Error ? error.message : '导出失败'
  } finally {
    exportDialog.loading = false
  }
}

// 新建空白文档时清理当前选择、历史记录、网格辅助设置和旧草稿，避免上一份作品继续触发恢复提示。
function newDoc() {
  if (!fabricCanvas) return
  clearBooleanPreview()
  clearPointEditing()
  clearStoredDraft()
  skipSnapshot = true
  fabricCanvas.clear()
  skipSnapshot = false
  showPixelGrid.value = false
  snapToPixelGrid.value = false
  pixelGridSize.value = DEFAULT_PIXEL_GRID_SIZE
  keylineTemplate.value = DEFAULT_KEYLINE_TEMPLATE
  keylineMargin.value = DEFAULT_KEYLINE_MARGIN
  syncPixelGridSizeInput()
  syncKeylineMarginInput()
  syncCanvasInteractionMode()
  applyCanvasBgToFabric(canvasBg.value)
  fabricCanvas.requestRenderAll()
  syncActiveObject(null)
  refreshLayers()
  resetHistoryToCurrentCanvas()
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

// ── 图层 ──
function isLayerActive(obj: FabricObject) {
  return fabricCanvas?.getActiveObjects().includes(obj) ?? false
}

function handleLayerMouseDown(obj: FabricObject, event: MouseEvent) {
  if (event.button !== 0) return
  selectLayer(obj, event)
}

function isLayerKaleidoscopeLocked(obj: FabricObject) {
  return isKaleidoscopeInstance(obj)
}

function selectLayer(obj: FabricObject, event?: MouseEvent | PointerEvent) {
  if (!fabricCanvas) return
  ensureShapeSelectionForLayerActions()
  clearPointEditing()
  const selected = fabricCanvas.getActiveObjects()
  const hasCtrlLike = !!event && !!(event.ctrlKey || event.metaKey)
  const hasShift = !!event?.shiftKey
  if (hasShift) {
    const rangeObjects = getLayerRangeObjects(obj)
    const nextSelection = hasCtrlLike
      ? [...selected, ...rangeObjects]
      : rangeObjects
    applyActiveObjectsSelection(nextSelection, event as MouseEvent | undefined)
    setLayerSelectionAnchor(obj)
    return
  }
  if (hasCtrlLike) {
    const nextSelection = selected.includes(obj)
      ? selected.filter((item) => item !== obj)
      : [...selected, obj]
    applyActiveObjectsSelection(nextSelection, event as MouseEvent | undefined)
    setLayerSelectionAnchor(obj)
    return
  }
  fabricCanvas.setActiveObject(obj, event as MouseEvent | undefined)
  syncActiveObject(fabricCanvas.getActiveObject() ?? obj)
  fabricCanvas.requestRenderAll()
  setLayerSelectionAnchor(obj)
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

function toggleVisible(obj: FabricObject) {
  obj.visible = !obj.visible
  fabricCanvas?.requestRenderAll()
  refreshActiveObject()
  snapshot()
}

function toggleLock(obj: FabricObject) {
  const locked = !obj.lockMovementX
  obj.set({
    lockMovementX: locked, lockMovementY: locked,
    lockScalingX: locked, lockScalingY: locked,
    lockRotation: locked, hasControls: !locked,
    selectable: true
  })
  fabricCanvas?.requestRenderAll()
  refreshActiveObject()
  snapshot()
}

function removeObject(obj: FabricObject) {
  deleteObjects([obj])
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
    scrollLeft: area.scrollLeft,
    scrollTop: area.scrollTop
  }
  isSpacePanning.value = true
  window.addEventListener('pointermove', handleSpacePanPointerMove, true)
  window.addEventListener('pointerup', handleSpacePanPointerEnd, true)
  window.addEventListener('pointercancel', handleSpacePanPointerEnd, true)
}

function handleSpacePanPointerMove(event: PointerEvent) {
  if (!spacePanStart || !canvasAreaRef.value || event.pointerId !== spacePanStart.pointerId) return
  event.preventDefault()
  canvasAreaRef.value.scrollLeft = spacePanStart.scrollLeft - (event.clientX - spacePanStart.x)
  canvasAreaRef.value.scrollTop = spacePanStart.scrollTop - (event.clientY - spacePanStart.y)
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
    // 重置上一轮残留 (例如 selection 事件没正常 fire 时)
    pointModeSwitchPending = false
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
        restoreActiveObjectAfterSelectionClear = true
        fabricCanvas.discardActiveObject(event.e)
        return
      }
      const target = event.target
      if (target && target !== activeObject.value) {
        restoreActiveObjectAfterSelectionClear = true
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
      restoreActiveObjectAfterSelectionClear = true
      fabricCanvas.discardActiveObject(event.e)
      return
    }
    // 无修饰键, 点击其它图形 -> 切换到对应图形的点位模式
    if (target && target !== activeObject.value) {
      pointModeSwitchPending = true
      return
    }
    // 无修饰键, 点击当前 active 对象本体 / 空白区 -> 不做任何操作 (保持 active 与已选点)
    restoreActiveObjectAfterSelectionClear = true
    fabricCanvas.discardActiveObject(event.e)
  })

  fabricCanvas.on('mouse:move', (event) => {
    if (!fabricCanvas) return
    if (selectionMode.value !== 'point') return
    if (!pointGestureState.active) return
    const viewport = event.viewportPoint ?? fabricCanvas.getViewportPoint(event.e)
    const scene = event.scenePoint ?? fabricCanvas.getScenePoint(event.e)
    pointGestureState.currentViewport = { x: viewport.x, y: viewport.y }
    pointGestureState.currentScene = { x: scene.x, y: scene.y }
    if (!pointGestureState.thresholdExceeded) {
      const start = pointGestureState.startViewport
      if (!start) return
      if (!exceededViewportThreshold(start, pointGestureState.currentViewport)) return
      pointGestureState.thresholdExceeded = true
      // 越过阈值后决议手势类型
      if (pointGestureState.modifierAtStart) {
        // 修饰键起拖 -> box-select；如果初始来自点控件并已 toggle，先恢复 initialSelection
        if (pointGestureState.source === 'point-control') {
          const editable = activeEditablePathObject.value
          if (editable) {
            setSelectedEditablePoints(editable, pointGestureState.initialSelection)
          }
        }
        pointGestureState.kind = 'box-select'
        pointGestureState.pendingCollapseIndex = null
      } else if (pointGestureState.source === 'point-control') {
        if (pointGestureState.startedFromSelectedPoint && pointGestureState.initialSelection.length > 1) {
          pointGestureState.kind = 'group-drag'
        } else {
          pointGestureState.kind = 'single-drag'
        }
      } else {
        // 空白拖拽且无修饰键 -> 不进入任何拖拽，仍维持 pending（mouseup 时按"空白拖拽 = 无动作"处理）
        pointGestureState.kind = 'pending'
      }
    }
    if (pointGestureState.kind === 'box-select') {
      pointGestureState.previewHitIndices = computeBoxSelectPreviewHits()
      bumpPointGestureRender()
      fabricCanvas.requestRenderAll()
    }
  })

  fabricCanvas.on('mouse:up', () => {
    if (selectionMode.value !== 'point') return
    if (!pointGestureState.active) return
    const editable = activeEditablePathObject.value
    try {
      if (pointGestureState.kind === 'box-select' && editable) {
        // 命中为空时 unionBoxSelectFinalIndices() === initialSelection，保持原选择
        const finalIndices = unionBoxSelectFinalIndices()
        setSelectedEditablePoints(editable, finalIndices)
      } else if (
        pointGestureState.source === 'point-control'
        && !pointGestureState.thresholdExceeded
        && !pointGestureState.modifierAtStart
        && pointGestureState.pendingCollapseIndex != null
        && editable
      ) {
        // 多选状态下点击已选点但未拖拽 -> collapse 为单点
        setSelectedEditablePoints(editable, [pointGestureState.pendingCollapseIndex])
      }
    } finally {
      resetPointGestureState()
      bumpPointGestureRender()
      fabricCanvas?.requestRenderAll()
    }
  })

  fabricCanvas.on('after:render', () => {
    drawPointGestureMarquee()
  })

  fabricCanvas.on('selection:created', () => {
    clearBooleanPreview()
    if (pointModeSwitchPending) {
      pointModeSwitchPending = false
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
    if (pointModeSwitchPending) {
      pointModeSwitchPending = false
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
    if (pointModeSwitchPending) {
      return
    }
    // point 模式下若我们正在自定义手势中（无论 blank 还是 point-control），都要保住 active editable
    const protectingPointGesture = (
      selectionMode.value === 'point'
      && pointGestureState.active
      && !!activeObject.value
    )
    if ((restoreActiveObjectAfterSelectionClear || protectingPointGesture) && activeObject.value && fabricCanvas) {
      restoreActiveObjectAfterSelectionClear = false
      fabricCanvas.setActiveObject(activeObject.value)
      updateCurveControls()
      syncObjProps()
      fabricCanvas.requestRenderAll()
      return
    }
    restoreActiveObjectAfterSelectionClear = false
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
onMounted(() => {
  if (!canvasElRef.value) return
  void getPathKit()
  fabricCanvas = new Canvas(canvasElRef.value, {
    width: canvasWidth.value,
    height: canvasHeight.value,
    backgroundColor: isTransparentCanvasBg(canvasBg.value) ? '' : canvasBg.value,
    preserveObjectStacking: true,
    selection: true,
    selectionKey: ['shiftKey', 'ctrlKey'],
    uniformScaling: sizeRatioLocked.value
  })

  loadShortcutBindings()
  loadUserAssets()
  loadUserStylePresets()
  ensureCanvasObjectMetadata()
  applyCanvasTheme()
  syncCanvasInteractionMode()
  initAligningGuidelines()
  setupCanvasEvents()

  // 延迟 fit，确保 DOM 已完成布局
  nextTick(() => {
    fitCanvasInView()
    snapshot({ autoSave: false })
    void promptRestoreDraft()
  })

  // 窗口缩放自适应
  window.addEventListener('resize', fitCanvasInView)
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keyup', handleKeyup)
  window.addEventListener('blur', handleWindowBlur)
  window.addEventListener('paste', handleWindowPaste)
})

watch(
  () => [isDark.value, primaryColor.value, customColor.value],
  () => {
    applyCanvasTheme()
    fabricCanvas?.requestRenderAll()
  }
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', fitCanvasInView)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)
  window.removeEventListener('blur', handleWindowBlur)
  window.removeEventListener('paste', handleWindowPaste)
  endSpacePan()
  clearBooleanPreview()
  clearPointEditing()
  cancelSmallPreviewsRefresh()
  flushDraftBeforeDispose()
  aligningGuidelines?.dispose()
  aligningGuidelines = null
  fabricCanvas?.dispose()
})
</script>

<style lang="scss" scoped>
/* ── 基础变量 ── */
$topbar-h: 44px;
$left-w: 280px;
$right-w: 240px;
$border: 1px solid rgba(128, 128, 128, 0.18);
$bg: #f5f5f5;
$panel-bg: #fff;

/* ── 根布局 ── */
.editor-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg;
  font-size: 13px;
  color: #333;
  overflow: hidden;
}

.space-pan-ready .canvas-area,
.space-pan-ready .canvas-wrapper,
.space-pan-ready canvas {
  cursor: grab !important;
}
.space-panning .canvas-area,
.space-panning .canvas-wrapper,
.space-panning canvas {
  cursor: grabbing !important;
  user-select: none;
}

/* ── 主体 ── */
.editor-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ── 画布区 ── */
.canvas-frame {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  position: relative;
}
.canvas-frame .canvas-area {
  flex: 1;
}
.canvas-frame.with-ruler .canvas-area {
  padding-top: 24px;
  padding-left: 24px;
}
.canvas-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  background: #e0e0e0;
}
.canvas-wrapper {
  position: relative;
  box-shadow: 0 2px 12px rgba(0,0,0,0.15);
  background: #fff;
  &.transparent-bg {
    background-color: #fff;
    background-image:
      linear-gradient(45deg, rgba(0, 0, 0, 0.08) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.08) 75%, rgba(0, 0, 0, 0.08)),
      linear-gradient(45deg, rgba(0, 0, 0, 0.08) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.08) 75%, rgba(0, 0, 0, 0.08));
    background-position: 0 0, 8px 8px;
    background-size: 16px 16px;
  }
  .pixel-grid-overlay {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 8;
    pointer-events: none;
    background-image:
      linear-gradient(to right, rgba(30, 111, 255, 0.22) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(30, 111, 255, 0.22) 1px, transparent 1px);
    background-position: 0 0;
  }
  .keyline-overlay {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 9;
    pointer-events: none;
    overflow: visible;
  }
  .keyline-safe-area,
  .keyline-shape {
    fill: rgba(30, 111, 255, 0.05);
    stroke: rgba(30, 111, 255, 0.85);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
    stroke-dasharray: 8 5;
  }
  .keyline-shape {
    fill: none;
    stroke: rgba(30, 111, 255, 0.48);
    stroke-dasharray: 5 5;
  }
  .keyline-axis {
    stroke: rgba(30, 111, 255, 0.42);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    stroke-dasharray: 4 6;
  }
  :deep(canvas) {
    display: block;
  }
}

.canvas-bg-picker,
.stroke-line-type-picker {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  :deep(.zt-color-picker) {
    display: inline-flex;
    flex: 0 0 auto;
  }
}

.transparent-swatch {
  position: relative;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  overflow: hidden;
  padding: 0;
  box-sizing: border-box;
  background-color: #fafafa;
  background-image:
    linear-gradient(45deg, rgba(0, 0, 0, 0.07) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.07) 75%, rgba(0, 0, 0, 0.07)),
    linear-gradient(45deg, rgba(0, 0, 0, 0.07) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.07) 75%, rgba(0, 0, 0, 0.07));
  background-position: 0 0, 6px 6px;
  background-size: 12px 12px;
  box-shadow: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover:not(:disabled) {
    background-color: #fafafa;
    background-image:
      linear-gradient(45deg, rgba(0, 0, 0, 0.07) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.07) 75%, rgba(0, 0, 0, 0.07)),
      linear-gradient(45deg, rgba(0, 0, 0, 0.07) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.07) 75%, rgba(0, 0, 0, 0.07));
    background-position: 0 0, 6px 6px;
    background-size: 12px 12px;
  }

  &.active {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light-bg);
  }
}

.stroke-line-swatch {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  padding: 0;
  box-sizing: border-box;
  border: 2px solid var(--control-border);
  border-radius: 6px;
  background: #fafafa;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease;

  &::before {
    content: '';
    display: block;
    width: 16px;
    height: 0;
    border-top: 2px solid #333;
    margin: 0 auto;
  }

  &.dashed::before {
    border-top-style: dashed;
  }

  &:hover:not(:disabled) {
    background-color: #fafafa;
    border-color: color-mix(in srgb, var(--primary-color), black 15%);
  }

  &.active {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light-bg);
  }
}

.arrow-shape-picker,
.fill-style-picker {
  .stroke-line-swatch {
    &::before {
      display: none;
    }
    background-color: #fafafa;
    background-position: center;
    background-repeat: no-repeat;
    background-size: 18px 16px;

    &:hover:not(:disabled) {
      background-color: #fafafa;
    }
  }
}

.arrow-shape-picker {
  .arrow-shape-solid {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 16'><path d='M2 8H11' fill='none' stroke='%23333' stroke-width='2.4' stroke-linecap='round'/><path d='M10.2 4.15C10.2 3.57 10.85 3.23 11.33 3.55L15.32 6.22C16.5 7.01 16.5 8.99 15.32 9.78L11.33 12.45C10.85 12.77 10.2 12.43 10.2 11.85V4.15Z' fill='%23333'/></svg>");
  }
  .arrow-shape-hollow {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 16'><path d='M2 8H11' fill='none' stroke='%23333' stroke-width='2.4' stroke-linecap='round'/><path d='M10.4 4.5L13.9 8L10.4 11.5' fill='none' stroke='%23333' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  }
}

.fill-style-picker {
  .fill-style-solid {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 16'><rect x='3' y='3' width='12' height='10' rx='2' fill='%23333'/></svg>");
  }
  .fill-style-radial {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 16'><defs><radialGradient id='g' cx='50%25' cy='50%25' r='65%25'><stop offset='0%25' stop-color='%23333'/><stop offset='100%25' stop-color='%23d8d8d8'/></radialGradient></defs><rect x='3' y='3' width='12' height='10' rx='2' fill='url(%23g)' stroke='%23333' stroke-width='0.6'/></svg>");
  }
  .fill-style-linear {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 16'><defs><linearGradient id='g' x1='0%25' y1='50%25' x2='100%25' y2='50%25'><stop offset='0%25' stop-color='%23333'/><stop offset='100%25' stop-color='%23d8d8d8'/></linearGradient></defs><rect x='3' y='3' width='12' height='10' rx='2' fill='url(%23g)' stroke='%23333' stroke-width='0.6'/></svg>");
  }
}

</style>