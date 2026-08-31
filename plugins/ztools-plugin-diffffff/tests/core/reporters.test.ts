/**
 * 差异报告构建器单元测试（roadmap 任务 INT-003）。
 *
 * 覆盖 `src/core/reporters.ts` 的两个出口 + HTML 复用关系 smoke：
 * - `buildUnifiedPatch`：单 hunk 纯增 / 纯删的逐行精确断言（含文件头命名与
 *   @@ 头）、modify 行相邻成对（− 后 +）、多 hunk 的顺序 / header / hunk 间
 *   无空行（git 同构选择）、equal 行前导空格与空文本行的单空格形态、
 *   无 hunks → 空串、meta 标题注入、文本以 -/+ 开头时的「前缀 + 原文」拼接
 *   语义（行首恰一个前缀字符的正确性锚）、末尾无换行 / 每行首字符合法性；
 * - `buildMarkdownReport`：头部结构（标题 / 生成时间 / 统计行 +N −M · H）、
 *   GFM 表头与分隔行、类型映射（相同/新增/删除/修改）、行号缺失占位 —、
 *   modify 行的「旧 → 新」内容、反引号与管道符转义、超长截断（1000 + …，
 *   常数导出）、全 equal 简化（无表格 + 说明）、整体结构精确断言；
 * - HTML 报告的复用关系（reporters.ts 不实现 HTML）：buildExportHtml 产物
 *   以 <!DOCTYPE html> 开头（App 层「复制 HTML 报告」复制的即该产物）。
 *
 * 输入构造与其他 core 测试同入口：真实引擎管线 diffLinesCore（+ rowsWithPairing
 * / computeStats / buildHunks），保证断言锚定的是产出契约而非手捏数据。
 */
import { describe, expect, it } from 'vitest'
import { buildMarkdownReport, buildUnifiedPatch, MARKDOWN_CONTENT_MAX_CHARS } from '../../src/core/reporters'
import type { MarkdownReportInput, UnifiedPatchInput } from '../../src/core/reporters'
import { buildExportHtml } from '../../src/core/exporters'
import { buildHunks } from '../../src/core/hunks'
import { diffLinesCore } from '../../src/core/diff'
import { rowsWithPairing } from '../../src/core/pairing'
import { computeStats } from '../../src/core/stats'
import type { DiffRow, DiffStats, Hunk } from '../../src/core/types'

/** 用真实行级 diff 构造带 1-based 行号的行骨架（与其他 core 测试同入口）。 */
function makeRows(left: string, right: string): DiffRow[] {
  return diffLinesCore(left, right)
}

/** 由 rows 派生统计（hunkCount 可注入，与 buildHunks 的产出对齐使用）。 */
function statsOf(rows: DiffRow[], hunkCount = 1): DiffStats {
  return computeStats(rows, hunkCount)
}

/** buildUnifiedPatch 的标准输入（缺省 meta 标题，hunks / stats 由 rows 派生）。 */
function makePatchInput(rows: DiffRow[], meta?: UnifiedPatchInput['meta']): UnifiedPatchInput {
  const { hunks } = buildHunks(rows)
  return {
    rows,
    hunks,
    stats: statsOf(rows, hunks.length),
    meta: meta ?? {},
  }
}

/** buildMarkdownReport 的标准输入（生成时间固定，便于精确断言）。 */
function makeMarkdownInput(rows: DiffRow[], stats?: DiffStats): MarkdownReportInput {
  return {
    rows,
    stats: stats ?? statsOf(rows),
    meta: { generatedAt: '2026-08-30 12:34:56' },
  }
}

/* -------------------------------------------------------------------------- */
/* buildUnifiedPatch                                                           */
/* -------------------------------------------------------------------------- */

describe('buildUnifiedPatch：单 hunk 逐行输出', () => {
  it('纯新增（add）：文件头缺省命名 + @@ 头 + 上下文空格行 + 新增 + 行', () => {
    // left [a,b] vs right [a,b,c]：equal a / equal b / add c，单 hunk 覆盖全部行。
    const patch = buildUnifiedPatch(makePatchInput(makeRows('a\nb', 'a\nb\nc')))
    expect(patch).toBe(
      ['--- a/original', '+++ b/modified', '@@ -1,2 +1,3 @@', ' a', ' b', '+c'].join('\n'),
    )
  })

  it('纯删除（del）：删除 - 行逐行精确输出', () => {
    // left [a,b] vs right [a]：equal a / del b。
    const patch = buildUnifiedPatch(makePatchInput(makeRows('a\nb', 'a')))
    expect(patch).toBe(
      ['--- a/original', '+++ b/modified', '@@ -1,2 +1,1 @@', ' a', '-b'].join('\n'),
    )
  })

  it('替换（modify 配对）：− 行与 + 行相邻成对（先 − 后 +）', () => {
    const rows = rowsWithPairing(makeRows('p\nconst x = 1;\nq', 'p\nconst x = 2;\nq'))
    const patch = buildUnifiedPatch(makePatchInput(rows))
    expect(patch).toBe(
      [
        '--- a/original',
        '+++ b/modified',
        '@@ -1,3 +1,3 @@',
        ' p',
        '-const x = 1;',
        '+const x = 2;',
        ' q',
      ].join('\n'),
    )
    // 相邻性独立断言：modify 展开的两条输出行必须紧邻。
    const lines = patch.split('\n')
    const delIndex = lines.indexOf('-const x = 1;')
    expect(lines[delIndex + 1]).toBe('+const x = 2;')
  })

  it('equal 行带前导空格；空文本 equal 行输出单个空格行', () => {
    // left/right = a / (空) / b / c→D：第 2 行为空文本 equal 行。
    const patch = buildUnifiedPatch(makePatchInput(makeRows('a\n\nb\nc', 'a\n\nb\nD')))
    const lines = patch.split('\n')
    expect(lines).toEqual([
      '--- a/original',
      '+++ b/modified',
      '@@ -1,4 +1,4 @@',
      ' a',
      ' ',
      ' b',
      '-c',
      '+D',
    ])
    // 空文本行的形态锚：恰一个空格（unified diff 上下文空行的标准形态）。
    expect(lines[4]).toBe(' ')
  })
})

describe('buildUnifiedPatch：多 hunk 与结构约定', () => {
  it('多 hunk：按出现顺序拼接、各自 @@ 头、hunk 间无空行（git 同构）', () => {
    // 首尾各一处变更、中间 10 行 equal（间隔 > 2×3 上下文）→ 拆成两个 hunk。
    const left = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10', 'l11', 'l12'].join('\n')
    const right = ['X', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10', 'l11', 'Y'].join('\n')
    const patch = buildUnifiedPatch(makePatchInput(makeRows(left, right)))
    expect(patch).toBe(
      [
        '--- a/original',
        '+++ b/modified',
        '@@ -1,4 +1,4 @@',
        '-l1',
        '+X',
        ' l2',
        ' l3',
        ' l4',
        '@@ -9,4 +9,4 @@',
        ' l9',
        ' l10',
        ' l11',
        '-l12',
        '+Y',
      ].join('\n'),
    )
    // hunk 间不插空行的选择（git diff 同构）：全文无连续空行。
    expect(patch).not.toContain('\n\n')
  })

  it('无差异（hunks 空）→ 返回空字符串', () => {
    const rows = makeRows('same\ntext', 'same\ntext')
    const patch = buildUnifiedPatch({
      rows,
      hunks: [],
      stats: statsOf(rows, 0),
      meta: {},
    })
    expect(patch).toBe('')
  })

  it('meta 标题注入：---/+++ 头使用传入标题（缺省 a/original / b/modified）', () => {
    const patch = buildUnifiedPatch(
      makePatchInput(makeRows('a\nb', 'a\nb\nc'), {
        leftTitle: 'src/old.ts',
        rightTitle: 'src/new.ts',
      }),
    )
    expect(patch.startsWith('--- src/old.ts\n+++ src/new.ts\n')).toBe(true)
    // 缺省命名约定再次锚定（与上一条对照）。
    expect(patch).not.toContain('a/original')
  })
})

describe('buildUnifiedPatch：前缀语义与形态锚', () => {
  it('文本本身以 - 开头：删除行输出 --foo、新增行输出 +-bar（前缀恰一个字符）', () => {
    // 行文本 '-foo' / '-bar'：unified diff 前缀拼接后为 '--foo' / '+-bar'，
    // 解析器按「首个字符为前缀、其余为内容」消费，语义正确。
    // 计数口径：oldLines = a + '-foo' = 2、newLines = a + '-bar' = 2。
    const patch = buildUnifiedPatch(makePatchInput(makeRows('a\n-foo', 'a\n-bar')))
    const lines = patch.split('\n')
    expect(lines[2]).toBe('@@ -1,2 +1,2 @@')
    expect(lines[3]).toBe(' a')
    expect(lines[4]).toBe('--foo')
    expect(lines[5]).toBe('+-bar')
  })

  it('equal 行文本以 + 开头：前导空格前缀 + 原文（+z → " +z"）', () => {
    // equal 行文本 '+z'：输出 ' +z'（空格前缀 + 内容），与 '+z' 新增行可区分。
    const patch = buildUnifiedPatch(makePatchInput(makeRows('a\n+z\nb', 'a\n+z\nB')))
    const lines = patch.split('\n')
    expect(lines[2]).toBe('@@ -1,3 +1,3 @@')
    expect(lines[3]).toBe(' a')
    expect(lines[4]).toBe(' +z')
    expect(lines[5]).toBe('-b')
    expect(lines[6]).toBe('+B')
  })

  it('形态锚：末尾无换行、每行首字符恰为一个前缀字符（空格 / - / + / @）', () => {
    const left = 'h1\nconst a = 1;\nmid\nconst b = 2;\ntail'
    const right = 'h1\nconst a = 10;\nmid\nconst b = 20;\ntail'
    const patch = buildUnifiedPatch(makePatchInput(rowsWithPairing(makeRows(left, right))))
    expect(patch.endsWith('\n')).toBe(false)
    const lines = patch.split('\n')
    for (const line of lines) {
      expect([' ', '-', '+', '@']).toContain(line[0])
    }
    // 文件头两行与 @@ 头的固定形态。
    expect(lines[0].startsWith('--- ')).toBe(true)
    expect(lines[1].startsWith('+++ ')).toBe(true)
    expect(lines[2].startsWith('@@ -') && lines[2].endsWith(' @@')).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */
/* buildMarkdownReport                                                         */
/* -------------------------------------------------------------------------- */

describe('buildMarkdownReport：头部与表格结构', () => {
  it('头部结构：标题 + 生成时间 + 统计行（+N −M · H 处差异，− 为 U+2212）', () => {
    // left [a,b] vs right [a,c]：+1 −1、hunkCount 固定 1。
    const md = buildMarkdownReport(makeMarkdownInput(makeRows('a\nb', 'a\nc')))
    expect(md).toContain('# 文本差异对比报告')
    expect(md).toContain('生成时间：2026-08-30 12:34:56')
    expect(md).toContain('统计：+1 −1 · 1 处差异')
  })

  it('GFM 表格：表头与渲染所必需的分隔行', () => {
    const md = buildMarkdownReport(makeMarkdownInput(makeRows('a\nb', 'a\nc')))
    expect(md).toContain('| 类型 | 旧行号 | 新行号 | 内容 |')
    expect(md).toContain('| --- | --- | --- | --- |')
  })

  it('类型映射与行号占位：相同 / 删除 / 新增；缺失侧行号为 —', () => {
    const md = buildMarkdownReport(makeMarkdownInput(makeRows('a\nb', 'a\nc')))
    expect(md).toContain('| 相同 | 1 | 1 | `a` |')
    expect(md).toContain('| 删除 | 2 | — | `b` |')
    expect(md).toContain('| 新增 | — | 2 | `c` |')
  })

  it('modify 行：双侧行号 + 「旧 → 新」内容（两个代码 span）', () => {
    const rows = rowsWithPairing(makeRows('p\nconst x = 1;\nq', 'p\nconst x = 2;\nq'))
    const md = buildMarkdownReport(makeMarkdownInput(rows))
    expect(md).toContain('| 修改 | 2 | 2 | `const x = 1;` → `const x = 2;` |')
  })

  it('整体结构精确断言（头部 + 空行 + 表格逐行）', () => {
    const md = buildMarkdownReport(makeMarkdownInput(makeRows('a\nb', 'a\nc')))
    expect(md).toBe(
      [
        '# 文本差异对比报告',
        '',
        '生成时间：2026-08-30 12:34:56',
        '',
        '统计：+1 −1 · 1 处差异',
        '',
        '| 类型 | 旧行号 | 新行号 | 内容 |',
        '| --- | --- | --- | --- |',
        '| 相同 | 1 | 1 | `a` |',
        '| 删除 | 2 | — | `b` |',
        '| 新增 | — | 2 | `c` |',
      ].join('\n'),
    )
  })
})

describe('buildMarkdownReport：转义 / 截断 / 无差异简化', () => {
  it('内容转义：反引号 → \\`、管道符 → \\|（表格单元不被破坏）', () => {
    // 行文本 'a`b|c'：管道符在 GFM 表格单元（含代码 span 内）必须转义，
    // 反引号按任务约定以反斜杠转义防代码 span 提前闭合。
    const md = buildMarkdownReport(makeMarkdownInput(makeRows('x\na`b|c', 'x')))
    expect(md).toContain('| 删除 | 2 | — | `a\\`b\\|c` |')
    // 原始（未转义）串不再以裸形态出现。
    expect(md).not.toContain('a`b|c')
  })

  it('超长截断：超过 1000 字符截到 1000 + …（先截断后转义，常数导出）', () => {
    const longText = 'x'.repeat(1200)
    const rows: DiffRow[] = [{ type: 'add', right: { lineNo: 1, text: longText } }]
    const md = buildMarkdownReport(
      makeMarkdownInput(rows, {
        addedLines: 1,
        removedLines: 0,
        modifiedPairs: 0,
        hunkCount: 0,
        totalRows: 1,
      }),
    )
    expect(MARKDOWN_CONTENT_MAX_CHARS).toBe(1000)
    expect(md).toContain(`${'x'.repeat(1000)}…`)
    expect(md).not.toContain('x'.repeat(1001))
    // 恰在阈值上不截断（无省略号）。
    const exact = buildMarkdownReport(
      makeMarkdownInput([{ type: 'add', right: { lineNo: 1, text: 'y'.repeat(1000) } }], {
        addedLines: 1,
        removedLines: 0,
        modifiedPairs: 0,
        hunkCount: 0,
        totalRows: 1,
      }),
    )
    expect(exact).toContain(`${'y'.repeat(1000)}\``)
    expect(exact).not.toContain('…')
  })

  it('全 equal：简化报告（统计 + 无差异说明，不输出表格）', () => {
    const rows = makeRows('same\ntext', 'same\ntext')
    // 全 equal 无 hunk：hunkCount 取 0（与 buildHunks 产出对齐）。
    const md = buildMarkdownReport(makeMarkdownInput(rows, statsOf(rows, 0)))
    expect(md).toContain('# 文本差异对比报告')
    expect(md).toContain('统计：+0 −0 · 0 处差异')
    expect(md).toContain('两侧内容相同，无差异行。')
    expect(md).not.toContain('| 类型')
  })
})

/* -------------------------------------------------------------------------- */
/* HTML 报告复用关系（reporters.ts 不实现 HTML，App 层复用 buildExportHtml）     */
/* -------------------------------------------------------------------------- */

describe('HTML 报告复用 smoke', () => {
  it('buildExportHtml 产物为完整单文件文档（复制 HTML 报告即复制该产物）', () => {
    const rows = makeRows('a\nb', 'a\nc')
    const html = buildExportHtml({
      left: 'a\nb',
      right: 'a\nc',
      rows,
      stats: statsOf(rows),
      meta: {
        exportedAt: '2026-08-30 12:34:56',
        viewMode: 'unified',
        language: 'text',
      },
    })
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html.endsWith('</html>\n')).toBe(true)
    expect(html).toContain('文本差异对比')
  })
})
