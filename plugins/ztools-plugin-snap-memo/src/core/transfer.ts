/**
 * 导入 / 导出（纯函数）。
 * JSON 格式带 app 标识与 schemaVersion；合并策略按“ID 相同 → 内容比对（本地较新则保留本地），ID 不同 → 内容去重”。
 * 图片像素以 dataURL 形式放在 images 字段（图片槽 ID → dataURL，与 memos[].images 对齐）随 JSON 导出；
 * 新增条目重分配 memoId 时槽 ID 一并重分配并改写正文图片标记。设置随 settings 字段导出。
 * 文本导入支持：本应用导出的 CSV / Markdown（往返自洽）、纯文本（空行分段）、Espanso YAML；
 * JSON 导入支持：本应用导出、Alfred / 通用 snippets JSON（数组元素含 snippet/text/replace 字段）。
 */
import { CURRENT_SCHEMA_VERSION } from './migration'
import { sanitizeGroup, sanitizeMemo, sanitizeSettings } from './sanitize'
import { IMAGE_MAX_BYTES, type Group, type Memo, type MemoImage, type Settings } from './types'
import { IMG_TOKEN_RE, replaceImageTokenIds, stripImageTokens } from './inlineImage'

export interface ExportPayload {
  app: 'snap-memo'
  schemaVersion: number
  exportedAt: number
  groups: Group[]
  memos: Memo[]
  /** 导出时的设置（导入时可选择套用）；缺省表示旧版导出。 */
  settings?: Settings
  /** 携带图片的像素数据（图片槽 ID → dataURL，随 memos[].images 对齐）；无图片时缺省。
   *  旧版导出以 memoId 为键——旧结构槽 ID 约定等于 memoId，读取天然兼容。 */
  images?: Record<string, string>
}

/** 构建导出载荷（深拷贝，不携带调用方引用）。 */
export function buildExportPayload(
  memos: Memo[],
  groups: Group[],
  now: number = Date.now(),
  images?: Record<string, string>,
  settings?: Settings
): ExportPayload {
  const payload: ExportPayload = {
    app: 'snap-memo',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: now,
    groups: groups.map((g) => ({ ...g })),
    memos: memos.map((m) => ({ ...m }))
  }
  if (settings) payload.settings = { ...settings }
  if (images && Object.keys(images).length > 0) payload.images = { ...images }
  return payload
}

/** 从导入 JSON 里解析 images 字段：仅接受合法图片 dataURL，超限或非法条目直接丢弃。 */
export function parseImagesField(raw: unknown): Record<string, string> {
  const images: Record<string, string> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return images
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!id || typeof value !== 'string') continue
    if (!value.startsWith('data:image/')) continue
    if (value.length > Math.ceil((IMAGE_MAX_BYTES * 4) / 3) + 64) continue
    images[id] = value
  }
  return images
}

export type ParseImportResult = { ok: true; payload: ExportPayload } | { ok: false; error: string }

/** 解析并校验导入 JSON；任何结构问题都以中文错误说明，不抛异常。 */
export function parseImportPayload(text: string): ParseImportResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: '不是有效的 JSON 文件' }
  }
  if (!data || typeof data !== 'object') return { ok: false, error: '文件内容不是对象' }
  const raw = data as Record<string, unknown>
  if (raw.app !== 'snap-memo') {
    // 第三方 snippets JSON（Alfred 导出 / 通用 trigger+text 数组）兜底识别
    const converted = parseSnippetsJson(data)
    if (converted.length > 0) return { ok: true, payload: snippetsToPayload(converted) }
    return { ok: false, error: '不是速贴备忘导出的文件（缺少 app 标识），也不是可识别的 snippets 格式' }
  }
  if (!Array.isArray(raw.memos)) return { ok: false, error: '文件缺少 memos 字段' }
  const memos = (raw.memos as unknown[]).map(sanitizeMemo).filter((m): m is Memo => m !== null)
  const groups = sanitizeGroupListSafe(raw.groups)
  const images = parseImagesField(raw.images)
  const settings = raw.settings ? sanitizeSettings(raw.settings) : undefined
  if (memos.length === 0 && groups.length === 0) return { ok: false, error: '文件中没有可导入的数据' }
  const payload: ExportPayload = { app: 'snap-memo', schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt: 0, groups, memos, images }
  if (settings) payload.settings = settings
  return { ok: true, payload }
}

function sanitizeGroupListSafe(raw: unknown): Group[] {
  if (!Array.isArray(raw)) return []
  return raw.map(sanitizeGroup).filter((g): g is Group => g !== null)
}

// ---------- 第三方 snippets 导入（Alfred / 通用 JSON） ----------

export interface SnippetEntry {
  title: string
  content: string
  keyword?: string
}

/**
 * 识别第三方 snippets JSON：
 * - Alfred 导出：{ alfredsnippet: { name, keyword, snippet } }（单文件单条）
 * - 通用：对象里任意数组，元素含 snippet/text/replace 之一的字符串字段
 * 返回识别出的条目；空数组表示不认识该结构。
 */
export function parseSnippetsJson(data: unknown): SnippetEntry[] {
  if (!data || typeof data !== 'object') return []
  const out: SnippetEntry[] = []
  const alfred = (data as Record<string, unknown>).alfredsnippet
  if (alfred && typeof alfred === 'object') {
    const entry = snippetFromRecord(alfred as Record<string, unknown>)
    if (entry) out.push(entry)
    return out
  }
  for (const value of Object.values(data as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue
    for (const item of value) {
      if (!item || typeof item !== 'object') continue
      const entry = snippetFromRecord(item as Record<string, unknown>)
      if (entry) out.push(entry)
    }
  }
  return out
}

function snippetFromRecord(rec: Record<string, unknown>): SnippetEntry | null {
  const content = [rec.snippet, rec.text, rec.replace, rec.content].find((v): v is string => typeof v === 'string' && v.trim() !== '')
  if (!content) return null
  const title = [rec.name, rec.title, rec.trigger, rec.keyword].find((v): v is string => typeof v === 'string' && v.trim() !== '') ?? ''
  const keywordRaw = [rec.keyword, rec.trigger, rec.abbreviation].find((v): v is string => typeof v === 'string' && v.trim() !== '')
  return {
    title: title.trim().slice(0, 60),
    content,
    keyword: keywordRaw ? keywordRaw.trim().replace(/^:/, '').slice(0, 30) : undefined
  }
}

function snippetsToPayload(entries: SnippetEntry[], now: number = Date.now()): ExportPayload {
  return {
    app: 'snap-memo',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: now,
    groups: [],
    memos: entries.map((e, i) => ({
      id: `import-${now}-${i}`,
      title: e.title,
      content: e.content,
      kind: 'text' as const,
      groupId: null,
      tags: [] as string[],
      keyword: e.keyword,
      pinned: false,
      sensitive: false,
      order: i,
      useCount: 0,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now
    }))
  }
}

// ---------- 导入计划 ----------

/** 内容指纹：标题 + 正文 + 图片哈希集合 + 标签/分组/触发词/置顶，用于不同 ID 间的重复检测。 */
export function contentKey(
  memo: Pick<Memo, 'title' | 'content' | 'tags' | 'pinned'> &
    Partial<Pick<Memo, 'imageHash' | 'groupId' | 'keyword'>> & { images?: MemoImage[] }
): string {
  const hashes =
    memo.images && memo.images.length > 0
      ? memo.images
          .map((img) => img.hash)
          .sort()
          .join('|')
      : memo.imageHash ?? ''
  return [
    memo.title.trim(),
    memo.content.replace(/\r\n/g, '\n').trim(),
    hashes,
    [...memo.tags].sort().join('|'),
    memo.groupId ?? '',
    memo.keyword ?? '',
    memo.pinned ? '1' : '0'
  ].join('\u0000')
}

export interface ImportPlan {
  strategy: 'merge' | 'overwrite'
  /** 需要新分配 ID 的新增备忘（ID 冲突或无 ID 时已重分配）。 */
  memosToAdd: Memo[]
  /** 按 ID 命中且内容有变化、导入版较新的备忘（保留原使用统计）。 */
  memosToUpdate: Memo[]
  /** 内容完全一致、重复、或本地修改时间更晚（保留本地）而跳过的备忘。 */
  memosUnchanged: Memo[]
  /** 导入文件携带且有效的设置（导入时套用）；缺省为 null。 */
  settingsToApply: Settings | null
  groupsToAdd: Group[]
  groupRenameCount: number
  /** 导入后需要落盘的图片数据（槽 ID 已按计划重分配，与 memos 的 content/images 对齐）。 */
  imagesToSave: Array<{ slotId: string; dataUrl: string }>
}

/** 备注里引用的槽中携带像素数据的映射（槽 ID → dataURL）。 */
function carriedSlots(memo: Memo, incomingImages: Record<string, string>): string[] {
  if (!memo.images) return []
  return memo.images.filter((img) => incomingImages[img.id]).map((img) => img.id)
}

/**
 * 新增条目的槽 ID 重分配：随 memoId 一起换新 ID，同步改写正文标记与 images 元数据，
 * 返回重分配后的条目与需要落盘的像素对（新槽 ID → dataURL）。
 * 无像素数据的槽保持原 ID（元数据仍导入，渲染为「图片已丢失」占位）。
 */
function remapMemoSlots(
  memo: Memo,
  incomingImages: Record<string, string>,
  idAllocator: () => string
): { memo: Memo; pixels: Array<{ slotId: string; dataUrl: string }> } {
  if (!memo.images || memo.images.length === 0) return { memo, pixels: [] }
  const mapping = new Map<string, string>()
  const images = memo.images.map((img) => {
    if (!incomingImages[img.id]) return img
    const nextId = idAllocator()
    mapping.set(img.id, nextId)
    return { ...img, id: nextId }
  })
  const pixels = [...mapping].map(([oldId, nextId]) => ({ slotId: nextId, dataUrl: incomingImages[oldId]! }))
  return { memo: { ...memo, images, content: replaceImageTokenIds(memo.content, mapping) }, pixels }
}

/**
 * 生成导入计划（不修改现有数据），供 UI 展示“新增 n / 更新 n / 跳过 n”预览。
 * @param idAllocator 为 ID 冲突的新增项分配新 ID（传入保持可测试性）
 */
export function planImport(
  existingMemos: Memo[],
  existingGroups: Group[],
  incoming: ExportPayload,
  strategy: 'merge' | 'overwrite',
  idAllocator: () => string
): ImportPlan {
  if (strategy === 'overwrite') {
    return planOverwrite(existingMemos, existingGroups, incoming, idAllocator)
  }
  const plan: ImportPlan = {
    strategy,
    memosToAdd: [],
    memosToUpdate: [],
    memosUnchanged: [],
    settingsToApply: incoming.settings ?? null,
    groupsToAdd: [],
    groupRenameCount: 0,
    imagesToSave: []
  }
  const incomingImages = incoming.images ?? {}
  const existingById = new Map(existingMemos.map((m) => [m.id, m]))
  const existingKeys = new Set(existingMemos.map(contentKey))
  const existingGroupIds = new Set(existingGroups.map((g) => g.id))
  const existingGroupNames = new Set(existingGroups.map((g) => g.name))
  const validGroupIds = new Set(existingGroupIds)

  for (const group of incoming.groups) {
    if (existingGroupIds.has(group.id)) continue
    let resolved = group
    if (existingGroupNames.has(group.name)) {
      resolved = { ...group, name: uniqueGroupName(group.name, existingGroupNames) }
      plan.groupRenameCount += 1
    }
    existingGroupNames.add(resolved.name)
    validGroupIds.add(resolved.id)
    plan.groupsToAdd.push(resolved)
  }
  for (const memo of incoming.memos) {
    const local = existingById.get(memo.id)
    if (local) {
      if (contentKey(local) === contentKey(memo)) {
        plan.memosUnchanged.push(local)
      } else if (local.updatedAt > memo.updatedAt) {
        // 双端都改过且本地较新：保留本地，静默覆盖会让另一台设备的修改丢失
        plan.memosUnchanged.push(local)
      } else {
        // 内容有变化且导入版较新：取导入版字段，保留本地使用统计
        plan.memosToUpdate.push({ ...memo, useCount: local.useCount, lastUsedAt: local.lastUsedAt })
        for (const slot of carriedSlots(memo, incomingImages)) {
          plan.imagesToSave.push({ slotId: slot, dataUrl: incomingImages[slot]! })
        }
      }
      existingKeys.add(contentKey(memo))
      continue
    }
    const key = contentKey(memo)
    if (existingKeys.has(key)) {
      plan.memosUnchanged.push(memo)
      continue
    }
    existingKeys.add(key)
    const newId = idAllocator()
    const remapped = remapMemoSlots({ ...memo, id: newId }, incomingImages, idAllocator)
    plan.memosToAdd.push(remapped.memo)
    plan.imagesToSave.push(...remapped.pixels)
  }
  repairDanglingGroups(plan, validGroupIds)
  return plan
}

function planOverwrite(
  existingMemos: Memo[],
  _existingGroups: Group[],
  incoming: ExportPayload,
  idAllocator: () => string
): ImportPlan {
  const existingById = new Set(existingMemos.map((m) => m.id))
  const incomingImages = incoming.images ?? {}
  const memosToAdd: Memo[] = []
  const memosToUpdate: Memo[] = []
  const imagesToSave: Array<{ slotId: string; dataUrl: string }> = []
  const seenKeys = new Set<string>()
  for (const memo of incoming.memos) {
    const key = contentKey(memo)
    if (seenKeys.has(key)) continue
    seenKeys.add(key)
    if (existingById.has(memo.id)) {
      memosToUpdate.push({ ...memo })
      for (const slot of carriedSlots(memo, incomingImages)) {
        imagesToSave.push({ slotId: slot, dataUrl: incomingImages[slot]! })
      }
    } else {
      const id = memo.id || idAllocator()
      const remapped = remapMemoSlots({ ...memo, id }, incomingImages, idAllocator)
      memosToAdd.push(remapped.memo)
      imagesToSave.push(...remapped.pixels)
    }
  }
  const plan: ImportPlan = {
    strategy: 'overwrite',
    memosToAdd,
    memosToUpdate,
    memosUnchanged: [],
    settingsToApply: incoming.settings ?? null,
    groupsToAdd: incoming.groups.map((g) => ({ ...g })),
    groupRenameCount: 0,
    imagesToSave
  }
  repairDanglingGroups(plan, new Set(incoming.groups.map((g) => g.id)))
  return plan
}

/** 引用不存在分组的条目归位到未分组（源端数据损坏时不产生悬空 groupId）。 */
function repairDanglingGroups(plan: ImportPlan, validGroupIds: Set<string>): void {
  for (const memo of [...plan.memosToAdd, ...plan.memosToUpdate]) {
    if (memo.groupId && !validGroupIds.has(memo.groupId)) memo.groupId = null
  }
}

function uniqueGroupName(base: string, taken: Set<string>): string {
  let name = `${base}(导入)`
  let i = 2
  while (taken.has(name)) {
    name = `${base}(导入${i})`
    i += 1
  }
  return name
}

// ---------- 文本导入 ----------

export interface TextImportEntry {
  title: string
  content: string
  tags: string[]
  /** 分组名（导入时按名建组/复用）；null 表示未分组。 */
  groupName: string | null
  keyword?: string
}

/**
 * 纯文本导入：自动识别三种格式——
 * 1. 本应用导出的 CSV（首行为标题行）→ 逐条还原（含分组/标签/触发词）
 * 2. 本应用导出的 Markdown（首行 `# 速贴备忘导出`）→ 按分节结构还原
 * 3. Espanso YAML（含 `matches:`）→ trigger/replace 映射为标题/内容/触发词
 * 其余按“空行分段、每段一条；标题取首行（截断 60 字符）”处理。
 */
export function parseTextImport(text: string): TextImportEntry[] {
  const normalized = text.replace(/\r\n/g, '\n')
  const trimmed = normalized.trim()
  if (!trimmed) return []
  // 本应用 CSV：首行引号包裹且包含「标题」「内容」表头
  const firstLine = trimmed.split('\n')[0] ?? ''
  if (/^"#?标题"/.test(firstLine.trim()) || (firstLine.includes('标题') && firstLine.includes('内容') && firstLine.includes(','))) {
    const rows = parseCsv(normalized)
    if (rows.length > 1) return csvToEntries(rows)
  }
  if (trimmed.startsWith('# 速贴备忘导出')) {
    const entries = parseOwnMarkdown(trimmed)
    if (entries.length > 0) return entries
  }
  if (/^matches:\s*$/m.test(trimmed) || trimmed.startsWith('matches:')) {
    const entries = parseEspanso(trimmed)
    if (entries.length > 0) return entries
  }
  return normalized
    .split(/\n[ \t]*\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => {
      const firstLineEnd = block.indexOf('\n')
      const first = firstLineEnd === -1 ? block : block.slice(0, firstLineEnd)
      return { title: first.trim().slice(0, 60), content: block, tags: [], groupName: null }
    })
}

/** RFC4180 风格 CSV 解析：引号字段支持内嵌逗号/换行/双引号转义。 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch !== '\r') {
      field += ch
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** 表头列名 → 下标映射；兼容本应用导出的列集合（缺失列按空处理）。 */
function csvToEntries(rows: string[][]): TextImportEntry[] {
  const header = rows[0] ?? []
  const col = (name: string) => header.indexOf(name)
  const cTitle = col('标题')
  const cContent = col('内容')
  if (cTitle === -1 || cContent === -1) return []
  const cGroup = col('分组')
  const cTags = col('标签')
  const cKeyword = col('触发词')
  const entries: TextImportEntry[] = []
  for (const row of rows.slice(1)) {
    const content = row[cContent] ?? ''
    if (!row[cTitle] && !content) continue
    const tags = (cTags >= 0 ? row[cTags] ?? '' : '')
      .split(/[、,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8)
    const groupName = cGroup >= 0 ? (row[cGroup] ?? '').trim() || null : null
    const keyword = cKeyword >= 0 ? (row[cKeyword] ?? '').trim() || undefined : undefined
    entries.push({ title: row[cTitle] ?? '', content, tags, groupName, keyword })
  }
  return entries
}

/** 还原本应用导出的 Markdown（图片条目无法还原像素，退化为文本条目：正文用备注/识别文字）。 */
function parseOwnMarkdown(text: string): TextImportEntry[] {
  const lines = text.split('\n')
  const entries: TextImportEntry[] = []
  let groupName: string | null = null
  let title = ''
  let tags: string[] = []
  let bodyLines: string[] = []
  let inFence = false
  let isImage = false
  const flush = () => {
    if (!title && bodyLines.length === 0) return
    let content = bodyLines.join('\n').replace(/^\n+|\n+$/g, '')
    if (isImage) {
      const ocrLine = content.match(/^识别文字：([\s\S]*)$/)
      content = ocrLine ? ocrLine[1] ?? '' : ''
    }
    entries.push({ title, content, tags, groupName })
    title = ''
    tags = []
    bodyLines = []
    isImage = false
  }
  for (const line of lines) {
    if (line.startsWith('## ') && !line.startsWith('### ')) {
      flush()
      groupName = line.slice(3).trim() || null
      continue
    }
    if (line.startsWith('### ')) {
      flush()
      title = line.slice(4).trim()
      continue
    }
    if (title) {
      const tagMatch = line.match(/^标签：(.+)$/)
      if (tagMatch && bodyLines.every((l) => !l.trim())) {
        tags = (tagMatch[1] ?? '')
          .split('、')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 8)
        bodyLines = []
        continue
      }
      if (line.trim() === '[图片]') {
        isImage = true
        continue
      }
      if (line.startsWith('```')) {
        inFence = !inFence
        continue
      }
      bodyLines.push(line)
    }
  }
  flush()
  return entries
}

/** Espanso YAML 子集解析：matches 列表下的 trigger/replace 字段（支持 "引号" 与 | / |- 块标量），其余字段忽略。 */
function parseEspanso(text: string): TextImportEntry[] {
  const lines = text.split('\n')
  const entries: TextImportEntry[] = []
  let itemIndent = -1
  let current: { trigger?: string; replace?: string } | null = null
  // 块标量状态：key 为收集中的字段，blockIndent 为键所在缩进，contentIndent 为首个内容行的实际缩进
  let blockKey: 'trigger' | 'replace' | null = null
  let blockIndent = 0
  let blockContentIndent = 0
  let blockLines: string[] = []

  const flushItem = () => {
    if (blockKey) finishBlock()
    if (current && (current.replace ?? '').trim()) {
      const trigger = (current.trigger ?? '').replace(/^:/, '').trim()
      entries.push({
        title: trigger || (current.replace ?? '').split('\n')[0].slice(0, 40),
        content: current.replace ?? '',
        tags: [],
        groupName: null,
        keyword: trigger || undefined
      })
    }
    current = null
    blockKey = null
    blockLines = []
  }

  const unquote = (v: string) => v.replace(/^['"]|['"]$/g, '').trim()

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '')
    if (!line.trim() || /^\s*#/.test(line)) continue
    if (itemIndent === -1) {
      if (/^matches:\s*$/.test(line)) itemIndent = 0
      continue
    }
    const indent = line.length - line.trimStart().length
    if (/^-\s/.test(line.trim())) {
      flushItem()
      itemIndent = indent
      current = {}
      const rest = line.trim().slice(2)
      const kv = /^(\w+):\s*(.*)$/.exec(rest)
      if (kv) applyField(kv[1] ?? '', kv[2] ?? '', indent)
      continue
    }
    if (!current) continue
    if (blockKey) {
      // 块标量：收集到缩进回落为止；按首个内容行的实际缩进剥掉前缀
      if (indent > blockIndent || !line.trim()) {
        if (line.trim() && blockLines.length === 0) blockContentIndent = indent
        blockLines.push(line.slice(blockContentIndent))
        continue
      }
      finishBlock()
    }
    const kv = /^(\w+):\s*(.*)$/.exec(line.trim())
    if (kv && indent >= itemIndent) applyField(kv[1] ?? '', kv[2] ?? '', indent)
  }
  if (blockKey) finishBlock()
  flushItem()
  return entries

  function applyField(key: string, value: string, indent: number): void {
    if (key !== 'trigger' && key !== 'replace' || !current) return
    const v = value.trim()
    if (v === '|' || v === '|-' || v === '|+' || v === '>' || v === '>-') {
      blockKey = key
      blockIndent = indent
      blockContentIndent = indent + 2
      blockLines = []
      return
    }
    if (key === 'trigger') current.trigger = unquote(v)
    else current.replace = unquote(v)
  }

  function finishBlock(): void {
    if (!current || !blockKey) return
    const joined = blockLines.join('\n').replace(/\n+$/, '')
    if (blockKey === 'trigger') current.trigger = joined
    else current.replace = joined
    blockKey = null
    blockLines = []
  }
}

// ---------- 导出 ----------

/** 内容里最长反引号连续串的长度（用于决定代码围栏长度，避免内容包含 ``` 时破坏结构）。 */
function maxBacktickRun(content: string): number {
  let max = 0
  for (const m of content.matchAll(/`+/g)) {
    max = Math.max(max, m[0].length)
  }
  return max
}

/** 导出为 Markdown：按分组分节，条目用代码块保留原始换行（围栏长度自适应内容）。
 *  正文里的图片标记替换为 `[图片]` 占位（Markdown 无法携带像素，往返导入退化为文本）。 */
export function toMarkdown(memos: Memo[], groups: Group[]): string {
  const groupNameOf = (id: string | null) => groups.find((g) => g.id === id)?.name ?? '未分组'
  const byGroup = new Map<string, Memo[]>()
  for (const memo of memos) {
    const key = groupNameOf(memo.groupId)
    const list = byGroup.get(key) ?? []
    list.push(memo)
    byGroup.set(key, list)
  }
  const lines: string[] = ['# 速贴备忘导出', '']
  for (const [name, list] of byGroup) {
    lines.push(`## ${name}`, '')
    for (const memo of list) {
      const isImage = memo.kind === 'image'
      const firstLine = stripImageTokens(memo.content).split('\n')[0]
      lines.push(`### ${memo.title || (isImage ? '(图片)' : firstLine) || '(无标题)'}`, '')
      if (memo.tags.length) lines.push(`标签：${memo.tags.join('、')}`, '')
      if (isImage) {
        const note = stripImageTokens(memo.content).trim()
        if (note) lines.push(note, '')
        lines.push('[图片]', memo.ocrText ? `识别文字：${memo.ocrText}` : '', '')
      } else {
        const body = memo.content.replace(IMG_TOKEN_RE, '[图片]')
        const fence = '`'.repeat(Math.max(3, maxBacktickRun(body) + 1))
        lines.push(`${fence}text`, body, fence, '')
      }
    }
  }
  return lines.join('\n')
}

function csvEscape(value: string): string {
  const v = value.replace(/\r\n/g, '\n')
  return `"${v.replaceAll('"', '""')}"`
}

/** 导出为 CSV（UTF-8 with BOM 由调用方写入，Excel 才能正确识别中文）。列结构与 csvToEntries 对应，可往返导入。 */
export function toCsv(memos: Memo[], groups: Group[]): string {
  const groupNameOf = (id: string | null) => groups.find((g) => g.id === id)?.name ?? ''
  const head = ['标题', '内容', '分组', '标签', '置顶', '敏感', '创建时间', '更新时间', '触发词'].map(csvEscape).join(',')
  const rows = memos.map((m) =>
    [
      m.title,
      m.kind === 'image'
        ? stripImageTokens(m.content).trim() || m.ocrText || '[图片]'
        : stripImageTokens(m.content),
      groupNameOf(m.groupId),
      m.tags.join(' '),
      m.pinned ? '是' : '否',
      m.sensitive ? '是' : '否',
      new Date(m.createdAt).toISOString(),
      new Date(m.updatedAt).toISOString(),
      m.keyword ?? ''
    ]
      .map(csvEscape)
      .join(',')
  )
  return [head, ...rows].join('\n')
}
