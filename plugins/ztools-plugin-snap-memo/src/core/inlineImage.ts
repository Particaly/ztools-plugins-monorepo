/**
 * 行内图片标记（纯函数）：正文中以 `{img:<slotId>}` 引用 memo.images 里的图片槽，
 * 实现图文混排的存储模型。渲染层把标记替换为 <img>，粘贴文本路径把标记剥离。
 *
 * 约定：
 * - slotId 字符集与 newMemoId 一致（字母数字、-、_），长度 4~64；
 * - 标记与占位符共用单花括号家族，但 `img:` 前缀不属于已知占位符，解析器原样保留，
 *   由本模块在各出口（搜索/粘贴/导出）显式处理；
 * - 同一槽可被引用多次（渲染两份同图），uniqueImageIds 按出现顺序去重。
 */
import type { Memo } from './types'

/** 行内图片标记（全局正则，使用前重置 lastIndex）。 */
export const IMG_TOKEN_RE = /\{img:([A-Za-z0-9_-]{4,64})\}/g

/** 单条备忘允许的图片数量上限（保存前校验，防滥用拖垮列表与附件存储）。 */
export const MAX_MEMO_IMAGES = 32

export interface ImageToken {
  /** 标记在原文中的起始下标（含 `{`）。 */
  start: number
  /** 结束下标（不含 `}`）。 */
  end: number
  id: string
}

/** 解析正文中全部图片标记（按出现顺序）。 */
export function parseImageTokens(content: string): ImageToken[] {
  const tokens: ImageToken[] = []
  IMG_TOKEN_RE.lastIndex = 0
  for (let m = IMG_TOKEN_RE.exec(content); m; m = IMG_TOKEN_RE.exec(content)) {
    tokens.push({ start: m.index, end: m.index + m[0].length, id: m[1]! })
  }
  return tokens
}

export type InlineSegment = { type: 'text'; text: string } | { type: 'image'; id: string }

/** 把正文拆为文字/图片标记交替的片段序列（渲染与编辑器共用的规范化视图）。 */
export function splitByImageTokens(content: string): InlineSegment[] {
  const tokens = parseImageTokens(content)
  if (tokens.length === 0) return content ? [{ type: 'text', text: content }] : []
  const segments: InlineSegment[] = []
  let cursor = 0
  for (const token of tokens) {
    if (token.start > cursor) segments.push({ type: 'text', text: content.slice(cursor, token.start) })
    segments.push({ type: 'image', id: token.id })
    cursor = token.end
  }
  if (cursor < content.length) segments.push({ type: 'text', text: content.slice(cursor) })
  return segments
}

/** 移除全部图片标记（粘贴文本与纯文本导出用）。 */
export function stripImageTokens(content: string): string {
  if (!content.includes('{img:')) return content
  return content.replace(IMG_TOKEN_RE, '')
}

/** 等长替换标记为空格：保持原文下标不变，检索/高亮在与渲染一致的字面视图上进行。 */
export function maskImageTokens(content: string): string {
  if (!content.includes('{img:')) return content
  return content.replace(IMG_TOKEN_RE, (token) => ' '.repeat(token.length))
}

/** 按映射表替换标记中的槽 ID（导入重分配、创建副本时保持内容与图片数据对齐）。 */
export function replaceImageTokenIds(content: string, mapping: Map<string, string>): string {
  if (mapping.size === 0 || !content.includes('{img:')) return content
  return content.replace(IMG_TOKEN_RE, (token, id: string) => {
    const next = mapping.get(id)
    return next ? `{img:${next}}` : token
  })
}

/** 正文引用的槽 ID（按出现顺序去重）。 */
export function uniqueImageIds(content: string): string[] {
  const seen = new Set<string>()
  for (const token of parseImageTokens(content)) seen.add(token.id)
  return [...seen]
}

/** 正文除图片标记外是否没有任何文字且至少引用一张图（纯图条目判定）。 */
export function isImageOnlyContent(content: string): boolean {
  if (!content.includes('{img:')) return false
  return stripImageTokens(content).trim().length === 0
}

/** memo 是否携带图片（含迁移前的旧结构）。 */
export function hasImages(memo: Pick<Memo, 'images' | 'imageHash'>): boolean {
  return (memo.images?.length ?? 0) > 0 || Boolean(memo.imageHash)
}

/** memo 第一张图的槽 ID；无图返回 null。 */
export function firstImageSlot(memo: Pick<Memo, 'images' | 'id' | 'imageHash'>): string | null {
  if (memo.images && memo.images.length > 0) return memo.images[0]!.id
  // 旧结构：唯一图片挂在 memo 文档附件上，槽 ID 约定等于 memoId（见 migration）
  if (memo.imageHash) return memo.id
  return null
}

/** memo 全部图片的槽 ID（新结构展开；旧结构退化为 memoId）。 */
export function allImageSlots(memo: Pick<Memo, 'images' | 'id' | 'imageHash'>): string[] {
  if (memo.images && memo.images.length > 0) return memo.images.map((img) => img.id)
  if (memo.imageHash) return [memo.id]
  return []
}
