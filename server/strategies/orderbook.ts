import { choice, score } from '@typesafe-ai/sdk'
import type { StrategyQuestions } from './types'

// Directional rubric (index 0 = heavily ask-heavy ... 4 = heavily bid-heavy) — explains
// `scenario`/`action`'s directional lean from resting liquidity rather than price history.
const IMBALANCE_RUBRIC = [
  'Book is heavily ask-heavy within the depth window — sellers dominate resting liquidity near mid, pressure favors downside.',
  'Book leans ask-heavy — more resting sell-side depth than buy-side near mid, mild bearish pressure.',
  'Book is roughly balanced between bid and ask depth near mid — no clear pressure either way.',
  'Book leans bid-heavy — more resting buy-side depth than sell-side near mid, mild bullish pressure.',
  'Book is heavily bid-heavy within the depth window — buyers dominate resting liquidity near mid, pressure favors upside.',
] as const

// Conviction rubrics (index 0 = low ... 2 = high) — these don't have a direction of
// their own; they say how much to trust the imbalance reading.
const SPREAD_RUBRIC = [
  'Spread is wide relative to typical — thin, low-conviction liquidity at the touch, price can gap easily.',
  'Spread is a typical width — normal two-sided liquidity at the touch.',
  'Spread is tight relative to typical — deep, competitive liquidity at the touch, high conviction the current price is fair.',
] as const

const DEPTH_RUBRIC = [
  'Depth behind the top of book is thin, close to the top-of-book size itself — the book could be pushed through easily, low conviction.',
  'Depth behind the top of book is a moderate multiple of top-of-book size — reasonable conviction the level holds.',
  'Depth behind the top of book is a large multiple of top-of-book size — high conviction the level holds against a single order.',
] as const

const RISK_WIDTH_RUBRIC = [
  'Tight — a deep, balanced book with a narrow spread; a stop and target close to the nearest swing level is appropriate.',
  'Normal — typical book depth and spread; a standard distance from the nearest swing level is appropriate.',
  'Wide — a thin book and/or a wide spread, where a tight stop could get clipped by a single large order; the stop and target should sit further from the nearest swing level.',
] as const

/**
 * Order Book Pressure: driven by live `l2Book` depth (imbalance, spread, depth behind
 * the touch) rather than candle history. `state` still includes the base `indicators`
 * (price/ATR/swing levels) for grounding — every strategy anchors stop-loss/take-profit
 * to swing levels regardless of what it primarily reasons about.
 */
export function buildQuestions(): StrategyQuestions {
  return {
    questions: {
      scenario: choice(
        "Given this coin's live order book (bid/ask depth imbalance within ±0.5% of mid price, spread, and " +
          'depth behind the top of book) alongside its underlying price structure (swing support/resistance, ' +
          'ATR%), what is the overall market scenario for this coin right now, independent of any specific ' +
          'open position? This is a read on whether the coin is worth trading at all, not a trade action.',
        {
          bull: 'Book pressure and price structure favor upside — a reasonable environment to look for longs or hold existing longs.',
          bear: 'Book pressure and price structure favor downside — a reasonable environment to look for shorts or hold existing shorts.',
          neutral: 'No clear directional edge right now — this coin is not worth trading; ignore it for now.',
        },
      ),
      action: choice(
        "Given this coin's live order book (bid/ask depth imbalance, spread, depth behind the top of book) " +
          'and, if present, the currently open hypothetical position on it, what is the single best next ' +
          'action for a short-term perpetuals trader trading this coin right now?',
        {
          buy: 'Open or flip to a long position — book pressure favors upside from here.',
          sell: 'Open or flip to a short position — book pressure favors downside from here.',
          hold: 'No clear edge right now — keep any existing position as-is; do not open a new one.',
        },
      ),
      riskWidth: score(
        'Given this coin\'s order book depth and spread, how much room should a stop-loss and take-profit ' +
          'give this trade relative to the nearest swing support/resistance — tight and close to structure, a ' +
          'normal distance, or wide to avoid getting clipped by a single large order?',
        RISK_WIDTH_RUBRIC,
      ),
      imbalance: score(
        "How does this coin's order book bid/ask depth imbalance within ±0.5% of mid price read on a " +
          'bearish-to-bullish scale?',
        IMBALANCE_RUBRIC,
      ),
      spread: score("How does this coin's current bid/ask spread read on a low-to-high trading-conviction scale?", SPREAD_RUBRIC),
      depth: score(
        "How does this coin's order book depth behind the top of book read on a low-to-high trading-conviction scale?",
        DEPTH_RUBRIC,
      ),
    },
    factorMeta: [
      { key: 'imbalance', label: 'Imbalance', kind: 'directional' },
      { key: 'spread', label: 'Spread', kind: 'conviction' },
      { key: 'depth', label: 'Depth', kind: 'conviction' },
    ],
  }
}
