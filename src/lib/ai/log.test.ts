import { describe, expect, it } from 'vitest'
import { formatReadLog } from './log'
import type { LogEntry } from './types'

describe('formatReadLog', () => {
  it('formats an ask entry with its question and answer', () => {
    const entries: LogEntry[] = [
      { timestamp: 0, coin: 'HYPE', interval: '1h', question: 'is funding high?', text: 'No, funding is low.' },
    ]
    const out = formatReadLog(entries)
    expect(out).toContain('HYPE:1h')
    expect(out).toContain('Q: is funding high?')
    expect(out).toContain('A: No, funding is low.')
  })

  it('separates multiple entries with a divider', () => {
    const entries: LogEntry[] = [
      { timestamp: 0, coin: 'HYPE', interval: '1h', question: 'a?', text: 'a' },
      { timestamp: 1, coin: 'BTC', interval: '1h', question: 'b?', text: 'b' },
    ]
    expect(formatReadLog(entries).split('---')).toHaveLength(2)
  })
})
