import { Badge } from './ui/badge'
import { Skeleton } from './ui/skeleton'
import { useIndicators } from '../hooks/useIndicators'
import { useAppStore } from '../store'
import { useFlash } from '../hooks/useFlash'
import { MIN_CANDLES } from '../lib/indicators'
import type { Bias, Regime } from '../lib/indicators/types'

const BIAS_LABEL: Record<Bias, string> = { long: 'LONG', short: 'SHORT', neutral: 'NEUTRAL' }
const BIAS_CLASS: Record<Bias, string> = {
  long: 'border-term-up text-term-up',
  short: 'border-term-down text-term-down',
  neutral: 'border-term-border text-term-muted',
}
const REGIME_LABEL: Record<Regime, string> = {
  trending: 'TRENDING',
  ranging: 'RANGING',
  compressing: 'COMPRESSING',
}

function Row({ label, value }: { label: string; value: string }) {
  const flashing = useFlash(value)
  return (
    <div className="border-term-border/60 flex items-baseline justify-between border-b py-1.5 last:border-b-0">
      <span className="text-term-muted text-[11px] tracking-widest uppercase">{label}</span>
      <span className={`text-term-amber text-sm tabular-nums ${flashing ? 'flash-amber' : ''}`}>{value}</span>
    </div>
  )
}

export function IndicatorBlock() {
  const candles = useAppStore((s) => s.candles)
  const marketCtx = useAppStore((s) => s.marketCtx)
  const dict = useIndicators()

  if (!dict) {
    return (
      <div className="border-term-border bg-term-panel flex w-64 shrink-0 flex-col gap-2 border-r p-3">
        <span className="text-term-muted text-[11px] tracking-widest uppercase">
          Warming up ({candles.length}/{MIN_CANDLES})
        </span>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="bg-term-border/40 h-5 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="border-term-border bg-term-panel flex w-64 shrink-0 flex-col gap-3 overflow-y-auto border-r p-3">
      <div className="flex gap-2">
        <Badge variant="outline" className={`rounded-sm ${BIAS_CLASS[dict.bias]}`}>
          {BIAS_LABEL[dict.bias]}
        </Badge>
        <Badge variant="outline" className="border-term-border text-term-muted rounded-sm">
          {REGIME_LABEL[dict.regime]}
        </Badge>
      </div>

      <div>
        <Row label="RSI 14" value={dict.rsi14.toFixed(2)} />
        <Row label="ATR %" value={`${dict.atrPercent.toFixed(3)}%`} />
        <Row label="Vol vs 20-bar avg" value={`${dict.volumeRatio.toFixed(2)}x`} />
        <Row label="EMA 9 / 21 / 55" value={`${dict.ema9.toFixed(2)} / ${dict.ema21.toFixed(2)} / ${dict.ema55.toFixed(2)}`} />
        <Row
          label="Support"
          value={dict.swingSupport ? `${dict.swingSupport.price.toFixed(2)} (-${dict.swingSupport.distancePercent.toFixed(2)}%)` : '—'}
        />
        <Row
          label="Resistance"
          value={dict.swingResistance ? `${dict.swingResistance.price.toFixed(2)} (+${dict.swingResistance.distancePercent.toFixed(2)}%)` : '—'}
        />
        <Row label="Funding" value={marketCtx ? `${(marketCtx.funding * 100).toFixed(4)}%` : '—'} />
        <Row label="Open Interest" value={marketCtx ? marketCtx.openInterest.toLocaleString() : '—'} />
      </div>
    </div>
  )
}
