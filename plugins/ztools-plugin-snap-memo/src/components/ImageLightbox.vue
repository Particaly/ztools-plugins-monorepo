<script setup lang="ts">
/**
 * 图片全屏浮层：暗色背景 + 居中大图；滚轮以光标为锚点缩放（光标下的内容不漂移）、
 * 拖拽平移、双击复位；←/→ 或左右按钮在当前列表的图片条目间循环切换；
 * 右下角缩放百分比徽标（点击复位）；点击背景关闭；
 * Esc 与方向键由 App 全局键盘路由处理（浮层打开时屏蔽其余快捷键）。
 */
import { computed, ref, watch } from 'vue'
import type { AppStore } from '../store/appStore'
import { allImageSlots } from '../core/inlineImage'
import Icon from './Icon.vue'
import { t } from '../i18n/zh-CN'

const props = defineProps<{ store: AppStore }>()

const current = computed(() => props.store.state.lightbox)

/** 全尺寸展示 URL（Blob URL，store 内 LRU 缓存）。 */
const url = computed(() => (current.value ? props.store.actions.memoImageDisplay(current.value.imageId) : ''))

/** 当前可见列表的全部图片（跨条目、含混排行内图，翻页顺序）。 */
const imageList = computed(() =>
  props.store.computed.visibleMemos.value.flatMap((m) => allImageSlots(m).map((imageId) => ({ memoId: m.id, imageId })))
)

const counterText = computed(() => {
  const total = imageList.value.length
  if (!current.value || total <= 1) return ''
  const idx = imageList.value.findIndex((x) => x.imageId === current.value?.imageId)
  return t('image.counter', { current: idx === -1 ? '?' : idx + 1, total })
})

const scale = ref(1)
const tx = ref(0)
const ty = ref(0)
const dragging = ref(false)
const loaded = ref(false)
let dragFrom = { x: 0, y: 0, tx: 0, ty: 0 }

const rootRef = ref<HTMLElement | null>(null)

/** 翻页后复位缩放/平移与淡入状态（新图从初始视图开始）。 */
watch(
  () => current.value?.imageId,
  () => {
    reset()
    loaded.value = false
  }
)

function reset(): void {
  scale.value = 1
  tx.value = 0
  ty.value = 0
}

/** 点击背景或图片关闭浮层（拖拽平移后的点击不关闭）。 */
function close(): void {
  reset()
  props.store.actions.closeLightbox()
}

/** 滚轮缩放：以光标为锚点（缩放前后光标指向的图像内容保持不动）。 */
function onWheel(e: WheelEvent): void {
  e.preventDefault()
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
  const next = Math.min(8, Math.max(0.2, scale.value * factor))
  if (next === scale.value) return
  const rect = rootRef.value?.getBoundingClientRect()
  // 相对视口中心的光标偏移（transform 的 translate 以元素中心为原点）
  const cx = e.clientX - ((rect?.left ?? 0) + (rect?.width ?? 0) / 2)
  const cy = e.clientY - ((rect?.top ?? 0) + (rect?.height ?? 0) / 2)
  const px = (cx - tx.value) / scale.value
  const py = (cy - ty.value) / scale.value
  scale.value = next
  tx.value = cx - px * next
  ty.value = cy - py * next
}

function onPointerDown(e: PointerEvent): void {
  dragging.value = true
  dragFrom = { x: e.clientX, y: e.clientY, tx: tx.value, ty: ty.value }
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging.value) return
  tx.value = dragFrom.tx + (e.clientX - dragFrom.x)
  ty.value = dragFrom.ty + (e.clientY - dragFrom.y)
}

function onPointerUp(): void {
  dragging.value = false
}

function step(delta: 1 | -1): void {
  props.store.actions.stepLightbox(delta)
}

const transformStyle = computed(() => ({
  transform: `translate(${tx.value}px, ${ty.value}px) scale(${scale.value})`
}))
</script>

<template>
  <div
    v-if="current"
    ref="rootRef"
    class="lightbox"
    role="dialog"
    :aria-label="t('image.lightboxClose')"
    @click="close"
    @wheel="onWheel"
  >
    <img
      :src="url"
      :class="{ loaded }"
      alt=""
      draggable="false"
      :style="transformStyle"
      @load="loaded = true"
      @click.stop
      @dblclick="reset"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    />
    <template v-if="imageList.length > 1">
      <button class="nav prev" :title="t('image.prevImage')" :aria-label="t('image.prevImage')" @click.stop="step(-1)">
        <Icon name="chevron-left" :size="18" />
      </button>
      <button class="nav next" :title="t('image.nextImage')" :aria-label="t('image.nextImage')" @click.stop="step(1)">
        <Icon name="chevron-right" :size="18" />
      </button>
      <span class="counter" @click.stop>{{ counterText }}</span>
    </template>
    <button class="zoom-badge" :title="t('image.resetZoom')" @click.stop="reset">{{ Math.round(scale * 100) }}%</button>
    <span class="zoom-hint">{{ t('image.zoomHint') }}</span>
  </div>
</template>

<style scoped>
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 220; /* 高于悬浮快览(200) 与 ToastHost(60) */
  background: rgba(10, 13, 20, 0.84);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
  overflow: hidden;
}

.lightbox img {
  max-width: min(96vw, 1200px);
  max-height: 92vh;
  border-radius: var(--sm-radius-m);
  box-shadow: var(--sm-shadow-2);
  cursor: grab;
  transition: transform 0.05s linear, opacity 0.15s ease;
  touch-action: none;
  opacity: 0;
}

.lightbox img.loaded {
  opacity: 1;
}

.lightbox img:active {
  cursor: grabbing;
}

.nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  cursor: pointer;
  transition: background 0.12s ease;
}

.nav:hover {
  background: rgba(255, 255, 255, 0.26);
}

.nav.prev {
  left: 14px;
}

.nav.next {
  right: 14px;
}

.counter {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.75);
  background: rgba(15, 19, 28, 0.5);
  padding: 2px 10px;
  border-radius: 10px;
  pointer-events: none;
}

.zoom-badge {
  position: absolute;
  right: 14px;
  bottom: 10px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.8);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  padding: 5px 9px;
  cursor: pointer;
}

.zoom-badge:hover {
  background: rgba(255, 255, 255, 0.26);
}

.zoom-hint {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  pointer-events: none;
}
</style>
