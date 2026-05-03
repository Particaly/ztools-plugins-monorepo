<template>
  <div class="editor-root">
    <!-- 顶栏 -->
    <header class="top-bar">
      <div class="top-bar-left">
        <span class="app-title">图标编辑器</span>
      </div>
      <div class="top-bar-center">
        <button class="tb-btn" @click="newDoc" title="新建">新建</button>
        <button class="tb-btn" @click="importImage" title="导入图片">导入图片</button>
        <button class="tb-btn" @click="exportSVG" title="导出 SVG">导出 SVG</button>
        <button class="tb-btn" @click="exportPNG" title="导出 PNG">导出 PNG</button>
        <span class="tb-sep"></span>
        <button class="tb-btn" :disabled="!canUndo" @click="undo" title="撤销">撤销</button>
        <button class="tb-btn" :disabled="!canRedo" @click="redo" title="重做">重做</button>
        <span class="tb-sep"></span>
        <button class="tb-btn" :class="{ active: showRuler }" @click="showRuler = !showRuler" title="标尺">标尺</button>
      </div>
      <div class="top-bar-right">
        <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
        <button class="tb-btn sm" @click="setZoom(zoom - 0.1)">−</button>
        <button class="tb-btn sm" @click="setZoom(zoom + 0.1)">+</button>
        <button class="tb-btn sm" @click="setZoom(1)">1:1</button>
      </div>
    </header>

    <div class="editor-body">
      <!-- 左栏 -->
      <aside class="left-panel">
        <div class="left-tabs">
          <button :class="{ active: leftTab === 'shape' }" @click="leftTab = 'shape'">形状</button>
          <button :class="{ active: leftTab === 'text' }" @click="leftTab = 'text'">文字</button>
        </div>
        <div class="left-content">
          <template v-if="leftTab === 'shape'">
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
          </template>
          <template v-if="leftTab === 'text'">
            <div class="section-title">文字预设</div>
            <div class="text-list">
              <button
                v-for="t in textPresets" :key="t.id" class="text-preset-btn"
                @click="addText(t)"
              >
                <span :style="{ fontSize: t.fontSize > 30 ? 20 : t.fontSize + 'px', fontWeight: t.fontWeight }">{{ t.label }}</span>
              </button>
            </div>
          </template>
        </div>
      </aside>

      <!-- 中间画布区 -->
      <main class="canvas-area" ref="canvasAreaRef">
        <div class="canvas-wrapper" :class="{ 'transparent-bg': isCanvasBgTransparent }">
          <canvas ref="canvasElRef"></canvas>
        </div>
      </main>

      <!-- 右栏 -->
      <aside class="right-panel">
        <!-- 对象属性 -->
        <template v-if="activeObject">
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
              <ZInput size="small" type="text" :model-value="objProps.strokeWidth" @change="setObjProp('strokeWidth', uiNum($event))" />
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

        <!-- 画布设置（无选中时） -->
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
            <ZInput size="small" type="text" :model-value="canvasWidth" @change="setCanvasSize('width', uiNum($event))" />
            <ZInput size="small" type="text" :model-value="canvasHeight" @change="setCanvasSize('height', uiNum($event))" />
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

        <!-- 图层区 -->
        <div class="section-title layer-header">
          <span>图层</span>
        </div>
        <div class="layer-toolbar">
          <button class="tb-btn xs" @click="layerUp" title="上移"><Icon icon="mdi:arrow-up" /></button>
          <button class="tb-btn xs" @click="layerDown" title="下移"><Icon icon="mdi:arrow-down" /></button>
          <button class="tb-btn xs" @click="layerTop" title="置顶"><Icon icon="mdi:arrow-collapse-up" /></button>
          <button class="tb-btn xs" @click="layerBottom" title="置底"><Icon icon="mdi:arrow-collapse-down" /></button>
          <ZInput class="layer-search" size="small" type="text" placeholder="搜索" v-model="layerSearch" />
        </div>
        <div class="layer-list">
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
      </aside>
    </div>

    <!-- 隐藏的文件输入 -->
    <input ref="imgInputRef" type="file" accept="image/*" style="display:none" @change="onImageFileChosen" />
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, triggerRef, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ZInput, ZSelect, ZColorPicker, ZSwitch, ZSlider, ZPopover, ZButton } from 'ztools-ui'
import { Icon } from '@iconify/vue'
import { Canvas, Control, FabricObject, Textbox, Group, ActiveSelection, FabricImage, Point, util } from 'fabric'
import { AligningGuidelines } from '../../fabric-aligning-guidelines'
import { basicShapes, textPresets, canvasPresets } from './editorCatalog'
import type { ShapeLibraryItem, TextLibraryItem } from './editorCatalog'
import { createShape } from './fabric/shapeFactories'
import { isBooleanCandidate, type FabricBooleanStyleSnapshot } from './geometry/fabricToPathKit'
import { applyBooleanOperation, computeBooleanResult } from './geometry/booleanOps'
import type { BooleanOperation, SubtractDirection } from './geometry/booleanOps'
import { pathKitToFabricPath } from './geometry/pathKitToFabric'
import {
  editablePointToLocalObjectPoint,
  getPointRadius,
  getSelectableEditablePoints,
  isEditablePathObject,
  moveEditablePoint,
  setObjectCornerRadius,
  setPointCornerRadius,
  setPointsCornerRadius,
  type EditablePathObject
} from './geometry/editablePath'

// ── 类型工具 ──
type AnyFabricObject = FabricObject & Record<string, any>
type FabricControls = Record<string, Control>
type BooleanPreviewHiddenObject = {
  object: FabricObject
  visible: boolean
}
type StrokeLineType = 'solid' | 'dashed'

// ── refs ──
const canvasElRef = ref<HTMLCanvasElement | null>(null)
const canvasAreaRef = ref<HTMLElement | null>(null)
const imgInputRef = ref<HTMLInputElement | null>(null)

// ── 状态 ──
let fabricCanvas: Canvas | null = null
let aligningGuidelines: AligningGuidelines | null = null

const leftTab = ref<'shape' | 'text'>('shape')
const showRuler = ref(false)
const zoom = ref(1)
const activeObject = shallowRef<FabricObject | null>(null)
const canvasWidth = ref(800)
const canvasHeight = ref(600)
const canvasBg = ref('#ffffff')
const lastOpaqueCanvasBg = ref('#ffffff')
const canvasPresetValue = ref('')
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
  stroke: '#000000', strokeEnabled: true, strokeWidth: 0, strokeLineType: 'solid' as StrokeLineType, strokeDashLength: 6, strokeDashGap: 4, strokeDashLengthInput: '6', strokeDashGapInput: '4', opacity: 1,
  cornerRadius: 0,
  pointCornerRadius: 0,
  cornerRadiusInput: '0',
  pointCornerRadiusInput: '0'
})
const selectedPointIndices = ref<number[]>([])
const pointControlsOwner = shallowRef<EditablePathObject | null>(null)
const originalControlsMap = new WeakMap<FabricObject, FabricControls>()
const sizeRatioLocked = ref(false)
const lockedAspectRatio = ref(1)

// 撤销重做
const undoStack: string[] = []
const redoStack: string[] = []
const canUndo = ref(false)
const canRedo = ref(false)
let skipSnapshot = false

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
const canGroup = computed(() => {
  const obj = activeObject.value
  return obj instanceof ActiveSelection && (obj as ActiveSelection).size() > 1
})

const canUngroup = computed(() => {
  const obj = activeObject.value
  return obj instanceof Group && !(obj instanceof ActiveSelection)
})

const selectedObjects = computed(() => {
  void layerVersion.value
  return fabricCanvas?.getActiveObjects() ?? []
})

const canBoolean = computed(() => {
  return !booleanBusy.value && selectedObjects.value.length >= 2 && selectedObjects.value.every(isBooleanCandidate)
})

const canDirectionalSubtract = computed(() => {
  return canBoolean.value && selectedObjects.value.length === 2
})

const activeEditablePathObject = computed(() => {
  const obj = activeObject.value
  return obj && isEditablePathObject(obj) ? obj : null
})

const hasEditablePoints = computed(() => {
  const obj = activeEditablePathObject.value
  return !!obj && getSelectableEditablePoints(obj).length > 0
})

const selectedPointIndex = computed(() => (
  selectedPointIndices.value.length === 1 ? selectedPointIndices.value[0] : null
))

const hasSelectedPoint = computed(() => selectedPointIndices.value.length > 0)

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
  return '#1e6fff'
}

function getBooleanPreviewStrokeWidth(style: FabricBooleanStyleSnapshot) {
  const width = Number(style.strokeWidth || 0)
  if (!Number.isFinite(width) || width <= 0) return 2
  return Math.max(2, Math.min(width, 4))
}

function getViewportPointForEditablePoint(obj: EditablePathObject, pointIndex: number) {
  return editablePointToLocalObjectPoint(obj, pointIndex).transform(
    util.multiplyTransformMatrices(obj.getViewportTransform(), obj.calcTransformMatrix())
  )
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

function clearPointEditing() {
  clearSelectedPoint()
  restorePointControls()
}

function setSelectedEditablePoints(obj: EditablePathObject, indices: number[]) {
  selectedPointIndices.value = normalizeSelectedPointIndices(obj, indices)
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

function renderPointControl(ctx: CanvasRenderingContext2D, left: number, top: number) {
  const key = (this as Control & { pointIndex?: number }).pointIndex
  const selected = key != null && selectedPointIndices.value.includes(key)
  ctx.save()
  ctx.beginPath()
  ctx.arc(left, top, selected ? 5 : 4, 0, Math.PI * 2)
  ctx.fillStyle = selected ? '#1e6fff' : '#ffffff'
  ctx.strokeStyle = '#1e6fff'
  ctx.lineWidth = 2
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function attachPointControls(obj: FabricObject | null) {
  restorePointControls()
  if (!obj || !isEditablePathObject(obj) || getSelectableEditablePoints(obj).length === 0) return
  const editable = obj
  originalControlsMap.set(editable, editable.controls as FabricControls)
  const controls: FabricControls = { ...(editable.controls as FabricControls) }
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
        selectEditablePoint(editable, index, isMultiSelectModifierPressed(eventData))
        return false
      },
      actionHandler: (_eventData, _transform, x, y) => {
        if (!selectedPointIndices.value.includes(index)) {
          setSelectedEditablePoints(editable, [index])
        }
        moveEditablePoint(editable, index, getLocalPointFromCanvas(editable, x, y))
        syncObjProps()
        return true
      },
      mouseUpHandler: () => {
        snapshot()
        return false
      },
      render: renderPointControl
    } as Partial<Control> & { pointIndex: number })
  })
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
  undoStack.push(JSON.stringify((fabricCanvas as any).toObject(['name', 'strokeUniform', 'lastFill', 'lastStroke', 'lastStrokeWidth', 'lastStrokeDashArray', 'shapeId', 'booleanEligible', 'fillRule', 'editablePath', 'cornerRadius', 'cornerRadiusOverrides', 'editablePathVersion'])))
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
  fabricCanvas.loadFromJSON(undoStack[undoStack.length - 1]).then(() => {
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
  fabricCanvas.loadFromJSON(json).then(() => {
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
    color: 'rgba(30, 111, 255, 0.85)',
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
}

// ── 同步选中对象属性 ──
function syncObjProps() {
  const obj = activeObject.value
  if (!obj) return
  objProps.left = obj.left ?? 0
  objProps.top = obj.top ?? 0
  objProps.width = obj.getScaledWidth()
  objProps.height = obj.getScaledHeight()
  objProps.scaleX = obj.scaleX ?? 1
  objProps.scaleY = obj.scaleY ?? 1
  objProps.angle = obj.angle ?? 0
  objProps.opacity = obj.opacity ?? 1

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
  objProps.strokeEnabled = isStrokeEnabled(first?.stroke, first?.strokeWidth)
  const currentStrokeDashArray = normalizeStrokeDashArray(first?.strokeDashArray)
  const rememberedStrokeDashArray = getStrokeDashPair(first)
  objProps.strokeLineType = currentStrokeDashArray ? 'dashed' : 'solid'
  objProps.strokeDashLength = rememberedStrokeDashArray[0]
  objProps.strokeDashGap = rememberedStrokeDashArray[1]
  objProps.strokeDashLengthInput = String(rememberedStrokeDashArray[0])
  objProps.strokeDashGapInput = String(rememberedStrokeDashArray[1])

  if (isEditablePathObject(obj)) {
    objProps.cornerRadius = obj.cornerRadius ?? 0
    const pointRadiusState = getSelectedPointRadiusState(obj)
    objProps.pointCornerRadius = pointRadiusState.value
    objProps.cornerRadiusInput = String(Math.round(objProps.cornerRadius))
    objProps.pointCornerRadiusInput = pointRadiusState.hasSelection
      ? pointRadiusState.mixed
        ? ''
        : String(Math.round(pointRadiusState.value))
      : '0'
  } else {
    objProps.cornerRadius = 0
    objProps.pointCornerRadius = 0
    objProps.cornerRadiusInput = '0'
    objProps.pointCornerRadiusInput = '0'
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

// ── 画布尺寸 ──
function setCanvasSize(dim: 'width' | 'height', value: number) {
  if (!fabricCanvas) return
  if (dim === 'width') canvasWidth.value = value
  else canvasHeight.value = value
  applyCanvasSize()
}

function applyCanvasSize() {
  if (!fabricCanvas) return
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
  activeObject.value = obj
  booleanError.value = ''
  attachPointControls(obj)
  refreshLayers()
  if (obj) {
    if (sizeRatioLocked.value) {
      lockedAspectRatio.value = getObjectAspectRatio(obj)
    }
    syncObjProps()
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
  syncActiveObject(shape)
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
  fabricCanvas.add(t)
  refreshLayers()
  fabricCanvas.setActiveObject(t)
  syncActiveObject(t)
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
  img.set({
    left: canvasWidth.value / 2 - (img.width || 60) / 2,
    top: canvasHeight.value / 2 - (img.height || 60) / 2,
    name: nextName(file.name)
  })
  img.setCoords()
  fabricCanvas.add(img)
  refreshLayers()
  fabricCanvas.setActiveObject(img)
  syncActiveObject(img)
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
  skipSnapshot = true
  try {
    targets.forEach((obj) => fabricCanvas!.remove(obj as AnyFabricObject))
  } finally {
    skipSnapshot = false
  }
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
  fabricCanvas.remove(...objs)
  fabricCanvas.add(group)
  refreshLayers()
  fabricCanvas.setActiveObject(group)
  syncActiveObject(group)
  fabricCanvas.requestRenderAll()
}

function ungroupObject() {
  const obj = activeObject.value
  if (!(obj instanceof Group) || !fabricCanvas) return
  const items = obj.removeAll()
  fabricCanvas.remove(obj)
  for (const item of items) {
    fabricCanvas.add(item)
  }
  fabricCanvas.discardActiveObject()
  syncActiveObject(null)
  refreshLayers()
  fabricCanvas.requestRenderAll()
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

function selectLayer(obj: FabricObject, event?: MouseEvent) {
  if (!fabricCanvas) return
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

function handleKeydown(e: KeyboardEvent) {
  if (e.key !== 'Delete' || !fabricCanvas?.getActiveObjects().length) return
  if (isEditableTarget(e.target)) return
  e.preventDefault()
  deleteObject()
}

// ── Fabric 事件 ──
function setupCanvasEvents() {
  if (!fabricCanvas) return

  fabricCanvas.on('selection:created', () => {
    clearBooleanPreview()
    syncActiveObject(fabricCanvas!.getActiveObject() ?? null)
  })
  fabricCanvas.on('selection:updated', () => {
    clearBooleanPreview()
    syncActiveObject(fabricCanvas!.getActiveObject() ?? null)
  })
  fabricCanvas.on('selection:cleared', () => {
    clearBooleanPreview()
    syncActiveObject(null)
  })
  fabricCanvas.on('object:modified', (event) => {
    if (isBooleanPreviewObject(event.target ?? null)) return
    clearBooleanPreview()
    snapshot()
    syncObjProps()
    refreshLayers()
  })
  // Real-time sync during drag interactions
  fabricCanvas.on('object:scaling', () => {
    clearBooleanPreview()
    syncObjProps()
  })
  fabricCanvas.on('object:moving', () => {
    clearBooleanPreview()
    syncObjProps()
  })
  fabricCanvas.on('object:rotating', () => {
    clearBooleanPreview()
    syncObjProps()
  })

  // 对象添加/删除时快照
  fabricCanvas.on('object:added', (event) => {
    if (isBooleanPreviewObject(event.target ?? null)) return
    refreshLayers()
    snapshot()
  })
  fabricCanvas.on('object:removed', (event) => {
    if (isBooleanPreviewObject(event.target ?? null)) return
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
    selectionKey: ['shiftKey', 'ctrlKey']
  })

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
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', fitCanvasInView)
  window.removeEventListener('keydown', handleKeydown)
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
}
.left-tabs {
  display: flex;
  border-bottom: $border;
  button {
    flex: 1;
    padding: 8px 0;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    &.active {
      border-bottom: 2px solid #1e6fff;
      color: #1e6fff;
    }
  }
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

.transparent-swatch,
.stroke-line-swatch {
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
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover:not(:disabled) {
    background-color: #fafafa;
    background-image:
      linear-gradient(45deg, rgba(0, 0, 0, 0.07) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.07) 75%, rgba(0, 0, 0, 0.07)),
      linear-gradient(45deg, rgba(0, 0, 0, 0.07) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.07) 75%, rgba(0, 0, 0, 0.07));
    background-position: 0 0, 6px 6px;
    background-size: 12px 12px;
  }
}

.stroke-line-swatch {
  flex: 0 0 28px;
  border: 1px solid rgba(128, 128, 128, 0.18);
  border-radius: 6px;
  background: #fafafa;

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

  &.active {
    border-color: #1e6fff;
    box-shadow: 0 0 0 2px rgba(30, 111, 255, 0.15);
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
  gap: 3px;
  padding: 4px 8px;
  .layer-search {
    flex: 1;
    padding: 2px 6px;
    border: 1px solid #ccc;
    border-radius: 3px;
    font-size: 11px;
  }
}
.layer-list {
  flex: 1;
  overflow-y: auto;
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
