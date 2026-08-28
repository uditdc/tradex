export type Bias = 'long' | 'short' | 'neutral'
export type Regime = 'trending' | 'ranging' | 'compressing'

export interface SwingLevel {
  price: number
  distancePercent: number
}

export interface IndicatorDict {
  price: number
  ema9: number
  ema21: number
  ema55: number
  bias: Bias
  rsi14: number
  atrPercent: number
  volumeRatio: number
  swingSupport: SwingLevel | null
  swingResistance: SwingLevel | null
  regime: Regime
}
