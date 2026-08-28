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
- [ ] `src/lib/hl/ws.ts`: candle-channel subscription; reconnect with backoff
- [ ] Candle buffer that merges the live bar into the snapshot correctly (update open
      bar, append on close, never duplicate) — unit-tested with synthetic messages
- [ ] `scripts/tail.ts`: `pnpm tail HYPE 1m` logs price + indicators per tick and a
      CLOSED line per bar

**Done when:** 15 minutes of `tail` on 1m yields exactly the right bar count.

Notes:

---

## Phase 3 — Terminal shell
- [ ] Theme tokens from CLAUDE.md set up in Tailwind/shadcn css variables
- [ ] Fixed-grid layout: TopBar (coin, interval, price, 24h %, funding, OI),
      IndicatorBlock (colour-coded, ticking), ChartPanel with `lightweight-charts`
      candles bound to the live buffer, empty AiPanel, bottom status line
      (WS state, latency, last update)
- [ ] Command palette: `:` → coins/intervals/actions; switching re-snapshots,
      re-subscribes, repaints with no freeze; `q` does nothing (this is a browser —
      but Esc closes the palette)
- [ ] Value-change flash on price and indicator cells

**Done when:** it reads like a terminal pane you'd keep open all day, and coin/interval
switches feel instant.

Notes:

---

## Phase 4 — AI read
- [ ] `server/index.ts` (Hono): `/api/read` and `/api/ask`, SSE streaming, key from env
- [ ] Context builder per the CLAUDE.md contract; strict JSON parse, raw-text fallback
- [ ] Triggers: coin/interval switch, bar close, palette action "read"
- [ ] Read cache per `${coin}:${interval}`; switching back is zero latency
- [ ] `/` opens the palette in ask mode; answer streams into AiPanel with the same
      context attached
- [ ] `key_levels` drawn on the chart as amber price lines with labels

**Done when:** the read (or its cached version) is visible before you finish scanning
the indicator block, and its levels sit on the chart.

Notes:

---

## Phase 5 — Daily-utility polish
- [ ] Watchlist row: 5–6 coins, price + bias colour, keys 1–6 to jump
- [ ] Background pre-compute of reads for watchlist coins on bar close
- [ ] Config in localStorage via the palette: watchlist, default interval, lookback
- [ ] Read log (download as text) to review AI quality later

**Done when:** a full trading session without touching the probe scripts or devtools.

Notes:

---

## Parking lot (ideas, not commitments)
- Alerts: price crosses an AI level, funding flip, RSI extreme → Sonner toast + sound
- Fast model for auto-reads, stronger model for `/` questions
- Multi-timeframe read (15m + 4h side by side)
- Session replay: step through the last day's reads against the chart