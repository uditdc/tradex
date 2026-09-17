import { useEffect, useState } from 'react'
import { useAppStore } from '../store'
import { useConfigStore } from '../store/config'
import { useIndicators } from '../hooks/useIndicators'
import { suggestionSideFromBias } from '../lib/sim'

const BOT_DECISION_CLASS: Record<string, string> = { buy: 'text-term-up', sell: 'text-term-down', hold: 'text-term-muted' }

function fmtClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour12: false })
}

/** Seconds left until the next wall-clock minute boundary — when `useTradingBot` next polls a closed 1m bar. */
function secondsToNextMinute(now: number): number {
  return 60 - Math.floor(now / 1000) % 60
}

export function AiPanel() {
  const coin = useAppStore((s) => s.coin)
  const interval = useAppStore((s) => s.interval)
  const candles = useAppStore((s) => s.candles)
  const askState = useAppStore((s) => s.askState)
  const simSizeUsd = useAppStore((s) => s.simSizeUsd)
  const simLeverage = useAppStore((s) => s.simLeverage)
  const setSimSizeUsd = useAppStore((s) => s.setSimSizeUsd)
  const setSimLeverage = useAppStore((s) => s.setSimLeverage)
  const openPosition = useAppStore((s) => s.openPosition)
  const botStatus = useAppStore((s) => s.botStatus[coin])
  const botLog = useAppStore((s) => s.botLog)
  const botEnabled = useConfigStore((s) => s.botEnabled)
  const toggleBot = useConfigStore((s) => s.toggleBot)
  const dict = useIndicators()

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!botEnabled) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [botEnabled])

  const activePrice = candles.length > 0 ? candles[candles.length - 1].close : null

  // The trading bot's live Jev decision is the primary signal once it's running;
  // deterministic EMA-stack bias is the fallback for a coin the bot hasn't judged
  // yet, or when Auto Mode is off.
  const botSide = botStatus && botStatus.decision !== 'hold' ? (botStatus.decision === 'buy' ? 'long' : 'short') : undefined
  const suggestionSide = botSide ?? suggestionSideFromBias(dict?.bias)
  const suggestionTarget = suggestionSide === 'long' ? dict?.swingResistance?.price : dict?.swingSupport?.price
  const suggestionStop = suggestionSide === 'long' ? dict?.swingSupport?.price : dict?.swingResistance?.price

  // Reset when the suggestion's coin/interval changes (see the `key` prop on the
  // inputs below) rather than via an effect — a fresh mount is simpler than
  // syncing stale drafts.
  const [slDraft, setSlDraft] = useState<string>('')
  const [tpDraft, setTpDraft] = useState<string>('')
  const stopLoss = slDraft !== '' ? Number(slDraft) : suggestionStop
  const takeProfit = tpDraft !== '' ? Number(tpDraft) : suggestionTarget

  function handleOpen() {
    if (activePrice === null) return
    openPosition({
      coin,
      interval,
      side: suggestionSide,
      sizeUsd: simSizeUsd,
      leverage: simLeverage,
      entryPrice: activePrice,
      stopLoss,
      takeProfit,
    })
  }

  return (
    <div className="border-term-border bg-term-panel flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l p-3">
      <div className="border-term-border flex flex-col gap-2 border-b pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${botEnabled ? 'bg-term-amber pulse-glow' : 'bg-term-muted'}`}
            />
            <span className="text-term-muted text-[11px] tracking-widest uppercase">Auto Mode</span>
          </div>
          <button
            type="button"
            onClick={toggleBot}
            className={`rounded-sm border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
              botEnabled ? 'border-term-amber text-term-amber' : 'border-term-border text-term-muted'
            }`}
          >
            {botEnabled ? 'On' : 'Off'}
          </button>
        </div>
        {botEnabled && (
          <>
            <div className="text-term-muted flex justify-between text-[10px] tracking-widest uppercase tabular-nums">
              <span>Next Jev analysis</span>
              <span className="text-term-amber">00:{String(secondsToNextMinute(now)).padStart(2, '0')}</span>
            </div>
            {botStatus ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between">
                  <span className={`text-sm font-semibold uppercase ${BOT_DECISION_CLASS[botStatus.decision]}`}>
                    {botStatus.decision} {coin}
                  </span>
                  <span className="text-term-muted text-xs tabular-nums">{Math.round(botStatus.confidence * 100)}%</span>
                </div>
                <div className="text-term-muted flex gap-2 text-[10px] tabular-nums">
                  <span>buy {Math.round(botStatus.probabilities.buy * 100)}%</span>
                  <span>sell {Math.round(botStatus.probabilities.sell * 100)}%</span>
                  <span>hold {Math.round(botStatus.probabilities.hold * 100)}%</span>
                </div>
              </div>
            ) : (
              <p className="text-term-muted text-xs">Waiting for the next 1m close...</p>
            )}
          </>
        )}
        {botLog.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-term-muted text-[10px] tracking-widest uppercase">Jev Call Log</span>
            <div className="flex max-h-28 flex-col gap-0.5 overflow-y-auto">
              {botLog.slice(0, 20).map((entry, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2 text-[10px] tabular-nums">
                  <span className="text-term-muted">
                    {fmtClock(entry.timestamp)} {entry.coin}
                  </span>
                  <span className={BOT_DECISION_CLASS[entry.decision]}>
                    {entry.decision.toUpperCase()} {Math.round(entry.confidence * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {askState && (
        <div className="border-term-border flex flex-col gap-1 border-b pb-3">
          <span className="text-term-muted text-[11px] tracking-widest uppercase">Ask</span>
          <p className="text-term-amber text-sm">{askState.question}</p>
          {askState.status === 'error' ? (
            <p className="text-term-down text-sm">{askState.error}</p>
          ) : askState.status === 'loading' ? (
            <p className="text-term-muted text-sm">Thinking...</p>
          ) : (
            <p className="text-term-muted text-sm whitespace-pre-wrap">{askState.text}</p>
          )}
        </div>
      )}

      {dict && (
        <div className="border-term-border flex flex-col gap-2.5 border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="bg-term-violet inline-block h-3.5 w-3.5 shrink-0 rounded-sm" />
            <span className="text-term-muted text-[11px] tracking-widest uppercase">Trade Suggestion</span>
          </div>
          <div className="border-term-border flex flex-col gap-2 rounded-sm border p-2.5">
            <div className="flex items-baseline justify-between">
              <span className={`text-sm font-semibold ${suggestionSide === 'long' ? 'text-term-up' : 'text-term-down'}`}>
                {suggestionSide.toUpperCase()} {coin}
              </span>
              {botStatus && (
                <span className="text-term-muted text-xs">{Math.round(botStatus.confidence * 100)}% confidence</span>
              )}
            </div>
            <div className="text-term-muted flex items-center justify-between gap-2 text-xs">
              <span>Entry {activePrice !== null ? activePrice.toFixed(2) : '—'}</span>
              <span className="flex items-center gap-1">
                TP
                <input
                  key={`${coin}-${interval}-tp`}
                  type="number"
                  placeholder={suggestionTarget !== undefined ? suggestionTarget.toFixed(2) : '—'}
                  value={tpDraft}
                  onChange={(e) => setTpDraft(e.target.value)}
                  className="text-term-up border-term-border w-16 rounded-sm border bg-transparent px-1 py-0.5 text-right"
                />
              </span>
              <span className="flex items-center gap-1">
                SL
                <input
                  key={`${coin}-${interval}-sl`}
                  type="number"
                  placeholder={suggestionStop !== undefined ? suggestionStop.toFixed(2) : '—'}
                  value={slDraft}
                  onChange={(e) => setSlDraft(e.target.value)}
                  className="text-term-down border-term-border w-16 rounded-sm border bg-transparent px-1 py-0.5 text-right"
                />
              </span>
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

    </div>
  )
}
