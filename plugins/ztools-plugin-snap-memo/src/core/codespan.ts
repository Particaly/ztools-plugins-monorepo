/**
 * 行内代码标记解析（纯函数）。
 *
 * 语法：`` `code` `` / ```code``` / ````code````（1~3 个反引号成对包裹，同 markdown 行内代码）；
 * 双/三反引号包裹的内容允许包含单个反引号（Markdown 语义，如 ``a`b`` ）。
 * 未成对的反引号按普通文本保留，不吞内容。
 */

export interface RichSegment {
  text: string
  /** true 表示这段是行内代码（UI 渲染为可点击复制的代码片）。 */
  code: boolean
}

const CODE_SPAN_RE = /(`{2,3})((?:[^`\n]|(?!\1)`)+?)\1|(`)([^`\n]+?)\3/g

/**
 * 把文本拆为普通/代码片段序列。
 * 代码片段的 text 不含包裹反引号；普通片段保持原文（含未配对反引号）。
 */
export function parseCodeSpans(text: string): RichSegment[] {
  if (!text.includes('`')) return text ? [{ text, code: false }] : []
  const segments: RichSegment[] = []
  let cursor = 0
  CODE_SPAN_RE.lastIndex = 0
  for (let m = CODE_SPAN_RE.exec(text); m; m = CODE_SPAN_RE.exec(text)) {
    if (m.index > cursor) segments.push({ text: text.slice(cursor, m.index), code: false })
    segments.push({ text: m[2] ?? m[4] ?? '', code: true })
    cursor = m.index + m[0].length
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), code: false })
  return segments
}
