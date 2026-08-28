import { AiPanel } from './components/AiPanel'
import { ChartPanel } from './components/ChartPanel'
import { CommandPalette } from './components/CommandPalette'
import { StatusLine } from './components/StatusLine'
import { TopBar } from './components/TopBar'
import { Watchlist } from './components/Watchlist'
import { useAiRead } from './hooks/useAiRead'
import { useCandles } from './hooks/useCandles'
import { useWatchlist } from './hooks/useWatchlist'
import { useAppStore } from './store'

function App() {
  const coin = useAppStore((s) => s.coin)
  const interval = useAppStore((s) => s.interval)
  useCandles(coin, interval)
  useAiRead()
  useWatchlist()

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
    </div>
  )
}

export default App
