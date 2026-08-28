# hl-term — Hyperliquid web terminal: instant indicators + AI reads

## What this is

A view-only, single-user web portal for reading Hyperliquid perp markets. Terminal
aesthetic, keyboard-first. For the selected coin/interval it shows live price data, a
deterministic indicator block that updates on every tick, a small candle chart, and an
AI "read" that refreshes on candle close or on demand. No order execution — trades
happen elsewhere.

## Non-goals (do not build these)

- Order placement, wallet connection, signing, keys of any kind in the browser
- Auth, multi-user anything, databases
- Backtesting or strategy tooling
- Server-side rendering; this is a local tool, not a deployed product

## Stack

- Vite + React + TypeScript
- Tailwind + shadcn/ui (Command/cmdk for the command palette, Card, Badge, Table,
  Skeleton, Sonner for toasts)
- `lightweight-charts` for the candle panel
- Tiny Node backend (Hono) with two jobs only: stream Anthropic API responses
  (`/api/read`, `/api/ask`) so the key stays server-side, and proxy Hyperliquid REST
  if the browser hits CORS trouble. Try direct browser calls to the info endpoint
  first; only add the proxy if actually needed.
- WebSocket to Hyperliquid straight from the browser
- `vitest` for tests, indicators fully covered

## Architecture (keep these boundaries)

```
src/
  lib/hl/          # REST snapshot, WS candle subscription, candle buffer. No React.
  lib/indicators/  # Pure functions: candles in, numbers out. No I/O. Fully tested.
  lib/ai/          # Context payload builder + client for /api/read, /api/ask
  hooks/           # useCandles(coin, interval), useIndicators(), useAiRead()
  components/      # TopBar, IndicatorBlock, ChartPanel, AiPanel, CommandPalette, Watchlist
  App.tsx
server/
  index.ts         # Hono: /api/read, /api/ask (SSE streaming), optional /api/hl proxy
scripts/
  probe.ts         # tsx script: print candles + funding/OI for a coin, no UI
```

- `lib/hl` and `lib/indicators` must run in a plain `tsx` script with no DOM. That is
  what makes phases 0–2 testable before any UI exists.
- Indicators are pure and deterministic; test against hand-verified fixtures.
- The AI layer never computes indicators; it receives them.
- One store (zustand) holds: coin, interval, candle buffer, indicator dict, AI read
  cache keyed by `${coin}:${interval}`.

## Indicator block (v1 scope)

Bias (EMA 9/21/55 stack), RSI 14, ATR 14 as % of price, volume vs 20-bar average,
nearest swing support/resistance with % distance, funding rate, OI + OI change over
lookback, one-word regime tag (trending / ranging / compressing).

## AI read contract

Input: symbol, interval, last N candles (config, default 200), indicator dict, funding,
OI, top-5 book levels. Output: strict JSON — `bias`, `key_levels` [{price, kind, note}],
`invalidation`, `confidence` (0–1), `rationale` (≤3 sentences). Parse strictly; on
failure show raw text in the panel and log it. `key_levels` get drawn on the chart as
price lines.

## Design direction (locked — do not re-invent per session)

Reference is a Bloomberg terminal, not a Matrix screensaver. Dense, calm, amber-keyed.

- Palette: `#0B0D10` background, `#14181D` panel, `#2A313A` hairline borders,
  `#E8B45A` amber for live data and emphasis, `#9AA4B2` muted labels,
  `#4ADE80` / `#F87171` strictly for long/short–up/down semantics, never decoration.
- Type: JetBrains Mono everywhere. Data at `text-sm` with `tabular-nums`; labels
  uppercase `text-[11px] tracking-widest` muted. No display font, no hero anything.
- Layout: fixed viewport grid, no page scroll. Top bar / left indicator column /
  center chart / right AI panel / bottom status line. Panels are hairline-bordered,
  near-flat (rounded-sm), no shadows, no gradients.
- Signature: the command palette. `:` opens it (cmdk) for coin/interval/actions,
  `/` opens it in ask-the-AI mode. Every action is reachable by keyboard; the mouse
  is optional. Number keys 1–6 jump watchlist slots.
- Motion: value-change flashes (amber tick, brief green/red on delta) and streaming
  text in the AI panel. Nothing else animates. Respect reduced motion.
- shadcn components get restyled to these tokens in `index.css` theme variables once,
  in phase 3; per-component style overrides after that are a smell.

## Working conventions for Claude Code sessions

- One phase per session. Read `ROADMAP.md`, find the first unchecked phase, do only that.
- Before writing code, list the files you'll touch and the tests you'll add.
- Every phase ends with: `vitest` green, typecheck clean, `ROADMAP.md` box ticked plus a
  two-line note on what actually got built and anything surprising.
- Never invent Hyperliquid API fields — fetch a real response and inspect it.
- The Anthropic key lives in `server/.env` only. It must never reach the client bundle.
- If a phase balloons, stop, split it in `ROADMAP.md`, and ask.