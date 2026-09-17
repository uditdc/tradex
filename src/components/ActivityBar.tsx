import { useState } from 'react'
import { useAppStore } from '../store'
import type { BotLogEntry } from '../store'
import { useIndicators } from '../hooks/useIndicators'
import type { BotDecision, BotScenario, StrategyId } from '../lib/ai/bot'
import { resolveClosePrice } from '../lib/closePosition'
import { computePositionVerdict, formatSignedUsd, livePriceForPosition, pnlForPosition } from '../lib/sim'
import type { Verdict } from '../lib/sim'
import type { SimPosition } from '../lib/storage/positions'

type Tab = 'positions' | 'history' | 'log'

const STRATEGY_ABBR: Record<StrategyId, string> = {
  momentum: 'MOM',
  orderbook: 'BOOK',
}

const BOT_DECISION_CLASS: Record<BotDecision, string> = {
  buy: 'text-term-up',
  sell: 'text-term-down',
  hold: 'text-term-muted',
}
const BOT_SCENARIO_CLASS: Record<BotScenario, string> = {
  bull: 'text-term-up',
  bear: 'text-term-down',
  neutral: 'text-term-muted',
}

function fmtClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour12: false })
}

function TabButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-[10px] tracking-widest uppercase ${
        active ? 'border-term-amber text-term-amber' : 'text-term-muted border-transparent'
      }`}
    >
      {label} <span className="text-term-muted font-normal">({count})</span>
    </button>
  )
}

function PositionsTab() {
  const coin = useAppStore((s) => s.coin)
  const interval = useAppStore((s) => s.interval)
  const candles = useAppStore((s) => s.candles)
  const watchlistData = useAppStore((s) => s.watchlistData)
  const positions = useAppStore((s) => s.positions)
  const closePosition = useAppStore((s) => s.closePosition)
  const updatePositionSlTp = useAppStore((s) => s.updatePositionSlTp)
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

  async function handleClose(position: SimPosition, liveCur: number | null) {
    let exitPrice = liveCur
    if (exitPrice === null) {
      setClosingIds((prev) => new Set(prev).add(position.id))
      exitPrice = await resolveClosePrice(position, coin, activePrice, watchlistData)
      setClosingIds((prev) => {
        const next = new Set(prev)
        next.delete(position.id)
        return next
      })
    }
    closePosition(position.id, exitPrice, 'manual')
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-3">
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
                <td className={`px-1.5 py-1.5 font-semibold ${position.side === 'long' ? 'text-term-up' : 'text-term-down'}`}>
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
  )
}

function HistoryTab() {
  const ledger = useAppStore((s) => s.ledger)

  if (ledger.length === 0) return <p className="text-term-muted text-sm">No closed trades yet.</p>

  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="text-term-muted border-term-border border-b text-[10px] tracking-widest uppercase">
          <th className="px-1.5 py-1 text-left font-normal">Time</th>
          <th className="px-1.5 py-1 text-left font-normal">Coin</th>
          <th className="px-1.5 py-1 text-left font-normal">Side</th>
          <th className="px-1.5 py-1 text-right font-normal">Size</th>
          <th className="px-1.5 py-1 text-right font-normal">Lev</th>
          <th className="px-1.5 py-1 text-right font-normal">Entry</th>
          <th className="px-1.5 py-1 text-right font-normal">Exit</th>
          <th className="px-1.5 py-1 text-right font-normal">PnL</th>
          <th className="px-1.5 py-1 text-left font-normal">Reason</th>
        </tr>
      </thead>
      <tbody>
        {ledger.slice(0, 30).map((entry) => (
          <tr key={entry.id} className="border-term-border/60 border-b tabular-nums">
            <td className="text-term-muted px-1.5 py-1.5">{fmtClock(entry.closedAt)}</td>
            <td className="px-1.5 py-1.5 font-semibold">{entry.coin}</td>
            <td className={`px-1.5 py-1.5 font-semibold ${entry.side === 'long' ? 'text-term-up' : 'text-term-down'}`}>
              {entry.side.toUpperCase()}
            </td>
            <td className="text-term-muted px-1.5 py-1.5 text-right">${entry.sizeUsd.toLocaleString()}</td>
            <td className="text-term-muted px-1.5 py-1.5 text-right">{entry.leverage}x</td>
            <td className="text-term-muted px-1.5 py-1.5 text-right">{entry.entryPrice.toFixed(2)}</td>
            <td className="text-term-muted px-1.5 py-1.5 text-right">{entry.exitPrice.toFixed(2)}</td>
            <td
              className={`px-1.5 py-1.5 text-right font-semibold ${entry.pnl >= 0 ? 'text-term-up' : 'text-term-down'}`}
            >
              {formatSignedUsd(entry.pnl)}
            </td>
            <td className="text-term-muted px-1.5 py-1.5 text-[10px] tracking-wide uppercase">
              {entry.reason.replace('_', ' ')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function LogRow({ entry }: { entry: BotLogEntry }) {
  return (
    <div className="border-term-border/60 grid grid-cols-[70px_50px_50px_80px_1fr_50px_100px] items-center gap-2 border-b py-1 text-[11px] tabular-nums">
      <span className="text-term-muted">{fmtClock(entry.timestamp)}</span>
      <span className="text-[#F5F0E6]">{entry.coin}</span>
      <span className="text-term-muted">{STRATEGY_ABBR[entry.strategy]}</span>
      <span className={`font-semibold ${BOT_SCENARIO_CLASS[entry.scenario.choice]}`}>
        {entry.scenario.choice.slice(0, 4).toUpperCase()}
      </span>
      <span className={`font-semibold ${BOT_DECISION_CLASS[entry.action.choice]}`}>{entry.action.choice.toUpperCase()}</span>
      <span className="text-right text-[#F5F0E6]">{Math.round(entry.action.confidence * 100)}%</span>
      <div className="bg-term-border h-1 overflow-hidden rounded-sm">
        <div
          className={
            entry.action.choice === 'buy' ? 'bg-term-up h-full' : entry.action.choice === 'sell' ? 'bg-term-down h-full' : 'bg-term-muted h-full'
          }
          style={{ width: `${Math.round(entry.action.confidence * 100)}%` }}
        />
      </div>
    </div>
  )
}

function LogTab() {
  const botLog = useAppStore((s) => s.botLog)

  if (botLog.length === 0) return <p className="text-term-muted text-sm">No Jev decisions logged yet.</p>

  return (
    <div className="flex flex-col">
      <div className="text-term-muted grid grid-cols-[70px_50px_50px_80px_1fr_50px_100px] gap-2 pb-1 text-[9px] tracking-widest uppercase">
        <span>Time</span>
        <span>Coin</span>
        <span>Strat</span>
        <span>Scenario</span>
        <span>Call</span>
        <span className="text-right">Conf</span>
        <span>Conviction</span>
      </div>
      {botLog.slice(0, 40).map((entry, i) => (
        <LogRow key={i} entry={entry} />
      ))}
    </div>
  )
}

/** Wide bar below the chart+AI row: Positions (default), Trade History, and the Jev call log, tabbed. */
export function ActivityBar() {
  const [tab, setTab] = useState<Tab>('positions')
  const positions = useAppStore((s) => s.positions)
  const ledger = useAppStore((s) => s.ledger)
  const botLog = useAppStore((s) => s.botLog)
  const sessionPnl = useAppStore((s) => s.sessionPnl)

  return (
    <div className="border-term-border bg-term-panel flex h-52 shrink-0 flex-col border-t">
      <div className="border-term-border flex items-center border-b px-2">
        <TabButton label="Positions" count={positions.length} active={tab === 'positions'} onClick={() => setTab('positions')} />
        <TabButton label="Trade History" count={ledger.length} active={tab === 'history'} onClick={() => setTab('history')} />
        <TabButton label="Jev Call Log" count={botLog.length} active={tab === 'log'} onClick={() => setTab('log')} />
        <div className="flex-1" />
        <span className="text-term-muted pr-2 text-[10px] tracking-widest uppercase">
          Session{' '}
          <span className={sessionPnl >= 0 ? 'text-term-up' : 'text-term-down'}>{formatSignedUsd(sessionPnl)}</span>
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'positions' && <PositionsTab />}
        {tab === 'history' && <HistoryTab />}
        {tab === 'log' && <LogTab />}
      </div>
    </div>
  )
}
