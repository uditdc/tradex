import type { AiContext } from './types'

/**
 * Consumes an SSE stream where each event's data is a JSON-encoded token string
 * (so tokens can safely contain newlines), terminated by a literal `[DONE]` event.
 * Calls `onToken` per chunk and returns the full accumulated text.
 */
async function consumeTokenStream(body: ReadableStream<Uint8Array>, onToken: (text: string) => void): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const event of events) {
      const line = event.trim()
      if (!line.startsWith('data:')) continue
      const payload = line.slice('data:'.length).trim()
      if (payload === '[DONE]') continue
      const token = JSON.parse(payload) as string
      full += token
      onToken(token)
    }
  }

  return full
}

async function postSSE(path: string, body: unknown, onToken: (text: string) => void): Promise<string> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) {
    throw new Error(`${path} failed: ${res.status} ${res.statusText}`)
  }
  return consumeTokenStream(res.body, onToken)
}

export function requestRead(context: AiContext, onToken: (text: string) => void): Promise<string> {
  return postSSE('/api/read', context, onToken)
}

export function requestAsk(context: AiContext, question: string, onToken: (text: string) => void): Promise<string> {
  return postSSE('/api/ask', { context, question }, onToken)
}
