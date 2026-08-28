import { useEffect, useState } from 'react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from './ui/command'
import { triggerAsk, triggerRead } from '../hooks/useAiRead'
import { downloadReadLog } from '../lib/ai/log'
import { INTERVAL_MS } from '../lib/hl/intervals'
import { useAppStore } from '../store'
import { useConfigStore } from '../store/config'

const INTERVALS = Object.keys(INTERVAL_MS)
const LOOKBACK_PRESETS = [100, 210, 300, 500]

type Mode = 'command' | 'ask'

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('command')
  const [askQuery, setAskQuery] = useState('')
  const coin = useAppStore((s) => s.coin)
  const interval = useAppStore((s) => s.interval)
  const setCoinInterval = useAppStore((s) => s.setCoinInterval)
  const readLog = useAppStore((s) => s.readLog)
  const watchlist = useConfigStore((s) => s.watchlist)
  const defaultInterval = useConfigStore((s) => s.defaultInterval)
  const lookback = useConfigStore((s) => s.lookback)
  const toggleWatchlist = useConfigStore((s) => s.toggleWatchlist)
  const setDefaultInterval = useConfigStore((s) => s.setDefaultInterval)
  const setLookback = useConfigStore((s) => s.setLookback)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === ':' && !isTypingTarget(e.target)) {
        e.preventDefault()
        setMode('command')
        setOpen(true)
      } else if (e.key === '/' && !isTypingTarget(e.target)) {
        e.preventDefault()
        setMode('ask')
        setAskQuery('')
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function select(nextCoin: string, nextInterval: string) {
    setCoinInterval(nextCoin, nextInterval)
    setOpen(false)
  }

  function runRead() {
    setOpen(false)
    void triggerRead()
  }

  function submitAsk() {
    const question = askQuery.trim()
    if (!question) return
    setOpen(false)
    void triggerAsk(question)
  }

  const isOnWatchlist = watchlist.includes(coin)

  if (mode === 'ask') {
    return (
      <CommandDialog open={open} onOpenChange={setOpen} title="Ask the AI" description="Ask a question about this market">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Ask about this market... (Enter to send)"
            value={askQuery}
            onValueChange={setAskQuery}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitAsk()
              }
            }}
          />
        </Command>
      </CommandDialog>
    )
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Switch coin or interval">
      <Command>
        <CommandInput placeholder="Jump to coin, interval, or action..." />
        <CommandList>
          <CommandEmpty>No match.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem value="read" onSelect={runRead}>
              Read current market
            </CommandItem>
            <CommandItem
              value={isOnWatchlist ? 'remove watchlist' : 'add watchlist'}
              onSelect={() => toggleWatchlist(coin)}
            >
              {isOnWatchlist ? `Remove ${coin} from watchlist` : `Add ${coin} to watchlist`}
            </CommandItem>
            <CommandItem
              value="set default interval"
              disabled={interval === defaultInterval}
              onSelect={() => setDefaultInterval(interval)}
            >
              Set default interval to {interval}
              {interval === defaultInterval && <span className="text-term-muted ml-auto text-xs">current</span>}
            </CommandItem>
            <CommandItem
              value="download log"
              disabled={readLog.length === 0}
              onSelect={() => {
                downloadReadLog(readLog)
                setOpen(false)
              }}
            >
              Download read log ({readLog.length})
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Coin">
            {watchlist.map((c) => (
              <CommandItem key={c} value={c} onSelect={() => select(c, interval)}>
                {c}
                {c === coin && <span className="text-term-muted ml-auto text-xs">current</span>}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Interval">
            {INTERVALS.map((i) => (
              <CommandItem key={i} value={i} onSelect={() => select(coin, i)}>
                {i}
                {i === interval && <span className="text-term-muted ml-auto text-xs">current</span>}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Watchlist lookback (bars)">
            {LOOKBACK_PRESETS.map((n) => (
              <CommandItem
                key={n}
                value={`lookback ${n}`}
                disabled={n === lookback}
                onSelect={() => setLookback(n)}
              >
                {n}
                {n === lookback && <span className="text-term-muted ml-auto text-xs">current</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
