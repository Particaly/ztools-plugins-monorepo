import { Point } from 'fabric'
import type { Canvas } from 'fabric'
import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import type { EditorModule } from '../../runtime/editorTypes'

export type PenPoint = { x: number; y: number }

type CanvasAssistColors = {
  primary: string
  primarySoft: string
  primaryOverlay: string
  primaryStrong: string
  textOnPrimary: string
  neutralSurface?: string
  neutralBorder?: string
}

type CanvasPointerEventLike = {
  viewportPoint?: Point
  scenePoint?: Point
  e: MouseEvent | TouchEvent
}

// 落点基础半径（视口像素）。
const POINT_RADIUS_BASE = 4
// 鼠标靠近时的目标半径（视口像素）。
const POINT_RADIUS_HOVERED = 8
// 每帧缓动系数（0~1，越大收敛越快）。
const HOVER_EASE_FACTOR = 0.25
// 收敛判定阈值，低于该值即停止缓动循环，避免长时间空转重绘。
const HOVER_SETTLE_EPSILON = 0.01
// 判定「点击首点闭合」的视口像素容差。
const CLOSE_THRESHOLD_VIEWPORT = 10
// 判定双击的间隔（毫秒）。
const DBLCLICK_INTERVAL_MS = 300
// 判定双击的视口像素位移容差。
const DBLCLICK_DISTANCE_VIEWPORT = 5
// 悬停判定半径（视口像素）。
const HOVER_RADIUS_VIEWPORT = 10
// 连续重复点去重阈值（场景单位）。
const DUPLICATE_THRESHOLD_SCENE = 0.5

export interface HomePenToolState {
  penToolActive: Ref<boolean>
  penPoints: ShallowRef<PenPoint[]>
  penHoverIndex: Ref<number | null>
  penRenderTick: Ref<number>
}

export interface HomePenToolCommands {
  activate: () => void
  deactivate: (commit?: boolean) => void
  handlePenLeftDown: (scenePoint: PenPoint) => void
  handlePenRightClick: () => void
  handlePenPointerMove: (event: CanvasPointerEventLike) => void
  drawPenOverlay: () => void
}

export interface HomePenToolController {
  commands: HomePenToolCommands
  state: HomePenToolState
}

export interface CreateHomePenToolModuleOptions {
  getFabricCanvas: () => Canvas | null
  getCanvasAssistColors: () => CanvasAssistColors
  getZoom: () => number
  snapScenePoint: (point: Point) => Point
  addPenPathObject: (points: PenPoint[], closed: boolean) => void
  discardActiveObject: () => void
}

export interface CreateHomePenToolModuleResult {
  controller: HomePenToolController
  module: EditorModule
}

/**
 * 创建钢笔描点工具模块，集中维护描点过程中的已落点、悬停态与覆盖层绘制。
 * 模块只持有状态机和绘制逻辑；落点吸附、生成图形对象、清除活动选区等副作用通过注入的回调回到页面层。
 */
export function createHomePenToolModule(
  options: CreateHomePenToolModuleOptions
): CreateHomePenToolModuleResult {
  const penToolActive = ref(false)
  const penPoints = shallowRef<PenPoint[]>([])
  const penHoverIndex = ref<number | null>(null)
  const penRenderTick = ref(0)

  // 每个已落点当前的缓动半径（视口像素），与 penPoints 一一对应。
  let hoverRadiusByIndex: number[] = []
  // 橡皮筋预览端点（场景坐标），mouse:move 持续更新；为空时不绘制预览线。
  let liveCursorScenePoint: PenPoint | null = null
  // 双击计时的上次 left-down 时刻与场景坐标。
  let lastDownTime = 0
  let lastDownScenePoint: PenPoint | null = null
  // 缓动循环的 rAF 句柄，无待收敛半径时为 0。
  let hoverEaseHandle = 0

  /**
   * 递增覆盖层渲染版本号并触发 Fabric 重绘，驱动 drawPenOverlay 重新执行。
   */
  function bumpPenRender() {
    penRenderTick.value = (penRenderTick.value + 1) | 0
    options.getFabricCanvas()?.requestRenderAll()
  }

  /**
   * 计算两个场景点之间的欧氏距离。
   */
  function distance(a: PenPoint, b: PenPoint) {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  /**
   * 把场景点转换为视口坐标（Fabric 内部 viewportTransform 为纯 scale，平移走 CSS transform 不影响 top context）。
   */
  function sceneToViewport(point: PenPoint) {
    const zoom = options.getZoom()
    return { x: point.x * zoom, y: point.y * zoom }
  }

  /**
   * 落点吸附到当前像素网格后返回场景坐标；未开启吸附时由注入回调原样返回。
   */
  function snapPoint(point: PenPoint) {
    const snapped = options.snapScenePoint(new Point(point.x, point.y))
    return { x: snapped.x, y: snapped.y }
  }

  /**
   * 启动/保持悬停半径缓动循环，直到所有点半径收敛后自动停止，避免空闲时持续重绘。
   */
  function scheduleHoverEaseLoop() {
    if (hoverEaseHandle) return
    const tick = () => {
      hoverEaseHandle = 0
      const points = penPoints.value
      let pending = false
      for (let i = 0; i < points.length; i++) {
        const target = i === penHoverIndex.value ? POINT_RADIUS_HOVERED : POINT_RADIUS_BASE
        const current = hoverRadiusByIndex[i] ?? POINT_RADIUS_BASE
        const next = current + (target - current) * HOVER_EASE_FACTOR
        hoverRadiusByIndex[i] = next
        if (Math.abs(target - next) > HOVER_SETTLE_EPSILON) pending = true
      }
      bumpPenRender()
      if (pending) {
        hoverEaseHandle = requestAnimationFrame(tick)
      }
    }
    hoverEaseHandle = requestAnimationFrame(tick)
  }

  /**
   * 清空描点过程中的所有状态，用于提交/退出/销毁时统一复位。
   */
  function resetPenState() {
    penPoints.value = []
    hoverRadiusByIndex = []
    penHoverIndex.value = null
    liveCursorScenePoint = null
    lastDownTime = 0
    lastDownScenePoint = null
    if (hoverEaseHandle) {
      cancelAnimationFrame(hoverEaseHandle)
      hoverEaseHandle = 0
    }
  }

  /**
   * 提交当前描点结果为图形对象（>=2 点时）后退出钢笔态；closed 控制闭合多边形/开放折线。
   */
  function commitAndExit(closed: boolean) {
    const points = [...penPoints.value]
    const hasPoints = points.length >= 2
    resetPenState()
    penToolActive.value = false
    if (hasPoints) {
      options.addPenPathObject(points, closed)
    }
    bumpPenRender()
  }

  /**
   * 激活钢笔工具（已激活则切换回普通态）；激活时清除当前活动选区，避免选中态干扰描点。
   */
  function activate() {
    if (penToolActive.value) {
      deactivate(false)
      return
    }
    resetPenState()
    penToolActive.value = true
    options.discardActiveObject()
    bumpPenRender()
  }

  /**
   * 退出钢笔工具；commit 为 true 且点数足够时把描点结果生成为图形对象。
   */
  function deactivate(commit = true) {
    if (!penToolActive.value) return
    if (commit) {
      commitAndExit(false)
    } else {
      resetPenState()
      penToolActive.value = false
      bumpPenRender()
    }
  }

  /**
   * 处理左键落点：先判双击提交，再判点击首点闭合，去重后追加新点。
   */
  function handlePenLeftDown(scenePoint: PenPoint) {
    if (!penToolActive.value) return
    const now = Date.now()
    const points = penPoints.value

    // ── 双击判定 ──：距上次 left-down 时间与位移均在阈值内且落在已落点上 → 提交并退出。
    if (lastDownTime && lastDownScenePoint && now - lastDownTime <= DBLCLICK_INTERVAL_MS) {
      const zoom = options.getZoom()
      const dx = (scenePoint.x - lastDownScenePoint.x) * zoom
      const dy = (scenePoint.y - lastDownScenePoint.y) * zoom
      if (Math.hypot(dx, dy) <= DBLCLICK_DISTANCE_VIEWPORT && points.length >= 2) {
        lastDownTime = 0
        lastDownScenePoint = null
        commitAndExit(false)
        return
      }
    }

    const snapped = snapPoint(scenePoint)

    // ── 点击首点闭合 ──：已有 >=3 点且落在首点容差内 → 闭合多边形并退出。
    if (points.length >= 3) {
      const zoom = options.getZoom()
      const closeThreshold = CLOSE_THRESHOLD_VIEWPORT / zoom
      if (distance(snapped, points[0]) <= closeThreshold) {
        lastDownTime = 0
        lastDownScenePoint = null
        commitAndExit(true)
        return
      }
    }

    // ── 去重 ──：与上一点过近则跳过，避免退化几何。
    const last = points[points.length - 1]
    if (last && distance(snapped, last) < DUPLICATE_THRESHOLD_SCENE) {
      lastDownTime = now
      lastDownScenePoint = snapped
      bumpPenRender()
      return
    }

    points.push(snapped)
    penPoints.value = [...points]
    hoverRadiusByIndex.push(POINT_RADIUS_BASE)
    lastDownTime = now
    lastDownScenePoint = snapped
    bumpPenRender()
  }

  /**
   * 右键撤销最后一个落点；空数组时为 no-op，不退出钢笔态。
   */
  function handlePenRightClick() {
    if (!penToolActive.value) return
    const points = penPoints.value
    if (!points.length) return
    points.pop()
    penPoints.value = [...points]
    hoverRadiusByIndex.length = points.length
    penHoverIndex.value = null
    lastDownTime = 0
    lastDownScenePoint = null
    bumpPenRender()
  }

  /**
   * 处理画布 mouse:move：更新橡皮筋预览端点与悬停命中点，半径变化时驱动缓动循环。
   */
  function handlePenPointerMove(event: CanvasPointerEventLike) {
    if (!penToolActive.value) return
    const fabricCanvas = options.getFabricCanvas()
    if (!fabricCanvas) return
    const scene = event.scenePoint ?? fabricCanvas.getScenePoint(event.e as MouseEvent)
    liveCursorScenePoint = { x: scene.x, y: scene.y }

    const points = penPoints.value
    const zoom = options.getZoom()
    const hoverRadiusScene = HOVER_RADIUS_VIEWPORT / zoom
    let nearestIndex: number | null = null
    let nearestDistance = hoverRadiusScene
    for (let i = 0; i < points.length; i++) {
      const d = distance(liveCursorScenePoint, points[i])
      if (d <= nearestDistance) {
        nearestDistance = d
        nearestIndex = i
      }
    }
    const changed = nearestIndex !== penHoverIndex.value
    penHoverIndex.value = nearestIndex
    bumpPenRender()
    if (changed && points.length) scheduleHoverEaseLoop()
  }

  /**
   * 在 Fabric 顶层 canvas 上绘制描点覆盖层：连线、橡皮筋预览、各落点圆圈（悬停点放大）。
   */
  function drawPenOverlay() {
    const fabricCanvas = options.getFabricCanvas()
    if (!fabricCanvas || !penToolActive.value) return
    const ctx = (fabricCanvas as any).getTopContext?.() ?? (fabricCanvas as any).contextTop
    if (!ctx) return
    const points = penPoints.value
    if (!points.length) return
    void penRenderTick.value
    const colors = options.getCanvasAssistColors()
    const zoom = options.getZoom()
    const viewports = points.map(sceneToViewport)

    ctx.save()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    // ── 已落点连线（实线） ──
    if (viewports.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(viewports[0].x, viewports[0].y)
      for (let i = 1; i < viewports.length; i++) {
        ctx.lineTo(viewports[i].x, viewports[i].y)
      }
      ctx.strokeStyle = colors.primary
      ctx.lineWidth = Math.max(1, 2 * Math.min(zoom, 1.5))
      ctx.stroke()
    }

    // ── 末点到光标的橡皮筋预览（虚线） ──
    if (liveCursorScenePoint) {
      const last = viewports[viewports.length - 1]
      const cursor = sceneToViewport(liveCursorScenePoint)
      ctx.beginPath()
      ctx.moveTo(last.x, last.y)
      ctx.lineTo(cursor.x, cursor.y)
      ctx.setLineDash([4, 3])
      ctx.strokeStyle = colors.primaryStrong
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.setLineDash([])
    }

    // ── 各落点圆圈 ──：悬停命中点用缓动半径放大；>=3 点且光标在首点容差内时高亮首点提示可闭合。
    const closeThreshold = CLOSE_THRESHOLD_VIEWPORT
    const canClose =
      points.length >= 3
      && !!liveCursorScenePoint
      && distance(sceneToViewport(liveCursorScenePoint), viewports[0]) <= closeThreshold
    for (let i = 0; i < viewports.length; i++) {
      const isFirst = i === 0
      const radius = isFirst && canClose ? POINT_RADIUS_HOVERED : (hoverRadiusByIndex[i] ?? POINT_RADIUS_BASE)
      ctx.beginPath()
      ctx.arc(viewports[i].x, viewports[i].y, radius, 0, Math.PI * 2)
      ctx.fillStyle = isFirst && canClose ? colors.primaryStrong : colors.primary
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = colors.primary
      ctx.stroke()
      // 中心小白点增强可读性（参考 renderPointControl 的已提交样式）。
      ctx.beginPath()
      ctx.arc(viewports[i].x, viewports[i].y, Math.max(1, radius - 2.5), 0, Math.PI * 2)
      ctx.fillStyle = colors.textOnPrimary
      ctx.fill()
    }

    ctx.restore()
  }

  const controller: HomePenToolController = {
    commands: {
      activate,
      deactivate,
      handlePenLeftDown,
      handlePenRightClick,
      handlePenPointerMove,
      drawPenOverlay
    },
    state: {
      penToolActive,
      penPoints,
      penHoverIndex,
      penRenderTick
    }
  }

  const module: EditorModule = {
    name: 'home-pen-tool',
    onDispose() {
      resetPenState()
      penToolActive.value = false
    }
  }

  return { controller, module }
}
