/**
 * ============================================================================
 * 导出 HTML 构建器（roadmap 任务 INT-002）
 * ============================================================================
 *
 * 把一次成功对比的结果（DiffResultOk 的 rows / stats）组装为【完整单文件
 * HTML】（<!DOCTYPE html>…</html>）：全部样式内联在 <style> 中、无 JS、无
 * 任何外部资源引用 —— 导出文件脱离插件环境后仍可独立打开、打印、存档。
 *
 * 设计要点：
 * - 纯函数、零 UI 依赖：输入普通对象（不读 store、不碰 DOM），可被单元测试
 *   直接覆盖（tests/core/exporters.test.ts），App.vue 只负责收集输入与落盘；
 * - 配色自包含：导出文档无法消费宿主注入的 --diff-* CSS 变量（useZtoolsTheme
 *   只作用于插件窗口），故把 roadmap §3.2 / main.css 的 --diff-* token 值
 *   【按字面值】写进导出文档的 :root，浅色为默认、@media (prefers-color-scheme:
 *   dark) 提供深色一套，取值与 main.css 逐项一致（改 main.css 需同步此处）；
 * - 转义出口唯一：所有动态文本（行文本、导出时间、语言名）必经 escapeHtml，
 *   杜绝导出文件里的行内容被浏览器当 HTML 解析（<script> 注入面）；
 * - 行文本 white-space: pre-wrap：保留空格语义、超长行自动换行；空行由
 *   min-height / 表格单元格 height 保底行高；
 * - longLine 行在导出中【不截断】（下方 longLine 相关注释）：导出是打印 /
 *   存档语义，与屏显（ENG-012 的 4 行截断 + 展开交互）刻意不同。
 * ============================================================================
 */

import type { DiffRow, DiffRowSide, DiffStats } from './types'

/** 导出文档的视图模式：与 viewStore.effectiveViewMode 同形状（'split' | 'unified'） */
export type ExportViewMode = 'split' | 'unified'

/** 导出元信息：渲染进文档头部（标题 / meta 行），不参与 diff 内容本身 */
export interface ExportMeta {
  /** 导出时间的人类可读文案（如 '2026-08-30 12:34:56'），渲染进 <title> 与头部 */
  exportedAt: string
  /** 导出时结果视图的模式：决定正文按两列表格还是单栏行渲染 */
  viewMode: ExportViewMode
  /** 生效语言（viewStore.effectiveLanguage），仅作头部元信息展示 */
  language: string
}

/** buildExportHtml 的输入：一次成功对比的完整快照 */
export interface ExportInput {
  /** 左侧（原始文本）输入原文：仅用于头部「两侧行数」元信息，不直接渲染正文 */
  left: string
  /** 右侧（更改后文本）输入原文：同上 */
  right: string
  /** 引擎产出的完整行序列（DiffResultOk.rows，含 equal 行） */
  rows: DiffRow[]
  /** 对比统计（DiffResultOk.stats），渲染为头部 +N −M · H 处差异 */
  stats: DiffStats
  /** 导出元信息（见 ExportMeta） */
  meta: ExportMeta
}

/**
 * HTML 文本转义（导出文档内所有动态文本的唯一出口）。
 *
 * 覆盖 HTML 特殊字符五个：& < > " '，分别变为 &amp; &lt; &gt; &quot; &#39;。
 * 转义顺序刻意【先 &】：必须先把字面 & 变成 &amp;，再转义其余四个字符 ——
 * 若顺序颠倒（先转义 < 生成 &lt; 之后再转义 &），先前生成的实体字符串会被
 * 二次转义成 &amp;lt;，输出错乱（本函数用链式 replace 且 & 在最前，天然保证）。
 *
 * @param s 任意文本（行内容、时间戳、语言名等）
 * @returns 可安全放入 HTML 文本节点 / 属性值的转义文本
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 导出文档的内联 CSS（单文件自包含）。
 *
 * 取值约定（与 main.css 逐项一致，改一处需同步另一处）：
 * - --diff-* 八个 token：roadmap §3.2 的浅/深两套字面值（导出文档脱离插件
 *   环境，无法消费宿主变量，必须写成字面 CSS 自定义属性）；
 * - 等宽字体栈与排版：§3.2 同款 ui-monospace 栈，13px / 20px 行高；
 * - 中性色复用项目既有色板：正文 #333333 / 次级 #6a737d（main.css 浅色回退
 *   值），深色正文 #c9d1d9 / 次级 #8b949e（main.css 深色语法注释色），画布
 *   深色取 --diff-gutter-bg 深色值 #161b22，不引入新色相；
 * - print 段：打印导出文件时保留红绿底色（print-color-adjust: exact）并
 *   逐行避免跨页断开。
 */
const EXPORT_CSS = `
:root {
  color-scheme: light dark;
  --diff-del-bg: #ffebe9;
  --diff-del-word-bg: #ffc1bc;
  --diff-del-text: #82071a;
  --diff-add-bg: #dafbe1;
  --diff-add-word-bg: #aceebb;
  --diff-add-text: #116329;
  --diff-gutter-bg: #f6f8fa;
  --diff-hunk-bg: #ddf4ff;
  --fg: #333333;
  --fg-soft: #6a737d;
  --bg: #ffffff;
}
@media (prefers-color-scheme: dark) {
  :root {
    --diff-del-bg: #78191b;
    --diff-del-word-bg: #9c3231;
    --diff-del-text: #ff8181;
    --diff-add-bg: #1a4721;
    --diff-add-word-bg: #2ea04366;
    --diff-add-text: #7ee787;
    --diff-gutter-bg: #161b22;
    --diff-hunk-bg: #121d2f;
    --fg: #c9d1d9;
    --fg-soft: #8b949e;
    --bg: #161b22;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 24px;
  background-color: var(--bg);
  color: var(--fg);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 20px;
}
.report-head h1 { margin: 0 0 8px; font-size: 18px; line-height: 28px; }
.report-head .meta { margin: 0; color: var(--fg-soft); font-size: 12px; }
.report-head .stats { margin: 8px 0 16px; font-weight: 600; }
.stats .is-add { color: var(--diff-add-text); }
.stats .is-del { color: var(--diff-del-text); }
/* 行号列：gutter 灰底、右对齐、数字弱化；数字颜色跟随行色调（GitHub 风格） */
.ln {
  background-color: var(--diff-gutter-bg);
  color: var(--fg-soft);
  text-align: right;
  padding: 0 8px 0 6px;
  white-space: pre;
  user-select: none;
}
.ln.tone-del { color: var(--diff-del-text); }
.ln.tone-add { color: var(--diff-add-text); }
/* 记号列（−/+）：与内容列共用行底色 */
.sign { text-align: center; white-space: pre; user-select: none; }
/* 内容列：pre-wrap 保留空格与换行语义、超长行自动换行（导出不截断） */
.txt {
  padding: 0 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
/* 行底色 / 文字色：红删绿增（--diff-* 字面值，随系统深浅切换） */
.txt.tone-del, .sign.tone-del {
  background-color: var(--diff-del-bg);
  color: var(--diff-del-text);
}
.txt.tone-add, .sign.tone-add {
  background-color: var(--diff-add-bg);
  color: var(--diff-add-text);
}
/* split 两列表格：行高由 20px 的单元格 height 保底（表格布局中 height 即
   最小高度），空行 / 空占位格不塌陷 */
table.split-table { border-collapse: collapse; width: 100%; }
table.split-table td { vertical-align: top; height: 20px; overflow-wrap: anywhere; }
table.split-table td.ln { width: 48px; }
table.split-table td.sign { width: 20px; }
/* unified 单栏行：grid 四列（旧行号 | 新行号 | 记号 | 内容），min-height 保底行高 */
.u-row { display: grid; grid-template-columns: 48px 48px 20px minmax(0, 1fr); }
.u-row > .ln, .u-row > .sign, .u-row > .txt { min-height: 20px; }
.u-row > .sign { width: 20px; }
@media print {
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { padding: 0; }
  tr, .u-row { break-inside: avoid; page-break-inside: avoid; }
}
`

/**
 * 统计输入文本的「规范化行数」（头部元信息「原始文本 N 行」用）。
 * 口径与引擎规范化（ENG-010）一致：CRLF / CR 归一为 LF、尾部换行不算独立行、
 * 空文本为 0 行 —— 头部展示的行数与结果视图的行号体系可对上。
 */
function countNormalizedLines(text: string): number {
  if (text === '') return 0
  const normalized = text.replace(/\r\n?/g, '\n').replace(/\n$/, '')
  return normalized.split('\n').length
}

/**
 * 一行 DiffRow → split 两列表格的 <tr> HTML（左半 = 原始侧、右半 = 更改侧）。
 *
 * 结构：每半边三格「行号 | 记号 | 内容」；del 行右半、add 行左半为无色调
 * 空占位格（占位保布局）；modify 左「−」红右「+」绿（与并排视图记号约定
 * 一致）；equal 双侧无记号无底色。
 * 行文本必经 escapeHtml；longLine 不截断（导出存档语义，见文件头注释）。
 */
function splitRowHtml(row: DiffRow): string {
  const cells = (
    side: DiffRowSide | undefined,
    sign: string,
    tone: string,
  ): string => {
    const lineNo = side !== undefined ? String(side.lineNo) : ''
    const text = side !== undefined ? escapeHtml(side.text) : ''
    return `<td class="ln${tone}">${lineNo}</td><td class="sign${tone}">${sign}</td><td class="txt${tone}">${text}</td>`
  }
  switch (row.type) {
    case 'equal':
      return `<tr class="d-row">${cells(row.left, ' ', '')}${cells(row.right, ' ', '')}</tr>`
    case 'del':
      return `<tr class="d-row">${cells(row.left, '−', ' tone-del')}${cells(undefined, '', '')}</tr>`
    case 'add':
      return `<tr class="d-row">${cells(undefined, '', '')}${cells(row.right, '+', ' tone-add')}</tr>`
    case 'modify':
      return `<tr class="d-row">${cells(row.left, '−', ' tone-del')}${cells(row.right, '+', ' tone-add')}</tr>`
  }
}

/**
 * 一行 DiffRow → unified 单栏的 1..2 条显示行 HTML。
 *
 * 结构：四格「旧行号 | 新行号 | 记号 | 内容」；行号分列取自【各自侧】的
 * lineNo（两侧行号独立计数，与 UnifiedDiffView 的行号列口径一致）：
 * equal → old = left.lineNo / new = right.lineNo + 空格记号；del → 旧行号 +
 * 「−」；add → 新行号 +「+」；modify 防御性展开为一条 del 半行 + 一条 add
 * 半行（unified 单栏一行只承载一侧内容，与 core/types.ts 的 unified 渲染
 * 约定一致）。内容取侧：equal 取 right（兜底 left）、del 取 left、add 取
 * right（与 UnifiedDiffView 相同）。
 * 行文本必经 escapeHtml；longLine 不截断（导出存档语义，见文件头注释）。
 */
function unifiedRowHtml(row: DiffRow): string {
  const line = (
    oldSide: DiffRowSide | undefined,
    newSide: DiffRowSide | undefined,
    sign: string,
    tone: string,
  ): string => {
    const oldNo = oldSide !== undefined ? String(oldSide.lineNo) : ''
    const newNo = newSide !== undefined ? String(newSide.lineNo) : ''
    const text = escapeHtml((newSide ?? oldSide ?? { text: '' }).text)
    return `<div class="u-row"><span class="ln${tone}">${oldNo}</span><span class="ln${tone}">${newNo}</span><span class="sign${tone}">${sign}</span><span class="txt${tone}">${text}</span></div>`
  }
  switch (row.type) {
    case 'equal':
      return line(row.left, row.right, ' ', '')
    case 'del':
      return line(row.left, undefined, '−', ' tone-del')
    case 'add':
      return line(undefined, row.right, '+', ' tone-add')
    case 'modify':
      return line(row.left, undefined, '−', ' tone-del') + line(undefined, row.right, '+', ' tone-add')
  }
}

/**
 * 把一次成功对比组装为完整单文件 HTML 文档（INT-002 导出 HTML 的核心纯函数）。
 *
 * 文档结构：
 * - <title>：文本差异对比 · 导出时间（时间文本同样转义）；
 * - 头部（.report-head）：标题 + meta 行（导出时间 / 视图模式 / 语言 + 两侧
 *   输入的规范化行数）+ 统计行「+N −M · H 处差异」（N/M/H 取自 stats）；
 * - 正文：按 meta.viewMode 分流 —— 'split' 渲染两列表格（<table>，左删右增、
 *   双侧行号、−/+ 记号、行底色对齐 §3.2），'unified' 渲染单栏行（+/−/空格、
 *   双行号）；
 * - 全部行文本经 escapeHtml；white-space: pre-wrap 保空格换行语义；空行由
 *   CSS 保底行高；longLine 行不截断（存档语义，见文件头）；
 * - 样式全部内联（EXPORT_CSS）：--diff-* 字面值（浅色默认 + prefers-color-
 *   scheme: dark）、无 JS、无外部资源，打印友好。
 *
 * @param input 一次成功对比的完整快照（见 ExportInput）
 * @returns 完整 HTML 文档字符串（以 <!DOCTYPE html> 开头、</html> 结尾）
 */
export function buildExportHtml(input: ExportInput): string {
  const { left, right, rows, stats, meta } = input
  const viewLabel = meta.viewMode === 'split' ? '并排' : '统一'
  const body =
    meta.viewMode === 'split'
      ? `<table class="split-table"><tbody>${rows.map(splitRowHtml).join('')}</tbody></table>`
      : rows.map(unifiedRowHtml).join('')
  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>文本差异对比 · ${escapeHtml(meta.exportedAt)}</title>`,
    `<style>${EXPORT_CSS}</style>`,
    '</head>',
    '<body>',
    '<header class="report-head">',
    '<h1>文本差异对比</h1>',
    `<p class="meta">导出时间：${escapeHtml(meta.exportedAt)} · 视图：${viewLabel} · 语言：${escapeHtml(meta.language)}</p>`,
    `<p class="meta">原始文本 ${countNormalizedLines(left)} 行 · 更改后文本 ${countNormalizedLines(right)} 行</p>`,
    `<p class="stats"><span class="is-add">+${stats.addedLines}</span> <span class="is-del">−${stats.removedLines}</span> · ${stats.hunkCount} 处差异</p>`,
    '</header>',
    body,
    '</body>',
    '</html>',
    '',
  ].join('\n')
}
