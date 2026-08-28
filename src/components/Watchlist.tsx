import { useEffect } from 'react'
import { useAppStore } from '../store'
import { useConfigStore } from '../store/config'
import type { Bias } from '../lib/indicators/types'

const BIAS_CLASS: Record<Bias, string> = {
  long: 'text-term-up',
  short: 'text-term-down',
  neutral: 'text-term-muted',
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

export function Watchlist() {
  const watchlist = useConfigStore((s) => s.watchlist)
  const activeCoin = useAppStore((s) => s.coin)
  const activeInterval = useAppStore((s) => s.interval)
  const watchlistData = useAppStore((s) => s.watchlistData)
  const setCoinInterval = useAppStore((s) => s.setCoinInterval)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return
      const slot = Number(e.key)
      if (!Number.isInteger(slot) || slot < 1 || slot > watchlist.length) return
      const coin = watchlist[slot - 1]
      setCoinInterval(coin, activeInterval)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [watchlist, activeInterval, setCoinInterval])

  return (
    <div className="border-term-border bg-term-panel flex h-9 shrink-0 items-center gap-4 border-b px-4">
      {watchlist.map((coin, i) => {
        const entry = watchlistData[coin]
        const active = coin === activeCoin
        return (
          <button
            key={coin}
            type="button"
            onClick={() => setCoinInterval(coin, activeInterval)}
            className={`flex items-baseline gap-1.5 text-sm tabular-nums ${active ? 'text-term-amber' : 'text-term-muted'}`}
          >
            <span className="text-[10px] opacity-60">{i + 1}</span>
            <span className={active ? 'text-term-amber' : ''}>{coin}</span>
            <span className={entry ? BIAS_CLASS[entry.bias] : 'text-term-muted'}>
              {entry ? entry.price.toFixed(2) : '—'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
