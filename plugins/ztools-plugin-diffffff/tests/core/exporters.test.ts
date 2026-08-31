/**
 * 导出 HTML 构建器单元测试（roadmap 任务 INT-002）。
 *
 * 覆盖 `src/core/exporters.ts` 的两个出口：
 * - `escapeHtml`：& < > " ' 五字符逐一精确映射、组合串精确断言、
 *   「先 & 不二次转义」的顺序保证（< 不产生 &amp;lt;、& 连排不产生
 *   &amp;amp;）、普通文本（含中文）原样透传；
 * - `buildExportHtml`：文档骨架（DOCTYPE 开头 / </html> 闭合 / title），
 *   split 与 unified 两种模式的结构差异（<table> 两列表格 vs .u-row 单栏行），
 *   统计值（+N −M · H 处差异）注入，行文本渲染与行号（含 equal 行双侧行号
 *   独立取侧），特殊字符行（<script> / & / 引号）被转义且原文不出现，
 *   modify 行展开为 del+add 两条半行，空行保留结构，meta（导出时间 / 视图 /
 *   语言 / 两侧行数）注入，prefers-color-scheme: dark 与 --diff-* 浅深色值
 *   字面存在（与 main.css / roadmap §3.2 一致），print 友好（无 JS / 无外部
 *   资源引用），longLine 行不截断（完整文本呈现），总长度合理性 smoke。
 */
import { describe, expect, it } from 'vitest'
import { buildExportHtml, escapeHtml } from '../../src/core/exporters'
import type { ExportInput } from '../../src/core/exporters'
import { diffLinesCore } from '../../src/core/diff'
import { rowsWithPairing } from '../../src/core/pairing'
import { computeStats } from '../../src/core/stats'
import type { DiffRow, DiffStats } from '../../src/core/types'

/** 用真实行级 diff 构造带 1-based 行号的行骨架（与其他 core 测试同入口）。 */
function makeRows(left: string, right: string): DiffRow[] {
  return diffLinesCore(left, right)
}

/** 由 rows 派生统计（hunkCount 固定 1，满足「H 处差异」断言的可控性）。 */
function statsOf(rows: DiffRow[]): DiffStats {
  return computeStats(rows, 1)
}

/** buildExportHtml 的标准输入（split 默认；行文本文案可注入特殊字符）。 */
function makeInput(overrides?: {
  left?: string
  right?: string
  rows?: DiffRow[]
  viewMode?: 'split' | 'unified'
  language?: string
  exportedAt?: string
}): ExportInput {
  const left = overrides?.left ?? 'a\nb'
  const right = overrides?.right ?? 'a\nc'
  const rows = overrides?.rows ?? makeRows(left, right)
  return {
    left,
    right,
    rows,
    stats: statsOf(rows),
    meta: {
      exportedAt: overrides?.exportedAt ?? '2026-08-30 12:34:56',
      viewMode: overrides?.viewMode ?? 'split',
      language: overrides?.language ?? 'typescript',
    },
  }
}

/* -------------------------------------------------------------------------- */
/* escapeHtml                                                                  */
/* -------------------------------------------------------------------------- */

describe('escapeHtml：五字符精确映射', () => {
  it('五个特殊字符逐一映射（& < > " \'）', () => {
    expect(escapeHtml('&')).toBe('&amp;')
    expect(escapeHtml('<')).toBe('&lt;')
    expect(escapeHtml('>')).toBe('&gt;')
    expect(escapeHtml('"')).toBe('&quot;')
    expect(escapeHtml("'")).toBe('&#39;')
  })

  it('组合串精确断言：&<>"\' → &amp;&lt;&gt;&quot;&#39;', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;')
  })

  it('顺序保证（先 &）：实体不二次转义', () => {
    // 若 < 先于 & 转义，&lt; 中的 & 会被二次转义成 &amp;lt; —— 精确排除。
    expect(escapeHtml('<')).toBe('&lt;')
    expect(escapeHtml('<')).not.toBe('&amp;lt;')
    // & 连排同理：一次转义，不产生 &amp;amp;。
    expect(escapeHtml('&&')).toBe('&amp;&amp;')
    expect(escapeHtml('&&')).not.toBe('&amp;amp;')
  })

  it('普通文本原样透传（中文 / 字母 / 标点）', () => {
    expect(escapeHtml('中文 abc 123')).toBe('中文 abc 123')
    expect(escapeHtml('')).toBe('')
  })

  it('混合文本：特殊字符逐个替换、其余不动', () => {
    expect(escapeHtml('a&b<c>d"e\'f')).toBe('a&amp;b&lt;c&gt;d&quot;e&#39;f')
  })
})

/* -------------------------------------------------------------------------- */
/* buildExportHtml：文档骨架与统计                                              */
/* -------------------------------------------------------------------------- */

describe('buildExportHtml：文档骨架', () => {
  it('以 <!DOCTYPE html> 开头、</html> 结尾，title 含标题与导出时间', () => {
    const html = buildExportHtml(makeInput())
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html.endsWith('</html>\n')).toBe(true)
    expect(html).toContain('<title>文本差异对比 · 2026-08-30 12:34:56</title>')
  })

  it('头部统计值注入：+N −M · H 处差异（含 − 使用 U+2212）', () => {
    // left [a,b] vs right [a,c]：+1 −1、hunkCount=1（statsOf 固定传 1）。
    const html = buildExportHtml(makeInput())
    expect(html).toContain('<span class="is-add">+1</span>')
    expect(html).toContain('<span class="is-del">−1</span>')
    expect(html).toContain('· 1 处差异')
  })

  it('meta 注入：导出时间 / 视图模式 / 语言 / 两侧规范化行数', () => {
    // 尾部换行不计独立行（与引擎规范化口径一致）：'x\n' → 1 行。
    const html = buildExportHtml(
      makeInput({ left: 'a\nb\nc', right: 'x\n', viewMode: 'unified', language: 'python' }),
    )
    expect(html).toContain('导出时间：2026-08-30 12:34:56')
    expect(html).toContain('视图：统一')
    expect(html).toContain('语言：python')
    expect(html).toContain('原始文本 3 行 · 更改后文本 1 行')
  })
})

/* -------------------------------------------------------------------------- */
/* buildExportHtml：split 两列表格                                              */
/* -------------------------------------------------------------------------- */

describe('buildExportHtml：split 模式', () => {
  it('结构为两列表格（<table class="split-table"> + <tr>），不含 unified 行', () => {
    const html = buildExportHtml(makeInput({ viewMode: 'split' }))
    expect(html).toContain('<table class="split-table">')
    expect(html).toContain('<tr class="d-row">')
    expect(html).toContain('</table>')
    // 正文无 unified 行单元（内联 CSS 是两模式共用的，不在此断言范围）。
    expect(html).not.toContain('class="u-row"')
  })

  it('行文本与双侧行号、−/+ 记号、行底色类渲染正确', () => {
    // left [a,b] vs right [a,c]：equal a（双侧 1）、del b（左 2）、add c（右 2）。
    const html = buildExportHtml(makeInput({ left: 'a\nb', right: 'a\nc', viewMode: 'split' }))
    // equal 行：双侧行号 + 无记号无底色。
    expect(html).toContain(
      '<td class="ln">1</td><td class="sign"> </td><td class="txt">a</td>' +
        '<td class="ln">1</td><td class="sign"> </td><td class="txt">a</td>',
    )
    // del 行：左半 − 记号 + tone-del，右半空占位。
    expect(html).toContain(
      '<td class="ln tone-del">2</td><td class="sign tone-del">−</td><td class="txt tone-del">b</td>' +
        '<td class="ln"></td><td class="sign"></td><td class="txt"></td>',
    )
    // add 行：左半空占位，右半 + 记号 + tone-add。
    expect(html).toContain(
      '<td class="ln"></td><td class="sign"></td><td class="txt"></td>' +
        '<td class="ln tone-add">2</td><td class="sign tone-add">+</td><td class="txt tone-add">c</td>',
    )
  })

  it('特殊字符行被转义且原文不出现（<script> / & / 引号）', () => {
    const evil = '<script>alert("x&y")</script>'
    const html = buildExportHtml(
      makeInput({ left: 'a', right: evil + "\n'q'", viewMode: 'split' }),
    )
    // 转义形态存在。
    expect(html).toContain('&lt;script&gt;alert(&quot;x&amp;y&quot;)&lt;/script&gt;')
    expect(html).toContain('&#39;q&#39;')
    // 原文（可被浏览器解析的形态）不存在。
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('alert("x&y")')
    expect(html).not.toContain("'q'")
  })

  it('空行保留结构：空文本行渲染为空内容格（行高由 CSS 保底）', () => {
    const html = buildExportHtml(makeInput({ left: 'a\n\nb', right: 'a\n\nb', viewMode: 'split' }))
    expect(html).toContain('<td class="txt"></td>')
    // 保底行高机制存在（表格单元格 height 即最小高度）。
    expect(html).toContain('table.split-table td { vertical-align: top; height: 20px;')
  })

  it('modify 行：左半 − tone-del、右半 + tone-add（rowsWithPairing 产物）', () => {
    const paired = rowsWithPairing(makeRows('p\nconst x = 1;\nq', 'p\nconst x = 2;\nq'))
    const html = buildExportHtml(makeInput({ rows: paired, viewMode: 'split' }))
    expect(html).toContain(
      '<td class="ln tone-del">2</td><td class="sign tone-del">−</td><td class="txt tone-del">const x = 1;</td>' +
        '<td class="ln tone-add">2</td><td class="sign tone-add">+</td><td class="txt tone-add">const x = 2;</td>',
    )
  })
})

/* -------------------------------------------------------------------------- */
/* buildExportHtml：unified 单栏行                                              */
/* -------------------------------------------------------------------------- */

describe('buildExportHtml：unified 模式', () => {
  it('结构为单栏行（.u-row），不含 <table> / <tr>', () => {
    const html = buildExportHtml(makeInput({ viewMode: 'unified' }))
    expect(html).toContain('class="u-row"')
    expect(html).not.toContain('<table')
    expect(html).not.toContain('<tr')
  })

  it('+/−/空格记号与双行号独立取侧（两侧行号可不同）', () => {
    // left [a,b] vs right [x,a,b]：add x（右 1）→ equal a（左 1 / 右 2）→ equal b（左 2 / 右 3）。
    const html = buildExportHtml(makeInput({ left: 'a\nb', right: 'x\na\nb', viewMode: 'unified' }))
    // add 行：新行号 1、旧行号空、+ 记号（半行的色调类挂双侧行号格，与
    // UnifiedDiffView 的 is-tone-* 落法一致）。
    expect(html).toContain(
      '<span class="ln tone-add"></span><span class="ln tone-add">1</span><span class="sign tone-add">+</span><span class="txt tone-add">x</span>',
    )
    // equal 行：旧 = 左侧行号 1、新 = 右侧行号 2（双行号独立计数）。
    expect(html).toContain(
      '<span class="ln">1</span><span class="ln">2</span><span class="sign"> </span><span class="txt">a</span>',
    )
    // del 行：旧行号 + − 记号。
    const delHtml = buildExportHtml(
      makeInput({ left: 'a\nb', right: 'a', viewMode: 'unified' }),
    )
    expect(delHtml).toContain(
      '<span class="ln tone-del">2</span><span class="ln tone-del"></span><span class="sign tone-del">−</span><span class="txt tone-del">b</span>',
    )
  })

  it('modify 行展开为 del + add 两条半行（unified 单栏一行只承载一侧）', () => {
    const paired = rowsWithPairing(makeRows('p\nconst x = 1;\nq', 'p\nconst x = 2;\nq'))
    const html = buildExportHtml(makeInput({ rows: paired, viewMode: 'unified' }))
    expect(html).toContain(
      '<span class="ln tone-del">2</span><span class="ln tone-del"></span><span class="sign tone-del">−</span><span class="txt tone-del">const x = 1;</span>',
    )
    expect(html).toContain(
      '<span class="ln tone-add"></span><span class="ln tone-add">2</span><span class="sign tone-add">+</span><span class="txt tone-add">const x = 2;</span>',
    )
  })

  it('空行保留结构：unified 空文本行渲染为空内容格', () => {
    const html = buildExportHtml(
      makeInput({ left: 'a\n\nb', right: 'a\n\nb', viewMode: 'unified' }),
    )
    expect(html).toContain('<span class="txt"></span>')
    expect(html).toContain('min-height: 20px')
  })
})

/* -------------------------------------------------------------------------- */
/* buildExportHtml：样式自包含与导出语义                                        */
/* -------------------------------------------------------------------------- */

describe('buildExportHtml：内联样式与导出语义', () => {
  it('--diff-* 浅/深两套字面值存在（与 main.css Scandi 色板一致）', () => {
    const html = buildExportHtml(makeInput())
    // 浅色默认值（陶土红删 / 鼠尾草绿增）。
    expect(html).toContain('--diff-del-bg: #f6e7e1')
    expect(html).toContain('--diff-add-bg: #e5eee1')
    expect(html).toContain('--diff-gutter-bg: #f1efe9')
    expect(html).toContain('--diff-del-text: #96482f')
    expect(html).toContain('--diff-add-text: #3f6d4b')
    // 深色覆盖（prefers-color-scheme: dark）。
    expect(html).toContain('@media (prefers-color-scheme: dark)')
    expect(html).toContain('--diff-del-bg: #43302a')
    expect(html).toContain('--diff-add-bg: #2f3a2e')
    expect(html).toContain('--diff-gutter-bg: #322f2a')
    expect(html).toContain('--diff-del-text: #e2a58f')
    expect(html).toContain('--diff-add-text: #a9cba9')
  })

  it('print 友好：无 JS、无外部资源引用，含 print-color-adjust 保留配色', () => {
    const html = buildExportHtml(makeInput())
    expect(html).not.toContain('<script')
    expect(html).not.toContain('http://')
    expect(html).not.toContain('https://')
    expect(html).not.toContain('src=')
    expect(html).not.toContain('link rel')
    expect(html).toContain('print-color-adjust: exact')
  })

  it('等宽字体栈与 §3.2 一致', () => {
    const html = buildExportHtml(makeInput())
    expect(html).toContain('ui-monospace, SFMono-Regular, Menlo, Consolas, monospace')
  })

  it('longLine 行在导出中不截断：完整文本呈现、无截断样式与「展开」提示', () => {
    const longText = 'x'.repeat(200)
    const rows: DiffRow[] = [
      { type: 'del', left: { lineNo: 1, text: longText }, longLine: true },
    ]
    const html = buildExportHtml(makeInput({ rows, viewMode: 'split' }))
    expect(html).toContain(longText)
    expect(html).not.toContain('展开')
    // 导出文档不做 ENG-012 的 4 行截断（max-height 截断样式不存在于内容列）。
    expect(html).not.toContain('max-height')
  })

  it('长度合理性 smoke：含完整 CSS 与行内容，无未插值的占位残留', () => {
    const html = buildExportHtml(makeInput())
    expect(html.length).toBeGreaterThan(1000)
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('[object')
  })
})
