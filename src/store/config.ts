import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_CANDLE_LOOKBACK } from '../lib/hl/intervals'
import type { StrategyId } from '../lib/strategies/types'

const MAX_WATCHLIST_SIZE = 6

interface ConfigStore {
  watchlist: string[]
  defaultInterval: string
  lookback: number
  /** Trading bot (Jev-driven buy/sell/hold auto-trading on the active coin's paper position). Off by default. */
  botEnabled: boolean
  /** Which strategy `useTradingBot` pulls data for and sends to Jev. Switching while Auto Mode is on restarts the poll loop for the new strategy, same as switching coin. */
  activeStrategy: StrategyId

  toggleWatchlist: (coin: string) => void
  setDefaultInterval: (interval: string) => void
  setLookback: (lookback: number) => void
  toggleBot: () => void
  setActiveStrategy: (strategy: StrategyId) => void
}

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set) => ({
      watchlist: ['HYPE', 'BTC', 'ETH', 'SOL', 'XRP', 'DOGE'],
      defaultInterval: '1h',
      lookback: DEFAULT_CANDLE_LOOKBACK,
      botEnabled: false,
      activeStrategy: 'momentum',

      toggleWatchlist: (coin) =>
        set((s) => ({
          watchlist: s.watchlist.includes(coin)
            ? s.watchlist.filter((c) => c !== coin)
            : [...s.watchlist, coin].slice(0, MAX_WATCHLIST_SIZE),
        })),
      setDefaultInterval: (defaultInterval) => set({ defaultInterval }),
      setLookback: (lookback) => set({ lookback }),
      toggleBot: () => set((s) => ({ botEnabled: !s.botEnabled })),
      setActiveStrategy: (activeStrategy) => set({ activeStrategy }),
    }),
    { name: 'hl-term-config' },
  ),
)
