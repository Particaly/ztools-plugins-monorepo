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
      :can-undo="editorSelectors.canUndo"
      :can-redo="editorSelectors.canRedo"
      :show-ruler="editorSelectors.showRuler"
      :show-pixel-grid="editorSelectors.showPixelGrid"
      :snap-to-pixel-grid="editorSelectors.snapToPixelGrid"
      :keyline-active="editorSelectors.isKeylineActive"
      :shortcut-drawer-open="editorSelectors.shortcutDrawerOpen"
      :selection-mode="editorSelectors.selectionMode"
      :has-editable-points="editorSelectors.hasEditablePoints"
      :zoom="editorSelectors.zoom"
      :show-artboard-list="editorSelectors.showArtboardList"
      @new-doc="editorCommands.newDoc"
      @open-project="editorCommands.openProject"
      @save-project="editorCommands.saveProject"
      @import-svg="editorCommands.importSVG"
      @open-paste-svg="editorCommands.openPasteSVGDialog"
      @import-image="editorCommands.importImage"
      @copy-as-svg="editorCommands.copyAsSVG"
      @copy-as-png="editorCommands.copyAsPNG"
      @open-export="editorCommands.openExportDialog"
      @toggle-artboard-list="editorCommands.toggleArtboardList"
      @undo="editorCommands.undo"
      @redo="editorCommands.redo"
      @toggle-ruler="editorCommands.toggleRuler"
      @toggle-pixel-grid="editorCommands.togglePixelGrid"
      @toggle-snap-to-pixel-grid="editorCommands.toggleSnapToPixelGrid"
      @toggle-keyline-overlay="editorCommands.toggleKeylineOverlay"
      @open-shortcut-drawer="editorCommands.openShortcutDrawer"
      @set-selection-mode="editorCommands.setSelectionMode"
      @set-zoom="editorCommands.setZoom"
    />

    <div class="editor-body">
      <!-- 左栏 -->
      <LeftPanel
        :active-tab="leftTab"
        :basic-shapes="basicShapes"
        :shape-preview-paths="shapePreviewPaths"
        :text-presets="textPresets"
        :icon-templates="iconTemplates"
        :user-assets="importedUserAssets"
        :can-save-user-asset="canSaveUserAsset"
        :iconify-search="iconifyImportState"
        :filtered-iconify-results="importedFilteredIconifyResults"
        :iconify-collection-options="importedIconifyCollectionOptions"
        @update:active-tab="leftTab = $event"
        @add-shape="editorCommands.addShape"
        @add-text="editorCommands.addText"
        @insert-template="assetsImportCommands.insertIconTemplate"
        @apply-template-as-document="assetsImportCommands.applyIconTemplateAsDocument"
        @open-create-user-asset-dialog="assetsImportCommands.openCreateUserAssetDialog"
        @insert-user-asset="assetsImportCommands.insertUserAsset"
        @rename-user-asset="assetsImportCommands.openRenameUserAssetDialog"
        @delete-user-asset="assetsImportCommands.deleteUserAsset"
        @update:iconify-query="iconifyImportState.query = $event"
        @search-iconify-icons="assetsImportCommands.searchIconifyIcons"
        @update:iconify-collection-filter="iconifyImportState.collectionFilter = $event"
        @insert-iconify-icon="assetsImportCommands.insertIconifyIcon"
      />

      <!-- 工具栏 -->
      <HomeToolBar
        :can-undo="editorSelectors.canUndo"
        :can-redo="editorSelectors.canRedo"
        :selection-mode="editorSelectors.selectionMode"
        :has-editable-points="editorSelectors.hasEditablePoints"
        :show-artboard-list="editorSelectors.showArtboardList"
        :show-ruler="editorSelectors.showRuler"
        :show-pixel-grid="editorSelectors.showPixelGrid"
        :snap-to-pixel-grid="editorSelectors.snapToPixelGrid"
        :keyline-active="editorSelectors.isKeylineActive"
        :shortcut-drawer-open="editorSelectors.shortcutDrawerOpen"
        @undo="editorCommands.undo"
        @redo="editorCommands.redo"
        @set-selection-mode="editorCommands.setSelectionMode"
        @toggle-artboard-list="editorCommands.toggleArtboardList"
        @toggle-ruler="editorCommands.toggleRuler"
        @toggle-pixel-grid="editorCommands.togglePixelGrid"
        @toggle-snap-to-pixel-grid="editorCommands.toggleSnapToPixelGrid"
        @toggle-keyline-overlay="editorCommands.toggleKeylineOverlay"
        @open-shortcut-drawer="editorCommands.openShortcutDrawer"
      />

      <!-- 画板列表 -->
      <ArtboardList
        v-if="editorSelectors.showArtboardList && artboards.length > 0"
        :artboards="artboards"
        :active-artboard-id="activeArtboardId"
        @add-artboard="addArtboard"
        @switch-artboard="switchArtboard"
        @duplicate-artboard="duplicateArtboard"
        @rename-artboard="renameArtboard"
        @delete-artboard="deleteArtboard"
      />

      <!-- 中间画布区 -->
      <div class="canvas-frame" :class="{ 'with-ruler': editorSelectors.showRuler }">
        <main
          class="canvas-area"
          ref="canvasAreaRef"
          @pointerdown.capture="handleCanvasAreaPointerDown"
          @dragover.prevent="assetsImportCommands.handleCanvasDragOver"
          @drop.prevent="assetsImportCommands.handleCanvasDrop"
        >
          <div class="canvas-wrapper" ref="canvasWrapperRef" :class="{ 'transparent-bg': isCanvasBgTransparent }">
            <div
              v-if="editorSelectors.showPixelGrid"
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
          v-if="editorSelectors.showRuler"
          :scroll-el="canvasAreaRef"
          :wrapper-el="canvasWrapperRef"
          :zoom="editorSelectors.zoom"
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
            :active-object="editorSelectors.activeObject"
            :active-kaleidoscope-instance="activeKaleidoscopeInstance"
            :active-kaleidoscope-editable-source="activeKaleidoscopeEditableSource"
            :obj-props="objProps"
            :size-ratio-locked="sizeRatioLocked"
            :align-popover-visible="alignPopoverVisible"
            :current-align-position="currentAlignPosition"
            :align-positions="alignPositions"
            :current-align-id="currentAlignId"
            :current-fill-style-mode="currentFillStyleMode"
            :has-editable-points="editorSelectors.hasEditablePoints"
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
            :can-vectorize-bitmap-selection="canVectorizeBitmapSelection"
            :bitmap-trace-busy="bitmapTraceBusy"
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
            :keyline-opacity="keylineOpacity"
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
            :vectorize-selection-bitmap="vectorizeSelectionBitmap"
            :set-bitmap-trace-mode="setBitmapTraceMode"
            :set-bitmap-trace-threshold-from-input="setBitmapTraceThresholdFromInput"
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
            :set-keyline-opacity="setKeylineOpacity"
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
        <template #history>
          <HistoryPanel
            :undo-stack="undoStack"
            :current-index="historyIndex"
            @jump-to="jumpToHistory"
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
      @close="editorCommands.closeShortcutDrawer"
      @reset="resetShortcutBindingsToDefault"
      @apply-binding="applyShortcutBinding"
      @add-binding="addShortcutBinding"
      @remove-binding="removeShortcutBinding"
    />

    <PasteSvgModal
      :show="importedPasteSVGDialog.show"
      v-model:value="importedPasteSVGDialog.value"
      :error="importedPasteSVGDialog.error"
      :loading="importedPasteSVGDialog.loading"
      @update:show="assetsImportCommands.handlePasteSVGDialogShowChange"
      @read-clipboard="assetsImportCommands.readClipboardIntoPasteSVGDialog"
      @confirm="assetsImportCommands.confirmPasteSVGImport"
    />

    <ExportModal
      :show="exportDialog.show"
      :dialog="exportDialog"
      :size-options="EXPORT_PNG_SIZE_OPTIONS"
      :selected-png-sizes="exportDialog.pngSizes"
      :can-export="exportDialogCanExport"
      :artboards="artboards"
      :export-all-artboards="exportDialog.exportAllArtboards"
      :selected-preset="exportDialogSelectedPreset"
      @update:show="handleExportDialogShowChange"
      @set-format-enabled="setExportFormatEnabled"
      @update:svg-include-bg="exportDialog.svgIncludeBg = $event"
      @toggle-png-size="toggleExportPngSize"
      @update:custom-size-input="exportDialog.customSizeInput = $event"
      @update:transparent-bg="exportDialog.transparentBg = $event"
      @update:file-prefix="exportDialog.filePrefix = $event"
      @update:export-all-artboards="exportDialog.exportAllArtboards = $event"
      @select-preset="handleExportPresetSelect"
      @export="runExportDialogExport"
    />

    <LayerRenameModal
      :show="layerRenameDialog.show"
      v-model:value="layerRenameDialog.value"
      @update:show="handleLayerRenameDialogShowChange"
      @confirm="confirmLayerRename"
    />

    <UserAssetModal
      :show="importedUserAssetDialog.show"
      v-model:name="importedUserAssetDialog.name"
      :mode="importedUserAssetDialog.mode"
      :error="importedUserAssetDialog.error"
      @update:show="assetsImportCommands.handleUserAssetDialogShowChange"
      @confirm="assetsImportCommands.confirmUserAssetDialog"
    />

        <!-- 隐藏的文件输入 -->
    <input ref="projectInputRef" type="file" accept=".iconcreator.json,application/json" style="display:none" @change="onProjectFileChosen" />
    <input ref="svgInputRef" type="file" accept=".svg,image/svg+xml" style="display:none" @change="assetsImportCommands.onSVGFileChosen" />
    <input ref="imgInputRef" type="file" accept="image/*" style="display:none" @change="assetsImportCommands.onImageFileChosen" />

    <!-- Toast 通知 -->
    <Toast :message="toast.message" :type="toast.type" :duration="toast.duration" :key="toast.key" />
  </div>
</template>

<script setup lang="ts">
import HomeTopBar from './components/HomeTopBar.vue'
import HomeToolBar from './components/HomeToolBar.vue'
import LeftPanel from './components/LeftPanel.vue'
import ArtboardList from './components/ArtboardList.vue'
import Ruler from './components/Ruler.vue'
import RightPanel from './components/panels/RightPanel.vue'
import PropertiesPanel from './components/panels/PropertiesPanel.vue'
import PreviewPanel from './components/panels/PreviewPanel.vue'
import IconChecksPanel from './components/panels/IconChecksPanel.vue'
import LayersPanel from './components/panels/LayersPanel.vue'
import HistoryPanel from './components/panels/HistoryPanel.vue'
import ShortcutDrawer from './components/ShortcutDrawer.vue'
import PasteSvgModal from './components/modals/PasteSvgModal.vue'
import ExportModal from './components/modals/ExportModal.vue'
import LayerRenameModal from './components/modals/LayerRenameModal.vue'
import UserAssetModal from './components/modals/UserAssetModal.vue'
import Toast from './components/Toast.vue'
import { basicShapes, textPresets, shapePreviewPaths, iconTemplates } from './editorCatalog'
import { EXPORT_PNG_SIZE_OPTIONS } from './constants'
import { useHomeEditorRuntime } from './useHomeEditorRuntime'

const {
  canvasElRef,
  canvasAreaRef,
  canvasWrapperRef,
  svgInputRef,
  imgInputRef,
  projectInputRef,
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
  keylineSafeArea,
  iconCheckIssues,
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
  artboards,
  activeArtboardId,
  undoStack,
  historyIndex,
  addArtboard,
  deleteArtboard,
  duplicateArtboard,
  jumpToHistory,
  onProjectFileChosen,
  renameArtboard,
  switchArtboard,
  keylineTemplateOptions,
  previewBackgroundOptions,
  previewBackgroundMode,
  previewItems,
  visibleColorPaletteGroups,
  visibleGradientPresets,
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
  setPreviewBackgroundMode,
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
  handleCanvasAreaPointerDown
} = useHomeEditorRuntime()
</script>

<style lang="scss" scoped>
/* ── 基础变量 ── */
$topbar-h: 44px;
$left-w: 270px;
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