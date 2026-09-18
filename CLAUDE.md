# hl-term — Hyperliquid web terminal: instant indicators + a Jev-driven paper bot

## What this is

A view-only, single-user web portal for reading Hyperliquid perp markets and running a
simulated auto-trading bot on top of it. Terminal aesthetic, keyboard-first. For the
selected coin/interval it shows live price data and a candle chart. No order execution
— trades happen elsewhere. Everything AI-driven here is paper: a local, hypothetical
position (entry/target/stop, live PnL against real price) for tracking a thesis — it
never places, signs, or touches a real order.

"Auto Mode" (off by default) is the whole feature: TypeSafe's Jev model returns a fast
typed buy/sell/hold judgment on the active coin's 1m closes, and a pure policy function
(`decideBotAction` in `lib/sim.ts`, no confidence gate by default — it acts on every
real decision, `hold` is itself the "don't trade" signal) turns that into open/close
calls against the paper-trading engine. Every decision is logged (the Jev call log) and
every close is booked to a realized-PnL ledger (trade history, session PnL). There is no
other AI provider in this app — no narrative LLM, no "AI read," no "/" ask mode; those
were removed. Jev (`/api/bot-decision`) is the only model call this app ever makes.

A trading **session** is just Auto Mode being on, under a name: explicit Start Session /
End Session buttons in `AiPanel` (`useConfigStore`'s `botEnabled` + `activeSession:
TradingSession | null`, both persisted — a reloaded tab resumes the same named session
rather than silently dropping it, and `useTradingBot`'s poll loop, and therefore every
Jev call, only ever runs while a session is active). The name defaults to the active
strategy's label at start time (the Session Settings dialog's Name field, blank =
default) but is otherwise just a user label — positions opened and ledger entries
booked while that session is active are tagged with its `id`/`name`
(`SimPosition`/`LedgerEntry`'s optional `sessionId`/`sessionName`, copied through
`closePosition` when a position closes) so `ActivityBar`'s Positions and Trade History
tabs can show which session produced each row. Ending a session opens a confirm dialog
(`components/ui/dialog.tsx`) that closes every open position at the best available
price (`resolveClosePrice`, `lib/closePosition.ts` — live price if on hand, else a
one-off Hyperliquid fetch, same fallback `ActivityBar`'s manual close already used)
before actually stopping the loop, booked to the ledger with reason `session_end`.

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
- Tiny Node backend (Hono) with two jobs only: `/api/bot-decision` (Jev, key stays
  server-side) and proxy Hyperliquid REST if the browser hits CORS trouble. Try
  direct browser calls to the info endpoint first; only add the proxy if actually
  needed.
- `@typesafe-ai/sdk` (TypeSafe's Jev model) is the only AI provider in this app —
  a typed `choice()` call (`/api/bot-decision`), not a narrative completion. Needs
  `TYPESAFE_API_KEY` in `server/.env`; optional at startup (the bot is opt-in and
  off by default), so a missing key just disables that one route with a clear
  error instead of blocking the server. There used to be a second, OpenAI-compatible
  narrative LLM provider (OpenRouter) behind `/api/read` and `/api/ask` — both
  routes, and the LLM provider entirely, were removed; Jev is the only model call
  this app makes now.
- WebSocket to Hyperliquid straight from the browser
- `vitest` for tests, indicators fully covered

## Architecture (keep these boundaries)

```
src/
  lib/hl/              # REST snapshot, WS candle subscription, candle buffer. No React.
  lib/indicators/      # Pure functions: candles/book in, numbers out. No I/O. Fully tested.
  lib/strategies/types.ts  # StrategyId + picker metadata only — see "Strategies" below
  lib/ai/bot.ts        # Client for /api/bot-decision (Jev) — the only AI call in the app
  lib/sim.ts           # Pure paper-position PnL/verdict/bot-policy helpers. No I/O. Tested.
  lib/closePosition.ts # resolveClosePrice: live price, else a one-off Hyperliquid fetch. I/O, not pure.
  lib/storage/         # IndexedDB: paper positions, realized-PnL ledger, Jev call log
  hooks/               # useCandles, useIndicators, useTradingBot, ...
  components/          # TopBar, ChartPanel, AiPanel, ActivityBar, CommandPalette, Watchlist
  App.tsx
server/
  index.ts             # Hono: /api/bot-decision dispatches to a strategy module, optional /api/hl proxy
  strategies/           # One module per strategy: its Jev question set + factor metadata
scripts/
  probe.ts             # tsx script: print candles + funding/OI for a coin, no UI
```

- `lib/hl` and `lib/indicators` must run in a plain `tsx` script with no DOM. That is
  what makes phases 0–2 testable before any UI exists.
- Indicators are pure and deterministic; test against hand-verified fixtures.
- The AI layer never computes indicators; it receives them.
- One store (zustand) holds: coin, interval, candle buffer, indicator dict, the
  paper-trading simulator's positions, the trading bot's latest decision per coin
  plus its running call log, and the realized-PnL ledger (trade history) with
  session-only and all-time PnL totals. Positions, the ledger, and the call log are
  each mirrored to IndexedDB (`lib/storage/`) and hydrated once on startup
  (`usePersisted*` hooks in `App.tsx`) so a page refresh doesn't drop them —
  `botStatus` (latest decision per coin) is the one exception, left to repopulate
  itself from the next poll instead.

## Indicator block (v1 scope)

Bias (EMA 9/21/55 stack), RSI 14, ATR 14 as % of price, volume vs 20-bar average,
nearest swing support/resistance with % distance, funding rate, OI + OI change over
lookback, one-word regime tag (trending / ranging / compressing). Computed by
`lib/indicators` on every tick; consumed by the bot-decision context and the
auto-trading bot's own stop-loss/take-profit calculation, not rendered as its own
panel (see "What this is").

## Strategies

Auto Mode runs one **strategy** at a time, picked from `AiPanel`'s Session Settings
dialog (gear icon in the header; persisted as `activeStrategy` in `useConfigStore`
alongside size/leverage — every option that isn't the live decision itself lives in
that one dialog, not scattered across the always-visible panel) and applied on the
next poll — switching
strategy while Auto Mode is on restarts `useTradingBot`'s poll loop for the new
strategy immediately, the same way switching coin already does. A strategy decides
two things: what extra data `useTradingBot` pulls from Hyperliquid beyond the base
candle indicators (always fetched — every strategy still anchors stop-loss/take-profit
to swing levels), and which Jev question set `server/strategies/<id>.ts` builds from
it. `lib/strategies/types.ts` is metadata only (`StrategyId`, label, description for
the picker) — the actual per-strategy fetch branch lives directly in
`useTradingBot.ts`; with just two strategies, a separate "gatherer" abstraction isn't
earning its keep yet.

- **`momentum`** (default): candle-derived indicators only (EMA 9/21/55 stack, RSI
  14, ATR%, volume ratio, swing support/resistance, regime tag) — unchanged from the
  original single-strategy bot.
- **`orderbook`**: live bid/ask depth from `l2Book`, reduced client-side to
  `computeOrderBookMetrics` (`lib/indicators/orderbook.ts`, pure, tested) —
  `imbalance` (bid vs. ask depth within ±0.5% of mid), `spreadPercent`, `depthRatio`
  (total window depth vs. top-of-book size). Still receives the base `indicators` too,
  for swing-level SL/TP anchoring and price-structure context.
- **`mtf-trend`**: Elder-style triple screen. A 4h RSI 14 + MACD(12,26,9) read
  (`computeTrendSnapshot`, `lib/indicators/trendSnapshot.ts`, pure, tested — built on
  the `rsi`/`macd` primitives, `macd.ts` alongside it) sets the major trend; a 15m
  read of the same shape sets the intermediate trend; the always-sent base 1m
  `indicators` only time *when* to enter/exit in whatever direction the two agree
  on — `server/strategies/mtfTrend.ts`'s `action` question is explicitly instructed
  to hold rather than trade when major/intermediate disagree, since that alignment
  rule is a judgment call across noisy timeframes, not a hard threshold that belongs
  in `decideBotAction`. `useTradingBot.ts` fetches the two extra candle series
  (`MTF_MAJOR_INTERVAL`/`MTF_INTERMEDIATE_INTERVAL`) every poll, same as the
  `orderbook` strategy re-fetches `l2Book` every poll — deliberately not cached
  across polls despite 4h/15m barely changing tick to tick.

Adding another strategy: add its id to `StrategyId` (`lib/strategies/types.ts`) and
`STRATEGIES` (both there and `server/index.ts`'s `STRATEGIES` map), a
`server/strategies/<id>.ts` exporting `buildQuestions()`, and — only if it needs data
beyond `indicators` — a branch in `useTradingBot.ts`'s fetch and a new optional field
on the request body (`lib/ai/bot.ts`'s `requestBotDecision`).

## Bot-decision contract (`/api/bot-decision`)

Input: `strategy` (`StrategyId`), symbol, the full base indicator dict (always sent —
see "Strategies"), `orderBook` (only meaningful for the `orderbook` strategy), and —
only if one exists — the currently held paper position on that coin (side, entry
price, live unrealized PnL). The route (`server/index.ts`) is a thin dispatcher: look
up `STRATEGIES[strategy]`, call its `buildQuestions()` for the Jev question set, run
one `systemOne` call, then shape the generic response below from `factorMeta`. Output:

- `scenario`: `"bull" | "bear" | "neutral"` — a ticker-level read on whether this
  coin is worth considering for a trade at all, independent of any specific action.
  Currently display-only (the AI panel's "Scenario" line and call log); it does not
  yet gate `action`. Same three-way choice across every strategy, worded to reference
  whatever that strategy actually looks at.
- `action`: `"buy" | "sell" | "hold"` — the trade action for the (currently single)
  open position on this coin. `decideBotAction` (`lib/sim.ts`) is the only place
  that turns `action` into an open/close call; keep policy (confidence gating,
  side-matching) there as plain code, not another model question — this is why
  `action`'s meaning stays identical across strategies even though the data behind
  it doesn't.
- `factors`: `{ key, label, kind, score, confidence }[]` — a per-parameter
  breakdown explaining *why*, one Jev `score()` question per data point the active
  strategy looks at. Which factors exist is strategy-defined (`factorMeta` in each
  `server/strategies/<id>.ts` module); `kind: 'directional'` means the score is
  0–4 (0 = strongly bearish, 4 = strongly bullish) and explains which way
  `scenario` leans, `kind: 'conviction'` means 0–2 (0 = low, 2 = high) and explains
  how much to trust the directional read — that data point doesn't have a
  direction of its own. The rubric wording (and each factor's `label`) lives only
  in the strategy module; the client (`AiPanel`'s `FactorRow`) renders whatever
  list comes back generically, picking `DIRECTIONAL_LABELS`/`CONVICTION_LABELS`
  by `kind` alone — every strategy's factors use one of these two fixed scales, so
  the client never needs per-strategy label tables.
- `riskWidth`: `{ score, confidence }`, a Jev `score()` question scored 0–2
  (0 = tight, 2 = wide) on how much room a stop-loss/take-profit should give the
  trade relative to the nearest swing support/resistance. Unlike `factors`, this
  is operational, not explanatory: `computeStopLossTakeProfit` (`lib/sim.ts`),
  called from `useTradingBot`, turns it into an ATR-scaled buffer added beyond
  the nearest swing level for both the stop and the target — 0 hugs the raw
  swing level, 2 pushes both a full ATR further away. When a side has no swing
  level to anchor to yet (`nearestSwingLevels` returned `null`), it falls back to
  a pure ATR-multiple distance from price (1x at tight .. 3x at wide) instead of
  leaving that level unset — every position always gets both a stop-loss and a
  take-profit (`SlTpLevels`'s fields are non-optional for exactly this reason).
  Entry price is never a Jev decision — it's just the live price at the moment
  the bot opens; asking a
  model to output a precise price number is a poor fit for these primitives
  (they're typed judgments over described criteria, not numeric regression), so
  price math stays in code and Jev only steers the risk-width input to it.
- `costUsd`/`durationMs`: not part of Jev's judgment — `server/index.ts` measures
  wall-clock time around the `systemOne` call and prices `usage.input_tokens`
  against Jev 1.13's published rate (`PRICE_PER_INPUT_MTOK_USD`, $0.042/Mtok —
  output tokens are free, so cost is input-only). Surfaced as two extra columns
  in the Jev call log (`ActivityBar`'s Log tab) so a session's Auto Mode cost and
  latency are visible without leaving the app.

No prose, no parsing needed — these are typed judgments, not a completion to
strict-parse. Every strategy's full question set (`scenario`, `action`,
`riskWidth`, plus its factors) is asked together in one `systemOne` call —
independent questions, same state — rather than as separate requests, per
TypeSafe's guidance on composing judgments. Because the question set is only
known at request time (the caller picks a strategy), the route reads back
`scenario`/`action`/`riskWidth`/each factor answer with a few narrow, deliberate
type casts rather than the fully-inferred per-key typing a single fixed question
set could have — see the comment in `server/index.ts`.

## Design direction (locked — do not re-invent per session)

Reference is a Bloomberg terminal, not a Matrix screensaver. Dense, calm, amber-keyed.

- Palette: `#0B0D10` background, `#14181D` panel, `#2A313A` hairline borders,
  `#E8B45A` amber for live data and emphasis, `#9AA4B2` muted labels,
  `#4ADE80` / `#F87171` strictly for long/short–up/down semantics, never decoration
  (this rules them out for TP/SL chart lines too — those are risk-boundary
  markers, not a direction signal), `#A78BFA` violet reserved for AI-generated
  accents (position verdicts, and — since Jev's `riskWidth` score sets its
  distance — the stop-loss chart line) so they read as distinct from live
  market data, `#7DD3FC` light blue for the chart's live/last-price line
  (`ChartPanel`'s `priceLineColor`; without it lightweight-charts defaults to
  the last candle's up/down color, which would fight the up/down reservation
  above) and nothing else. The take-profit chart line uses amber, same as
  everywhere else amber marks an emphasized live value.
- Type: JetBrains Mono everywhere. Data at `text-sm` with `tabular-nums`; labels
  uppercase `text-[11px] tracking-widest` muted. No display font, no hero anything.
- Layout: fixed viewport grid, no page scroll. Top bar / watchlist / (center chart +
  right AI panel) row / full-width tabbed activity bar / bottom status line.
  `ActivityBar` is deliberately its own wide bar below the chart+AI row, not
  squeezed into the narrow AI panel column — it tabs between Positions (default
  tab), Trade History, and the Jev call log rather than showing them all at once.
  Panels are hairline-bordered, near-flat (rounded-sm), no shadows, no gradients.
- Signature: the command palette. `:` or Cmd/Ctrl+K opens it (cmdk) for coin/interval
  jumps. Every action is reachable by keyboard; the mouse is optional. Number keys
  1–6 jump watchlist slots.
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
- The TypeSafe API key lives in `server/.env` only. It must never reach the client
  bundle.
- If a phase balloons, stop, split it in `ROADMAP.md`, and ask.