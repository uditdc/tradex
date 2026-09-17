import { useEffect, useState } from 'react'
import { useAppStore } from '../store'
import { useConfigStore } from '../store/config'

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
  const simSizeUsd = useAppStore((s) => s.simSizeUsd)
  const simLeverage = useAppStore((s) => s.simLeverage)
  const setSimSizeUsd = useAppStore((s) => s.setSimSizeUsd)
  const setSimLeverage = useAppStore((s) => s.setSimLeverage)
  const botStatus = useAppStore((s) => s.botStatus[coin])
  const botLog = useAppStore((s) => s.botLog)
  const botEnabled = useConfigStore((s) => s.botEnabled)
  const toggleBot = useConfigStore((s) => s.toggleBot)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!botEnabled) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [botEnabled])

  return (
    <div className="border-term-border bg-term-panel flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l p-3">
      <div className="border-term-border flex flex-col gap-3 border-b pb-3">
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

        <div className="flex flex-col gap-2">
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
    </div>
  )
}
