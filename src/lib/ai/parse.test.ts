import { describe, expect, it } from 'vitest'
import { parseAiRead } from './parse'

const validRead = {
  bias: 'long',
  key_levels: [{ price: 83.5, kind: 'resistance', note: 'prior swing high' }],
  invalidation: 'close below 82',
  confidence: 0.6,
  rationale: 'Trending up on rising volume with RSI holding above 50.',
}

describe('parseAiRead', () => {
  it('parses clean JSON', () => {
    expect(parseAiRead(JSON.stringify(validRead))).toEqual(validRead)
  })

  it('strips a ```json fence some models add despite instructions', () => {
    expect(parseAiRead('```json\n' + JSON.stringify(validRead) + '\n```')).toEqual(validRead)
  })

  it('returns null for non-JSON text instead of guessing', () => {
    expect(parseAiRead('I think HYPE looks bullish here.')).toBeNull()
  })

  it('returns null when a required field is missing', () => {
    const { rationale: _rationale, ...missingRationale } = validRead
    expect(parseAiRead(JSON.stringify(missingRationale))).toBeNull()
  })

  it('returns null when a key_level is malformed', () => {
    const bad = { ...validRead, key_levels: [{ price: 'not-a-number', kind: 'support', note: 'x' }] }
    expect(parseAiRead(JSON.stringify(bad))).toBeNull()
  })
})
