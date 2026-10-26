/**
 * 脏数据容错：从 db 读出的文档逐字段归一化。
 * 目标：任何一条坏数据最多自身被丢弃（返回 null），绝不让整个列表白屏。
 * 长度硬上限：content/ocrText/keyword 超限时截断保留，防止恶意或损坏的导入文件拖垮内存与检索。
 */
import {
  CONTENT_SANITIZE_MAX_BYTES,
  DEFAULT_SETTINGS,
  MAX_TAG_LEN,
  MAX_TAGS,
  type Group,
  type Memo,
  type MemoImage,
  type Settings
} from './types'
import { MAX_MEMO_IMAGES, isImageOnlyContent, parseImageTokens } from './inlineImage'

/** UTF-8 字节数（与编辑器侧 new Blob().size 口径一致，避免中文内容绕过上限）。 */
function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length
}

/** 截断到不超过 maxBytes（按 UTF-8 计），从尾部往前回退完整字符。 */
function clampBytes(text: string, maxBytes: number): string {
  if (utf8Bytes(text) <= maxBytes) return text
  // 按字符粒度二分收缩：超限内容本来就是异常数据，不追求精确边界
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (utf8Bytes(text.slice(0, mid)) <= maxBytes) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, Math.max(0, lo))
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback
}

function asInt(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback
}

function asTimestamp(v: unknown, fallback: number | null): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.trunc(v)
  return fallback
}

/** 归一化 MIME：仅接受 image/* 并小写；非法值回退 image/png。 */
function normalizeMime(raw: unknown): string {
  const value = asString(raw).trim()
  return /^image\/[a-z0-9.+-]+$/i.test(value) ? value.toLowerCase() : 'image/png'
}

/** 归一化一张内嵌图片；id 缺失返回 null（该图被丢弃）。 */
function sanitizeMemoImage(raw: unknown): MemoImage | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = asString(r.id).trim()
  if (!id) return null
  return {
    id: id.slice(0, 64),
    mime: normalizeMime(r.mime),
    hash: asString(r.hash).trim().slice(0, 32),
    width: Math.max(0, asInt(r.width, 0)),
    height: Math.max(0, asInt(r.height, 0)),
    bytes: Math.max(0, asInt(r.bytes, 0)),
    ocrText: clampBytes(asString(r.ocrText).trim(), 32 * 1024) || undefined
  }
}

/**
 * 归一化一条备忘；id 缺失或类型根本不对时返回 null（该条被隔离）。
 * 旧版软删除（deletedAt）字段直接忽略——回收站已移除，遗留软删文档由存储层物理清理。
 * 图片：v1 单图结构（imageHash 等）就地升级为 images[0]（槽 ID 复用 memoId），
 * kind 依「正文除图片标记外无文字」推导为纯图（'image'）或文字/混排（'text'）。
 */
export function sanitizeMemo(raw: unknown): Memo | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = asString(r.id).trim()
  if (!id) return null
  const now = Date.now()
  const updatedAt = asTimestamp(r.updatedAt, null)
  // createdAt 缺失时优先借用 updatedAt（保持 created 排序稳定），都缺才用当前时间
  const createdAt = asTimestamp(r.createdAt, updatedAt ?? now) ?? now
  const tags = Array.isArray(r.tags)
    ? r.tags
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim().slice(0, MAX_TAG_LEN))
        .filter((t) => t.length > 0)
        .slice(0, MAX_TAGS)
    : []
  const keywordRaw = asString(r.keyword).trim().slice(0, 60)
  const legacyOcr = clampBytes(asString(r.ocrText).trim(), 32 * 1024)

  // 图片数组归一化；v1 旧结构（无 images 但有 imageHash）合成为 images[0]
  let images: MemoImage[] = Array.isArray(r.images)
    ? r.images.map(sanitizeMemoImage).filter((img): img is MemoImage => img !== null)
    : []
  if (images.length === 0 && asString(r.imageHash).trim()) {
    images = [
      {
        id,
        mime: normalizeMime(r.mime),
        hash: asString(r.imageHash).trim(),
        width: Math.max(0, asInt(r.imageWidth, 0)),
        height: Math.max(0, asInt(r.imageHeight, 0)),
        bytes: Math.max(0, asInt(r.imageBytes, 0)),
        ocrText: legacyOcr || undefined
      }
    ]
  }
  if (images.length > MAX_MEMO_IMAGES) images = images.slice(0, MAX_MEMO_IMAGES)
  let content = clampBytes(asString(r.content), CONTENT_SANITIZE_MAX_BYTES)
  // 兜底保证图片可见：携带图片的正文必须至少引用一张（否则图存在却无处渲染、
  // 编辑保存时会被当作未引用图片丢弃）；旧结构升级在这里补写首个标记
  if (images.length > 0 && parseImageTokens(content).length === 0) {
    content = `{img:${images[0]!.id}}` + (content ? `\n${content}` : '')
  }

  return {
    id,
    title: clampBytes(asString(r.title).trim(), 8 * 1024),
    content,
    kind: images.length > 0 && isImageOnlyContent(content) ? 'image' : 'text',
    images: images.length > 0 ? images : undefined,
    // 全部图片识别文字的合并视图（检索/导出/展示共用；逐图明细在 images[].ocrText）
    ocrText: images.map((img) => img.ocrText ?? '').filter(Boolean).join('\n') || undefined,
    groupId: typeof r.groupId === 'string' && r.groupId ? r.groupId : null,
    tags,
    keyword: keywordRaw || undefined,
    pinned: asBool(r.pinned),
    sensitive: asBool(r.sensitive),
    order: asInt(r.order, Number.MAX_SAFE_INTEGER / 2),
    useCount: Math.max(0, asInt(r.useCount, 0)),
    lastUsedAt: asTimestamp(r.lastUsedAt, null),
    createdAt,
    updatedAt: updatedAt ?? createdAt
  }
}

/** 归一化一个分组；id/name 缺失返回 null。 */
export function sanitizeGroup(raw: unknown): Group | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = asString(r.id).trim()
  const name = asString(r.name).trim()
  if (!id || !name) return null
  const color = asString(r.color).trim()
  return {
    id,
    name: name.slice(0, 30),
    color: /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : undefined,
    order: asInt(r.order, Number.MAX_SAFE_INTEGER / 2)
  }
}

/**
 * 归一化设置：任何坏字段回退默认值，永不返回 null（设置坏了也要能用）。
 */
export function sanitizeSettings(raw: unknown): Settings {
  const base = { ...DEFAULT_SETTINGS }
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>
  const sortBy = asString(r.sortBy)
  const density = asString(r.density)
  const enterAction = asString(r.enterAction)
  const listMode = asString(r.listMode)
  const themeMode = asString(r.themeMode)
  return {
    schemaVersion: asInt(r.schemaVersion, base.schemaVersion),
    enterAction: enterAction === 'copy' ? 'copy' : enterAction === 'paste' ? 'paste' : base.enterAction,
    sortBy: (['smart', 'manual', 'updated', 'created'] as const).includes(sortBy as never)
      ? (sortBy as Settings['sortBy'])
      : base.sortBy,
    density: density === 'compact' ? 'compact' : density === 'comfortable' ? 'comfortable' : base.density,
    listMode: listMode === 'full' ? 'full' : listMode === 'brief' ? 'brief' : base.listMode,
    themeMode:
      themeMode === 'light' || themeMode === 'dark' || themeMode === 'system' ? themeMode : base.themeMode,
    showPreviewPane: asBool(r.showPreviewPane, base.showPreviewPane),
    restoreClipboard: asBool(r.restoreClipboard, base.restoreClipboard),
    recordUsage: asBool(r.recordUsage, base.recordUsage),
    imageOcrEnabled: asBool(r.imageOcrEnabled, base.imageOcrEnabled),
    imageGridView: asBool(r.imageGridView, base.imageGridView)
  }
}

/** 归一化分组集合文档（数组或坏形状都收敛为分组数组）。 */
export function sanitizeGroupList(raw: unknown): Group[] {
  if (!Array.isArray(raw)) return []
  return raw.map(sanitizeGroup).filter((g): g is Group => g !== null)
}
