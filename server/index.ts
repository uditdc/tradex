import { serve } from '@hono/node-server'
import { TypeSafeClient } from '@typesafe-ai/sdk'
import type { ChoiceResponse, ScoreResponse } from '@typesafe-ai/sdk'
import { Hono } from 'hono'
import * as momentum from './strategies/momentum'
import * as orderbook from './strategies/orderbook'

// The trading bot is opt-in (off by default), so a missing key doesn't block the
// server at startup — it just disables /api/bot-decision with a clear error.
const typesafeClient = process.env.TYPESAFE_API_KEY ? new TypeSafeClient() : null

const app = new Hono()

const STRATEGIES = { momentum, orderbook } as const
type StrategyId = keyof typeof STRATEGIES

function isStrategyId(value: unknown): value is StrategyId {
  return typeof value === 'string' && value in STRATEGIES
}

app.post('/api/bot-decision', async (c) => {
  if (!typesafeClient) {
    return c.json({ error: 'TYPESAFE_API_KEY not set in server/.env — the trading bot needs a TypeSafe API key' }, 503)
  }

  const { strategy, symbol, indicators, orderBook, position } = await c.req.json()
  if (!isStrategyId(strategy)) {
    return c.json({ error: `unknown strategy: ${String(strategy)}` }, 400)
  }

  try {
    const { questions, factorMeta } = STRATEGIES[strategy].buildQuestions()
    const { answers } = await typesafeClient.systemOne({
      state: { symbol, indicators, orderBook, openPosition: position },
      questions,
    })

    // Which question set got built is only known at request time (the caller picked a
    // strategy), so `answers` can't carry per-key literal types the way a single fixed
    // question set could — these are narrow, deliberate casts, not a loosened contract.
    const scenario = answers.scenario as ChoiceResponse
    const action = answers.action as ChoiceResponse
    const riskWidth = answers.riskWidth as ScoreResponse

    return c.json({
      strategy,
      scenario: { choice: scenario.choice, confidence: scenario.confidence, probabilities: scenario.probabilities },
      action: { choice: action.choice, confidence: action.confidence, probabilities: action.probabilities },
      riskWidth: { score: riskWidth.score, confidence: riskWidth.confidence },
      factors: factorMeta.map(({ key, label, kind }) => {
        const answer = answers[key] as ScoreResponse
        return { key, label, kind, score: answer.score, confidence: answer.confidence }
      }),
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
