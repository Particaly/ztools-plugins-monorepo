import { Path, Point } from 'fabric'
import type { TComplexPathData, TSimplePathData } from 'fabric'

type AnyFabricPath = Path & Record<string, any>

export type EditablePoint = {
  x: number
  y: number
  selectable?: boolean
}

export type EditablePathSegment =
  | { type: 'line'; to: number; cp1?: EditablePoint; cp2?: EditablePoint }
  | { type: 'cubic'; cp1: EditablePoint; cp2: EditablePoint; to: number }

export type EditablePathContour = {
  closed: boolean
  points: EditablePoint[]
  segments: EditablePathSegment[]
}

export type EditablePathModel = {
  contours: EditablePathContour[]
}

type LegacyEditablePathModel = EditablePathContour

export type EditablePathObject = AnyFabricPath & {
  editablePath: EditablePathModel | LegacyEditablePathModel
  cornerRadius: number
  cornerRadiusOverrides: Array<number | null>
  editablePathVersion: number
}

type BuildSegment = {
  from: number
  to: number
  type: EditablePathSegment['type']
  cp1?: EditablePoint
  cp2?: EditablePoint
}

type RoundedPoint = EditablePoint & {
  index: number
  radius: number
  inPoint: EditablePoint
  outPoint: EditablePoint
  hasRound: boolean
}

type EditablePointRef = {
  contour: EditablePathContour
  contourIndex: number
  point: EditablePoint
  pointIndex: number
  globalIndex: number
}

export type EditableSegmentRef = {
  contour: EditablePathContour
  contourIndex: number
  segment: EditablePathSegment
  segmentIndex: number
  fromPoint: EditablePoint
  toPoint: EditablePoint
  fromPointIndex: number
  toPointIndex: number
  fromGlobalIndex: number
  toGlobalIndex: number
}

const EDITABLE_PATH_VERSION = 2
const KAPPA = 0.5522847498307936

function clonePoint(point: EditablePoint): EditablePoint {
  return { x: point.x, y: point.y, selectable: point.selectable }
}

function cloneSegment(segment: EditablePathSegment): EditablePathSegment {
  if (segment.type === 'line') {
    return {
      ...segment,
      cp1: segment.cp1 ? clonePoint(segment.cp1) : undefined,
      cp2: segment.cp2 ? clonePoint(segment.cp2) : undefined
    }
  }
  return { ...segment, cp1: clonePoint(segment.cp1), cp2: clonePoint(segment.cp2) }
}

function cloneContour(contour: EditablePathContour): EditablePathContour {
  return {
    closed: contour.closed,
    points: contour.points.map(clonePoint),
    segments: contour.segments.map(cloneSegment)
  }
}

function cloneModel(model: EditablePathModel): EditablePathModel {
  return {
    contours: model.contours.map(cloneContour)
  }
}

function distance(a: EditablePoint, b: EditablePoint) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function lerp(a: EditablePoint, b: EditablePoint, amount: number): EditablePoint {
  return {
    x: a.x + (b.x - a.x) * amount,
    y: a.y + (b.y - a.y) * amount
  }
}

function samePoint(a: EditablePoint, b: EditablePoint) {
  return Math.abs(a.x - b.x) < 0.0001 && Math.abs(a.y - b.y) < 0.0001
}

function isEditablePathContour(value: unknown): value is EditablePathContour {
  return !!value
    && typeof value === 'object'
    && Array.isArray((value as EditablePathContour).points)
    && Array.isArray((value as EditablePathContour).segments)
}

function normalizeContour(value: Partial<EditablePathContour> | null | undefined): EditablePathContour {
  const points = Array.isArray(value?.points) ? value.points : []
  const segments = Array.isArray(value?.segments) ? value.segments : []
  return {
    closed: value?.closed !== false,
    points: points.map(clonePoint),
    segments: segments.map(cloneSegment)
  }
}

function isEditablePathModel(value: unknown): value is EditablePathModel {
  return !!value
    && typeof value === 'object'
    && Array.isArray((value as EditablePathModel).contours)
}

function normalizeModel(model: EditablePathModel | LegacyEditablePathModel | null | undefined): EditablePathModel {
  if (isEditablePathModel(model)) {
    return {
      contours: model.contours
        .filter(isEditablePathContour)
        .map(normalizeContour)
    }
  }
  if (isEditablePathContour(model)) {
    return {
      contours: [normalizeContour(model)]
    }
  }
  return { contours: [] }
}

function getPointCount(model: EditablePathModel) {
  return model.contours.reduce((total, contour) => total + contour.points.length, 0)
}

function getContourStartIndices(model: EditablePathModel) {
  const startIndices: number[] = []
  let startIndex = 0
  model.contours.forEach((contour) => {
    startIndices.push(startIndex)
    startIndex += contour.points.length
  })
  return startIndices
}

function buildSegmentToEditablePathSegment(segment: BuildSegment): EditablePathSegment {
  if (segment.type === 'cubic' && segment.cp1 && segment.cp2) {
    return {
      type: 'cubic',
      cp1: clonePoint(segment.cp1),
      cp2: clonePoint(segment.cp2),
      to: segment.to
    }
  }
  return {
    type: 'line',
    to: segment.to,
    cp1: segment.cp1 ? clonePoint(segment.cp1) : undefined,
    cp2: segment.cp2 ? clonePoint(segment.cp2) : undefined
  }
}

function buildEditableSegmentRef(model: EditablePathModel, contourIndex: number, segmentIndex: number) {
  const contour = model.contours[contourIndex]
  if (!contour) return null
  const segments = getBuildSegments(contour)
  const buildSegment = segments[segmentIndex]
  if (!buildSegment) return null
  const fromPoint = contour.points[buildSegment.from]
  const toPoint = contour.points[buildSegment.to]
  if (!fromPoint || !toPoint) return null
  const contourStartIndex = getContourStartIndices(model)[contourIndex] ?? 0
  return {
    contour,
    contourIndex,
    segment: contour.segments[segmentIndex] ?? buildSegmentToEditablePathSegment(buildSegment),
    segmentIndex,
    fromPoint,
    toPoint,
    fromPointIndex: buildSegment.from,
    toPointIndex: buildSegment.to,
    fromGlobalIndex: contourStartIndex + buildSegment.from,
    toGlobalIndex: contourStartIndex + buildSegment.to
  } satisfies EditableSegmentRef
}

export function resolveEditableSegmentRef(
  obj: EditablePathObject,
  segmentRef: EditableSegmentRef | null | undefined
) {
  if (!segmentRef) return null
  const model = ensureEditablePathObject(obj)
  const liveSegmentRef = buildEditableSegmentRef(model, segmentRef.contourIndex, segmentRef.segmentIndex)
  if (!liveSegmentRef) return null
  if (
    liveSegmentRef.fromPointIndex !== segmentRef.fromPointIndex
    || liveSegmentRef.toPointIndex !== segmentRef.toPointIndex
  ) return null
  return liveSegmentRef
}

function ensureEditablePathObject(obj: EditablePathObject) {
  const normalized = normalizeModel(obj.editablePath)
  const expectedPointCount = getPointCount(normalized)
  const nextOverrides = Array.from({ length: expectedPointCount }, (_, index) => {
    const value = obj.cornerRadiusOverrides?.[index]
    return value == null || !Number.isFinite(value) ? null : Math.max(0, value)
  })

  obj.editablePath = normalized
  obj.cornerRadius = Number.isFinite(obj.cornerRadius) ? Math.max(0, obj.cornerRadius) : 0
  obj.cornerRadiusOverrides = nextOverrides
  obj.editablePathVersion = EDITABLE_PATH_VERSION

  return normalized
}

function flattenEditablePoints(model: EditablePathModel) {
  const result: EditablePointRef[] = []
  let globalIndex = 0
  model.contours.forEach((contour, contourIndex) => {
    contour.points.forEach((point, pointIndex) => {
      result.push({
        contour,
        contourIndex,
        point,
        pointIndex,
        globalIndex
      })
      globalIndex += 1
    })
  })
  return result
}

function resolveEditablePoint(model: EditablePathModel, globalIndex: number) {
  if (!Number.isInteger(globalIndex) || globalIndex < 0) return null
  let startIndex = 0
  for (let contourIndex = 0; contourIndex < model.contours.length; contourIndex += 1) {
    const contour = model.contours[contourIndex]
    const endIndex = startIndex + contour.points.length
    if (globalIndex < endIndex) {
      const pointIndex = globalIndex - startIndex
      return {
        contour,
        contourIndex,
        pointIndex,
        globalIndex,
        point: contour.points[pointIndex]
      } satisfies EditablePointRef
    }
    startIndex = endIndex
  }
  return null
}

function clampRadius(contour: EditablePathContour, index: number, radius: number) {
  if (!Number.isFinite(radius) || radius <= 0) return 0
  if (contour.points[index]?.selectable === false) return 0
  if (!contour.closed && (index === 0 || index === contour.points.length - 1)) return 0
  const prev = contour.points[index - 1] ?? contour.points[contour.points.length - 1]
  const current = contour.points[index]
  const next = contour.points[index + 1] ?? contour.points[0]
  if (!prev || !current || !next) return 0
  const prevLen = distance(prev, current)
  const nextLen = distance(current, next)
  if (prevLen <= 0 || nextLen <= 0) return 0
  return Math.max(0, Math.min(radius, prevLen / 2, nextLen / 2))
}

function effectiveRadius(obj: EditablePathObject, index: number) {
  const override = obj.cornerRadiusOverrides?.[index]
  const radius = override == null ? obj.cornerRadius : override
  return Number.isFinite(radius) ? Math.max(0, radius) : 0
}

function getBuildSegments(contour: EditablePathContour): BuildSegment[] {
  if (contour.segments.length) {
    const segments: BuildSegment[] = []
    let from = 0
    for (const segment of contour.segments) {
      segments.push({ from, to: segment.to, type: segment.type, cp1: (segment as any).cp1, cp2: (segment as any).cp2 })
      from = segment.to
    }
    return segments
  }

  const segments: BuildSegment[] = []
  const count = contour.points.length
  const max = contour.closed ? count : count - 1
  for (let i = 0; i < max; i++) {
    segments.push({ from: i, to: (i + 1) % count, type: 'line' })
  }
  return segments
}

function createRoundedPoints(contour: EditablePathContour, obj: EditablePathObject, startIndex: number) {
  const points = contour.points
  return points.map((point, index): RoundedPoint => {
    const radius = clampRadius(contour, index, effectiveRadius(obj, startIndex + index))
    const prev = points[index - 1] ?? points[points.length - 1]
    const next = points[index + 1] ?? points[0]
    const hasRound = radius > 0 && !!prev && !!next
    return {
      ...point,
      index: startIndex + index,
      radius,
      inPoint: hasRound ? lerp(point, prev, radius / distance(point, prev)) : point,
      outPoint: hasRound ? lerp(point, next, radius / distance(point, next)) : point,
      hasRound
    }
  })
}

function pushLine(commands: TComplexPathData, point: EditablePoint) {
  commands.push(['L', point.x, point.y])
}

function pushCubic(commands: TComplexPathData, from: EditablePoint, cp1: EditablePoint, cp2: EditablePoint, to: EditablePoint) {
  if (samePoint(from, to)) return
  commands.push(['C', cp1.x, cp1.y, cp2.x, cp2.y, to.x, to.y])
}

function buildContourPathData(contour: EditablePathContour, obj: EditablePathObject, startIndex: number): TComplexPathData {
  const points = contour.points
  if (!points.length) return []
  if (points.length === 1) return [['M', points[0].x, points[0].y]]

  const rounded = createRoundedPoints(contour, obj, startIndex)
  const segments = getBuildSegments(contour)
  const firstIndex = contour.closed ? 0 : segments[0]?.from ?? 0
  const first = rounded[firstIndex]
  const commands: TComplexPathData = [['M', contour.closed && first.hasRound ? first.outPoint.x : first.x, contour.closed && first.hasRound ? first.outPoint.y : first.y]]
  let current: EditablePoint = contour.closed && first.hasRound ? first.outPoint : first

  for (const segment of segments) {
    const to = rounded[segment.to]
    const segmentEnd = to.hasRound ? to.inPoint : to
    if (segment.type === 'cubic' && segment.cp1 && segment.cp2) {
      pushCubic(commands, current, segment.cp1, segment.cp2, segmentEnd)
    } else {
      pushLine(commands, segmentEnd)
    }
    current = segmentEnd
    if (to.hasRound) {
      const cp1 = lerp(to.inPoint, to, KAPPA)
      const cp2 = lerp(to.outPoint, to, KAPPA)
      pushCubic(commands, current, cp1, cp2, to.outPoint)
      current = to.outPoint
    }
  }

  if (contour.closed) commands.push(['Z'])
  return commands
}

export function buildEditablePathData(obj: EditablePathObject): TComplexPathData {
  const model = ensureEditablePathObject(obj)
  const commands: TComplexPathData = []
  let startIndex = 0
  model.contours.forEach((contour) => {
    commands.push(...buildContourPathData(contour, obj, startIndex))
    startIndex += contour.points.length
  })
  return commands
}

export function createEditablePathObject(model: EditablePathModel, cornerRadius = 0) {
  const obj = new Path('M 0 0') as EditablePathObject
  obj.editablePath = cloneModel(normalizeModel(model))
  obj.cornerRadius = Math.max(0, cornerRadius)
  obj.cornerRadiusOverrides = Array.from({ length: getPointCount(obj.editablePath as EditablePathModel) }, () => null)
  obj.editablePathVersion = EDITABLE_PATH_VERSION
  rebuildEditablePathObject(obj, true)
  return obj
}

export function isEditablePathObject(obj: unknown): obj is EditablePathObject {
  if (!(obj instanceof Path)) return false
  const editablePath = (obj as AnyFabricPath).editablePath
  return !!editablePath && (
    Array.isArray(editablePath.points) ||
    Array.isArray(editablePath.contours)
  )
}

export function getSelectableEditablePoints(obj: EditablePathObject) {
  const model = ensureEditablePathObject(obj)
  return flattenEditablePoints(model)
    .map(({ point, globalIndex }) => ({ point, index: globalIndex }))
    .filter(({ point }) => point.selectable !== false)
}

export function getEditableSegmentByPointSelection(obj: EditablePathObject, indices: number[]) {
  const model = ensureEditablePathObject(obj)
  const uniqueIndices = Array.from(new Set(indices))
    .filter((index) => Number.isInteger(index) && index >= 0)
    .sort((a, b) => a - b)
  if (uniqueIndices.length !== 2) return null
  const [firstIndex, secondIndex] = uniqueIndices
  const firstPointRef = resolveEditablePoint(model, firstIndex)
  const secondPointRef = resolveEditablePoint(model, secondIndex)
  if (!firstPointRef || !secondPointRef) return null
  if (firstPointRef.contourIndex !== secondPointRef.contourIndex) return null

  const contour = firstPointRef.contour
  const pointCount = contour.points.length
  if (pointCount < 2) return null
  if (contour.closed && pointCount === 2) return null

  const segments = getBuildSegments(contour)
  const contourStartIndices = getContourStartIndices(model)
  const contourStartIndex = contourStartIndices[firstPointRef.contourIndex] ?? 0
  const segmentIndex = segments.findIndex((segment) => {
    const fromGlobalIndex = contourStartIndex + segment.from
    const toGlobalIndex = contourStartIndex + segment.to
    return (
      (fromGlobalIndex === firstIndex && toGlobalIndex === secondIndex)
      || (fromGlobalIndex === secondIndex && toGlobalIndex === firstIndex)
    )
  })
  if (segmentIndex < 0) return null

  return buildEditableSegmentRef(model, firstPointRef.contourIndex, segmentIndex)
}

function materializeContourSegments(contour: EditablePathContour) {
  return getBuildSegments(contour).map((segment) => buildSegmentToEditablePathSegment(segment))
}

function ensureContourSegments(contour: EditablePathContour) {
  if (!contour.segments.length) {
    contour.segments = materializeContourSegments(contour)
  }
  return contour.segments
}

function createDefaultCubicControlPoints(fromPoint: EditablePoint, toPoint: EditablePoint) {
  return {
    cp1: lerp(fromPoint, toPoint, 1 / 3),
    cp2: lerp(fromPoint, toPoint, 2 / 3)
  }
}

function getPointInParentPlane(obj: EditablePathObject, point: EditablePoint) {
  return new Point(point.x, point.y)
    .subtract(obj.pathOffset)
    .transform(obj.calcOwnMatrix())
}

function rebuildEditablePathObjectKeepingAnchor(
  obj: EditablePathObject,
  anchorPoint: EditablePoint | null,
  anchorPointInParentPlane: Point | null = anchorPoint ? getPointInParentPlane(obj, anchorPoint) : null
) {
  ensureEditablePathObject(obj)
  const path = buildEditablePathData(obj)
  ;(obj as any)._setPath((path.length ? path : [['M', 0, 0]]) as TSimplePathData, false)
  if (anchorPoint && anchorPointInParentPlane) {
    const diff = getPointInParentPlane(obj, anchorPoint).subtract(anchorPointInParentPlane)
    obj.left = (obj.left ?? 0) - diff.x
    obj.top = (obj.top ?? 0) - diff.y
  }
  obj.dirty = true
  obj.setCoords()
}

export function getPointRadius(obj: EditablePathObject, index: number) {
  ensureEditablePathObject(obj)
  return effectiveRadius(obj, index)
}

export function setObjectCornerRadius(obj: EditablePathObject, radius: number) {
  ensureEditablePathObject(obj)
  obj.cornerRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0
  rebuildEditablePathObject(obj)
}

export function setPointCornerRadius(obj: EditablePathObject, index: number, radius: number) {
  const model = ensureEditablePathObject(obj)
  const next = Number.isFinite(radius) ? Math.max(0, radius) : 0
  const overrides = obj.cornerRadiusOverrides ?? Array.from({ length: getPointCount(model) }, () => null)
  if (index < 0 || index >= overrides.length) return
  overrides[index] = next
  obj.cornerRadiusOverrides = overrides
  rebuildEditablePathObject(obj)
}

export function setPointsCornerRadius(obj: EditablePathObject, indices: number[], radius: number) {
  const model = ensureEditablePathObject(obj)
  const next = Number.isFinite(radius) ? Math.max(0, radius) : 0
  const overrides = obj.cornerRadiusOverrides ?? Array.from({ length: getPointCount(model) }, () => null)
  const uniqueIndices = Array.from(new Set(indices))
  uniqueIndices.forEach((index) => {
    if (index >= 0 && index < overrides.length) {
      overrides[index] = next
    }
  })
  obj.cornerRadiusOverrides = overrides
  rebuildEditablePathObject(obj)
}

export function setEditableSegmentType(obj: EditablePathObject, segmentRef: EditableSegmentRef, type: EditablePathSegment['type']) {
  const liveSegmentRef = resolveEditableSegmentRef(obj, segmentRef)
  if (!liveSegmentRef) return
  const segments = ensureContourSegments(liveSegmentRef.contour)
  const segment = segments[liveSegmentRef.segmentIndex]
  if (!segment || segment.to !== liveSegmentRef.toPointIndex) return
  if (type === 'cubic') {
    const controlPoints = segment.cp1 && segment.cp2
      ? { cp1: clonePoint(segment.cp1), cp2: clonePoint(segment.cp2) }
      : createDefaultCubicControlPoints(liveSegmentRef.fromPoint, liveSegmentRef.toPoint)
    segments[liveSegmentRef.segmentIndex] = {
      type: 'cubic',
      to: segment.to,
      cp1: controlPoints.cp1,
      cp2: controlPoints.cp2
    }
  } else {
    segments[liveSegmentRef.segmentIndex] = {
      type: 'line',
      to: segment.to,
      cp1: segment.cp1 ? clonePoint(segment.cp1) : undefined,
      cp2: segment.cp2 ? clonePoint(segment.cp2) : undefined
    }
  }
  rebuildEditablePathObjectKeepingAnchor(obj, liveSegmentRef.fromPoint)
}

export function setEditableSegmentControlPoint(
  obj: EditablePathObject,
  segmentRef: EditableSegmentRef,
  controlPoint: 'cp1' | 'cp2',
  nextPoint: EditablePoint
) {
  const liveSegmentRef = resolveEditableSegmentRef(obj, segmentRef)
  if (!liveSegmentRef) return
  const segments = ensureContourSegments(liveSegmentRef.contour)
  const segment = segments[liveSegmentRef.segmentIndex]
  if (!segment || segment.to !== liveSegmentRef.toPointIndex) return
  let current: EditablePathSegment & { type: 'cubic' }
  if (segment.type === 'cubic') {
    current = segment
  } else {
    const defaults = createDefaultCubicControlPoints(liveSegmentRef.fromPoint, liveSegmentRef.toPoint)
    current = {
      type: 'cubic',
      to: segment.to,
      cp1: segment.cp1 ? clonePoint(segment.cp1) : defaults.cp1,
      cp2: segment.cp2 ? clonePoint(segment.cp2) : defaults.cp2
    }
  }
  segments[liveSegmentRef.segmentIndex] = {
    ...current,
    [controlPoint]: clonePoint(nextPoint)
  }
  rebuildEditablePathObjectKeepingAnchor(obj, liveSegmentRef.fromPoint)
}

function pointSegmentDistance(point: EditablePoint, fromPoint: EditablePoint, toPoint: EditablePoint) {
  const lineX = toPoint.x - fromPoint.x
  const lineY = toPoint.y - fromPoint.y
  const lengthSquared = lineX * lineX + lineY * lineY
  if (lengthSquared < 0.0001) return distance(point, fromPoint)
  const projection = ((point.x - fromPoint.x) * lineX + (point.y - fromPoint.y) * lineY) / lengthSquared
  const t = Math.max(0, Math.min(1, projection))
  return distance(point, {
    x: fromPoint.x + lineX * t,
    y: fromPoint.y + lineY * t
  })
}

function cubicPoint(
  fromPoint: EditablePoint,
  cp1: EditablePoint,
  cp2: EditablePoint,
  toPoint: EditablePoint,
  t: number
): EditablePoint {
  const inverse = 1 - t
  const inverse2 = inverse * inverse
  const inverse3 = inverse2 * inverse
  const t2 = t * t
  const t3 = t2 * t
  return {
    x: inverse3 * fromPoint.x + 3 * inverse2 * t * cp1.x + 3 * inverse * t2 * cp2.x + t3 * toPoint.x,
    y: inverse3 * fromPoint.y + 3 * inverse2 * t * cp1.y + 3 * inverse * t2 * cp2.y + t3 * toPoint.y
  }
}

function cubicSegmentDistance(
  point: EditablePoint,
  fromPoint: EditablePoint,
  cp1: EditablePoint,
  cp2: EditablePoint,
  toPoint: EditablePoint,
  steps = 24
) {
  let minDistance = Math.min(distance(point, fromPoint), distance(point, toPoint))
  let previousPoint = fromPoint
  for (let index = 1; index <= steps; index += 1) {
    const currentPoint = cubicPoint(fromPoint, cp1, cp2, toPoint, index / steps)
    minDistance = Math.min(minDistance, pointSegmentDistance(point, previousPoint, currentPoint))
    previousPoint = currentPoint
  }
  return minDistance
}

export function getEditableSegmentByLocalPoint(
  obj: EditablePathObject,
  point: EditablePoint,
  tolerance = 6
) {
  const model = ensureEditablePathObject(obj)
  let bestMatch: { ref: EditableSegmentRef, distance: number } | null = null
  model.contours.forEach((contour, contourIndex) => {
    const segments = getBuildSegments(contour)
    segments.forEach((segment, segmentIndex) => {
      const fromPoint = contour.points[segment.from]
      const toPoint = contour.points[segment.to]
      if (!fromPoint || !toPoint) return
      const nextDistance = segment.type === 'cubic' && segment.cp1 && segment.cp2
        ? cubicSegmentDistance(point, fromPoint, segment.cp1, segment.cp2, toPoint)
        : pointSegmentDistance(point, fromPoint, toPoint)
      if (nextDistance > tolerance || (bestMatch && nextDistance >= bestMatch.distance)) return
      const ref = buildEditableSegmentRef(model, contourIndex, segmentIndex)
      if (!ref) return
      bestMatch = { ref, distance: nextDistance }
    })
  })
  return bestMatch?.ref ?? null
}

export function getEditableSegments(obj: EditablePathObject): EditableSegmentRef[] {
  const model = ensureEditablePathObject(obj)
  const result: EditableSegmentRef[] = []
  model.contours.forEach((contour, contourIndex) => {
    const segments = getBuildSegments(contour)
    segments.forEach((_segment, segmentIndex) => {
      const ref = buildEditableSegmentRef(model, contourIndex, segmentIndex)
      if (ref) result.push(ref)
    })
  })
  return result
}

export function getEditableSegmentMidpoint(segmentRef: EditableSegmentRef): EditablePoint {
  const segment = segmentRef.segment
  if (segment && segment.type === 'cubic' && segment.cp1 && segment.cp2) {
    return cubicPoint(segmentRef.fromPoint, segment.cp1, segment.cp2, segmentRef.toPoint, 0.5)
  }
  return lerp(segmentRef.fromPoint, segmentRef.toPoint, 0.5)
}

export function isSameEditableSegmentRef(
  a: EditableSegmentRef | null | undefined,
  b: EditableSegmentRef | null | undefined
) {
  if (!a || !b) return false
  return a.contourIndex === b.contourIndex
    && a.segmentIndex === b.segmentIndex
    && a.fromPointIndex === b.fromPointIndex
    && a.toPointIndex === b.toPointIndex
}

export function moveEditablePoint(obj: EditablePathObject, index: number, nextPoint: EditablePoint) {
  const model = ensureEditablePathObject(obj)
  const pointRef = resolveEditablePoint(model, index)
  if (!pointRef) return
  const { contour, pointIndex, point } = pointRef
  const anchorIndex = contour.points.length > 1
    ? (pointIndex > 0 ? pointIndex : contour.points.length) - 1
    : -1
  const anchorPoint = anchorIndex >= 0 ? contour.points[anchorIndex] : null
  const anchorPointInParentPlane = anchorPoint ? getPointInParentPlane(obj, anchorPoint) : null
  point.x = nextPoint.x
  point.y = nextPoint.y
  rebuildEditablePathObjectKeepingAnchor(obj, anchorPoint, anchorPointInParentPlane)
}

/**
 * 批量平移多个 anchor 点位。
 * - 以 leadIndex 这一点的 (leadNextPoint - 当前 local 坐标) 计算统一 delta
 * - 对所有 indices 中存在的 anchor 点应用同一个 delta
 * - 不修改任何 segment 的 cp1 / cp2 控制点
 * - 整批修改完只 rebuild 一次 path
 * - 优先根据未移动的点在父平面的位置补偿 obj.left / obj.top，保证其它点位保持不动
 * - 如果所有点都被移动，则回退到 lead point 补偿，保证被抓住的点跟手
 */
export function moveEditablePoints(
  obj: EditablePathObject,
  indices: number[],
  leadIndex: number,
  leadNextPoint: EditablePoint
) {
  const model = ensureEditablePathObject(obj)
  const leadRef = resolveEditablePoint(model, leadIndex)
  if (!leadRef) return
  const uniqueIndices = Array.from(new Set(indices))
    .filter((index) => Number.isInteger(index) && index >= 0)
  const refs: EditablePointRef[] = []
  const seenPoints = new Set<EditablePoint>()
  for (const index of uniqueIndices) {
    const ref = resolveEditablePoint(model, index)
    if (!ref) continue
    if (seenPoints.has(ref.point)) continue
    seenPoints.add(ref.point)
    refs.push(ref)
  }
  if (!seenPoints.has(leadRef.point)) {
    refs.push(leadRef)
    seenPoints.add(leadRef.point)
  }
  const stationaryRef = flattenEditablePoints(model)
    .find((ref) => !seenPoints.has(ref.point)) ?? null
  const dx = leadNextPoint.x - leadRef.point.x
  const dy = leadNextPoint.y - leadRef.point.y
  if (dx === 0 && dy === 0) return
  // rebuild path 会更新 pathOffset；有未移动点时记录它的父平面位置，避免补偿时带动未选点。
  // 如果所有点均被移动，则记录 lead point 的目标父平面位置，让被抓住的点继续跟手。
  const anchorBefore = stationaryRef
    ? getPointInParentPlane(obj, stationaryRef.point)
    : getPointInParentPlane(obj, leadNextPoint)
  for (const ref of refs) {
    ref.point.x += dx
    ref.point.y += dy
  }
  rebuildEditablePathObjectKeepingAnchor(obj, stationaryRef?.point ?? leadRef.point, anchorBefore)
}

export function editablePointToLocalObjectPoint(obj: EditablePathObject, index: number) {
  const model = ensureEditablePathObject(obj)
  const point = resolveEditablePoint(model, index)?.point
  if (!point) return new Point(0, 0)
  return new Point(point.x, point.y).subtract(obj.pathOffset)
}

export function rebuildEditablePathObject(obj: EditablePathObject, adjustPosition = false) {
  ensureEditablePathObject(obj)
  const path = buildEditablePathData(obj)
  ;(obj as any)._setPath((path.length ? path : [['M', 0, 0]]) as TSimplePathData, adjustPosition)
  obj.dirty = true
  obj.setCoords()
}

export function polygonEditablePath(points: EditablePoint[], closed = true): EditablePathModel {
  return {
    contours: [{
      closed,
      points: points.map(clonePoint),
      segments: []
    }]
  }
}

export function pathEditableModel(points: EditablePoint[], segments: EditablePathSegment[], closed = true): EditablePathModel {
  return {
    contours: [{
      closed,
      points: points.map(clonePoint),
      segments: segments.map(cloneSegment)
    }]
  }
}

function finalizeParsedContour(contours: EditablePathContour[], contour: EditablePathContour | null) {
  if (!contour || !contour.points.length) return
  if (contour.closed && contour.points.length > 1) {
    const lastPointIndex = contour.points.length - 1
    const lastPoint = contour.points[lastPointIndex]
    const firstPoint = contour.points[0]
    if (samePoint(lastPoint, firstPoint)) {
      const lastSegment = contour.segments[contour.segments.length - 1]
      if (lastSegment?.to === lastPointIndex) {
        lastSegment.to = 0
        contour.points.pop()
      }
    } else {
      contour.segments.push({ type: 'line', to: 0 })
    }
  }
  contours.push(cloneContour(contour))
}

function quadraticToCubic(from: EditablePoint, control: EditablePoint, to: EditablePoint) {
  return {
    cp1: {
      x: from.x + ((control.x - from.x) * 2) / 3,
      y: from.y + ((control.y - from.y) * 2) / 3
    },
    cp2: {
      x: to.x + ((control.x - to.x) * 2) / 3,
      y: to.y + ((control.y - to.y) * 2) / 3
    }
  }
}

export function editablePathFromPathData(pathData: TSimplePathData): EditablePathModel | null {
  const contours: EditablePathContour[] = []
  let currentContour: EditablePathContour | null = null

  for (const segment of pathData) {
    switch (segment[0]) {
      case 'M':
        finalizeParsedContour(contours, currentContour)
        currentContour = {
          closed: false,
          points: [{ x: segment[1], y: segment[2] }],
          segments: []
        }
        break
      case 'L':
        if (!currentContour?.points.length) break
        currentContour.points.push({ x: segment[1], y: segment[2] })
        currentContour.segments.push({ type: 'line', to: currentContour.points.length - 1 })
        break
      case 'C':
        if (!currentContour?.points.length) break
        currentContour.points.push({ x: segment[5], y: segment[6] })
        currentContour.segments.push({
          type: 'cubic',
          cp1: { x: segment[1], y: segment[2] },
          cp2: { x: segment[3], y: segment[4] },
          to: currentContour.points.length - 1
        })
        break
      case 'Q':
        if (!currentContour?.points.length) break
        const from = currentContour.points[currentContour.points.length - 1]
        const control = { x: segment[1], y: segment[2] }
        const to = { x: segment[3], y: segment[4] }
        currentContour.points.push(to)
        currentContour.segments.push({
          type: 'cubic',
          ...quadraticToCubic(from, control, to),
          to: currentContour.points.length - 1
        })
        break
      case 'Z':
        if (!currentContour) break
        currentContour.closed = true
        finalizeParsedContour(contours, currentContour)
        currentContour = null
        break
    }
  }

  finalizeParsedContour(contours, currentContour)
  return contours.length ? { contours } : null
}

// ── 圆角折叠：检测并还原布尔运算中被“打碎”的圆角结构 ──

type CollapsedRoundedCorner = {
  point: EditablePoint
  radius: number
  outIndex: number
}

function subtractPoints(a: EditablePoint, b: EditablePoint): EditablePoint {
  return {
    x: a.x - b.x,
    y: a.y - b.y
  }
}

function dotProduct(a: EditablePoint, b: EditablePoint) {
  return a.x * b.x + a.y * b.y
}

function crossProduct(a: EditablePoint, b: EditablePoint) {
  return a.x * b.y - a.y * b.x
}

function pointLineDistance(point: EditablePoint, lineStart: EditablePoint, lineEnd: EditablePoint) {
  const line = subtractPoints(lineEnd, lineStart)
  const lineLength = Math.hypot(line.x, line.y)
  if (lineLength < 0.0001) return distance(point, lineStart)
  const toPoint = subtractPoints(point, lineStart)
  return Math.abs(crossProduct(line, toPoint)) / lineLength
}

function lineIntersection(
  a1: EditablePoint,
  a2: EditablePoint,
  b1: EditablePoint,
  b2: EditablePoint
): EditablePoint | null {
  const da = subtractPoints(a2, a1)
  const db = subtractPoints(b2, b1)
  const denominator = crossProduct(da, db)
  if (Math.abs(denominator) < 0.0001) return null
  const delta = subtractPoints(b1, a1)
  const t = crossProduct(delta, db) / denominator
  return {
    x: a1.x + da.x * t,
    y: a1.y + da.y * t
  }
}

function angleBetweenVectors(v1: EditablePoint, v2: EditablePoint): number {
  const dot = dotProduct(v1, v2)
  const len1 = Math.hypot(v1.x, v1.y)
  const len2 = Math.hypot(v2.x, v2.y)
  if (len1 < 0.0001 || len2 < 0.0001) return Math.PI
  const cos = Math.max(-1, Math.min(1, dot / (len1 * len2)))
  return Math.acos(cos)
}

function roundedCornerTolerance(radius: number, hintedRadius: number) {
  const reference = Math.max(radius, hintedRadius, 1)
  return Math.max(0.5, reference * 0.2)
}

function detectCollapsedRoundedCorner(
  prevPoint: EditablePoint,
  inPoint: EditablePoint,
  segment: BuildSegment,
  outPoint: EditablePoint,
  nextPoint: EditablePoint,
  hintedRadius: number
): CollapsedRoundedCorner | null {
  if (segment.type !== 'cubic' || !segment.cp1 || !segment.cp2) return null

  const corner = lineIntersection(inPoint, segment.cp1, outPoint, segment.cp2)
  if (!corner) return null

  const inRadius = distance(inPoint, corner)
  const outRadius = distance(outPoint, corner)
  const radius = (inRadius + outRadius) / 2
  if (radius < 0.0001) return null

  const tolerance = roundedCornerTolerance(radius, hintedRadius)
  if (Math.abs(inRadius - outRadius) > tolerance) return null
  if (pointLineDistance(prevPoint, inPoint, corner) > tolerance) return null
  if (pointLineDistance(nextPoint, outPoint, corner) > tolerance) return null

  const expectedCp1 = lerp(inPoint, corner, KAPPA)
  const expectedCp2 = lerp(outPoint, corner, KAPPA)
  if (distance(expectedCp1, segment.cp1) > tolerance) return null
  if (distance(expectedCp2, segment.cp2) > tolerance) return null

  const incomingDirection = subtractPoints(inPoint, prevPoint)
  const cornerFromInPoint = subtractPoints(corner, inPoint)
  const outgoingDirection = subtractPoints(outPoint, nextPoint)
  const cornerFromOutPoint = subtractPoints(corner, outPoint)
  if (dotProduct(incomingDirection, cornerFromInPoint) <= 0) return null
  if (dotProduct(outgoingDirection, cornerFromOutPoint) <= 0) return null

  const angle = angleBetweenVectors(subtractPoints(inPoint, corner), subtractPoints(outPoint, corner))
  if (angle <= 0.1 || angle >= Math.PI - 0.1) return null

  const snappedRadius = hintedRadius > 0 && Math.abs(radius - hintedRadius) <= tolerance
    ? hintedRadius
    : radius

  return {
    point: {
      x: corner.x,
      y: corner.y,
      selectable: inPoint.selectable === false || outPoint.selectable === false ? false : inPoint.selectable
    },
    radius: snappedRadius,
    outIndex: segment.to
  }
}

function cloneCollapsedPoint(
  points: EditablePoint[],
  collapsedCorners: Map<number, CollapsedRoundedCorner>,
  index: number
) {
  const collapsed = collapsedCorners.get(index)
  return collapsed ? clonePoint(collapsed.point) : clonePoint(points[index])
}

export function collapseRoundedCornersInContour(
  contour: EditablePathContour,
  defaultRadius: number = 0
): { cornerOverrides: Map<number, number>, newContour: EditablePathContour } {
  const segments = getBuildSegments(contour)
  if (!segments.length || contour.points.length < 3) {
    return { cornerOverrides: new Map(), newContour: cloneContour(contour) }
  }

  const hintedRadius = Number.isFinite(defaultRadius) ? Math.max(0, defaultRadius) : 0
  const collapsedCorners = new Map<number, CollapsedRoundedCorner>()
  const skippedPointIndices = new Set<number>()

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    if (segment.type !== 'cubic') continue
    if (!contour.closed && (index === 0 || index === segments.length - 1)) continue

    const prevIndex = index > 0 ? index - 1 : segments.length - 1
    const nextIndex = index + 1 < segments.length ? index + 1 : 0
    const prevSegment = segments[prevIndex]
    const nextSegment = segments[nextIndex]
    if (prevSegment.type !== 'line' || nextSegment.type !== 'line') continue

    const prevPoint = contour.points[prevSegment.from]
    const inPoint = contour.points[segment.from]
    const outPoint = contour.points[segment.to]
    const nextPoint = contour.points[nextSegment.to]
    if (!prevPoint || !inPoint || !outPoint || !nextPoint) continue

    const collapsed = detectCollapsedRoundedCorner(
      prevPoint,
      inPoint,
      segment,
      outPoint,
      nextPoint,
      hintedRadius
    )
    if (!collapsed) continue

    collapsedCorners.set(segment.from, collapsed)
    skippedPointIndices.add(segment.to)
  }

  if (!collapsedCorners.size) {
    return { cornerOverrides: new Map(), newContour: cloneContour(contour) }
  }

  const segmentIndexByFrom = new Map<number, number>()
  segments.forEach((segment, index) => {
    segmentIndexByFrom.set(segment.from, index)
  })

  const startIndex = contour.closed
    ? contour.points.findIndex((_point, index) => !skippedPointIndices.has(index))
    : 0
  if (startIndex < 0) {
    return { cornerOverrides: new Map(), newContour: cloneContour(contour) }
  }

  const newPoints: EditablePoint[] = [cloneCollapsedPoint(contour.points, collapsedCorners, startIndex)]
  const newSegments: EditablePathSegment[] = []
  const cornerOverrides = new Map<number, number>()
  const startCorner = collapsedCorners.get(startIndex)
  if (startCorner) {
    cornerOverrides.set(0, startCorner.radius)
  }

  let currentIndex = startIndex
  const maxSteps = segments.length + 1

  for (let step = 0; step < maxSteps; step += 1) {
    const currentSegmentIndex = segmentIndexByFrom.get(currentIndex)
    if (currentSegmentIndex == null) {
      if (contour.closed) {
        return { cornerOverrides: new Map(), newContour: cloneContour(contour) }
      }
      return {
        cornerOverrides,
        newContour: {
          closed: false,
          points: newPoints,
          segments: newSegments
        }
      }
    }

    const currentCorner = collapsedCorners.get(currentIndex)
    const outgoingSegmentIndex = currentCorner
      ? (currentSegmentIndex + 1) % segments.length
      : currentSegmentIndex
    const outgoingSegment = segments[outgoingSegmentIndex]
    if (!outgoingSegment) {
      return { cornerOverrides: new Map(), newContour: cloneContour(contour) }
    }

    if (currentCorner && outgoingSegment.from !== currentCorner.outIndex) {
      return { cornerOverrides: new Map(), newContour: cloneContour(contour) }
    }

    const nextIndex = outgoingSegment.to
    const closesContour = contour.closed && nextIndex === startIndex
    newSegments.push(outgoingSegment.type === 'cubic'
      ? {
          type: 'cubic',
          cp1: clonePoint(outgoingSegment.cp1!),
          cp2: clonePoint(outgoingSegment.cp2!),
          to: closesContour ? 0 : newPoints.length
        }
      : {
          type: 'line',
          to: closesContour ? 0 : newPoints.length
        })

    if (closesContour) {
      return {
        cornerOverrides,
        newContour: {
          closed: true,
          points: newPoints,
          segments: newSegments
        }
      }
    }

    const nextPoint = cloneCollapsedPoint(contour.points, collapsedCorners, nextIndex)
    newPoints.push(nextPoint)
    const nextCorner = collapsedCorners.get(nextIndex)
    if (nextCorner) {
      cornerOverrides.set(newPoints.length - 1, nextCorner.radius)
    }
    currentIndex = nextIndex
  }

  return { cornerOverrides: new Map(), newContour: cloneContour(contour) }
}

export function collapseRoundedCorners(
  model: EditablePathModel,
  defaultRadius: number = 0
): { model: EditablePathModel, overridesByContour: Map<number, Map<number, number>> } {
  const overridesByContour = new Map<number, Map<number, number>>()
  const newContours: EditablePathContour[] = []

  for (let c = 0; c < model.contours.length; c += 1) {
    const contour = model.contours[c]
    const { cornerOverrides, newContour } = collapseRoundedCornersInContour(contour, defaultRadius)
    if (cornerOverrides.size > 0) {
      overridesByContour.set(c, cornerOverrides)
    }
    newContours.push(newContour)
  }

  return {
    model: { contours: newContours },
    overridesByContour
  }
}
