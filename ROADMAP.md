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
- [x] Left indicator sidebar removed to match the mockup's layout (top bar / chart /
      AI panel, no fourth column) — flagged and confirmed with the user first, since
      it's a documented v1 feature, not a restyle

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
- The mockup's layout has no left indicator column at all (top bar / chart / AI panel
  only) — initially left `IndicatorBlock` in place since it wasn't mentioned in the
  earlier scoping question, then removed it once flagged: bias/RSI/ATR/volume-ratio/
  swing-levels/regime are documented v1 scope in "Indicator block (v1 scope)" and
  called out as a *deterministic, separate-from-AI* feature in CLAUDE.md's opening
  section, so this was a real feature deletion, not a restyle — confirmed with the
  user (`AskUserQuestion`) before deleting `IndicatorBlock.tsx` and its now-orphaned
  `ui/badge.tsx` / `ui/skeleton.tsx`. The underlying `lib/indicators` computation is
  untouched and still runs every tick — it just has no dedicated panel anymore; it
  still drives the chart's key-level lines and the AI trade suggestion's target/stop.
  Deterministic bias/regime badges are gone from the UI; only the AI's own bias read
  remains visible.

---

## Phase 7 — AI reads: drop streaming, show results at once
- [x] `/api/read` and `/api/ask` switch from SSE token streaming to a single
      non-streaming completion call (no reason to keep SSE plumbing once nothing
      renders token-by-token)
- [x] `useAiRead`/`AiPanel`/ask mode show a loading state, then the parsed result in
      one shot — remove the streaming-accumulation logic and the streaming-text CSS

**Done when:** a read or ask answer appears fully formed, no partial-token flicker,
and `pnpm test`/`pnpm typecheck` are green.

Notes:

- `server/index.ts`: `streamCompletion` (SSE passthrough) replaced with
  `requestCompletion`, one `stream: false` call to the LLM, returning
  `{ text: string }` as plain JSON from `/api/read`/`/api/ask`. Upstream failures
  still surface as an embedded `"[error] upstream request failed: N"` string in
  `text` (same convention as before) rather than an HTTP error, so the client's
  existing raw-text-fallback path handles it unchanged — verified live against the
  real (rate-limited) OpenRouter endpoint.
- `lib/ai/client.ts`: `requestRead`/`requestAsk` dropped their `onToken` callback
  param, now just `fetch` + `res.json()` returning the full text. `client.test.ts`
  rewritten off the SSE-chunking fixtures onto plain JSON responses.
- `ReadState`/`AskState.status` renamed `'streaming' → 'loading'` (it's a
  request-in-flight flag now, not a token-accumulation state). Removed
  `AiPanel`'s `Cursor` component and the streaming-token render branches; loading
  now just shows a static "Thinking..." string.
- Verified in a real browser (Playwright): polled the AI panel every second after
  triggering a read — it stays on "Thinking..." with no intermediate partial JSON,
  then the fully parsed bias/key-levels/zones/invalidation appear in one frame.
  `/` ask mode hit the same free-tier 429 rate limit documented in Phase 4/5's
  notes; confirmed the error still renders correctly through the new non-streaming
  path (no crash, same "[error] ..." fallback text).

---

## Phase 8 — Local storage layer: AI read history per coin
- [x] New `lib/storage` (IndexedDB) storing AI reads per `${coin}:${interval}`,
      keyed by timestamp, with a capped history length per key
- [x] Coin/interval switch shows the latest stored read instantly instead of
      re-triggering generation; generation still fires on bar-close, manual
      palette action, or when no stored read exists yet
- [x] CLAUDE.md's "no databases" non-goal gets a one-line carve-out: client-side
      IndexedDB for local read/trade history is not the disallowed server database

**Done when:** reloading the page or switching coins back and forth shows prior
reads without re-generating, and history survives a reload.

Notes:

- `lib/storage/db.ts`: a thin promise wrapper around raw IndexedDB (no `idb`
  dependency needed for one object store) — `withStore(name, mode, fn)` opens a
  fresh connection, runs one transaction, closes it. Not caching the connection
  keeps each call self-contained and made the store trivially testable; this app's
  read volume (single-digit reads per minute at most) makes the per-call open/close
  cost irrelevant.
- `lib/storage/reads.ts`: `saveRead`/`getLatestRead`/`getReadHistory`, keyed by
  `${coin}:${interval}` via a `key` index (IndexedDB has no compound-key `get`
  without a compound index, and a single string key is simpler than one). Capped at
  20 entries per key — oldest trimmed after each save. `getReadHistory` exists now
  for Phase 12's "AI's own last stored trade suggestion for that coin," not used
  anywhere yet.
- Tested with `fake-indexeddb` (new devDependency) since jsdom (this project's
  vitest environment) has no IndexedDB implementation — `beforeEach` reassigns
  `globalThis.indexedDB` to a fresh `IDBFactory` so tests don't leak state into each
  other via a shared fake DB.
- `useAiRead.ts`: every completed read (`status: 'done'`, parsed or raw-text
  fallback) is persisted via `saveRead`, fire-and-forget. The coin/interval-switch
  effect now checks `getLatestRead` before calling `triggerRead` — the in-memory
  `aiReadCache` (Phase 4) is unchanged and still wins when already populated this
  session; IndexedDB is the second-tier check, only reached when nothing's cached
  in memory (fresh switch this session, or a reload). Race guarded: the async IDB
  lookup re-checks `aiReadCache` after resolving, in case a bar-close trigger beat
  it to the same key.
- **Verified in a real browser** (Playwright, driven from a throwaway script — no
  `chromium-cli` in this environment, so used the `playwright` npm package
  directly, same workaround Phase 3 used): instrumented `/api/read` request count
  and IndexedDB entry count through a full sequence — initial load, switch to BTC,
  switch back to HYPE, full page reload. Confirmed `/api/read` fired exactly once
  for HYPE and once for BTC (their first-ever loads), then **zero** additional
  requests on switch-back or reload, while the IndexedDB `reads` store held the
  entries across the reload (count unchanged, not regenerated, not duplicated) —
  this is the actual assertion Phase 8 needs, not just that panel text appeared.
- Hit the same free-tier `google/gemma-4-31b-it:free` 429 rate limit documented
  since Phase 4/5/7 during verification (both real reads got rate-limited), so the
  stored/replayed entries in this run are the raw-text-fallback shape, not clean
  parsed JSON — irrelevant to what Phase 8 verifies (persistence and reuse, not
  model output quality), and consistent with prior phases' notes on this being an
  existing operational constraint, not a regression.

---

## Phase 9 — Persist paper trades across sessions
- [x] Move `positions` out of session-only `useAppStore` into the Phase 8 storage
      layer, keyed per coin — same local-only DB, still no real order path

**Done when:** open paper positions survive a page reload.

Notes:

- `lib/storage/positions.ts`: `savePosition`/`deletePosition`/`loadPositions` on a
  new `positions` object store (`db.ts` bumped `DB_VERSION` 1 → 2; IndexedDB's
  `onupgradeneeded` runs the same idempotent `upgrade()` for both a fresh DB and an
  existing v1 DB, so Phase 8's `reads` store is untouched). `SimPosition` moved here
  from `store/index.ts` (which now imports and re-exports the type) since the store
  needs to call into `lib/storage` for I/O and a type living in the file that
  imports it would be circular.
- Positions are keyed by `id`, `readwrite`/`put` on open, `delete` on close — no
  separate "coin" index was needed since there's no query pattern that looks up
  positions by coin (the panel always operates on the full in-memory list).
- **Id generation changed:** the old module-level `nextPositionId` counter
  (`let nextPositionId = 1`) reset to 1 on every reload, which would have collided
  with previously-persisted higher ids and overwritten them. Replaced with
  `Date.now()` (same call reused for both `id` and `openedAt`) — monotonic across
  reloads, and a same-millisecond collision from a single human clicking a button
  isn't a real risk at this app's scale.
- `store/index.ts`'s `openPosition`/`closePosition` now write through to storage
  (`void savePosition(...)` / `void deletePosition(...)`, fire-and-forget) alongside
  the existing synchronous zustand state update — same pattern `useAiRead.ts`
  already used for reads in Phase 8, I/O triggered from the action/hook layer, not
  from `lib/`. New `hydratePositions` action + `usePersistedPositions` hook
  (mounted once in `App.tsx`, loads from IndexedDB on startup and calls
  `hydratePositions`, sorted newest-first to match `openPosition`'s existing
  prepend order) is how a reload gets positions back into the live store.
- Tested `lib/storage/positions.ts` directly with `fake-indexeddb`, same pattern as
  Phase 8's `reads.test.ts`. Didn't add a separate store-level test for the
  write-through wiring — it's thin enough (one `void save/delete` call per action)
  that the real-browser verification below is the meaningful check.
- **Verified in a real browser** (Playwright): clicked "OPEN (PAPER)" on a real AI
  trade suggestion, confirmed the position appeared in the panel and in IndexedDB
  (`positions` store count 0→1), reloaded the page and confirmed both the panel
  ("POSITIONS (1)") and the DB count still showed it — not just that a write
  happened, that a fresh load rehydrates from it, same bar Phase 5 set for config
  persistence. Then closed it and confirmed the DB count went back to 0 and stayed
  at 0 across a second reload, so close doesn't leave an orphaned record behind.

---

## Phase 10 — Proper perp paper-trading mechanics
- [x] `SimPosition` gains optional `stopLoss`/`takeProfit`, settable at open (and
      editable after)
- [x] Auto-close when live price crosses SL or TP, for coins with live data (active
      coin or watchlist — same constraint as today's PnL/verdict availability)
- [x] Every close (manual or SL/TP-triggered) books realized PnL to a running ledger
      (needed by Phase 11)
- [x] `lib/sim.ts` SL/TP direction logic (long vs. short) is pure and unit-tested

**Done when:** a position with SL/TP set auto-closes correctly when price crosses
either level, and the realized-PnL ledger reflects it.

Notes:

- `lib/sim.ts`'s new `checkSlTp(position, currentPrice)` is pure and mirrors the
  existing `computePositionVerdict`'s direction-flip pattern: for a long, stop is
  below entry / target above; for a short it flips. Returns `'stop_loss' |
  'take_profit' | null`, only checking whichever of the two levels is actually set
  (both are optional). 6 new unit tests in `sim.test.ts`.
- New `lib/storage/ledger.ts` (`addLedgerEntry`/`getLedger`) on a `ledger` object
  store (`db.ts` bumped `DB_VERSION` 2 → 3, same idempotent-upgrade pattern as
  Phase 9). Records coin/side/size/leverage/entry/exit/pnl/openedAt/closedAt/reason
  — `getLedger` isn't consumed by any UI yet, same "built for the next phase, not
  wired to a panel yet" shape as Phase 8's `getReadHistory`; Phase 11 is what reads
  it for portfolio equity.
- `store/index.ts`'s `closePosition` signature changed from `(id)` to `(id,
  exitPrice, reason)` — every close now needs a real exit price to book a ledger
  entry via `pnlForPosition` (imported from `lib/sim`, same PnL math the panel
  already displays). If `exitPrice` is `null` (no live price source for that
  position's coin — the existing "not the active coin or on the watchlist"
  constraint from `livePriceForPosition`), the position is still removed but
  nothing is booked, since there's no real number to record; this is a pre-existing
  limitation of the app's single-subscription data model, not new to this phase.
  New `updatePositionSlTp(id, patch)` action write-throughs an edited SL/TP to
  storage the same way `openPosition` already does.
- New `hooks/usePositionMonitor.ts` (mounted once in `App.tsx`) re-checks every
  open position's SL/TP against its live price whenever `candles` (active-coin WS
  ticks) or `watchlistData` (background poll) changes, and calls `closePosition`
  with the crossed reason the instant a level is crossed — this is what makes
  auto-close actually "live" rather than only checked on the next manual re-run.
- `AiPanel.tsx`: the trade-suggestion card's Target/Stop labels became editable
  number inputs (defaulting to the swing-level suggestion via `placeholder`, not
  a controlled default value, so an empty field still falls back to the live
  suggestion at open time) — local `slDraft`/`tpDraft` state, reset by giving the
  inputs a `key` of `${coin}-${interval}-...` rather than an effect, so switching
  coin/interval naturally remounts them with a clean draft. Each open position row
  gained its own small TP/SL inputs, `onBlur`-committed straight to
  `updatePositionSlTp` (no separate "save" step — this app's IndexedDB write volume
  is trivial, so debouncing wasn't worth the complexity). The ✕ close button now
  resolves the position's current live price (already computed per-row for PnL)
  and passes it through as the manual close's exit price.
- **Verified in a real browser** (Playwright): (1) set an absurd take-profit
  (999999 on a short, so `currentPrice <= takeProfit` is true immediately), opened
  a position, and watched it auto-close on the very next live WS tick — IndexedDB's
  `positions` count went 0→1→0 and `ledger` went 0→1 within ~1 second, with the
  booked entry showing `reason: "take_profit"` and a real entryPrice/exitPrice/pnl,
  not a placeholder. (2) Opened a position with no manual TP/SL override (so it
  used the live swing-level suggestion) and closed it via the ✕ button — confirmed
  a second ledger entry with `reason: "manual"` and a real, small pnl matching the
  brief entry→exit price move. Both runs also confirmed the position actually
  leaves the open list (`POSITIONS (0)`) once closed either way.

---

## Phase 11 — Global paper portfolio
- [x] Global paper account: starting balance $10,000, realized-PnL ledger (Phase 10),
      unrealized PnL from open positions with live data, equity, returns %
- [x] New UI surface for it (not in the mockup — placement is a real design decision:
      dedicated panel vs. a StatusLine strip; decide when building this phase)

**Done when:** opening/closing paper trades across multiple coins visibly moves a
single portfolio equity/returns number, and it survives a reload.

Notes:

- **Placement decision:** the StatusLine strip, not a dedicated panel. CLAUDE.md's
  layout is locked at top bar / chart / AI panel (Phase 6 explicitly removed the
  one column that used to exist), so a new panel would mean re-opening that
  decision; the status line is already the app's "always-visible account facts"
  row (WS state, latency, updated) and a single global equity number fits that
  same register without disturbing the locked layout. Made the call directly
  rather than re-asking, since Phase 6's own notes already established the
  precedent (indicator panel removal) for resolving a layout question against
  what's already locked instead of adding new chrome.
- `lib/sim.ts`: `computePortfolio(realizedPnl, unrealizedPnl, startingBalance =
  STARTING_BALANCE)` → `{ equity, returnsPct }`, pure, 3 new unit tests.
  `STARTING_BALANCE = 10_000` lives here (not in `store/`) since it's a fact about
  the paper-trading domain, not app state.
- `store/index.ts` gained `realizedPnl` (in-memory, starts at 0) and a
  `hydrateRealizedPnl` action. `closePosition` now adds the booked pnl straight
  into `realizedPnl` in the same `set()` call as the ledger write — this is what
  makes equity update the instant a position closes, not on the next IndexedDB
  round-trip. New `hooks/usePersistedLedger.ts` (mounted once in `App.tsx`, same
  shape as Phase 9's `usePersistedPositions`) loads the ledger's summed total once
  on startup so a reload starts from the real historical total instead of 0.
- `unrealizedPnl` in `StatusLine.tsx` is the same "sum PnL for positions with a
  live price source" computation that already existed there pre-Phase-11 (and
  still separately exists in `AiPanel.tsx` for its own itemized total) — left as
  independent, duplicated small computations in both components rather than
  centralizing into a shared selector; the two are genuinely different rendering
  contexts (an always-visible strip vs. an itemized position list) and the
  computation is three lines, not worth an abstraction for.
- StatusLine's old conditional "Sim P&L" (only shown when `positions.length > 0`)
  was replaced by always-visible `EQUITY`/`RETURNS`, plus a still-conditional
  `UNREALIZED` entry for when positions are actually open — equity/returns is a
  persistent account-level fact (meaningful even with zero open positions, since
  realized history alone moves it) so unlike the old Sim P&L it shouldn't
  disappear just because nothing's open right now.
- **Verified in a real browser** (Playwright): confirmed the status line reads
  `EQUITY $10000.00` / `RETURNS +0.00%` on a fresh load with an empty ledger, then
  forced an immediate take-profit auto-close (same technique as Phase 10's
  verification) and confirmed equity/returns updated to reflect the real booked
  pnl (`EQUITY $10004.91` / `RETURNS +0.05%` in this run) within about a second —
  first pass at reading the status line too early (300ms after the close) is what
  caught that the update isn't instantaneous-instantaneous (a render tick behind
  the IndexedDB write firing), not an actual bug; a longer, deliberate wait
  confirmed the number is correct and stable, not still climbing. Reloaded the
  page and confirmed the same equity/returns persisted (loaded from the ledger via
  `usePersistedLedger`, not reset to the $10,000 starting point).

---

## Phase 12 (Big) — AI reads become position-aware
- [x] Context builder feeds the model, when relevant for the coin: current open
      paper position(s) (side, entry, size, SL/TP, live PnL) and the AI's own last
      stored trade suggestion for that coin (from Phase 8's history)
- [x] AI read contract gains `position_guidance: { action: 'keep' | 'close' |
      'adjust', note: string }`, present only when a position or prior suggestion
      exists for the coin; parsed leniently like `zones` (undefined is valid)
- [x] `AiPanel` renders `position_guidance` against the relevant open position(s)

**Done when:** re-running a read on a coin with an open paper position produces an
explicit keep/close/adjust call referencing that position, not a generic read.

Notes:

- `lib/ai/types.ts` gained `OpenPositionContext` (side, entry, size, leverage,
  SL/TP, `unrealizedPnl: number | null`), `PriorSuggestion` (bias/key_levels/
  invalidation/rationale/timestamp — the useful subset of a past `AiRead`, not the
  whole thing), and `PositionGuidance`. Both new `AiContext` fields
  (`openPositions?`, `priorSuggestion?`) are optional and only populated when
  actually relevant, per the contract.
- `lib/ai/context.ts`'s `buildContext` gained two new optional trailing params
  (`openPositions = []`, `priorSuggestion = null`) after the existing
  `candleCount` — appended rather than turned into an options object, since every
  existing call site already omits `candleCount` positionally and this keeps them
  unchanged. `buildContext` omits both fields from the output entirely (not `[]`/
  `null`) when there's nothing to say, matching how `zones` was already handled.
- `lib/ai/parse.ts`: `position_guidance` validated the same lenient way as `zones`
  — `undefined` is valid (field just isn't there), but if present it must be a real
  `{action, note}` with `action` one of the three allowed values, else the whole
  read is rejected (not just that field), consistent with the existing all-or-
  nothing strict-parse philosophy. 4 new parse tests.
- `hooks/useAiRead.ts`'s `runRead` (shared by both the active-coin and background/
  watchlist read paths) now: (1) filters the store's `positions` to the coin being
  read and maps each to `OpenPositionContext`, computing `unrealizedPnl` from that
  same call's own `candles` (so it works identically for the watchlist's
  independently-snapshotted candles, not just the live active-coin buffer); (2)
  calls `getLatestRead(coin, interval)` *before* this run's own `saveRead`
  overwrites it — that prior entry, if its `parsed` is non-null, becomes
  `priorSuggestion`. A stored-but-unparsed prior read (raw-text rate-limit
  fallback) correctly yields no `priorSuggestion` rather than feeding the model
  garbage — confirmed live, see below.
- `server/index.ts`'s `READ_SYSTEM_PROMPT` documents both optional input fields and
  adds `position_guidance` to the required output shape, with an explicit
  instruction to include it only when the corresponding input was present.
- `AiPanel.tsx`: `position_guidance` renders as its own bordered block inside the
  parsed-read section (after Invalidation), action word color-coded (up/down/amber
  for keep/close/adjust) — conditionally rendered only when the field exists, same
  pattern as the existing Zones block.
- **Verified in a real browser** (Playwright), against real network requests, not
  just unit tests: (1) opened a real paper position on HYPE, then forced a
  brand-new read (switching to an interval never read this session) and confirmed
  the live `/api/read` request body's `openPositions` array matched the actual
  open position exactly, `unrealizedPnl` included — proves the position→context
  wiring is live end-to-end, not just type-correct. (2) For `priorSuggestion`,
  the free-tier model's persistent 429 rate limit (documented since Phase 4) meant
  a real prior read was never cleanly parsed JSON during this session, which would
  have made that branch untestable live — worked around it by seeding one valid
  parsed `StoredRead` directly into IndexedDB (the same shape `saveRead` itself
  writes), then waiting for a real 1m bar-close to fire the next automatic read:
  the outgoing request's `priorSuggestion` matched the seeded entry exactly. This
  is a live confirmation of the wiring using a controlled, valid input, not a
  fabricated response — the constraint being worked around is the upstream
  model's reliability, not anything in this app's code.
- Did not extend `/api/ask` (the "/" ask-mode palette) with position context —
  the roadmap item scopes this to "AI reads" specifically, and ask mode already
  has its own separate context-attachment behavior from Phase 4 that this phase
  didn't touch.

---

## Phase 13 — Trading bot: Jev-driven buy/sell/hold on the paper engine
- [x] `/api/bot-decision`: a fast typed judgment (TypeSafe's Jev, via `@typesafe-ai/sdk`'s
      `choice()` primitive) — buy/sell/hold + confidence, given the coin's deterministic
      indicators and any currently held paper position. Optional at startup: no
      `TYPESAFE_API_KEY` just disables the route with a clear 503, unlike the
      required `LLM_API_KEY`, since the bot is opt-in and off by default
- [x] Pure, tested policy (`lib/sim.ts`'s `decideBotAction`) turns a decision +
      confidence + held side into open/close-and-flip/no-op — confidence-gated per
      TypeSafe's own guidance, kept as deterministic code rather than a second model
      call, since side-matching is a rule, not a judgment
- [x] `useTradingBot`: polls the active coin's 1m candles (independent of whatever
      interval the chart is displaying) every 15s, and on each newly closed 1m bar
      asks for a decision and applies it against the existing paper-trading engine
      (`openPosition`/`closePosition` from Phases 9–11 — same persistence, ledger,
      and toasts, no new execution path). Off by default; toggled in a new
      "Trading Bot" panel in `AiPanel` showing live decision/confidence/probabilities
- [x] The trade-suggestion side (and by extension the manual OPEN button) now prefers
      the bot's live decision over the narrative `/api/read`'s own bias when the bot
      is running, falling back gracefully when it isn't — this is the "replace
      predictive analysis with Jev" part

**Done when:** turning the bot on for a coin produces a visible buy/sell/hold call on
every 1m close, and a confident signal opens (or flips) a real paper position with a
ledger entry and a toast, same as a manual close already does.

Notes:

- Triggered by a mid-conversation pivot request ("replace predictive analysis with
  TypeSafe AI's Jev model... instant trading bot... buy/sell/hold... hyper quick
  intervals"), not a pre-planned roadmap item — confirmed scope with the user first
  (`AskUserQuestion`) on three real forks: (1) paper-only vs. real order execution —
  paper-only, since real execution directly contradicts CLAUDE.md's locked
  non-goals; (2) replace `/api/read`'s bias/`position_guidance` with Jev vs. add it
  as a separate layer — chose "replace" for what actually drives the trade
  suggestion and the bot, but kept the narrative read's own contract/types
  completely intact rather than ripping `bias`/`position_guidance` out of `AiRead`
  (which Phase 12's whole position-aware context threads through) — see below; (3)
  decision cadence — every closed candle on a fast interval, reusing the existing
  bar-close-trigger pattern rather than inventing a sub-second polling loop.
- **What "replace" means concretely:** `/api/read`'s own contract, `AiRead` type,
  `parse.ts`, and Phase 12's position-aware context are all untouched — still work
  exactly as before. What changed is what the UI *acts on*: `AiPanel`'s
  `suggestionSide` (which drives the trade-suggestion card and the manual OPEN
  button) now prefers `botStatus[coin]`'s live decision over
  `read?.parsed?.bias ?? dict?.bias`, falling back to the old chain when the bot
  hasn't judged this coin yet or is off. Ripping `bias`/`position_guidance` out of
  the narrative type entirely was considered and rejected — it would have touched
  six-plus files coupled to Phase 12 for no real benefit, since the new bot panel is
  its own clearly-labeled, more prominent signal anyway.
- **Why policy is code, not a second model call:** TypeSafe's own building guide
  says to keep known rules, calculations, and execution in code and add the model
  only where semantic understanding is needed. Given a decision and a held side,
  "keep / flip / open" is a deterministic lookup, not a judgment — `decideBotAction`
  is pure and 6 unit tests cover every branch (open, hold-noop, below-threshold,
  side-matches, side-opposes, custom threshold).
- **Confidence gating:** `BOT_CONFIDENCE_THRESHOLD = 0.6`, per
  docs.typesafe.ai/confidence's three-tier framework (act automatically above a
  threshold validated against the domain's risk). This is paper money, not the
  docs' real-fund example (>0.9), so 0.6 favors actually trading over sitting idle
  — worth tuning once real decision quality is observable.
- **Decision cadence is deliberately its own 1m subscription, not the chart's
  active interval.** The app's established constraint (documented since Phase 2) is
  one live WS subscription for whatever the chart displays; rather than fight that,
  the bot REST-polls (`candleSnapshot`, same call `useWatchlist` already uses) every
  15s and only acts on a genuinely new 1m bar close (`openTime` advancing) — same
  pattern as the watchlist poller, just faster and scoped to the active coin instead
  of the whole watchlist. This means "on" always means fast regardless of what
  interval the user has the chart set to.
- `lib/storage/ledger.ts`'s `CloseReason` gained `'bot'`; the store's toast label map
  (already added for Phase 10's manual/stop_loss/take_profit) gained `'Bot flipped'`
  — a bot-driven close now reads clearly in both the toast and the ledger, not
  lumped in with a manual close.
- `store/config.ts` gained `botEnabled` (persisted, off by default, same
  `zustand/persist` pattern as watchlist/defaultInterval/lookback from Phase 5).
  It does survive a reload once turned on, matching how every other config value
  in this store already behaves — the safety property is "off by default on a
  fresh install," not "never resumes automatically." Worth reconsidering if an
  always-resuming bot turns out to surprise people in practice.
- **Missing-key behavior verified live** (before a real key existed): without
  `TYPESAFE_API_KEY` set, `/api/bot-decision` returns a clear 503 instead of
  crashing the server (unlike the required `LLM_API_KEY`/`LLM_MODEL`, which still
  throw at startup); toggling the bot on correctly showed "Waiting for the next 1m
  close...", fired a real request, and surfaced the 503 as one deduped toast.
- **Real key added; the actual Jev call verified end-to-end, live, twice:** (1)
  direct `curl` calls against `/api/bot-decision` with hand-built but
  realistic-shaped indicator payloads got genuine, well-calibrated judgments back —
  a clean bullish-trend setup (rising EMA stack, RSI 68, high volume, trending
  regime) returned `buy` at 0.79 confidence (probabilities: buy 0.86); a bearish
  setup against a losing held long returned `sell` at 0.79 (probabilities: sell
  0.86); a choppy/ranging setup returned `hold` at only 0.23 (probabilities spread
  across hold 0.49/sell 0.46) — the low-confidence case is exactly what
  `decideBotAction`'s 0.6 threshold exists to catch. (2) In a real browser with the
  bot toggled on against live HYPE data: watched three consecutive real decision
  cycles over ~3 minutes (one per 1m close), each a real Jev response
  (confidence 0.27–0.45, all below threshold), each correctly resulting in *no*
  paper position opened (`positions`/`ledger` counts stayed at 0 in IndexedDB the
  whole time) — proving the confidence gate holds up over repeated real cycles, not
  just one lucky/unlucky call. The bot's live decision also correctly drove the "AI
  Trade Suggestion" card's side (`SHORT HYPE`) even while withholding auto-execution,
  confirming the "replace predictive analysis" display wiring separately from the
  execution wiring. Did not additionally chase a live auto-open/auto-flip in the
  browser (would need a naturally-occurring ≥0.6 confidence moment or synthetic
  data injected into a real WS-driven session) — that exact code path is already
  covered by 6 unit tests plus the direct `curl` proof that a ≥0.6 response
  triggers `open`/`close_and_flip`, and the open/close mechanics themselves were
  already proven live in Phases 9–11.
- SDK confirmed directly against its shipped `.d.ts` (`@typesafe-ai/sdk@0.6.0`)
  rather than only the docs site, after two research-subagent attempts returned
  unusable placeholder text instead of real findings — fetched
  `docs.typesafe.ai`'s SDK/API/primitives/confidence pages directly instead.

---

## Phase 14 — Drop the narrative AI Read; Auto Mode becomes the primary loop
- [x] Removed `/api/read`, the narrative `AiRead`/`ReadState`/`KeyLevel`/`Zone`/
      `PositionGuidance` types, `lib/ai/parse.ts`, `lib/storage/reads.ts` (Phase 8's
      read-history store), the chart's key_levels/zones drawing, and the AI Read
      panel section — deleted, not just hidden, per the request ("if the AI read is
      just to summarize and give a text summary of the trade, remove it")
- [x] `decideBotAction`'s confidence gate defaults to 0 — Auto Mode now acts on
      every real Jev decision on every 1m close without waiting for a
      high-confidence setup; `hold` is itself the only "don't trade" signal
- [x] New: a live countdown to the next Jev analysis (seconds to the next wall-clock
      minute boundary, since that's when `useTradingBot` polls)
- [x] New: a Jev call log — every decision this session (not just the latest per
      coin), timestamped, in the AI panel
- [x] New: trade history — the full realized-PnL ledger (already durable since
      Phase 10) rendered in the UI for the first time; previously write-only
- [x] New: session PnL — a counter separate from the all-time `realizedPnl`, starts
      at 0 on load and never hydrates from storage, shown in the status line
      alongside the existing all-time Equity/Returns
- [x] Moved Positions and Trade History out of `AiPanel` entirely into a new
      `PositionsBar`, a full-width bar below the chart+AI row (not squeezed into the
      narrow AI panel column) — a follow-up layout request mid-implementation

**Done when:** the AI panel has no narrative read section left, Auto Mode opens/flips
positions on the very next 1m close a real buy/sell decision comes back (no confidence
wait), and trade history / session PnL are visible, not just stored, in their own
wide panel separate from AiPanel.

Notes:

- Triggered by a live user complaint ("Model did not return strict JSON — showing
  raw text") that turned out to be the free-tier OpenRouter model failing with real
  502/504s (confirmed via direct `curl` against `/api/read`, three failures in a
  row) — before that could be fixed, a mid-conversation follow-up reframed the ask
  entirely: drop the narrative feature rather than harden it, since it was never
  the point once the bot existed.
- **What "remove" meant in practice:** not just unmounting the UI section — deleted
  the server route, the client, the parser, the storage layer, and every type that
  existed only to serve it. `/api/ask` (manual "/" mode) and its own `AiContext`/
  `buildContext`/`LogEntry` were kept and simplified (dropped the `openPositions`/
  `priorSuggestion`/`kind` fields that only Phase 12's read-context threading ever
  used) rather than removed, since ask mode is a separate, still-wanted, manual
  feature nothing in this request touched. `lib/storage/db.ts` stopped creating the
  `reads` object store for new installs; did not write migration code to delete it
  from browsers that already have one — harmless leftover local data, not worth a
  destructive migration for.
- **Confidence gate:** previously 0.6 (see Phase 13's notes on TypeSafe's own
  three-tier confidence guidance). Changed to 0 per explicit instruction ("it
  shouldn't wait for me to open a paper trade... it should go for it"). The
  parameterized threshold itself wasn't removed from `decideBotAction` — only its
  default — so a future "only act above X% confidence" toggle is still a one-line
  change away if wanted later, not a redesign.
- **Trade history's in-memory `id`:** the ledger's real id is IndexedDB's
  autoincrement key, assigned asynchronously on write; the in-memory `ledger` array
  (for instant UI rendering without an IndexedDB round-trip) uses `closedAt` as a
  synthetic id instead of waiting for the real one — a session-local display copy,
  never written back to storage with that id, so the mismatch is harmless.
- Session PnL and all-time realized PnL now diverge on purpose: `realizedPnl`
  hydrates from the full historical ledger on load (Phase 11); `sessionPnl` starts
  at 0 every load and only accumulates from closes booked *this* session — answers
  "how did today go" separately from "how has this account done ever."
- Cleaned the parking lot below: three of its four items (AI-level alerts,
  multi-timeframe reads, session replay of reads) referenced the now-deleted
  narrative read and no longer make sense.
- `pnpm typecheck`/`pnpm test`/`pnpm lint` all green after the removal
  (95 tests, down from 116 — the read/parse-specific tests were deleted along with
  the code, not just left stale).
- **Layout follow-up** (`PositionsBar.tsx`, new): the App.tsx row structure changed
  from `[chart | AiPanel]` to `[chart | AiPanel]` stacked above a new full-width
  `PositionsBar`, inside a shared `flex-col` wrapper so the fixed-viewport/no-scroll
  rule still holds (`PositionsBar` has a fixed `h-52`, each of its two columns
  scrolls internally). All the position-management logic (open-position cards,
  SL/TP inline edit, manual close with the live-price fallback fetch, the
  re-check-verdict button) moved verbatim out of `AiPanel.tsx` into the new file —
  same behavior, just relocated. Verified live: opened a real paper position and
  confirmed it renders in the new wide bottom bar, not the AI panel.
- **Second follow-up: removed the manual Trade Suggestion card entirely** ("remove
  trade suggestions, since it's automated I don't need a trade suggestion to open
  manually — any suggestion should automatically be executed by the bot"). Deleted
  the LONG/SHORT header, Entry/TP/SL preview fields, `OPEN (PAPER)` button, and the
  `suggestionSide`/`suggestionTarget`/`suggestionStop`/draft-input state that only
  fed it — the bot's own `useTradingBot` loop already computes its own SL/TP from
  swing levels and opens positions itself, so this manual path was pure redundancy
  once Auto Mode has no confidence gate. `suggestionSideFromBias` (`lib/sim.ts`)
  became unused by this removal and was deleted along with its test, per this
  project's no-dead-code convention. The Size/Lev sliders were *kept* (moved into
  the Auto Mode section) since they're real config — `useTradingBot` reads
  `simSizeUsd`/`simLeverage` from the same store fields to size every auto-trade;
  removing them would have removed the only way to control the bot's position size.
- **Positions section is now a table, not cards** (`PositionsBar.tsx`): columns
  Coin/Side/Size/Lev/Entry/TP/SL/PnL/Verdict/Close, one row per open position, same
  inline-editable TP/SL inputs and manual-close-with-fallback-price logic as
  before, just laid out as `<table>`/`<tr>`/`<td>` instead of a `flex-wrap` of
  bordered card divs — a plain hand-styled table (this app's established pattern
  for tabular UI, e.g. `StatusLine`/`ChartPanel`) rather than adding shadcn's Table
  primitive, since nothing else in the app routes through shadcn for dense
  data display and it would need the same amount of restyling either way.
- **Verified live, real data, not just a screenshot of an empty state:** since the
  manual open button is gone, the only way to get a position into the table now is
  via a real bot auto-trade — waited several minutes for one (Jev returned `hold`
  repeatedly in that window) and, to get a deterministic check of the table's
  actual rendering rather than keep waiting on live model randomness, seeded one
  realistic position directly into the `positions` IndexedDB store (same shape
  `openPosition` itself writes) and reloaded: the table rendered all ten columns
  correctly, editable TP/SL inputs worked, and clicking Close correctly removed the
  row, booked a real ledger entry (`TRADE HISTORY (0)` → `(1)`), and showed the
  same signed-PnL toast (`Closed: LONG HYPE +$65.41`) as before the table rewrite —
  confirming the structural change didn't regress the underlying close mechanics.
- **Third follow-up: 1m default chart, positions drawn on the chart.**
  `useAppStore`'s initial `interval` changed `'1h'` → `'1m'` (session-only state,
  so this is a real default on every fresh load, not gated behind a persisted
  config value). Left `useConfigStore`'s separate `defaultInterval` (used only by
  `useWatchlist`'s background polling cadence) alone — a different "default," not
  what was asked about.
  `ChartPanel.tsx` gained a third price-line effect, same `createPriceLine`/
  `removePriceLine` pattern the old key_levels feature used (Phase 4, removed in
  this same Phase 14): for every open position on the *currently displayed* coin
  (any interval — a price line doesn't care which timeframe you're looking at), it
  draws a solid entry line (green/red by side) whose title is the side plus live
  PnL (`LONG +$83.33`, recomputed from `pnlForPosition` against the chart's own
  latest candle close), plus dashed TP/SL lines when set. Recomputed on every
  candle tick (`[positions, coin, candles]`), same brute-force
  remove-all-and-recreate approach as the old key_levels effect — cheap at the
  scale of a handful of open positions, no need for the added complexity of
  diffing/`applyOptions` updates.
  Verified live: seeded a real position (same technique as the table verification
  above, since there's no manual open button anymore), reloaded, and confirmed the
  chart showed a solid green entry line at 79.50 labeled `LONG +$83.33` and a
  dashed green TP line at 80.40 — both prices and the live PnL figure matched the
  table below it exactly, and the 1m tab was highlighted as active without
  switching to it manually.
- **Fourth follow-up: removed the "/" ask-the-AI feature entirely — only Jev calls
  remain.** Prompted by asking who was calling `/api/ask` (answer: exactly one
  caller, `CommandPalette`'s manual "/" mode — nothing automated) and a follow-up
  to remove it outright. Deleted, not disabled: `/api/ask`, `ASK_SYSTEM_PROMPT`,
  `requestCompletion`, and the `LLM_API_KEY`/`LLM_BASE_URL`/`LLM_MODEL` startup
  check from `server/index.ts`; `src/hooks/useAsk.ts`, `src/lib/ai/client.ts`
  (+ test), `src/lib/ai/context.ts` (+ test), `src/lib/ai/log.ts` (+ test),
  `src/lib/ai/types.ts` entirely — `lib/ai/bot.ts` (the Jev client) doesn't import
  from any of them, confirmed via grep before deleting, so nothing else broke.
  `CommandPalette.tsx` lost its ask-mode branch, `mode`/`askQuery` state, and the
  `/` key listener — it's coin/interval jump only now, same as before Phase 4 ever
  added ask mode. `AiPanel`'s Ask display block and the store's
  `askState`/`setAskState`/`readLog`/`addLogEntry` all removed along with it.
  Also removed the now-dead `LLM_API_KEY`/`LLM_BASE_URL`/`LLM_MODEL` lines from
  `server/.env` (untracked, local-only) — `TYPESAFE_API_KEY` is the only variable
  the server reads now.
- `pnpm typecheck` was clean immediately after the deletions with no leftover
  references (confirmed via grep for every removed symbol across `src`/`server`
  before calling it done) — `pnpm test`/`lint`/`build` all green after
  (88 tests, down from 94; the ask/read-specific test files went with the code).

---

## Phase 15 — Split Jev's judgment: ticker scenario vs. per-trade action
- [x] `/api/bot-decision` now asks two independent Jev `choice()` questions in the
  same call over the same state: `scenario` (`"bull" | "bear" | "neutral"` — is
  this coin worth trading at all, regardless of any position) and `action`
  (`"buy" | "sell" | "hold"` — what to do with the currently held position on it,
  unchanged in meaning from before). Both shaped `{ choice, confidence,
  probabilities }`.
- [x] `decideBotAction` (`lib/sim.ts`) still keys only off `action` — `scenario` is
  display-only for now, per the request to keep a single trade per ticker and let
  the existing per-ticker buy/sell/hold keep deciding the trade. `scenario` sets up
  for a later step (parking lot) where it could gate which tickers even get
  evaluated once multiple concurrent trades per ticker exist.
- [x] `AiPanel` shows a "Scenario" line (BULL/BEAR/NEUTRAL, confidence) above the
  existing action block, and the Jev call log now shows both per entry (e.g.
  `BULL BUY 92%`), colored the same green/red/muted as everywhere else PnL
  direction is shown (bull=up, bear=down, neutral=muted) — no new violet
  AI-accent color introduced, since this is a directional call like buy/sell, not
  a position verdict.
- Verified against the real TypeSafe API key (temporarily started just
  `dev:server` — the user's own dev server wasn't running at the time — killed it
  again immediately after): a bullish indicator set on HYPE with no open position
  returned `scenario: bull (100%)` / `action: buy (92%)`; a bearish indicator set
  on BTC with an open losing long returned `scenario: bear (99%)` / `action: sell
  (83%)` — sensible and independent of each other, e.g. `action` responding to the
  held position's side while `scenario` stayed a pure read on the indicators.
- `pnpm typecheck`/`test` (88 passed, unchanged — `decideBotAction`'s own tests
  didn't need touching since its signature didn't change)/`lint`/`build` all green.
- Deliberately not built yet: multiple concurrent open trades per ticker (single
  trade per ticker still holds — see parking lot).

## Phase 16 — Explain the decision: per-parameter Jev `score()` breakdown
- [x] `/api/bot-decision` gained six more Jev questions, asked in the same call
  alongside `scenario`/`action` (eight independent questions total, one request):
  `trend`, `momentum`, `levels` (directional, `score()` on a 5-point bearish→
  bullish rubric, index 0–4) and `volatility`, `volume`, `regime` (conviction-only,
  `score()` on a 3-point low→high rubric, index 0–2 — these indicators don't have
  a direction of their own, they say how much to trust whichever way the
  directional factors point). Rubric levels are concrete, hand-written sentences
  per TypeSafe's guidance ("levels must describe concrete situations and stand on
  their own"), not bare adjectives.
- [x] Response gained `factors: { trend, momentum, levels, volatility, volume,
  regime }`, each `{ score, confidence }` — deliberately dropped Jev's own
  `legend`/`probabilities` from the wire response; the client renders scores
  against its own short labels (`DIRECTIONAL_LABELS`/`CONVICTION_LABELS` in
  `AiPanel.tsx`) by the same index order the server's rubrics use, kept in sync by
  hand rather than sent over the wire on every tick.
- [x] `AiPanel` gained a "Why" section under the Scenario/Action block: a compact
  2-column grid of the six factors, each rendered as a short qualitative label
  (Strong Bear/Bear/Neutral/Bull/Strong Bull, or Low/Moderate/High) colored the
  same up/down/muted (directional) or muted/amber (conviction) as the rest of the
  app — not a new numeric-bar widget, to stay legible at the sidebar's existing
  10px scale. Left the Jev call log untouched (scenario+action only, no factors)
  — the log is a scannable history, not a live explanation, and six extra values
  per row would make it unreadable at that width.
- `BotDecisionResult`/`BotStatus`/`BotLogEntry` all picked up `factors` for free
  (they compose the same type), so every logged tick already carries its own
  factor breakdown even though the UI only surfaces the latest one.
- Verified against the real TypeSafe API key (temporarily started just
  `dev:server` again, killed it right after): a bullish HYPE indicator set (EMA
  stack up, RSI 62.3, price roughly mid-range between support/resistance, ATR
  1.8%, volume 1.4x, trending regime) returned `trend: 3.06`, `momentum: 3`,
  `levels: 2.32`, `volatility: 0.83`, `volume: 1.97`, `regime: 2` — every factor
  landed where the hand-verified inputs predicted (trend/momentum clearly bullish,
  levels near-neutral since price wasn't close to either boundary, volume/regime
  high-conviction, volatility only moderate) — confirms the rubrics are being
  read correctly, not just returning plausible-looking noise.
- `pnpm typecheck`/`test` (88 passed, no test changes needed — nothing existing
  asserted on `BotDecisionResult`'s exact shape)/`lint`/`build` all green.

---

## Phase 17 — Imported design refresh: AI panel + tabbed activity bar
- [x] Pulled `Tradex AI Pane.dc.html` from the linked claude.ai/design project
  (`DesignSync.get_file`, project `5292a054-037d-45c9-9e49-3ff1b97a3462`) and
  translated its layout intent into the existing token system (`text-term-*`,
  `bg-term-panel`, etc.) rather than porting its inline hex styles or its DC
  runtime (`support.js` — a prototyping harness, not something this app depends
  on) verbatim.
- [x] `AiPanel`: header now shows a glowing pulsing orb (amber, faster while a
  decision request is actually in flight) next to "JEV · AUTO MODE" and a status
  line with a blinking cursor (`paused · manual control` / `analyzing {coin}
  1m…` / `watching {coin} 1m closes`) instead of the old static label — added a
  real `botAnalyzing` store flag (`useTradingBot` sets it around the
  `requestBotDecision` call) so this reflects an actual in-flight request, not
  fabricated "thinking" text like the design mock's fake `thoughtScript` (that
  part of the mock was deliberately not ported — this app doesn't stream
  narrative Jev "thoughts", it never has).
- [x] The countdown to the next 1m close is now an SVG ring (drains over 60s,
  amber while analyzing, red in the last 8s, green otherwise) instead of a bare
  `00:XX` text line.
- [x] Scenario/action card: verdict text is bigger (`text-2xl`) with a
  buy/sell/hold probability bar (segmented, colored) beneath it instead of three
  bare percentage numbers.
- [x] The "Why" factor rows gained a small segmented meter (5 segments for the
  directional factors, 3 for conviction-only) alongside their existing
  qualitative label, colored the same as the label.
- [x] Replaced `PositionsBar` with `ActivityBar`: a single tabbed wide bar below
  the chart+AI row (Positions / Trade History / Jev Call Log), Positions selected
  by default per the request, instead of the old two-column
  positions-next-to-history layout. The Jev call log moved here from the bottom
  of `AiPanel` (which no longer renders a log at all) and gained a Scenario
  column and a per-row confidence bar it didn't have before.
- [x] `CLAUDE.md`'s component list and layout description updated for the
  rename/restructure.
- `pnpm typecheck`/`test` (88 passed, unchanged)/`lint`/`build` all green.
- Not visually verified in a browser — no browser-automation tool was available
  in this session. Static checks (full TS typecheck across all props/JSX, build)
  pass, which rules out most wiring bugs, but layout/spacing should still get a
  once-over from the user before calling this final.

## Phase 18 — Jev-steered stop-loss/take-profit width
- [x] `/api/bot-decision` gained a ninth Jev question, `riskWidth`: a `score()`
  on a 3-point tight/normal/wide rubric (index 0-2), asked in the same call as
  everything else. Unlike the six `factors`, this is operational rather than
  explanatory.
- [x] Entry price stays deterministic — it's just the live price at open, never
  something asked of Jev. Precise price numbers are a poor fit for `choice()`/
  `score()` (typed judgments over described criteria, not numeric regression),
  so the actual SL/TP math stays in code and only the risk-width input comes
  from Jev.
- [x] New pure helper `computeStopLossTakeProfit` (`lib/sim.ts`, fully tested):
  anchors stop-loss/take-profit to the nearest swing support/resistance as
  before, then pushes both further from price by an ATR-scaled buffer —
  `riskWidth` 0 adds no buffer (hugs the raw swing level, today's old
  behavior), 2 adds a full ATR of extra room on both sides. `useTradingBot`
  calls it instead of reading `swingSupport`/`swingResistance` directly.
- [x] `BotDecisionResult` gained `riskWidth: { score, confidence }`. `CLAUDE.md`
  updated (nine questions now, not eight).
- Verified against the real TypeSafe API key (user's own `pnpm dev` was already
  running — used it as-is, did not start or stop anything): a clean, low-ATR
  (0.6%) BTC uptrend returned `riskWidth: 0.44` (tight); a choppier, ranging
  HYPE setup with 3.5% ATR and thin volume returned `riskWidth: 1.5` (leaning
  wide) — directionally correct in both cases.
- `pnpm typecheck`/`lint`/`build` all green; `pnpm test` 93 passed (5 new for
  `computeStopLossTakeProfit`: tight/normal/wide buffer math, score clamping,
  and the undefined-when-no-swing-level case).

## Phase 19 — Pluggable Jev strategies: Momentum + Order Book Pressure
- [x] `/api/bot-decision` request gained `strategy: 'momentum' | 'orderbook'`
  (route 400s on an unknown value) and `orderBook` (only meaningful for
  `orderbook`); `indicators` is still always sent since every strategy anchors
  SL/TP to swing levels regardless of what else it looks at.
- [x] `server/index.ts` is now a thin dispatcher: look up
  `STRATEGIES[strategy]` (`server/strategies/momentum.ts` /
  `server/strategies/orderbook.ts`), call its `buildQuestions()`, run one
  `systemOne` call, shape the response from its `factorMeta`. Momentum's
  question wording is unchanged from Phase 18, just moved out of `index.ts`.
- [x] Response's `factors` changed from a fixed 6-key object to a generic
  `{ key, label, kind, score, confidence }[]` — momentum still sends 6 entries,
  `orderbook` sends 3 (`imbalance`, `spread`, `depth`). `scenario`/`action`/
  `riskWidth` stay universal (same meaning, different wording) across
  strategies, since `decideBotAction` and `computeStopLossTakeProfit` only key
  off those, never off individual factors.
- [x] New `computeOrderBookMetrics` (`lib/indicators/orderbook.ts`, pure,
  tested — 6 new cases) computes imbalance/spread/depth-ratio from a live
  `l2Book` snapshot; `useTradingBot` fetches it only when
  `activeStrategy === 'orderbook'` and passes the latest candle close as the
  mid-price proxy (avoids a second Hyperliquid round trip just for `midPx`).
- [x] `AiPanel` gained a Strategy picker (two pills next to the sliders) and
  shows the active strategy in the header; the "Why" section now maps over
  `botStatus.factors` generically instead of 6 hardcoded rows —
  `FactorRow` needed no changes, it already took `label`/`kind`/`factor` as
  props. `ActivityBar`'s Jev Call Log gained a Strategy column (`MOM`/`BOOK`)
  so history stays legible once two strategies exist.
- [x] Switching `activeStrategy` (persisted, `useConfigStore`) while Auto Mode
  is on restarts `useTradingBot`'s poll loop immediately, the same mechanism
  already used for switching coin (`activeStrategy` added to the effect's
  dependency array).
- Verified against the real TypeSafe API key (user's `pnpm dev` had stopped
  since the last phase — started a temporary `dev:server`, verified, confirmed
  via `ps`/timestamp it was the process I'd started, then killed it): momentum
  reproduced the same shape/values as Phase 18 after the refactor; orderbook
  with a strongly bid-heavy/tight/deep synthetic book (`imbalance: 0.72,
  spreadPercent: 0.03, depthRatio: 4.5`) returned `imbalance: 2.91` (bullish
  side of neutral) and high-conviction `spread`/`depth` scores; flipping to a
  strongly ask-heavy/thin book (`imbalance: -0.85, depthRatio: 1.1`) correctly
  dropped `imbalance` to 1.27 (bearish side) and `depth` to 0.65 (low
  conviction). One honest miss: `spreadPercent` going from 0.03% to 0.45%
  (15x wider) barely moved the `spread` score (1.95 → 1.73) — the rubric's
  "relative to typical" wording doesn't give the model a hard reference point,
  the same class of imprecision the existing ATR/volatility rubric already
  has. Not fixed in this phase; worth tightening the rubric with concrete
  numeric bands if it matters in practice.
- `pnpm typecheck`/`lint`/`build` all green; `pnpm test` 99 passed (6 new for
  `computeOrderBookMetrics`).

## Phase 20 — Explicit Start/End Session, persisted, close-all on end
- [x] Replaced the single On/Off toggle in `AiPanel` with explicit "Start
  Session" / "End Session" buttons. Jev was already only ever called while
  `botEnabled` was true (`useTradingBot`'s poll loop is gated on it) — this
  phase makes that boundary an explicit user action instead of an implicit
  side effect of a generic toggle, and the session's existence is now visible
  (elapsed-time readout) rather than just a binary on/off pill.
- [x] `useConfigStore` gained `sessionStartedAt: number | null` alongside
  `botEnabled` (both already persisted via the existing `zustand/persist` to
  `localStorage` under `hl-term-config` — no new persistence mechanism
  needed, `botEnabled` was already surviving a tab close before this phase).
  `toggleBot` replaced with `startSession()`/`endSession()`. `AiPanel`'s
  status line now shows a live elapsed-time readout (`formatElapsed`) next
  to the existing watching/analyzing text, so a resumed session visibly
  shows how long it's actually been running, not just that it's on.
- [x] Ending a session opens a confirm dialog (shadcn's `components/ui/dialog.tsx`,
  already in the repo, previously unused outside `CommandPalette`) — "End
  trading session?" with a count of open positions that will be closed, or a
  plain "no open positions" message when there are none. Confirming closes
  every open position (across all coins, not just the active one) at the
  best available price, then stops the session; Cancel leaves everything
  running.
- [x] New `resolveClosePrice` (`lib/closePosition.ts`) extracts the
  live-price-or-fetch fallback that `ActivityBar`'s manual per-position close
  already had, now shared by both the manual close button and bulk
  end-of-session close instead of being duplicated.
- [x] New `CloseReason` value `session_end` ("Session ended") distinguishes
  session-triggered closes from a manual per-position close in the trade
  history.
- Not visually verified in a browser — no browser-automation tool available
  this session (same limitation as Phase 17). No new server/Jev call is
  involved in this phase, so no live-API verification was needed either.
- `pnpm typecheck`/`lint`/`build` all green; `pnpm test` 100 passed (2 new
  for `startSession`/`endSession` and `sessionStartedAt` in
  `config.test.ts`, one existing `toggleBot` test updated).

## Phase 21 — Session Settings dialog
- [x] Moved the Strategy picker and Size/Lev sliders out of `AiPanel`'s
  always-visible body into a "Session Settings" dialog, opened by a gear
  icon (`lucide-react`'s `SettingsIcon`) added next to the Start/End Session
  button. The main panel now only shows the header, the countdown ring, and
  the live decision (Scenario/Action/Why) while a session is active —
  nothing else competes for space.
- [x] Every option that isn't part of the live decision itself now lives in
  one place (the dialog) instead of three separate always-visible rows;
  changes still apply immediately (no separate "save" step) and switching
  strategy mid-session still restarts the poll loop, unchanged from Phase 19.
- Reused the same shadcn dialog primitive as the end-session confirm dialog
  from Phase 20 — no new UI dependency.
- Not visually verified in a browser — no browser-automation tool available
  this session (same limitation as Phases 17 and 20).
- `pnpm typecheck`/`test` (100 passed, unchanged — this phase only moved
  existing JSX, no new logic)/`lint`/`build` all green.

## Phase 22 — Non-directional chart colors for TP/SL and the live-price line
- [x] `ChartPanel`'s take-profit price line was `#4ADE80` (the same green as
  `term-up`) and stop-loss was `#F87171` (`term-down`) — reusing the
  long/short–up/down reservation `CLAUDE.md` explicitly locks to actual
  direction semantics for something that isn't one (TP/SL are risk-boundary
  markers, not a price-direction signal). Switched TP to amber (`#E8B45A`,
  same "emphasized live value" meaning it has everywhere else) and SL to
  violet (`#A78BFA`, extending the existing "AI-generated accent" meaning —
  SL's distance from entry comes from Jev's `riskWidth` score, not a fixed
  rule). The entry-price line keeps its side color (green long / red short)
  since that *is* a legitimate long/short semantic.
- [x] The chart's live/last-price line (lightweight-charts' built-in
  `priceLineColor`) had no explicit color, so it defaulted to the last
  candle's up/down color — flipping green/red with every bar and fighting
  the same up/down reservation. Set it to a new light-blue token, `#7DD3FC`,
  documented in `CLAUDE.md`'s palette alongside the other two changes.
- [x] `CLAUDE.md`'s palette bullet rewritten to document all three colors and
  *why* — the reasoning (not just the hex) is what keeps this from being
  re-litigated next session.
- Also fixed two typecheck errors in `AiPanel.tsx` from an in-progress
  hand-edit already on disk when this phase started (compacting the header
  into one line — strategy + elapsed time inline, "Start"/"End" instead of
  "Start Session"/"End Session", the separate status-text line removed) —
  kept that layout change as the user had it, just made the elapsed-time
  read null-safely and deleted the now-dead commented-out old status block
  per the user's own no-commented-code rule.
- `pnpm typecheck`/`test` (100 passed, unchanged)/`lint`/`build` all green.
- Not visually verified in a browser — no browser-automation tool available
  this session (same limitation as Phases 17, 20, 21).

## Phase 23 — Response-anchored countdown; persisted Jev call log
- [x] The "Next Jev analysis" countdown ring was purely `60 - (now % 60)` —
  wall-clock-anchored, so it reset on every minute boundary regardless of
  whether a Jev call actually happened or completed that minute (e.g. a
  skipped poll before `MIN_CANDLES` bars exist, or an in-flight request
  running past the boundary). New `lastDecisionAt` in `useAppStore`, set in
  `useTradingBot`'s `finally` block (runs on both the success path and the
  early `return` in `catch` — success or failure, either way) instead of
  only on success. `AiPanel`'s countdown now counts down from 60 anchored to
  `lastDecisionAt` (falling back to `sessionStartedAt` before the first
  response ever lands), so it only resets on an actual settled response.
  Clamps at 0 rather than going negative if a response is overdue.
- [x] The Jev call log (`botLog`) was in-memory only — a page refresh
  cleared it even though positions and the trade-history ledger already
  survived one. New `lib/storage/botLog.ts` (IndexedDB, `fake-indexeddb`-
  tested, same shape as `ledger.ts`/`positions.ts`) plus `usePersistedBotLog`
  (mounted in `App.tsx` alongside the other `usePersisted*` hooks). The
  store's `addBotLogEntry` action now persists as a side effect (matching
  how `openPosition`/`closePosition` already do their own persistence
  inline) instead of needing a separate call site. Hydration re-applies the
  existing 200-entry in-memory cap (`MAX_BOT_LOG_ENTRIES`, now exported);
  the durable IndexedDB store itself is left unbounded, same as the ledger.
  `botStatus` (latest decision per coin) deliberately stays unpersisted — it
  self-heals from the next poll within a session's normal 1m cadence.
- Not visually verified in a browser — no browser-automation tool available
  this session (same limitation as Phases 17, 20, 21, 22).
- `pnpm typecheck`/`lint`/`build` all green; `pnpm test` 103 passed (3 new
  for `botLog.ts`'s add/get round-trip and ordering).

## Phase 24 — Trade History as a table, matching Positions
- [x] `ActivityBar`'s Trade History tab was a stack of flex rows, the odd one
  out next to the Positions tab's actual `<table>`. Converted to a `<table>`
  with the same header/row classes as Positions (`text-term-muted
  border-term-border border-b text-[10px] tracking-widest uppercase` head,
  `border-term-border/60 border-b tabular-nums` rows) — Time, Coin, Side,
  Size, Lev, Entry, Exit, PnL, Reason columns.
- Not visually verified in a browser — no browser-automation tool available
  this session (same limitation as recent phases).
- `pnpm typecheck`/`test` (103 passed, unchanged)/`lint`/`build` all green.

## Phase 25 — Named trading sessions
- [x] Sessions were anonymous — `useConfigStore` only tracked `botEnabled` +
  `sessionStartedAt`, so positions and trade history had no durable link back
  to the run that produced them. Replaced `sessionStartedAt` with
  `activeSession: TradingSession | null` (`{ id, name, startedAt }`), and
  `startSession` now takes a `name`. A new "Name" field in the Session
  Settings dialog (`AiPanel`) lets the user type one before starting; left
  blank, it falls back to the active strategy's label — same visible
  behavior as before for anyone who doesn't bother naming a session. Once a
  session is running, the field shows the name read-only (renaming a live
  session isn't supported — a session's identity is fixed at start) and the
  panel header shows the session name instead of just the strategy label.
- [x] `SimPosition` and `LedgerEntry` gained optional `sessionId`/`sessionName`
  fields (optional so positions/trades persisted before this phase still
  load without a migration). `useTradingBot` stamps the active session onto
  every position it opens; `closePosition` (`store/index.ts`) copies those
  same two fields onto the booked ledger entry. `ActivityBar`'s Positions and
  Trade History tables both gained a Session column (`sessionName ?? '—'`).
- [x] `CLAUDE.md`'s trading-session paragraph rewritten for the named-session
  shape and the `sessionId`/`sessionName` tagging.
- Deliberately did not build a session browser/filter UI or a durable
  `sessions` IndexedDB store — `activeSession` already survives a page
  refresh via `useConfigStore`'s existing `persist` middleware, and nothing
  in this phase needs to read back a list of past sessions; denormalizing
  `sessionName` onto each position/ledger row was enough for what was asked
  (tracking positions/trade history against the named session). Revisit if a
  "browse past sessions" view is ever wanted.
- Not visually verified in a browser — no browser-automation tool available
  this session (same limitation as recent phases).
- `pnpm typecheck`/`lint`/`build` all green; `pnpm test` 103 passed (2 of
  `config.test.ts`'s existing session tests updated for the renamed
  `activeSession` field and `startSession`'s new required argument, no new
  tests added — this phase is store-shape plumbing plus JSX, not new pure
  logic).

## Phase 26 — Multi-timeframe trend strategy (`mtf-trend`)
- [x] New strategy, an Elder-style "triple screen" setup: a 4h RSI 14 + MACD(12,26,9)
  read sets the major trend, a 15m read of the same shape sets the intermediate
  trend, and the always-fetched base 1m indicators (EMA stack, RSI) only time
  *when* to enter/exit in whatever direction the two agree on — never to trade
  against them. `server/strategies/mtfTrend.ts`'s `action` question is explicitly
  worded to hold when major/intermediate disagree, since "do the higher timeframes
  agree" is a judgment call best left to Jev's `alignment` factor, not a
  deterministic gate bolted onto `decideBotAction`.
- [x] New pure indicators: `lib/indicators/macd.ts` (`macd()`, built on the existing
  `ema()` primitive — fast/slow EMA difference, EMA-of-that-line signal, histogram)
  and `lib/indicators/trendSnapshot.ts` (`computeTrendSnapshot()`, RSI 14 + MACD off
  one candle series — the 4h and 15m calls are two separate invocations of the same
  function). Both fully tested, `macd.ts` cross-checked against `ema()` directly at
  several bars plus a small hand-traceable short-period example, matching the
  existing indicator test conventions.
- [x] `useTradingBot.ts` fetches two extra candle series (`MTF_MAJOR_INTERVAL` =
  `'4h'`, `MTF_INTERMEDIATE_INTERVAL` = `'15m'`, 90-bar lookback — comfortably above
  `computeTrendSnapshot`'s exact 34-bar minimum) only when `activeStrategy ===
  'mtf-trend'`, same branch-per-strategy pattern the `orderbook` strategy already
  established for `l2Book`. Deliberately re-fetches both every 15s poll rather than
  caching across polls (4h/15m barely move tick to tick) — same simplicity
  trade-off the `orderbook` strategy already makes re-fetching the book every poll.
- [x] `StrategyId`/`STRATEGIES` (`lib/strategies/types.ts`, `server/index.ts`),
  `STRATEGY_ABBR` (`ActivityBar.tsx`), and `requestBotDecision`'s new optional
  `mtfTrend` parameter (`lib/ai/bot.ts`) all extended — no changes needed in
  `AiPanel.tsx`, whose strategy picker and factor list already render generically
  off `STRATEGIES`/`factors` arrays (`flex-1` pills, not a fixed 2-up grid).
- Not visually verified in a browser — no browser-automation tool available this
  session (same limitation as recent phases); not live-verified against the real
  TypeSafe API either (unlike Phase 19's order-book strategy) — no running `pnpm
  dev` session available this time to call through to a live Jev response.
- `pnpm typecheck`/`lint`/`build` all green; `pnpm test` 111 passed (8 new: 5 for
  `macd`, 3 for `computeTrendSnapshot`).

## Parking lot (ideas, not commitments)
- Alerts: bot decision flips, funding flip, RSI extreme → Sonner toast + sound
- Configurable confidence threshold for Auto Mode (currently 0 — acts on everything)
- Multi-coin Auto Mode (currently trades only whichever coin is active)
- Multiple concurrent open trades per ticker, each with its own `action` judgment
  (Phase 15 laid the groundwork: `scenario` is already ticker-level and separate
  from `action`) — would also let `scenario` gate which tickers get evaluated at
  all instead of being display-only
- Persistent (server-side, UI-independent) trading sessions — the loop currently
  only runs while a browser tab has the app mounted (see `useTradingBot`); moving
  it server-side needs its own durable storage (IndexedDB isn't reachable from
  Node) — raised, not started
- A fourth strategy — e.g. Funding & Open Interest (`metaAndAssetCtxs`, already
  fetched elsewhere in the app but not fed to the bot) for a carry/crowding read,
  distinct from momentum's price structure, order book's book pressure, and
  mtf-trend's RSI/MACD alignment (Phase 19 added Order Book Pressure, Phase 26
  added MTF Trend)
- Tighten the `orderbook` strategy's `spread` rubric with concrete numeric bands
  (e.g. "< 0.05%" / "0.05–0.2%" / "> 0.2%") instead of "relative to typical" —
  Phase 19's live verification showed a 15x wider spread barely moved the score
- Run more than one strategy per coin at once and compare/ensemble their reads,
  or let `scenario` (once multiple strategies exist) gate which strategy even
  runs for a given ticker