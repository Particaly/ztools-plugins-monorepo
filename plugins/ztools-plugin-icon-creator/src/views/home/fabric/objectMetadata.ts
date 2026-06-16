import { Gradient, type FabricObject } from 'fabric'

export type AnyFabricObject = FabricObject & Record<string, any>
export type FillMode = 'solid' | 'gradient'
export type FillGradientType = 'linear' | 'radial'
export type FillGradientStop = {
  color: string
  offset: number
}

export type FillGradientMetadata = {
  fillMode?: FillMode
  fillGradientType?: FillGradientType
  fillGradientStops?: FillGradientStop[]
  fillGradientAngle?: number
  fillGradientCenterX?: number
  fillGradientCenterY?: number
  fillGradientRadius?: number
}

export type KaleidoscopeMetadata = {
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

export type EndpointSnapMarginMetadata = {
  endpointSnapMargin?: number
}

export type SizeRatioLockMetadata = {
  sizeRatioLocked?: boolean
}

export type ShadowEffectItem = {
  id: string
  enabled: boolean
  type: 'drop' | 'inner'
  offsetX: number
  offsetY: number
  blur: number
  spread: number
  color: string
}

export type ShadowEffectsMetadata = {
  shadowEffects?: ShadowEffectItem[]
  blurEnabled?: boolean
  blurRadius?: number
}

export type Rotation3DMetadata = {
  // 绕画布平面内 X / Y 轴的立体旋转角（角度制）。绕 Z 轴的旋转沿用 Fabric 原生的 angle。
  rotateX?: number
  rotateY?: number
  rotateZ?: number // 存储用户设置的原始 Z 轴旋转角度，避免投影角度污染
  // 立体旋转前对象自身的缩放，用于让立体旋转与普通缩放可以叠加而互不破坏。
  rotation3dBaseScaleX?: number
  rotation3dBaseScaleY?: number
}

export const DEFAULT_KALEIDOSCOPE_COUNT = 6
export const MIN_KALEIDOSCOPE_COUNT = 1
export const MAX_KALEIDOSCOPE_COUNT = 36
export const EDITOR_OBJECT_ID_PREFIX = 'editor-object-'
export const DEFAULT_FILL_MODE: FillMode = 'solid'
export const DEFAULT_FILL_GRADIENT_TYPE: FillGradientType = 'linear'
export const DEFAULT_FILL_GRADIENT_ANGLE = 0
export const DEFAULT_FILL_GRADIENT_CENTER = 0.5
export const DEFAULT_FILL_GRADIENT_RADIUS = 0.5

export const SERIALIZED_OBJECT_PROPS = [
  'name',
  'strokeUniform',
  'lastFill',
  'lastStroke',
  'lastStrokeWidth',
  'lastStrokeDashArray',
  'shapeId',
  'arrowRenderMode',
  'arrowLineWidth',
  'arrowTipAngle',
  'arrowSideAngle',
  'editorObjectId',
  'endpointAttachments',
  'endpointSnapMargin',
  'booleanEligible',
  'fillRule',
  'editablePath',
  'cornerRadius',
  'cornerRadiusOverrides',
  'editablePathVersion',
  'fillMode',
  'fillGradientType',
  'fillGradientStops',
  'fillGradientAngle',
  'fillGradientCenterX',
  'fillGradientCenterY',
  'fillGradientRadius',
  'kaleidoscopeEnabled',
  'kaleidoscopeCenterX',
  'kaleidoscopeCenterY',
  'kaleidoscopeFollowRotation',
  'kaleidoscopeCount',
  'kaleidoscopeSourceId',
  'kaleidoscopeManaged',
  'kaleidoscopeInstanceOf',
  'kaleidoscopeInstanceIndex',
  'sizeRatioLocked',
  'shadowEffects',
  'blurEnabled',
  'blurRadius',
  'rotateX',
  'rotateY',
  'rotation3dBaseScaleX',
  'rotation3dBaseScaleY'
] as const

function cloneGradientStops(stops: FillGradientStop[]) {
  return stops.map((stop) => ({
    color: stop.color,
    offset: stop.offset
  }))
}

function normalizeGradientColor(value: unknown, fallback = '#000000') {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function normalizeGradientOffset(value: unknown, fallback = 0) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(1, Math.max(0, parsed))
}

function createDefaultGradientStops(color = '#000000') {
  const normalized = normalizeGradientColor(color)
  return [
    { color: normalized, offset: 0 },
    { color: normalized, offset: 1 }
  ]
}

export function getNormalizedGradientOffsetSlots(value: unknown, fallbackColor = '#000000') {
  const stops = Array.isArray(value)
    ? value
        .map((item, index) => {
          if (!item || typeof item !== 'object') return null
          const stop = item as Record<string, unknown>
          return {
            color: normalizeGradientColor(stop.color, fallbackColor),
            offset: normalizeGradientOffset(stop.offset, index === 0 ? 0 : 1)
          }
        })
        .filter((item): item is FillGradientStop => !!item)
        .sort((a, b) => a.offset - b.offset)
    : []
  if (!stops.length) return createDefaultGradientStops(fallbackColor).map((stop) => stop.offset)
  if (stops.length === 1) return [0, 1]
  const offsets = stops.map((stop) => stop.offset)
  offsets[0] = 0
  offsets[offsets.length - 1] = 1
  return offsets
}

function normalizeGradientStops(value: unknown, fallbackColor = '#000000') {
  if (!Array.isArray(value)) return createDefaultGradientStops(fallbackColor)
  const offsets = getNormalizedGradientOffsetSlots(value, fallbackColor)
  const normalized = value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const stop = item as Record<string, unknown>
      return {
        color: normalizeGradientColor(stop.color, fallbackColor),
        offset: normalizeGradientOffset(stop.offset, index === 0 ? 0 : 1)
      }
    })
    .filter((item): item is FillGradientStop => !!item)
    .sort((a, b) => a.offset - b.offset)
  if (!normalized.length) return createDefaultGradientStops(fallbackColor)
  if (normalized.length === 1) {
    const [only] = normalized
    return [
      { color: only.color, offset: 0 },
      { color: only.color, offset: 1 }
    ]
  }
  return normalized.map((stop, index) => ({
    ...stop,
    offset: offsets[index] ?? stop.offset
  }))
}

function normalizeFillMode(value: unknown, fallback: FillMode = DEFAULT_FILL_MODE): FillMode {
  return value === 'gradient' || value === 'solid' ? value : fallback
}

function normalizeFillGradientType(value: unknown, fallback: FillGradientType = DEFAULT_FILL_GRADIENT_TYPE): FillGradientType {
  return value === 'radial' || value === 'linear' ? value : fallback
}

function normalizeAngle(value: unknown, fallback = DEFAULT_FILL_GRADIENT_ANGLE) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const normalized = parsed % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function normalizeUnitInterval(value: unknown, fallback = DEFAULT_FILL_GRADIENT_CENTER) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(1, Math.max(0, parsed))
}

function normalizeRadius(value: unknown, fallback = DEFAULT_FILL_GRADIENT_RADIUS) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(2, Math.max(0.05, parsed))
}

function getGradientObjectDimensions(obj: FabricObject | null | undefined) {
  const width = Number(obj?.width)
  const height = Number(obj?.height)
  return {
    width: Math.max(1, Number.isFinite(width) ? width : 1),
    height: Math.max(1, Number.isFinite(height) ? height : 1)
  }
}

function getGradientDisplayDimensions(obj: FabricObject | null | undefined) {
  const scaledWidth = Number(obj?.getScaledWidth?.())
  const scaledHeight = Number(obj?.getScaledHeight?.())
  return {
    width: Math.max(1, Number.isFinite(scaledWidth) ? scaledWidth : getGradientObjectDimensions(obj).width),
    height: Math.max(1, Number.isFinite(scaledHeight) ? scaledHeight : getGradientObjectDimensions(obj).height)
  }
}

function getGradientRadiusBasis(obj: FabricObject | null | undefined) {
  const { width, height } = getGradientDisplayDimensions(obj)
  return Math.max(1, Math.hypot(width, height))
}

function isGradientLikeFill(value: unknown): value is {
  type?: unknown
  coords?: Record<string, unknown>
  colorStops?: unknown
  gradientUnits?: unknown
} {
  return !!value && typeof value === 'object' && 'type' in value && 'colorStops' in value && 'coords' in value
}

function extractGradientType(fill: unknown): FillGradientType | null {
  if (!isGradientLikeFill(fill)) return null
  return fill.type === 'radial' ? 'radial' : fill.type === 'linear' ? 'linear' : null
}

function extractGradientStops(fill: unknown) {
  if (!isGradientLikeFill(fill)) return null
  return Array.isArray(fill.colorStops) ? fill.colorStops : null
}

function extractGradientAngle(fill: unknown) {
  if (!isGradientLikeFill(fill) || fill.type !== 'linear') return null
  const coords = fill.coords ?? {}
  const x1 = Number(coords.x1)
  const y1 = Number(coords.y1)
  const x2 = Number(coords.x2)
  const y2 = Number(coords.y2)
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null
  return Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI
}

function extractGradientCenter(fill: unknown, obj: FabricObject | null | undefined) {
  if (!isGradientLikeFill(fill) || fill.type !== 'radial') return null
  const coords = fill.coords ?? {}
  const x = Number(coords.x2)
  const y = Number(coords.y2)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  if (fill.gradientUnits === 'percentage') return { x, y }
  const { width, height } = getGradientObjectDimensions(obj)
  return {
    x: x / width,
    y: y / height
  }
}

function extractGradientRadius(fill: unknown, obj: FabricObject | null | undefined) {
  if (!isGradientLikeFill(fill) || fill.type !== 'radial') return null
  const coords = fill.coords ?? {}
  const radius = Number(coords.r2)
  if (!Number.isFinite(radius)) return null
  if (fill.gradientUnits === 'percentage') return radius
  return radius / getGradientRadiusBasis(obj)
}

export function normalizeFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function normalizeKaleidoscopeCount(value: unknown) {
  const parsed = Math.round(Number(value))
  if (!Number.isFinite(parsed)) return DEFAULT_KALEIDOSCOPE_COUNT
  return Math.min(MAX_KALEIDOSCOPE_COUNT, Math.max(MIN_KALEIDOSCOPE_COUNT, parsed))
}

export function getFillGradientMetadata(obj: FabricObject | null | undefined) {
  return obj ? (obj as AnyFabricObject & FillGradientMetadata) : null
}

export function applyDefaultFillGradientMetadata(obj: FabricObject | null | undefined) {
  const target = getFillGradientMetadata(obj)
  if (!target) return
  const fallbackColor = typeof target.lastFill === 'string' && target.lastFill.trim()
    ? target.lastFill
    : '#000000'
  const fillType = extractGradientType(target.fill)
  const fillModeFallback: FillMode = fillType ? 'gradient' : DEFAULT_FILL_MODE
  target.fillMode = normalizeFillMode(target.fillMode, fillModeFallback)
  target.fillGradientType = normalizeFillGradientType(target.fillGradientType, fillType ?? DEFAULT_FILL_GRADIENT_TYPE)
  target.fillGradientStops = normalizeGradientStops(target.fillGradientStops ?? extractGradientStops(target.fill), fallbackColor)
  target.fillGradientAngle = normalizeAngle(target.fillGradientAngle, normalizeAngle(extractGradientAngle(target.fill), DEFAULT_FILL_GRADIENT_ANGLE))
  const center = extractGradientCenter(target.fill, target)
  target.fillGradientCenterX = normalizeUnitInterval(target.fillGradientCenterX, normalizeUnitInterval(center?.x, DEFAULT_FILL_GRADIENT_CENTER))
  target.fillGradientCenterY = normalizeUnitInterval(target.fillGradientCenterY, normalizeUnitInterval(center?.y, DEFAULT_FILL_GRADIENT_CENTER))
  target.fillGradientRadius = normalizeRadius(target.fillGradientRadius, normalizeRadius(extractGradientRadius(target.fill, target), DEFAULT_FILL_GRADIENT_RADIUS))
}

export function createGradientFromMetadata(obj: FabricObject | null | undefined) {
  const target = getFillGradientMetadata(obj)
  if (!target) return null
  applyDefaultFillGradientMetadata(target)
  if (target.fillMode !== 'gradient') return null
  const type = target.fillGradientType ?? DEFAULT_FILL_GRADIENT_TYPE
  const colorStops = cloneGradientStops(target.fillGradientStops ?? createDefaultGradientStops(target.lastFill))
  if (type === 'radial') {
    const { width, height } = getGradientObjectDimensions(target)
    const centerX = normalizeUnitInterval(target.fillGradientCenterX)
    const centerY = normalizeUnitInterval(target.fillGradientCenterY)
    const radius = normalizeRadius(target.fillGradientRadius)
    const x = centerX * width
    const y = centerY * height
    return new Gradient({
      type: 'radial',
      gradientUnits: 'pixels',
      colorStops,
      coords: {
        x1: x,
        y1: y,
        r1: 0,
        x2: x,
        y2: y,
        r2: radius * getGradientRadiusBasis(target)
      }
    })
  }
  const angle = normalizeAngle(target.fillGradientAngle)
  const radians = angle * Math.PI / 180
  const dx = Math.cos(radians) * 0.5
  const dy = Math.sin(radians) * 0.5
  return new Gradient({
    type: 'linear',
    gradientUnits: 'percentage',
    colorStops,
    coords: {
      x1: 0.5 - dx,
      y1: 0.5 - dy,
      x2: 0.5 + dx,
      y2: 0.5 + dy
    }
  })
}

export function cloneFillGradientStops(stops: FillGradientStop[] | null | undefined) {
  return cloneGradientStops(normalizeGradientStops(stops))
}

export function clearFillGradientMetadata(obj: FabricObject | null | undefined) {
  const target = getFillGradientMetadata(obj)
  if (!target) return
  target.fillMode = DEFAULT_FILL_MODE
  target.fillGradientType = DEFAULT_FILL_GRADIENT_TYPE
  target.fillGradientStops = createDefaultGradientStops(target.lastFill)
  target.fillGradientAngle = DEFAULT_FILL_GRADIENT_ANGLE
  target.fillGradientCenterX = DEFAULT_FILL_GRADIENT_CENTER
  target.fillGradientCenterY = DEFAULT_FILL_GRADIENT_CENTER
  target.fillGradientRadius = DEFAULT_FILL_GRADIENT_RADIUS
}

export function normalizeEndpointSnapMargin(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, parsed)
}

export function getKaleidoscopeMetadata(obj: FabricObject | null | undefined) {
  return obj ? (obj as AnyFabricObject & KaleidoscopeMetadata) : null
}

export function applyDefaultKaleidoscopeMetadata(obj: FabricObject | null | undefined) {
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

export function clearKaleidoscopeMetadata(obj: FabricObject | null | undefined) {
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

export function getEndpointSnapMarginMetadata(obj: FabricObject | null | undefined) {
  return obj ? (obj as AnyFabricObject & EndpointSnapMarginMetadata) : null
}

export function applyDefaultEndpointSnapMargin(obj: FabricObject | null | undefined) {
  const target = getEndpointSnapMarginMetadata(obj)
  if (!target) return
  target.endpointSnapMargin = normalizeEndpointSnapMargin(target.endpointSnapMargin)
}

export function getObjectEndpointSnapMargin(obj: FabricObject | null | undefined) {
  applyDefaultEndpointSnapMargin(obj)
  return getEndpointSnapMarginMetadata(obj)?.endpointSnapMargin ?? 0
}

export function getSizeRatioLockMetadata(obj: FabricObject | null | undefined) {
  return obj ? (obj as AnyFabricObject & SizeRatioLockMetadata) : null
}

/**
 * 统一补齐对象的宽高比例锁定元数据；未显式标记时按未锁定处理，供创建、序列化和恢复链路共享。
 */
export function applyDefaultSizeRatioLockMetadata(obj: FabricObject | null | undefined) {
  const target = getSizeRatioLockMetadata(obj)
  if (!target) return
  target.sizeRatioLocked = target.sizeRatioLocked === true
}

/**
 * 标记对象默认采用等比缩放；属性面板仍可通过后续开关改写此状态。
 */
export function markObjectSizeRatioLocked(obj: FabricObject | null | undefined, locked = true) {
  const target = getSizeRatioLockMetadata(obj)
  if (!target) return
  target.sizeRatioLocked = locked === true
}

/**
 * 读取对象当前的宽高比例锁定状态；缺失元数据时会先回填默认值，避免调用方重复做空值判断。
 */
export function isObjectSizeRatioLocked(obj: FabricObject | null | undefined) {
  applyDefaultSizeRatioLockMetadata(obj)
  return getSizeRatioLockMetadata(obj)?.sizeRatioLocked === true
}

export function getShadowEffectsMetadata(obj: FabricObject | null | undefined) {
  return obj ? (obj as AnyFabricObject & ShadowEffectsMetadata) : null
}

function normalizeShadowEffect(effect: any): ShadowEffectItem | null {
  if (!effect || typeof effect !== 'object') return null
  return {
    id: typeof effect.id === 'string' && effect.id ? effect.id : String(Date.now() + Math.random()),
    enabled: effect.enabled !== false,
    type: effect.type === 'inner' ? 'inner' : 'drop',
    offsetX: normalizeFiniteNumber(effect.offsetX, 0),
    offsetY: normalizeFiniteNumber(effect.offsetY, 4),
    blur: Math.max(0, normalizeFiniteNumber(effect.blur, 8)),
    spread: normalizeFiniteNumber(effect.spread, 0),
    color: typeof effect.color === 'string' && effect.color.trim() ? effect.color : 'rgba(0, 0, 0, 0.25)'
  }
}

export function applyDefaultShadowEffectsMetadata(obj: FabricObject | null | undefined) {
  const target = getShadowEffectsMetadata(obj)
  if (!target) return

  if (Array.isArray(target.shadowEffects)) {
    target.shadowEffects = target.shadowEffects
      .map(normalizeShadowEffect)
      .filter((item): item is ShadowEffectItem => item !== null)
  } else {
    target.shadowEffects = []
  }

  target.blurEnabled = target.blurEnabled === true
  target.blurRadius = Math.max(0, normalizeFiniteNumber(target.blurRadius, 4))
}

export function applyShadowEffectsToFabricObject(obj: FabricObject | null | undefined) {
  const target = getShadowEffectsMetadata(obj)
  if (!target) return

  applyDefaultShadowEffectsMetadata(target)

  const enabledEffects = (target.shadowEffects ?? []).filter(effect => effect.enabled && effect.type === 'drop')

  if (enabledEffects.length > 0) {
    const firstEffect = enabledEffects[0]
    const anyObj = obj as any
    anyObj.shadow = {
      color: firstEffect.color,
      blur: firstEffect.blur,
      offsetX: firstEffect.offsetX,
      offsetY: firstEffect.offsetY
    }
  } else {
    const anyObj = obj as any
    anyObj.shadow = null
  }
}

export function createDefaultShadowEffect(): ShadowEffectItem {
  return {
    id: String(Date.now() + Math.random()),
    enabled: true,
    type: 'drop',
    offsetX: 0,
    offsetY: 4,
    blur: 8,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.25)'
  }
}

// 透视投影中相机到平面的归一化距离，值越大透视越弱（越接近正交投影）。
const ROTATION_3D_PERSPECTIVE = 4

export function getRotation3DMetadata(obj: FabricObject | null | undefined) {
  return obj ? (obj as AnyFabricObject & Rotation3DMetadata) : null
}

export function applyDefaultRotation3DMetadata(obj: FabricObject | null | undefined) {
  const target = getRotation3DMetadata(obj)
  if (!target) return
  target.rotateX = normalizeRotation3DAngle(target.rotateX)
  target.rotateY = normalizeRotation3DAngle(target.rotateY)
  target.rotateZ = normalizeRotation3DAngle(target.rotateZ)
  target.rotation3dBaseScaleX = normalizeFiniteNumber(target.rotation3dBaseScaleX, 1)
  target.rotation3dBaseScaleY = normalizeFiniteNumber(target.rotation3dBaseScaleY, 1)
}

export function clearRotation3DMetadata(obj: FabricObject | null | undefined) {
  const target = getRotation3DMetadata(obj)
  if (!target) return
  target.rotateX = 0
  target.rotateY = 0
  target.rotateZ = 0
  target.rotation3dBaseScaleX = 1
  target.rotation3dBaseScaleY = 1
}

// 旋转角统一归一化到 [0, 360)，与平面旋转滑杆保持一致的取值范围。
export function normalizeRotation3DAngle(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  const mod = parsed % 360
  return mod < 0 ? mod + 360 : mod
}

type Vec3 = [number, number, number]

function rotateAroundX([x, y, z]: Vec3, rad: number): Vec3 {
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  return [x, y * c - z * s, y * s + z * c]
}

function rotateAroundY([x, y, z]: Vec3, rad: number): Vec3 {
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  return [x * c + z * s, y, -x * s + z * c]
}

// 透视投影：把 3D 点投影到 z=0 平面，z 越靠近相机（越大）放大越多。
function projectPerspective([x, y, z]: Vec3): { x: number; y: number } {
  const factor = ROTATION_3D_PERSPECTIVE / (ROTATION_3D_PERSPECTIVE - z)
  return { x: x * factor, y: y * factor }
}

export type Rotation3DTransform = {
  scaleX: number
  scaleY: number
  skewX: number
  skewY: number
  angle: number
  flipX: boolean
  flipY: boolean
}

/**
 * 把三轴旋转角度（角度制）连同基础缩放分解为 Fabric 的 2D 变换组合。
 *
 * 设计要点：绕 Z 轴的旋转就是平面内旋转，等价于 Fabric 的 angle，作为最外层叠加；
 * 绕 X / Y 轴的旋转通过对单位基向量做 3D 旋转 + 透视投影来模拟立体翻转，
 * 再用 QR 式分解反解出 scaleX / scaleY / skewX。三个轴因此都"对照旋转"来实现。
 *
 * baseScaleX / baseScaleY 是对象自身缩放（拖拽改变尺寸得到的值），与投影系数相乘后再分解，
 * 保证立体旋转与普通缩放可以叠加而互不破坏。
 */
export function computeRotation3DTransform(
  rotateX: number,
  rotateY: number,
  rotateZ: number,
  baseScaleX = 1,
  baseScaleY = 1
): Rotation3DTransform {
  const rx = (rotateX * Math.PI) / 180
  const ry = (rotateY * Math.PI) / 180

  // 仅用 X / Y 轴旋转构造投影后的两条基向量；Z 轴旋转留到最后以纯角度叠加。
  const project = (v: Vec3) => projectPerspective(rotateAroundY(rotateAroundX(v, rx), ry))
  const ux = project([1, 0, 0])
  const uy = project([0, 1, 0])

  // 叠加基础缩放：相当于先对局部坐标缩放，再投影。
  const a = ux.x * baseScaleX
  const b = ux.y * baseScaleX
  const c = uy.x * baseScaleY
  const d = uy.y * baseScaleY

  // QR 式分解：从 col0 取旋转角与 scaleX，再据此求 skewX 与 scaleY。
  const denom = Math.hypot(a, b) || 1e-6
  let scaleX = denom
  const shear = (a * c + b * d) / (denom * denom)
  let scaleY = (a * d - b * c) / denom
  let projAngle = Math.atan2(b, a)

  let flipX = false
  let flipY = false
  if (scaleX < 0) {
    scaleX = -scaleX
    flipX = true
  }
  if (scaleY < 0) {
    scaleY = -scaleY
    flipY = true
  }

  // 当发生 flipY 时，调整投影角度以保持视觉一致性
  // flipY 意味着对象在 Y 轴上翻转了，此时投影角度会跳变约 180°
  // 我们需要补偿这个跳变，使得 Z 轴旋转保持稳定
  if (flipY) {
    projAngle = projAngle + Math.PI
  }

  return {
    scaleX,
    scaleY,
    skewX: (Math.atan(shear) * 180) / Math.PI,
    skewY: 0,
    // 平面旋转（rotateZ）作为最外层旋转，与投影自身产生的微小角度相加。
    angle: rotateZ + (projAngle * 180) / Math.PI,
    flipX,
    flipY
  }
}

/**
 * 把三轴旋转元数据应用到 Fabric 对象上，将其物理变换设为对应的投影结果。
 */
export function applyRotation3DTransformToObject(obj: FabricObject | null | undefined) {
  const target = getRotation3DMetadata(obj)
  if (!target || !obj) return
  applyDefaultRotation3DMetadata(target)

  const rotateX = target.rotateX ?? 0
  const rotateY = target.rotateY ?? 0
  const rotateZ = target.rotateZ ?? 0  // 使用存储的原始 Z 轴角度
  const baseScaleX = target.rotation3dBaseScaleX ?? 1
  const baseScaleY = target.rotation3dBaseScaleY ?? 1

  const transform = computeRotation3DTransform(rotateX, rotateY, rotateZ, baseScaleX, baseScaleY)

  obj.set({
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    skewX: transform.skewX,
    skewY: transform.skewY,
    angle: transform.angle,
    flipX: transform.flipX,
    flipY: transform.flipY
  })
}

/**
 * 从 Fabric 对象当前变换反推出基础缩放（未应用立体旋转投影前的真实缩放）。
 *
 * 用于在用户拖拽缩放手柄后，把新的 scaleX/scaleY 写回 rotation3dBaseScaleX/Y，
 * 再重新应用立体旋转，这样缩放与立体旋转保持独立可叠加。
 */
export function extractRotation3DBaseScalesFromObject(obj: FabricObject | null | undefined) {
  const target = getRotation3DMetadata(obj)
  if (!target || !obj) return
  applyDefaultRotation3DMetadata(target)

  const rotateX = target.rotateX ?? 0
  const rotateY = target.rotateY ?? 0

  // 计算只有 X/Y 旋转时的投影系数（不含基础缩放）。
  const unitTransform = computeRotation3DTransform(rotateX, rotateY, 0, 1, 1)

  // 当前 Fabric scaleX/Y 是 基础缩放 × 投影系数，反推基础缩放。
  const currentScaleX = Math.abs(obj.scaleX ?? 1)
  const currentScaleY = Math.abs(obj.scaleY ?? 1)
  const baseScaleX = Math.abs(unitTransform.scaleX) > 1e-6 ? currentScaleX / unitTransform.scaleX : 1
  const baseScaleY = Math.abs(unitTransform.scaleY) > 1e-6 ? currentScaleY / unitTransform.scaleY : 1

  target.rotation3dBaseScaleX = baseScaleX
  target.rotation3dBaseScaleY = baseScaleY
}

