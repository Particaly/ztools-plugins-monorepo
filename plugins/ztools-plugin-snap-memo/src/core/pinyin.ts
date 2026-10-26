/**
 * 拼音索引（基于 pinyin-pro，带 LRU 缓存）。
 * 为一段文本生成两个可检索串：全拼（无分隔）与声母首字母串；非中文文本原样小写透传。
 */
import { pinyin } from 'pinyin-pro'

export interface PinyinIndex {
  /** 全拼小写（如 "bianjiqi"）；非中文即原文小写。 */
  full: string
  /** 声母首字母串（如 "bjq"）；非中文即原文小写。 */
  initials: string
}

const CACHE_MAX = 1500
const cache = new Map<string, PinyinIndex>()

const CJK_RE = /[\u4e00-\u9fff]/

/** 是否包含汉字（无汉字时无需拼音转换，节省开销）。 */
export function containsHan(text: string): boolean {
  return CJK_RE.test(text)
}

/** 计算一段文本的拼音索引（不做缓存）。 */
export function computePinyinIndex(text: string): PinyinIndex {
  const lower = text.toLowerCase()
  if (!containsHan(text)) return { full: lower, initials: lower }
  const full = pinyin(text, { toneType: 'none', type: 'string', v: true }).replace(/\s+/g, '')
  const initials = pinyin(text, { pattern: 'first', toneType: 'none', type: 'string', v: true }).replace(/\s+/g, '')
  return { full: full.toLowerCase(), initials: initials.toLowerCase() }
}

/**
 * 取拼音索引（LRU 缓存）。缓存键为原文；同一段标题/内容前缀反复检索时零开销。
 */
export function getPinyinIndex(text: string): PinyinIndex {
  const hit = cache.get(text)
  if (hit) {
    // 触碰 LRU 顺序
    cache.delete(text)
    cache.set(text, hit)
    return hit
  }
  const value = computePinyinIndex(text)
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(text, value)
  return value
}

/** 清空缓存（测试用）。 */
export function clearPinyinCache(): void {
  cache.clear()
}
