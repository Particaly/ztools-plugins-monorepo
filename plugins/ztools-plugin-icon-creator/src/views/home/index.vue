<template>
  <div
    class="editor-root"
    :class="{
      'space-pan-ready': spacePanReady,
      'space-panning': isSpacePanning
    }"
  >
    <!-- 顶栏 -->
    <header class="top-bar">
      <div class="top-bar-left">
        <span class="app-title">图标编辑器</span>
      </div>
      <div class="top-bar-center">
        <ZButton size="small" class="top-bar-btn" @click="newDoc" title="新建">新建</ZButton>
        <ZButton size="small" class="top-bar-btn" @click="importImage" title="导入图片">导入图片</ZButton>
        <ZButton size="small" class="top-bar-btn" @click="exportSVG" title="导出 SVG">导出 SVG</ZButton>
        <ZButton size="small" class="top-bar-btn" @click="exportPNG" title="导出 PNG">导出 PNG</ZButton>
        <span class="tb-sep"></span>
        <ZButton size="small" class="top-bar-btn" :disabled="!canUndo" @click="undo" title="撤销">撤销</ZButton>
        <ZButton size="small" class="top-bar-btn" :disabled="!canRedo" @click="redo" title="重做">重做</ZButton>
        <span class="tb-sep"></span>
        <ZButton size="small" class="top-bar-btn" :class="{ 'is-active': showRuler }" @click="toggleRuler" title="标尺">标尺</ZButton>
        <ZButton size="small" class="top-bar-btn shortcut-topbar-btn" :class="{ 'is-active': shortcutDrawerOpen }" @click="openShortcutDrawer" title="快捷键设置">快捷键</ZButton>
        <span class="tb-sep"></span>
        <ZButton size="small" class="top-bar-icon-btn" :class="{ 'is-active': selectionMode === 'shape' }" title="选择图形" @click="setSelectionMode('shape')">
          <Icon icon="mdi:cursor-default-outline" />
        </ZButton>
        <ZButton size="small" class="top-bar-icon-btn" :class="{ 'is-active': selectionMode === 'point' }" :disabled="!hasEditablePoints" title="选择点位" @click="setSelectionMode('point')">
          <Icon icon="mdi:circle-outline" />
        </ZButton>
        <ZButton size="small" class="top-bar-icon-btn" :class="{ 'is-active': selectionMode === 'segment' }" :disabled="!hasEditablePoints" title="选择线段" @click="setSelectionMode('segment')">
          <Icon icon="mdi:minus" />
        </ZButton>
      </div>
      <div class="top-bar-right">
        <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
        <ZButton size="small" class="top-bar-icon-btn" @click="setZoom(zoom - 0.1)">−</ZButton>
        <ZButton size="small" class="top-bar-icon-btn" @click="setZoom(zoom + 0.1)">+</ZButton>
        <ZButton size="small" class="top-bar-btn top-bar-reset-btn" @click="setZoom(1)">1:1</ZButton>
      </div>
    </header>

    <div class="editor-body">
      <!-- 左栏 -->
      <aside class="left-panel">
        <ZTabs
          v-model:value="leftTab"
          class="side-tabs left-tabs"
          type="line"
          size="small"
          placement="top"
          :animated="false"
          justify-content="space-between"
          :tabs-padding="0"
          tab-class="side-tabs-tab"
          pane-wrapper-class="left-tabs-pane-wrapper"
          pane-class="left-tabs-pane"
        >
          <ZTabPane name="shape" tab="形状" display-directive="show">
            <div class="left-content">
              <div class="section-title">基础形状</div>
              <div class="asset-grid">
                <div
                  v-for="s in basicShapes"
                  :key="s.id"
                  class="asset-item"
                  :title="s.label"
                  @click="addShape(s)"
                >
                  <svg class="shape-preview-svg" viewBox="0 0 64 64" aria-hidden="true">
                    <path :d="shapePreviewPaths[s.id]" fill="#fff" stroke="#333" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
          </ZTabPane>
          <ZTabPane name="text" tab="文字" display-directive="show">
            <div class="left-content">
              <div class="section-title">文字预设</div>
              <div class="text-list">
                <button
                  v-for="t in textPresets" :key="t.id" class="text-preset-btn"
                  @click="addText(t)"
                >
                  <span :style="{ fontSize: t.fontSize > 30 ? 20 : t.fontSize + 'px', fontWeight: t.fontWeight }">{{ t.label }}</span>
                </button>
              </div>
            </div>
          </ZTabPane>
        </ZTabs>
      </aside>

      <!-- 中间画布区 -->
      <div class="canvas-frame" :class="{ 'with-ruler': showRuler }">
        <main
          class="canvas-area"
          ref="canvasAreaRef"
          @pointerdown.capture="handleCanvasAreaPointerDown"
        >
          <div class="canvas-wrapper" ref="canvasWrapperRef" :class="{ 'transparent-bg': isCanvasBgTransparent }">
            <canvas ref="canvasElRef"></canvas>
          </div>
        </main>
        <Ruler
          v-if="showRuler"
          :scroll-el="canvasAreaRef"
          :wrapper-el="canvasWrapperRef"
          :zoom="zoom"
        />
      </div>

      <!-- 右栏 -->
      <aside class="right-panel">
        <ZTabs
          v-model:value="activeRightTab"
          class="side-tabs right-tabs"
          type="line"
          size="small"
          placement="top"
          :animated="false"
          justify-content="space-between"
          :tabs-padding="0"
          tab-class="side-tabs-tab"
          pane-wrapper-class="right-tabs-pane-wrapper"
          pane-class="right-tabs-pane"
        >
          <ZTabPane name="properties" tab="属性" display-directive="show">
            <div class="right-panel-scroll">
              <!-- 对象属性 -->
              <template v-if="activeObject">
                <template v-if="activeKaleidoscopeInstance">
                  <div class="prop-section">
                    <div class="prop-actions instance-actions">
                      <button class="tb-btn" @click="selectKaleidoscopeSourceFromInstance">选中源对象</button>
                      <button class="tb-btn" @click="detachKaleidoscopeInstance">脱离万花筒</button>
                    </div>
                  </div>
                </template>
                <template v-else>
                <div class="prop-section">
                  <div class="prop-group transform-row">
                    <label>位置</label>
                    <span class="size-lock-spacer"></span>
                    <ZInput size="small" type="text" :model-value="Math.round(objProps.left)" @change="setObjProp('left', uiNum($event))" />
                    <ZInput size="small" type="text" :model-value="Math.round(objProps.top)" @change="setObjProp('top', uiNum($event))" />
                  </div>
                  <div class="prop-group transform-row">
                    <label>尺寸</label>
                    <Icon
                      class="size-lock-icon"
                      :class="{ active: sizeRatioLocked }"
                      :icon="sizeRatioLocked ? 'mdi:lock' : 'mdi:lock-open-variant'"
                      :title="sizeRatioLocked ? '解锁宽高比例' : '锁定宽高比例'"
                      @click="toggleSizeRatioLock"
                    />
                    <ZInput size="small" type="text" :model-value="Math.round(objProps.width)" @change="setObjSize('width', uiNum($event))" />
                    <ZInput size="small" type="text" :model-value="Math.round(objProps.height)" @change="setObjSize('height', uiNum($event))" />
                  </div>
                  <div class="prop-group rotation-row">
                    <label>旋转</label>
                    <ZSlider
                      :model-value="objProps.angle"
                      :min="0"
                      :max="360"
                      :step="1"
                      :formatter="(value) => `${Math.round(value)}°`"
                      @change="setObjProp('angle', $event)"
                    />
                    <span class="val-label">{{ Math.round(objProps.angle) }}°</span>
                  </div>
                  <div class="prop-group align-row">
                    <label>对齐</label>
                    <ZPopover
                      :show="alignPopoverVisible"
                      trigger="hover"
                      placement="bottom"
                      :to="false"
                      show-arrow
                      keep-alive-on-hover
                      @update:show="alignPopoverVisible = $event"
                    >
                      <template #trigger>
                        <button
                          class="align-btn align-trigger"
                          :title="currentAlignPosition.label"
                          @click="alignToCanvas(currentAlignPosition.id)"
                        >
                          <svg viewBox="0 0 18 18" aria-hidden="true">
                            <rect x="1" y="1" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.2" />
                            <rect :x="currentAlignPosition.svgX" :y="currentAlignPosition.svgY" width="6" height="4" rx="0.5" fill="currentColor" />
                          </svg>
                        </button>
                      </template>
                      <div class="align-grid align-popover-grid">
                        <button
                          v-for="pos in alignPositions"
                          :key="pos.id"
                          class="align-btn"
                          :class="{ active: pos.id === currentAlignId }"
                          :title="pos.label"
                          @click="selectAlign(pos.id)"
                        >
                          <svg viewBox="0 0 18 18" aria-hidden="true">
                            <rect x="1" y="1" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.2" />
                            <rect :x="pos.svgX" :y="pos.svgY" width="6" height="4" rx="0.5" fill="currentColor" />
                          </svg>
                        </button>
                      </div>
                    </ZPopover>
                  </div>
                </div>
                <div class="prop-section">
                  <div class="prop-group style-toggle-row">
                    <label>填充</label>
                    <ZSwitch size="small" :model-value="objProps.fillEnabled" @change="toggleFill" />
                  </div>
                  <div v-if="objProps.fillEnabled" class="prop-group style-color-row">
                    <label>填充色</label>
                    <ZColorPicker
                      size="small"
                      show-alpha
                      :model-value="objProps.fill || '#000000'"
                      @change="setObjProp('fill', String($event))"
                    />
                  </div>
                </div>
                <div class="prop-section">
                  <div class="prop-group style-toggle-row">
                    <label>描边</label>
                    <ZSwitch size="small" :model-value="objProps.strokeEnabled" @change="toggleStroke" />
                  </div>
                  <div v-if="objProps.strokeEnabled" class="prop-group style-color-row">
                    <label>描边色</label>
                    <ZColorPicker
                      size="small"
                      show-alpha
                      :model-value="objProps.stroke || '#000000'"
                      @change="setObjProp('stroke', String($event))"
                    />
                  </div>
                  <div v-if="objProps.strokeEnabled" class="prop-group style-color-row">
                    <label>描边宽</label>
                    <ZInput
                      size="small"
                      type="text"
                      :model-value="objProps.strokeWidthInput"
                      @update:model-value="objProps.strokeWidthInput = String($event)"
                      @change="setStrokeWidthFromInput"
                    />
                  </div>
                  <div v-if="objProps.strokeEnabled" class="prop-group">
                    <label>线型</label>
                    <div class="stroke-line-type-picker">
                      <button
                        class="stroke-line-swatch solid"
                        :class="{ active: objProps.strokeLineType === 'solid' }"
                        title="实线"
                        @click="setStrokeLineType('solid')"
                      />
                      <button
                        class="stroke-line-swatch dashed"
                        :class="{ active: objProps.strokeLineType === 'dashed' }"
                        title="虚线"
                        @click="setStrokeLineType('dashed')"
                      />
                    </div>
                  </div>
                  <div v-if="objProps.strokeEnabled && objProps.strokeLineType === 'dashed'" class="prop-group style-color-row">
                    <label>虚线线长</label>
                    <ZInput
                      size="small"
                      type="text"
                      :model-value="objProps.strokeDashLengthInput"
                      @update:model-value="objProps.strokeDashLengthInput = String($event)"
                      @change="setStrokeDashLengthFromInput"
                    />
                  </div>
                  <div v-if="objProps.strokeEnabled && objProps.strokeLineType === 'dashed'" class="prop-group style-color-row">
                    <label>虚线间隔</label>
                    <ZInput
                      size="small"
                      type="text"
                      :model-value="objProps.strokeDashGapInput"
                      @update:model-value="objProps.strokeDashGapInput = String($event)"
                      @change="setStrokeDashGapFromInput"
                    />
                  </div>
                </div>
                <div class="prop-section">
                  <div class="prop-group opacity-row">
                    <label>透明度</label>
                    <ZSlider
                      :model-value="objProps.opacity"
                      :min="0"
                      :max="1"
                      :step="0.01"
                      :formatter="(value) => `${Math.round(value * 100)}%`"
                      @change="setObjProp('opacity', $event)"
                    />
                    <span class="val-label">{{ Math.round(objProps.opacity * 100) }}%</span>
                  </div>
                </div>
                <div v-if="hasEditablePoints" class="prop-section">
                  <div v-if="!hasSelectedPoint" class="prop-group style-color-row">
                    <label>圆角</label>
                    <ZInput
                      size="small"
                      type="text"
                      :model-value="objProps.cornerRadiusInput"
                      @update:model-value="objProps.cornerRadiusInput = String($event)"
                      @change="setCornerRadiusFromInput"
                    />
                  </div>
                  <div v-else class="prop-group style-color-row">
                    <label>点圆角</label>
                    <ZInput
                      size="small"
                      type="text"
                      :model-value="objProps.pointCornerRadiusInput"
                      @update:model-value="objProps.pointCornerRadiusInput = String($event)"
                      @change="setSelectedPointCornerRadiusFromInput"
                    />
                  </div>
                </div>
                <div v-if="hasSelectedCurveSegment" class="prop-section">
                  <div class="prop-group style-toggle-row">
                    <label>曲线</label>
                    <ZSwitch size="small" :model-value="objProps.curveEnabled" @change="setSelectedSegmentCurveEnabled" />
                  </div>
                  <div v-if="objProps.curveEnabled" class="prop-group bezier-group-row">
                    <label>CP1</label>
                    <ZInput
                      size="small"
                      type="text"
                      :model-value="objProps.curveCp1XInput"
                      @update:model-value="objProps.curveCp1XInput = String($event)"
                      @change="setSelectedSegmentControlPointCoordFromInput('cp1', 'x', $event)"
                    />
                    <ZInput
                      size="small"
                      type="text"
                      :model-value="objProps.curveCp1YInput"
                      @update:model-value="objProps.curveCp1YInput = String($event)"
                      @change="setSelectedSegmentControlPointCoordFromInput('cp1', 'y', $event)"
                    />
                  </div>
                  <div v-if="objProps.curveEnabled" class="prop-group bezier-group-row">
                    <label>CP2</label>
                    <ZInput
                      size="small"
                      type="text"
                      :model-value="objProps.curveCp2XInput"
                      @update:model-value="objProps.curveCp2XInput = String($event)"
                      @change="setSelectedSegmentControlPointCoordFromInput('cp2', 'x', $event)"
                    />
                    <ZInput
                      size="small"
                      type="text"
                      :model-value="objProps.curveCp2YInput"
                      @update:model-value="objProps.curveCp2YInput = String($event)"
                      @change="setSelectedSegmentControlPointCoordFromInput('cp2', 'y', $event)"
                    />
                  </div>
                </div>
                <div class="prop-section">
                  <div class="prop-group style-toggle-row">
                    <label>万花筒</label>
                    <ZSwitch
                      size="small"
                      :model-value="objProps.kaleidoscopeEnabled"
                      :disabled="!activeKaleidoscopeEditableSource"
                      @change="setKaleidoscopeEnabled"
                    />
                  </div>
                  <template v-if="activeKaleidoscopeEditableSource && objProps.kaleidoscopeEnabled">
                    <div class="prop-group bezier-group-row">
                      <label>中心点</label>
                      <ZInput
                        size="small"
                        type="text"
                        :model-value="objProps.kaleidoscopeCenterXInput"
                        @update:model-value="objProps.kaleidoscopeCenterXInput = String($event)"
                        @change="setKaleidoscopeCenterFromInput('x', $event)"
                      />
                      <ZInput
                        size="small"
                        type="text"
                        :model-value="objProps.kaleidoscopeCenterYInput"
                        @update:model-value="objProps.kaleidoscopeCenterYInput = String($event)"
                        @change="setKaleidoscopeCenterFromInput('y', $event)"
                      />
                    </div>
                    <div class="prop-group style-toggle-row">
                      <label>跟随旋转</label>
                      <ZSwitch size="small" :model-value="objProps.kaleidoscopeFollowRotation" @change="setKaleidoscopeFollowRotation" />
                    </div>
                    <div class="prop-group style-color-row">
                      <label>份数</label>
                      <ZInput
                        size="small"
                        type="text"
                        :model-value="objProps.kaleidoscopeCountInput"
                        @update:model-value="objProps.kaleidoscopeCountInput = String($event)"
                        @change="setKaleidoscopeCountFromInput"
                      />
                    </div>
                  </template>
                </div>
                <div class="prop-actions boolean-actions">
                  <button class="tb-btn" @mouseenter="showBooleanPreview('union')" @mouseleave="clearBooleanPreview" @click="runBooleanOperation('union')" :disabled="!canBoolean">并集</button>
                  <button class="tb-btn" @mouseenter="showBooleanPreview('intersect')" @mouseleave="clearBooleanPreview" @click="runBooleanOperation('intersect')" :disabled="!canBoolean">交集</button>
                  <ZPopover
                    v-if="canBoolean"
                    :show="subtractPopoverVisible"
                    trigger="hover"
                    placement="top"
                    :to="false"
                    show-arrow
                    keep-alive-on-hover
                    @update:show="handleSubtractPopoverShowChange"
                  >
                    <template #trigger>
                      <button class="tb-btn" @mouseenter="showBooleanPreview('subtract')" @click="runBooleanOperation('subtract')">差集</button>
                    </template>
                    <div class="boolean-preview-menu">
                      <template v-if="canDirectionalSubtract">
                        <button class="tb-btn sm boolean-preview-option" @mouseenter="showBooleanPreview('subtract', 'forward')" @click="runBooleanOperation('subtract', 'forward')">A - B</button>
                        <button class="tb-btn sm boolean-preview-option" @mouseenter="showBooleanPreview('subtract', 'reverse')" @click="runBooleanOperation('subtract', 'reverse')">B - A</button>
                      </template>
                      <div v-else class="boolean-preview-note">多对象差集预览当前默认结果</div>
                    </div>
                  </ZPopover>
                  <button v-else class="tb-btn" disabled>差集</button>
                  <button class="tb-btn" @mouseenter="showBooleanPreview('xor')" @mouseleave="clearBooleanPreview" @click="runBooleanOperation('xor')" :disabled="!canBoolean">异或</button>
                  <span v-if="booleanBusy" class="boolean-status">处理中...</span>
                  <span v-if="booleanError" class="boolean-error">{{ booleanError }}</span>
                </div>
                <div class="prop-actions">
                  <button class="tb-btn" @click="groupObjects" :disabled="!canGroup">成组</button>
                  <button class="tb-btn" @click="ungroupObject" :disabled="!canUngroup">解组</button>
                  <button class="tb-btn" @click="lockObject">{{ activeObject.lockMovementX ? '解锁' : '锁定' }}</button>
                  <button class="tb-btn danger" @click="deleteObject">删除</button>
                </div>
                </template>
              </template>
              <template v-else>
                <div class="section-title">画布设置</div>
                <div class="prop-group">
                  <label>预设</label>
                  <ZSelect
                    size="small"
                    class="w-100%"
                    :model-value="canvasPresetValue"
                    :options="canvasPresetOptions"
                    placeholder="请选择预设"
                    @change="applyCanvasPreset(String($event))"
                  />
                </div>
                <div class="prop-group">
                  <label>宽高</label>
                  <ZInput
                    size="small"
                    type="text"
                    :model-value="canvasWidthInput"
                    @update:model-value="canvasWidthInput = String($event)"
                    @change="setCanvasSizeFromInput('width', $event)"
                  />
                  <ZInput
                    size="small"
                    type="text"
                    :model-value="canvasHeightInput"
                    @update:model-value="canvasHeightInput = String($event)"
                    @change="setCanvasSizeFromInput('height', $event)"
                  />
                </div>
                <div class="prop-group">
                  <label>背景</label>
                  <div class="canvas-bg-picker">
                    <ZButton
                      class="transparent-swatch"
                      :class="{ active: isCanvasBgTransparent }"
                      title="透明"
                      @click="setCanvasBg('transparent')"
                    />
                    <ZColorPicker
                      size="small"
                      :show-input="false"
                      :model-value="canvasBgPickerValue"
                      @change="setCanvasBg(String($event))"
                    />
                  </div>
                </div>
              </template>
            </div>
          </ZTabPane>
          <ZTabPane name="layers" tab="图层" display-directive="show">
            <div class="right-panel-scroll">
        <!-- 图层区 -->
        <div class="section-title">
          <span>图层</span>
        </div>
        <div class="layer-toolbar">
          <ZButton class="layer-toolbar-btn" size="small" @click="layerUp" title="上移"><Icon icon="mdi:arrow-up" /></ZButton>
          <ZButton class="layer-toolbar-btn" size="small" @click="layerDown" title="下移"><Icon icon="mdi:arrow-down" /></ZButton>
          <ZButton class="layer-toolbar-btn" size="small" @click="layerTop" title="置顶"><Icon icon="mdi:arrow-collapse-up" /></ZButton>
          <ZButton class="layer-toolbar-btn" size="small" @click="layerBottom" title="置底"><Icon icon="mdi:arrow-collapse-down" /></ZButton>
          <ZInput class="layer-search" size="small" type="text" placeholder="搜索" v-model="layerSearch" />
        </div>
        <div v-if="filteredLayers.length" class="layer-list">
          <div
            v-for="item in filteredLayers" :key="item.id"
            class="layer-item"
            :class="{ active: isLayerActive(item.obj) }"
            @click="selectLayer(item.obj, $event)"
          >
            <span class="layer-name">{{ item.name }}</span>
            <button class="layer-icon-btn" @click.stop="toggleVisible(item.obj)">
              <Icon :icon="item.obj.visible !== false ? 'mdi:eye-outline' : 'mdi:eye-off-outline'" />
            </button>
            <button class="layer-icon-btn" @click.stop="toggleLock(item.obj)">
              <Icon :icon="item.obj.lockMovementX ? 'mdi:lock' : 'mdi:lock-open-variant'" />
            </button>
            <button class="layer-icon-btn danger" @click.stop="removeObject(item.obj)"><Icon icon="mdi:close" /></button>
          </div>
        </div>
        <div v-else class="layer-empty">
          {{ layerSearch.trim() ? '未找到匹配的图层' : '当前没有图层' }}
        </div>
      </div>
    </ZTabPane>
  </ZTabs>
</aside>
    </div>

    <ZDrawer
      v-model:show="shortcutDrawerOpen"
      placement="right"
      width="min(520px, 92vw)"
      :z-index="40"
      :block-scroll="false"
      content-class="shortcut-drawer"
    >
      <header class="shortcut-drawer-header">
        <div>
          <h2>快捷键</h2>
          <p>查看、搜索、录制并管理编辑器快捷键</p>
        </div>
        <button class="shortcut-close-btn" title="关闭" @click="closeShortcutDrawer">×</button>
      </header>
      <div class="shortcut-drawer-tools">
        <ZInput v-model="shortcutSearch" size="small" type="text" placeholder="搜索动作、说明或快捷键" />
        <button class="tb-btn" @click="resetShortcutBindingsToDefault">恢复默认</button>
      </div>
      <div class="shortcut-group-list">
        <section v-for="group in filteredShortcutGroups" :key="group.id" class="shortcut-group">
          <div class="shortcut-group-title">{{ group.label }}</div>
          <div v-for="action in group.actions" :key="action.id" class="shortcut-action-row">
            <div class="shortcut-action-info">
              <div class="shortcut-action-name">{{ action.name }}</div>
              <div class="shortcut-action-desc">{{ action.description }}</div>
            </div>
            <div class="shortcut-binding-list">
              <div
                v-for="(binding, bindingIndex) in shortcutBindings[action.id]"
                :key="getShortcutBindingKey(action.id, binding, bindingIndex)"
                class="shortcut-binding-row"
              >
                <ZHotkeyInput
                  class="shortcut-hotkey-input"
                  :model-value="binding"
                  :platform="shortcutPlatform"
                  placeholder="录制快捷键"
                  @change="applyShortcutBinding(action.id, binding, $event)"
                />
                <button class="shortcut-binding-delete" title="删除" @click="removeShortcutBinding(action.id, binding)">×</button>
                <button
                  v-if="bindingIndex === shortcutBindings[action.id].length - 1"
                  class="shortcut-binding-add"
                  title="添加快捷键"
                  @click="addShortcutBinding(action.id)"
                >＋</button>
              </div>
              <button
                v-if="!shortcutBindings[action.id].length"
                class="shortcut-binding-add shortcut-binding-add--empty"
                title="添加快捷键"
                @click="addShortcutBinding(action.id)"
              >＋</button>
            </div>
          </div>
        </section>
        <div v-if="!filteredShortcutGroups.length" class="shortcut-empty">未找到匹配的快捷键</div>
      </div>
    </ZDrawer>

    <!-- 隐藏的文件输入 -->
    <input ref="imgInputRef" type="file" accept="image/*" style="display:none" @change="onImageFileChosen" />
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, triggerRef, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { ZInput, ZSelect, ZColorPicker, ZSwitch, ZSlider, ZPopover, ZButton, ZTabs, ZTabPane, ZHotkeyInput, ZDrawer, useZtoolsTheme } from 'ztools-ui'
import { Icon } from '@iconify/vue'
import { Canvas, Control, FabricObject, Textbox, Group, ActiveSelection, FabricImage, Point, util } from 'fabric'
import { AligningGuidelines } from '../../fabric-aligning-guidelines'
import { basicShapes, textPresets, canvasPresets } from './editorCatalog'
import type { ShapeLibraryItem, TextLibraryItem } from './editorCatalog'
import { createShape } from './fabric/shapeFactories'
import Ruler from './components/Ruler.vue'
import { isBooleanCandidate, type FabricBooleanStyleSnapshot } from './geometry/fabricToPathKit'
import { applyBooleanOperation, computeBooleanResult } from './geometry/booleanOps'
import type { BooleanOperation, SubtractDirection } from './geometry/booleanOps'
import { pathKitToFabricPath } from './geometry/pathKitToFabric'
import {
  editablePointToLocalObjectPoint,
  getEditableSegmentByLocalPoint,
  getEditableSegmentMidpoint,
  getEditableSegments,
  getPointRadius,
  getSelectableEditablePoints,
  isEditablePathObject,
  isSameEditableSegmentRef,
  moveEditablePoint,
  moveEditablePoints,
  resolveEditableSegmentRef,
  setEditableSegmentControlPoint,
  setEditableSegmentType,
  setObjectCornerRadius,
  setPointCornerRadius,
  setPointsCornerRadius,
  type EditablePathObject,
  type EditablePoint,
  type EditableSegmentRef
} from './geometry/editablePath'

// ── 类型工具 ──
type AnyFabricObject = FabricObject & Record<string, any>
type FabricControls = Record<string, Control>
type BooleanPreviewHiddenObject = {
  object: FabricObject
  visible: boolean
}
type StrokeLineType = 'solid' | 'dashed'
type CurveControlPointKey = 'cp1' | 'cp2'
type EditorPlatform = 'darwin' | 'win32' | 'linux'
type ShortcutGroupId = 'edit' | 'mode' | 'select' | 'organize' | 'layer' | 'view'
type ShortcutActionId =
  | 'edit.copy'
  | 'edit.paste'
  | 'edit.duplicate'
  | 'edit.delete'
  | 'edit.undo'
  | 'edit.redo'
  | 'mode.shape'
  | 'mode.point'
  | 'mode.segment'
  | 'select.all'
  | 'organize.group'
  | 'organize.ungroup'
  | 'layer.up'
  | 'layer.down'
  | 'layer.top'
  | 'layer.bottom'
  | 'view.zoomIn'
  | 'view.zoomOut'
  | 'view.fit'
  | 'view.actualSize'
  | 'view.toggleRuler'

type ShortcutActionDefinition = {
  id: ShortcutActionId
  group: ShortcutGroupId
  name: string
  description: string
  defaultBindings: (platform: EditorPlatform) => string[]
  requiresSelection?: boolean
  shapeOnly?: boolean
}

type ShortcutGroupDefinition = {
  id: ShortcutGroupId
  label: string
}

type ClipboardEntry = {
  object: Record<string, unknown>
  sourceName: string
  kaleidoscopeEnabled: boolean
  sourceMissing: boolean
}

type InternalClipboard = {
  entries: ClipboardEntry[]
  pasteCount: number
}

type SpacePanStart = {
  pointerId: number
  x: number
  y: number
  scrollLeft: number
  scrollTop: number
}

type KaleidoscopeMetadata = {
  kaleidoscopeEnabled?: boolean
  kaleidoscopeCenterX?: number
  kaleidoscopeCenterY?: number
  kaleidoscopeFollowRotation?: boolean
  kaleidoscopeCount?: number
  kaleidoscopeSourceId?: string
  kaleidoscopeManaged?: boolean
  kaleidoscopeInstanceOf?: string
  kaleidoscopeInstanceIndex?: number
}

const DEFAULT_KALEIDOSCOPE_COUNT = 6
const MIN_KALEIDOSCOPE_COUNT = 1
const MAX_KALEIDOSCOPE_COUNT = 36
const KALEIDOSCOPE_CENTER_CONTROL_KEY = 'kaleidoscopeCenter'
const SHORTCUT_STORAGE_KEY = 'icon-creator:editor-shortcuts:v1'
const SHORTCUT_DISPLAY_GROUPS: ShortcutGroupDefinition[] = [
  { id: 'edit', label: '编辑' },
  { id: 'mode', label: '模式' },
  { id: 'select', label: '选择' },
  { id: 'organize', label: '组织' },
  { id: 'layer', label: '图层' },
  { id: 'view', label: '视图' }
]
const SHORTCUT_ACTIONS: ShortcutActionDefinition[] = [
  { id: 'edit.copy', group: 'edit', name: '复制', description: '复制当前选择的图形对象', defaultBindings: (platform) => [platform === 'darwin' ? 'Meta+C' : 'Ctrl+C'], requiresSelection: true },
  { id: 'edit.paste', group: 'edit', name: '粘贴', description: '粘贴内部剪贴板中的对象', defaultBindings: (platform) => [platform === 'darwin' ? 'Meta+V' : 'Ctrl+V'] },
  { id: 'edit.duplicate', group: 'edit', name: '复制副本', description: '复制当前选择并立即粘贴，不覆盖剪贴板', defaultBindings: (platform) => [platform === 'darwin' ? 'Meta+D' : 'Ctrl+D'], requiresSelection: true },
  { id: 'edit.delete', group: 'edit', name: '删除', description: '删除当前选中的图形对象', defaultBindings: () => ['Delete', 'Backspace'], requiresSelection: true },
  { id: 'edit.undo', group: 'edit', name: '撤销', description: '撤销上一步编辑操作', defaultBindings: (platform) => [platform === 'darwin' ? 'Meta+Z' : 'Ctrl+Z'] },
  { id: 'edit.redo', group: 'edit', name: '重做', description: '恢复刚撤销的编辑操作', defaultBindings: (platform) => (platform === 'darwin' ? ['Meta+Shift+Z'] : ['Ctrl+Y', 'Ctrl+Shift+Z']) },
  { id: 'mode.shape', group: 'mode', name: '图形模式', description: '切换到图形选择模式', defaultBindings: () => ['Alt+1'] },
  { id: 'mode.point', group: 'mode', name: '点位模式', description: '切换到点位编辑模式', defaultBindings: () => ['Alt+2'] },
  { id: 'mode.segment', group: 'mode', name: '线段模式', description: '切换到线段编辑模式', defaultBindings: () => ['Alt+3'] },
  { id: 'select.all', group: 'select', name: '全选', description: '按当前模式选择全部可编辑内容', defaultBindings: (platform) => [platform === 'darwin' ? 'Meta+A' : 'Ctrl+A'] },
  { id: 'organize.group', group: 'organize', name: '成组', description: '将多个已选对象组合成组', defaultBindings: (platform) => [platform === 'darwin' ? 'Meta+G' : 'Ctrl+G'], requiresSelection: true, shapeOnly: true },
  { id: 'organize.ungroup', group: 'organize', name: '解组', description: '拆分当前组对象', defaultBindings: (platform) => [platform === 'darwin' ? 'Meta+Shift+G' : 'Ctrl+Shift+G'], requiresSelection: true, shapeOnly: true },
  { id: 'layer.up', group: 'layer', name: '上移一层', description: '将当前对象上移一层', defaultBindings: () => ['Alt+ArrowUp'], requiresSelection: true, shapeOnly: true },
  { id: 'layer.down', group: 'layer', name: '下移一层', description: '将当前对象下移一层', defaultBindings: () => ['Alt+ArrowDown'], requiresSelection: true, shapeOnly: true },
  { id: 'layer.top', group: 'layer', name: '置顶', description: '将当前对象移动到最上层', defaultBindings: () => ['Alt+Shift+ArrowUp'], requiresSelection: true, shapeOnly: true },
  { id: 'layer.bottom', group: 'layer', name: '置底', description: '将当前对象移动到最下层', defaultBindings: () => ['Alt+Shift+ArrowDown'], requiresSelection: true, shapeOnly: true },
  { id: 'view.zoomIn', group: 'view', name: '放大', description: '放大画布视图', defaultBindings: (platform) => (platform === 'darwin' ? ['Meta+=', 'Meta+Shift+='] : ['Ctrl+=', 'Ctrl+Shift+=']) },
  { id: 'view.zoomOut', group: 'view', name: '缩小', description: '缩小画布视图', defaultBindings: (platform) => [platform === 'darwin' ? 'Meta+-' : 'Ctrl+-'] },
  { id: 'view.fit', group: 'view', name: '适应画布', description: '让画布完整适应当前视图', defaultBindings: (platform) => [platform === 'darwin' ? 'Meta+0' : 'Ctrl+0'] },
  { id: 'view.actualSize', group: 'view', name: '1:1', description: '将画布缩放恢复到 100%', defaultBindings: (platform) => [platform === 'darwin' ? 'Meta+1' : 'Ctrl+1'] },
  { id: 'view.toggleRuler', group: 'view', name: '切换标尺', description: '显示或隐藏画布标尺', defaultBindings: (platform) => [platform === 'darwin' ? 'Meta+R' : 'Ctrl+R'] }
]
const SERIALIZED_OBJECT_PROPS = [
  'name',
  'strokeUniform',
  'lastFill',
  'lastStroke',
  'lastStrokeWidth',
  'lastStrokeDashArray',
  'shapeId',
  'booleanEligible',
  'fillRule',
  'editablePath',
  'cornerRadius',
  'cornerRadiusOverrides',
  'editablePathVersion',
  'kaleidoscopeEnabled',
  'kaleidoscopeCenterX',
  'kaleidoscopeCenterY',
  'kaleidoscopeFollowRotation',
  'kaleidoscopeCount',
  'kaleidoscopeSourceId',
  'kaleidoscopeManaged',
  'kaleidoscopeInstanceOf',
  'kaleidoscopeInstanceIndex'
] as const

// ── refs ──
const canvasElRef = ref<HTMLCanvasElement | null>(null)
const canvasAreaRef = ref<HTMLElement | null>(null)
const canvasWrapperRef = ref<HTMLElement | null>(null)
const imgInputRef = ref<HTMLInputElement | null>(null)

// ── 状态 ──
let fabricCanvas: Canvas | null = null
let aligningGuidelines: AligningGuidelines | null = null
let restoreActiveObjectAfterSelectionClear = false
let pointModeSwitchPending = false
let internalClipboard: InternalClipboard | null = null
let spacePanStart: SpacePanStart | null = null

const leftTab = ref<'shape' | 'text'>('shape')
const activeRightTab = ref<'properties' | 'layers'>('properties')
const showRuler = ref(true)
const zoom = ref(1)
const shortcutDrawerOpen = ref(false)
const shortcutSearch = ref('')
const shortcutPlatform = getEditorPlatform()
const shortcutBindings = reactive<Record<ShortcutActionId, string[]>>(createDefaultShortcutBindings(shortcutPlatform))
const spacePanReady = ref(false)
const isSpacePanning = ref(false)
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
const canvasBgPickerValue = computed(() => (isCanvasBgTransparent.value ? lastOpaqueCanvasBg.value : canvasBg.value))
const shapePreviewPaths: Record<ShapeLibraryItem['id'], string> = {
  'base-rectangle': 'M 8 20 H 56 V 44 H 8 Z',
  'base-square': 'M 14 14 H 50 V 50 H 14 Z',
  'base-circle': 'M 32 14 A 18 18 0 1 1 31.9 14 Z',
  'base-line': 'M 10 32 H 54',
  'base-triangle': 'M 32 10 L 54 54 H 10 Z',
  'base-inverted-triangle': 'M 10 10 H 54 L 32 54 Z',
  'base-rhombus': 'M 32 8 L 56 32 L 32 56 L 8 32 Z',
  'base-wide-cross': 'M 25 8 H 39 V 25 H 56 V 39 H 39 V 56 H 25 V 39 H 8 V 25 H 25 Z',
  'base-parallelogram': 'M 18 20 H 56 L 46 44 H 8 Z',
  'base-inverted-parallelogram': 'M 8 20 H 46 L 56 44 H 18 Z',
  'base-trapezoid': 'M 20 20 H 44 L 56 44 H 8 Z',
  'base-inverted-trapezoid': 'M 8 20 H 56 L 44 44 H 20 Z',
  'base-doorway': 'M 14 56 V 32 A 18 18 0 0 1 50 32 V 56 Z',
  'base-inverted-arch': 'M 14 8 H 50 V 32 A 18 18 0 0 1 14 32 Z',
  'base-rotated-right-triangle': 'M 12 12 L 52 52 H 12 Z',
  'base-half-moon': 'M 32 14 C 46 14 54 30 54 50 H 10 C 10 30 18 14 32 14 Z',
  'base-pentagon': 'M 32 8 L 55 26 L 46 56 H 18 L 9 26 Z',
  'base-arrow-right': 'M 10 32 H 52 M 52 32 L 40 20 M 52 32 L 40 44',
  'base-solid-shaft-arrow': 'M 8 24 H 38 V 14 L 56 32 L 38 50 V 40 H 8 Z',
  'base-double-solid-shaft-arrow': 'M 8 32 L 24 14 V 24 H 40 V 14 L 56 32 L 40 50 V 40 H 24 V 50 Z',
  'base-star': 'M 32 8 L 38 25 H 56 L 42 36 L 48 54 L 32 43 L 16 54 L 22 36 L 8 25 H 26 Z',
  'base-heart': 'M 32 54 C 16 40 8 32 8 22 C 8 14 14 10 21 10 C 26 10 30 13 32 18 C 34 13 38 10 43 10 C 50 10 56 14 56 22 C 56 32 48 40 32 54 Z'
}
const booleanBusy = ref(false)
const booleanError = ref('')
const subtractPopoverVisible = ref(false)
const booleanPreviewObjects = shallowRef<FabricObject[]>([])
const booleanPreviewHiddenObjects = shallowRef<BooleanPreviewHiddenObject[]>([])
let booleanPreviewToken = 0

const objProps = reactive({
  left: 0, top: 0, width: 0, height: 0,
  scaleX: 1, scaleY: 1, angle: 0,
  fill: '#000000', fillEnabled: true,
  stroke: '#000000', strokeEnabled: true, strokeWidth: 0, strokeWidthInput: '0', strokeLineType: 'solid' as StrokeLineType, strokeDashLength: 6, strokeDashGap: 4, strokeDashLengthInput: '6', strokeDashGapInput: '4', opacity: 1,
  cornerRadius: 0,
  pointCornerRadius: 0,
  cornerRadiusInput: '0',
  pointCornerRadiusInput: '0',
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
const selectedSegmentRef = shallowRef<EditableSegmentRef | null>(null)
const selectionMode = ref<'shape' | 'point' | 'segment'>('shape')
const pointControlsOwner = shallowRef<FabricObject | null>(null)
const originalControlsMap = new WeakMap<FabricObject, FabricControls>()
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
function refreshLayers() {
  layerVersion.value += 1
}

// 对象命名计数
let objCounter = 0
function nextName(type: string) {
  return `${type} ${++objCounter}`
}

function createKaleidoscopeSourceId() {
  return `kaleidoscope-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function getKaleidoscopeMetadata(obj: FabricObject | null | undefined) {
  return obj ? (obj as AnyFabricObject & KaleidoscopeMetadata) : null
}

function normalizeFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeKaleidoscopeCount(value: unknown) {
  const parsed = Math.round(Number(value))
  if (!Number.isFinite(parsed)) return DEFAULT_KALEIDOSCOPE_COUNT
  return Math.min(MAX_KALEIDOSCOPE_COUNT, Math.max(MIN_KALEIDOSCOPE_COUNT, parsed))
}

function applyDefaultKaleidoscopeMetadata(obj: FabricObject) {
  const target = getKaleidoscopeMetadata(obj)
  if (!target) return
  target.kaleidoscopeEnabled = target.kaleidoscopeEnabled === true
  target.kaleidoscopeCenterX = normalizeFiniteNumber(target.kaleidoscopeCenterX)
  target.kaleidoscopeCenterY = normalizeFiniteNumber(target.kaleidoscopeCenterY)
  target.kaleidoscopeFollowRotation = target.kaleidoscopeFollowRotation === true
  target.kaleidoscopeCount = normalizeKaleidoscopeCount(target.kaleidoscopeCount)
  target.kaleidoscopeSourceId = typeof target.kaleidoscopeSourceId === 'string' ? target.kaleidoscopeSourceId : ''
  target.kaleidoscopeManaged = target.kaleidoscopeManaged === true
  target.kaleidoscopeInstanceOf = typeof target.kaleidoscopeInstanceOf === 'string' ? target.kaleidoscopeInstanceOf : ''
  target.kaleidoscopeInstanceIndex = Math.max(0, Math.round(normalizeFiniteNumber(target.kaleidoscopeInstanceIndex)))
}

function clearKaleidoscopeMetadata(obj: FabricObject) {
  const target = getKaleidoscopeMetadata(obj)
  if (!target) return
  target.kaleidoscopeEnabled = false
  target.kaleidoscopeCenterX = 0
  target.kaleidoscopeCenterY = 0
  target.kaleidoscopeFollowRotation = false
  target.kaleidoscopeCount = DEFAULT_KALEIDOSCOPE_COUNT
  target.kaleidoscopeSourceId = ''
  target.kaleidoscopeManaged = false
  target.kaleidoscopeInstanceOf = ''
  target.kaleidoscopeInstanceIndex = 0
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

function resolveKaleidoscopeSelectionTarget(obj: FabricObject | null) {
  if (!(obj instanceof ActiveSelection)) return obj
  const objects = obj.getObjects()
  return objects.find((item) => isKaleidoscopeInstance(item))
    ?? objects.find((item) => isKaleidoscopeSource(item))
    ?? obj
}

function applyKaleidoscopeSelectionConstraints(obj: FabricObject | null, event?: Event | MouseEvent) {
  if (!fabricCanvas || !obj) return obj
  const resolved = resolveKaleidoscopeSelectionTarget(obj)
  if (resolved !== obj) {
    fabricCanvas.setActiveObject(resolved, event as any)
    fabricCanvas.requestRenderAll()
  }
  return resolved
}

function getEditorPlatform(): EditorPlatform {
  if (typeof navigator === 'undefined') return 'win32'
  const platform = navigator.platform.toLowerCase()
  const userAgent = navigator.userAgent.toLowerCase()
  if (platform.includes('mac') || userAgent.includes('mac os')) return 'darwin'
  if (platform.includes('linux') || userAgent.includes('linux')) return 'linux'
  return 'win32'
}

function normalizeShortcutKeyName(key: string) {
  if (key === ' ') return 'Space'
  if (key === 'Esc') return 'Escape'
  if (key === 'Del') return 'Delete'
  if (key === 'Up') return 'ArrowUp'
  if (key === 'Down') return 'ArrowDown'
  if (key === 'Left') return 'ArrowLeft'
  if (key === 'Right') return 'ArrowRight'
  if (key === '+') return '='
  if (key.length === 1) return key.toUpperCase()
  return key.slice(0, 1).toUpperCase() + key.slice(1)
}

function normalizeShortcutString(value: unknown) {
  if (typeof value !== 'string') return ''
  const parts = value
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  if (!parts.length) return ''
  const modifiers = new Set<string>()
  let key = ''
  for (const part of parts) {
    const normalized = part.toLowerCase()
    if (normalized === 'cmd' || normalized === 'command' || normalized === 'meta' || normalized === '⌘') {
      modifiers.add('Meta')
    } else if (normalized === 'ctrl' || normalized === 'control' || normalized === '⌃') {
      modifiers.add('Ctrl')
    } else if (normalized === 'alt' || normalized === 'option' || normalized === 'opt' || normalized === '⌥') {
      modifiers.add('Alt')
    } else if (normalized === 'shift' || normalized === '⇧') {
      modifiers.add('Shift')
    } else {
      key = normalizeShortcutKeyName(part)
    }
  }
  if (!key) return ''
  return ['Ctrl', 'Alt', 'Shift', 'Meta']
    .filter((modifier) => modifiers.has(modifier))
    .concat(key)
    .join('+')
}

function normalizeKeyboardEventShortcut(event: KeyboardEvent) {
  const key = normalizeShortcutKeyName(event.key)
  if (!key || key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') return ''
  return [
    event.ctrlKey ? 'Ctrl' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : '',
    event.metaKey ? 'Meta' : '',
    key
  ].filter(Boolean).join('+')
}

function formatShortcutForDisplay(value: string) {
  const normalized = normalizeShortcutString(value)
  if (!normalized) return ''
  if (shortcutPlatform !== 'darwin') return normalized.replace(/Meta/g, 'Cmd')
  return normalized
    .replace(/Meta/g, 'Cmd')
    .replace(/Alt/g, 'Option')
}

function createDefaultShortcutBindings(platform: EditorPlatform) {
  const result = {} as Record<ShortcutActionId, string[]>
  SHORTCUT_ACTIONS.forEach((action) => {
    result[action.id] = action.defaultBindings(platform)
      .map(normalizeShortcutString)
      .filter(Boolean)
  })
  return result
}

function sanitizeShortcutBindings(input: unknown, fallback: Record<ShortcutActionId, string[]>) {
  const raw = typeof input === 'string'
    ? (() => {
        try { return JSON.parse(input) } catch { return null }
      })()
    : input
  const candidate = raw && typeof raw === 'object' && 'bindings' in raw
    ? (raw as { bindings?: unknown }).bindings
    : raw
  const result = {} as Record<ShortcutActionId, string[]>
  const occupied = new Set<string>()
  SHORTCUT_ACTIONS.forEach((action) => {
    const rawBindings = candidate && typeof candidate === 'object'
      ? (candidate as Record<string, unknown>)[action.id]
      : undefined
    const source = Array.isArray(rawBindings) ? rawBindings : fallback[action.id]
    const clean: string[] = []
    source.forEach((item) => {
      const normalized = normalizeShortcutString(item)
      if (!normalized || clean.includes(normalized) || occupied.has(normalized)) return
      clean.push(normalized)
      occupied.add(normalized)
    })
    result[action.id] = clean
  })
  return result
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
    const confirmed = window.confirm(`快捷键 ${formatShortcutForDisplay(next)} 已分配给“${conflict.name}”。是否覆盖？`)
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

function getShortcutBindingKey(actionId: ShortcutActionId, binding: string, index: number) {
  return `${actionId}-${binding || 'empty'}-${index}`
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
  const bindingsText = shortcutBindings[action.id].map(formatShortcutForDisplay).join(' ')
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

// 模板事件值辅助
function uiNum(value: string | number): number {
  return Number(value)
}

function normalizeInputValue(value: string | number) {
  return String(value).trim()
}

function commitNumericInput(
  value: string | number,
  fallback: number,
  apply: (next: number) => void,
  reflect: (next: string) => void
) {
  const normalized = normalizeInputValue(value)
  const parsed = Number(normalized)
  const next = normalized === '' || !Number.isFinite(parsed) ? fallback : parsed
  reflect(String(next))
  apply(next)
}
function evNum(e: Event): number {
  return +(e.target as HTMLInputElement).value
}
function evChecked(e: Event): boolean {
  return (e.target as HTMLInputElement).checked
}

function getDefaultStrokeDashArray(strokeWidth: unknown = 2): [number, number] {
  const width = Number(strokeWidth)
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 2
  return [Math.max(1, safeWidth * 3), Math.max(1, safeWidth * 2)]
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
  return !hasKaleidoscopeSelection.value && obj instanceof ActiveSelection && (obj as ActiveSelection).size() > 1
})

const canUngroup = computed(() => {
  const obj = activeObject.value
  return !hasKaleidoscopeSelection.value && obj instanceof Group && !(obj instanceof ActiveSelection)
})

const canBoolean = computed(() => {
  return !hasKaleidoscopeSelection.value && !booleanBusy.value && selectedObjects.value.length >= 2 && selectedObjects.value.every(isBooleanCandidate)
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

const hasSelectedCurveSegment = computed(() => !!selectedEditableSegment.value)

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
  applyCanvasThemeToObject(clone)
  applyDefaultKaleidoscopeMetadata(clone)
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

function formatNumericInputValue(value: number) {
  return String(Math.round(value * 100) / 100)
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
  if (!obj || !isKaleidoscopeSource(obj) || selectionMode.value !== 'shape') return
  originalControlsMap.set(obj, obj.controls as FabricControls)
  const controls: FabricControls = { ...(obj.controls as FabricControls) }
  controls[KALEIDOSCOPE_CENTER_CONTROL_KEY] = createKaleidoscopeCenterControl(obj)
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
  clearKaleidoscopeMetadata(instance)
  setKaleidoscopeInstanceManagedState(instance, false)
  instance.setCoords()
  fabricCanvas.requestRenderAll()
  refreshLayers()
  refreshActiveObject()
  snapshot()
  syncObjProps()
}
function getLocalPointFromCanvas(obj: EditablePathObject, x: number, y: number) {
  return new Point(x, y)
    .transform(util.invertTransform(obj.calcOwnMatrix()))
    .add(obj.pathOffset)
}

function restorePointControls() {
  const owner = pointControlsOwner.value
  if (!owner) return
  const original = originalControlsMap.get(owner)
  if (original) {
    owner.controls = original
    owner.setCoords()
    originalControlsMap.delete(owner)
  }
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
  return activeEditablePathObject.value === editable && selectionMode.value === 'segment'
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

function attachPointControls(obj: FabricObject | null) {
  restorePointControls()
  if (!obj || !isEditablePathObject(obj) || getSelectableEditablePoints(obj).length === 0) return
  if (selectionMode.value === 'shape') return
  const editable = obj
  originalControlsMap.set(editable, editable.controls as FabricControls)
  const controls: FabricControls = { ...(editable.controls as FabricControls) }
  // 边选择模式下，不展示选点的辅助点，仅展示每条边的中点辅助器，方便直接点击边来选中
  if (selectionMode.value === 'segment') {
    getEditableSegments(editable).forEach((segmentRef) => {
      const key = `es${segmentRef.contourIndex}_${segmentRef.segmentIndex}`
      controls[key] = createSegmentSelectControl(editable, segmentRef)
    })
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
            moveEditablePoints(editable, indices, index, getLocalPointFromCanvas(editable, x, y))
            updateCurveControls()
            syncObjProps()
            return true
          }
          // 单点拖拽
          if (pointGestureState.kind === 'single-drag') {
            moveEditablePoint(editable, index, getLocalPointFromCanvas(editable, x, y))
            updateCurveControls()
            syncObjProps()
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

interface LayerItem { id: number; name: string; obj: FabricObject }
const filteredLayers = computed(() => {
  void layerVersion.value
  if (!fabricCanvas) return []
  const q = layerSearch.value.toLowerCase()
  const objects = fabricCanvas.getObjects()
  const items: LayerItem[] = []
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i]
    if (isBooleanPreviewObject(obj)) continue
    const name = (obj as any).name || obj.type || '对象'
    if (!q || name.toLowerCase().includes(q)) {
      items.push({ id: i, name, obj })
    }
  }
  return items
})

// ── 快照（撤销重做） ──
function snapshot() {
  if (skipSnapshot || !fabricCanvas) return
  undoStack.push(JSON.stringify((fabricCanvas as any).toObject(SERIALIZED_OBJECT_PROPS as unknown as string[])))
  if (undoStack.length > 60) undoStack.shift()
  redoStack.length = 0
  canUndo.value = undoStack.length > 1
  canRedo.value = false
}

function isTransparentCanvasBg(value: unknown) {
  if (value == null) return true
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === '' || normalized === 'none' || normalized === 'transparent'
}

function normalizeCanvasBg(value: unknown) {
  return isTransparentCanvasBg(value) ? 'transparent' : String(value)
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

function undo() {
  if (undoStack.length <= 1 || !fabricCanvas) return
  clearPointEditing()
  redoStack.push(undoStack.pop()!)
  canRedo.value = true
  skipSnapshot = true
  fabricCanvas.loadFromJSON(undoStack[undoStack.length - 1]).then(async () => {
    await syncAllKaleidoscopes()
    fabricCanvas!.discardActiveObject()
    syncActiveObject(null)
    syncCanvasBgFromFabric()
    fabricCanvas!.requestRenderAll()
    skipSnapshot = false
    refreshLayers()
    canUndo.value = undoStack.length > 1
  })
}

function redo() {
  if (!redoStack.length || !fabricCanvas) return
  clearPointEditing()
  const json = redoStack.pop()!
  undoStack.push(json)
  skipSnapshot = true
  fabricCanvas.loadFromJSON(json).then(async () => {
    await syncAllKaleidoscopes()
    fabricCanvas!.discardActiveObject()
    syncActiveObject(null)
    syncCanvasBgFromFabric()
    fabricCanvas!.requestRenderAll()
    skipSnapshot = false
    refreshLayers()
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

  if (uniqueObjects.some((obj) => isKaleidoscopeObject(obj))) {
    const preferred = uniqueObjects.find((obj) => isKaleidoscopeInstance(obj))
      ?? uniqueObjects.find((obj) => isKaleidoscopeSource(obj))
      ?? uniqueObjects[0]
    fabricCanvas.setActiveObject(preferred, event)
    syncActiveObject(fabricCanvas.getActiveObject() ?? preferred)
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
function syncCanvasInteractionMode() {
  if (!fabricCanvas) return
  fabricCanvas.selection = selectionMode.value === 'shape'
}

function setSelectionMode(mode: 'shape' | 'point' | 'segment') {
  const editable = activeEditablePathObject.value
  if (mode === 'shape' || editable) {
    selectionMode.value = mode
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
  if (!obj || selectionMode.value !== 'segment') return false
  const segmentRef = getEditableSegmentByLocalPoint(
    obj,
    getLocalPointFromCanvas(obj, sceneX, sceneY),
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
  objProps.width = obj.getScaledWidth()
  objProps.height = obj.getScaledHeight()
  objProps.scaleX = obj.scaleX ?? 1
  objProps.scaleY = obj.scaleY ?? 1
  objProps.angle = obj.angle ?? 0
  objProps.opacity = obj.opacity ?? 1

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
  const first = targets.find((child) => (
    typeof child.fill === 'string' || typeof child.stroke === 'string' || child.strokeWidth != null
  )) ?? targets[0]
  const fill = first?.fill
  const enabled = isFillEnabled(fill)
  objProps.fillEnabled = enabled
  objProps.fill = enabled && typeof fill === 'string'
    ? fill
    : typeof (first as AnyFabricObject | undefined)?.lastFill === 'string'
      ? (first as AnyFabricObject).lastFill
      : '#000000'
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
    } else {
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

    const segmentRef = resolveSelectedEditableSegment()
    const segment = getLiveEditableSegment(segmentRef)
    objProps.curveEnabled = segment?.type === 'cubic'
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
    objProps.cornerRadiusInput = '0'
    objProps.pointCornerRadiusInput = '0'
    resetCurveProps()
  }
}

// ── 属性设置 ──
function setObjProp(prop: string, value: any) {
  const obj = activeObject.value
  if (!obj || !fabricCanvas) return
  if (prop === 'fill') {
    getStyleTargets(obj).forEach((target) => {
      ;(target as AnyFabricObject).lastFill = value
      target.set('fill', value)
      target.dirty = true
      target.setCoords()
    })
    objProps.fillEnabled = true
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
  obj.dirty = true
  obj.setCoords()
  fabricCanvas.requestRenderAll()
  refreshLayers()
  snapshot()
  syncObjProps()
}

function setCornerRadius(value: number) {
  const obj = activeEditablePathObject.value
  if (!obj || !fabricCanvas) return
  setObjectCornerRadius(obj, value)
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

function updateCurveControls() {
  const shapeObj = activeKaleidoscopeSource.value
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
  if (!obj || !segmentRef || !fabricCanvas) return
  setEditableSegmentType(obj, segmentRef, enabled ? 'cubic' : 'line')
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
  if (!obj || !segmentRef || !fabricCanvas) return
  setEditableSegmentControlPoint(obj, segmentRef, controlPoint, nextPoint)
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
    if (enabled) {
      target.set('fill', t.lastFill || objProps.fill || '#000000')
    } else {
      if (isFillEnabled(target.fill)) t.lastFill = target.fill
      target.set('fill', 'transparent')
    }
    target.dirty = true
    target.setCoords()
  })
  if (obj instanceof Group) obj.triggerLayout()
  obj.dirty = true
  obj.setCoords()
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
  fabricCanvas.requestRenderAll()
  refreshLayers()
  snapshot()
  syncObjProps()
}

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
  obj.dirty = true
  obj.setCoords()
  fabricCanvas?.requestRenderAll()
  refreshLayers()
  snapshot()
  syncObjProps()
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
  obj.setCoords()
  fabricCanvas.requestRenderAll()
  refreshLayers()
  snapshot()
  syncObjProps()
}

function selectAlign(positionId: AlignPositionId) {
  alignPopoverVisible.value = false
  alignToCanvas(positionId)
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

function syncActiveObject(obj: FabricObject | null) {
  clearPointEditing()
  const constrained = applyKaleidoscopeSelectionConstraints(obj)
  if (constrained && isKaleidoscopeInstance(constrained)) {
    selectionMode.value = 'shape'
  }
  if (!constrained) selectionMode.value = 'shape'
  activeObject.value = constrained
  booleanError.value = ''
  if (constrained) {
    applyCanvasThemeToObject(constrained)
  }
  syncCanvasInteractionMode()
  updateCurveControls()
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
  fabricCanvas.add(t)
  refreshLayers()
  fabricCanvas.setActiveObject(t)
  syncActiveObjectPreservingPointMode(t)
  fabricCanvas.requestRenderAll()
}

// ── 导入 ──
function importImage() {
  imgInputRef.value?.click()
}

async function onImageFileChosen(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !fabricCanvas) return
  const url = URL.createObjectURL(file)
  const img = await FabricImage.fromURL(url)
  applyDefaultKaleidoscopeMetadata(img)
  img.set({
    left: canvasWidth.value / 2 - (img.width || 60) / 2,
    top: canvasHeight.value / 2 - (img.height || 60) / 2,
    name: nextName(file.name)
  })
  img.setCoords()
  fabricCanvas.add(img)
  refreshLayers()
  fabricCanvas.setActiveObject(img)
  syncActiveObjectPreservingPointMode(img)
  fabricCanvas.requestRenderAll()
  URL.revokeObjectURL(url)
  ;(e.target as HTMLInputElement).value = ''
}

// ── 导出 ──
function exportSVG() {
  if (!fabricCanvas) return
  clearBooleanPreview()
  const svg = fabricCanvas.toSVG()
  window.services?.writeSvgFile?.(svg)
}

function exportPNG() {
  if (!fabricCanvas) return
  clearBooleanPreview()
  const currentZoom = fabricCanvas.getZoom()
  fabricCanvas.setZoom(1)
  fabricCanvas.setDimensions({ width: canvasWidth.value, height: canvasHeight.value })
  const dataUrl = fabricCanvas.toDataURL({ format: 'png', multiplier: 2 })
  fabricCanvas.setZoom(currentZoom)
  fabricCanvas.setDimensions(
    { width: canvasWidth.value * currentZoom, height: canvasHeight.value * currentZoom },
    { cssOnly: true }
  )
  window.services?.writeImageFile?.(dataUrl)
}

// ── 新建 ──
function newDoc() {
  if (!fabricCanvas) return
  clearBooleanPreview()
  clearPointEditing()
  skipSnapshot = true
  fabricCanvas.clear()
  skipSnapshot = false
  applyCanvasBgToFabric(canvasBg.value)
  fabricCanvas.requestRenderAll()
  syncActiveObject(null)
  refreshLayers()
  snapshot()
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
    targets.forEach((obj) => fabricCanvas!.remove(obj as AnyFabricObject))
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

// ── 图层 ──
function isLayerActive(obj: FabricObject) {
  return fabricCanvas?.getActiveObjects().includes(obj) ?? false
}

function isLayerKaleidoscopeLocked(obj: FabricObject) {
  return isKaleidoscopeInstance(obj)
}

function selectLayer(obj: FabricObject, event?: MouseEvent) {
  if (!fabricCanvas || selectionMode.value !== 'shape') return
  clearPointEditing()
  if (!isMultiSelectModifierPressed(event)) {
    fabricCanvas.setActiveObject(obj, event)
    syncActiveObject(fabricCanvas.getActiveObject() ?? obj)
    fabricCanvas.requestRenderAll()
    return
  }
  const selectedObjects = fabricCanvas.getActiveObjects()
  const nextSelection = selectedObjects.includes(obj)
    ? selectedObjects.filter((item) => item !== obj)
    : [...selectedObjects, obj]
  applyActiveObjectsSelection(nextSelection, event)
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
  obj.setCoords()
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
}

function handleWindowBlur() {
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
    if (isBooleanPreviewObject(event.target ?? null)) return
    clearBooleanPreview()
    triggerKaleidoscopeTransformSync(event.target ?? null)
    snapshot()
    syncObjProps()
    refreshLayers()
  })
  // Real-time sync during drag interactions
  fabricCanvas.on('object:scaling', () => {
    clearBooleanPreview()
    syncObjProps()
  })
  fabricCanvas.on('object:moving', (event) => {
    clearBooleanPreview()
    syncObjProps()
    triggerKaleidoscopeTransformSync(event.target ?? null)
  })
  fabricCanvas.on('object:rotating', (event) => {
    clearBooleanPreview()
    syncObjProps()
    triggerKaleidoscopeTransformSync(event.target ?? null)
  })

  // 对象添加/删除时快照
  fabricCanvas.on('object:added', (event) => {
    if (isBooleanPreviewObject(event.target ?? null)) return
    applyCanvasThemeToObject(event.target ?? null)
    refreshLayers()
    snapshot()
  })
  fabricCanvas.on('object:removed', (event) => {
    if (isBooleanPreviewObject(event.target ?? null)) return
    removeKaleidoscopeInstancesForRemovedSource(event.target ?? null)
    refreshLayers()
    snapshot()
  })
}

// ── 初始化 ──
onMounted(() => {
  if (!canvasElRef.value) return
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
  applyCanvasTheme()
  syncCanvasInteractionMode()
  initAligningGuidelines()
  setupCanvasEvents()

  // 延迟 fit，确保 DOM 已完成布局
  nextTick(() => {
    fitCanvasInView()
    snapshot()
  })

  // 窗口缩放自适应
  window.addEventListener('resize', fitCanvasInView)
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keyup', handleKeyup)
  window.addEventListener('blur', handleWindowBlur)
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
  endSpacePan()
  clearBooleanPreview()
  clearPointEditing()
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

/* ── 顶栏 ── */
.top-bar {
  display: flex;
  align-items: center;
  height: $topbar-h;
  padding: 0 10px;
  background: $panel-bg;
  border-bottom: $border;
  gap: 6px;
  flex-shrink: 0;
}
.top-bar-left {
  .app-title {
    font-weight: 700;
    font-size: 14px;
    margin-right: 12px;
  }
}
.top-bar-center {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  justify-content: center;
}
.top-bar-right {
  display: flex;
  align-items: center;
  gap: 4px;
  .zoom-label {
    font-size: 12px;
    min-width: 42px;
    text-align: right;
  }
}
.tb-sep {
  width: 1px;
  height: 20px;
  background: rgba(128, 128, 128, 0.2);
  margin: 0 4px;
}
.top-bar-btn,
.top-bar-icon-btn,
.layer-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-sizing: border-box;
  border: 2px solid var(--control-border);
  border-radius: 6px;
  background: #fafafa;
  box-shadow: none;
  color: #555;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease, background-color 0.15s ease;

  &:hover:not(:disabled) {
    background: #fafafa;
    border-color: color-mix(in srgb, var(--primary-color), black 15%);
    color: #333;
  }

  &:disabled {
    box-shadow: none;
  }

  &.is-active {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light-bg);
    color: var(--primary-color);
  }
}
.top-bar-btn {
  min-height: 28px;
  white-space: nowrap;
}
.top-bar-icon-btn,
.layer-toolbar-btn {
  width: 28px;
  min-width: 28px;
  height: 28px;
  padding: 0;
  font-size: 14px;

  :deep(svg) {
    width: 14px;
    height: 14px;
  }
}
.top-bar-reset-btn {
  width: auto;
  min-width: 40px;
}
.shortcut-topbar-btn {
  min-width: 54px;
}

:global(.zt-drawer__mask) {
  background: rgba(0, 0, 0, 0.18);
}
:global(.shortcut-drawer) {
  display: flex;
  flex-direction: column;
  background: $panel-bg;
  border-left: $border;
  box-shadow: -16px 0 36px rgba(0, 0, 0, 0.16);
  overflow: hidden;
}
.shortcut-drawer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: $border;
  h2 {
    margin: 0;
    font-size: 18px;
  }
  p {
    margin: 4px 0 0;
    color: #666;
    font-size: 12px;
  }
}
.shortcut-close-btn,
.shortcut-binding-delete {
  border: 1px solid rgba(128, 128, 128, 0.24);
  border-radius: 6px;
  background: #fff;
  color: #666;
  cursor: pointer;
  &:hover { background: #f1f1f1; color: #c00; }
}
.shortcut-close-btn {
  width: 35px;
  height: 35px;
  font-size: 20px;
  line-height: 1;
}
.shortcut-drawer-tools {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: $border;
}
.shortcut-group-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 16px;
}
.shortcut-group {
  margin-bottom: 14px;
}
.shortcut-group-title {
  position: sticky;
  top: -8px;
  z-index: 1;
  padding: 8px 0;
  background: $panel-bg;
  color: #555;
  font-weight: 700;
  font-size: 12px;
}
.shortcut-action-row {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid rgba(128, 128, 128, 0.14);
}
.shortcut-action-name {
  font-weight: 600;
  color: #333;
}
.shortcut-action-desc {
  margin-top: 3px;
  color: #777;
  font-size: 12px;
  line-height: 1.35;
}
.shortcut-binding-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.shortcut-binding-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 35px 35px;
  gap: 6px;
  align-items: center;
}
.shortcut-hotkey-input {
  min-width: 0;
}
.shortcut-binding-delete,
.shortcut-binding-add {
  width: 35px;
  height: 35px;
  padding: 0;
  box-sizing: border-box;
  border: 2px solid var(--control-border);
  border-radius: 6px;
  background: #fafafa;
  color: #666;
  cursor: pointer;
  line-height: 1;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, color 0.15s ease;

  &:hover {
    background: #fafafa;
    border-color: var(--primary-color);
  }
}
.shortcut-binding-delete {
  font-size: 16px;

  &:hover {
    color: #c00;
  }
}
.shortcut-binding-add {
  font-size: 15px;
  color: var(--primary-color);
}
.shortcut-binding-add--empty {
  align-self: flex-end;
}
.shortcut-empty {
  padding: 32px 0;
  color: #777;
  text-align: center;
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

/* ── 按钮通用 ── */
.tb-btn {
  padding: 4px 10px;
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 5px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  &:hover { background: #e8e8e8; }
  &:disabled { opacity: 0.4; cursor: default; }
  &.sm { padding: 3px 7px; font-size: 11px; }
  &.xs { padding: 2px 6px; font-size: 11px; }
  &.active { background: #d0e0ff; border-color: #7ba7e0; }
  &.danger { color: #c00; }
  &.primary { background: #1e6fff; color: #fff; border-color: #1e6fff; }
}

/* ── 主体 ── */
.editor-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ── 左栏 ── */
.left-panel {
  width: $left-w;
  background: $panel-bg;
  border-right: $border;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
}
.side-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.left-tabs-pane-wrapper,
.left-tabs-pane,
.right-tabs-pane-wrapper,
.right-tabs-pane {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
:deep(.side-tabs > .zt-tabs__nav) {
  width: 100%;
}
:deep(.side-tabs > .zt-tabs__nav .zt-tabs__nav-list) {
  width: 100%;
}
:deep(.side-tabs-tab) {
  flex: 1 1 0;
  justify-content: center;
  text-align: center;
}
.left-tabs {
  border-bottom: $border;
}
.left-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.section-title {
  font-weight: 700;
  font-size: 12px;
  padding: 6px 4px;
  color: #555;
}
.asset-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}
.asset-item {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border: 1px solid rgba(128, 128, 128, 0.15);
  border-radius: 6px;
  cursor: pointer;
  padding: 6px;
  background: #fafafa;
  transition: border-color 0.15s;
  &:hover { border-color: #1e6fff; }
}
.shape-preview-svg {
  width: 70%;
  height: 70%;
  overflow: visible;
}
.text-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.text-preset-btn {
  padding: 12px;
  border: 1px solid rgba(128, 128, 128, 0.15);
  border-radius: 6px;
  background: #fafafa;
  cursor: pointer;
  text-align: left;
  &:hover { border-color: #1e6fff; }
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
    background: #fafafa;
    border-color: color-mix(in srgb, var(--primary-color), black 15%);
  }

  &.active {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light-bg);
  }
}

/* ── 右栏 ── */
.right-panel {
  width: $right-w;
  background: $panel-bg;
  border-left: $border;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
}
.right-tabs {
  border-bottom: none;
}
.right-panel-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 8px;
}
.size-lock-icon,
.size-lock-spacer {
  width: 20px;
  height: 22px;
  flex-shrink: 0;
}
.size-lock-spacer {
  display: block;
}
.size-lock-icon {
  justify-self: center;
  padding: 3px;
  cursor: pointer;
  color: #666;
  &.active { color: #1e6fff; }
}
.prop-section {
  padding: 4px 0;
  border-bottom: $border;
}
.transform-row {
  display: grid!important;
  grid-template-columns: 28px 20px 1fr 1fr;
  column-gap: 4px;
}
.align-row {
  display: grid!important;
  grid-template-columns: 36px 1fr;
  column-gap: 8px;
  align-items: center;
  :deep(.zt-popover) {
    justify-self: end;
  }
}
.align-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: 1fr;
  gap: 4px;
  width: 100%;
}
.align-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 3px;
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 5px;
  background: #fff;
  color: #555;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  &:hover {
    background: color-mix(in srgb, var(--primary-color) 8%, #fff);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }
  &.active {
    border-color: var(--primary-color);
    color: var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 12%, #fff);
  }
  &.align-trigger {
    color: var(--primary-color);
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
}
.align-grid .align-btn {
  width: 100%;
  height: auto;
  aspect-ratio: 1;
}
.align-popover-grid {
  width: 108px;
}
:deep(.zt-popover__panel:has(.align-popover-grid) .zt-popover__content) {
  min-width: 0;
}
:deep(.zt-popover__panel:has(.align-popover-grid) .zt-popover__body--card) {
  padding: 8px;
}
.prop-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  label {
    font-size: 11px;
    color: #666;
    min-width: 36px;
  }
  :deep(.zt-input) {
    width: 100%;
  }
  input[type="color"] {
    width: 28px;
    height: 24px;
    padding: 0;
    border: 1px solid #ccc;
    border-radius: 3px;
    cursor: pointer;
    &:disabled { opacity: 0.45; cursor: not-allowed; }
  }
  input[type="range"] {
    flex: 1;
  }
  select {
    flex: 1;
    padding: 3px 4px;
    border: 1px solid #ccc;
    border-radius: 3px;
    font-size: 12px;
  }
  .val-label {
    font-size: 11px;
    color: #666;
    min-width: 36px;
    text-align: right;
  }
  &.rotation-row,
  &.opacity-row {
    label {
      width: 52px;
      min-width: 52px;
    }
  }
  &.style-toggle-row,
  &.style-color-row {
    display: grid;
    grid-template-columns: 48px 1fr;
    column-gap: 8px;
  }
  &.bezier-group-row {
    display: grid;
    grid-template-columns: 48px 1fr 1fr;
    column-gap: 6px;
  }
  .stroke-line-type-picker {
    justify-self: end;
  }
  &.style-toggle-row {
    :deep(.zt-switch) {
      justify-self: end;
    }
  }
}

.prop-actions {
  display: flex;
  gap: 4px;
  padding: 6px 8px;
  flex-wrap: wrap;
}
.boolean-actions {
  border-bottom: $border;
  margin-top: 0;
}
.boolean-preview-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 120px;
}
.boolean-preview-option {
  width: 100%;
  justify-content: flex-start;
}
.boolean-preview-note {
  font-size: 12px;
  color: #666;
  line-height: 1.4;
  max-width: 180px;
}
.boolean-status,
.boolean-error {
  width: 100%;
  font-size: 12px;
}
.boolean-status { color: #666; }
.boolean-error { color: #c00; }

/* ── 图层 ── */
.layer-header {
  margin-top: 8px;
  border-top: $border;
  padding-top: 8px;
}
.layer-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  .layer-search {
    flex: 1;
    min-width: 0;
  }
}
.layer-toolbar-btn {
  flex-shrink: 0;
}
.layer-list {
  display: flex;
  flex-direction: column;
}
.layer-empty {
  padding: 10px 8px 12px;
  font-size: 12px;
  color: #888;
}
.layer-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  cursor: pointer;
  &.active { background: #d0e0ff; }
  &:hover { background: #e8e8e8; }
  .layer-name {
    flex: 1;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.layer-icon-btn {
  width: 22px;
  height: 22px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  padding: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  &.danger:hover { color: #c00; }
}
</style>
