/**
 * ============================================================================
 * 差异报告构建器（roadmap 任务 INT-003）
 * ============================================================================
 *
 * 把一次成功对比的结果（DiffResultOk 的 rows / hunks / stats）组装为可复制到
 * 剪贴板的报告文本，对应官网「分享链接」的本地化（无网分享路径）：
 *
 * - `buildUnifiedPatch`：unified patch 文本（git diff 同构，可贴进 issue /
 *   code review / `patch`、`git apply` 等标准工具）；
 * - `buildMarkdownReport`：Markdown 表格报告（统计 + 逐行差异表）；
 * - HTML 报告不在本文件实现：直接复用 `./exporters.ts` 的 `buildExportHtml`
 *   （单文件内联样式文档），App.vue 复制动作与落盘导出共用同一构建出口。
 *
 * 设计要点（对齐 core 其他模块的硬性约束）：
 * - 纯函数、零 UI 依赖：输入普通对象（不读 store、不碰 DOM、不碰剪贴板），
 *   可被单元测试直接覆盖（tests/core/reporters.test.ts），App.vue 只负责
 *   收集输入与复制；
 * - 前提：DiffRow 的两侧 text 恒为单行 —— 引擎 splitLines 按 CR/LF/CRLF
 *   切分（ENG-010 规范化），行内容不含任何换行符，因此 patch 的「行首前缀 +
 *   单行文本」形态与 Markdown 表格单元不会被换行破坏；
 * - 输出为纯文本字符串，末尾不追加换行符（剪贴板文本惯例，避免粘贴出尾空行）。
 * ============================================================================
 */

import type { DiffRow, DiffRowSide, DiffStats, Hunk } from './types'

/* -------------------------------------------------------------------------- */
/* 一、unified patch（buildUnifiedPatch）                                       */
/* -------------------------------------------------------------------------- */

/** buildUnifiedPatch 的输入：一次成功对比的完整快照（+ 命名元信息） */
export interface UnifiedPatchInput {
  /**
   * 完整展开的差异行序列（DiffResultOk.rows，含 equal 行）。
   * 说明：patch 正文按 hunks 逐块渲染（hunk.rows 是 rows 的切片），rows 本身
   * 仅作为契约完整性保留（与 hunks 同源传入，调用方无需自行裁剪）。
   */
  rows: DiffRow[]
  /** @@ 分块列表（DiffResultOk.hunks，ENG-008 产出，按出现顺序排列） */
  hunks: Hunk[]
  /**
   * 对比统计（DiffResultOk.stats）。
   * 说明：unified patch 格式本身没有统计段，本字段当前不进入输出 —— 保留在
   * 输入契约中是为了与其他 reporter 的输入形状对齐（调用方整包传入快照），
   * 也为未来在补丁头部追加注释统计行留出空间。
   */
  stats: DiffStats
  /** 命名元信息：patch 头 `---` / `+++` 行的两侧标题 */
  meta: {
    /** 旧文件（左侧）标题；缺省（undefined）用 `a/original` */
    leftTitle?: string
    /** 新文件（右侧）标题；缺省（undefined）用 `b/modified` */
    rightTitle?: string
  }
}

/**
 * 把一次成功对比组装为 unified patch 文本（INT-003 复制 patch 报告的核心纯函数）。
 *
 * 输出结构：
 * - 头部两行：`--- {leftTitle}` / `+++ {rightTitle}`。命名约定沿用 git
 *   unified diff 的 a/（旧）/ b/（新）目录习惯：缺省名固定为 `a/original` /
 *   `b/modified`；注入标题（如来源文件名）时【原样使用、不强制补 a/ b/ 前缀】
 *   —— 前缀是可读性习惯而非格式要求，`patch` / `git apply` 只依赖 hunk 头
 *   的行号计数，头两行文件名可为任意非空文本；
 * - 每个 hunk 一行 `@@` 头（原样使用 `hunk.header`，由 ENG-008 按
 *   `@@ -oldStart,oldLines +newStart,newLines @@` 生成）+ hunk.rows 逐行：
 *   - `'del'` / `'modify'` 的 left 侧 → `-{text}`；
 *   - `'add'` / `'modify'` 的 right 侧 → `+{text}`；
 *   - `'equal'` → ` {text}`（一个前导空格前缀；空文本行输出单个空格 ——
 *     上下文空行在 unified diff 中的标准形态）；
 *   - `'modify'` 行产出【相邻两条】（先 − 后 +），与 git 对修改行的展开一致；
 * - hunk 之间【不插入空行】：unified patch 对 hunk 间分隔无强制要求，git diff
 *   输出 hunk 间直接顺序排列，本实现保持同构（空行反而会被部分解析器当作
 *   补丁噪声）；
 * - hunks 为空（两侧无差异）→ 返回空字符串，由调用方负责提示（App 层 toast
 *   「两侧无差异，无需复制」），本函数不产生占位文本。
 *
 * 正确性锚（可被 `patch` / `git apply` 等标准工具解析的形态）：每行行首恰有
 * 一个前缀字符（' ' / '-' / '+' / '@' / '-'（文件头）/ '+'（文件头））；行文本
 * 内部的前缀字符（如文本本身以 `-` 或 `+` 开头）原样拼在前缀之后（如文本
 * `-x` 的删除行输出 `--x`），解析器按「首个字符 + 其余为内容」消费，语义正确。
 *
 * @param input 一次成功对比的完整快照（见 UnifiedPatchInput）
 * @returns patch 文本（各逻辑行以 \n 连接，末尾不追加换行）；无 hunks 时为 ''
 */
export function buildUnifiedPatch(input: UnifiedPatchInput): string {
  const { hunks, meta } = input
  // 无差异（hunks 空）→ 空串：patch 空文件无意义，提示交给调用方。
  if (hunks.length === 0) return ''

  const lines: string[] = [
    `--- ${meta.leftTitle ?? 'a/original'}`,
    `+++ ${meta.rightTitle ?? 'b/modified'}`,
  ]
  for (const hunk of hunks) {
    lines.push(hunk.header)
    for (const row of hunk.rows) {
      switch (row.type) {
        case 'equal':
          // 上下文行：前导空格前缀；空文本行即单个空格行。
          lines.push(` ${(row.right ?? row.left ?? { text: '' }).text}`)
          break
        case 'del':
          lines.push(`-${sideText(row.left)}`)
          break
        case 'add':
          lines.push(`+${sideText(row.right)}`)
          break
        case 'modify':
          // 修改对展开为相邻两条：先 −（旧）后 +（新），与 git 惯例一致。
          lines.push(`-${sideText(row.left)}`)
          lines.push(`+${sideText(row.right)}`)
          break
      }
    }
  }
  // hunk 间不插空行（git 同构，见函数注释）；末尾不追加换行（剪贴板惯例）。
  return lines.join('\n')
}

/**
 * 取单侧行文本（DiffRow 契约保证对应侧存在，此兜底仅防御脏数据）。
 */
function sideText(side: DiffRowSide | undefined): string {
  return side !== undefined ? side.text : ''
}

/* -------------------------------------------------------------------------- */
/* 二、Markdown 报告（buildMarkdownReport）                                     */
/* -------------------------------------------------------------------------- */

/**
 * Markdown 报告单元格内容的最大字符数（原始文本口径，不含转义与省略号）。
 * 超过该长度的行文本截断到该长度并追加 `…`（导出常数供测试与 UI 提示对齐）。
 */
export const MARKDOWN_CONTENT_MAX_CHARS = 1000

/** buildMarkdownReport 的输入：一次成功对比的行序列 + 统计 + 生成时间 */
export interface MarkdownReportInput {
  /** 完整展开的差异行序列（DiffResultOk.rows，含 equal 行） */
  rows: DiffRow[]
  /** 对比统计（DiffResultOk.stats），渲染为 +N −M · H 处差异 */
  stats: DiffStats
  /** 生成时间的人类可读文案（如 '2026-08-30 12:34:56'） */
  meta: {
    /** 报告生成时间（渲染进报告头部） */
    generatedAt: string
  }
}

/**
 * DiffRow 类型 → Markdown 表格「类型」列的中文文案。
 */
const MARKDOWN_ROW_TYPE_LABELS: Record<DiffRow['type'], string> = {
  equal: '相同',
  add: '新增',
  del: '删除',
  modify: '修改',
}

/**
 * 把一次成功对比组装为 Markdown 报告（INT-003 复制 Markdown 报告的核心纯函数）。
 *
 * 报告结构：
 * - 一级标题 `# 文本差异对比报告` + 生成时间 + 统计行（`+N −M · H 处差异`，
 *   减号用 U+2212，与 buildExportHtml 的统计行同款）；
 * - GFM 表格（含渲染所必需的 `| --- |` 分隔行）：`| 类型 | 旧行号 | 新行号 |
 *   内容 |`，每 DiffRow 一行 —— 类型按 MARKDOWN_ROW_TYPE_LABELS 映射；行号取
 *   各自侧 lineNo（1-based），缺失侧（del 的新行号 / add 的旧行号）占位 `—`；
 *   内容为反引号代码 span，取侧与 unified patch 相同（equal 取 right 兜底
 *   left、del 取 left、add 取 right；modify 两侧都在，内容渲染为
 *   `{旧文本} → {新文本}`）；
 * - 全 equal（或 rows 为空）→ 返回简化报告：只有标题 + 生成时间 + 统计 +
 *   「两侧内容相同，无差异行」说明，【不输出表格】—— 全 equal 的逐行表格
 *   是纯噪声，简化版在 issue / 聊天里更可读（选择记录于此）。
 *
 * 转义与截断规则（表格单元安全性）：
 * - 管道符 `|` → `\|`：GFM 表格单元内的管道符（包括代码 span 内）必须转义，
 *   否则被解析为列分隔符破坏表格；
 * - 反引号 `` ` `` → `` \` ``（任务指定的转义约定）：防止单反引号定界的代码
 *   span 被内容中的反引号提前闭合（CommonMark 的另一种解法是改用双反引号
 *   定界，此处按任务约定采用反斜杠转义，主流渲染器可读）；
 * - 原始文本超过 MARKDOWN_CONTENT_MAX_CHARS（1000）字符时截断到该长度并追加
 *   `…`【先截断、后转义】：若先转义再截断，可能把 `\|` / `` \` `` 序列从中间
 *   截断产生悬空反斜杠；截断口径是原始文本长度（转义会增长串长，不二次限制）；
 * - 前提：DiffRow.text 恒为单行（引擎 splitLines 按 CR/LF/CRLF 切分，行内容
 *   不含换行符），表格单元不会被内嵌换行破坏，无需换行转义。
 *
 * @param input 一次成功对比的快照（rows / stats + 生成时间）
 * @returns Markdown 报告文本（各逻辑行以 \n 连接，末尾不追加换行）
 */
export function buildMarkdownReport(input: MarkdownReportInput): string {
  const { rows, stats, meta } = input
  const header = [
    '# 文本差异对比报告',
    '',
    `生成时间：${meta.generatedAt}`,
    '',
    `统计：+${stats.addedLines} −${stats.removedLines} · ${stats.hunkCount} 处差异`,
  ]

  // 全 equal（或空结果）→ 简化报告：统计 + 说明，不输出表格（选择见函数注释）。
  const hasChanges = rows.some((row) => row.type !== 'equal')
  if (!hasChanges) {
    return [...header, '', '两侧内容相同，无差异行。'].join('\n')
  }

  const table = [
    '| 类型 | 旧行号 | 新行号 | 内容 |',
    '| --- | --- | --- | --- |',
    ...rows.map(markdownRowLine),
  ]
  return [...header, '', ...table].join('\n')
}

/**
 * 一行 DiffRow → Markdown 表格行（模块内私有）。
 *
 * 列取侧与内容规则见 buildMarkdownReport 主注释；行号缺失（del 无 right /
 * add 无 left）占位 `—`。每列间以 ` | ` 分隔（行首尾也有 `|`，GFM 宽容但
 * 统一收口便于测试断言）。
 */
function markdownRowLine(row: DiffRow): string {
  const oldNo = row.left !== undefined ? String(row.left.lineNo) : '—'
  const newNo = row.right !== undefined ? String(row.right.lineNo) : '—'
  let content: string
  switch (row.type) {
    case 'equal':
      content = markdownCellText((row.right ?? row.left ?? { text: '' }).text)
      break
    case 'del':
      content = markdownCellText(sideText(row.left))
      break
    case 'add':
      content = markdownCellText(sideText(row.right))
      break
    case 'modify':
      content = `${markdownCellText(sideText(row.left))} → ${markdownCellText(sideText(row.right))}`
      break
  }
  return `| ${MARKDOWN_ROW_TYPE_LABELS[row.type]} | ${oldNo} | ${newNo} | ${content} |`
}

/**
 * Markdown 表格「内容」列的单元格文本：截断（先）→ 转义（后）→ 反引号包裹。
 * 规则与顺序依据见 buildMarkdownReport 主注释（管道符 / 反引号转义、
 * MARKDOWN_CONTENT_MAX_CHARS 截断、先截断后转义的原因）。
 */
function markdownCellText(text: string): string {
  const truncated =
    text.length > MARKDOWN_CONTENT_MAX_CHARS
      ? `${text.slice(0, MARKDOWN_CONTENT_MAX_CHARS)}…`
      : text
  const escaped = truncated.replace(/`/g, '\\`').replace(/\|/g, '\\|')
  return `\`${escaped}\``
}
