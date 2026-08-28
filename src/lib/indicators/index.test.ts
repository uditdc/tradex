import { describe, expect, it } from 'vitest'
import { hype1h } from './__fixtures__/hype-1h'
import { computeAll } from './index'

describe('computeAll', () => {
  it('throws when there are not enough candles for a full EMA55', () => {
    expect(() => computeAll(hype1h.slice(0, 30))).toThrow(/at least/)
  })

  it('computes the full indicator dict for the latest bar', () => {
    const dict = computeAll(hype1h)

    expect(dict.price).toBe(hype1h[hype1h.length - 1].close)
    // Cross-checked against an independent reference implementation (see ema/rsi/atr
    // tests and ROADMAP.md Phase 1 notes).
    expect(dict.ema9).toBeCloseTo(83.485058, 4)
    expect(dict.ema21).toBeCloseTo(83.549739, 4)
    expect(dict.ema55).toBeCloseTo(82.780199, 4)
    expect(dict.rsi14).toBeCloseTo(50.228257, 4)
    expect(dict.atrPercent).toBeCloseTo(1.301204, 3)
    expect(dict.volumeRatio).toBeCloseTo(0.115053, 4)

    // ema9 < ema21 but ema21 > ema55 here (not monotonically stacked), so bias is neutral.
    expect(dict.bias).toBe('neutral')
    expect(['trending', 'ranging', 'compressing']).toContain(dict.regime)
  })

  it('bias is neutral when the EMA stack is not monotonically ordered', () => {
    // Truncate mid-series so the latest bar doesn't have a clean trending stack.
    const dict = computeAll(hype1h.slice(0, 100))
    const stackedUp = dict.ema9 > dict.ema21 && dict.ema21 > dict.ema55
    const stackedDown = dict.ema9 < dict.ema21 && dict.ema21 < dict.ema55
    expect(dict.bias).toBe(stackedUp ? 'long' : stackedDown ? 'short' : 'neutral')
  })
})
