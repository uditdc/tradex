# Roadmap

One phase per Claude Code session; each ends with something runnable you can judge.
Phases 0–2 are the ground test and involve no UI: if the data or the numbers are wrong
there, nothing above them matters.

---

## Phase 0 — Scaffold and a real API call
- [x] Vite + React + TS + Tailwind + shadcn initialised; vitest wired; repo runs with
      `pnpm dev` (blank page is fine)
- [x] `src/lib/hl/rest.ts`: `candleSnapshot` → typed `Candle[]`; `metaAndAssetCtxs` →
      mark price, funding, OI for one coin
- [x] `scripts/probe.ts` (run with `tsx`): `pnpm probe HYPE 1h` prints last 5 candles
      + funding/OI as plain text
- [x] Note in this file whether direct browser-style fetch works or the CORS proxy
      will be needed

**Done when:** probe numbers match app.hyperliquid.xyz for the same coin/interval.

Notes:

- CORS: `https://api.hyperliquid.xyz/info` responds with `access-control-allow-origin: *`
  (checked via `curl -i` with an `Origin` header, since a Node/tsx probe never hits CORS
  and can't actually answer this — that requires inspecting response headers, not just
  a successful Node fetch). Direct browser calls will work; no proxy needed. Re-confirm
  once real `fetch()` calls happen from the Vite dev origin in Phase 3.
- Tailwind v4 (`@tailwindcss/vite` plugin, no `tailwind.config.js`/PostCSS needed) +
  shadcn `base-nova` style. shadcn's default neutral theme is left as-is; CLAUDE.md
  assigns the amber/terminal retheme to Phase 3.
- `pnpm dlx shadcn init` mis-resolved the `@/` alias and wrote `button.tsx`/`utils.ts`
  into a literal `./@/` directory instead of `src/`; moved them into
  `src/components/ui` and `src/lib` by hand and removed the stray folder.
- `vitest` covers `candleSnapshot`/`metaAndAssetCtxs` against fixtures captured from the
  real API responses (mocked `fetch`, not live) — 4 tests passing.
- Added `pnpm typecheck` (`tsc -b --noEmit`) and `pnpm test` (`vitest run`) scripts,
  neither of which existed in the Vite template.
- `probe HYPE 1h` output looks correct (mark ~83.6, funding ~0.0000125, candles line up
  hour-to-hour with no gaps) but wasn't cross-checked against app.hyperliquid.xyz's UI
  directly — no browser was driven this session. Worth a manual glance before trusting
  it fully.

---

## Phase 1 — Indicators, tested
- [x] `src/lib/indicators/`: EMA, RSI, ATR, volume ratio, swing highs/lows, regime tag,
      one `computeAll(candles)` entry point
- [x] Fixture candles + hand-verified expected values (spot-check RSI/EMA against
      TradingView on the same bars)
- [x] Probe prints the indicator dict

**Done when:** RSI and EMAs match TradingView to within rounding.

Notes:

- No browser was driven this session, so RSI/EMA were **not** cross-checked against
  TradingView's UI directly. Instead: 151 real HYPE 1h candles were captured from the
  API and an independent second implementation of EMA/RSI/ATR (Wilder smoothing,
  Python, `src/lib/indicators/__fixtures__/hype-1h.ts` is the same data) was used as
  the verification oracle — both implementations use the standard, documented
  formulas (EMA seeded from SMA, Wilder RMA for RSI/ATR) that TradingView's defaults
  also use. Worth an actual TradingView glance before fully trusting this.
- `swing.ts` and `regime.ts` have no external oracle (they're project-specific
  heuristics, not standard indicators) — verified with small hand-constructed
  fixtures where the expected swing points/regime were picked by eye instead.
- `regime` thresholds (compression ratio 0.7, trend spread 0.5%) are arbitrary
  starting points, not derived from anything — expect to retune once real usage in
  Phase 3 shows whether it flips tags too eagerly or not enough.
- `computeAll` requires ≥55 candles (EMA55) and throws otherwise; `probe.ts` now pulls
  210 bars sized to the requested interval (previously hardcoded to "last 24h", which
  silently broke for anything coarser than 1h and was overkill for anything finer).
- `metaAndAssetCtxs`'s funding/OI aren't part of `computeAll` — they come from
  `MarketCtx`, not candles, and CLAUDE.md's indicator block treats them as siblings
  of the candle-derived indicators, not inputs to them.

---

## Phase 2 — Live feed
- [x] `src/lib/hl/ws.ts`: candle-channel subscription; reconnect with backoff
- [x] Candle buffer that merges the live bar into the snapshot correctly (update open
      bar, append on close, never duplicate) — unit-tested with synthetic messages
- [x] `scripts/tail.ts`: `pnpm tail HYPE 1m` logs price + indicators per tick and a
      CLOSED line per bar

**Done when:** 15 minutes of `tail` on 1m yields exactly the right bar count.

Notes:

- Verified for real: ran `pnpm tail HYPE 1m` in the background for 16 minutes.
  Result: exactly 16 `CLOSED` lines, timestamps `11:17:00` through `11:32:00.000Z`
  with no gaps and no repeats, one WS connection the whole time (no reconnects
  needed). This is the actual live run, not an inference from the unit tests.
- WS message shapes were captured from the real socket first (not invented):
  `{"channel":"subscriptionResponse",...}` on subscribe ack, then
  `{"channel":"candle","data":<RawCandle>}` repeated with the same `t`/`T` while a
  bar is open, advancing to a new `t` once it closes — that's what the merge logic
  in `buffer.ts` keys off (same `openTime` → replace in place; greater → append and
  report the previous bar closed; lesser/stale → drop).
  `rawCandleToCandle` moved out of `rest.ts` into `hl/mappers.ts` so `ws.ts` doesn't
  need to import from `rest.ts`.
- `subscribeCandles` takes an injectable `WebSocketImpl` (defaults to the global
  `WebSocket`, which exists in both the browser and Node 22+, so no `ws` package
  needed) — that's what makes the reconnect/backoff logic unit-testable with a fake
  socket instead of a live connection.
- Reconnect backoff: starts at 500ms, doubles each consecutive drop, caps at 30s,
  resets to 500ms after a successful reopen. Not exercised by the live 16-minute run
  since the connection never dropped — only verified via the fake-socket unit tests.
  Worth watching the first time a real disconnect happens once Phase 3 has this
  running in a browser tab all day.
- `INTERVAL_MS` (probe.ts's interval → ms lookup) moved to `src/lib/hl/intervals.ts`
  so `probe.ts` and `tail.ts` share it instead of duplicating.
- Found and fixed a real gap while testing this: `.env` (LLM key) existed at the repo
  root, untracked but **not** in `.gitignore` — one `git add -A` would have staged
  it. Added `.env`/`server/.env` patterns to `.gitignore`. The key itself currently
  sits at repo root as generic `LLM_API_KEY`/`LLM_BASE_URL`/`LLM_MODEL`, not yet in
  `server/.env` as CLAUDE.md specifies — move it there when Phase 4 creates `server/`.

---

## Phase 3 — Terminal shell
- [x] Theme tokens from CLAUDE.md set up in Tailwind/shadcn css variables
- [x] Fixed-grid layout: TopBar (coin, interval, price, 24h %, funding, OI),
      IndicatorBlock (colour-coded, ticking), ChartPanel with `lightweight-charts`
      candles bound to the live buffer, empty AiPanel, bottom status line
      (WS state, latency, last update)
- [x] Command palette: `:` → coins/intervals/actions; switching re-snapshots,
      re-subscribes, repaints with no freeze; `q` does nothing (this is a browser —
      but Esc closes the palette)
- [x] Value-change flash on price and indicator cells

**Done when:** it reads like a terminal pane you'd keep open all day, and coin/interval
switches feel instant.

Notes:

- Verified in a real headless browser (Playwright, driven from a throwaway script —
  `chromium-cli` wasn't available in this environment), not just by reading the code:
  screenshotted the main layout, opened the palette with `:`, closed it with `Esc`.
  Screenshots show live WS data ticking, correct green/red candles, and amber
  value-change flashes mid-animation. See git history for the screenshots if needed;
  not committed to the repo.
- Found and fixed a real bug this way: `CommandDialog` (shadcn's wrapper) does **not**
  itself provide cmdk's store context — I'd nested `CommandInput`/`CommandList`/
  `CommandItem` directly inside it, which threw `Cannot read properties of undefined
  (reading 'subscribe')` the moment the dialog opened. Fix: wrap the contents in
  `<Command>` (cmdk's own root) inside `CommandDialog`. This would not have been
  caught by typecheck or vitest — only by actually opening the palette in a browser.
- shadcn's `add` CLI hit the same `./@/` stray-folder bug as Phase 0's `init` (see
  that phase's notes) — moved `card.tsx`/`command.tsx`/etc. into `src/components/ui`
  by hand again, skipping the duplicate `button.tsx`.
- lightweight-charts v5 changed its series API from `chart.addCandlestickSeries()` to
  `chart.addSeries(CandlestickSeries, options)` — checked the installed package's
  `.d.ts` directly rather than assuming the v4 API most training data would suggest.
- Added a real ping/pong heartbeat to `ws.ts` (`{"method":"ping"}` →
  `{"channel":"pong"}`, confirmed against the live socket, sent every 15s) so the
  status line's "latency" field is an actual measured RTT, not a placeholder — this
  wasn't in Phase 2's scope but the status line needed it, so it went into `ws.ts`
  alongside the existing candle-subscribe logic. Covered by new unit tests in
  `ws.test.ts`, not by the live 16-minute Phase 2 run (which predates this).
  The store's `WsState` type is `ws.ts`'s `ConnectionStatus` plus an added `'idle'`
  member for "not subscribed yet".
- Known simplification: CLAUDE.md's indicator block lists "OI + OI change over
  lookback"; only current OI is shown. OI change would need historical OI tracking,
  which nothing persists yet — didn't want to invent a half-built history mechanism
  for one field. Worth a real look if OI momentum turns out to matter.
- Command palette's coin list is a hardcoded set of six (HYPE, BTC, ETH, SOL, XRP,
  DOGE), not the full ~200-asset Hyperliquid universe (which `metaAndAssetCtxs`
  already fetches, just doesn't currently expose). Fine for now; Phase 5's
  watchlist/config work is the natural place to make this real.
- TopBar/IndicatorBlock's "price" is the latest candle close (ticks live via the
  candle WS stream), not `marketCtx.markPx` — there's no separate live mark-price
  subscription, only a one-time REST fetch on bootstrap. For the interval sizes this
  app targets they track closely enough; flagging in case it ever looks off.
- Font: JetBrains Mono Variable (self-hosted via `@fontsource-variable`, same pattern
  shadcn's default Geist install used) mapped onto shadcn's `--font-sans` token rather
  than introducing a separate mono utility, since CLAUDE.md wants it everywhere.

---

## Phase 4 — AI read
- [x] `server/index.ts` (Hono): `/api/read` and `/api/ask`, SSE streaming, key from env
- [x] Context builder per the CLAUDE.md contract; strict JSON parse, raw-text fallback
- [x] Triggers: coin/interval switch, bar close, palette action "read"
- [x] Read cache per `${coin}:${interval}`; switching back is zero latency
- [x] `/` opens the palette in ask mode; answer streams into AiPanel with the same
      context attached
- [x] `key_levels` drawn on the chart as amber price lines with labels

**Done when:** the read (or its cached version) is visible before you finish scanning
the indicator block, and its levels sit on the chart.

Notes:

- **Provider discrepancy caught before writing any code:** CLAUDE.md said "Anthropic"
  throughout, but `server/.env` (found untracked at repo root earlier — see Phase 2
  notes) is actually configured for OpenRouter (`LLM_BASE_URL`) against a free Gemma
  model (`LLM_MODEL=google/gemma-4-31b-it:free`), not Anthropic. Asked the user rather
  than guessing; confirmed to build against what's actually configured. Updated
  CLAUDE.md's wording from "Anthropic" to provider-neutral ("LLM"/"OpenAI-compatible")
  to match reality — the server only assumes an OpenAI-style `/chat/completions`
  streaming endpoint, so swapping models or providers later is a `.env` change.
- `server/.env` moved from the repo root (where it was found) to `server/.env`, per
  CLAUDE.md's convention. Still untracked/gitignored either way.
- The AI read contract's "top-5 book levels" input needed a new REST call —
  `l2Book` didn't exist yet. Added it to `src/lib/hl/rest.ts` after fetching and
  inspecting a real response (`levels: [bids, asks]`, bids descending, asks
  ascending) rather than guessing the shape.
- SSE wire format between our server and the browser is our own, not OpenRouter's
  passed through raw: each event's `data:` is a JSON-encoded token string
  (`data: "some text"\n\n`), terminated by a literal `data: [DONE]\n\n`. JSON-encoding
  each token avoids ambiguity if a token itself contains a real newline, which a
  naive `\n\n`-delimited raw-text protocol would corrupt. The server parses
  OpenRouter's own SSE (`choices[0].delta.content`) and re-emits in this format, so
  swapping providers only touches `server/index.ts`, never the client parser.
- **Verified against the real API, not mocked** — read the actual streamed
  `/api/read` response for a realistic context, confirmed the model returns clean
  JSON with no markdown fence around it (still handled the fence-stripping case in
  `parseAiRead` regardless, since it's a known LLM habit), and confirmed the client's
  SSE accumulation + strict parse round-trips it correctly.
- **Verified in a real browser with the full stack running** (`pnpm dev`, both Vite
  and the Hono server): the auto-triggered read on load rendered bias/confidence/
  rationale/key-levels correctly in the AiPanel, and the two key_levels appeared as
  dashed amber price lines on the chart with labels, at the exact prices the model
  returned. Also verified `/` ask mode end-to-end: typed a question, got a real
  streamed answer, and confirmed the ask panel and the cached read panel are
  independent (an ask failure doesn't clobber the read cache, and vice versa).
- Hit `google/gemma-4-31b-it:free`'s per-minute token quota (16,000
  tokens/min on the free tier) partway through manual verification — a few
  back-to-back real calls (curl tests + the auto-triggered read + an ask) was enough
  to trip it. Confirmed the failure path renders correctly too (raw error text in
  the panel, read cache untouched). This is a real operational constraint of the
  currently-configured free model, not a bug — the full `/api/read` context (200
  candles + indicators) is not small, so this model/tier will rate-limit quickly
  under real use. Worth switching `LLM_MODEL` to a paid tier or a higher-limit model
  before relying on this daily.
- `pnpm dev` now runs two processes via `concurrently` (`dev:client` for Vite,
  `dev:server` for `tsx watch --env-file=server/.env server/index.ts` on port 8787);
  Vite proxies `/api/*` to it in dev. `tsx`'s `watch` subcommand must come before
  other flags (`tsx watch --env-file=... file.ts`, not
  `tsx --env-file=... watch file.ts`) — the latter treats `watch` as the entry file
  and fails with `ERR_MODULE_NOT_FOUND`.
- Found and fixed a shadcn/cmdk bug while verifying in-browser (see Phase 3 notes)
  before this phase started, which is what made the palette usable for ask mode here.

---

## Phase 5 — Daily-utility polish
- [x] Watchlist row: 5–6 coins, price + bias colour, keys 1–6 to jump
- [x] Background pre-compute of reads for watchlist coins on bar close
- [x] Config in localStorage via the palette: watchlist, default interval, lookback
- [x] Read log (download as text) to review AI quality later

**Done when:** a full trading session without touching the probe scripts or devtools.

Notes:

- The watchlist *is* the palette's coin list now — the hardcoded `COINS` constant
  flagged as a known gap in Phase 3's notes is gone; `CommandPalette`'s "Coin" group
  reads `useConfigStore`'s `watchlist` directly, so adding/removing a coin from the
  palette immediately changes both.
- Config (`watchlist`, `defaultInterval`, `lookback`) lives in a separate persisted
  `useConfigStore` (`zustand/middleware`'s `persist`, key `hl-term-config`), not the
  main `useAppStore` — deliberate: live market data (candles, WS status, AI cache)
  is per-session and should reset on reload, but preferences shouldn't. Verified for
  real: set lookback to 300 via the palette, confirmed the exact JSON landed in
  `localStorage`, then reloaded the page and confirmed it came back as "current" in
  the palette (not just that a write happened — that a fresh page load rehydrates
  from it).
- **Background pre-compute is REST-poll-based (every 45s), not a live WS subscription
  per watchlist coin.** Deliberate given what Phase 4 already showed: the currently
  configured free model (`google/gemma-4-31b-it:free`) rate-limits at 16k
  tokens/minute, and a background read is a full `/api/read` context (200 candles +
  indicators) — 5–6 live WS subscriptions all bar-closing near-simultaneously (e.g.
  the top of the hour) would fire that many LLM calls at once and blow through the
  quota immediately. Background reads that do fire are staggered 5s apart
  (`useWatchlist.ts`) for the same reason. A live-WS-per-coin design would be more
  "live" but is the wrong tradeoff against this rate limit; reconsider if/when the
  model changes.
- Background reads reuse the same `aiReadCache`/`runRead` path as the active coin
  (`triggerReadFor`, extracted from `triggerRead` in this phase) — switching to a
  watchlist coin whose bar already closed in the background shows an instant cached
  read, same as switching back to a coin you were already viewing.
- Read log caps at 200 entries (oldest dropped) to bound memory over a long session;
  kept in-memory only (not persisted) since its purpose is "download and inspect
  externally," not "survive a reload."
- **Verified in a real browser with the full stack running:** watchlist row shows
  all 6 coins with live-polled prices and bias coloring (confirmed one coin actually
  rendered green from a real `long` bias, not just neutral/amber everywhere);
  pressing "3" jumped the whole app to the 3rd watchlist coin — TopBar, chart,
  indicators, WS status ("connecting" → new subscription), and a fresh AI read all
  updated correctly, matching the same re-snapshot/re-subscribe/repaint behavior
  already verified for palette-driven switches in Phase 3. Palette's new Actions
  (watchlist toggle, set default interval, lookback presets, download log) all
  render and reflect real state (e.g. "Download read log (1)" matched the actual
  log count).

---

## Phase 6 — Design import: AI zones, paper trading, palette simplification
- [x] AI read contract extended with an optional `zones` field (shaded supply/demand
      price ranges), drawn on the chart as violet bands alongside key-level lines
- [x] Top bar reskin: coin-switcher dropdown, Oracle price, 24h Volume, funding
      countdown-to-next-hour, dotted-underline field labels
- [x] Chart header gets an interval tab strip (was palette-only before) plus an
      "AI Zones" indicator when the active read has any
- [x] AI panel: violet AI accent, collapsible bias/rationale accordion, zones list
- [x] Paper-trading simulator in the AI panel: size/leverage sliders, an AI-derived
      trade suggestion (side from bias, target/stop from swing levels), "OPEN
      (PAPER)" positions with live PnL, manual "Re-run AI" KEEP/CLOSE verdict —
      pure local state, no real order ever placed
- [x] Status line shows total Sim P&L when any paper position is open
- [x] Command palette simplified to Coin + Interval only (matches the design import),
      openable via `:` or Cmd/Ctrl+K

**Done when:** the imported `Tradex.dc.html` design's UI/UX changes are reflected in
the real app against real data, with the two genuinely-new pieces (AI zones, paper
trading) scoped through explicit user confirmation rather than assumed.

Notes:

- Source: a Claude Design project mockup (`Tradex.dc.html` + `support.js`), a
  self-contained fake-data demo, not literal code — ported the *design*, not the
  file, onto real Hyperliquid data/indicators/AI reads.
- Three points were flagged back to the user before building (`AskUserQuestion`)
  since they were new functionality, not restyling: (1) AI zones — approved, extends
  the read contract; (2) a full trade-execution panel with an "EXECUTE" button —
  approved only as a renamed, pure-local paper-trading tracker ("OPEN (PAPER)"),
  since a real EXECUTE would contradict CLAUDE.md's non-goals; (3) the command
  palette's Actions/ask-mode/lookback-presets content — user chose to match the
  mockup exactly (Coin + Interval only).
- On (3): CLAUDE.md's "Design direction" section explicitly locks `/` as the
  ask-the-AI palette trigger, and Ask-the-AI is a whole separate, tested, real
  feature (its own `/api/ask` route, hook, state) that the mockup simply never
  depicted — dropping it wasn't part of what was actually asked about, so `/` still
  opens ask-mode unchanged. What *did* get dropped from the palette per the
  approved answer: "read now", watchlist toggle, "set default interval", and
  "download log" — those store/lib functions (`setDefaultInterval`, `toggleWatchlist`,
  `downloadReadLog`) are still defined and tested but now have no UI entry point.
  Worth a follow-up if that's not what was intended.
- Paper positions only get a live price (and thus PnL) when their coin is either the
  currently active one (from the live candle feed) or on the watchlist (from the
  45s poll) — this app has no live subscription for an arbitrary coin. Same
  constraint applies to the "Re-run AI" verdict: swing support/resistance is only
  ever loaded for the active coin/interval, so a position on any other pair shows
  "switch to X to re-evaluate" instead of a stale guess.
- Zone rendering: `lightweight-charts` v5 has no built-in shaded-band primitive, so
  `ChartPanel` converts each zone's price bounds to pixel coordinates via
  `series.priceToCoordinate` and overlays absolutely-positioned divs, recomputed on
  zoom/pan (`timeScale().subscribeVisibleLogicalRangeChange`) and container resize
  (`ResizeObserver`) — same technique the mockup itself used, just against a real
  chart instead of `%`-based fake coordinates.
- Added `src/lib/sim.ts` (pure, tested) for PnL/verdict math — reused by both
  `AiPanel` and `StatusLine`'s Sim P&L total, matching the project's "pure function,
  no I/O" convention for `lib/`.

---

## Parking lot (ideas, not commitments)
- Alerts: price crosses an AI level, funding flip, RSI extreme → Sonner toast + sound
- Fast model for auto-reads, stronger model for `/` questions
- Multi-timeframe read (15m + 4h side by side)
- Session replay: step through the last day's reads against the chart