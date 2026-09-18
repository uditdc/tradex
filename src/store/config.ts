import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_CANDLE_LOOKBACK } from '../lib/hl/intervals'
import type { StrategyId } from '../lib/strategies/types'

const MAX_WATCHLIST_SIZE = 6

/**
 * A single trading session: Auto Mode being on, under a user-chosen name. Positions
 * opened and trades closed while this session is active are tagged with `id`/`name`
 * (see `SimPosition`/`LedgerEntry`'s `sessionId`/`sessionName`) so activity can be
 * traced back to the session that produced it. `name` defaults to the active
 * strategy's label at start time (`AiPanel`) but doesn't track later strategy
 * switches — it's a label chosen once, not a live strategy indicator.
 */
export interface TradingSession {
  id: number
  name: string
  startedAt: number
}

interface ConfigStore {
  watchlist: string[]
  defaultInterval: string
  lookback: number
  /** Trading bot (Jev-driven buy/sell/hold auto-trading on the active coin's paper position). Off by default. */
  botEnabled: boolean
  /** The running session, or null when no session is active. Persisted alongside `botEnabled` so a reloaded tab resumes the same named session rather than losing its identity. */
  activeSession: TradingSession | null
  /** Which strategy `useTradingBot` pulls data for and sends to Jev. Switching while Auto Mode is on restarts the poll loop for the new strategy, same as switching coin. */
  activeStrategy: StrategyId

  toggleWatchlist: (coin: string) => void
  setDefaultInterval: (interval: string) => void
  setLookback: (lookback: number) => void
  /** Starts a trading session under `name`: Jev is only ever called (`useTradingBot`'s poll loop) while a session is active. */
  startSession: (name: string) => void
  /** Ends the current session. Callers are responsible for closing open positions first (see `AiPanel`'s end-session dialog) — this only flips the flag that stops the poll loop. */
  endSession: () => void
  setActiveStrategy: (strategy: StrategyId) => void
}

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set) => ({
      watchlist: ['HYPE', 'BTC', 'ETH', 'SOL', 'XRP', 'DOGE'],
      defaultInterval: '1h',
      lookback: DEFAULT_CANDLE_LOOKBACK,
      botEnabled: false,
      activeSession: null,
      activeStrategy: 'momentum',

      toggleWatchlist: (coin) =>
        set((s) => ({
          watchlist: s.watchlist.includes(coin)
            ? s.watchlist.filter((c) => c !== coin)
            : [...s.watchlist, coin].slice(0, MAX_WATCHLIST_SIZE),
        })),
      setDefaultInterval: (defaultInterval) => set({ defaultInterval }),
      setLookback: (lookback) => set({ lookback }),
      startSession: (name) => {
        const startedAt = Date.now()
        set({ botEnabled: true, activeSession: { id: startedAt, name, startedAt } })
      },
      endSession: () => set({ botEnabled: false, activeSession: null }),
      setActiveStrategy: (activeStrategy) => set({ activeStrategy }),
    }),
    { name: 'hl-term-config' },
  ),
)
