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
  'kaleidoscopeInstanceIndex'
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
