import type { LogEntry } from './types'

function formatEntry(entry: LogEntry): string {
  const time = new Date(entry.timestamp).toISOString()
  const header = `[${time}] ${entry.coin}:${entry.interval} (${entry.kind})`

  if (entry.kind === 'ask') {
    return `${header}\nQ: ${entry.question}\nA: ${entry.text}`
  }
  if (entry.parsed) {
    return `${header}\nbias: ${entry.parsed.bias}  confidence: ${entry.parsed.confidence}\n${entry.parsed.rationale}\ninvalidation: ${entry.parsed.invalidation}`
  }
  return `${header}\n(unparsed) ${entry.text}`
}

export function formatReadLog(entries: LogEntry[]): string {
  return entries.map(formatEntry).join('\n\n---\n\n')
}

export function downloadReadLog(entries: LogEntry[]): void {
  const text = formatReadLog(entries)
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hl-term-read-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
