import { create } from 'zustand'
import type { AskState, ReadState } from '../lib/ai/types'
import type { Candle, MarketCtx } from '../lib/hl/types'
import type { ConnectionStatus } from '../lib/hl/ws'

export type WsState = ConnectionStatus | 'idle'

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

  setCoinInterval: (coin: string, interval: string) => void
  setCandles: (candles: Candle[]) => void
  setMarketCtx: (marketCtx: MarketCtx | null) => void
  setWsStatus: (wsStatus: WsState) => void
  setLastUpdate: (lastUpdate: number) => void
  setLatencyMs: (latencyMs: number) => void
  setLastBarCloseAt: (lastBarCloseAt: number) => void
  setAiRead: (key: string, state: ReadState) => void
  setAskState: (state: AskState | null) => void
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

  setCoinInterval: (coin, interval) => set({ coin, interval }),
  setCandles: (candles) => set({ candles }),
  setMarketCtx: (marketCtx) => set({ marketCtx }),
  setWsStatus: (wsStatus) => set({ wsStatus }),
  setLastUpdate: (lastUpdate) => set({ lastUpdate }),
  setLatencyMs: (latencyMs) => set({ latencyMs }),
  setLastBarCloseAt: (lastBarCloseAt) => set({ lastBarCloseAt }),
  setAiRead: (key, state) => set((s) => ({ aiReadCache: { ...s.aiReadCache, [key]: state } })),
  setAskState: (askState) => set({ askState }),
}))
