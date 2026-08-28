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
import { INTERVAL_MS } from '../lib/hl/intervals'
import { useAppStore } from '../store'

// Curated starter set; Phase 5's watchlist/config work is what makes this
// user-configurable against the full Hyperliquid universe.
const COINS = ['HYPE', 'BTC', 'ETH', 'SOL', 'XRP', 'DOGE']
const INTERVALS = Object.keys(INTERVAL_MS)

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
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Coin">
            {COINS.map((c) => (
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
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
