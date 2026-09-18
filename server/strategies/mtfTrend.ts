import { choice, score } from '@typesafe-ai/sdk'
import type { StrategyQuestions } from './types'

// Directional rubrics (index 0 = strongly bearish ... 4 = strongly bullish) — each
// reads RSI level together with MACD line-vs-signal and histogram sign/direction,
// since neither alone is a reliable trend read.
const MAJOR_TREND_RUBRIC = [
  "4h RSI is oversold/low and the 4h MACD line sits below its signal line with a negative, widening " +
    'histogram — a strong bearish major trend.',
  '4h RSI is below 50 and the 4h MACD line sits below its signal line — a bearish major trend, not extreme.',
  '4h RSI is near 50 and the 4h MACD line and signal line sit close together — no clear major trend.',
  '4h RSI is above 50 and the 4h MACD line sits above its signal line — a bullish major trend, not extreme.',
  '4h RSI is overbought/high and the 4h MACD line sits above its signal line with a positive, widening ' +
    'histogram — a strong bullish major trend.',
] as const

const INTERMEDIATE_TREND_RUBRIC = [
  '15m RSI is oversold/low and the 15m MACD line sits below its signal line with a negative, widening ' +
    'histogram — a strong bearish intermediate trend.',
  '15m RSI is below 50 and the 15m MACD line sits below its signal line — a bearish intermediate trend, not extreme.',
  '15m RSI is near 50 and the 15m MACD line and signal line sit close together — no clear intermediate trend.',
  '15m RSI is above 50 and the 15m MACD line sits above its signal line — a bullish intermediate trend, not extreme.',
  '15m RSI is overbought/high and the 15m MACD line sits above its signal line with a positive, widening ' +
    'histogram — a strong bullish intermediate trend.',
] as const

const ENTRY_TIMING_RUBRIC = [
  "The 1m EMA stack is bearish (9 below 21 below 55) and 1m RSI leans bearish — downside momentum is live " +
    'right now, a good moment to enter or hold short.',
  '1m price/EMAs lean bearish but without a full bearish stack — weak downside momentum right now.',
  '1m EMAs are tangled or RSI is flat around 50 — no short-term momentum to time an entry off right now.',
  '1m price/EMAs lean bullish but without a full bullish stack — weak upside momentum right now.',
  "The 1m EMA stack is bullish (9 above 21 above 55) and 1m RSI leans bullish — upside momentum is live " +
    'right now, a good moment to enter or hold long.',
] as const

// Conviction rubrics (index 0 = low ... 2 = high).
const ALIGNMENT_RUBRIC = [
  'The major (4h) and intermediate (15m) trend reads disagree or point opposite ways — low conviction to ' +
    'trade in either direction right now.',
  'Only one of the major/intermediate reads has a clear lean while the other is flat or mixed — moderate ' +
    'conviction.',
  'The major (4h) and intermediate (15m) trend reads agree on direction — high conviction to trade with ' +
    'that shared direction.',
] as const

const VOLATILITY_RUBRIC = [
  'ATR% is very low relative to typical ranges — volatility compressed, moves likely small and choppy, low conviction to trade.',
  'ATR% is moderate — a typical range, enough movement to trade with normal position sizing.',
  'ATR% is elevated — wider-than-usual ranges, enough movement to trade with real conviction but proportionally larger risk.',
] as const

const REGIME_RUBRIC = [
  'Regime is compressing — range tightening, typically a low-conviction environment to initiate new trades.',
  'Regime is ranging — bounded back-and-forth, moderate conviction, favors range extremes over breakouts.',
  'Regime is trending — directional continuation environment, typically the highest-conviction environment to trade with the trend.',
] as const

const RISK_WIDTH_RUBRIC = [
  'Tight — major and intermediate trends agree and volatility is contained; a stop and target close to the ' +
    'nearest swing level is appropriate.',
  'Normal — typical alignment and volatility; a standard distance from the nearest swing level is appropriate.',
  'Wide — trends are choppy, disagreeing, or volatility is elevated, where a tight stop would likely get ' +
    'clipped by noise; the stop and target should sit further from the nearest swing level.',
] as const

/**
 * Multi-timeframe trend (Elder-style triple screen): a 4h RSI+MACD read sets the
 * major trend, a 15m RSI+MACD read confirms or rejects it as the intermediate
 * trend, and 1m candle momentum (the always-sent base `indicators`) only times
 * *when* to enter or exit in that shared direction — it never overrides the higher
 * timeframes. `state.mtfTrend` is `{ major, intermediate }` (each a
 * `TrendSnapshot`: `rsi14`/`macdLine`/`macdSignal`/`macdHistogram`), always present
 * for this strategy; `state.indicators` still grounds entry timing and swing-level
 * stop-loss/take-profit the same way every strategy uses it.
 */
export function buildQuestions(): StrategyQuestions {
  return {
    questions: {
      scenario: choice(
        "Given this coin's major trend on the 4h timeframe (`mtfTrend.major`: RSI 14, MACD line/signal/" +
          'histogram), its intermediate trend on the 15m timeframe (`mtfTrend.intermediate`, same shape), and ' +
          'its short-term 1m price structure (`indicators`), what is the overall market scenario for this coin ' +
          'right now, independent of any specific open position? This is a read on whether the coin is worth ' +
          'trading at all, not a trade action.',
        {
          bull: 'The major and intermediate trends favor upside — a reasonable environment to look for longs or hold existing longs.',
          bear: 'The major and intermediate trends favor downside — a reasonable environment to look for shorts or hold existing shorts.',
          neutral: 'The major and intermediate trends disagree or are both flat — this coin is not worth trading; ignore it for now.',
        },
      ),
      action: choice(
        "Given this coin's major (4h) and intermediate (15m) trend reads (`mtfTrend`) and its 1m price " +
          'structure/momentum (`indicators`) and, if present, the currently open hypothetical position on it, ' +
          'what is the single best next action for a short-term perpetuals trader trading this coin right now? ' +
          'Only choose buy or sell when the major and intermediate trends agree on a direction — use the 1m ' +
          "data only to time *when* to act in that direction, never to trade against the higher timeframes. " +
          'When the major and intermediate trends disagree, hold.',
        {
          buy: 'Major and intermediate trends agree bullish, and 1m momentum confirms this is a good moment to open or flip to a long.',
          sell: 'Major and intermediate trends agree bearish, and 1m momentum confirms this is a good moment to open or flip to a short.',
          hold: 'Major and intermediate trends disagree, or neither the trend nor the 1m timing favors acting — keep any existing position as-is.',
        },
      ),
      riskWidth: score(
        "Given how well this coin's major (4h) and intermediate (15m) trends agree and its current " +
          'volatility (`indicators.atrPercent`), how much room should a stop-loss and take-profit give this ' +
          'trade relative to the nearest swing support/resistance — tight and close to structure, a normal ' +
          'distance, or wide to avoid getting clipped by noise?',
        RISK_WIDTH_RUBRIC,
      ),
      majorTrend: score(
        "How does this coin's 4h RSI and MACD (`mtfTrend.major`) read on a bearish-to-bullish major-trend scale?",
        MAJOR_TREND_RUBRIC,
      ),
      intermediateTrend: score(
        "How does this coin's 15m RSI and MACD (`mtfTrend.intermediate`) read on a bearish-to-bullish " +
          'intermediate-trend scale?',
        INTERMEDIATE_TREND_RUBRIC,
      ),
      entryTiming: score(
        "How does this coin's 1m EMA stack and RSI (`indicators`) read on a bearish-to-bullish short-term " +
          'entry-timing scale?',
        ENTRY_TIMING_RUBRIC,
      ),
      alignment: score(
        'How well do the 4h major trend and 15m intermediate trend (`mtfTrend`) agree with each other, on a ' +
          'low-to-high trading-conviction scale?',
        ALIGNMENT_RUBRIC,
      ),
      volatility: score(
        "How does this coin's ATR% of price (volatility) read on a low-to-high trading-conviction scale?",
        VOLATILITY_RUBRIC,
      ),
      regime: score(
        "How does this coin's current regime tag read on a low-to-high trading-conviction scale?",
        REGIME_RUBRIC,
      ),
    },
    factorMeta: [
      { key: 'majorTrend', label: '4h Trend', kind: 'directional' },
      { key: 'intermediateTrend', label: '15m Trend', kind: 'directional' },
      { key: 'entryTiming', label: 'Entry Timing', kind: 'directional' },
      { key: 'alignment', label: 'Alignment', kind: 'conviction' },
      { key: 'volatility', label: 'Volatility', kind: 'conviction' },
      { key: 'regime', label: 'Regime', kind: 'conviction' },
    ],
  }
}
