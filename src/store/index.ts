import { create } from 'zustand'
import type { AskState, LogEntry, ReadState } from '../lib/ai/types'
import type { Candle, MarketCtx } from '../lib/hl/types'
import type { ConnectionStatus } from '../lib/hl/ws'
import type { Bias, Regime } from '../lib/indicators/types'
import { pnlForPosition } from '../lib/sim'
import { addLedgerEntry } from '../lib/storage/ledger'
import type { CloseReason } from '../lib/storage/ledger'
import { deletePosition, savePosition } from '../lib/storage/positions'
import type { SimPosition } from '../lib/storage/positions'

export type WsState = ConnectionStatus | 'idle'
export type { SimPosition }

const MAX_LOG_ENTRIES = 200

export interface WatchlistEntry {
  price: number
  bias: Bias
  regime: Regime
  /** openTime of the latest candle seen for this coin; used to detect a new bar close. */
  lastOpenTime: number
}

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
  /** Sum of every booked ledger entry's PnL — the realized half of the global paper account's equity. */
  realizedPnl: number

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
  /**
   * Closes a position and books its realized PnL to the ledger. `exitPrice` is the
   * live price at close time, or null if no live source exists for that coin right
   * now (see `livePriceForPosition`) — in that case the position is still removed
   * but nothing is booked, since we have no real exit price to compute PnL from.
   */
  closePosition: (id: number, exitPrice: number | null, reason: CloseReason) => void
  updatePositionSlTp: (id: number, patch: { stopLoss?: number; takeProfit?: number }) => void
  /** Replaces the in-memory position list with what's in durable storage; called once on startup. */
  hydratePositions: (positions: SimPosition[]) => void
  /** Seeds `realizedPnl` from the durable ledger's total; called once on startup. */
  hydrateRealizedPnl: (total: number) => void
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
  realizedPnl: 0,

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
    set((s) => {
      const openedAt = Date.now()
      const position: SimPosition = { ...input, id: openedAt, openedAt }
      void savePosition(position)
      return { positions: [position, ...s.positions] }
    }),
  closePosition: (id, exitPrice, reason) =>
    set((s) => {
      const position = s.positions.find((p) => p.id === id)
      const positions = s.positions.filter((p) => p.id !== id)
      if (!position || exitPrice === null) {
        void deletePosition(id)
        return { positions }
      }
      const pnl = pnlForPosition(position, exitPrice)
      void addLedgerEntry({
        coin: position.coin,
        interval: position.interval,
        side: position.side,
        sizeUsd: position.sizeUsd,
        leverage: position.leverage,
        entryPrice: position.entryPrice,
        exitPrice,
        pnl,
        openedAt: position.openedAt,
        closedAt: Date.now(),
        reason,
      })
      void deletePosition(id)
      return { positions, realizedPnl: s.realizedPnl + pnl }
    }),
  updatePositionSlTp: (id, patch) =>
    set((s) => {
      const positions = s.positions.map((p) => (p.id === id ? { ...p, ...patch } : p))
      const updated = positions.find((p) => p.id === id)
      if (updated) void savePosition(updated)
      return { positions }
    }),
  hydratePositions: (positions) => set({ positions }),
  hydrateRealizedPnl: (realizedPnl) => set({ realizedPnl }),
  setSimSizeUsd: (simSizeUsd) => set({ simSizeUsd }),
  setSimLeverage: (simLeverage) => set({ simLeverage }),
}))
