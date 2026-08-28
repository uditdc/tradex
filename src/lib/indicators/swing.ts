import type { Candle } from '../hl/types'
import type { SwingLevel } from './types'

/**
 * Indices of confirmed swing highs/lows: a bar whose high (low) is the strict max
 * (min) within `lookback` bars on both sides. The trailing `lookback` bars are never
 * confirmed swings since they have no future bars to confirm against yet.
 */
function swingIndices(candles: Candle[], lookback: number, key: 'high' | 'low'): number[] {
  const indices: number[] = []
  const isHigh = key === 'high'

  for (let i = lookback; i < candles.length - lookback; i++) {
    const window = candles.slice(i - lookback, i + lookback + 1)
    const value = candles[i][key]
    const isExtreme = isHigh
      ? window.every((c) => c.high <= value)
      : window.every((c) => c.low >= value)
    if (isExtreme) indices.push(i)
  }

  return indices
}

export function nearestSwingLevels(
  candles: Candle[],
  lookback = 5,
): { support: SwingLevel | null; resistance: SwingLevel | null } {
  if (candles.length === 0) return { support: null, resistance: null }

  const currentPrice = candles[candles.length - 1].close
  const swingHighs = swingIndices(candles, lookback, 'high').map((i) => candles[i].high)
  const swingLows = swingIndices(candles, lookback, 'low').map((i) => candles[i].low)

  const resistancePrice = swingHighs
    .filter((price) => price > currentPrice)
    .reduce<number | null>((closest, price) => (closest === null || price < closest ? price : closest), null)

  const supportPrice = swingLows
    .filter((price) => price < currentPrice)
    .reduce<number | null>((closest, price) => (closest === null || price > closest ? price : closest), null)

  return {
    support:
      supportPrice === null
        ? null
        : { price: supportPrice, distancePercent: ((currentPrice - supportPrice) / currentPrice) * 100 },
    resistance:
      resistancePrice === null
        ? null
        : { price: resistancePrice, distancePercent: ((resistancePrice - currentPrice) / currentPrice) * 100 },
  }
}
