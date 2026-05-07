<template>
  <div class="ruler-overlay" aria-hidden="true">
    <div class="ruler-corner"></div>
    <canvas class="ruler-h" ref="hCanvasRef"></canvas>
    <canvas class="ruler-v" ref="vCanvasRef"></canvas>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useZtoolsTheme } from 'ztools-ui'

const props = defineProps<{
  scrollEl: HTMLElement | null
  wrapperEl: HTMLElement | null
  zoom: number
}>()

const RULER_SIZE = 24
const TARGET_MAJOR_PX = 80
const STEP_CANDIDATES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]

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

function getRulerColors() {
  const dark = isDark.value
  return {
    accent: getCssVar('--primary-color', '#0284c7', document.body),
    bg: getCssVar('--control-bg', dark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.035)', document.body),
    tick: getCssVar('--text-secondary', dark ? '#bfc0c3' : '#616161', document.body),
    label: getCssVar('--text-secondary', dark ? '#bfc0c3' : '#616161', document.body),
    border: getCssVar('--border-color', dark ? '#374151' : '#e5e7eb', document.body)
  }
}

const hCanvasRef = ref<HTMLCanvasElement | null>(null)
const vCanvasRef = ref<HTMLCanvasElement | null>(null)

let lastClientX = -1
let lastClientY = -1
let cursorActive = false
let resizeObserver: ResizeObserver | null = null
let rafId: number | null = null
let attachedScrollEl: HTMLElement | null = null
let attachedWrapperEl: HTMLElement | null = null

function pickStep(zoom: number) {
  for (const c of STEP_CANDIDATES) {
    if (c * zoom >= TARGET_MAJOR_PX) return c
  }
  return STEP_CANDIDATES[STEP_CANDIDATES.length - 1]
}

function scheduleDraw() {
  if (rafId != null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    draw()
  })
}

function setupCanvas(canvas: HTMLCanvasElement, w: number, h: number) {
  const dpr = window.devicePixelRatio || 1
  const targetW = Math.max(1, Math.floor(w * dpr))
  const targetH = Math.max(1, Math.floor(h * dpr))
  if (canvas.width !== targetW) canvas.width = targetW
  if (canvas.height !== targetH) canvas.height = targetH
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  return ctx
}

function draw() {
  const scroll = props.scrollEl
  const wrapper = props.wrapperEl
  const hCanvas = hCanvasRef.value
  const vCanvas = vCanvasRef.value
  if (!scroll || !wrapper || !hCanvas || !vCanvas) return

  const scrollRect = scroll.getBoundingClientRect()
  const wrapperRect = wrapper.getBoundingClientRect()

  const totalW = scrollRect.width
  const totalH = scrollRect.height
  const rulerW = totalW - RULER_SIZE
  const rulerH = totalH - RULER_SIZE
  if (rulerW <= 0 || rulerH <= 0) return

  // canvas-px 0 in coords local to each ruler canvas (which itself starts at RULER_SIZE on its axis)
  const originHX = wrapperRect.left - scrollRect.left - RULER_SIZE
  const originVY = wrapperRect.top - scrollRect.top - RULER_SIZE

  const z = props.zoom > 0 ? props.zoom : 1
  const step = pickStep(z)
  const minorStep = Math.max(1, step / 5)

  // Cursor canvas-px coords (re-derived each draw so scroll/zoom keep it in sync)
  let cursorX = -1
  let cursorY = -1
  if (cursorActive) {
    cursorX = (lastClientX - wrapperRect.left) / z
    cursorY = (lastClientY - wrapperRect.top) / z
  }

  const ctxH = setupCanvas(hCanvas, rulerW, RULER_SIZE)
  drawHRuler(ctxH, rulerW, originHX, z, step, minorStep, cursorX)

  const ctxV = setupCanvas(vCanvas, RULER_SIZE, rulerH)
  drawVRuler(ctxV, rulerH, originVY, z, step, minorStep, cursorY)
}

function drawHRuler(
  ctx: CanvasRenderingContext2D,
  width: number,
  origin: number,
  zoom: number,
  step: number,
  minorStep: number,
  cursorCanvasX: number
) {
  const colors = getRulerColors()
  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, width, RULER_SIZE)

  ctx.strokeStyle = colors.tick
  ctx.lineWidth = 1
  ctx.beginPath()

  const startCanvas = Math.floor(-origin / zoom / minorStep) * minorStep
  const endCanvas = Math.ceil((width - origin) / zoom / minorStep) * minorStep

  for (let cx = startCanvas; cx <= endCanvas; cx += minorStep) {
    const sx = origin + cx * zoom
    if (sx < -1 || sx > width + 1) continue
    const isMajor = Math.abs(cx % step) < 0.0001 || Math.abs((cx % step) - step) < 0.0001
    const tickLen = isMajor ? 10 : 4
    const x = Math.round(sx) + 0.5
    ctx.moveTo(x, RULER_SIZE - tickLen)
    ctx.lineTo(x, RULER_SIZE)
  }
  ctx.stroke()

  // Major labels
  ctx.fillStyle = colors.label
  ctx.font = '10px ui-sans-serif, system-ui, -apple-system, sans-serif'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  const firstMajor = Math.ceil(startCanvas / step) * step
  for (let cx = firstMajor; cx <= endCanvas; cx += step) {
    const sx = origin + cx * zoom
    if (sx < -30 || sx > width + 30) continue
    ctx.fillText(String(Math.round(cx)), Math.round(sx) + 2, 2)
  }

  // Bottom border
  ctx.strokeStyle = colors.border
  ctx.beginPath()
  ctx.moveTo(0, RULER_SIZE - 0.5)
  ctx.lineTo(width, RULER_SIZE - 0.5)
  ctx.stroke()

  // Indicator
  if (cursorCanvasX !== -1) {
    const sx = origin + cursorCanvasX * zoom
    if (sx >= 0 && sx <= width) {
      ctx.fillStyle = colors.accent
      ctx.fillRect(Math.round(sx), 0, 1, RULER_SIZE)
    }
  }
}

function drawVRuler(
  ctx: CanvasRenderingContext2D,
  height: number,
  origin: number,
  zoom: number,
  step: number,
  minorStep: number,
  cursorCanvasY: number
) {
  const colors = getRulerColors()
  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, RULER_SIZE, height)

  ctx.strokeStyle = colors.tick
  ctx.lineWidth = 1
  ctx.beginPath()

  const startCanvas = Math.floor(-origin / zoom / minorStep) * minorStep
  const endCanvas = Math.ceil((height - origin) / zoom / minorStep) * minorStep

  for (let cy = startCanvas; cy <= endCanvas; cy += minorStep) {
    const sy = origin + cy * zoom
    if (sy < -1 || sy > height + 1) continue
    const isMajor = Math.abs(cy % step) < 0.0001 || Math.abs((cy % step) - step) < 0.0001
    const tickLen = isMajor ? 10 : 4
    const y = Math.round(sy) + 0.5
    ctx.moveTo(RULER_SIZE - tickLen, y)
    ctx.lineTo(RULER_SIZE, y)
  }
  ctx.stroke()

  // Major labels (rotated -90deg)
  ctx.fillStyle = colors.label
  ctx.font = '10px ui-sans-serif, system-ui, -apple-system, sans-serif'
  const firstMajor = Math.ceil(startCanvas / step) * step
  for (let cy = firstMajor; cy <= endCanvas; cy += step) {
    const sy = origin + cy * zoom
    if (sy < -30 || sy > height + 30) continue
    ctx.save()
    ctx.translate(2, Math.round(sy) + 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textBaseline = 'top'
    ctx.textAlign = 'right'
    ctx.fillText(String(Math.round(cy)), 0, 0)
    ctx.restore()
  }

  // Right border
  ctx.strokeStyle = colors.border
  ctx.beginPath()
  ctx.moveTo(RULER_SIZE - 0.5, 0)
  ctx.lineTo(RULER_SIZE - 0.5, height)
  ctx.stroke()

  // Indicator
  if (cursorCanvasY !== -1) {
    const sy = origin + cursorCanvasY * zoom
    if (sy >= 0 && sy <= height) {
      ctx.fillStyle = colors.accent
      ctx.fillRect(0, Math.round(sy), RULER_SIZE, 1)
    }
  }
}

function onMouseMove(e: MouseEvent) {
  lastClientX = e.clientX
  lastClientY = e.clientY
  cursorActive = true
  scheduleDraw()
}

function onMouseLeave() {
  cursorActive = false
  scheduleDraw()
}

function attach() {
  detach()
  const scroll = props.scrollEl
  const wrapper = props.wrapperEl
  if (!scroll) return
  scroll.addEventListener('scroll', scheduleDraw, { passive: true })
  scroll.addEventListener('mousemove', onMouseMove)
  scroll.addEventListener('mouseleave', onMouseLeave)
  attachedScrollEl = scroll
  attachedWrapperEl = wrapper
  resizeObserver = new ResizeObserver(scheduleDraw)
  resizeObserver.observe(scroll)
  if (wrapper) resizeObserver.observe(wrapper)
  window.addEventListener('resize', scheduleDraw)
  scheduleDraw()
}

function detach() {
  if (attachedScrollEl) {
    attachedScrollEl.removeEventListener('scroll', scheduleDraw)
    attachedScrollEl.removeEventListener('mousemove', onMouseMove)
    attachedScrollEl.removeEventListener('mouseleave', onMouseLeave)
    attachedScrollEl = null
  }
  attachedWrapperEl = null
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', scheduleDraw)
  if (rafId != null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

watch(
  () => [props.scrollEl, props.wrapperEl] as const,
  async () => {
    await nextTick()
    attach()
  },
  { immediate: true, flush: 'post' }
)

watch(() => [props.zoom, isDark.value, primaryColor.value, customColor.value], scheduleDraw)

onBeforeUnmount(detach)
</script>

<style scoped>
.ruler-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}
.ruler-corner {
  position: absolute;
  top: 0;
  left: 0;
  width: 24px;
  height: 24px;
  background: var(--control-bg, rgba(0, 0, 0, 0.035));
  border-right: 1px solid var(--border-color, #e5e7eb);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  box-sizing: border-box;
}
.ruler-h {
  position: absolute;
  top: 0;
  left: 24px;
  right: 0;
  height: 24px;
  display: block;
}
.ruler-v {
  position: absolute;
  top: 24px;
  left: 0;
  bottom: 0;
  width: 24px;
  display: block;
}
</style>
