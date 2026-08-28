import { describe, expect, it } from 'vitest'
import { CandleBuffer, mergeCandle } from './buffer'
import type { Candle } from './types'

// Modeled on real WS ticks captured from wss://api.hyperliquid.xyz/ws for HYPE 1m:
// the exchange resends the same still-open bar (same t/T) on every tick, then starts
// sending a new t/T once that bar closes.
function candle(overrides: Partial<Candle>): Candle {
  return {
    openTime: 1787915580000,
    closeTime: 1787915639999,
    symbol: 'HYPE',
    interval: '1m',
    open: 83.284,
    high: 83.385,
    low: 83.276,
    close: 83.374,
    volume: 945.73,
    trades: 160,
    ...overrides,
  }
}

describe('mergeCandle', () => {
  it('starts the buffer with the first candle', () => {
    const { candles, closed } = mergeCandle([], candle({}))
    expect(candles).toHaveLength(1)
    expect(closed).toBeNull()
  })

  it('updates the still-open bar in place on a same-bar tick', () => {
    const bar1 = candle({ close: 83.374, volume: 945.73, trades: 160 })
    const tick = candle({ close: 83.363, volume: 949.44, trades: 161 })

    const { candles, closed } = mergeCandle([bar1], tick)

    expect(candles).toHaveLength(1)
    expect(candles[0]).toEqual(tick)
    expect(closed).toBeNull()
  })

  it('never duplicates across many ticks on the same bar', () => {
    let candles: Candle[] = []
    for (let i = 0; i < 5; i++) {
      ;({ candles } = mergeCandle(candles, candle({ trades: 160 + i })))
    }
    expect(candles).toHaveLength(1)
    expect(candles[0].trades).toBe(164)
  })

  it('appends a new bar and reports the previous one as closed', () => {
    const bar1Final = candle({ close: 83.4, trades: 200 })
    const bar2First = candle({
      openTime: 1787915640000,
      closeTime: 1787915699999,
      open: 83.4,
      close: 83.41,
      trades: 1,
    })

    const { candles, closed } = mergeCandle([bar1Final], bar2First)

    expect(candles).toHaveLength(2)
    expect(candles[1]).toEqual(bar2First)
    expect(closed).toEqual(bar1Final)
  })

  it('ignores a stale/out-of-order tick behind the last bar', () => {
    const bar1 = candle({})
    const bar2 = candle({ openTime: 1787915640000, closeTime: 1787915699999 })
    const stale = candle({ trades: 999 }) // same openTime as bar1, now behind bar2

    const { candles, closed } = mergeCandle([bar1, bar2], stale)

    expect(candles).toEqual([bar1, bar2])
    expect(closed).toBeNull()
  })
})

describe('CandleBuffer', () => {
  it('bootstraps from a snapshot and merges live ticks the same way mergeCandle does', () => {
    const buffer = new CandleBuffer([
      candle({ openTime: 1787915520000, closeTime: 1787915579999 }),
      candle({}), // the still-open bar the snapshot ended on
    ])

    const closedFromSameBar = buffer.push(candle({ close: 83.39 }))
    expect(closedFromSameBar).toBeNull()
    expect(buffer.all).toHaveLength(2)

    const closedFromNewBar = buffer.push(
      candle({ openTime: 1787915640000, closeTime: 1787915699999 }),
    )
    expect(closedFromNewBar).not.toBeNull()
    expect(buffer.all).toHaveLength(3)
  })
})
