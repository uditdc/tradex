import { useAppStore } from '../store'
import { useFlash } from '../hooks/useFlash'

function Field({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  const flashing = useFlash(value)
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-term-muted text-[11px] tracking-widest uppercase">{label}</span>
      <span
        className={`text-sm tabular-nums ${valueClassName ?? 'text-term-amber'} ${flashing ? 'flash-amber' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}

export function TopBar() {
  const coin = useAppStore((s) => s.coin)
  const interval = useAppStore((s) => s.interval)
  const candles = useAppStore((s) => s.candles)
  const marketCtx = useAppStore((s) => s.marketCtx)

  const price = candles.length > 0 ? candles[candles.length - 1].close : marketCtx?.markPx
  const dayChangePercent =
    marketCtx && price !== undefined ? ((price - marketCtx.prevDayPx) / marketCtx.prevDayPx) * 100 : null

  return (
    <div className="border-term-border bg-term-panel flex h-14 shrink-0 items-center gap-8 border-b px-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-term-muted text-[11px] tracking-widest uppercase">Symbol</span>
        <span className="text-term-amber text-sm font-semibold tabular-nums">
          {coin} <span className="text-term-muted font-normal">/ {interval}</span>
        </span>
      </div>

      <Field label="Price" value={price !== undefined ? price.toFixed(4) : '—'} />
      <Field
        label="24h %"
        value={dayChangePercent !== null ? `${dayChangePercent >= 0 ? '+' : ''}${dayChangePercent.toFixed(2)}%` : '—'}
        valueClassName={
          dayChangePercent === null ? 'text-term-muted' : dayChangePercent >= 0 ? 'text-term-up' : 'text-term-down'
        }
      />
      <Field label="Funding" value={marketCtx ? `${(marketCtx.funding * 100).toFixed(4)}%` : '—'} />
      <Field label="Open Interest" value={marketCtx ? marketCtx.openInterest.toLocaleString() : '—'} />
    </div>
  )
}
