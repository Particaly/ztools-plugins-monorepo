import type { HostEntry, Environment } from '../types/hosts'

const BEGIN_MARKER = '# >>> hooost managed start'
const END_MARKER = '# <<< hooost managed end'

export function parseManagedBlock(content: string): { envName: string | null; entries: HostEntry[] } | null {
  const startIdx = content.indexOf(BEGIN_MARKER)
  const endIdx = content.indexOf(END_MARKER)
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null

  const block = content.substring(startIdx + BEGIN_MARKER.length, endIdx).trim()
  const lines = block.split('\n')
  let envName: string | null = null
  const entries: HostEntry[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('# env:')) {
      envName = trimmed.replace('# env:', '').trim()
      continue
    }
    if (trimmed.startsWith('# name:')) continue
    if (trimmed.startsWith('#')) continue

    const enabled = !trimmed.startsWith('#')
    const activeLine = enabled ? trimmed : trimmed.replace(/^#+\s*/, '')
    const match = activeLine.match(/^(\S+)\s+(\S+)/)
    if (match) {
      entries.push({
        id: `${match[1]}-${match[2]}-${entries.length}`,
        ip: match[1],
        domain: match[2],
        enabled,
      })
    }
  }

  return { envName, entries }
}

// Parse source content (raw hosts format) into entries
export function parseSourceToEntries(content: string): HostEntry[] {
  const entries: HostEntry[] = []
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const enabled = !trimmed.startsWith('#')
    const activeLine = enabled ? trimmed : trimmed.replace(/^#+\s*/, '')
    const match = activeLine.match(/^(\S+)\s+(\S+)/)

    if (match) {
      entries.push({
        id: `${match[1]}-${match[2]}-${entries.length}`,
        ip: match[1],
        domain: match[2],
        enabled,
      })
    }
  }
  return entries
}

// Render entries to source content (raw hosts format)
export function renderEntriesToSource(entries: HostEntry[]): string {
  return entries
    .map(e => {
      const line = `${e.ip}\t${e.domain}`
      return e.enabled ? line : `# ${line}`
    })
    .join('\n')
}

// Extract public content (everything outside managed block)
export function extractPublicContent(fullHosts: string): string {
  const startIdx = fullHosts.indexOf(BEGIN_MARKER)
  const endIdx = fullHosts.indexOf(END_MARKER)

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return (fullHosts.substring(0, startIdx) + fullHosts.substring(endIdx + END_MARKER.length)).trim()
  }
  return fullHosts.trim()
}

// Render environment block (replaces renderPresetBlock)
export function renderEnvironmentBlock(env: Environment): string {
  const lines = [BEGIN_MARKER, `# env: ${env.type}`, `# name: ${env.name}`]
  for (const entry of env.entries) {
    const line = entry.enabled
      ? `${entry.ip}\t${entry.domain}`
      : `# ${entry.ip}\t${entry.domain}`
    lines.push(entry.comment ? `${line} # ${entry.comment}` : line)
  }
  lines.push(END_MARKER)
  return lines.join('\n')
}

// Merge environment block into hosts content
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
