import { toast } from 'sonner'
import { create } from 'zustand'
import type { BotDecisionResult } from '../lib/ai/bot'
import type { Candle, MarketCtx } from '../lib/hl/types'
import type { ConnectionStatus } from '../lib/hl/ws'
import type { Bias, Regime } from '../lib/indicators/types'
import { formatSignedUsd, pnlForPosition } from '../lib/sim'
import { addLedgerEntry } from '../lib/storage/ledger'
import type { CloseReason, LedgerEntry } from '../lib/storage/ledger'
import { deletePosition, savePosition } from '../lib/storage/positions'
import type { SimPosition } from '../lib/storage/positions'

export type WsState = ConnectionStatus | 'idle'
export type { SimPosition }

const MAX_BOT_LOG_ENTRIES = 200

const CLOSE_REASON_LABELS: Record<CloseReason, string> = {
  manual: 'Closed',
  stop_loss: 'Stop-loss hit',
  take_profit: 'Take-profit hit',
  bot: 'Bot flipped',
}

export interface WatchlistEntry {
  price: number
  bias: Bias
  regime: Regime
  /** openTime of the latest candle seen for this coin; used to detect a new bar close. */
  lastOpenTime: number
}

/** Trading bot's latest Jev judgment for a coin, plus when it was made. */
export interface BotStatus extends BotDecisionResult {
  timestamp: number
}

/** One entry in the running Jev decision log (every call, not just the latest per coin). */
export interface BotLogEntry extends BotDecisionResult {
  timestamp: number
  coin: string
}

interface AppStore {
  coin: string
  interval: string
  candles: Candle[]
  marketCtx: MarketCtx | null
  wsStatus: WsState
  lastUpdate: number | null
  latencyMs: number | null
  /** Bumped whenever a candle buffer closes a bar. */
  lastBarCloseAt: number | null

  /** Background-polled watchlist snapshot, keyed by coin. */
  watchlistData: Record<string, WatchlistEntry>

  /** Trading bot's latest decision per coin, keyed by coin. */
  botStatus: Record<string, BotStatus>
  /** Every Jev decision this session, newest first, capped. */
  botLog: BotLogEntry[]
  /** True only while a /api/bot-decision request is actually in flight. */
  botAnalyzing: boolean

  /** Paper-trading simulator: open hypothetical positions and the size/leverage inputs for the next one. */
  positions: SimPosition[]
  simSizeUsd: number
  simLeverage: number
  /** Sum of every booked ledger entry's PnL — the realized half of the global paper account's equity. */
  realizedPnl: number
  /** Sum of realized PnL from closes booked *this session* only — never hydrated from storage, starts at 0 on load. */
  sessionPnl: number
  /** Full closed-trade history (durable ledger), newest first. */
  ledger: LedgerEntry[]

  setCoinInterval: (coin: string, interval: string) => void
  setCandles: (candles: Candle[]) => void
  setMarketCtx: (marketCtx: MarketCtx | null) => void
  setWsStatus: (wsStatus: WsState) => void
  setLastUpdate: (lastUpdate: number) => void
  setLatencyMs: (latencyMs: number) => void
  setLastBarCloseAt: (lastBarCloseAt: number) => void
  setWatchlistEntry: (coin: string, entry: WatchlistEntry) => void
  setBotStatus: (coin: string, status: BotStatus) => void
  addBotLogEntry: (entry: BotLogEntry) => void
  setBotAnalyzing: (botAnalyzing: boolean) => void

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
  /** Seeds `realizedPnl` and `ledger` from durable storage; called once on startup. `sessionPnl` is deliberately not seeded. */
  hydrateRealizedPnl: (total: number) => void
  hydrateLedger: (entries: LedgerEntry[]) => void
  setSimSizeUsd: (sizeUsd: number) => void
  setSimLeverage: (leverage: number) => void
}

export const useAppStore = create<AppStore>((set) => ({
  coin: 'HYPE',
  interval: '1m',
  candles: [],
  marketCtx: null,
  wsStatus: 'idle',
  lastUpdate: null,
  latencyMs: null,
  lastBarCloseAt: null,
  watchlistData: {},
  botStatus: {},
  botLog: [],
  botAnalyzing: false,
  positions: [],
  simSizeUsd: 5000,
  simLeverage: 5,
  realizedPnl: 0,
  sessionPnl: 0,
  ledger: [],

  setCoinInterval: (coin, interval) => set({ coin, interval }),
  setCandles: (candles) => set({ candles }),
  setMarketCtx: (marketCtx) => set({ marketCtx }),
  setWsStatus: (wsStatus) => set({ wsStatus }),
  setLastUpdate: (lastUpdate) => set({ lastUpdate }),
  setLatencyMs: (latencyMs) => set({ latencyMs }),
  setLastBarCloseAt: (lastBarCloseAt) => set({ lastBarCloseAt }),
  setWatchlistEntry: (coin, entry) => set((s) => ({ watchlistData: { ...s.watchlistData, [coin]: entry } })),
  setBotStatus: (coin, status) => set((s) => ({ botStatus: { ...s.botStatus, [coin]: status } })),
  addBotLogEntry: (entry) => set((s) => ({ botLog: [entry, ...s.botLog].slice(0, MAX_BOT_LOG_ENTRIES) })),
  setBotAnalyzing: (botAnalyzing) => set({ botAnalyzing }),

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
        toast.error(`Closed ${position?.coin ?? 'position'} without a live price — nothing booked to the ledger.`)
        return { positions }
      }
      const pnl = pnlForPosition(position, exitPrice)
      const closedAt = Date.now()
      const entry: LedgerEntry = {
        // Synthetic id for the in-memory mirror — IndexedDB assigns the real
        // autoincrement id independently; this array is a display copy, not the
        // source of truth, so a collision-free session-local id is all it needs.
        id: closedAt,
        coin: position.coin,
        interval: position.interval,
        side: position.side,
        sizeUsd: position.sizeUsd,
        leverage: position.leverage,
        entryPrice: position.entryPrice,
        exitPrice,
        pnl,
        openedAt: position.openedAt,
        closedAt,
        reason,
      }
      void addLedgerEntry(entry)
      void deletePosition(id)
      const reasonLabel = CLOSE_REASON_LABELS[reason]
      const message = `${reasonLabel}: ${position.side.toUpperCase()} ${position.coin} ${formatSignedUsd(pnl)}`
      if (pnl >= 0) toast.success(message)
      else toast.error(message)
      return {
        positions,
        realizedPnl: s.realizedPnl + pnl,
        sessionPnl: s.sessionPnl + pnl,
        ledger: [entry, ...s.ledger],
      }
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
  hydrateLedger: (entries) => set({ ledger: entries }),
  setSimSizeUsd: (simSizeUsd) => set({ simSizeUsd }),
  setSimLeverage: (simLeverage) => set({ simLeverage }),
}))
