import { useState } from 'react'
import { useAppStore } from '../store'
import { useIndicators } from '../hooks/useIndicators'
import { metaAndAssetCtxs } from '../lib/hl/rest'
import { computePositionVerdict, formatSignedUsd, livePriceForPosition, pnlForPosition } from '../lib/sim'
import type { Verdict } from '../lib/sim'
import type { SimPosition } from '../lib/storage/positions'

function fmtClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour12: false })
}

/** Wide bar below the chart+AI row: open positions (left) and closed-trade history (right). Its own panel, not AiPanel's. */
export function PositionsBar() {
  const coin = useAppStore((s) => s.coin)
  const interval = useAppStore((s) => s.interval)
  const candles = useAppStore((s) => s.candles)
  const watchlistData = useAppStore((s) => s.watchlistData)
  const positions = useAppStore((s) => s.positions)
  const closePosition = useAppStore((s) => s.closePosition)
  const updatePositionSlTp = useAppStore((s) => s.updatePositionSlTp)
  const ledger = useAppStore((s) => s.ledger)
  const sessionPnl = useAppStore((s) => s.sessionPnl)
  const dict = useIndicators()

  const [verdicts, setVerdicts] = useState<Record<number, Verdict | { verdict: string; note: string }>>({})
  const [closingIds, setClosingIds] = useState<Set<number>>(new Set())

  const activePrice = candles.length > 0 ? candles[candles.length - 1].close : null

  function handleRecheck() {
    const next: typeof verdicts = {}
    for (const p of positions) {
      if (p.coin === coin && p.interval === interval && dict) {
        const cur = livePriceForPosition(p, coin, activePrice, watchlistData)
        next[p.id] =
          cur !== null
            ? computePositionVerdict(p.side, cur, dict.swingSupport?.price ?? null, dict.swingResistance?.price ?? null)
            : { verdict: '—', note: 'No live price yet.' }
      } else {
        next[p.id] = { verdict: '—', note: `Switch to ${p.coin} ${p.interval} to re-evaluate.` }
      }
    }
    setVerdicts(next)
  }

  const positionRows = positions.map((p) => {
    const cur = livePriceForPosition(p, coin, activePrice, watchlistData)
    const pnl = cur !== null ? pnlForPosition(p, cur) : null
    return { position: p, pnl, cur, verdict: verdicts[p.id] }
  })
  const totalPnl = positionRows.reduce((sum, r) => sum + (r.pnl ?? 0), 0)

  /**
   * Closes a position at the live price if one's already available (active coin or
   * watchlist). Otherwise fetches a one-off real price so a manual close always
   * books real realized PnL instead of silently dropping the position with nothing
   * booked to the ledger.
   */
  async function handleClose(position: SimPosition, liveCur: number | null) {
    let exitPrice = liveCur
    if (exitPrice === null) {
      setClosingIds((prev) => new Set(prev).add(position.id))
      try {
        const ctx = await metaAndAssetCtxs(position.coin)
        exitPrice = ctx.markPx
      } catch (err) {
        console.error(`Failed to fetch a close price for ${position.coin}:`, err)
      } finally {
        setClosingIds((prev) => {
          const next = new Set(prev)
          next.delete(position.id)
          return next
        })
      }
    }
    closePosition(position.id, exitPrice, 'manual')
  }

  return (
    <div className="border-term-border bg-term-panel flex h-52 shrink-0 border-t">
      <div className="border-term-border flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto border-r p-3">
        <div className="flex items-center justify-between">
          <span className="text-term-muted text-[11px] tracking-widest uppercase">Positions ({positions.length})</span>
          <div className="flex items-center gap-3">
            {positions.length > 0 && (
              <span className={`text-xs font-semibold ${totalPnl >= 0 ? 'text-term-up' : 'text-term-down'}`}>
                {formatSignedUsd(totalPnl)}
              </span>
            )}
            <button
              type="button"
              onClick={handleRecheck}
              disabled={positions.length === 0}
              className="border-term-violet text-term-violet rounded-sm border px-2 py-1 text-[10px] disabled:opacity-40"
            >
              ↻ Re-check
            </button>
          </div>
        </div>

        {positions.length === 0 && <p className="text-term-muted text-sm">No simulated positions yet.</p>}

        {positions.length > 0 && (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-term-muted border-term-border border-b text-[10px] tracking-widest uppercase">
                <th className="px-1.5 py-1 text-left font-normal">Coin</th>
                <th className="px-1.5 py-1 text-left font-normal">Side</th>
                <th className="px-1.5 py-1 text-right font-normal">Size</th>
                <th className="px-1.5 py-1 text-right font-normal">Lev</th>
                <th className="px-1.5 py-1 text-right font-normal">Entry</th>
                <th className="px-1.5 py-1 text-right font-normal">TP</th>
                <th className="px-1.5 py-1 text-right font-normal">SL</th>
                <th className="px-1.5 py-1 text-right font-normal">PnL</th>
                <th className="px-1.5 py-1 text-left font-normal">Verdict</th>
                <th className="px-1.5 py-1" />
              </tr>
            </thead>
            <tbody>
              {positionRows.map(({ position, pnl, cur, verdict }) => (
                <tr key={position.id} className="border-term-border/60 border-b tabular-nums">
                  <td className="px-1.5 py-1.5 font-semibold">{position.coin}</td>
                  <td
                    className={`px-1.5 py-1.5 font-semibold ${position.side === 'long' ? 'text-term-up' : 'text-term-down'}`}
                  >
                    {position.side.toUpperCase()}
                  </td>
                  <td className="text-term-muted px-1.5 py-1.5 text-right">${position.sizeUsd.toLocaleString()}</td>
                  <td className="text-term-muted px-1.5 py-1.5 text-right">{position.leverage}x</td>
                  <td className="text-term-muted px-1.5 py-1.5 text-right">{position.entryPrice.toFixed(2)}</td>
                  <td className="px-1.5 py-1.5 text-right">
                    <input
                      type="number"
                      defaultValue={position.takeProfit ?? ''}
                      onBlur={(e) =>
                        updatePositionSlTp(position.id, {
                          stopLoss: position.stopLoss,
                          takeProfit: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                      className="text-term-up border-term-border w-16 rounded-sm border bg-transparent px-1 py-0.5 text-right"
                    />
                  </td>
                  <td className="px-1.5 py-1.5 text-right">
                    <input
                      type="number"
                      defaultValue={position.stopLoss ?? ''}
                      onBlur={(e) =>
                        updatePositionSlTp(position.id, {
                          stopLoss: e.target.value === '' ? undefined : Number(e.target.value),
                          takeProfit: position.takeProfit,
                        })
                      }
                      className="text-term-down border-term-border w-16 rounded-sm border bg-transparent px-1 py-0.5 text-right"
                    />
                  </td>
                  <td
                    className={`px-1.5 py-1.5 text-right font-semibold ${pnl === null ? 'text-term-muted' : pnl >= 0 ? 'text-term-up' : 'text-term-down'}`}
                  >
                    {pnl === null ? '—' : formatSignedUsd(pnl)}
                  </td>
                  <td className="px-1.5 py-1.5">
                    {verdict ? (
                      <span
                        className={`font-semibold ${verdict.verdict === 'CLOSE' ? 'text-term-down' : verdict.verdict === 'KEEP' ? 'text-term-up' : 'text-term-muted'}`}
                        title={verdict.note}
                      >
                        {verdict.verdict}
                      </span>
                    ) : (
                      <span className="text-term-muted">—</span>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => void handleClose(position, cur)}
                      disabled={closingIds.has(position.id)}
                      className="border-term-border text-term-muted hover:border-term-amber hover:text-term-amber rounded-sm border px-1.5 py-0.5 text-[10px] tracking-wide uppercase disabled:opacity-40"
                    >
                      {closingIds.has(position.id) ? '...' : 'Close'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        <div className="flex items-center justify-between">
          <span className="text-term-muted text-[11px] tracking-widest uppercase">Trade History ({ledger.length})</span>
          <span className={`text-xs font-semibold ${sessionPnl >= 0 ? 'text-term-up' : 'text-term-down'}`}>
            Session {formatSignedUsd(sessionPnl)}
          </span>
        </div>

        {ledger.length === 0 && <p className="text-term-muted text-sm">No closed trades yet.</p>}

        <div className="flex flex-col gap-1">
          {ledger.slice(0, 30).map((entry) => (
            <div key={entry.id} className="border-term-border flex items-center justify-between gap-2 border-b py-1 text-xs">
              <div className="flex flex-col">
                <span className="flex items-center gap-1">
                  <span className={entry.side === 'long' ? 'text-term-up' : 'text-term-down'}>
                    {entry.coin} {entry.side.toUpperCase()}
                  </span>
                  <span className="text-term-muted text-[10px] uppercase">{entry.reason.replace('_', ' ')}</span>
                </span>
                <span className="text-term-muted text-[10px] tabular-nums">
                  {entry.entryPrice.toFixed(2)} → {entry.exitPrice.toFixed(2)} · {fmtClock(entry.closedAt)}
                </span>
              </div>
              <span className={`font-semibold ${entry.pnl >= 0 ? 'text-term-up' : 'text-term-down'}`}>
                {formatSignedUsd(entry.pnl)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
