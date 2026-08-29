import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const LLM_API_KEY = process.env.LLM_API_KEY
const LLM_BASE_URL = process.env.LLM_BASE_URL ?? 'https://openrouter.ai/api/v1'
const LLM_MODEL = process.env.LLM_MODEL

if (!LLM_API_KEY || !LLM_MODEL) {
  throw new Error('LLM_API_KEY and LLM_MODEL must be set in server/.env')
}

const READ_SYSTEM_PROMPT = `You are a market-read assistant embedded in a Hyperliquid perpetuals trading terminal.
You will receive a JSON object describing one coin: symbol, interval, recent OHLCV candles, a computed
indicator dict (EMA 9/21/55, RSI 14, ATR% of price, volume ratio, nearest swing support/resistance,
a regime tag), funding rate, open interest, and the top-5 order book levels on each side.

Respond with STRICT JSON ONLY — no markdown code fences, no commentary before or after — matching
exactly this shape:
{
  "bias": string,              // e.g. "long", "short", or "neutral"
  "key_levels": [{"price": number, "kind": string, "note": string}],
  "zones": [{"from": number, "to": number, "label": string}],  // optional supply/demand price ranges,
                                                                 // 0-3 of them; omit or use [] if none
                                                                 // stand out — do not force one
  "invalidation": string,      // the condition that would invalidate this read
  "confidence": number,        // 0 to 1
  "rationale": string          // at most 3 sentences
}`

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

app.post('/api/read', async (c) => {
  const context = await c.req.json()
  const text = await requestCompletion([
    { role: 'system', content: READ_SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify(context) },
  ])
  return c.json({ text })
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
