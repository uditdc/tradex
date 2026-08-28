import type { Candle } from '../hl/types'

/** True range per bar; the first bar has no prior close, so it's just high - low. */
function trueRanges(candles: Candle[]): number[] {
  return candles.map((c, i) => {
    if (i === 0) return c.high - c.low
    const prevClose = candles[i - 1].close
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose))
  })
}

/** ATR with Wilder smoothing (RMA), matching TradingView's default ATR. */
export function atr(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null)
  const trs = trueRanges(candles)
  if (trs.length < period) return out

  let avg = trs.slice(0, period).reduce((sum, v) => sum + v, 0) / period
  out[period - 1] = avg

  for (let i = period; i < trs.length; i++) {
    avg = (avg * (period - 1) + trs[i]) / period
    out[i] = avg
  }

  return out
}

/** ATR expressed as a percentage of each bar's close. */
export function atrPercent(candles: Candle[], period = 14): (number | null)[] {
  const atrValues = atr(candles, period)
  return atrValues.map((value, i) => (value === null ? null : (value / candles[i].close) * 100))
}
