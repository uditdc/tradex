import { useEffect, useState } from 'react'
import { useAppStore } from '../store'
import { useConfigStore } from '../store/config'
import { useFlash } from '../hooks/useFlash'
import type { Bias } from '../lib/indicators/types'

const BIAS_CLASS: Record<Bias, string> = {
  long: 'text-term-up',
  short: 'text-term-down',
  neutral: 'text-term-muted',
}

function Field({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  const flashing = useFlash(value)
  return (
    <div className="flex shrink-0 flex-col gap-0.5">
      <span className="text-term-muted decoration-term-muted/60 text-[11px] tracking-widest uppercase underline decoration-dotted underline-offset-2">
        {label}
      </span>
      <span
        className={`text-sm tabular-nums ${valueClassName ?? 'text-term-amber'} ${flashing ? 'flash-amber' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}

function compactNum(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function useFundingCountdown(): string {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const hourMs = 60 * 60_000
  const remaining = hourMs - (now % hourMs)
  const minutes = Math.floor(remaining / 60_000)
  const seconds = Math.floor((remaining % 60_000) / 1000)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function CoinSwitcher() {
  const [open, setOpen] = useState(false)
  const coin = useAppStore((s) => s.coin)
  const interval = useAppStore((s) => s.interval)
  const watchlist = useConfigStore((s) => s.watchlist)
  const watchlistData = useAppStore((s) => s.watchlistData)
  const setCoinInterval = useAppStore((s) => s.setCoinInterval)

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-transparent font-mono"
      >
        <span className="border-term-amber text-term-amber bg-term-bg flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
          {coin.charAt(0)}
        </span>
        <span className="text-sm font-semibold text-[#F5F0E6]">{coin}-USDC</span>
        <span className="text-term-muted text-[10px]">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="border-term-border bg-term-panel absolute top-9 left-0 z-40 flex w-56 flex-col gap-0.5 rounded-md border p-1.5 shadow-lg">
            {watchlist.map((c) => {
              const entry = watchlistData[c]
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCoinInterval(c, interval)
                    setOpen(false)
                  }}
                  className={`flex items-baseline justify-between rounded-sm px-2 py-1.5 text-left text-sm ${c === coin ? 'text-term-amber' : 'text-term-muted'}`}
                >
                  <span>{c}-USDC</span>
                  <span className={`text-xs ${entry ? BIAS_CLASS[entry.bias] : 'text-term-muted'}`}>
                    {entry ? entry.price.toFixed(2) : '—'}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export function TopBar() {
  const candles = useAppStore((s) => s.candles)
  const marketCtx = useAppStore((s) => s.marketCtx)
  const countdown = useFundingCountdown()

  const price = candles.length > 0 ? candles[candles.length - 1].close : marketCtx?.markPx
  const dayChangePercent =
    marketCtx && price !== undefined ? ((price - marketCtx.prevDayPx) / marketCtx.prevDayPx) * 100 : null

  return (
    <div className="border-term-border bg-term-panel flex h-14 shrink-0 items-center gap-6 border-b px-4">
      <CoinSwitcher />

      <div className="flex flex-1 items-center gap-6 overflow-x-auto">
        <Field label="Mark" value={price !== undefined ? price.toFixed(4) : '—'} />
        <Field label="Oracle" value={marketCtx ? marketCtx.oraclePx.toFixed(4) : '—'} />
        <Field
          label="24h Change"
          value={dayChangePercent !== null ? `${dayChangePercent >= 0 ? '+' : ''}${dayChangePercent.toFixed(2)}%` : '—'}
          valueClassName={
            dayChangePercent === null ? 'text-term-muted' : dayChangePercent >= 0 ? 'text-term-up' : 'text-term-down'
          }
        />
        <Field label="24h Volume" value={marketCtx ? compactNum(marketCtx.dayNtlVlm) : '—'} />
        <Field label="Open Interest" value={marketCtx ? compactNum(marketCtx.openInterest) : '—'} />
        <div className="flex shrink-0 flex-col gap-0.5">
          <span className="text-term-muted decoration-term-muted/60 text-[11px] tracking-widest uppercase underline decoration-dotted underline-offset-2">
            Funding
          </span>
          <span className="text-sm tabular-nums">
            <span className="text-term-amber">{marketCtx ? `${(marketCtx.funding * 100).toFixed(4)}%` : '—'}</span>{' '}
            <span className="text-term-muted text-xs">{countdown}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
