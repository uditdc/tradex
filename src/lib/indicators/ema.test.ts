import { describe, expect, it } from 'vitest'
import { hype1h } from './__fixtures__/hype-1h'
import { ema } from './ema'

const closes = hype1h.map((c) => c.close)

describe('ema', () => {
  it('is null before the seed bar', () => {
    const series = ema(closes, 9)
    expect(series[7]).toBeNull()
    expect(series[8]).not.toBeNull()
  })

  it('seeds with the SMA of the first `period` values', () => {
    const series = ema([1, 2, 3, 4, 5], 3)
    expect(series[1]).toBeNull()
    expect(series[2]).toBeCloseTo((1 + 2 + 3) / 3, 10)
  })

  // Expected values cross-checked against an independent Wilder/EMA reference
  // implementation in Python run over the same fixture (see ROADMAP.md Phase 1 notes).
  it('matches an independently computed reference for EMA 9/21/55', () => {
    const e9 = ema(closes, 9)
    const e21 = ema(closes, 21)
    const e55 = ema(closes, 55)

    expect(e9[150]).toBeCloseTo(83.485058, 4)
    expect(e21[150]).toBeCloseTo(83.549739, 4)
    expect(e55[150]).toBeCloseTo(82.780199, 4)

    expect(e9[149]).toBeCloseTo(83.487323, 4)
    expect(e21[149]).toBeCloseTo(83.557113, 4)
    expect(e55[149]).toBeCloseTo(82.754428, 4)
  })
})
