import {
  CandlestickSeries,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  LineStyle,
  type UTCTimestamp,
  createChart,
} from 'lightweight-charts'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store'
import { INTERVAL_MS } from '../lib/hl/intervals'
import type { Candle } from '../lib/hl/types'

const INTERVALS = Object.keys(INTERVAL_MS)

function toBar(candle: Candle) {
  return {
    time: Math.floor(candle.openTime / 1000) as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }
}

interface ZoneRect {
  top: number
  height: number
  label: string
}

function IntervalTabs({ hasZones }: { hasZones: boolean }) {
  const coin = useAppStore((s) => s.coin)
  const interval = useAppStore((s) => s.interval)
  const setCoinInterval = useAppStore((s) => s.setCoinInterval)

  return (
    <div className="border-term-border flex h-9 shrink-0 items-center gap-1 border-b px-3">
      {INTERVALS.map((iv) => (
        <button
          key={iv}
          type="button"
          onClick={() => setCoinInterval(coin, iv)}
          className={`border-b-2 px-2 py-2 font-mono text-xs ${
            iv === interval ? 'border-term-amber text-term-amber' : 'border-transparent text-term-muted'
          }`}
        >
          {iv}
        </button>
      ))}
      <div className="flex-1" />
      {hasZones && (
        <div className="flex items-center gap-1.5">
          <span className="bg-term-violet inline-block h-2 w-2 rounded-sm" />
          <span className="text-term-muted text-[10px] tracking-widest uppercase">AI Zones</span>
        </div>
      )}
    </div>
  )
}

export function ChartPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const prevLengthRef = useRef(0)
  const priceLinesRef = useRef<IPriceLine[]>([])
  const [zoneRects, setZoneRects] = useState<ZoneRect[]>([])
  const candles = useAppStore((s) => s.candles)
  const keyLevels = useAppStore((s) => s.aiReadCache[`${s.coin}:${s.interval}`]?.parsed?.key_levels ?? null)
  const zones = useAppStore((s) => s.aiReadCache[`${s.coin}:${s.interval}`]?.parsed?.zones ?? null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#9AA4B2',
        fontFamily: 'JetBrains Mono Variable, ui-monospace, monospace',
      },
      grid: {
        vertLines: { color: '#2A313A' },
        horzLines: { color: '#2A313A' },
      },
      timeScale: { borderColor: '#2A313A' },
      rightPriceScale: { borderColor: '#2A313A' },
      autoSize: true,
    })

    seriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#4ADE80',
      downColor: '#F87171',
      borderUpColor: '#4ADE80',
      borderDownColor: '#F87171',
      wickUpColor: '#4ADE80',
      wickDownColor: '#F87171',
    })
    chartRef.current = chart
    prevLengthRef.current = 0

    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    const series = seriesRef.current
    if (!series) return

    if (candles.length === 0) {
      prevLengthRef.current = 0
      return
    }

    const grew = candles.length - prevLengthRef.current
    if (prevLengthRef.current === 0 || Math.abs(grew) > 1) {
      series.setData(candles.map(toBar))
    } else {
      series.update(toBar(candles[candles.length - 1]))
    }
    prevLengthRef.current = candles.length
  }, [candles])

  useEffect(() => {
    const series = seriesRef.current
    if (!series) return

    for (const line of priceLinesRef.current) series.removePriceLine(line)
    priceLinesRef.current = (keyLevels ?? []).map((level) =>
      series.createPriceLine({
        price: level.price,
        color: '#E8B45A',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: `${level.kind}${level.note ? ` — ${level.note}` : ''}`,
      }),
    )
  }, [keyLevels])

  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    const container = containerRef.current
    if (!chart || !series || !container) return

    function recompute() {
      if (!series || !zones || zones.length === 0) {
        setZoneRects([])
        return
      }
      const rects: ZoneRect[] = []
      for (const zone of zones) {
        const yFrom = series.priceToCoordinate(zone.from)
        const yTo = series.priceToCoordinate(zone.to)
        if (yFrom === null || yTo === null) continue
        rects.push({ top: Math.min(yFrom, yTo), height: Math.max(Math.abs(yFrom - yTo), 2), label: zone.label })
      }
      setZoneRects(rects)
    }

    recompute()
    chart.timeScale().subscribeVisibleLogicalRangeChange(recompute)
    const resizeObserver = new ResizeObserver(recompute)
    resizeObserver.observe(container)

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(recompute)
      resizeObserver.disconnect()
    }
  }, [zones, candles])

  return (
    <div className="flex h-full w-full flex-col">
      <IntervalTabs hasZones={(zones?.length ?? 0) > 0} />
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />
        {zoneRects.map((rect, i) => (
          <div
            key={i}
            className="border-term-violet/60 pointer-events-none absolute inset-x-0"
            style={{
              top: rect.top,
              height: rect.height,
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderStyle: 'dashed',
              background: 'linear-gradient(90deg, rgba(167,139,250,0.16), rgba(196,169,255,0.05))',
            }}
          >
            <span className="text-term-violet bg-term-bg absolute -top-2 left-2 px-1 text-[10px] tracking-widest">
              ◆ {rect.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
