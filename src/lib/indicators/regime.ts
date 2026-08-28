import type { Regime } from './types'

export interface RegimeInput {
  price: number
  ema9: number
  ema21: number
  ema55: number
  atrPercent: number
  /** Trailing average of atrPercent, used to detect volatility contraction. */
  atrPercentAvg: number
}

const COMPRESSION_RATIO = 0.7
const TREND_SPREAD_PERCENT = 0.5

/**
 * Deterministic, heuristic regime tag (not a documented Hyperliquid/TradingView value):
 * compressing when volatility has contracted well below its trailing average,
 * trending when the EMA stack is monotonically ordered with real separation,
 * ranging otherwise.
 */
export function classifyRegime(input: RegimeInput): Regime {
  const { price, ema9, ema21, ema55, atrPercent, atrPercentAvg } = input

  if (atrPercentAvg > 0 && atrPercent / atrPercentAvg < COMPRESSION_RATIO) {
    return 'compressing'
  }

  const stackedUp = ema9 > ema21 && ema21 > ema55
  const stackedDown = ema9 < ema21 && ema21 < ema55
  const spreadPercent = (Math.abs(ema9 - ema55) / price) * 100

  if ((stackedUp || stackedDown) && spreadPercent > TREND_SPREAD_PERCENT) {
    return 'trending'
  }

  return 'ranging'
}
