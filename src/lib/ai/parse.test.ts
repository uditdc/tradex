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

  it('parses valid zones', () => {
    const withZones = { ...validRead, zones: [{ from: 80, to: 82, label: 'AI Demand Zone' }] }
    expect(parseAiRead(JSON.stringify(withZones))).toEqual(withZones)
  })

  it('returns null when a zone is malformed', () => {
    const bad = { ...validRead, zones: [{ from: 80, to: 'not-a-number', label: 'AI Demand Zone' }] }
    expect(parseAiRead(JSON.stringify(bad))).toBeNull()
  })

  it('parses a valid position_guidance', () => {
    const withGuidance = { ...validRead, position_guidance: { action: 'close', note: 'Support broken, cut the long.' } }
    expect(parseAiRead(JSON.stringify(withGuidance))).toEqual(withGuidance)
  })

  it('omitting position_guidance is valid (undefined, not required)', () => {
    expect(parseAiRead(JSON.stringify(validRead))?.position_guidance).toBeUndefined()
  })

  it('returns null when position_guidance has an invalid action', () => {
    const bad = { ...validRead, position_guidance: { action: 'sell', note: 'x' } }
    expect(parseAiRead(JSON.stringify(bad))).toBeNull()
  })

  it('returns null when position_guidance is missing its note', () => {
    const bad = { ...validRead, position_guidance: { action: 'keep' } }
    expect(parseAiRead(JSON.stringify(bad))).toBeNull()
  })
})
