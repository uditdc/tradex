# hl-term — Hyperliquid web terminal: instant indicators + a Jev-driven paper bot

## What this is

A view-only, single-user web portal for reading Hyperliquid perp markets and running a
simulated auto-trading bot on top of it. Terminal aesthetic, keyboard-first. For the
selected coin/interval it shows live price data and a candle chart. No order execution
— trades happen elsewhere. Everything AI-driven here is paper: a local, hypothetical
position (entry/target/stop, live PnL against real price) for tracking a thesis — it
never places, signs, or touches a real order.

"Auto Mode" (off by default) is the core feature: TypeSafe's Jev model returns a fast
typed buy/sell/hold judgment on the active coin's 1m closes, and a pure policy function
(`decideBotAction` in `lib/sim.ts`, no confidence gate by default — it acts on every
real decision, `hold` is itself the "don't trade" signal) turns that into open/close
calls against the paper-trading engine. Every decision is logged (the Jev call log) and
every close is booked to a realized-PnL ledger (trade history, session PnL). A manual
"/" ask-the-AI mode (a normal narrative LLM completion, not Jev) is still available for
free-form questions about the current market — there is no automatic narrative "AI
read" anymore; that feature was removed in favor of the bot.

Indicators (bias, RSI, ATR%, volume ratio, swing support/resistance, regime — see
"Indicator block (v1 scope)") are still computed deterministically every tick; there is
no dedicated visual panel for them (dropped in Phase 6 to match the imported design),
but they still drive the bot-decision context and the auto-opened positions'
stop-loss/take-profit (nearest swing support/resistance).

## Non-goals (do not build these)

- Order placement, wallet connection, signing, keys of any kind in the browser —
  the paper-trading simulator is exempt only because it is pure local state with no
  real order ever sent; it must never grow a real execution path
- Auth, multi-user anything, server-side databases — client-side IndexedDB for local
  positions/trade history (`lib/storage`) is not this; it never leaves the browser and
  has no server or multi-user component
- Backtesting or strategy tooling
- Server-side rendering; this is a local tool, not a deployed product

## Stack

- Vite + React + TypeScript
- Tailwind + shadcn/ui (Command/cmdk for the command palette, Card, Badge, Table,
  Skeleton, Sonner for toasts)
- `lightweight-charts` for the candle panel
- Tiny Node backend (Hono) with a few jobs only: complete `/api/ask` (narrative LLM,
  key stays server-side), `/api/bot-decision` (Jev), and proxy Hyperliquid REST if
  the browser hits CORS trouble. Try direct browser calls to the info endpoint
  first; only add the proxy if actually needed.
- LLM provider is OpenAI-compatible (currently OpenRouter — see `server/.env`'s
  `LLM_API_KEY`/`LLM_BASE_URL`/`LLM_MODEL`), not Anthropic-specific. Swapping models
  or providers later is a `server/.env` change, not a code change, as long as the
  provider speaks the OpenAI chat-completions shape (OpenRouter does, for any model
  it hosts, Anthropic's included). Only `/api/ask` uses it now.
- `@typesafe-ai/sdk` (TypeSafe's Jev model) is a second, separate AI provider used
  only for the trading bot's fast buy/sell/hold judgment (`/api/bot-decision`) — a
  typed `choice()` call, not a narrative completion. Needs its own
  `TYPESAFE_API_KEY` in `server/.env`; unlike `LLM_API_KEY` this one is optional at
  startup (the bot is opt-in and off by default), so a missing key just disables
  that one route with a clear error instead of blocking the server.
- WebSocket to Hyperliquid straight from the browser
- `vitest` for tests, indicators fully covered

## Architecture (keep these boundaries)

```
src/
  lib/hl/          # REST snapshot, WS candle subscription, candle buffer. No React.
  lib/indicators/  # Pure functions: candles in, numbers out. No I/O. Fully tested.
  lib/ai/          # Context/client for /api/ask; bot.ts client for /api/bot-decision
  lib/sim.ts       # Pure paper-position PnL/verdict/bot-policy helpers. No I/O. Tested.
  lib/storage/     # IndexedDB: paper positions, realized-PnL ledger (trade history)
  hooks/           # useCandles, useIndicators, useAsk, useTradingBot, ...
  components/      # TopBar, ChartPanel, AiPanel, PositionsBar, CommandPalette, Watchlist
  App.tsx
server/
  index.ts         # Hono: /api/ask (LLM), /api/bot-decision (TypeSafe), optional
                    # /api/hl proxy
scripts/
  probe.ts         # tsx script: print candles + funding/OI for a coin, no UI
```

- `lib/hl` and `lib/indicators` must run in a plain `tsx` script with no DOM. That is
  what makes phases 0–2 testable before any UI exists.
- Indicators are pure and deterministic; test against hand-verified fixtures.
- The AI layer never computes indicators; it receives them.
- One store (zustand) holds: coin, interval, candle buffer, indicator dict, the
  paper-trading simulator's positions, the trading bot's latest decision per coin
  plus its running call log, and the realized-PnL ledger (trade history) with
  session-only and all-time PnL totals.

## Indicator block (v1 scope)

Bias (EMA 9/21/55 stack), RSI 14, ATR 14 as % of price, volume vs 20-bar average,
nearest swing support/resistance with % distance, funding rate, OI + OI change over
lookback, one-word regime tag (trending / ranging / compressing). Computed by
`lib/indicators` on every tick; consumed by the bot-decision context and the
auto-trading bot's own stop-loss/take-profit calculation, not rendered as its own
panel (see "What this is").

## Bot-decision contract (`/api/bot-decision`)

Input: symbol, the full indicator dict, and — only if one exists — the currently held
paper position on that coin (side, entry price, live unrealized PnL). Output: a single
Jev `choice()` judgment — `decision` (`"buy" | "sell" | "hold"`), `confidence` (0–1),
`probabilities` (per-option distribution). No prose, no parsing needed — this is a
typed judgment, not a completion to strict-parse. `decideBotAction` (`lib/sim.ts`) is
the only place that turns it into an open/close call; keep policy (confidence
gating, side-matching) there as plain code, not another model question.

## Ask contract (`/api/ask`)

Manual, user-initiated only (the "/" palette). Input: symbol, interval, last N candles
(config, default 200), indicator dict, funding, OI, top-5 book levels, plus the user's
question. Output: plain text, no JSON contract — shown as-is in the Ask panel.

## Design direction (locked — do not re-invent per session)

Reference is a Bloomberg terminal, not a Matrix screensaver. Dense, calm, amber-keyed.

- Palette: `#0B0D10` background, `#14181D` panel, `#2A313A` hairline borders,
  `#E8B45A` amber for live data and emphasis, `#9AA4B2` muted labels,
  `#4ADE80` / `#F87171` strictly for long/short–up/down semantics, never decoration,
  `#A78BFA` violet reserved for AI-generated accents (position verdicts) so they
  read as distinct from live market data.
- Type: JetBrains Mono everywhere. Data at `text-sm` with `tabular-nums`; labels
  uppercase `text-[11px] tracking-widest` muted. No display font, no hero anything.
- Layout: fixed viewport grid, no page scroll. Top bar / watchlist / (center chart +
  right AI panel) row / full-width positions+trade-history bar / bottom status
  line. Positions and trade history are deliberately their own wide bar below the
  chart+AI row, not squeezed into the narrow AI panel column. Panels are
  hairline-bordered, near-flat (rounded-sm), no shadows, no gradients.
- Signature: the command palette. `:` or Cmd/Ctrl+K opens it (cmdk) for coin/interval
  jumps, `/` opens it in ask-the-AI mode. Every action is reachable by keyboard; the
  mouse is optional. Number keys 1–6 jump watchlist slots.
- Motion: value-change flashes (amber tick, brief green/red on delta). Nothing else
  animates. Respect reduced motion.
- shadcn components get restyled to these tokens in `index.css` theme variables once,
  in phase 3; per-component style overrides after that are a smell.

## Working conventions for Claude Code sessions

- One phase per session. Read `ROADMAP.md`, find the first unchecked phase, do only that.
- Before writing code, list the files you'll touch and the tests you'll add.
- Every phase ends with: `vitest` green, typecheck clean, `ROADMAP.md` box ticked plus a
  two-line note on what actually got built and anything surprising.
- Never invent Hyperliquid API fields — fetch a real response and inspect it.
- The LLM and TypeSafe API keys live in `server/.env` only. They must never reach the
  client bundle.
- If a phase balloons, stop, split it in `ROADMAP.md`, and ask.