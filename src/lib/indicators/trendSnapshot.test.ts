import { describe, expect, it } from 'vitest'
import { hype1h } from './__fixtures__/hype-1h'
import { macd } from './macd'
import { rsi } from './rsi'
import { computeTrendSnapshot, MIN_TREND_CANDLES } from './trendSnapshot'

describe('computeTrendSnapshot', () => {
  it('throws below the minimum candle count', () => {
    expect(() => computeTrendSnapshot(hype1h.slice(0, MIN_TREND_CANDLES - 1))).toThrow()
  })

  it('does not throw at exactly the minimum candle count', () => {
    expect(() => computeTrendSnapshot(hype1h.slice(0, MIN_TREND_CANDLES))).not.toThrow()
  })

  it('reads the latest bar of each underlying series', () => {
    const candles = hype1h.slice(0, 80)
    const closes = candles.map((c) => c.close)
    const expectedRsi = rsi(closes, 14)
    const { macdLine, signalLine, histogram } = macd(closes, 12, 26, 9)

    const snapshot = computeTrendSnapshot(candles)
    expect(snapshot.rsi14).toBeCloseTo(expectedRsi[expectedRsi.length - 1] as number, 10)
    expect(snapshot.macdLine).toBeCloseTo(macdLine[macdLine.length - 1] as number, 10)
    expect(snapshot.macdSignal).toBeCloseTo(signalLine[signalLine.length - 1] as number, 10)
    expect(snapshot.macdHistogram).toBeCloseTo(histogram[histogram.length - 1] as number, 10)
    expect(snapshot.macdHistogram).toBeCloseTo(snapshot.macdLine - snapshot.macdSignal, 10)
  })
})
