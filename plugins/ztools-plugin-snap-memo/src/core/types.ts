/**
 * 领域模型定义（与 docs/PLAN.md 第 3 节一致）。
 * 本模块是纯类型与常量，禁止引入 Vue / platform 依赖。
 */

/**
 * 备忘内嵌图片（图文混排）：像素存独立桩文档 `sm/att/<id>` 的附件，
 * 正文用 `{img:<id>}` 标记引用（见 core/inlineImage.ts），同一图可多处引用。
 */
export interface MemoImage {
  /** 图片槽 ID（全局唯一；迁移前的旧图约定复用 memoId）。 */
  id: string
  mime: string
  /** 图片内容指纹（FNV-1a），用于重复检测与导入去重。 */
  hash: string
  /** 原始像素宽/高（保存时解析图片头得到）；缺失时展示层用缩略图管线实测值兜底。 */
  width: number
  height: number
  /** 解码后字节数（体积徽标用）。 */
  bytes: number
  /** 该图 OCR 识别文本（设置开启识别后写入），参与检索。 */
  ocrText?: string
}

export interface Memo {
  id: string
  /** 可为空；为空时列表展示内容首行。 */
  title: string
  /**
   * 纯文本，支持多行、占位符与行内图片标记 `{img:<slotId>}`（图文混排）。
   * 纯图条目（正文只有图片标记）content 即标记本身。
   */
  content: string
  /**
   * 内容类型：'image' = 纯图条目（回车粘贴图片本体）；'text' = 文字或图文混排
   * （回车粘贴文字，图片标记剥离）。由 sanitize 依 content/images 推导，不手工维护。
   */
  kind?: 'text' | 'image'
  /** 条目携带的全部图片（含元数据与 OCR 文本）。 */
  images?: MemoImage[]
  // ---- 以下单图字段为 v1 旧结构，读取时迁移为 images[0]，保存时不再写入 ----
  /** @deprecated 旧结构：图片 MIME。 */
  mime?: string
  /** @deprecated 旧结构：图片内容指纹。 */
  imageHash?: string
  /** @deprecated 旧结构：图片原始像素宽。 */
  imageWidth?: number
  /** @deprecated 旧结构：图片原始像素高。 */
  imageHeight?: number
  /** @deprecated 旧结构：图片解码后字节数。 */
  imageBytes?: number
  /** @deprecated 旧结构：图片 OCR 识别文本（新结构在 images[].ocrText）。 */
  ocrText?: string
  /** null 表示未分组。 */
  groupId: string | null
  tags: string[]
  /** 自定义触发词：在 ZTools 主搜索栏输入后回车直接粘贴（依赖宿主动态 Feature，能力缺失时隐藏）。 */
  keyword?: string
  pinned: boolean
  /** 敏感项：列表与预览中默认遮罩，不宣称加密。 */
  sensitive: boolean
  /** 手动排序序号（升序），仅 sortBy='manual' 或同分组拖拽时生效。 */
  order: number
  useCount: number
  lastUsedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface Group {
  id: string
  name: string
  /** CSS 颜色（hex），可空。 */
  color?: string
  order: number
}

export type EnterAction = 'paste' | 'copy'
export type SortBy = 'smart' | 'manual' | 'updated' | 'created'
export type Density = 'comfortable' | 'compact'
/** 列表条目展示模式：brief 简洁（标题 + 两行摘要），full 完整（条目内平铺全部内容）。 */
export type ListMode = 'brief' | 'full'
/** 主题模式：system 跟随系统（默认），light 亮色，dark 暗色。 */
export type ThemeMode = 'system' | 'light' | 'dark'

export interface Settings {
  schemaVersion: number
  /** 回车默认行为；Shift+回车恒为反向动作（粘贴↔仅复制）。 */
  enterAction: EnterAction
  sortBy: SortBy
  density: Density
  /** 列表条目展示模式；条目自身的展开按钮在该值基础上取反。 */
  listMode: ListMode
  /** 主题模式：跟随系统 / 亮色 / 暗色。 */
  themeMode: ThemeMode
  showPreviewPane: boolean
  /** 粘贴后恢复原剪贴板内容。 */
  restoreClipboard: boolean
  /** 记录使用次数与最近使用时间。 */
  recordUsage: boolean
  /** 图片文字识别（OCR）：保存图片备忘时自动调用 ZTools OCR 提供商识别文字，结果可被搜索。 */
  imageOcrEnabled: boolean
  /** 「图片」筛选下用网格墙展示（true）还是普通列表行（false）。 */
  imageGridView: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  enterAction: 'paste',
  sortBy: 'smart',
  density: 'comfortable',
  listMode: 'brief',
  themeMode: 'system',
  showPreviewPane: true,
  restoreClipboard: false,
  recordUsage: true,
  imageOcrEnabled: false,
  imageGridView: false
}

/** db 文档 ID 约定：每条备忘一个文档，分组/设置/快照各自独立文档；
 *  图片槽是仅挂附件的空桩文档（sm/att/<slotId>，像素不进同步正文）。 */
export const DOC_PREFIX = {
  memo: 'sm/memo/',
  image: 'sm/att/',
  groups: 'sm/groups',
  settings: 'sm/settings',
  backup: 'sm/backup'
} as const

/** dbStorage 轻量键。 */
export const KV_KEY = {
  draft: 'sm/draft',
  seeded: 'sm/seeded'
} as const

/** 内容长度阈值：超长内容对 db 单文档有风险，保存前提醒 / 拒绝。 */
export const CONTENT_WARN_BYTES = 64 * 1024
export const CONTENT_MAX_BYTES = 256 * 1024
/** 读取容错时的硬上限：超过该长度的内容截断保留，防止坏文档拖垮内存与检索。 */
export const CONTENT_SANITIZE_MAX_BYTES = 1024 * 1024

/** 图片字节上限：dataURL 解码后的原始字节数，超出拒绝保存（附件体积保护）。 */
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024

/** 单条标签数量 / 长度上限，防止滥用导致列表破版。 */
export const MAX_TAGS = 8
export const MAX_TAG_LEN = 24

/** 分组筛选视图（顶部 chips）；images 为图片类型筛选（kind='image'）。 */
export type GroupFilter = 'all' | 'pinned' | 'recent' | 'images' | `group:${string}`

export function isGroupFilter(v: unknown): v is GroupFilter {
  return (
    v === 'all' || v === 'pinned' || v === 'recent' || v === 'images' || (typeof v === 'string' && v.startsWith('group:'))
  )
}
