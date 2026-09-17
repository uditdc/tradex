export type StrategyId = 'momentum' | 'orderbook'

export interface StrategyMeta {
  id: StrategyId
  label: string
  description: string
}

/**
 * Metadata for the strategy picker only. The actual per-strategy data-fetch branch
 * lives in `useTradingBot.ts` — with just two strategies, a separate "gatherer"
 * abstraction layer isn't earning its keep yet.
 */
export const STRATEGIES: StrategyMeta[] = [
  {
    id: 'momentum',
    label: 'Momentum',
    description: 'EMA stack, RSI, ATR%, volume, and swing support/resistance from candles.',
  },
  {
    id: 'orderbook',
    label: 'Order Book',
    description: 'Live bid/ask depth imbalance, spread, and book depth from l2Book.',
  },
]
