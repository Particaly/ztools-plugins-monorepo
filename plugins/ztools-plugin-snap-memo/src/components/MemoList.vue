<script setup lang="ts">
/**
 * 备忘列表：listbox 语义、键盘选中自动跟随、条目 > 300 时启用窗口化渲染（虚拟滚动）。
 * 行高可变（简洁/完整模式、条目内联展开）：渲染行经 ResizeObserver 实测回填高度，
 * 未渲染行按密度估算，偏移量前缀和驱动窗口计算、滚动定位与拖拽落点；
 * 视口上方高度变化时补偿 scrollTop，避免内容跳动。
 * 排序方式为“手动”且无搜索词时，条目可拖拽排序（拖动左侧 grip）。
 * 「图片」筛选 + 网格视图开启时切换为等尺寸缩略图墙（固定格宽 → 行列算术窗口化），
 * 点击格子直接进入全屏查看（←/→ 翻页）；多选模式自动回落列表行。
 * 可见行（或格子）统一在此触发缩略图预取（store 内限流生成）。
 * 滚动条为 OverlayScrollbars 覆盖式虚拟滚动条（悬浮、自动隐藏、随明暗主题变色）：
 * 真实滚动元素是 OS 在内部创建的 .os-viewport，本组件的 scroller ref 指向它。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { OverlayScrollbars } from 'overlayscrollbars'
import type { AppStore } from '../store/appStore'
import type { Memo } from '../core/types'
import { firstImageSlot, stripImageTokens } from '../core/inlineImage'
import MemoItem from './MemoItem.vue'
import Icon from './Icon.vue'
import { t } from '../i18n/zh-CN'

const props = defineProps<{ store: AppStore }>()

/** 滚动容器根（OverlayScrollbars 宿主；本身不滚动）。 */
const hostEl = ref<HTMLElement | null>(null)
/** 实际滚动元素（OS 内部创建的 .os-viewport）：scrollTop 读写、尺寸测量、scroll 事件都走它。 */
const scroller = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportH = ref(420)
/** 网格几何用的内容区宽度（跟随容器尺寸重算列数）。 */
const contentW = ref(360)

/** OverlayScrollbars 实例（覆盖式滚动条：悬浮在内容上、停止滚动自动隐藏）。 */
let osInstance: ReturnType<typeof OverlayScrollbars> | null = null

const VIRTUAL_THRESHOLD = 300
const BUFFER = 6
/** 行间距（px）；与样式里 .row 的下边距保持一致，偏移量按“行高 + 间距”累加。 */
const ROW_GAP = 6
/** 网格最小格宽与格间距（px）；列数 = 内容宽 / 最小格宽。 */
const GRID_MIN_CELL = 132
const GRID_GAP = 6

const items = computed(() => props.store.computed.visibleMemos.value)

const virtual = computed(() => items.value.length > VIRTUAL_THRESHOLD)

/** 网格墙模式：仅「图片」筛选且设置开启、非多选时生效。 */
const gridMode = computed(
  () =>
    props.store.state.filter === 'images' &&
    props.store.state.settings.imageGridView &&
    !props.store.state.batchMode
)

// ---- 动态行高：实测优先、估算兜底 ----

const heights = ref(new Map<string, number>())
const heightVersion = ref(0)

const estimate = computed(() => (props.store.state.settings.density === 'compact' ? 48 : 84))

/** 记录一次实测高度；变化超过阈值才置脏，避免亚像素抖动触发重算。 */
function measure(id: string, h: number): void {
  const prev = heights.value.get(id)
  if (prev === undefined || Math.abs(prev - h) > 0.5) {
    heights.value.set(id, h)
    heightVersion.value += 1
  }
}

/** 每行结束位置的前缀和（offsets[i] 为第 i 行顶部；末位为总高度）。 */
const offsets = computed(() => {
  void heightVersion.value
  const arr = new Array<number>(items.value.length + 1)
  arr[0] = 0
  for (let i = 0; i < items.value.length; i++) {
    arr[i + 1] = arr[i] + (heights.value.get(items.value[i]!.id) ?? estimate.value) + ROW_GAP
  }
  return arr
})

/** 二分查找：返回 offset 覆盖 y 的行号（offsets[i] <= y < offsets[i+1]）。 */
function findIndexAtOffset(y: number): number {
  const arr = offsets.value
  let lo = 0
  let hi = items.value.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid] <= y) lo = mid + 1
    else hi = mid
  }
  return Math.max(0, lo - 1)
}

const range = computed(() => {
  if (!virtual.value) return { start: 0, end: items.value.length }
  const first = Math.max(0, findIndexAtOffset(Math.max(0, scrollTop.value)) - BUFFER)
  const limit = scrollTop.value + viewportH.value
  let last = first
  while (last < items.value.length && offsets.value[last] < limit) last++
  return { start: first, end: Math.min(items.value.length, last + BUFFER) }
})

const windowed = computed(() => items.value.slice(range.value.start, range.value.end))

/** 虚拟模式下的占位总高度；非虚拟模式走文档流，不设总高。 */
const totalHeight = computed(() => (virtual.value ? offsets.value[items.value.length] : 0))

// ---- 网格墙（等尺寸格子 → 行列算术窗口化，无需行高实测） ----

/** 列数与格宽：按内容宽自适应，最少 2 列；方格（格宽 = 行高）。 */
const gridGeom = computed(() => {
  const usable = Math.max(GRID_MIN_CELL, contentW.value)
  const cols = Math.max(2, Math.floor((usable + GRID_GAP) / (GRID_MIN_CELL + GRID_GAP)))
  const cell = Math.floor((usable - (cols - 1) * GRID_GAP) / cols)
  return { cols, cell, rowStep: cell + GRID_GAP }
})

const totalGridRows = computed(() => Math.ceil(items.value.length / gridGeom.value.cols))

/** 可见格子窗口（含上下各 1 行缓冲）。 */
const gridWindow = computed(() => {
  const { rowStep } = gridGeom.value
  const firstRow = Math.max(0, Math.floor(scrollTop.value / rowStep) - 1)
  const rowsVisible = Math.ceil(viewportH.value / rowStep) + 2
  const start = firstRow * gridGeom.value.cols
  const end = Math.min(items.value.length, start + rowsVisible * gridGeom.value.cols)
  return { start, end }
})

const gridCells = computed(() => items.value.slice(gridWindow.value.start, gridWindow.value.end))

const totalGridHeight = computed(() =>
  gridMode.value ? totalGridRows.value * gridGeom.value.rowStep - GRID_GAP : 0
)

/** 格子绝对定位（top 按整列表行号计算，start 之前的高度由容器总高占位）。 */
function cellStyle(absIndex: number): { left: string; top: string; width: string; height: string } {
  const { cols, cell, rowStep } = gridGeom.value
  const row = Math.floor(absIndex / cols)
  const col = absIndex % cols
  return {
    left: `${col * (cell + GRID_GAP)}px`,
    top: `${row * rowStep}px`,
    width: `${cell}px`,
    height: `${cell}px`
  }
}

/** 格子缩略图源（首图缩略图管线；未就绪渲染占位块）。 */
function cellSrc(memo: Memo): string {
  const slot = firstImageSlot(memo)
  if (!slot) return ''
  const entry = props.store.state.imageThumbs[slot]
  return entry?.status === 'ready' ? entry.small : ''
}

/** 格子悬浮提示：标题 / 备注首行 / OCR 首行。 */
function cellTitle(memo: Memo): string {
  const head =
    memo.title ||
    stripImageTokens(memo.content).split('\n').find((line) => line.trim()) ||
    (memo.ocrText ?? '').split('\n')[0]
  return head.trim() || t('imageMemo')
}

/** 格子点击：选中并全屏查看（敏感遮罩条目只选中，先揭示再看）；
 * 预览面板收起时一并拉出（关掉大图后即回到分栏预览）。 */
function onCellClick(memo: Memo): void {
  props.store.actions.selectMemo(memo.id)
  if (props.store.state.previewMode === 'hidden') props.store.actions.expandPreviewPane()
  if (!(memo.sensitive && !props.store.state.revealSensitive.has(memo.id))) {
    props.store.actions.openLightboxForMemo(memo.id)
  }
}

function onCellContext(e: MouseEvent, memo: Memo): void {
  e.preventDefault()
  props.store.actions.openContextMenu(e.clientX, e.clientY, memo.id)
}

const canDrag = computed(
  () =>
    props.store.state.settings.sortBy === 'manual' &&
    !props.store.state.query.trim() &&
    props.store.state.filter !== 'recent' &&
    !props.store.state.batchMode &&
    !gridMode.value
)

function onScroll(): void {
  scrollTop.value = scroller.value?.scrollTop ?? 0
}

// ---- 行高实测（ResizeObserver）----

const trackRef = ref<HTMLElement | null>(null)

const observer = new ResizeObserver((entries) => {
  for (const entry of entries) onRowResize(entry)
})

/** 容器尺寸观测：视口高（窗口化共用）与内容宽（网格列数计算）。 */
const scrollerObserver = new ResizeObserver(() => {
  const el = scroller.value
  if (!el) return
  viewportH.value = el.clientHeight
  contentW.value = el.clientWidth // 视口无自身边距（宿主 .memo-scroll 的 padding 已把内容区收窄）
})

/**
 * 把当前渲染中的行全部纳入观察：先 disconnect 再 observe，
 * 保证观察集合与 DOM 一致（滚动窗口外的行不残留引用）。
 * RO 负责行高随内容/宽度变化；成员变化由本函数重挂时同步测量。
 */
function syncObservation(): void {
  observer.disconnect()
  const track = trackRef.value
  if (!track) return
  for (const row of track.querySelectorAll<HTMLElement>('.row')) {
    const id = row.dataset.memoId
    if (id) measure(id, row.offsetHeight)
    observer.observe(row)
  }
}

/** 实测回调：视口上方的行高度变化时补偿滚动位置，防止展开/收起上面的条目时内容跳走。 */
function onRowResize(entry: ResizeObserverEntry): void {
  const node = entry.target as HTMLElement
  const id = node.dataset.memoId
  if (!id) return
  const h = node.offsetHeight
  const old = heights.value.get(id)
  if (virtual.value && old !== undefined && Math.abs(h - old) > 0.5) {
    const idx = items.value.findIndex((m) => m.id === id)
    if (idx >= 0 && offsets.value[idx] < scrollTop.value) {
      const el = scroller.value
      if (el) el.scrollTop += h - old
    }
  }
  measure(id, h)
}

onMounted(() => {
  // 覆盖式滚动条接管 .memo-scroll：OS 把子元素包进内部 viewport 并隐藏原生滚动条，
  // scroller 指向该 viewport 后，既有滚动定位/测量/补偿逻辑无需感知差异
  const host = hostEl.value
  if (host) {
    osInstance = OverlayScrollbars(host, {
      overflow: { x: 'hidden' },
      scrollbars: {
        theme: props.store.state.dark ? 'os-theme-light' : 'os-theme-dark',
        autoHide: 'move'
      }
    })
    scroller.value = osInstance.elements().viewport
    scroller.value.addEventListener('scroll', onScroll, { passive: true })
  }
  onScroll()
  viewportH.value = scroller.value?.clientHeight ?? 420
  contentW.value = (scroller.value?.clientWidth ?? 380) - 20
  if (scroller.value) scrollerObserver.observe(scroller.value)
  syncObservation()
})

onBeforeUnmount(() => {
  observer.disconnect()
  scrollerObserver.disconnect()
  scroller.value?.removeEventListener('scroll', onScroll)
  osInstance?.destroy()
  osInstance = null
  scroller.value = null
})

// 渲染集合变化（滚动窗口移动 / 数据变化）后重挂观察集合
watch(
  () => windowed.value.map((m) => m.id).join(','),
  () => syncObservation()
)

// 可见集合统一预取缩略图（列表行与网格格子共用；store 内幂等 + 限流）
watch(
  () => {
    const slice = gridMode.value ? gridCells.value : windowed.value
    return slice.map((m) => m.id).join(',')
  },
  () => {
    const slice = gridMode.value ? gridCells.value : windowed.value
    for (const memo of slice) props.store.actions.ensureThumb(memo)
  },
  { immediate: true }
)

// 展示模式切换后整棵列表高度重建，回到顶部避免停留在半截行；
// 切换分组筛选、进出网格视图同样回到顶部
watch(
  [() => props.store.state.settings.listMode, () => props.store.state.filter, gridMode],
  () => {
    if (scroller.value) scroller.value.scrollTop = 0
    scrollTop.value = 0
  }
)

// 明暗主题切换：覆盖式滚动条跟随换主题（暗底用浅色滑块，亮底用深色滑块）
watch(
  () => props.store.state.dark,
  (dark) => {
    osInstance?.options({ scrollbars: { theme: dark ? 'os-theme-light' : 'os-theme-dark' } })
  }
)

// 键盘选中自动跟随（方向感知）：移动后条目不在视区内时，向下把条目顶到可视区第一条、
// 向上让条目贴底；已完整可见则不滚动。非键盘变更（点击/删除回落等 dir=0）保持最小滚动露出。
// 列表按偏移量定位（行高可变）；网格按行列算术定位
watch(
  () => props.store.computed.selectionIndex.value,
  async (idx) => {
    if (idx < 0 || !scroller.value) return
    const dir = props.store.state.selectionMoveDir
    await nextTick()
    const el = scroller.value
    if (gridMode.value) {
      const { cols, rowStep } = gridGeom.value
      const top = Math.floor(idx / cols) * rowStep
      const bottom = top + rowStep - GRID_GAP
      if (top < el.scrollTop || bottom > el.scrollTop + el.clientHeight) {
        el.scrollTop = dir === -1 ? bottom - el.clientHeight : top
      }
      return
    }
    const top = offsets.value[idx]
    const id = items.value[idx]?.id
    const bottom = top + (id ? (heights.value.get(id) ?? estimate.value) + ROW_GAP : estimate.value)
    const outOfView = top < el.scrollTop || bottom > el.scrollTop + el.clientHeight
    if (!outOfView) return
    if (dir === -1) el.scrollTop = bottom - el.clientHeight
    else if (dir === 1) el.scrollTop = top
    // dir = 0：最小滚动——视口上方贴顶、下方贴底
    else if (top < el.scrollTop) el.scrollTop = top
    else el.scrollTop = bottom - el.clientHeight
  }
)

// ---- 拖拽排序（pointer 实现，避免 HTML5 DnD 在 Electron 下的怪癖） ----

const drag = ref<{ id: string; startIndex: number; currentIndex: number } | null>(null)

function startDrag(e: PointerEvent, memo: Memo, index: number): void {
  if (!canDrag.value) return
  e.preventDefault()
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  drag.value = { id: memo.id, startIndex: index, currentIndex: index }
}

function moveDrag(e: PointerEvent): void {
  const d = drag.value
  if (!d || !scroller.value) return
  const rect = scroller.value.getBoundingClientRect()
  // 拖到视口上下边缘时自动滚动列表（否则长列表里无法把远处的条目拖到位）
  const EDGE = 36
  const relY = e.clientY - rect.top
  if (relY < EDGE) scroller.value.scrollTop -= Math.ceil((EDGE - relY) / 6)
  else if (relY > rect.height - EDGE) scroller.value.scrollTop += Math.ceil((relY - (rect.height - EDGE)) / 6)
  const y = e.clientY - rect.top + scroller.value.scrollTop
  d.currentIndex = Math.max(0, Math.min(items.value.length - 1, findIndexAtOffset(y)))
}

function endDrag(): void {
  const d = drag.value
  drag.value = null
  if (!d || d.currentIndex === d.startIndex) return
  props.store.actions.reorderMemo(d.id, d.currentIndex)
}

function isDragTarget(index: number): boolean {
  return drag.value !== null && drag.value.currentIndex === index && drag.value.startIndex !== index
}

// ---- 空状态 ----

const emptyKind = computed<'none' | 'noresult' | 'ok'>(() => {
  if (items.value.length > 0) return 'ok'
  if (props.store.state.query.trim()) return 'noresult'
  return 'none'
})

const searchQuery = computed(() => props.store.state.query.trim())

function createFromQuery(): void {
  props.store.actions.openEditor({ mode: 'new', content: searchQuery.value, title: '' })
}

async function seedExamples(): Promise<void> {
  props.store.actions.importSeed()
}
</script>

<template>
  <div ref="hostEl" class="memo-scroll" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag">
    <div v-if="emptyKind !== 'ok'" class="empty">
      <template v-if="emptyKind === 'none'">
        <Icon name="bolt" :size="30" />
        <p class="empty-title">{{ t('emptyTitle') }}</p>
        <p class="empty-hint">{{ t('emptyHint') }}</p>
        <div class="empty-actions">
          <button class="sm-btn primary" @click="store.actions.openEditor({ mode: 'new' })">
            {{ t('emptyNew') }}
          </button>
          <button class="sm-btn" @click="seedExamples">{{ t('emptySeed') }}</button>
        </div>
      </template>
      <template v-else-if="emptyKind === 'noresult'">
        <Icon name="search" :size="26" />
        <p class="empty-title">{{ t('noResultTitle') }}</p>
        <button class="sm-btn" @click="createFromQuery">
          {{ t('noResultNew', { query: searchQuery.slice(0, 30) }) }}
        </button>
      </template>
    </div>
    <!-- 网格墙：等尺寸方格（cover 裁切）+ 绝对定位；点击进全屏，右键同列表菜单 -->
    <div
      v-else-if="gridMode"
      class="grid-track"
      :style="{ height: `${totalGridHeight}px` }"
      role="listbox"
      :aria-label="t('a11y.memoList')"
    >
      <div
        v-for="(memo, i) in gridCells"
        :key="memo.id"
        class="grid-cell"
        :class="{ selected: memo.id === store.state.selectionId }"
        :style="cellStyle(gridWindow.start + i)"
        :title="cellTitle(memo)"
        role="option"
        :aria-selected="memo.id === store.state.selectionId"
        @click="onCellClick(memo)"
        @contextmenu="onCellContext($event, memo)"
      >
        <img
          v-if="cellSrc(memo)"
          class="grid-img"
          :class="{ masked: memo.sensitive && !store.state.revealSensitive.has(memo.id) }"
          :src="cellSrc(memo)"
          alt=""
          draggable="false"
        />
        <div v-else class="grid-skeleton" />
      </div>
    </div>
    <div
      v-else
      ref="trackRef"
      class="memo-track"
      :class="{ virtual }"
      :style="virtual ? { height: `${totalHeight}px` } : {}"
      role="listbox"
      :aria-label="t('a11y.memoList')"
    >
      <div
        v-for="(memo, i) in windowed"
        :key="memo.id"
        :data-memo-id="memo.id"
        class="row"
        :class="{ 'is-virtual': virtual, 'drag-target': isDragTarget(range.start + i) }"
        :style="virtual ? { position: 'absolute', top: `${offsets[range.start + i]}px`, left: 0, right: 0 } : {}"
      >
        <MemoItem
          :store="store"
          :memo="memo"
          :index="range.start + i"
          :selected="memo.id === store.state.selectionId"
          :query="store.state.query"
          :drag-enabled="canDrag"
          @dragstart="startDrag($event, memo, range.start + i)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.memo-scroll {
  flex: 1;
  position: relative;
  /* 内容边距必须放在宿主上：OS 初始化时会给视口写内联 padding:0（内联样式压过任何样式表规则），
     而宿主的内联样式 OS 不会改写。边距同时是悬浮滚动条的留白带，滑块落在留白内不压内容。 */
  padding: 8px 10px 10px;
}

/* 全局平滑滚动规则（base.css）的例外：虚拟列表必须瞬时定位——
   行高补偿、键盘跟随、拖拽自动滚动都依赖 scrollTop 同步写入，
   平滑动画会让补偿失效并在快速导航时产生拖影。 */
.memo-scroll :deep(.os-viewport) {
  scroll-behavior: auto;
}

.row {
  margin-bottom: 6px; /* 与 ROW_GAP 常量一致；虚拟模式下由偏移量接管 */
}

.memo-track.virtual {
  position: relative;
}

.memo-track.virtual .row {
  margin-bottom: 0;
}

/* 网格墙轨道与格子 */
.grid-track {
  position: relative;
}

.grid-cell {
  position: absolute;
  border-radius: var(--sm-radius-m);
  border: 1px solid var(--sm-border);
  background: var(--sm-surface-2);
  overflow: hidden;
  cursor: zoom-in;
  box-shadow: var(--sm-shadow-1);
}

.grid-cell.selected {
  border-color: var(--sm-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--sm-accent) 35%, transparent);
}

.grid-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  display: block;
}

.grid-img.masked {
  filter: blur(12px) saturate(0.7);
}

.grid-skeleton {
  width: 100%;
  height: 100%;
  background: var(--sm-surface-2);
  animation: sm-pulse var(--sm-dur-pulse) var(--sm-ease-in-out) infinite;
}

.empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--sm-text-3);
}

.empty-title {
  font-size: var(--sm-font-l);
  color: var(--sm-text-2);
}

.empty-hint {
  font-size: var(--sm-font-s);
}

.empty-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.drag-target {
  border-top: 2px solid var(--sm-accent);
}
</style>
