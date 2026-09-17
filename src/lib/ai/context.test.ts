import { describe, expect, it } from 'vitest'
import type { Candle, MarketCtx, OrderBook } from '../hl/types'
import type { IndicatorDict } from '../indicators/types'
import { buildContext } from './context'

function candle(openTime: number): Candle {
  return {
    openTime,
    closeTime: openTime + 59_999,
    symbol: 'HYPE',
    interval: '1m',
    open: 1,
    high: 1,
    low: 1,
    close: 1,
    volume: 1,
    trades: 1,
  }
}

const indicators = {} as IndicatorDict
const marketCtx: MarketCtx = {
  coin: 'HYPE',
  markPx: 83.5,
  oraclePx: 83.5,
  midPx: 83.5,
  funding: 0.0000125,
  openInterest: 25_000_000,
  prevDayPx: 82,
  dayNtlVlm: 1,
}
const book: OrderBook = {
  bids: Array.from({ length: 10 }, (_, i) => ({ price: 100 - i, size: 1 })),
  asks: Array.from({ length: 10 }, (_, i) => ({ price: 101 + i, size: 1 })),
}

describe('buildContext', () => {
  it('caps candles to the trailing candleCount and top-5 book depth on both sides', () => {
    const candles = Array.from({ length: 300 }, (_, i) => candle(i * 60_000))

    const ctx = buildContext('HYPE', '1m', candles, indicators, marketCtx, book)

    expect(ctx.candles).toHaveLength(200)
    expect(ctx.candles[0].openTime).toBe(candles[100].openTime)
    expect(ctx.candles.at(-1)?.openTime).toBe(candles[299].openTime)
    expect(ctx.book.bids).toHaveLength(5)
    expect(ctx.book.asks).toHaveLength(5)
    expect(ctx.funding).toBe(marketCtx.funding)
    expect(ctx.openInterest).toBe(marketCtx.openInterest)
  })

  it('passes through fewer candles unchanged when there are fewer than candleCount', () => {
    const candles = Array.from({ length: 60 }, (_, i) => candle(i * 60_000))
    const ctx = buildContext('HYPE', '1m', candles, indicators, marketCtx, book)
    expect(ctx.candles).toHaveLength(60)
  })
})
