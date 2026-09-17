import { Toaster } from 'sonner'
import { AiPanel } from './components/AiPanel'
import { ChartPanel } from './components/ChartPanel'
import { CommandPalette } from './components/CommandPalette'
import { StatusLine } from './components/StatusLine'
import { TopBar } from './components/TopBar'
import { Watchlist } from './components/Watchlist'
import { useAiRead } from './hooks/useAiRead'
import { useCandles } from './hooks/useCandles'
import { usePersistedLedger } from './hooks/usePersistedLedger'
import { usePersistedPositions } from './hooks/usePersistedPositions'
import { usePositionMonitor } from './hooks/usePositionMonitor'
import { useTradingBot } from './hooks/useTradingBot'
import { useWatchlist } from './hooks/useWatchlist'
import { useAppStore } from './store'

function App() {
  const coin = useAppStore((s) => s.coin)
  const interval = useAppStore((s) => s.interval)
  useCandles(coin, interval)
  useAiRead()
  useWatchlist()
  usePersistedPositions()
  usePersistedLedger()
  usePositionMonitor()
  useTradingBot()

  return (
    <div className="bg-term-bg flex h-screen w-screen flex-col overflow-hidden">
      <TopBar />
      <Watchlist />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <ChartPanel />
        </div>
        <AiPanel />
      </div>
      <StatusLine />
      <CommandPalette />
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--color-term-panel)',
            border: '1px solid var(--color-term-border)',
            borderRadius: '2px',
            color: 'var(--color-term-muted)',
            fontFamily: 'inherit',
          },
        }}
      />
    </div>
  )
}

export default App
