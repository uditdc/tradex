import type { Candle, RawCandle } from './types'

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
