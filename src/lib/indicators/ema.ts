/**
 * EMA seeded with the SMA of the first `period` values, matching TradingView's
 * default EMA (not a naive EMA seeded from the first sample).
 */
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (values.length < period) return out

  const k = 2 / (period + 1)
  let prev = values.slice(0, period).reduce((sum, v) => sum + v, 0) / period
  out[period - 1] = prev

  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k)
    out[i] = prev
  }

  return out
}
