import { describe, expect, it } from 'vitest'
import type { OrderBook } from '../hl/types'
import { computeOrderBookMetrics } from './orderbook'

const MID = 100

describe('computeOrderBookMetrics', () => {
  it('reads ~0 imbalance for a symmetric book', () => {
    const book: OrderBook = {
      bids: [
        { price: 99.9, size: 10 },
        { price: 99.8, size: 5 },
      ],
      asks: [
        { price: 100.1, size: 10 },
        { price: 100.2, size: 5 },
      ],
    }
    const { imbalance, spreadPercent, depthRatio } = computeOrderBookMetrics(book, MID)
    expect(imbalance).toBeCloseTo(0)
    expect(spreadPercent).toBeCloseTo(0.2)
    expect(depthRatio).toBeCloseTo(30 / 20)
  })

  it('reads positive imbalance for a bid-heavy book', () => {
    const book: OrderBook = {
      bids: [
        { price: 99.9, size: 50 },
        { price: 99.8, size: 20 },
      ],
      asks: [
        { price: 100.1, size: 5 },
        { price: 100.2, size: 5 },
      ],
    }
    expect(computeOrderBookMetrics(book, MID).imbalance).toBeCloseTo(0.75)
  })

  it('reads negative imbalance for an ask-heavy book', () => {
    const book: OrderBook = {
      bids: [{ price: 99.9, size: 5 }],
      asks: [{ price: 100.1, size: 45 }],
    }
    expect(computeOrderBookMetrics(book, MID).imbalance).toBeCloseTo(-0.8)
  })

  it('excludes levels outside the depth window', () => {
    const book: OrderBook = {
      bids: [
        { price: 99.9, size: 10 },
        { price: 90, size: 1000 }, // far outside the ±0.5% window — must not count
      ],
      asks: [{ price: 100.1, size: 10 }],
    }
    expect(computeOrderBookMetrics(book, MID).imbalance).toBeCloseTo(0)
  })

  it('does not crash on an empty side, and treats it as fully imbalanced', () => {
    const book: OrderBook = { bids: [{ price: 99.9, size: 10 }], asks: [] }
    const { imbalance, spreadPercent, depthRatio } = computeOrderBookMetrics(book, MID)
    expect(imbalance).toBe(1)
    expect(spreadPercent).toBe(0)
    expect(depthRatio).toBe(1)
  })

  it('returns all-zero metrics for a fully empty book', () => {
    expect(computeOrderBookMetrics({ bids: [], asks: [] }, MID)).toEqual({
      imbalance: 0,
      spreadPercent: 0,
      depthRatio: 0,
    })
  })
})
