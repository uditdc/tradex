import type { BookLevel, Candle, RawBookLevel, RawCandle } from './types'

export function rawCandleToCandle(raw: RawCandle): Candle {
  return {
    openTime: raw.t,
    closeTime: raw.T,
    symbol: raw.s,
    interval: raw.i,
    open: Number(raw.o),
    high: Number(raw.h),
    low: Number(raw.l),
    close: Number(raw.c),
    volume: Number(raw.v),
    trades: raw.n,
  }
}

export function rawBookLevelToBookLevel(raw: RawBookLevel): BookLevel {
  return { price: Number(raw.px), size: Number(raw.sz) }
}
