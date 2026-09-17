import { serve } from '@hono/node-server'
import { TypeSafeClient, choice, score } from '@typesafe-ai/sdk'
import { Hono } from 'hono'

// The trading bot is opt-in (off by default), so a missing key doesn't block the
// server at startup — it just disables /api/bot-decision with a clear error.
const typesafeClient = process.env.TYPESAFE_API_KEY ? new TypeSafeClient() : null

const app = new Hono()

// Directional rubrics (index 0 = strongly bearish ... 4 = strongly bullish) — explain
// `scenario`/`action`'s directional lean, one per indicator that actually has a
// bearish/bullish reading.
const TREND_RUBRIC = [
  'EMAs stacked bearish (9 below 21 below 55) and price trading below all three — strong downtrend structure.',
  'EMAs mixed with a bearish lean — price below the 21/55 EMAs but the stack not fully bearish.',
  'EMAs tangled or flat — price chopping around the moving averages, no trend structure either way.',
  'EMAs mixed with a bullish lean — price above the 21/55 EMAs but the stack not fully bullish.',
  'EMAs stacked bullish (9 above 21 above 55) and price trading above all three — strong uptrend structure.',
] as const

const MOMENTUM_RUBRIC = [
  'RSI deeply oversold (below 30) — downside momentum extended, often near exhaustion.',
  'RSI below 45 — momentum leaning bearish, not yet extreme.',
  'RSI roughly 45-55 — momentum flat, no directional edge.',
  'RSI above 55 — momentum leaning bullish, not yet extreme.',
  'RSI deeply overbought (above 70) — upside momentum extended, often near exhaustion.',
] as const

const LEVELS_RUBRIC = [
  'Price is at or breaking below nearby swing support — structure favors further downside.',
  'Price sits closer to swing support than resistance — more room below than above, mild bearish tilt.',
  'Price sits roughly mid-range between swing support and resistance, or no clear levels nearby.',
  'Price sits closer to swing resistance than support — more room above than below, mild bullish tilt.',
  'Price is at or breaking above nearby swing resistance — structure favors further upside.',
] as const

// Conviction rubrics (index 0 = low ... 2 = high) — these indicators don't have a
// direction of their own; they say how much to trust whatever direction the
// directional factors point in.
const VOLATILITY_RUBRIC = [
  'ATR% is very low relative to typical ranges — volatility compressed, moves likely small and choppy, low conviction to trade.',
  'ATR% is moderate — a typical range, enough movement to trade with normal position sizing.',
  'ATR% is elevated — wider-than-usual ranges, enough movement to trade with real conviction but proportionally larger risk.',
] as const

const VOLUME_RUBRIC = [
  'Volume is well below its 20-bar average — the current move lacks participation, low conviction.',
  'Volume is roughly in line with its 20-bar average — normal participation.',
  'Volume is well above its 20-bar average — the current move is backed by strong participation, higher conviction.',
] as const

const REGIME_RUBRIC = [
  'Regime is compressing — range tightening, typically a low-conviction environment to initiate new trades.',
  'Regime is ranging — bounded back-and-forth, moderate conviction, favors range extremes over breakouts.',
  'Regime is trending — directional continuation environment, typically the highest-conviction environment to trade with the trend.',
] as const

// Risk-width rubric (index 0 = tight ... 2 = wide) — an operational output, not just an
// explanatory factor: `useTradingBot` turns this into an ATR-scaled buffer beyond the
// nearest swing level for the position's stop-loss/take-profit, so a tight read hugs
// structure and a wide read gives the trade more room to breathe.
const RISK_WIDTH_RUBRIC = [
  'Tight — clean, strong structure with low noise; a stop and target close to the nearest swing level is appropriate.',
  'Normal — typical conditions; a standard distance from the nearest swing level is appropriate.',
  'Wide — choppy or volatile conditions where a tight stop would likely get clipped by noise; the stop and target should sit further from the nearest swing level.',
] as const

app.post('/api/bot-decision', async (c) => {
  if (!typesafeClient) {
    return c.json({ error: 'TYPESAFE_API_KEY not set in server/.env — the trading bot needs a TypeSafe API key' }, 503)
  }

  const { symbol, indicators, position } = await c.req.json()

  try {
    const { answers } = await typesafeClient.systemOne({
      state: { symbol, indicators, openPosition: position },
      questions: {
        scenario: choice(
          "Given this coin's current deterministic market indicators (EMA 9/21/55 stack, RSI 14, " +
            "ATR% of price, volume ratio vs. its 20-bar average, nearest swing support/resistance, " +
            'regime tag), what is the overall market scenario for this coin right now, independent of ' +
            'any specific open position? This is a read on whether the coin is worth trading at all, ' +
            'not a trade action.',
          {
            bull: 'Indicators favor upside — a reasonable environment to look for longs or hold existing longs.',
            bear: 'Indicators favor downside — a reasonable environment to look for shorts or hold existing shorts.',
            neutral: 'No clear directional edge right now — this coin is not worth trading; ignore it for now.',
          },
        ),
        action: choice(
          "Given this coin's current deterministic market indicators (EMA 9/21/55 stack, RSI 14, " +
            "ATR% of price, volume ratio vs. its 20-bar average, nearest swing support/resistance, " +
            'regime tag) and, if present, the currently open hypothetical position on it, what is the ' +
            'single best next action for a short-term perpetuals trader trading this coin right now?',
          {
            buy: 'Open or flip to a long position — momentum/trend favors upside from here.',
            sell: 'Open or flip to a short position — momentum/trend favors downside from here.',
            hold: 'No clear edge right now — keep any existing position as-is; do not open a new one.',
          },
        ),
        trend: score(
          "How does this coin's EMA 9/21/55 stack and price position read on a bearish-to-bullish scale?",
          TREND_RUBRIC,
        ),
        momentum: score("How does this coin's RSI 14 read on a bearish-to-bullish momentum scale?", MOMENTUM_RUBRIC),
        levels: score(
          "How does this coin's price position relative to its nearest swing support/resistance read on a " +
            'bearish-to-bullish scale?',
          LEVELS_RUBRIC,
        ),
        volatility: score(
          "How does this coin's ATR% of price (volatility) read on a low-to-high trading-conviction scale?",
          VOLATILITY_RUBRIC,
        ),
        volume: score(
          "How does this coin's volume vs. its 20-bar average read on a low-to-high participation/conviction scale?",
          VOLUME_RUBRIC,
        ),
        regime: score(
          "How does this coin's current regime tag read on a low-to-high trading-conviction scale?",
          REGIME_RUBRIC,
        ),
        riskWidth: score(
          "Given this coin's overall trend/momentum alignment, volatility, and regime, how much room should a " +
            "stop-loss and take-profit give this trade relative to the nearest swing support/resistance — tight " +
            'and close to structure, a normal distance, or wide to avoid getting clipped by noise?',
          RISK_WIDTH_RUBRIC,
        ),
      },
    })
    return c.json({
      scenario: {
        choice: answers.scenario.choice,
        confidence: answers.scenario.confidence,
        probabilities: answers.scenario.probabilities,
      },
      action: {
        choice: answers.action.choice,
        confidence: answers.action.confidence,
        probabilities: answers.action.probabilities,
      },
      factors: {
        trend: { score: answers.trend.score, confidence: answers.trend.confidence },
        momentum: { score: answers.momentum.score, confidence: answers.momentum.confidence },
        levels: { score: answers.levels.score, confidence: answers.levels.confidence },
        volatility: { score: answers.volatility.score, confidence: answers.volatility.confidence },
        volume: { score: answers.volume.score, confidence: answers.volume.confidence },
        regime: { score: answers.regime.score, confidence: answers.regime.confidence },
      },
      riskWidth: { score: answers.riskWidth.score, confidence: answers.riskWidth.confidence },
    })
  } catch (err) {
    console.error('TypeSafe bot-decision request failed:', err)
    return c.json({ error: 'bot decision request failed' }, 502)
  }
})

const port = Number(process.env.PORT ?? 8787)
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`hl-term AI server listening on http://localhost:${info.port}`)
})

export default app
