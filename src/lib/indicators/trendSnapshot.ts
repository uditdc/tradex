import type { Candle } from '../hl/types'
import { macd } from './macd'
import { rsi } from './rsi'

/** Slow EMA(26) + signal EMA(9) - 1: the exact bar count needed for the histogram to have a value at the latest bar. */
export const MIN_TREND_CANDLES = 34

export interface TrendSnapshot {
  rsi14: number
  macdLine: number
  macdSignal: number
  macdHistogram: number
}

/**
 * RSI 14 + MACD(12,26,9) read off one candle series — the building block for the
 * `mtf-trend` strategy, called once per timeframe it looks at (4h for the major
 * trend, 15m for the intermediate trend). Pure, no I/O; kept out of `computeAll`
 * the same way `computeOrderBookMetrics` is — it's strategy-specific, not part of
 * the always-fetched base 1m indicator dict.
 */
export function computeTrendSnapshot(candles: Candle[]): TrendSnapshot {
  if (candles.length < MIN_TREND_CANDLES) {
    throw new Error(`computeTrendSnapshot needs at least ${MIN_TREND_CANDLES} candles, got ${candles.length}`)
  }

  const closes = candles.map((c) => c.close)
  const rsiSeries = rsi(closes, 14)
  const { macdLine, signalLine, histogram } = macd(closes, 12, 26, 9)

  return {
    rsi14: last(rsiSeries),
    macdLine: last(macdLine),
    macdSignal: last(signalLine),
    macdHistogram: last(histogram),
  }
}

function last(series: (number | null)[]): number {
  const value = series[series.length - 1]
  if (value === null) {
    throw new Error('trend snapshot series has no value at the latest bar')
  }
  return value
}
