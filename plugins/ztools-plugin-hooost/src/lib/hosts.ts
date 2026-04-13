import type { HostEntry, HostPreset } from '../types/hosts'

const BEGIN_MARKER = '# >>> hooost managed start'
const END_MARKER = '# <<< hooost managed end'

export function parseManagedBlock(content: string): { presetName: string | null; entries: HostEntry[] } | null {
  const startIdx = content.indexOf(BEGIN_MARKER)
  const endIdx = content.indexOf(END_MARKER)
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null

  const block = content.substring(startIdx + BEGIN_MARKER.length, endIdx).trim()
  const lines = block.split('\n')
  let presetName: string | null = null
  const entries: HostEntry[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('# preset:')) {
      presetName = trimmed.replace('# preset:', '').trim()
      continue
    }
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

  return { presetName, entries }
}

export function renderPresetBlock(preset: HostPreset): string {
  const lines = [BEGIN_MARKER, `# preset: ${preset.name}`]
  for (const entry of preset.entries) {
    const line = entry.enabled
      ? `${entry.ip}\t${entry.domain}`
      : `# ${entry.ip}\t${entry.domain}`
    lines.push(entry.comment ? `${line} # ${entry.comment}` : line)
  }
  lines.push(END_MARKER)
  return lines.join('\n')
}

export function mergeHostsContent(original: string, preset: HostPreset): string {
  const newBlock = renderPresetBlock(preset)
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
