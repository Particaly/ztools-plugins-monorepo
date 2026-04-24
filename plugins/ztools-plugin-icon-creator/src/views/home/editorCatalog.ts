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
    label: 'FHD 1920×1080',
    value: '1920x1080',
    width: 1920,
    height: 1080
  },
  {
    label: '方形 1080×1080',
    value: '1080x1080',
    width: 1080,
    height: 1080
  },
  {
    label: '竖版 1080×1350',
    value: '1080x1350',
    width: 1080,
    height: 1350
  },
  {
    label: 'A4 2480×3508',
    value: '2480x3508',
    width: 2480,
    height: 3508
  }
]
