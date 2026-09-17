import { useEffect, useState } from 'react'
import type { BotDecision, BotScenario, FactorScore } from '../lib/ai/bot'
import { STRATEGIES } from '../lib/strategies/types'
import { useAppStore } from '../store'
import { useConfigStore } from '../store/config'

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
const BOT_PROBABILITY_BG: Record<BotDecision, string> = {
  buy: 'bg-term-up',
  sell: 'bg-term-down',
  hold: 'bg-term-border',
}

// Same index semantics as the rubrics `server/index.ts` sends Jev — kept in sync by hand, not over the wire.
const DIRECTIONAL_LABELS = ['Strong Bear', 'Bear', 'Neutral', 'Bull', 'Strong Bull']
const CONVICTION_LABELS = ['Low', 'Moderate', 'High']

/** Ring geometry for the countdown SVG — radius chosen so the circumference is a clean number. */
const RING_RADIUS = 17
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/** Seconds left until the next wall-clock minute boundary — when `useTradingBot` next polls a closed 1m bar. */
function secondsToNextMinute(now: number): number {
  return 60 - (Math.floor(now / 1000) % 60)
}

function RingCountdown({ seconds, analyzing }: { seconds: number; analyzing: boolean }) {
  const urgent = seconds <= 8
  const colorVar = analyzing ? 'var(--color-term-amber)' : urgent ? 'var(--color-term-down)' : 'var(--color-term-up)'
  const colorClass = analyzing ? 'text-term-amber' : urgent ? 'text-term-down' : 'text-term-up'
  // Ring starts full (just reset) and drains to empty as the countdown reaches zero.
  const offset = RING_CIRCUMFERENCE * (1 - seconds / 60)
  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg viewBox="0 0 40 40" width="44" height="44" className="-rotate-90">
        <circle cx="20" cy="20" r={RING_RADIUS} fill="none" stroke="var(--color-term-border)" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={RING_RADIUS}
          fill="none"
          stroke={colorVar}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-semibold ${colorClass}`}>
        {analyzing ? '…' : String(seconds).padStart(2, '0')}
      </span>
    </div>
  )
}

function directionalTone(idx: number, labelCount: number): 'up' | 'down' | 'muted' {
  const mid = (labelCount - 1) / 2
  if (idx > mid) return 'up'
  if (idx < mid) return 'down'
  return 'muted'
}

function FactorRow({ label, kind, factor }: { label: string; kind: 'directional' | 'conviction'; factor: FactorScore }) {
  const labels = kind === 'directional' ? DIRECTIONAL_LABELS : CONVICTION_LABELS
  const idx = Math.max(0, Math.min(labels.length - 1, Math.round(factor.score)))
  const lit = idx + 1
  const tone: 'up' | 'down' | 'muted' | 'amber' =
    kind === 'directional' ? directionalTone(idx, labels.length) : idx === labels.length - 1 ? 'amber' : 'muted'
  const textClass = { up: 'text-term-up', down: 'text-term-down', muted: 'text-term-muted', amber: 'text-term-amber' }[
    tone
  ]
  const barClass = { up: 'bg-term-up', down: 'bg-term-down', muted: 'bg-term-muted', amber: 'bg-term-amber' }[tone]
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-term-muted">{label}</span>
        <span className={textClass}>{labels[idx]}</span>
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: labels.length }, (_, i) => (
          <div key={i} className={`h-[3px] flex-1 rounded-[1px] ${i < lit ? barClass : 'bg-term-border'}`} />
        ))}
      </div>
    </div>
  )
}

export function AiPanel() {
  const coin = useAppStore((s) => s.coin)
  const simSizeUsd = useAppStore((s) => s.simSizeUsd)
  const simLeverage = useAppStore((s) => s.simLeverage)
  const setSimSizeUsd = useAppStore((s) => s.setSimSizeUsd)
  const setSimLeverage = useAppStore((s) => s.setSimLeverage)
  const botStatus = useAppStore((s) => s.botStatus[coin])
  const botAnalyzing = useAppStore((s) => s.botAnalyzing)
  const botEnabled = useConfigStore((s) => s.botEnabled)
  const toggleBot = useConfigStore((s) => s.toggleBot)
  const activeStrategy = useConfigStore((s) => s.activeStrategy)
  const setActiveStrategy = useConfigStore((s) => s.setActiveStrategy)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!botEnabled) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [botEnabled])

  const seconds = secondsToNextMinute(now)
  const statusText = !botEnabled
    ? 'paused · manual control'
    : botAnalyzing
      ? `analyzing ${coin} 1m…`
      : `watching ${coin} 1m closes`
  const statusClass = !botEnabled ? 'text-term-muted' : botAnalyzing ? 'text-term-amber' : 'text-term-up'

  return (
    <div className="border-term-border bg-term-panel flex w-80 shrink-0 flex-col overflow-y-auto border-l">
      <div className="border-term-border flex items-center gap-2.5 border-b p-3">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${botEnabled ? 'bg-term-amber orb-pulse' : 'bg-term-muted'}`}
          style={botEnabled ? { animationDuration: botAnalyzing ? '0.7s' : '2.2s' } : undefined}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[11px] font-semibold tracking-widest text-[#F5F0E6]">
            JEV{' '}
            <span className="text-term-muted font-normal">
              · AUTO MODE · {STRATEGIES.find((s) => s.id === activeStrategy)?.label.toUpperCase()}
            </span>
          </span>
          <span className={`flex items-center gap-0.5 text-[10px] ${statusClass}`}>
            {statusText}
            <span className="blink-cursor">▌</span>
          </span>
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

      <div className="border-term-border flex flex-col gap-2 border-b p-3">
        <div className="flex items-center gap-2">
          <span className="text-term-muted w-8 shrink-0 text-[10px]">Strategy</span>
          <div className="flex flex-1 gap-1">
            {STRATEGIES.map((strategy) => (
              <button
                key={strategy.id}
                type="button"
                onClick={() => setActiveStrategy(strategy.id)}
                title={strategy.description}
                className={`flex-1 rounded-sm border px-1.5 py-1 text-[10px] tracking-wide uppercase ${
                  activeStrategy === strategy.id
                    ? 'border-term-amber text-term-amber'
                    : 'border-term-border text-term-muted'
                }`}
              >
                {strategy.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-term-border flex flex-col gap-2 border-b p-3">
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
          <div className="border-term-border flex items-center gap-3 border-b p-3">
            <RingCountdown seconds={seconds} analyzing={botAnalyzing} />
            <div className="flex flex-col gap-0.5">
              <span className="text-term-muted text-[10px] tracking-widest uppercase">Next Jev analysis</span>
              <span className={`text-xs ${botAnalyzing ? 'text-term-amber' : seconds <= 8 ? 'text-term-down' : 'text-term-up'}`}>
                {botAnalyzing ? 'running now' : `00:${String(seconds).padStart(2, '0')}`}
              </span>
            </div>
          </div>

          {botStatus ? (
            <>
              <div className="border-term-border flex flex-col gap-2 border-b p-3">
                <div className="flex items-center justify-between">
                  <span className="text-term-muted text-[10px] tracking-widest uppercase">Scenario</span>
                  <span className={`text-xs font-semibold uppercase ${BOT_SCENARIO_CLASS[botStatus.scenario.choice]}`}>
                    {botStatus.scenario.choice}{' '}
                    <span className="text-term-muted font-normal">{Math.round(botStatus.scenario.confidence * 100)}%</span>
                  </span>
                </div>
                <div className="flex items-end justify-between">
                  <span className={`text-2xl font-bold uppercase ${BOT_DECISION_CLASS[botStatus.action.choice]}`}>
                    {botStatus.action.choice} {coin}
                  </span>
                  <div className="flex flex-col items-end">
                    <span className="text-lg font-semibold text-[#F5F0E6]">
                      {Math.round(botStatus.action.confidence * 100)}%
                    </span>
                    <span className="text-term-muted text-[9px] tracking-widest uppercase">conviction</span>
                  </div>
                </div>
                <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-sm">
                  {(['buy', 'sell', 'hold'] as const).map((k) => (
                    <div
                      key={k}
                      className={BOT_PROBABILITY_BG[k]}
                      style={{ width: `${Math.round(botStatus.action.probabilities[k] * 100)}%` }}
                    />
                  ))}
                </div>
                <div className="text-term-muted flex justify-between text-[10px] tabular-nums">
                  <span>buy {Math.round(botStatus.action.probabilities.buy * 100)}%</span>
                  <span>sell {Math.round(botStatus.action.probabilities.sell * 100)}%</span>
                  <span>hold {Math.round(botStatus.action.probabilities.hold * 100)}%</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 p-3">
                <span className="text-term-muted text-[10px] tracking-widest uppercase">Why</span>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {botStatus.factors.map((factor) => (
                    <FactorRow key={factor.key} label={factor.label} kind={factor.kind} factor={factor} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-term-muted p-3 text-xs">Waiting for the next 1m close...</p>
          )}
        </>
      )}
    </div>
  )
}
