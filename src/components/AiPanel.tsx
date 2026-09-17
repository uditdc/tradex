import { useEffect, useState } from 'react'
import type { FactorScore } from '../lib/ai/bot'
import { useAppStore } from '../store'
import { useConfigStore } from '../store/config'

const BOT_DECISION_CLASS: Record<string, string> = { buy: 'text-term-up', sell: 'text-term-down', hold: 'text-term-muted' }
const BOT_SCENARIO_CLASS: Record<string, string> = { bull: 'text-term-up', bear: 'text-term-down', neutral: 'text-term-muted' }

// Same index semantics as the rubrics `server/index.ts` sends Jev — kept in sync by hand, not over the wire.
const DIRECTIONAL_LABELS = ['Strong Bear', 'Bear', 'Neutral', 'Bull', 'Strong Bull']
const CONVICTION_LABELS = ['Low', 'Moderate', 'High']

function fmtClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour12: false })
}

/** `trend`/`momentum`/`levels` have a direction (bear↔bull); `volatility`/`volume`/`regime` only have conviction (low↔high). */
function FactorRow({ label, kind, factor }: { label: string; kind: 'directional' | 'conviction'; factor: FactorScore }) {
  const labels = kind === 'directional' ? DIRECTIONAL_LABELS : CONVICTION_LABELS
  const idx = Math.max(0, Math.min(labels.length - 1, Math.round(factor.score)))
  const mid = (labels.length - 1) / 2
  const colorClass =
    kind === 'directional'
      ? idx > mid
        ? 'text-term-up'
        : idx < mid
          ? 'text-term-down'
          : 'text-term-muted'
      : idx === labels.length - 1
        ? 'text-term-amber'
        : 'text-term-muted'
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="text-term-muted">{label}</span>
      <span className={colorClass}>{labels[idx]}</span>
    </div>
  )
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
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-term-muted text-[10px] tracking-widest uppercase">Scenario</span>
                  <span className={`text-xs font-semibold uppercase ${BOT_SCENARIO_CLASS[botStatus.scenario.choice]}`}>
                    {botStatus.scenario.choice}{' '}
                    <span className="text-term-muted font-normal">{Math.round(botStatus.scenario.confidence * 100)}%</span>
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between">
                    <span className={`text-sm font-semibold uppercase ${BOT_DECISION_CLASS[botStatus.action.choice]}`}>
                      {botStatus.action.choice} {coin}
                    </span>
                    <span className="text-term-muted text-xs tabular-nums">
                      {Math.round(botStatus.action.confidence * 100)}%
                    </span>
                  </div>
                  <div className="text-term-muted flex gap-2 text-[10px] tabular-nums">
                    <span>buy {Math.round(botStatus.action.probabilities.buy * 100)}%</span>
                    <span>sell {Math.round(botStatus.action.probabilities.sell * 100)}%</span>
                    <span>hold {Math.round(botStatus.action.probabilities.hold * 100)}%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-term-muted text-[10px] tracking-widest uppercase">Why</span>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                    <FactorRow label="Trend" kind="directional" factor={botStatus.factors.trend} />
                    <FactorRow label="Volatility" kind="conviction" factor={botStatus.factors.volatility} />
                    <FactorRow label="Momentum" kind="directional" factor={botStatus.factors.momentum} />
                    <FactorRow label="Volume" kind="conviction" factor={botStatus.factors.volume} />
                    <FactorRow label="Levels" kind="directional" factor={botStatus.factors.levels} />
                    <FactorRow label="Regime" kind="conviction" factor={botStatus.factors.regime} />
                  </div>
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
                  <span className="flex items-center gap-1.5">
                    <span className={BOT_SCENARIO_CLASS[entry.scenario.choice]}>
                      {entry.scenario.choice.slice(0, 4).toUpperCase()}
                    </span>
                    <span className={BOT_DECISION_CLASS[entry.action.choice]}>
                      {entry.action.choice.toUpperCase()} {Math.round(entry.action.confidence * 100)}%
                    </span>
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
