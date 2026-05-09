export type ShapeId =
  | 'base-rectangle'
  | 'base-square'
  | 'base-circle'
  | 'base-line'
  | 'base-triangle'
  | 'base-inverted-triangle'
  | 'base-rhombus'
  | 'base-wide-cross'
  | 'base-parallelogram'
  | 'base-inverted-parallelogram'
  | 'base-trapezoid'
  | 'base-inverted-trapezoid'
  | 'base-doorway'
  | 'base-inverted-arch'
  | 'base-rotated-right-triangle'
  | 'base-half-moon'
  | 'base-pentagon'
  | 'base-arrow-right'
  | 'base-solid-shaft-arrow'
  | 'base-double-solid-shaft-arrow'
  | 'base-star'
  | 'base-heart'

export type ShapeLibraryItem = {
  id: ShapeId
  label: string
  previewKind: string
  defaultWidth: number
  defaultHeight: number
}

export type TextLibraryItem = {
  id: string
  label: string
  text: string
  fontSize: number
  fontWeight?: string
}

export type CanvasPreset = {
  label: string
  value: string
  width: number
  height: number
}

const basicShapeItems: Array<Omit<ShapeLibraryItem, 'previewKind'>> = [
  { id: 'base-rectangle', label: '矩形', defaultWidth: 120, defaultHeight: 76 },
  { id: 'base-square', label: '正方形', defaultWidth: 96, defaultHeight: 96 },
  { id: 'base-circle', label: '圆形', defaultWidth: 96, defaultHeight: 96 },
  { id: 'base-line', label: '直线', defaultWidth: 120, defaultHeight: 2 },
  { id: 'base-triangle', label: '三角形', defaultWidth: 110, defaultHeight: 96 },
  { id: 'base-inverted-triangle', label: '倒三角形', defaultWidth: 110, defaultHeight: 96 },
  { id: 'base-rhombus', label: '菱形', defaultWidth: 100, defaultHeight: 100 },
  { id: 'base-wide-cross', label: '宽十字', defaultWidth: 100, defaultHeight: 100 },
  { id: 'base-parallelogram', label: '平行四边形', defaultWidth: 120, defaultHeight: 76 },
  { id: 'base-inverted-parallelogram', label: '反向平行四边形', defaultWidth: 120, defaultHeight: 76 },
  { id: 'base-trapezoid', label: '梯形', defaultWidth: 120, defaultHeight: 78 },
  { id: 'base-inverted-trapezoid', label: '倒梯形', defaultWidth: 120, defaultHeight: 78 },
  { id: 'base-doorway', label: '拱形', defaultWidth: 96, defaultHeight: 120 },
  { id: 'base-inverted-arch', label: '倒拱形', defaultWidth: 96, defaultHeight: 120 },
  { id: 'base-rotated-right-triangle', label: '直角三角形', defaultWidth: 100, defaultHeight: 100 },
  { id: 'base-half-moon', label: '半月形', defaultWidth: 110, defaultHeight: 78 },
  { id: 'base-pentagon', label: '五边形', defaultWidth: 104, defaultHeight: 100 },
  { id: 'base-arrow-right', label: '箭头', defaultWidth: 118, defaultHeight: 70 },
  { id: 'base-solid-shaft-arrow', label: '空心箭头', defaultWidth: 120, defaultHeight: 78 },
  { id: 'base-double-solid-shaft-arrow', label: '双向箭头', defaultWidth: 120, defaultHeight: 78 },
  { id: 'base-star', label: '五角星', defaultWidth: 110, defaultHeight: 104 },
  { id: 'base-heart', label: '心形', defaultWidth: 108, defaultHeight: 96 }
]

export const basicShapes: ShapeLibraryItem[] = basicShapeItems.map((item) => ({
  ...item,
  previewKind: item.id.replace('base-', '')
}))

export const shapePreviewPaths: Record<ShapeId, string> = {
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

export const textPresets: TextLibraryItem[] = [
  {
    id: 'title',
    label: '标题',
    text: '输入标题',
    fontSize: 42,
    fontWeight: '700'
  },
  {
    id: 'body',
    label: '正文',
    text: '输入文字',
    fontSize: 24,
    fontWeight: '500'
  },
  {
    id: 'caption',
    label: '注释',
    text: '辅助说明',
    fontSize: 18,
    fontWeight: '400'
  }
]

export const canvasPresets: CanvasPreset[] = [
  {
    label: '512×512',
    value: '512x512',
    width: 512,
    height: 512
  },
  {
    label: '256×256',
    value: '256x256',
    width: 256,
    height: 256
  },
  {
    label: '128×128',
    value: '128x128',
    width: 128,
    height: 128
  }
]
