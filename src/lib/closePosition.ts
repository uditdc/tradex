import type { WatchlistEntry } from '../store'
import { metaAndAssetCtxs } from './hl/rest'
import { livePriceForPosition } from './sim'
import type { SimPositionLike } from './sim'

/**
 * Best available close price for a position: the live price if one's already on
 * hand (active coin or watchlist), otherwise a one-off real price fetched from
 * Hyperliquid, so a close always books real realized PnL instead of silently
 * dropping the position with nothing booked to the ledger. Never throws — a
 * failed fetch resolves to `null`, which `closePosition` (`store/index.ts`)
 * already handles by removing the position without booking anything.
 */
export async function resolveClosePrice(
  position: Pick<SimPositionLike, 'coin'>,
  activeCoin: string,
  activePrice: number | null,
  watchlistData: Record<string, WatchlistEntry>,
): Promise<number | null> {
  const live = livePriceForPosition(position, activeCoin, activePrice, watchlistData)
  if (live !== null) return live
  try {
    const ctx = await metaAndAssetCtxs(position.coin)
    return ctx.markPx
  } catch (err) {
    console.error(`Failed to fetch a close price for ${position.coin}:`, err)
    return null
  }
}
