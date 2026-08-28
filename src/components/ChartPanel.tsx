import {
  CandlestickSeries,
  type IPriceLine,
  type ISeriesApi,
  LineStyle,
  type UTCTimestamp,
  createChart,
} from 'lightweight-charts'
import { useEffect, useRef } from 'react'
import { useAppStore } from '../store'
import type { Candle } from '../lib/hl/types'

function toBar(candle: Candle) {
  return {
    time: Math.floor(candle.openTime / 1000) as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }
}

export function ChartPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const prevLengthRef = useRef(0)
  const priceLinesRef = useRef<IPriceLine[]>([])
  const candles = useAppStore((s) => s.candles)
  const keyLevels = useAppStore((s) => s.aiReadCache[`${s.coin}:${s.interval}`]?.parsed?.key_levels ?? null)

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
    prevLengthRef.current = 0

    return () => {
      chart.remove()
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

  return <div ref={containerRef} className="h-full w-full" />
}
