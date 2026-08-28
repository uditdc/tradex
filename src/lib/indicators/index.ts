import type { Candle } from '../hl/types'
import { atrPercent as computeAtrPercent } from './atr'
import { ema } from './ema'
import { classifyRegime } from './regime'
import { rsi } from './rsi'
import { nearestSwingLevels } from './swing'
import type { Bias, IndicatorDict } from './types'
import { volumeRatio as computeVolumeRatio } from './volume'

const MIN_CANDLES = 55
const ATR_TREND_LOOKBACK = 50
const SWING_LOOKBACK = 5

function biasFromStack(ema9: number, ema21: number, ema55: number): Bias {
  if (ema9 > ema21 && ema21 > ema55) return 'long'
  if (ema9 < ema21 && ema21 < ema55) return 'short'
  return 'neutral'
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export function computeAll(candles: Candle[]): IndicatorDict {
  if (candles.length < MIN_CANDLES) {
    throw new Error(`computeAll needs at least ${MIN_CANDLES} candles, got ${candles.length}`)
  }

  const closes = candles.map((c) => c.close)
  const price = closes[closes.length - 1]

  const ema9 = last(ema(closes, 9))
  const ema21 = last(ema(closes, 21))
  const ema55 = last(ema(closes, 55))
  const rsi14 = last(rsi(closes, 14))

  const atrPercentSeries = computeAtrPercent(candles, 14)
  const atrPercentValue = last(atrPercentSeries)
  const atrPercentAvg = average(
    atrPercentSeries.slice(-ATR_TREND_LOOKBACK).filter((v): v is number => v !== null),
  )

  const volumeRatioValue = computeVolumeRatio(
    candles.map((c) => c.volume),
    20,
  )

  const { support, resistance } = nearestSwingLevels(candles, SWING_LOOKBACK)

  return {
    price,
    ema9,
    ema21,
    ema55,
    bias: biasFromStack(ema9, ema21, ema55),
    rsi14,
    atrPercent: atrPercentValue,
    volumeRatio: volumeRatioValue ?? 0,
    swingSupport: support,
    swingResistance: resistance,
    regime: classifyRegime({ price, ema9, ema21, ema55, atrPercent: atrPercentValue, atrPercentAvg }),
  }
}

function last(series: (number | null)[]): number {
  const value = series[series.length - 1]
  if (value === null) {
    throw new Error('indicator series has no value at the latest bar')
  }
  return value
}

export { atr, atrPercent } from './atr'
export { ema } from './ema'
export { classifyRegime } from './regime'
export { rsi } from './rsi'
export { nearestSwingLevels } from './swing'
export type { Bias, IndicatorDict, Regime, SwingLevel } from './types'
export { volumeRatio } from './volume'
