import type { Candle, MarketCtx, OrderBook } from '../hl/types'
import type { IndicatorDict } from '../indicators/types'
import type { AiContext } from './types'

export const DEFAULT_CANDLE_COUNT = 200
const BOOK_DEPTH = 5

export function buildContext(
  symbol: string,
  interval: string,
  candles: Candle[],
  indicators: IndicatorDict,
  marketCtx: MarketCtx,
  book: OrderBook,
  candleCount = DEFAULT_CANDLE_COUNT,
): AiContext {
  return {
    symbol,
    interval,
    candles: candles.slice(-candleCount),
    indicators,
    funding: marketCtx.funding,
    openInterest: marketCtx.openInterest,
    book: {
      bids: book.bids.slice(0, BOOK_DEPTH),
      asks: book.asks.slice(0, BOOK_DEPTH),
    },
  }
}
