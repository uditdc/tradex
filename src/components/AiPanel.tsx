import { useAppStore } from '../store'

function Cursor() {
  return <span className="bg-term-amber ml-0.5 inline-block h-3 w-1.5 animate-pulse align-middle" />
}

function biasClass(bias: string): string {
  const lower = bias.toLowerCase()
  if (lower.includes('long')) return 'text-term-up'
  if (lower.includes('short')) return 'text-term-down'
  return 'text-term-muted'
}

export function AiPanel() {
  const coin = useAppStore((s) => s.coin)
  const interval = useAppStore((s) => s.interval)
  const aiReadCache = useAppStore((s) => s.aiReadCache)
  const askState = useAppStore((s) => s.askState)

  const read = aiReadCache[`${coin}:${interval}`] ?? null

  return (
    <div className="border-term-border bg-term-panel flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l p-3">
      {askState && (
        <div className="border-term-border flex flex-col gap-1 border-b pb-3">
          <span className="text-term-muted text-[11px] tracking-widest uppercase">Ask</span>
          <p className="text-term-amber text-sm">{askState.question}</p>
          {askState.status === 'error' ? (
            <p className="text-term-down text-sm">{askState.error}</p>
          ) : (
            <p className="text-term-muted text-sm whitespace-pre-wrap">
              {askState.text}
              {askState.status === 'streaming' && <Cursor />}
            </p>
          )}
        </div>
      )}

      <span className="text-term-muted text-[11px] tracking-widest uppercase">AI Read</span>

      {!read && <p className="text-term-muted text-sm">Waiting for enough candles...</p>}

      {read && read.status === 'streaming' && !read.parsed && (
        <p className="text-term-muted text-sm whitespace-pre-wrap">
          {read.text || 'Thinking...'}
          <Cursor />
        </p>
      )}

      {read && read.status === 'error' && <p className="text-term-down text-sm">{read.error}</p>}

      {read && read.status === 'done' && !read.parsed && (
        <div className="flex flex-col gap-1">
          <p className="text-term-down text-xs">{read.error}</p>
          <p className="text-term-muted text-sm whitespace-pre-wrap">{read.text}</p>
        </div>
      )}

      {read?.parsed && (
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-baseline justify-between">
            <span className={`font-semibold uppercase ${biasClass(read.parsed.bias)}`}>{read.parsed.bias}</span>
            <span className="text-term-amber tabular-nums">{Math.round(read.parsed.confidence * 100)}%</span>
          </div>

          <p className="text-term-muted">{read.parsed.rationale}</p>

          {read.parsed.key_levels.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-term-muted text-[11px] tracking-widest uppercase">Key Levels</span>
              {read.parsed.key_levels.map((lvl, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2">
                  <span className="text-term-muted truncate text-xs">
                    {lvl.kind}
                    {lvl.note ? ` — ${lvl.note}` : ''}
                  </span>
                  <span className="text-term-amber shrink-0 tabular-nums">{lvl.price}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-term-muted text-[11px] tracking-widest uppercase">Invalidation</span>
            <p className="text-term-muted">{read.parsed.invalidation}</p>
          </div>
        </div>
      )}
    </div>
  )
}
