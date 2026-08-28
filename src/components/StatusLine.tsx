import { useEffect, useState } from 'react'
import { useAppStore } from '../store'
import type { WsState } from '../store'
import { livePriceForPosition, pnlForPosition } from '../lib/sim'

const WS_LABEL: Record<WsState, string> = {
  idle: 'IDLE',
  connecting: 'CONNECTING',
  open: 'LIVE',
  closed: 'RECONNECTING',
}
const WS_CLASS: Record<WsState, string> = {
  idle: 'text-term-muted',
  connecting: 'text-term-amber',
  open: 'text-term-up',
  closed: 'text-term-down',
}

function timeAgo(ms: number, now: number): string {
  const deltaSeconds = Math.max(0, Math.round((now - ms) / 1000))
  if (deltaSeconds < 1) return 'just now'
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`
  return `${Math.floor(deltaSeconds / 60)}m ago`
}

export function StatusLine() {
  const wsStatus = useAppStore((s) => s.wsStatus)
  const latencyMs = useAppStore((s) => s.latencyMs)
  const lastUpdate = useAppStore((s) => s.lastUpdate)
  const coin = useAppStore((s) => s.coin)
  const candles = useAppStore((s) => s.candles)
  const positions = useAppStore((s) => s.positions)
  const watchlistData = useAppStore((s) => s.watchlistData)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const activePrice = candles.length > 0 ? candles[candles.length - 1].close : null
  const totalPnl = positions.reduce((sum, p) => {
    const cur = livePriceForPosition(p, coin, activePrice, watchlistData)
    return cur !== null ? sum + pnlForPosition(p, cur) : sum
  }, 0)

  return (
    <div className="border-term-border bg-term-panel text-term-muted flex h-7 shrink-0 items-center gap-6 border-t px-4 text-[11px] tracking-widest uppercase">
      <span className={WS_CLASS[wsStatus]}>WS {WS_LABEL[wsStatus]}</span>
      <span>Latency {latencyMs !== null ? `${latencyMs}ms` : '—'}</span>
      <span>Updated {lastUpdate !== null ? timeAgo(lastUpdate, now) : '—'}</span>
      <div className="flex-1" />
      {positions.length > 0 && (
        <span>
          Sim P&amp;L{' '}
          <span className={totalPnl >= 0 ? 'text-term-up' : 'text-term-down'}>
            {totalPnl >= 0 ? '+' : ''}${Math.abs(totalPnl).toFixed(2)}
          </span>
        </span>
      )}
    </div>
  )
}
