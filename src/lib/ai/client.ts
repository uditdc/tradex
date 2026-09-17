import type { AiContext } from './types'

async function postJson(path: string, body: unknown): Promise<string> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status} ${res.statusText}`)
  }
  const { text } = (await res.json()) as { text: string }
  return text
}

export function requestAsk(context: AiContext, question: string): Promise<string> {
  return postJson('/api/ask', { context, question })
}
