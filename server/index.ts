import { serve } from '@hono/node-server'
import { TypeSafeClient, choice } from '@typesafe-ai/sdk'
import { Hono } from 'hono'

const LLM_API_KEY = process.env.LLM_API_KEY
const LLM_BASE_URL = process.env.LLM_BASE_URL ?? 'https://openrouter.ai/api/v1'
const LLM_MODEL = process.env.LLM_MODEL

if (!LLM_API_KEY || !LLM_MODEL) {
  throw new Error('LLM_API_KEY and LLM_MODEL must be set in server/.env')
}

// Separate, optional provider: the fast typed buy/sell/hold judgment that drives the
// trading bot (see lib/sim.ts's decideBotAction). Unlike the narrative LLM above, this
// isn't required at startup — the bot is opt-in (off by default), so a missing key just
// disables /api/bot-decision with a clear error instead of blocking the whole server.
const typesafeClient = process.env.TYPESAFE_API_KEY ? new TypeSafeClient() : null

const ASK_SYSTEM_PROMPT = `You are a market-read assistant embedded in a Hyperliquid perpetuals trading terminal.
You will receive a JSON object describing one coin's current market data (candles, indicators, funding,
open interest, order book) followed by the user's question. Answer concisely, referencing the specific
data given rather than generic trading advice. Plain text, no JSON required.`

interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

async function requestCompletion(messages: ChatMessage[]): Promise<string> {
  const upstream = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({ model: LLM_MODEL, messages, stream: false }),
  })

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => upstream.statusText)
    console.error(`upstream LLM request failed: ${upstream.status} ${detail}`)
    return `[error] upstream request failed: ${upstream.status}`
  }

  const body = (await upstream.json()) as { choices?: [{ message?: { content?: string } }] }
  return body.choices?.[0]?.message?.content ?? ''
}

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
      decision: answers.action.choice,
      confidence: answers.action.confidence,
      probabilities: answers.action.probabilities,
    })
  } catch (err) {
    console.error('TypeSafe bot-decision request failed:', err)
    return c.json({ error: 'bot decision request failed' }, 502)
  }
})

app.post('/api/ask', async (c) => {
  const { context, question } = await c.req.json()
  const text = await requestCompletion([
    { role: 'system', content: ASK_SYSTEM_PROMPT },
    { role: 'user', content: `Context:\n${JSON.stringify(context)}\n\nQuestion: ${question}` },
  ])
  return c.json({ text })
})

const port = Number(process.env.PORT ?? 8787)
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`hl-term AI server listening on http://localhost:${info.port}`)
})

export default app
