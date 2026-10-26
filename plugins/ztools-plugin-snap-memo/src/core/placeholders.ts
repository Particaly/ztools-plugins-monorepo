/**
 * 占位符引擎（纯函数）。
 *
 * 语法：
 *   {date} {time} {datetime} {weekday} {timestamp} {clipboard} {uuid}
 *   {date:YYYY-MM-DD} {time:HH:mm} {datetime:YYYY/MM/DD HH:mm} —— 日期/时间格式自定义
 *   {date+1} {date-1} {date+3d} {date-2w} {date+1m} {date+1y}  —— 偏移日期（默认单位天）
 *   {random:1-100} {random:6}    —— 区间随机整数 / n 位随机数字串
 *   {choice:a|b|c}               —— 随机选一项
 *   {input:标签} {input:标签=默认值}           —— 粘贴前弹填写框
 *   \{xxx}                        —— 反斜杠转义，保留字面量
 *   格式串内 [文字]               —— 方括号包裹的字面量，不参与 token 替换
 *
 * 未知占位符（如代码模板里的 ${x}、JSON 的 {}）原样保留，避免破坏用户内容。
 */

export interface TextSegment {
  type: 'text'
  text: string
}

export interface PlaceholderSegment {
  type: 'ph'
  /** 占位符名称：date/time/datetime/weekday/timestamp/clipboard/uuid/input/random/choice。 */
  name: string
  /** 冒号后的原始参数（如格式串或 input 标签）。 */
  arg: string | undefined
  /** 日期类占位符的偏移量（{date+3d} → { n: 3, unit: 'd' }）；无偏移为 undefined。 */
  dateOffset?: { n: number; unit: 'd' | 'w' | 'm' | 'y' }
  /** 原文（未命中解析时需要原样还原）。 */
  raw: string
}

export type Segment = TextSegment | PlaceholderSegment

export interface InputPrompt {
  /** 按“input:标签”去重的键。 */
  key: string
  label: string
  defaultValue: string
}

export interface ResolveContext {
  now?: Date
  /** 宿主剪贴板文本；不可用时为 undefined（{clipboard} 解析为空串）。 */
  clipboardText?: string
  /** 填写框收集到的答案。 */
  answers?: Record<string, string>
}

export interface ResolveResult {
  text: string
  /** 解析过程中收集到的 {input:..} 提示（按出现顺序、按标签去重）。 */
  prompts: InputPrompt[]
}

const KNOWN_NAMES = new Set(['date', 'time', 'datetime', 'weekday', 'timestamp', 'clipboard', 'uuid', 'input', 'random', 'choice'])
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

/** 日期占位符名 + 偏移后缀（+1 / -2w / +1m / +1y）的解析。 */
const DATE_NAME_RE = /^(date|time|datetime|weekday)([+-]\d+[dwmy]?)?$/

/**
 * 把模板解析为 text/ph 片段序列。反斜杠仅在后跟 `{` 时转义，其余情况保留字面量。
 */
export function parsePlaceholders(input: string): Segment[] {
  const segments: Segment[] = []
  let buf = ''
  let i = 0
  const pushText = () => {
    if (buf) {
      segments.push({ type: 'text', text: buf })
      buf = ''
    }
  }
  while (i < input.length) {
    const ch = input[i]
    if (ch === '\\' && input[i + 1] === '{') {
      buf += '{'
      i += 2
      continue
    }
    if (ch !== '{') {
      buf += ch
      i += 1
      continue
    }
    const end = input.indexOf('}', i + 1)
    if (end === -1) {
      buf += ch
      i += 1
      continue
    }
    const inner = input.slice(i + 1, end)
    const colon = inner.indexOf(':')
    const name = colon === -1 ? inner.trim() : inner.slice(0, colon).trim()
    const arg = colon === -1 ? undefined : inner.slice(colon + 1)
    const seg = buildSegment(name, arg, input.slice(i, end + 1))
    if (seg) {
      pushText()
      segments.push(seg)
    } else {
      buf += input.slice(i, end + 1)
    }
    i = end + 1
  }
  pushText()
  return segments
}

/** 名称命中已知占位符（含日期偏移变体）时构造片段，否则返回 null（原样保留）。 */
function buildSegment(name: string, arg: string | undefined, raw: string): PlaceholderSegment | null {
  if (KNOWN_NAMES.has(name)) return { type: 'ph', name, arg, raw }
  const dateMatch = DATE_NAME_RE.exec(name)
  if (dateMatch) {
    const offsetRaw = dateMatch[2]
    let dateOffset: PlaceholderSegment['dateOffset'] | undefined
    if (offsetRaw) {
      const n = parseInt(offsetRaw, 10)
      const unitChar = offsetRaw.slice(-1).toLowerCase()
      const unit = nwmUnit(unitChar)
      if (!Number.isFinite(n) || n === 0) return null
      dateOffset = { n, unit }
    }
    return { type: 'ph', name: dateMatch[1], arg, dateOffset, raw }
  }
  return null
}

function nwmUnit(ch: string): 'd' | 'w' | 'm' | 'y' {
  if (ch === 'w') return 'w'
  if (ch === 'm') return 'm'
  if (ch === 'y') return 'y'
  return 'd'
}

/** 按偏移量移动日期：d 天 / w 周 / m 自然月 / y 自然年。返回新 Date（不改动入参）。 */
export function shiftDate(date: Date, offset: { n: number; unit: 'd' | 'w' | 'm' | 'y' }): Date {
  const next = new Date(date.getTime())
  switch (offset.unit) {
    case 'd':
      next.setDate(next.getDate() + offset.n)
      break
    case 'w':
      next.setDate(next.getDate() + offset.n * 7)
      break
    case 'm':
      next.setMonth(next.getMonth() + offset.n)
      break
    case 'y':
      next.setFullYear(next.getFullYear() + offset.n)
      break
  }
  return next
}

/**
 * 按 dayjs 风格子集格式化：YYYY YY MM DD HH mm ss SSS。
 * 方括号 [文字] 内的内容是字面量，不参与 token 替换（避免 ADD/HHmm 之类的误替换）。
 * 其余未知字符原样保留，方便用户写 "YYYY年MM月DD日"。
 */
export function formatDate(date: Date, pattern: string): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  const replaceTokens = (s: string) =>
    s.replace(/YYYY|YY|MM|DD|HH|mm|ss|SSS/g, (token) => {
      switch (token) {
        case 'YYYY':
          return String(date.getFullYear())
        case 'YY':
          return pad(date.getFullYear() % 100)
        case 'MM':
          return pad(date.getMonth() + 1)
        case 'DD':
          return pad(date.getDate())
        case 'HH':
          return pad(date.getHours())
        case 'mm':
          return pad(date.getMinutes())
        case 'ss':
          return pad(date.getSeconds())
        case 'SSS':
          return pad(date.getMilliseconds(), 3)
        default:
          return token
      }
    })
  // 先抽出 [字面量]，对剩余部分做 token 替换，再回填
  const literals: string[] = []
  const skeleton = pattern.replace(/\[([^\]]*)\]/g, (_, inner: string) => {
    literals.push(inner)
    return `\u0000${literals.length - 1}\u0000`
  })
  let out = replaceTokens(skeleton)
  literals.forEach((literal, idx) => {
    out = out.replace(`\u0000${idx}\u0000`, literal)
  })
  return out
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // 兜底：无 crypto.randomUUID 的环境（旧 WebView）
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** {random:参数}：`a-b` 为闭区间随机整数；单个数字 n 为 n 位随机数字串（1~16 位）。 */
function resolveRandom(arg: string | undefined): string {
  const spec = (arg ?? '').trim()
  const range = /^(-?\d+)\s*-\s*(-?\d+)$/.exec(spec)
  if (range) {
    const min = parseInt(range[1], 10)
    const max = parseInt(range[2], 10)
    if (min <= max) return String(min + Math.floor(Math.random() * (max - min + 1)))
    return String(max + Math.floor(Math.random() * (min - max + 1)))
  }
  const digits = /^\d+$/.test(spec) ? Math.min(16, Math.max(1, parseInt(spec, 10))) : 0
  if (digits > 0) {
    let out = String(Math.floor(Math.random() * 9) + 1)
    for (let i = 1; i < digits; i++) out += String(Math.floor(Math.random() * 10))
    return out
  }
  return String(Math.floor(Math.random() * 100))
}

/** {choice:a|b|c}：按竖线分隔随机取一项；空参数返回空串。 */
function resolveChoice(arg: string | undefined): string {
  const options = (arg ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (options.length === 0) return ''
  return options[Math.floor(Math.random() * options.length)] ?? ''
}

function resolvePlaceholder(seg: PlaceholderSegment, ctx: ResolveContext): string {
  const base = ctx.now ?? new Date()
  const now = seg.dateOffset ? shiftDate(base, seg.dateOffset) : base
  switch (seg.name) {
    case 'date':
      return formatDate(now, seg.arg ?? 'YYYY-MM-DD')
    case 'time':
      return formatDate(now, seg.arg ?? 'HH:mm:ss')
    case 'datetime':
      return formatDate(now, seg.arg ?? 'YYYY-MM-DD HH:mm:ss')
    case 'weekday':
      return WEEKDAYS[now.getDay()]
    case 'timestamp':
      return String(now.getTime())
    case 'clipboard':
      return ctx.clipboardText ?? ''
    case 'uuid':
      return uuid()
    case 'random':
      return resolveRandom(seg.arg)
    case 'choice':
      return resolveChoice(seg.arg)
    case 'input': {
      const spec = seg.arg ?? ''
      const eq = spec.indexOf('=')
      const label = (eq === -1 ? spec : spec.slice(0, eq)).trim()
      const key = `input:${label}`
      const answer = ctx.answers?.[key]
      // 未作答时保留原始占位符字面量；正常流程 UI 会先收集 answers 再解析，不会走到这里。
      return answer !== undefined ? answer : seg.raw
    }
    default:
      return seg.raw
  }
}

/**
 * 解析片段序列为最终文本。
 * 未作答的 {input:..} 以转义字面量占位返回，并出现在 prompts 中供 UI 弹填写框；
 * UI 收集答案后再次调用即可得到完整文本。
 */
export function resolveSegments(segments: Segment[], ctx: ResolveContext): ResolveResult {
  let text = ''
  const prompts: InputPrompt[] = []
  const byKey = new Map<string, InputPrompt>()
  for (const seg of segments) {
    if (seg.type === 'text') {
      text += seg.text
      continue
    }
    if (seg.name === 'input') {
      const spec = seg.arg ?? ''
      const eq = spec.indexOf('=')
      const label = (eq === -1 ? spec : spec.slice(0, eq)).trim() || '内容'
      const defaultValue = eq === -1 ? '' : spec.slice(eq + 1)
      const key = `input:${label}`
      const existing = byKey.get(key)
      if (!existing) {
        const prompt: InputPrompt = { key, label, defaultValue }
        byKey.set(key, prompt)
        prompts.push(prompt)
      } else if (!existing.defaultValue && defaultValue) {
        // 同标签多次出现：补齐第一个非空默认值，避免精心设置的默认值被静默丢弃
        existing.defaultValue = defaultValue
      }
    }
    text += resolvePlaceholder(seg, ctx)
  }
  return { text, prompts }
}

/** 便捷入口：解析 + 一步解析（无 input 交互时直接得到最终文本）。 */
export function resolveTemplate(input: string, ctx: ResolveContext): ResolveResult {
  return resolveSegments(parsePlaceholders(input), ctx)
}

/** 是否包含 {input:..}（用于判断粘贴前是否需要弹填写框）。 */
export function hasInputPlaceholder(segments: Segment[]): boolean {
  return segments.some((s) => s.type === 'ph' && s.name === 'input')
}
