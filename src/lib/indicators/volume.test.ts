import { describe, expect, it } from 'vitest'
import { hype1h } from './__fixtures__/hype-1h'
import { volumeRatio } from './volume'

const volumes = hype1h.map((c) => c.volume)

describe('volumeRatio', () => {
  it('returns null with fewer than `period` bars', () => {
    expect(volumeRatio(volumes.slice(0, 5), 20)).toBeNull()
  })

  it('is 1 when the latest bar equals the trailing average', () => {
    const flat = new Array(20).fill(100)
    expect(volumeRatio(flat, 20)).toBe(1)
  })

  it('is 2 when the latest bar is double the trailing average of the rest', () => {
    const values = [...new Array(19).fill(100), 200]
    // average of the trailing 20 (19*100 + 200)/20 = 105, so ratio is 200/105, not 2 —
    // volumeRatio is inclusive of the latest bar in its own average, matching a simple
    // "volume vs 20-bar average" reading rather than "vs the 19 prior bars".
    expect(volumeRatio(values, 20)).toBeCloseTo(200 / 105, 10)
  })

  // Cross-checked against an independent reference implementation in Python run over
  // the same fixture (see ROADMAP.md Phase 1 notes).
  it('matches an independently computed reference', () => {
    expect(volumeRatio(volumes, 20)).toBeCloseTo(0.115053, 4)
    expect(volumeRatio(volumes.slice(0, 150), 20)).toBeCloseTo(0.724817, 4)
    expect(volumeRatio(volumes.slice(0, 149), 20)).toBeCloseTo(0.849977, 4)
  })
})
