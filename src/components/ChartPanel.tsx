import { CandlestickSeries, type IChartApi, type ISeriesApi, type UTCTimestamp, createChart } from 'lightweight-charts'
import { useEffect, useRef } from 'react'
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

function IntervalTabs() {
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
    </div>
  )
}

export function ChartPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const prevLengthRef = useRef(0)
  const candles = useAppStore((s) => s.candles)

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

  return (
    <div className="flex h-full w-full flex-col">
      <IntervalTabs />
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  )
}
