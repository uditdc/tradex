/** ms per Hyperliquid candle interval string, e.g. '1m', '4h', '1d'. */
export const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '3m': 3 * 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
  '2h': 2 * 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '8h': 8 * 60 * 60_000,
  '12h': 12 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
  '3d': 3 * 24 * 60 * 60_000,
  '1w': 7 * 24 * 60 * 60_000,
  '1M': 30 * 24 * 60 * 60_000,
}

/** Bars to backfill on a fresh snapshot; comfortably covers computeAll's 55-bar EMA55. */
export const DEFAULT_CANDLE_LOOKBACK = 210

export function intervalMs(interval: string): number {
  const ms = INTERVAL_MS[interval]
  if (!ms) {
    throw new Error(`unknown interval "${interval}", expected one of ${Object.keys(INTERVAL_MS).join(', ')}`)
  }
  return ms
}
