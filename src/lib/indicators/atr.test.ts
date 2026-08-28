import { describe, expect, it } from 'vitest'
import { hype1h } from './__fixtures__/hype-1h'
import { atr, atrPercent } from './atr'

describe('atr', () => {
  it('is null before the seed bar', () => {
    const series = atr(hype1h, 14)
    expect(series[12]).toBeNull()
    expect(series[13]).not.toBeNull()
  })

  it('the first bar has no prior close, so TR is just high - low', () => {
    const oneCandle = [hype1h[0]]
    const series = atr(oneCandle, 1)
    expect(series[0]).toBeCloseTo(hype1h[0].high - hype1h[0].low, 10)
  })

  // Expected values cross-checked against an independent Wilder-smoothing reference
  // implementation in Python run over the same fixture (see ROADMAP.md Phase 1 notes).
  it('matches an independently computed reference for ATR 14', () => {
    const series = atr(hype1h, 14)
    expect(series[150]).toBeCloseTo(1.086193, 3)
    expect(series[149]).toBeCloseTo(1.142131, 3)
    expect(series[148]).toBeCloseTo(1.128526, 3)
  })

  it('atrPercent is atr / close * 100', () => {
    const atrSeries = atr(hype1h, 14)
    const pctSeries = atrPercent(hype1h, 14)
    expect(pctSeries[150]).toBeCloseTo(((atrSeries[150] as number) / hype1h[150].close) * 100, 10)
  })
})
