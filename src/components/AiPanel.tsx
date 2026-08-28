import { useState } from 'react'
import { useAppStore } from '../store'
import { useIndicators } from '../hooks/useIndicators'
import { computePositionVerdict, livePriceForPosition, pnlForPosition, suggestionSideFromBias } from '../lib/sim'
import type { Verdict } from '../lib/sim'

function Cursor() {
  return <span className="bg-term-amber ml-0.5 inline-block h-3 w-1.5 animate-pulse align-middle" />
}

function biasClass(bias: string): string {
  const lower = bias.toLowerCase()
  if (lower.includes('long')) return 'text-term-up'
  if (lower.includes('short')) return 'text-term-down'
  return 'text-term-muted'
}

function fmtUsd(n: number): string {
  return `${n >= 0 ? '+' : ''}$${Math.abs(n).toFixed(2)}`
}

export function AiPanel() {
  const coin = useAppStore((s) => s.coin)
  const interval = useAppStore((s) => s.interval)
  const candles = useAppStore((s) => s.candles)
  const aiReadCache = useAppStore((s) => s.aiReadCache)
  const askState = useAppStore((s) => s.askState)
  const watchlistData = useAppStore((s) => s.watchlistData)
  const positions = useAppStore((s) => s.positions)
  const simSizeUsd = useAppStore((s) => s.simSizeUsd)
  const simLeverage = useAppStore((s) => s.simLeverage)
  const setSimSizeUsd = useAppStore((s) => s.setSimSizeUsd)
  const setSimLeverage = useAppStore((s) => s.setSimLeverage)
  const openPosition = useAppStore((s) => s.openPosition)
  const closePosition = useAppStore((s) => s.closePosition)
  const dict = useIndicators()

  const [rationaleExpanded, setRationaleExpanded] = useState(false)
  const [verdicts, setVerdicts] = useState<Record<number, Verdict | { verdict: string; note: string }>>({})

  const read = aiReadCache[`${coin}:${interval}`] ?? null
  const activePrice = candles.length > 0 ? candles[candles.length - 1].close : null

  const suggestionSide = suggestionSideFromBias(read?.parsed?.bias ?? dict?.bias)
  const suggestionTarget = suggestionSide === 'long' ? dict?.swingResistance?.price : dict?.swingSupport?.price
  const suggestionStop = suggestionSide === 'long' ? dict?.swingSupport?.price : dict?.swingResistance?.price

  function handleOpen() {
    if (activePrice === null) return
    openPosition({ coin, interval, side: suggestionSide, sizeUsd: simSizeUsd, leverage: simLeverage, entryPrice: activePrice })
  }

  function handleRerun() {
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
    return { position: p, pnl, verdict: verdicts[p.id] }
  })
  const totalPnl = positionRows.reduce((sum, r) => sum + (r.pnl ?? 0), 0)

  return (
    <div className="border-term-border bg-term-panel flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l p-3">
      {askState && (
        <div className="border-term-border flex flex-col gap-1 border-b pb-3">
          <span className="text-term-muted text-[11px] tracking-widest uppercase">Ask</span>
          <p className="text-term-amber text-sm">{askState.question}</p>
          {askState.status === 'error' ? (
            <p className="text-term-down text-sm">{askState.error}</p>
          ) : (
            <p className="text-term-muted text-sm whitespace-pre-wrap">
              {askState.text}
              {askState.status === 'streaming' && <Cursor />}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="bg-term-violet pulse-glow inline-block h-1.5 w-1.5 rounded-full" />
        <span className="text-term-muted text-[11px] tracking-widest uppercase">AI Read</span>
      </div>

      {!read && <p className="text-term-muted text-sm">Waiting for enough candles...</p>}

      {read && read.status === 'streaming' && !read.parsed && (
        <p className="text-term-muted text-sm whitespace-pre-wrap">
          {read.text || 'Thinking...'}
          <Cursor />
        </p>
      )}

      {read && read.status === 'error' && <p className="text-term-down text-sm">{read.error}</p>}

      {read && read.status === 'done' && !read.parsed && (
        <div className="flex flex-col gap-1">
          <p className="text-term-down text-xs">{read.error}</p>
          <p className="text-term-muted text-sm whitespace-pre-wrap">{read.text}</p>
        </div>
      )}

      {read?.parsed && (
        <div className="flex flex-col gap-3 text-sm">
          <div className="border-term-border flex flex-col border-b pb-3">
            <button
              type="button"
              onClick={() => setRationaleExpanded((e) => !e)}
              className="flex items-center justify-between bg-transparent"
            >
              <span className={`font-semibold tracking-wide uppercase ${biasClass(read.parsed.bias)}`}>
                {read.parsed.bias}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-term-muted tabular-nums">{Math.round(read.parsed.confidence * 100)}%</span>
                <span
                  className="text-term-muted inline-block text-[10px] transition-transform"
                  style={{ transform: rationaleExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  ▾
                </span>
              </span>
            </button>
            {rationaleExpanded && <p className="text-term-muted mt-3 leading-relaxed">{read.parsed.rationale}</p>}
          </div>

          {read.parsed.key_levels.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-term-amber text-[11px] tracking-widest uppercase">◆ Key Levels</span>
              {read.parsed.key_levels.map((lvl, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2">
                  <span className="text-term-muted truncate text-xs">
                    {lvl.kind}
                    {lvl.note ? ` — ${lvl.note}` : ''}
                  </span>
                  <span className="text-term-amber shrink-0 tabular-nums">{lvl.price}</span>
                </div>
              ))}
            </div>
          )}

          {(read.parsed.zones?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-term-violet text-[11px] tracking-widest uppercase">◆ AI Zones</span>
              {read.parsed.zones!.map((zone, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2">
                  <span className="text-term-muted truncate text-xs">{zone.label}</span>
                  <span className="text-term-violet shrink-0 tabular-nums">
                    {Math.min(zone.from, zone.to)}–{Math.max(zone.from, zone.to)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-term-down text-[11px] tracking-widest uppercase">✕ Invalidation</span>
            <p className="text-term-muted">{read.parsed.invalidation}</p>
          </div>
        </div>
      )}

      {dict && (
        <div className="border-term-border flex flex-col gap-2.5 border-t pt-3">
          <div className="flex items-center gap-2">
            <span className="bg-term-violet inline-block h-3.5 w-3.5 shrink-0 rounded-sm" />
            <span className="text-term-muted text-[11px] tracking-widest uppercase">AI Trade Suggestion</span>
          </div>
          <div className="border-term-border flex flex-col gap-2 rounded-sm border p-2.5">
            <div className="flex items-baseline justify-between">
              <span className={`text-sm font-semibold ${suggestionSide === 'long' ? 'text-term-up' : 'text-term-down'}`}>
                {suggestionSide.toUpperCase()} {coin}
              </span>
              {read?.parsed && (
                <span className="text-term-muted text-xs">{Math.round(read.parsed.confidence * 100)}% confidence</span>
              )}
            </div>
            <div className="text-term-muted flex justify-between gap-2 text-xs">
              <span>Entry {activePrice !== null ? activePrice.toFixed(2) : '—'}</span>
              <span>Target {suggestionTarget !== undefined ? suggestionTarget.toFixed(2) : '—'}</span>
              <span>Stop {suggestionStop !== undefined ? suggestionStop.toFixed(2) : '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-term-muted w-8 shrink-0 text-[10px]">Size</span>
              <input
                type="range"
                min={500}
                max={20000}
                step={500}
                value={simSizeUsd}
                onChange={(e) => setSimSizeUsd(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-term-amber w-16 shrink-0 text-right text-xs">${simSizeUsd.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-term-muted w-8 shrink-0 text-[10px]">Lev</span>
              <input
                type="range"
                min={1}
                max={25}
                step={1}
                value={simLeverage}
                onChange={(e) => setSimLeverage(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-term-amber w-16 shrink-0 text-right text-xs">{simLeverage}x</span>
            </div>
            <button
              type="button"
              onClick={handleOpen}
              disabled={activePrice === null}
              className="bg-term-amber rounded-sm py-2 text-xs font-semibold tracking-wide text-[#0B0D10] disabled:opacity-40"
            >
              OPEN (PAPER)
            </button>
          </div>
        </div>
      )}

      <div className="border-term-border flex flex-col gap-2 border-t pt-3">
        <div className="flex items-center justify-between">
          <span className="text-term-muted text-[11px] tracking-widest uppercase">Positions ({positions.length})</span>
          <button
            type="button"
            onClick={handleRerun}
            disabled={positions.length === 0}
            className="border-term-violet text-term-violet rounded-sm border px-2 py-1 text-[10px] disabled:opacity-40"
          >
            ↻ Re-run AI
          </button>
        </div>

        {positions.length === 0 && <p className="text-term-muted text-sm">No simulated positions yet.</p>}

        {positionRows.map(({ position, pnl, verdict }) => (
          <div key={position.id} className="border-term-border flex flex-col gap-1.5 rounded-sm border p-2">
            <div className="flex items-baseline justify-between">
              <span className="flex items-center gap-1.5">
                <span className={`text-xs font-semibold ${position.side === 'long' ? 'text-term-up' : 'text-term-down'}`}>
                  {position.coin} {position.side.toUpperCase()}
                </span>
                <span className="border-term-violet text-term-violet rounded-sm border px-1 text-[9px]">SIM</span>
              </span>
              <button type="button" onClick={() => closePosition(position.id)} className="text-term-muted text-xs">
                ✕
              </button>
            </div>
            <div className="flex justify-between">
              <span className="text-term-muted text-xs">
                ${position.sizeUsd.toLocaleString()} · {position.leverage}x · entry {position.entryPrice.toFixed(2)}
              </span>
              <span
                className={`text-sm font-semibold ${pnl === null ? 'text-term-muted' : pnl >= 0 ? 'text-term-up' : 'text-term-down'}`}
              >
                {pnl === null ? '—' : fmtUsd(pnl)}
              </span>
            </div>
            {verdict && (
              <div className="border-term-border/60 flex items-baseline gap-1.5 border-t pt-1.5">
                <span
                  className={`text-[10px] font-semibold ${verdict.verdict === 'CLOSE' ? 'text-term-down' : verdict.verdict === 'KEEP' ? 'text-term-up' : 'text-term-muted'}`}
                >
                  {verdict.verdict}
                </span>
                <span className="text-term-muted text-xs">{verdict.note}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {positions.length > 0 && (
        <div className="text-term-muted flex justify-between border-t border-t-[color:var(--color-term-border)] pt-2 text-xs tracking-widest uppercase">
          <span>Sim P&amp;L</span>
          <span className={totalPnl >= 0 ? 'text-term-up' : 'text-term-down'}>{fmtUsd(totalPnl)}</span>
        </div>
      )}
    </div>
  )
}
