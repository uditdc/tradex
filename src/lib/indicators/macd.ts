import { ema } from './ema'

export interface MacdResult {
  macdLine: (number | null)[]
  signalLine: (number | null)[]
  histogram: (number | null)[]
}

/**
 * MACD (12/26/9 by default): fast EMA minus slow EMA, with a signal EMA of that
 * line and the line-minus-signal histogram. Built on `ema`, matching TradingView's
 * default MACD (EMA-based, not SMA-seeded differently for the signal line).
 */
export function macd(values: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): MacdResult {
  const fast = ema(values, fastPeriod)
  const slow = ema(values, slowPeriod)
  const macdLine: (number | null)[] = values.map((_, i) => {
    const f = fast[i]
    const s = slow[i]
    return f !== null && s !== null ? f - s : null
  })

  const macdValues = macdLine.filter((v): v is number => v !== null)
  const signalSeries = ema(macdValues, signalPeriod)
  const signalLine: (number | null)[] = new Array(values.length).fill(null)
  let cursor = 0
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) continue
    signalLine[i] = signalSeries[cursor]
    cursor++
  }

  const histogram: (number | null)[] = macdLine.map((m, i) => {
    const s = signalLine[i]
    return m !== null && s !== null ? m - s : null
  })

  return { macdLine, signalLine, histogram }
}
