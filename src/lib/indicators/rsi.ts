/** RSI with Wilder smoothing (RMA), matching TradingView's default RSI. */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (values.length <= period) return out

  const gains: number[] = []
  const losses: number[] = []
  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1]
    gains.push(Math.max(change, 0))
    losses.push(Math.max(-change, 0))
  }

  let avgGain = gains.slice(0, period).reduce((sum, v) => sum + v, 0) / period
  let avgLoss = losses.slice(0, period).reduce((sum, v) => sum + v, 0) / period
  out[period] = rsiFromAverages(avgGain, avgLoss)

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
    out[i + 1] = rsiFromAverages(avgGain, avgLoss)
  }

  return out
}

function rsiFromAverages(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}
