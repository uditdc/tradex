import { rawBookLevelToBookLevel, rawCandleToCandle } from './mappers'
import type { Candle, MarketCtx, OrderBook, RawCandle, RawL2Book, RawMetaAndAssetCtxs } from './types'

const INFO_URL = 'https://api.hyperliquid.xyz/info'

async function postInfo<T>(body: unknown): Promise<T> {
  const res = await fetch(INFO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`Hyperliquid info request failed: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function candleSnapshot(
  coin: string,
  interval: string,
  startTime = 0,
  endTime = Date.now(),
): Promise<Candle[]> {
  const raw = await postInfo<RawCandle[]>({
    type: 'candleSnapshot',
    req: { coin, interval, startTime, endTime },
  })
  return raw.map(rawCandleToCandle)
}

export async function metaAndAssetCtxs(coin: string): Promise<MarketCtx> {
  const [{ universe }, assetCtxs] = await postInfo<RawMetaAndAssetCtxs>({
    type: 'metaAndAssetCtxs',
  })
  const index = universe.findIndex((asset) => asset.name === coin)
  if (index === -1) {
    throw new Error(`Unknown coin: ${coin}`)
  }
  const ctx = assetCtxs[index]
  return {
    coin,
    markPx: Number(ctx.markPx),
    oraclePx: Number(ctx.oraclePx),
    midPx: Number(ctx.midPx),
    funding: Number(ctx.funding),
    openInterest: Number(ctx.openInterest),
    prevDayPx: Number(ctx.prevDayPx),
    dayNtlVlm: Number(ctx.dayNtlVlm),
  }
}

export async function l2Book(coin: string): Promise<OrderBook> {
  const raw = await postInfo<RawL2Book>({ type: 'l2Book', coin })
  const [bids, asks] = raw.levels
  return {
    bids: bids.map(rawBookLevelToBookLevel),
    asks: asks.map(rawBookLevelToBookLevel),
  }
}
