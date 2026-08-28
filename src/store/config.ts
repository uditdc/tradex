import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_CANDLE_LOOKBACK } from '../lib/hl/intervals'

const MAX_WATCHLIST_SIZE = 6

interface ConfigStore {
  watchlist: string[]
  defaultInterval: string
  lookback: number

  toggleWatchlist: (coin: string) => void
  setDefaultInterval: (interval: string) => void
  setLookback: (lookback: number) => void
}

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set) => ({
      watchlist: ['HYPE', 'BTC', 'ETH', 'SOL', 'XRP', 'DOGE'],
      defaultInterval: '1h',
      lookback: DEFAULT_CANDLE_LOOKBACK,

      toggleWatchlist: (coin) =>
        set((s) => ({
          watchlist: s.watchlist.includes(coin)
            ? s.watchlist.filter((c) => c !== coin)
            : [...s.watchlist, coin].slice(0, MAX_WATCHLIST_SIZE),
        })),
      setDefaultInterval: (defaultInterval) => set({ defaultInterval }),
      setLookback: (lookback) => set({ lookback }),
    }),
    { name: 'hl-term-config' },
  ),
)
