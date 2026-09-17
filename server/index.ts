import { serve } from '@hono/node-server'
import { TypeSafeClient, choice } from '@typesafe-ai/sdk'
import { Hono } from 'hono'

// The trading bot is opt-in (off by default), so a missing key doesn't block the
// server at startup — it just disables /api/bot-decision with a clear error.
const typesafeClient = process.env.TYPESAFE_API_KEY ? new TypeSafeClient() : null

const app = new Hono()

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
