import { Circle, FabricObject, Line, Path, Polygon, Rect, Triangle } from 'fabric'
import type { ShapeLibraryItem } from '../editorCatalog'

type AnyFabricObject = FabricObject & Record<string, any>
type PointLike = { x: number; y: number }

const DEFAULT_STROKE = '#333333'
const DEFAULT_FILL = 'transparent'
const DEFAULT_LAST_FILL = '#000000'

function withDefaultStyles<T extends FabricObject>(obj: T, item: ShapeLibraryItem): T {
  const target = obj as AnyFabricObject
  obj.set({
    stroke: DEFAULT_STROKE,
    strokeWidth: 2,
    strokeUniform: true,
    fill: DEFAULT_FILL,
    strokeLineCap: 'round' as CanvasLineCap,
    strokeLineJoin: 'round' as CanvasLineJoin,
    strokeMiterLimit: 4,
    name: item.label
  })
  target.lastFill = DEFAULT_LAST_FILL
  target.shapeId = item.id
  target.booleanEligible = true
  obj.setCoords()
  return obj
}

function polygon(points: PointLike[], item: ShapeLibraryItem) {
  return withDefaultStyles(new Polygon(points), item)
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

function pathFromBox(width: number, height: number, commands: (w: number, h: number) => string, item: ShapeLibraryItem) {
  return withDefaultStyles(new Path(commands(width, height)), item)
}

export function createShape(item: ShapeLibraryItem): FabricObject {
  const w = item.defaultWidth
  const h = item.defaultHeight

  switch (item.id) {
    case 'base-rectangle':
      return withDefaultStyles(new Rect({ width: w, height: h, rx: 4, ry: 4 }), item)
    case 'base-square':
      return withDefaultStyles(new Rect({ width: w, height: h, rx: 4, ry: 4 }), item)
    case 'base-circle':
      return withDefaultStyles(new Circle({ radius: Math.min(w, h) / 2 }), item)
    case 'base-line':
      return withDefaultStyles(new Line([-w / 2, 0, w / 2, 0]), item)
    case 'base-triangle':
      return withDefaultStyles(new Triangle({ width: w, height: h }), item)
    case 'base-inverted-triangle':
      return polygon([
        { x: -w / 2, y: -h / 2 },
        { x: w / 2, y: -h / 2 },
        { x: 0, y: h / 2 }
      ], item)
    case 'base-rhombus':
      return polygon([
        { x: 0, y: -h / 2 },
        { x: w / 2, y: 0 },
        { x: 0, y: h / 2 },
        { x: -w / 2, y: 0 }
      ], item)
    case 'base-wide-cross':
      return polygon([
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
      return polygon([
        { x: -w * 0.34, y: -h / 2 },
        { x: w / 2, y: -h / 2 },
        { x: w * 0.34, y: h / 2 },
        { x: -w / 2, y: h / 2 }
      ], item)
    case 'base-inverted-parallelogram':
      return polygon([
        { x: -w / 2, y: -h / 2 },
        { x: w * 0.34, y: -h / 2 },
        { x: w / 2, y: h / 2 },
        { x: -w * 0.34, y: h / 2 }
      ], item)
    case 'base-trapezoid':
      return polygon([
        { x: -w * 0.32, y: -h / 2 },
        { x: w * 0.32, y: -h / 2 },
        { x: w / 2, y: h / 2 },
        { x: -w / 2, y: h / 2 }
      ], item)
    case 'base-inverted-trapezoid':
      return polygon([
        { x: -w / 2, y: -h / 2 },
        { x: w / 2, y: -h / 2 },
        { x: w * 0.32, y: h / 2 },
        { x: -w * 0.32, y: h / 2 }
      ], item)
    case 'base-doorway':
      return pathFromBox(w, h, (bw, bh) => {
        const x0 = 0
        const x1 = bw
        const y0 = 0
        const y1 = bh
        const r = bw / 2
        const k = 0.5522847498
        return `M ${x0} ${y1} L ${x0} ${r} C ${x0} ${r * (1 - k)} ${r * (1 - k)} ${y0} ${r} ${y0} C ${r * (1 + k)} ${y0} ${x1} ${r * (1 - k)} ${x1} ${r} L ${x1} ${y1} Z`
      }, item)
    case 'base-inverted-arch':
      return pathFromBox(w, h, (bw, bh) => {
        const x0 = 0
        const x1 = bw
        const y0 = 0
        const y1 = bh
        const r = bw / 2
        const k = 0.5522847498
        return `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${bh - r} C ${x1} ${bh - r * (1 - k)} ${r * (1 + k)} ${y1} ${r} ${y1} C ${r * (1 - k)} ${y1} ${x0} ${bh - r * (1 - k)} ${x0} ${bh - r} Z`
      }, item)
    case 'base-rotated-right-triangle':
      return polygon([
        { x: -w / 2, y: -h / 2 },
        { x: w / 2, y: h / 2 },
        { x: -w / 2, y: h / 2 }
      ], item)
    case 'base-half-moon':
      return pathFromBox(w, h, (bw, bh) => {
        const k = 0.5522847498
        const r = bw / 2
        return `M ${r} 0 C ${r * (1 + k)} 0 ${bw} ${bh * 0.45} ${bw} ${bh} L 0 ${bh} C 0 ${bh * 0.45} ${r * (1 - k)} 0 ${r} 0 Z`
      }, item)
    case 'base-pentagon':
      return polygon(regularPolygon(5, w, h), item)
    case 'base-arrow-right': {
      const path = withDefaultStyles(new Path(`M ${-w / 2} 0 L ${w * 0.22} 0 M ${w * 0.22} 0 L ${w * 0.02} ${-h * 0.3} M ${w * 0.22} 0 L ${w * 0.02} ${h * 0.3}`), item)
      path.set({ fill: 'transparent', strokeLineCap: 'round', strokeLineJoin: 'round' })
      return path
    }
    case 'base-solid-shaft-arrow':
      return polygon([
        { x: -w / 2, y: -h * 0.22 },
        { x: w * 0.12, y: -h * 0.22 },
        { x: w * 0.12, y: -h / 2 },
        { x: w / 2, y: 0 },
        { x: w * 0.12, y: h / 2 },
        { x: w * 0.12, y: h * 0.22 },
        { x: -w / 2, y: h * 0.22 }
      ], item)
    case 'base-double-solid-shaft-arrow':
      return polygon([
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
      return polygon(starPoints(w, h), item)
    case 'base-heart':
      return pathFromBox(w, h, (bw, bh) => {
        const cx = bw / 2
        return `M ${cx} ${bh} C ${bw * 0.15} ${bh * 0.7} 0 ${bh * 0.54} 0 ${bh * 0.3} C 0 ${bh * 0.1} ${bw * 0.14} 0 ${bw * 0.32} 0 C ${bw * 0.42} 0 ${bw * 0.49} ${bh * 0.08} ${cx} ${bh * 0.18} C ${bw * 0.51} ${bh * 0.08} ${bw * 0.58} 0 ${bw * 0.68} 0 C ${bw * 0.86} 0 ${bw} ${bh * 0.1} ${bw} ${bh * 0.3} C ${bw} ${bh * 0.54} ${bw * 0.85} ${bh * 0.7} ${cx} ${bh} Z`
      }, item)
    default:
      return withDefaultStyles(new Rect({ width: w, height: h, rx: 4, ry: 4 }), item)
  }
}
