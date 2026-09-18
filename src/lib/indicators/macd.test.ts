import { describe, expect, it } from 'vitest'
import { hype1h } from './__fixtures__/hype-1h'
import { ema } from './ema'
import { macd } from './macd'

const closes = hype1h.map((c) => c.close)

describe('macd', () => {
  it('the macd line is null until the slow EMA seeds', () => {
    const { macdLine } = macd(closes, 12, 26, 9)
    expect(macdLine[24]).toBeNull()
    expect(macdLine[25]).not.toBeNull()
  })

  it('macd line is fast EMA minus slow EMA at every seeded bar', () => {
    const fast = ema(closes, 12)
    const slow = ema(closes, 26)
    const { macdLine } = macd(closes, 12, 26, 9)
    for (let i = 25; i < 60; i++) {
      expect(macdLine[i]).toBeCloseTo((fast[i] as number) - (slow[i] as number), 10)
    }
  })

  it('signal line is null until 9 macd values exist, then is an EMA of the macd line', () => {
    const { macdLine, signalLine } = macd(closes, 12, 26, 9)
    expect(signalLine[32]).toBeNull()
    expect(signalLine[33]).not.toBeNull()

    const macdValues = macdLine.filter((v): v is number => v !== null)
    const expectedSignal = ema(macdValues, 9)
    expect(signalLine[33]).toBeCloseTo(expectedSignal[8] as number, 10)
    expect(signalLine[59]).toBeCloseTo(expectedSignal[59 - 25] as number, 10)
  })

  it('histogram is macd line minus signal line at every seeded bar', () => {
    const { macdLine, signalLine, histogram } = macd(closes, 12, 26, 9)
    for (let i = 33; i < 60; i++) {
      expect(histogram[i]).toBeCloseTo((macdLine[i] as number) - (signalLine[i] as number), 10)
    }
  })

  it('matches a small hand-traceable example with short periods', () => {
    const values = [1, 2, 3, 4, 5, 6, 7]
    const ema2 = ema(values, 2)
    const ema3 = ema(values, 3)
    const { macdLine, signalLine, histogram } = macd(values, 2, 3, 2)

    expect(macdLine[2]).toBeCloseTo((ema2[2] as number) - (ema3[2] as number), 10)
    expect(macdLine[6]).toBeCloseTo((ema2[6] as number) - (ema3[6] as number), 10)
    expect(histogram[3]).toBeCloseTo((macdLine[3] as number) - (signalLine[3] as number), 10)
  })
})
