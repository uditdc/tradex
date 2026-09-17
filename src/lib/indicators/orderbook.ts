import type { BookLevel, OrderBook } from '../hl/types'

export interface OrderBookMetrics {
  /** (bidDepth - askDepth) / (bidDepth + askDepth) within the depth window, -1 (all ask) .. +1 (all bid). */
  imbalance: number
  /** Best ask minus best bid, as a % of mid price. 0 when either side of the book is empty. */
  spreadPercent: number
  /** Total depth within the window as a multiple of top-of-book size — how much liquidity sits behind the touch. */
  depthRatio: number
}

const DEPTH_WINDOW_PCT = 0.5

function depthWithin(levels: BookLevel[], lowerBound: number, upperBound: number): number {
  return levels.filter((l) => l.price >= lowerBound && l.price <= upperBound).reduce((sum, l) => sum + l.size, 0)
}

/**
 * Book-pressure metrics for the "Order Book Pressure" strategy, computed from a live
 * `l2Book` snapshot. Pure, no I/O — mirrors the rest of `lib/indicators`. `midPrice` is
 * supplied by the caller (this app uses the latest candle close as its mid-price proxy,
 * avoiding a second Hyperliquid round trip just for `midPx`).
 */
export function computeOrderBookMetrics(book: OrderBook, midPrice: number): OrderBookMetrics {
  const bestBid = book.bids[0]?.price ?? null
  const bestAsk = book.asks[0]?.price ?? null
  const spreadPercent = bestBid !== null && bestAsk !== null ? ((bestAsk - bestBid) / midPrice) * 100 : 0

  const lowerBound = midPrice * (1 - DEPTH_WINDOW_PCT / 100)
  const upperBound = midPrice * (1 + DEPTH_WINDOW_PCT / 100)
  const bidDepth = depthWithin(book.bids, lowerBound, midPrice)
  const askDepth = depthWithin(book.asks, midPrice, upperBound)
  const totalDepth = bidDepth + askDepth
  const imbalance = totalDepth > 0 ? (bidDepth - askDepth) / totalDepth : 0

  const topOfBookSize = (book.bids[0]?.size ?? 0) + (book.asks[0]?.size ?? 0)
  const depthRatio = topOfBookSize > 0 ? totalDepth / topOfBookSize : 0

  return { imbalance, spreadPercent, depthRatio }
}
