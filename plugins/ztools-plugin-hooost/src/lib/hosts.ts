import type { SourceLine, HostEntry, Environment } from '../types/hosts'

const BEGIN_MARKER = '# >>> hooost managed start'
const END_MARKER = '# <<< hooost managed end'

function generateLineId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
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

// --- Public content extraction ---

export function extractPublicContent(fullHosts: string): string {
  const startIdx = fullHosts.indexOf(BEGIN_MARKER)
  const endIdx = fullHosts.indexOf(END_MARKER)

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return (fullHosts.substring(0, startIdx) + fullHosts.substring(endIdx + END_MARKER.length)).trim()
  }
  return fullHosts.trim()
}

// --- Managed block rendering (for apply / merge) ---

export function renderEnvironmentBlock(env: Environment): string {
  const lines = [BEGIN_MARKER, `# env: ${env.type}`, `# name: ${env.name}`]
  for (const l of env.lines) {
    if (l.type !== 'host') continue
    const line = l.enabled ? `${l.ip}\t${l.domain}` : `# ${l.ip}\t${l.domain}`
    lines.push(l.comment ? `${line} # ${l.comment}` : line)
  }
  lines.push(END_MARKER)
  return lines.join('\n')
}

export function mergeHostsContent(original: string, env: Environment): string {
  const newBlock = renderEnvironmentBlock(env)
  const startIdx = original.indexOf(BEGIN_MARKER)
  const endIdx = original.indexOf(END_MARKER)

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return original.substring(0, startIdx) + newBlock + original.substring(endIdx + END_MARKER.length)
  }

  const trimmed = original.trimEnd()
  return trimmed + '\n\n' + newBlock + '\n'
}

export function validateEntry(entry: { ip: string; domain: string }): string | null {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipRegex.test(entry.ip)) return 'IP 格式不正确'
  const parts = entry.ip.split('.').map(Number)
  if (parts.some(p => p < 0 || p > 255)) return 'IP 格式不正确'
  if (!entry.domain || /\s/.test(entry.domain)) return '域名格式不正确'
  return null
}