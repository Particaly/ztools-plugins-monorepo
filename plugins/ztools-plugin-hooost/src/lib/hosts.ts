import type { SourceLine, HostEntry, Environment, EnvironmentType, BuiltinEnvironmentType } from '../types/hosts'

const DEFAULT_PUBLIC_HEADER = '#-------- 公共配置 --------'
const GROUP_HEADER_PATTERN = /^#--------\s*(.*?)\s*--------$/

const BUILTIN_GROUPS: Array<{ type: BuiltinEnvironmentType; name: string; header: string; id: string }> = [
  { type: 'public', name: '公共环境', header: DEFAULT_PUBLIC_HEADER, id: 'env-public' },
  { type: 'dev', name: '开发环境', header: '#-------- 开发环境 --------', id: 'env-dev' },
  { type: 'test', name: '测试环境', header: '#-------- 测试环境 --------', id: 'env-test' },
  { type: 'prod', name: '生产环境', header: '#-------- 生产环境 --------', id: 'env-prod' },
]

const BUILTIN_BY_HEADER = new Map(BUILTIN_GROUPS.map(group => [group.header, group]))
const BUILTIN_BY_TYPE = new Map(BUILTIN_GROUPS.map(group => [group.type, group]))

function generateLineId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

function normalizeGroupId(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return normalized || 'group'
}

export function buildGroupHeader(name: string): string {
  return `#-------- ${name.trim()} --------`
}

export function normalizeHostsContent(content: string): string {
  const normalized = content.replace(/^\uFEFF/, '')
  const lines = normalized.split('\n')
  if (lines[0] === DEFAULT_PUBLIC_HEADER) return normalized
  return [DEFAULT_PUBLIC_HEADER, normalized].filter(Boolean).join('\n')
}

function getGroupMeta(header: string) {
  const builtin = BUILTIN_BY_HEADER.get(header)
  if (builtin) {
    return {
      id: builtin.id,
      name: builtin.name,
      type: builtin.type as EnvironmentType,
      header: builtin.header,
    }
  }

  const match = header.match(GROUP_HEADER_PATTERN)
  const name = match?.[1]?.trim() || '自定义分组'
  return {
    id: `env-${normalizeGroupId(name)}`,
    name,
    type: 'custom' as const,
    header,
  }
}

function isIpv4(value: string): boolean {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) return false
  const parts = value.split('.').map(Number)
  return parts.every(part => part >= 0 && part <= 255)
}

function isIpv6(value: string): boolean {
  return value.includes(':') && /^[0-9a-fA-F:.%]+$/.test(value)
}

function parseHostLine(line: string) {
  const commentIdx = line.indexOf('#')
  const mainPart = commentIdx !== -1 ? line.substring(0, commentIdx).trim() : line.trim()
  const inlineComment = commentIdx !== -1 ? line.substring(commentIdx + 1).trim() : undefined
  const parts = mainPart.split(/\s+/).filter(Boolean)

  if (parts.length < 2) return null

  const [ip, domain] = parts
  if (!isIpv4(ip) && !isIpv6(ip)) return null

  return { ip, domain, comment: inlineComment }
}

/** Parse every line of source content into SourceLine[], preserving comments and blank lines */
export function parseSourceToLines(content: string): SourceLine[] {
  const lines = content.split('\n')
  return lines.map(line => {
    const trimmed = line.trim()

    if (!trimmed) {
      return { id: generateLineId(), type: 'blank' as const, raw: line }
    }

    if (!trimmed.startsWith('#')) {
      const parsed = parseHostLine(trimmed)
      if (parsed) {
        return {
          id: generateLineId(),
          type: 'host' as const,
          raw: line,
          ip: parsed.ip,
          domain: parsed.domain,
          enabled: true,
          comment: parsed.comment,
        }
      }

      return { id: generateLineId(), type: 'comment' as const, raw: line }
    }

    const uncommented = trimmed.replace(/^#+\s*/, '')
    const parsed = parseHostLine(uncommented)
    if (parsed) {
      return {
        id: generateLineId(),
        type: 'host' as const,
        raw: line,
        ip: parsed.ip,
        domain: parsed.domain,
        enabled: false,
        comment: parsed.comment,
      }
    }

    return { id: generateLineId(), type: 'comment' as const, raw: line }
  })
}

/** Render SourceLine[] back to a string — faithful round-trip */
export function renderLinesToSource(lines: SourceLine[]): string {
  return lines.map(l => {
    if (l.type === 'host' && (l.ip !== undefined || l.domain !== undefined)) {
      const line = `${l.ip}\t${l.domain}`
      const base = l.enabled ? line : `# ${line}`
      return l.comment ? `${base} # ${l.comment}` : base
    }
    return l.raw
  }).join('\n')
}

/** Get only host-type lines as HostEntry[] (for merge / apply interop) */
export function linesToHostEntries(lines: SourceLine[]): HostEntry[] {
  return lines
    .filter(l => l.type === 'host')
    .map(l => ({
      id: l.id,
      ip: l.ip ?? '',
      domain: l.domain ?? '',
      comment: l.comment,
      enabled: l.enabled ?? true,
    }))
}

// --- Legacy helpers kept for backward compat & migration ---

/** @deprecated use parseSourceToLines instead */
export function parseSourceToEntries(content: string): HostEntry[] {
  return linesToHostEntries(parseSourceToLines(content))
}

/** @deprecated use renderLinesToSource instead */
export function renderEntriesToSource(entries: HostEntry[]): string {
  return entries
    .map(e => {
      const line = `${e.ip}\t${e.domain}`
      return e.enabled ? line : `# ${line}`
    })
    .join('\n')
}

export function parseEnvironmentBlocks(fullHosts: string): Environment[] {
  const normalized = normalizeHostsContent(fullHosts)
  const sections = new Map<string, { meta: ReturnType<typeof getGroupMeta>; lines: string[] }>()
  let currentHeader = DEFAULT_PUBLIC_HEADER

  sections.set(DEFAULT_PUBLIC_HEADER, {
    meta: getGroupMeta(DEFAULT_PUBLIC_HEADER),
    lines: [],
  })

  for (const line of normalized.split('\n')) {
    const trimmed = line.trim()
    const match = trimmed.match(GROUP_HEADER_PATTERN)
    if (match) {
      currentHeader = trimmed
      if (!sections.has(currentHeader)) {
        sections.set(currentHeader, {
          meta: getGroupMeta(currentHeader),
          lines: [],
        })
      }
      continue
    }

    const section = sections.get(currentHeader)
    if (section) section.lines.push(line)
  }

  return Array.from(sections.values()).map(({ meta, lines }) => ({
    id: meta.id,
    name: meta.name,
    type: meta.type,
    enabled: meta.type === 'public',
    editMode: 'source',
    header: meta.header,
    lines: parseSourceToLines(lines.join('\n').trim()),
    updatedAt: new Date().toISOString(),
  }))
}

export function getEnabledEnvironmentTypesFromHosts(fullHosts: string): EnvironmentType[] {
  return parseEnvironmentBlocks(fullHosts).map(env => env.type)
}

export function splitHostsByEnvironment(fullHosts: string): Record<string, string> {
  return Object.fromEntries(
    parseEnvironmentBlocks(fullHosts).map(env => [env.id, renderLinesToSource(env.lines)])
  )
}

// --- Public content extraction ---

export function extractPublicContent(fullHosts: string): string {
  return parseEnvironmentBlocks(fullHosts).find(env => env.type === 'public')
    ? renderLinesToSource(parseEnvironmentBlocks(fullHosts).find(env => env.type === 'public')!.lines)
    : ''
}

// --- Managed block rendering (for apply / merge) ---

export function renderEnvironmentBlock(environments: Environment[]): string {
  const blocks: string[] = []

  for (const env of environments) {
    const lines = env.lines
      .filter(l => l.type === 'host' && l.enabled && l.domain && l.ip)
      .map(l => (l.comment ? `${l.ip}\t${l.domain} # ${l.comment}` : `${l.ip}\t${l.domain}`))

    blocks.push(env.header || BUILTIN_BY_TYPE.get(env.type as BuiltinEnvironmentType)?.header || buildGroupHeader(env.name))
    if (lines.length > 0) {
      blocks.push(...lines)
    }
  }

  return blocks.join('\n')
}

export function mergeHostsContent(original: string, environments: Environment[]): string {
  const normalizedOriginal = normalizeHostsContent(original)
  const publicEnvironment = parseEnvironmentBlocks(normalizedOriginal).find(env => env.type === 'public')
  const blocks = [
    publicEnvironment?.header || DEFAULT_PUBLIC_HEADER,
    ...(publicEnvironment?.lines.length ? renderLinesToSource(publicEnvironment.lines).split('\n') : []),
  ]
  const rendered = renderEnvironmentBlock(environments)
  return rendered ? [...blocks, '', rendered].join('\n').trimEnd() + '\n' : blocks.join('\n').trimEnd() + '\n'
}

export function validateEntry(entry: { ip: string; domain: string }): string | null {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipRegex.test(entry.ip)) return 'IP 格式不正确'
  const parts = entry.ip.split('.').map(Number)
  if (parts.some(p => p < 0 || p > 255)) return 'IP 格式不正确'
  if (!entry.domain || /\s/.test(entry.domain)) return '域名格式不正确'
  return null
}
