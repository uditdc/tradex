import { describe, expect, it } from 'vitest'
import { formatReadLog } from './log'
import type { LogEntry } from './types'

describe('formatReadLog', () => {
  it('formats a parsed read entry with its structured fields', () => {
    const entries: LogEntry[] = [
      {
        timestamp: 0,
        coin: 'HYPE',
        interval: '1h',
        kind: 'read',
        text: '{"bias":"long"}',
        parsed: {
          bias: 'long',
          key_levels: [],
          invalidation: 'close below 80',
          confidence: 0.7,
          rationale: 'Trending up.',
        },
      },
    ]
    const out = formatReadLog(entries)
    expect(out).toContain('HYPE:1h (read)')
    expect(out).toContain('bias: long  confidence: 0.7')
    expect(out).toContain('Trending up.')
    expect(out).toContain('close below 80')
  })

  it('formats an unparsed read entry with the raw text', () => {
    const entries: LogEntry[] = [
      { timestamp: 0, coin: 'HYPE', interval: '1h', kind: 'read', text: 'not json', parsed: null },
    ]
    expect(formatReadLog(entries)).toContain('(unparsed) not json')
  })

  it('formats an ask entry with its question', () => {
    const entries: LogEntry[] = [
      {
        timestamp: 0,
        coin: 'HYPE',
        interval: '1h',
        kind: 'ask',
        question: 'is funding high?',
        text: 'No, funding is low.',
        parsed: null,
      },
    ]
    const out = formatReadLog(entries)
    expect(out).toContain('Q: is funding high?')
    expect(out).toContain('A: No, funding is low.')
  })

  it('separates multiple entries with a divider', () => {
    const entries: LogEntry[] = [
      { timestamp: 0, coin: 'HYPE', interval: '1h', kind: 'read', text: 'a', parsed: null },
      { timestamp: 1, coin: 'BTC', interval: '1h', kind: 'read', text: 'b', parsed: null },
    ]
    expect(formatReadLog(entries).split('---')).toHaveLength(2)
  })
})
