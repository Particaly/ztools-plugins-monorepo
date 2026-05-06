import { Circle, FabricObject } from 'fabric'
import type { ShapeLibraryItem } from '../editorCatalog'
import { createEditablePathObject, pathEditableModel, polygonEditablePath, type EditablePathSegment } from '../geometry/editablePath'

type AnyFabricObject = FabricObject & Record<string, any>
type PointLike = { x: number; y: number }

const DEFAULT_STROKE = '#333333'
const DEFAULT_FILL = 'transparent'
const DEFAULT_LAST_FILL = '#000000'
const DEFAULT_STROKE_WIDTH = 2
const DEFAULT_KALEIDOSCOPE_COUNT = 6

function applyDefaultKaleidoscopeMetadata(obj: FabricObject) {
  const target = obj as AnyFabricObject
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

function getDefaultStrokeDashArray(strokeWidth: number): [number, number] {
  return [Math.max(1, strokeWidth * 3), Math.max(1, strokeWidth * 2)]
}

function withDefaultStyles<T extends FabricObject>(obj: T, item: ShapeLibraryItem): T {
  const target = obj as AnyFabricObject
  obj.set({
    stroke: DEFAULT_STROKE,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    strokeUniform: true,
    fill: DEFAULT_FILL,
    strokeLineCap: 'round' as CanvasLineCap,
    strokeLineJoin: 'round' as CanvasLineJoin,
    strokeMiterLimit: 4,
    name: item.label
  })
  target.lastFill = DEFAULT_LAST_FILL
  target.lastStrokeDashArray = getDefaultStrokeDashArray(DEFAULT_STROKE_WIDTH)
  target.shapeId = item.id
  target.booleanEligible = true
  applyDefaultKaleidoscopeMetadata(obj)
  obj.setCoords()
  return obj
}

function editablePolygon(points: PointLike[], item: ShapeLibraryItem, cornerRadius = 0, closed = true) {
  return withDefaultStyles(createEditablePathObject(polygonEditablePath(points, closed), cornerRadius), item)
}

function editablePath(points: PointLike[], segments: EditablePathSegment[], item: ShapeLibraryItem, cornerRadius = 0, closed = true) {
  return withDefaultStyles(createEditablePathObject(pathEditableModel(points, segments, closed), cornerRadius), item)
}

function regularPolygon(sides: number, width: number, height: number, rotation = -Math.PI / 2) {
  const points: PointLike[] = []
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (Math.PI * 2 * i) / sides
    points.push({ x: Math.cos(angle) * width / 2, y: Math.sin(angle) * height / 2 })
  }
  return points
}

function starPoints(width: number, height: number) {
  const points: PointLike[] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.5 : 0.22
    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 10
    points.push({ x: Math.cos(angle) * width * r, y: Math.sin(angle) * height * r })
  }
  return points
}


export function createShape(item: ShapeLibraryItem): FabricObject {
  const w = item.defaultWidth
  const h = item.defaultHeight

  switch (item.id) {
    case 'base-rectangle':
      return editablePolygon([
        { x: -w / 2, y: -h / 2 },
        { x: w / 2, y: -h / 2 },
        { x: w / 2, y: h / 2 },
        { x: -w / 2, y: h / 2 }
      ], item, 4)
    case 'base-square':
      return editablePolygon([
        { x: -w / 2, y: -h / 2 },
        { x: w / 2, y: -h / 2 },
        { x: w / 2, y: h / 2 },
        { x: -w / 2, y: h / 2 }
      ], item, 4)
    case 'base-circle':
      return withDefaultStyles(new Circle({ radius: Math.min(w, h) / 2 }), item)
    case 'base-line':
      return editablePolygon([{ x: -w / 2, y: 0 }, { x: w / 2, y: 0 }], item, 0, false)
    case 'base-triangle':
      return editablePolygon([
        { x: -w / 2, y: h / 2 },
        { x: 0, y: -h / 2 },
        { x: w / 2, y: h / 2 }
      ], item)
    case 'base-inverted-triangle':
      return editablePolygon([
        { x: -w / 2, y: -h / 2 },
        { x: w / 2, y: -h / 2 },
        { x: 0, y: h / 2 }
      ], item)
    case 'base-rhombus':
      return editablePolygon([
        { x: 0, y: -h / 2 },
        { x: w / 2, y: 0 },
        { x: 0, y: h / 2 },
        { x: -w / 2, y: 0 }
      ], item)
    case 'base-wide-cross':
      return editablePolygon([
        { x: -w * 0.14, y: -h / 2 },
        { x: w * 0.14, y: -h / 2 },
        { x: w * 0.14, y: -h * 0.14 },
        { x: w / 2, y: -h * 0.14 },
        { x: w / 2, y: h * 0.14 },
        { x: w * 0.14, y: h * 0.14 },
        { x: w * 0.14, y: h / 2 },
        { x: -w * 0.14, y: h / 2 },
        { x: -w * 0.14, y: h * 0.14 },
        { x: -w / 2, y: h * 0.14 },
        { x: -w / 2, y: -h * 0.14 },
        { x: -w * 0.14, y: -h * 0.14 }
      ], item)
    case 'base-parallelogram':
      return editablePolygon([
        { x: -w * 0.34, y: -h / 2 },
        { x: w / 2, y: -h / 2 },
        { x: w * 0.34, y: h / 2 },
        { x: -w / 2, y: h / 2 }
      ], item)
    case 'base-inverted-parallelogram':
      return editablePolygon([
        { x: -w / 2, y: -h / 2 },
        { x: w * 0.34, y: -h / 2 },
        { x: w / 2, y: h / 2 },
        { x: -w * 0.34, y: h / 2 }
      ], item)
    case 'base-trapezoid':
      return editablePolygon([
        { x: -w * 0.32, y: -h / 2 },
        { x: w * 0.32, y: -h / 2 },
        { x: w / 2, y: h / 2 },
        { x: -w / 2, y: h / 2 }
      ], item)
    case 'base-inverted-trapezoid':
      return editablePolygon([
        { x: -w / 2, y: -h / 2 },
        { x: w / 2, y: -h / 2 },
        { x: w * 0.32, y: h / 2 },
        { x: -w * 0.32, y: h / 2 }
      ], item)
    case 'base-doorway': {
      const r = w / 2
      const k = 0.5522847498
      const points = [{ x: 0, y: h }, { x: 0, y: r }, { x: r, y: 0, selectable: false }, { x: w, y: r }, { x: w, y: h }]
      return editablePath(points, [
        { type: 'line', to: 1 },
        { type: 'cubic', cp1: { x: 0, y: r * (1 - k) }, cp2: { x: r * (1 - k), y: 0 }, to: 2 },
        { type: 'cubic', cp1: { x: r * (1 + k), y: 0 }, cp2: { x: w, y: r * (1 - k) }, to: 3 },
        { type: 'line', to: 4 },
        { type: 'line', to: 0 }
      ], item)
    }
    case 'base-inverted-arch': {
      const r = w / 2
      const k = 0.5522847498
      const y = h - r
      const points = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y }, { x: r, y: h, selectable: false }, { x: 0, y }]
      return editablePath(points, [
        { type: 'line', to: 1 },
        { type: 'line', to: 2 },
        { type: 'cubic', cp1: { x: w, y: h - r * (1 - k) }, cp2: { x: r * (1 + k), y: h }, to: 3 },
        { type: 'cubic', cp1: { x: r * (1 - k), y: h }, cp2: { x: 0, y: h - r * (1 - k) }, to: 4 },
        { type: 'line', to: 0 }
      ], item)
    }
    case 'base-rotated-right-triangle':
      return editablePolygon([
        { x: -w / 2, y: -h / 2 },
        { x: w / 2, y: h / 2 },
        { x: -w / 2, y: h / 2 }
      ], item)
    case 'base-half-moon': {
      const k = 0.5522847498
      const r = w / 2
      const points = [{ x: r, y: 0, selectable: false }, { x: w, y: h }, { x: 0, y: h }]
      return editablePath(points, [
        { type: 'cubic', cp1: { x: r * (1 + k), y: 0 }, cp2: { x: w, y: h * 0.45 }, to: 1 },
        { type: 'line', to: 2 },
        { type: 'cubic', cp1: { x: 0, y: h * 0.45 }, cp2: { x: r * (1 - k), y: 0 }, to: 0 }
      ], item)
    }
    case 'base-pentagon':
      return editablePolygon(regularPolygon(5, w, h), item)
    case 'base-arrow-right': {
      const path = editablePolygon([
        { x: -w / 2, y: 0 },
        { x: w * 0.22, y: 0 },
        { x: w * 0.02, y: -h * 0.3 },
        { x: w * 0.22, y: 0 },
        { x: w * 0.02, y: h * 0.3 }
      ], item, 0, false)
      path.set({ fill: 'transparent', strokeLineCap: 'round', strokeLineJoin: 'round' })
      return path
    }
    case 'base-solid-shaft-arrow':
      return editablePolygon([
        { x: -w / 2, y: -h * 0.22 },
        { x: w * 0.12, y: -h * 0.22 },
        { x: w * 0.12, y: -h / 2 },
        { x: w / 2, y: 0 },
        { x: w * 0.12, y: h / 2 },
        { x: w * 0.12, y: h * 0.22 },
        { x: -w / 2, y: h * 0.22 }
      ], item)
    case 'base-double-solid-shaft-arrow':
      return editablePolygon([
        { x: -w / 2, y: 0 },
        { x: -w * 0.12, y: -h / 2 },
        { x: -w * 0.12, y: -h * 0.22 },
        { x: w * 0.12, y: -h * 0.22 },
        { x: w * 0.12, y: -h / 2 },
        { x: w / 2, y: 0 },
        { x: w * 0.12, y: h / 2 },
        { x: w * 0.12, y: h * 0.22 },
        { x: -w * 0.12, y: h * 0.22 },
        { x: -w * 0.12, y: h / 2 }
      ], item)
    case 'base-star':
      return editablePolygon(starPoints(w, h), item)
    case 'base-heart': {
      const cx = w / 2
      const points = [
        { x: cx, y: h },
        { x: 0, y: h * 0.3 },
        { x: w * 0.32, y: 0 },
        { x: cx, y: h * 0.18, selectable: false },
        { x: w * 0.68, y: 0 },
        { x: w, y: h * 0.3 }
      ]
      return editablePath(points, [
        { type: 'cubic', cp1: { x: w * 0.15, y: h * 0.7 }, cp2: { x: 0, y: h * 0.54 }, to: 1 },
        { type: 'cubic', cp1: { x: 0, y: h * 0.1 }, cp2: { x: w * 0.14, y: 0 }, to: 2 },
        { type: 'cubic', cp1: { x: w * 0.42, y: 0 }, cp2: { x: w * 0.49, y: h * 0.08 }, to: 3 },
        { type: 'cubic', cp1: { x: w * 0.51, y: h * 0.08 }, cp2: { x: w * 0.58, y: 0 }, to: 4 },
        { type: 'cubic', cp1: { x: w * 0.86, y: 0 }, cp2: { x: w, y: h * 0.1 }, to: 5 },
        { type: 'cubic', cp1: { x: w, y: h * 0.54 }, cp2: { x: w * 0.85, y: h * 0.7 }, to: 0 }
      ], item)
    }
    default:
      return editablePolygon([
        { x: -w / 2, y: -h / 2 },
        { x: w / 2, y: -h / 2 },
        { x: w / 2, y: h / 2 },
        { x: -w / 2, y: h / 2 }
      ], item, 4)
  }
}
