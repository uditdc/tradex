import { create } from 'zustand'
import type { AskState, LogEntry, ReadState } from '../lib/ai/types'
import type { Candle, MarketCtx } from '../lib/hl/types'
import type { ConnectionStatus } from '../lib/hl/ws'
import type { Bias, Regime } from '../lib/indicators/types'

export type WsState = ConnectionStatus | 'idle'

const MAX_LOG_ENTRIES = 200

export interface WatchlistEntry {
  price: number
  bias: Bias
  regime: Regime
  /** openTime of the latest candle seen for this coin; used to detect a new bar close. */
  lastOpenTime: number
}

/**
 * A hypothetical, local-only position opened from the AI trade suggestion panel.
 * Purely a paper-trading tracker against live prices — no order is ever placed
 * (see CLAUDE.md non-goals: no execution, no wallet, no keys).
 */
export interface SimPosition {
  id: number
  coin: string
  interval: string
  side: 'long' | 'short'
  sizeUsd: number
  leverage: number
  entryPrice: number
  openedAt: number
}

let nextPositionId = 1

interface AppStore {
  coin: string
  interval: string
  candles: Candle[]
  marketCtx: MarketCtx | null
  wsStatus: WsState
  lastUpdate: number | null
  latencyMs: number | null
  /** Bumped whenever a candle buffer closes a bar; drives the "read on bar close" trigger. */
  lastBarCloseAt: number | null

  /** AI reads, keyed by `${coin}:${interval}` so switching back is instant. */
  aiReadCache: Record<string, ReadState>
  askState: AskState | null
  /** Capped ring buffer of every read/ask this session, for the downloadable log. */
  readLog: LogEntry[]

  /** Background-polled watchlist snapshot, keyed by coin. */
  watchlistData: Record<string, WatchlistEntry>

  /** Paper-trading simulator: open hypothetical positions and the size/leverage inputs for the next one. */
  positions: SimPosition[]
  simSizeUsd: number
  simLeverage: number

  setCoinInterval: (coin: string, interval: string) => void
  setCandles: (candles: Candle[]) => void
  setMarketCtx: (marketCtx: MarketCtx | null) => void
  setWsStatus: (wsStatus: WsState) => void
  setLastUpdate: (lastUpdate: number) => void
  setLatencyMs: (latencyMs: number) => void
  setLastBarCloseAt: (lastBarCloseAt: number) => void
  setAiRead: (key: string, state: ReadState) => void
  setAskState: (state: AskState | null) => void
  addLogEntry: (entry: LogEntry) => void
  setWatchlistEntry: (coin: string, entry: WatchlistEntry) => void

  openPosition: (input: Omit<SimPosition, 'id' | 'openedAt'>) => void
  closePosition: (id: number) => void
  setSimSizeUsd: (sizeUsd: number) => void
  setSimLeverage: (leverage: number) => void
}

export const useAppStore = create<AppStore>((set) => ({
  coin: 'HYPE',
  interval: '1h',
  candles: [],
  marketCtx: null,
  wsStatus: 'idle',
  lastUpdate: null,
  latencyMs: null,
  lastBarCloseAt: null,
  aiReadCache: {},
  askState: null,
  readLog: [],
  watchlistData: {},
  positions: [],
  simSizeUsd: 5000,
  simLeverage: 5,

  setCoinInterval: (coin, interval) => set({ coin, interval }),
  setCandles: (candles) => set({ candles }),
  setMarketCtx: (marketCtx) => set({ marketCtx }),
  setWsStatus: (wsStatus) => set({ wsStatus }),
  setLastUpdate: (lastUpdate) => set({ lastUpdate }),
  setLatencyMs: (latencyMs) => set({ latencyMs }),
  setLastBarCloseAt: (lastBarCloseAt) => set({ lastBarCloseAt }),
  setAiRead: (key, state) => set((s) => ({ aiReadCache: { ...s.aiReadCache, [key]: state } })),
  setAskState: (askState) => set({ askState }),
  addLogEntry: (entry) => set((s) => ({ readLog: [...s.readLog, entry].slice(-MAX_LOG_ENTRIES) })),
  setWatchlistEntry: (coin, entry) => set((s) => ({ watchlistData: { ...s.watchlistData, [coin]: entry } })),

  openPosition: (input) =>
    set((s) => ({
      positions: [{ ...input, id: nextPositionId++, openedAt: Date.now() }, ...s.positions],
    })),
  closePosition: (id) => set((s) => ({ positions: s.positions.filter((p) => p.id !== id) })),
  setSimSizeUsd: (simSizeUsd) => set({ simSizeUsd }),
  setSimLeverage: (simLeverage) => set({ simLeverage }),
}))
