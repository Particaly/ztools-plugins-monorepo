/**
 * 检索与排序（纯函数）。
 *
 * 匹配面：标题 / 内容 / 标签 / 分组名 / 触发词 / 图片 OCR 文本，
 * 另加各字段的拼音（全拼 + 声母）。
 * 语法：空白分词（AND 语义）；`#标签`、`@分组` 为过滤前缀（只做筛选不加分）；
 *       `-词` 排除词（命中即剔除）；`"词组"` 引号精确短语（原文连续包含）。
 * 打分：精确 > 前缀 > 词首 > 子串；字段权重 触发词×4 标题×3 标签×2 内容×1 OCR×1 分组×1。
 * 排序：置顶恒优先，其后按得分、frecency、手动序号。
 */
import type { Memo, SortBy } from './types'
import { frecencyScore } from './frecency'
import { getPinyinIndex, type PinyinIndex } from './pinyin'
import { maskImageTokens } from './inlineImage'

/** 拼音索引的内容前缀长度：字面匹配用全文，只有拼音转换（开销大）截断到该长度。 */
export const PINYIN_CONTENT_LIMIT = 2000

export interface SearchEntry {
  memoId: string
  title: string
  /** 归一化全文（字面匹配用，不再截断）。 */
  content: string
  tags: string[]
  groupName: string
  keyword: string
  /** 图片 OCR 识别文本（非图片条目为空串）。 */
  ocr: string
  pyTitle: PinyinIndex
  pyContent: PinyinIndex
  pyTags: PinyinIndex
  pyGroup: PinyinIndex
  pyOcr: PinyinIndex
}

export interface ScoredMemo {
  memo: Memo
  score: number
}

/** NFKC 归一并小写：全角字母数字（ｑｑ → qq）与中文输入习惯兼容。 */
export function normalizeText(text: string): string {
  return text.normalize('NFKC').toLowerCase()
}

export interface ParsedQuery {
  /** 普通匹配词（AND）。 */
  tokens: string[]
  /** `"精确短语"`（原文连续包含才算命中，不加分）。 */
  phrases: string[]
  /** `-排除词`（任一命中即剔除）。 */
  excludes: string[]
  /** `#tag` 过滤（已去 #，小写）。 */
  tagFilters: string[]
  /** `@group` 过滤（已去 @，小写）。 */
  groupFilters: string[]
}

/** 解析查询串；全部为空白时得到空查询。引号短语先抽出再分词。 */
export function parseQuery(query: string): ParsedQuery {
  const tokens: string[] = []
  const phrases: string[] = []
  const excludes: string[] = []
  const tagFilters: string[] = []
  const groupFilters: string[] = []
  const withoutPhrases = normalizeText(query).replace(/"([^"]+)"/g, (_, inner: string) => {
    if (inner.trim()) phrases.push(inner.trim())
    return ' '
  })
  for (const raw of withoutPhrases.split(/\s+/)) {
    if (!raw) continue
    if (raw.startsWith('#') && raw.length > 1) tagFilters.push(raw.slice(1))
    else if (raw.startsWith('@') && raw.length > 1) groupFilters.push(raw.slice(1))
    else if (raw.startsWith('-') && raw.length > 1) excludes.push(raw.slice(1))
    else tokens.push(raw)
  }
  return { tokens, phrases, excludes, tagFilters, groupFilters }
}

/** 为一条备忘构建检索条目（store 侧请用 getCachedSearchEntry，按键击间复用）。 */
export function buildSearchEntry(memo: Memo, groupName: string): SearchEntry {
  const title = normalizeText(memo.title)
  // 图片标记等长替换为空格：检索/高亮在纯文字视图上进行，且下标与原文一一对应
  const content = normalizeText(maskImageTokens(memo.content))
  const tags = memo.tags.map(normalizeText)
  const ocr = normalizeText(memo.ocrText ?? '')
  return {
    memoId: memo.id,
    title,
    content,
    tags,
    groupName: normalizeText(groupName),
    keyword: normalizeText(memo.keyword ?? ''),
    ocr: normalizeText(ocr),
    pyTitle: getPinyinIndex(memo.title || maskImageTokens(memo.content).slice(0, 40)),
    pyContent: getPinyinIndex(content.slice(0, PINYIN_CONTENT_LIMIT)),
    pyTags: getPinyinIndex(memo.tags.join(' ')),
    pyGroup: getPinyinIndex(groupName),
    pyOcr: getPinyinIndex(ocr.slice(0, PINYIN_CONTENT_LIMIT))
  }
}

/** 条目缓存：同一 memo 未编辑时（updatedAt/分组名不变）跨按键复用，避免每次重建拼音索引。 */
const entryCache = new Map<string, { sig: string; entry: SearchEntry }>()
const ENTRY_CACHE_MAX = 2000

/** 取检索条目（带缓存）。sig 由 updatedAt + 分组名构成；任何编辑路径都会刷新 updatedAt。 */
export function getCachedSearchEntry(memo: Memo, groupName: string): SearchEntry {
  const sig = `${memo.updatedAt}\u0000${groupName}`
  const hit = entryCache.get(memo.id)
  if (hit && hit.sig === sig) return hit.entry
  const entry = buildSearchEntry(memo, groupName)
  if (entryCache.size >= ENTRY_CACHE_MAX) entryCache.clear()
  entryCache.set(memo.id, { sig, entry })
  return entry
}

/** 清空条目缓存（测试用）。 */
export function clearSearchEntryCache(): void {
  entryCache.clear()
}

/** 词首位置匹配：needle 在 hay 中第一次出现且前一字符是非字母数字（或行首）。 */
function boundaryIndex(hay: string, needle: string): number {
  if (!needle) return -1
  let from = 0
  for (;;) {
    const idx = hay.indexOf(needle, from)
    if (idx === -1) return -1
    if (idx === 0) return idx
    const prev = hay[idx - 1]
    if (!/[\p{L}\p{N}]/u.test(prev)) return idx
    from = idx + 1
  }
}

function directScore(hay: string, token: string): number {
  if (!hay || !token) return 0
  if (hay === token) return 100
  if (hay.startsWith(token)) return 60
  const boundary = boundaryIndex(hay, token)
  if (boundary === 0) return 60
  if (boundary > 0) return 40
  if (hay.includes(token)) return 25
  return 0
}

function pinyinScore(py: PinyinIndex | undefined, token: string): number {
  if (!py) return 0
  // 纯中文 token 不可能与拼音串相等，直接走前缀/包含两档
  if (py.initials.startsWith(token)) return 45
  if (py.full.startsWith(token)) return 35
  if (py.initials.includes(token)) return 20
  if (py.full.includes(token)) return 15
  return 0
}

/** 单个普通 token 在一条检索条目上的得分（各字段取最大加权值）；0 表示不匹配。 */
export function scoreToken(entry: SearchEntry, token: string): number {
  let best = 0
  const consider = (value: number) => {
    if (value > best) best = value
  }
  if (entry.keyword) consider(directScore(entry.keyword, token) * 4)
  if (entry.title) consider(directScore(entry.title, token) * 3)
  for (const tag of entry.tags) consider(directScore(tag, token) * 2)
  consider(directScore(entry.content, token))
  consider(directScore(entry.ocr, token))
  consider(directScore(entry.groupName, token))
  if (!/[\u4e00-\u9fff]/.test(token)) {
    consider(pinyinScore(entry.pyTitle, token) * 3)
    consider(pinyinScore(entry.pyTags, token) * 2)
    consider(pinyinScore(entry.pyContent, token))
    consider(pinyinScore(entry.pyOcr, token))
  }
  return best
}

function matchFilter(values: string[], py: PinyinIndex | undefined, prefix: string): boolean {
  for (const v of values) {
    if (v === prefix || v.startsWith(prefix)) return true
  }
  if (py) return pinyinScore(py, prefix) > 0
  return false
}

/** 条目的全文字幕（短语与排除词做连续包含判断用）。 */
function fullTextOf(entry: SearchEntry): string {
  return `${entry.title}\n${entry.content}\n${entry.tags.join('\n')}\n${entry.groupName}\n${entry.keyword}\n${entry.ocr}`
}

/**
 * 执行检索：entries 与 memos 下标对齐（同长度数组，entries[i] 对应 memos[i].id）。
 * 返回按「置顶 > 得分 > frecency > 手动序号」排序的 {memo, score}；无查询词时返回空数组（走 sortNoQuery）。
 */
export function searchMemos(memos: Memo[], entries: SearchEntry[], query: string): ScoredMemo[] {
  const parsed = parseQuery(query)
  const results: ScoredMemo[] = []
  const hasMatchers =
    parsed.tokens.length > 0 || parsed.phrases.length > 0 || parsed.tagFilters.length > 0 || parsed.groupFilters.length > 0
  for (let i = 0; i < memos.length; i++) {
    const entry = entries[i]
    if (!entry || entry.memoId !== memos[i].id) continue
    let ok = true
    for (const tagFilter of parsed.tagFilters) {
      if (!matchFilter(entry.tags, entry.pyTags, tagFilter)) {
        ok = false
        break
      }
    }
    if (!ok) continue
    for (const groupFilter of parsed.groupFilters) {
      if (!matchFilter([entry.groupName], entry.pyGroup, groupFilter)) {
        ok = false
        break
      }
    }
    if (!ok) continue
    const fullText = parsed.phrases.length > 0 || parsed.excludes.length > 0 ? fullTextOf(entry) : ''
    for (const phrase of parsed.phrases) {
      if (!fullText.includes(phrase)) {
        ok = false
        break
      }
    }
    if (!ok) continue
    for (const exclude of parsed.excludes) {
      if (scoreToken(entry, exclude) > 0 || fullText.includes(exclude)) {
        ok = false
        break
      }
    }
    if (!ok) continue
    let total = 0
    let allMatched = true
    for (const token of parsed.tokens) {
      const s = scoreToken(entry, token)
      if (s <= 0) {
        allMatched = false
        break
      }
      total += s
    }
    if (!allMatched) continue
    // 纯过滤查询（只有 #标签/@分组/排除词）没有得分，给 1 分保底让排序继续
    results.push({ memo: memos[i], score: hasMatchers ? total || 1 : 0 })
  }
  const pinnedWeight = (m: Memo) => (m.pinned ? 1 : 0)
  results.sort(
    (a, b) =>
      pinnedWeight(b.memo) - pinnedWeight(a.memo) ||
      b.score - a.score ||
      frecencyOf(b.memo) - frecencyOf(a.memo) ||
      a.memo.order - b.memo.order
  )
  return results
}

function frecencyOf(memo: Memo): number {
  return frecencyScore(memo.useCount, memo.lastUsedAt, Date.now(), memo.createdAt)
}

/** 无搜索词时的排序（置顶恒优先）。 */
export function sortNoQuery(memos: Memo[], sortBy: SortBy, now: number = Date.now()): Memo[] {
  const pinnedWeight = (m: Memo) => (m.pinned ? 1 : 0)
  const list = [...memos]
  switch (sortBy) {
    case 'manual':
      list.sort((a, b) => pinnedWeight(b) - pinnedWeight(a) || a.order - b.order)
      break
    case 'updated':
      list.sort((a, b) => pinnedWeight(b) - pinnedWeight(a) || b.updatedAt - a.updatedAt)
      break
    case 'created':
      list.sort((a, b) => pinnedWeight(b) - pinnedWeight(a) || b.createdAt - a.createdAt)
      break
    case 'smart':
    default:
      list.sort(
        (a, b) =>
          pinnedWeight(b) - pinnedWeight(a) ||
          frecencyScore(b.useCount, b.lastUsedAt, now, b.createdAt) - frecencyScore(a.useCount, a.lastUsedAt, now, a.createdAt) ||
          b.updatedAt - a.updatedAt
      )
  }
  return list
}

/**
 * 计算原文中的命中高亮区间 [start, end)（半开）。
 * 只处理普通 token 与引号短语（拼音命中的拼音无法映射回汉字位置，不做高亮）。
 * 匹配在与检索一致的 NFKC 归一视图上进行，并映射回原文下标（全角→半角高亮不再丢失）。
 * 返回按 start 升序、互不重叠的区间。
 */
export function highlightRanges(text: string, query: string): Array<[number, number]> {
  const { tokens, phrases } = parseQuery(query)
  const needles = [...tokens, ...phrases].filter(Boolean)
  if (needles.length === 0) return []
  // 逐字符 NFKC 归一并记录输出字符 → 原文码点下标的映射
  let normalized = ''
  const indexMap: number[] = []
  for (let i = 0; i < text.length; i++) {
    const mapped = normalizeText(text[i])
    for (let j = 0; j < mapped.length; j++) {
      indexMap.push(i)
    }
    normalized += mapped
  }
  const ranges: Array<[number, number]> = []
  for (const token of needles) {
    let from = 0
    for (;;) {
      const idx = normalized.indexOf(token, from)
      if (idx === -1) break
      const start = indexMap[idx] ?? idx
      const endIdx = idx + token.length - 1
      const end = (indexMap[endIdx] ?? endIdx) + 1
      ranges.push([start, Math.min(end, text.length)])
      from = idx + token.length
    }
  }
  if (ranges.length === 0) return []
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const merged: Array<[number, number]> = []
  for (const range of ranges) {
    const last = merged[merged.length - 1]
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
    else merged.push([...range])
  }
  return merged
}
