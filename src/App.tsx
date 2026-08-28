import { AiPanel } from './components/AiPanel'
import { ChartPanel } from './components/ChartPanel'
import { CommandPalette } from './components/CommandPalette'
import { IndicatorBlock } from './components/IndicatorBlock'
import { StatusLine } from './components/StatusLine'
import { TopBar } from './components/TopBar'
import { useAiRead } from './hooks/useAiRead'
import { useCandles } from './hooks/useCandles'
import { useAppStore } from './store'

function App() {
  const coin = useAppStore((s) => s.coin)
  const interval = useAppStore((s) => s.interval)
  useCandles(coin, interval)
  useAiRead()

  return (
    <div className="bg-term-bg flex h-screen w-screen flex-col overflow-hidden">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <IndicatorBlock />
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
