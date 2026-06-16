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
      :insert-active-tab="leftTab"
      :basic-shapes="basicShapes"
      :shape-preview-paths="shapePreviewPaths"
      :text-presets="textPresets"
      :icon-templates="iconTemplates"
      :user-assets="importedUserAssets"
      :iconify-search="iconifyImportState"
      :filtered-iconify-results="importedFilteredIconifyResults"
      :iconify-collection-options="importedIconifyCollectionOptions"
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
      @update:insert-active-tab="leftTab = $event"
      @add-shape="editorCommands.addShape"
      @add-text="editorCommands.addText"
      @insert-template="assetsImportCommands.insertIconTemplate"
      @apply-template-as-document="assetsImportCommands.applyIconTemplateAsDocument"
      @insert-user-asset="assetsImportCommands.insertUserAsset"
      @rename-user-asset="assetsImportCommands.openRenameUserAssetDialog"
      @delete-user-asset="assetsImportCommands.deleteUserAsset"
      @update:iconify-query="iconifyImportState.query = $event"
      @search-iconify-icons="assetsImportCommands.searchIconifyIcons"
      @update:iconify-collection-filter="iconifyImportState.collectionFilter = $event"
      @insert-iconify-icon="assetsImportCommands.insertIconifyIcon"
    />

    <div class="editor-body">
      <!-- 左栏 -->
      <LeftPanel
        :collapsed="leftPanelCollapsed"
        :active-tab="leftTab"
        :basic-shapes="basicShapes"
        :shape-preview-paths="shapePreviewPaths"
        :text-presets="textPresets"
        :icon-templates="iconTemplates"
        :user-assets="importedUserAssets"
        :iconify-search="iconifyImportState"
        :filtered-iconify-results="importedFilteredIconifyResults"
        :iconify-collection-options="importedIconifyCollectionOptions"
        @update:active-tab="leftTab = $event"
        @add-shape="editorCommands.addShape"
        @add-text="editorCommands.addText"
        @insert-template="assetsImportCommands.insertIconTemplate"
        @apply-template-as-document="assetsImportCommands.applyIconTemplateAsDocument"
        @insert-user-asset="assetsImportCommands.insertUserAsset"
        @rename-user-asset="assetsImportCommands.openRenameUserAssetDialog"
        @delete-user-asset="assetsImportCommands.deleteUserAsset"
        @update:iconify-query="iconifyImportState.query = $event"
        @search-iconify-icons="assetsImportCommands.searchIconifyIcons"
        @load-more-iconify-browse-results="assetsImportCommands.loadMoreIconifyBrowseResults"
        @update:iconify-collection-filter="iconifyImportState.collectionFilter = $event"
        @insert-iconify-icon="assetsImportCommands.insertIconifyIcon"
      />

      <!-- 工具栏 -->
      <HomeToolBar
        :can-undo="editorSelectors.canUndo"
        :can-redo="editorSelectors.canRedo"
        :selection-mode="editorSelectors.selectionMode"
        :has-editable-points="editorSelectors.hasEditablePoints"
        :pen-tool-active="penToolActive"
        :show-artboard-list="editorSelectors.showArtboardList"
        :show-ruler="editorSelectors.showRuler"
        :show-pixel-grid="editorSelectors.showPixelGrid"
        :snap-to-pixel-grid="editorSelectors.snapToPixelGrid"
        :keyline-active="editorSelectors.isKeylineActive"
        :keyline-template="keylineTemplate"
        :keyline-template-options="keylineTemplateOptions"
        :shortcut-drawer-open="editorSelectors.shortcutDrawerOpen"
        :left-panel-collapsed="leftPanelCollapsed"
        @undo="editorCommands.undo"
        @redo="editorCommands.redo"
        @set-selection-mode="editorCommands.setSelectionMode"
        @toggle-pen-tool="togglePenTool"
        @toggle-artboard-list="editorCommands.toggleArtboardList"
        @toggle-ruler="editorCommands.toggleRuler"
        @toggle-pixel-grid="editorCommands.togglePixelGrid"
        @toggle-snap-to-pixel-grid="editorCommands.toggleSnapToPixelGrid"
        @toggle-keyline-overlay="editorCommands.toggleKeylineOverlay"
        @set-keyline-template="setKeylineTemplate"
        @open-shortcut-drawer="editorCommands.openShortcutDrawer"
        @toggle-left-panel="toggleLeftPanel"
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
      <div class="canvas-frame" :class="[{ 'with-ruler': editorSelectors.showRuler }, { 'is-left-panel-collapsed': leftPanelCollapsed }, `mode-${canvasViewMode}`]">
        <div class="project-tab-bar" role="tablist" aria-label="项目标签">
          <div
            v-for="tab in projectTabs"
            :key="tab.id"
            class="project-tab"
            :class="{ active: tab.id === activeProjectTabId, dirty: tab.dirty }"
            role="tab"
            tabindex="0"
            :aria-selected="tab.id === activeProjectTabId"
            @click="switchProjectTab(tab.id)"
            @keydown.enter.prevent="switchProjectTab(tab.id)"
            @keydown.space.prevent="switchProjectTab(tab.id)"
          >
            <span class="project-tab-name">{{ tab.name }}</span>
            <span v-if="tab.dirty" class="project-tab-dirty" title="未保存修改" aria-label="未保存修改"></span>
            <button
              v-if="hasMultipleProjectTabs"
              type="button"
              class="project-tab-close"
              title="关闭项目"
              aria-label="关闭项目"
              @click.stop="closeProjectTab(tab.id)"
            >
              <Icon icon="mdi:close" />
            </button>
          </div>
          <button type="button" class="project-tab-add" title="新建项目标签" aria-label="新建项目标签" @click="addProjectTab">
            <Icon icon="mdi:plus" />
          </button>
        </div>
        <main
          class="canvas-area"
          ref="canvasAreaRef"
          @pointerdown.capture="handleCanvasAreaPointerDown"
          @wheel="handleCanvasAreaWheel"
          @dragover.prevent="assetsImportCommands.handleCanvasDragOver"
          @drop.prevent="assetsImportCommands.handleCanvasDrop"
        >
          <div
            class="canvas-wrapper"
            ref="canvasWrapperRef"
            :class="{ 'transparent-bg': isCanvasBgTransparent, 'is-hidden': canvasViewMode !== 'canvas' }"
            :style="canvasWrapperStyle"
            @contextmenu.prevent="openCanvasObjectContextMenu"
          >
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
          <section v-if="canvasViewMode === 'svg'" class="svg-preview-panel" :class="`svg-preview-${svgPreviewMode}`" aria-label="SVG 只读预览">
            <div class="svg-preview-head">
              <div>
                <div class="svg-preview-title">SVG 只读预览</div>
                <div class="svg-preview-subtitle">{{ svgPreviewMode === 'graphic' ? '当前画布实时导出的 SVG 图形' : '当前画布实时导出的 SVG 文本' }}</div>
              </div>
              <div class="svg-preview-tabs" role="tablist" aria-label="SVG 预览模式">
                <button
                  v-for="option in svgPreviewModeOptions"
                  :key="option.value"
                  type="button"
                  class="svg-preview-tab"
                  :class="{ active: svgPreviewMode === option.value }"
                  role="tab"
                  :aria-selected="svgPreviewMode === option.value"
                  @click="setSvgPreviewMode(option.value)"
                >
                  <Icon :icon="option.icon" />
                  <span>{{ option.label }}</span>
                </button>
              </div>
            </div>
            <div v-if="svgPreviewMode === 'graphic'" class="svg-preview-graphic" aria-label="SVG 图形模式预览">
              <img v-if="svgPreviewDataUrl" class="svg-preview-image" :src="svgPreviewDataUrl" alt="当前 SVG 图形预览" draggable="false" />
              <div v-else class="svg-preview-empty">暂无可预览的 SVG 内容</div>
            </div>
            <pre v-else class="svg-preview-code" aria-label="SVG 代码模式只读预览"><code v-html="highlightedSvgPreviewSource"></code></pre>
          </section>
        </main>
        <Ruler
          v-if="editorSelectors.showRuler && canvasViewMode === 'canvas'"
          :scroll-el="canvasAreaRef"
          :wrapper-el="canvasWrapperRef"
          :zoom="editorSelectors.zoom"
          :coordinate-hint-active="rulerCoordinateHintActive"
        />
        <div
          class="canvas-mode-switcher"
          :class="{ 'is-collapsed': canvasModeSwitcherCollapsed }"
          role="group"
          aria-label="画布模式切换与状态"
          :aria-expanded="!canvasModeSwitcherCollapsed"
        >
          <button
            type="button"
            class="canvas-mode-switcher__handle"
            :title="canvasModeSwitcherCollapsed ? '展开画布模式切换器' : '收起画布模式切换器'"
            :aria-label="canvasModeSwitcherCollapsed ? '展开画布模式切换器' : '收起画布模式切换器'"
            @click="toggleCanvasModeSwitcherCollapsed"
          >
            <Icon :icon="canvasModeSwitcherCollapsed ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
          </button>
          <div class="canvas-mode-switcher__body" :aria-hidden="canvasModeSwitcherCollapsed">
            <ZPopover
              :show="previewPopoverVisible"
              trigger="hover"
              placement="top"
              show-arrow
              keep-alive-on-hover
              @update:show="handlePreviewPopoverShowChange"
            >
              <template #trigger>
                <button type="button" class="canvas-mode-icon-btn" title="预览输出尺寸预览" aria-label="预览输出尺寸预览">
                  <Icon icon="mdi:image-search-outline" />
                </button>
              </template>
              <PreviewPanel
                :background-options="previewBackgroundOptions"
                :background-mode="previewBackgroundMode"
                :items="previewItems"
                :stage-class="previewStageClass"
                @set-background-mode="setPreviewBackgroundMode"
              />
            </ZPopover>
            <ZPopover
              trigger="hover"
              placement="top"
              show-arrow
              keep-alive-on-hover
            >
              <template #trigger>
                <button
                  type="button"
                  class="canvas-mode-icon-btn"
                  :class="{ 'has-issues': iconCheckIssues.length > 0 }"
                  :title="iconCheckSummary.title"
                  :aria-label="iconCheckSummary.title"
                >
                  <Icon :icon="iconCheckIssues.length > 0 ? 'mdi:alert-circle-outline' : 'mdi:check-circle-outline'" />
                </button>
              </template>
              <IconChecksPanel
                :issues="iconCheckIssues"
                @select-issue="selectIconCheckIssue"
              />
            </ZPopover>
            <button type="button" class="canvas-mode-btn" :class="{ active: canvasViewMode === 'canvas' }" @click="setCanvasViewMode('canvas')">Canvas</button>
            <ZPopover
              trigger="hover"
              placement="top"
              :to="false"
              show-arrow
              keep-alive-on-hover
            >
              <template #trigger>
                <button
                  type="button"
                  class="canvas-mode-btn"
                  :class="{ active: canvasViewMode === 'svg' }"
                  :title="svgModeTooltipTitle"
                  :aria-label="svgModeTooltipTitle"
                  @click="setCanvasViewMode('svg')"
                >
                  SVG
                </button>
              </template>
              <div class="svg-mode-tooltip" role="menu" aria-label="SVG 预览模式切换">
                <div class="svg-mode-tooltip-head">
                  <div class="svg-mode-tooltip-title">{{ svgModeTooltipTitle }}</div>
                  <div class="svg-mode-tooltip-detail">{{ svgModeTooltipDetail }}</div>
                </div>
                <button
                  v-for="option in svgPreviewModeOptions"
                  :key="option.value"
                  type="button"
                  class="svg-mode-option"
                  :class="{ active: svgPreviewMode === option.value }"
                  role="menuitemradio"
                  :aria-checked="svgPreviewMode === option.value"
                  @click="setSvgPreviewMode(option.value)"
                >
                  <Icon :icon="option.icon" />
                  <span>
                    <strong>{{ option.label }}</strong>
                    <small>{{ option.description }}</small>
                  </span>
                </button>
              </div>
            </ZPopover>
          </div>
        </div>
      </div>

      <!-- 右栏 -->
      <RightPanel
        :active-tab="activeRightTab"
        @update:active-tab="activeRightTab = $event"
      >
        <template #properties>
          <PropertiesPanel
            :active-object="editorSelectors.activeObject"
            :is-multi-selection="isMultiSelection"
            :selection-count="selectionCount"
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
            :color-palette-columns="stylePresetColorColumns"
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
            :apply-gradient-preset="applyGradientPreset"
            :open-style-preset-manager="openStylePresetManager"
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
            :add-shadow-effect="addShadowEffect"
            :toggle-shadow-effect="toggleShadowEffect"
            :set-shadow-effect-prop="setShadowEffectProp"
            :remove-shadow-effect="removeShadowEffect"
            :toggle-blur="toggleBlur"
            :set-blur-radius-from-input="setBlurRadiusFromInput"
            :flip-object="flipObject"
            :reset-transform="resetTransform"
            :set-skew-from-input="setSkewFromInput"
            :copy-style="copyStyle"
            :paste-style="pasteStyle"
            :current-lock-mode="currentLockMode"
            :set-lock-mode="setLockMode"
            :create-clipping-mask="createClippingMask"
            :release-clipping-mask="releaseClippingMask"
            :can-create-clipping-mask="canCreateClippingMask"
            :has-clipping-mask="hasClippingMask"
            @update:align-popover-visible="alignPopoverVisible = $event"
            @update:canvas-width-input="canvasWidthInput = $event"
            @update:canvas-height-input="canvasHeightInput = $event"
            @update:pixel-grid-size-input="pixelGridSizeInput = $event"
            @update:keyline-margin-input="keylineMarginInput = $event"
          />
        </template>
        <template #layers>
          <LayersPanel
            :filtered-layers="filteredLayers"
            :layer-drag-items="layerDragItems"
            :is-layer-drag-disabled="isLayerDragDisabled"
            :layer-search="layerSearch"
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
      <ZContextMenu
        :show="layerContextMenu.show"
        :x="layerContextMenu.x"
        :y="layerContextMenu.y"
        :menu-items="layerContextMenuItems"
        @update:show="layerContextMenu.show = $event"
        @select="handleLayerContextMenuSelect"
      />
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

    <ArtboardRenameModal
      :show="artboardRenameDialog.show"
      :value="artboardRenameDialog.value"
      @update:show="handleArtboardRenameDialogShowChange"
      @update:value="artboardRenameDialog.value = $event"
      @confirm="confirmArtboardRename"
    />

    <UserAssetModal
      :show="importedUserAssetDialog.show"
      v-model:name="importedUserAssetDialog.name"
      :mode="importedUserAssetDialog.mode"
      :error="importedUserAssetDialog.error"
      @update:show="assetsImportCommands.handleUserAssetDialogShowChange"
      @confirm="assetsImportCommands.confirmUserAssetDialog"
    />

    <StylePresetManagerModal
      :show="stylePresetManagerState.show"
      :initial-tab="stylePresetManagerState.initialTab"
      :color-palette-groups="visibleColorPaletteGroups"
      :gradient-presets="stylePresetGradientPresets"
      :default-color-palette-groups="defaultStylePresetColorPaletteGroups"
      :default-gradient-presets="defaultStylePresetGradientPresets"
      :color-columns="stylePresetColorColumns"
      :default-color-columns="defaultStylePresetColorColumns"
      :gradient-rows="stylePresetGradientRows"
      :default-gradient-rows="defaultStylePresetGradientRows"
      :current-fill-color="stylePresetCurrentFillColor"
      :current-stroke-color="stylePresetCurrentStrokeColor"
      :current-gradient-preset="stylePresetCurrentGradientPreset"
      @update:show="handleStylePresetManagerShowChange"
      @confirm="applyStylePresetSettings"
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
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import { ZContextMenu, ZPopover } from 'ztools-ui'
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
import ArtboardRenameModal from './components/modals/ArtboardRenameModal.vue'
import UserAssetModal from './components/modals/UserAssetModal.vue'
import StylePresetManagerModal from './components/modals/StylePresetManagerModal.vue'
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
  leftPanelCollapsed,
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
  booleanBusy,
  booleanError,
  subtractPopoverVisible,
  objProps,
  sizeRatioLocked,
  hasSelectedPoint,
  canAlignSelection,
  canBoolean,
  canDirectionalSubtract,
  canDistributeSelection,
  canGroup,
  canUngroup,
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
  openCanvasObjectContextMenu,
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
  onProjectFileChosen,
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
  iconCheckSummary,
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
  applyGradientPreset,
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
  addShadowEffect,
  toggleShadowEffect,
  setShadowEffectProp,
  removeShadowEffect,
  toggleBlur,
  setBlurRadiusFromInput,
  flipObject,
  resetTransform,
  setSkewFromInput,
  copyStyle,
  pasteStyle,
  currentLockMode,
  setLockMode,
  createClippingMask,
  releaseClippingMask,
  canCreateClippingMask,
  hasClippingMask,
  isMultiSelection,
  selectionCount,
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
  layerUp,
  layerDown,
  layerTop,
  layerBottom,
  handleCanvasAreaPointerDown,
  handleCanvasAreaWheel,
  penToolActive,
  togglePenTool
} = useHomeEditorRuntime()

const canvasModeSwitcherCollapsed = ref(false)

// 切换底部画布模式切换器的收纳状态；收起时同步关闭受控预览浮层，避免隐藏控件后残留预览面板。
function toggleCanvasModeSwitcherCollapsed() {
  const nextCollapsed = !canvasModeSwitcherCollapsed.value
  canvasModeSwitcherCollapsed.value = nextCollapsed
  if (nextCollapsed) handlePreviewPopoverShowChange(false)
}
</script>

<style lang="scss" scoped>
/* ── 基础变量 ── */
$topbar-h: 44px;
$left-w: 270px;
$right-w: 240px;
$project-tab-h: 34px;
$border: 1px solid rgba(128, 128, 128, 0.18);
$bg: #f5f5f5;
$panel-bg: #fff;

/* ── 根布局 ── */
.editor-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
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
  min-height: 0;
  overflow: hidden;
}

/* ── 画布区 ── */
.canvas-frame {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}
.project-tab-bar {
  flex: 0 0 $project-tab-h;
  min-width: 0;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  padding: 4px 10px 0;
  border-bottom: $border;
  background: color-mix(in srgb, #f5f5f5, #ffffff 45%);
  overflow-x: auto;
  overflow-y: hidden;
}
.project-tab {
  height: 30px;
  max-width: 220px;
  min-width: 96px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 8px 0 12px;
  border: $border;
  border-bottom-color: transparent;
  border-radius: 8px 8px 0 0;
  background: rgba(255, 255, 255, 0.58);
  color: #4b5563;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.82);
    color: #1f2937;
  }

  &.active {
    background: #fff;
    color: #111827;
    box-shadow: 0 -1px 8px rgba(15, 23, 42, 0.08);
  }
}
.project-tab-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-weight: 600;
}
.project-tab-dirty {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #f97316;
  box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.14);
}
.project-tab-close,
.project-tab-add {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;

  :deep(svg) {
    width: 16px;
    height: 16px;
  }

  &:hover {
    background: rgba(30, 111, 255, 0.10);
    color: #1e40af;
  }
}
.project-tab-close {
  width: 20px;
  height: 20px;
}
.project-tab-add {
  width: 28px;
  height: 28px;
  margin-bottom: 1px;
  border: $border;
  background: rgba(255, 255, 255, 0.62);
}
.canvas-frame .canvas-area {
  flex: 1;
}
.canvas-frame.with-ruler :deep(.ruler-overlay) {
  top: $project-tab-h;
  bottom: 0;
  height: auto;
}
.canvas-frame.with-ruler .canvas-area {
  padding-top: 24px;
  padding-left: 24px;
}
.canvas-area {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  overflow: hidden;
  background: #e0e0e0;
}
.canvas-wrapper {
  position: relative;
  flex: 0 0 auto;
  transform-origin: top left;
  box-shadow: 0 2px 12px rgba(0,0,0,0.15);
  background: #fff;
  &.is-hidden {
    display: none;
  }
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
.canvas-frame.mode-svg .canvas-area {
  align-items: stretch;
  justify-content: stretch;
}
.svg-preview-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin: 24px;
  border: $border;
  border-radius: 10px;
  background: #ffffff;
  overflow: hidden;
}
.svg-preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  border-bottom: $border;
  background: color-mix(in srgb, #ffffff, #f3f4f6 70%);
}
.svg-preview-title {
  font-size: 13px;
  font-weight: 700;
  color: #374151;
}
.svg-preview-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}
.svg-preview-tabs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #f9fafb;
}
.svg-preview-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: none;
  border-radius: 999px;
  padding: 5px 9px;
  background: transparent;
  color: #4b5563;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;

  :deep(svg) {
    width: 15px;
    height: 15px;
  }

  &:hover {
    color: #1e40af;
    background: rgba(30, 111, 255, 0.08);
  }

  &.active {
    color: #fff;
    background: var(--primary-color);
    box-shadow: 0 2px 8px rgba(30, 111, 255, 0.22);
  }
}
.svg-preview-graphic {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: #fff;
  background-image:
    linear-gradient(45deg, rgba(0, 0, 0, 0.055) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.055) 75%, rgba(0, 0, 0, 0.055)),
    linear-gradient(45deg, rgba(0, 0, 0, 0.055) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.055) 75%, rgba(0, 0, 0, 0.055));
  background-position: 0 0, 10px 10px;
  background-size: 20px 20px;
}
.svg-preview-image {
  display: block;
  max-width: min(100%, 560px);
  max-height: min(100%, 560px);
  width: auto;
  height: auto;
  padding: 24px;
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.14);
}
.svg-preview-empty {
  padding: 12px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  color: #6b7280;
  font-size: 13px;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.10);
}
.svg-preview-code {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 14px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.6;
  color: #1f2937;
  background: #fbfbfc;

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }

  :deep(.svg-code-bracket) {
    color: #64748b;
  }

  :deep(.svg-code-tag) {
    color: #2563eb;
    font-weight: 700;
  }

  :deep(.svg-code-attr) {
    color: #9333ea;
  }

  :deep(.svg-code-string) {
    color: #c2410c;
  }
}
.canvas-mode-switcher {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 20;
  transition: transform 0.18s ease;

  &.is-collapsed {
    transform: translateY(calc(100% + 12px));
  }

  &.is-collapsed .canvas-mode-switcher__body {
    opacity: 0;
    pointer-events: none;
  }

  &.is-collapsed .canvas-mode-switcher__handle {
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
  }
}
.canvas-mode-switcher__body {
  display: inline-flex;
  align-items: center;
  padding: 4px;
  gap: 4px;
  border: $border;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(8px);
  transition: opacity 0.15s ease;

  :deep(.zt-popover__content) {
    max-width: min(420px, calc(100vw - 32px));
  }

  :deep(.zt-popover__body--card) {
    padding: 0;
    border-radius: 12px;
    overflow: hidden;
  }
}
.canvas-mode-switcher__handle {
  position: absolute;
  top: -12px;
  left: 50%;
  width: 34px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: $border;
  border-radius: 999px 999px 0 0;
  background: rgba(255, 255, 255, 0.94);
  color: #4b5563;
  cursor: pointer;
  transform: translateX(-50%);
  transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;

  :deep(svg) {
    width: 16px;
    height: 16px;
  }

  &:hover {
    background: rgba(30, 111, 255, 0.10);
    color: #1e40af;
  }
}
.canvas-mode-icon-btn {
  width: 32px;
  min-width: 32px;
  height: 32px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #4b5563;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;

  :deep(svg) {
    width: 18px;
    height: 18px;
  }

  &:hover {
    background: rgba(30, 111, 255, 0.08);
    color: #1e40af;
  }

  &.has-issues {
    color: #c2410c;
  }
}
.svg-mode-tooltip {
  width: 280px;
  padding: 10px;
}
.svg-mode-tooltip-head {
  padding: 2px 2px 10px;
}
.svg-mode-tooltip-title {
  font-size: 13px;
  font-weight: 700;
  color: #374151;
}
.svg-mode-tooltip-detail {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: #6b7280;
}
.svg-mode-option {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 9px;
  border: none;
  border-radius: 10px;
  padding: 9px;
  background: transparent;
  color: #4b5563;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;

  :deep(svg) {
    flex: 0 0 auto;
    width: 18px;
    height: 18px;
    margin-top: 1px;
  }

  strong,
  small {
    display: block;
  }

  strong {
    font-size: 12px;
    color: #374151;
  }

  small {
    margin-top: 3px;
    font-size: 11px;
    line-height: 1.4;
    color: #6b7280;
  }

  &:hover,
  &.active {
    background: rgba(30, 111, 255, 0.08);
    color: #1e40af;
  }

  &.active strong {
    color: #1e40af;
  }
}
:global(.zt-popover__panel:has(.right-panel-scroll) .zt-popover__content) {
  max-width: min(420px, calc(100vw - 32px));
}
:global(.zt-popover__panel:has(.right-panel-scroll) .zt-popover__body--card) {
  padding: 0;
  border-radius: 12px;
  overflow: hidden;
}

.canvas-mode-btn {
  border: none;
  border-radius: 999px;
  padding: 6px 12px;
  background: transparent;
  color: #4b5563;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    background: rgba(30, 111, 255, 0.08);
    color: #1e40af;
  }

  &.active {
    background: var(--primary-color);
    color: #fff;
    box-shadow: 0 2px 8px rgba(30, 111, 255, 0.28);
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