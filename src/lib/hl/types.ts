export interface Candle {
  openTime: number
  closeTime: number
  symbol: string
  interval: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  trades: number
}

export interface MarketCtx {
  coin: string
  markPx: number
  oraclePx: number
  midPx: number
  funding: number
  openInterest: number
  prevDayPx: number
  dayNtlVlm: number
}

/** Raw shape of one candle as returned by the `candleSnapshot` info request. */
export interface RawCandle {
  t: number
  T: number
  s: string
  i: string
  o: string
  c: string
  h: string
  l: string
  v: string
  n: number
}

/** Raw shape of one entry in the `universe` array from `metaAndAssetCtxs`. */
export interface RawUniverseAsset {
  name: string
  szDecimals: number
  maxLeverage: number
  marginTableId: number
  isDelisted?: boolean
  onlyIsolated?: boolean
  marginMode?: string
}

/** Raw shape of one entry in the assetCtxs array from `metaAndAssetCtxs`, index-aligned with `universe`. */
export interface RawAssetCtx {
  funding: string
  openInterest: string
  prevDayPx: string
  dayNtlVlm: string
  premium: string
  oraclePx: string
  markPx: string
  midPx: string
  impactPxs: [string, string]
  dayBaseVlm: string
}

export type RawMetaAndAssetCtxs = [{ universe: RawUniverseAsset[] }, RawAssetCtx[]]
