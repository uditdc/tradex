import { useEffect, useState } from 'react'
import { useAppStore } from '../store'
import type { WsState } from '../store'

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

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="border-term-border bg-term-panel text-term-muted flex h-7 shrink-0 items-center gap-6 border-t px-4 text-[11px] tracking-widest uppercase">
      <span className={WS_CLASS[wsStatus]}>WS {WS_LABEL[wsStatus]}</span>
      <span>Latency {latencyMs !== null ? `${latencyMs}ms` : '—'}</span>
      <span>Updated {lastUpdate !== null ? timeAgo(lastUpdate, now) : '—'}</span>
    </div>
  )
}
