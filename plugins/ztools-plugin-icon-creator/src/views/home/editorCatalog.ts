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

export type IconTemplateItem = {
  id: string
  name: string
  category: string
  description: string
  width: number
  height: number
  background: string
  svg: string
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

export const iconTemplates: IconTemplateItem[] = [
  {
    id: 'app-icon-rounded-square',
    name: 'App Icon 圆角底板',
    category: 'App Icon',
    description: '圆角渐变底板搭配中心符号，适合快速制作应用入口图标。',
    width: 512,
    height: 512,
    background: 'transparent',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="app-bg" x1="96" y1="72" x2="416" y2="440" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#5ee7ff" />
      <stop offset="1" stop-color="#2563eb" />
    </linearGradient>
    <linearGradient id="app-mark" x1="176" y1="144" x2="336" y2="368" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" />
      <stop offset="1" stop-color="#dbeafe" />
    </linearGradient>
  </defs>
  <rect x="72" y="72" width="368" height="368" rx="92" fill="url(#app-bg)" />
  <path d="M256 136 L352 312 H304 L286 276 H226 L208 312 H160 L256 136 Z M242 238 H270 L256 208 Z" fill="url(#app-mark)" />
  <circle cx="348" cy="160" r="34" fill="#ffffff" opacity="0.28" />
</svg>`
  },
  {
    id: 'favicon-letter-mark',
    name: 'Favicon 字母标识',
    category: 'Favicon',
    description: '高对比单字母标识，保留粗边界和安全留白，便于 16px 小尺寸识别。',
    width: 256,
    height: 256,
    background: 'transparent',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect x="32" y="32" width="192" height="192" rx="48" fill="#111827" />
  <path d="M82 180 L128 64 L174 180 H142 L134 154 H122 L114 180 H82 Z M126 132 H130 L128 126 Z" fill="#f9fafb" />
  <rect x="64" y="198" width="128" height="14" rx="7" fill="#38bdf8" />
</svg>`
  },
  {
    id: 'status-success-badge',
    name: '状态成功徽章',
    category: '状态图标',
    description: '圆形状态徽章和对勾结构，可快速改色为成功、警告或错误状态。',
    width: 512,
    height: 512,
    background: 'transparent',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <circle cx="256" cy="256" r="184" fill="#22c55e" />
  <circle cx="256" cy="256" r="136" fill="#ffffff" opacity="0.16" />
  <path d="M168 264 L226 322 L352 190" fill="none" stroke="#ffffff" stroke-width="44" stroke-linecap="round" stroke-linejoin="round" />
</svg>`
  },
  {
    id: 'badge-notification',
    name: '通知徽章模板',
    category: '徽章',
    description: '主体图形叠加右上角提示点，适合制作消息、提醒或角标图标。',
    width: 512,
    height: 512,
    background: 'transparent',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect x="92" y="132" width="328" height="248" rx="54" fill="#4f46e5" />
  <path d="M148 204 H320 M148 256 H278 M148 308 H224" fill="none" stroke="#ffffff" stroke-width="28" stroke-linecap="round" />
  <circle cx="386" cy="142" r="58" fill="#ef4444" stroke="#ffffff" stroke-width="22" />
</svg>`
  },
  {
    id: 'file-type-document',
    name: '文件类型图标',
    category: '文件类型',
    description: '带折角的文件底板和可替换扩展名区域，适合制作不同文件格式图标。',
    width: 512,
    height: 512,
    background: 'transparent',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path d="M136 64 H300 L392 156 V448 H136 Z" fill="#e0f2fe" stroke="#0284c7" stroke-width="18" stroke-linejoin="round" />
  <path d="M300 64 V156 H392" fill="#bae6fd" stroke="#0284c7" stroke-width="18" stroke-linejoin="round" />
  <rect x="172" y="300" width="168" height="64" rx="18" fill="#0284c7" />
  <path d="M196 342 H316" stroke="#ffffff" stroke-width="20" stroke-linecap="round" />
  <path d="M188 220 H324 M188 260 H292" stroke="#0f172a" stroke-width="20" stroke-linecap="round" opacity="0.5" />
</svg>`
  }
]
