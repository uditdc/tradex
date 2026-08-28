import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestAsk, requestRead } from './client'
import type { AiContext } from './types'

function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]))
      } else {
        controller.close()
      }
    },
  })
}

function sseResponse(chunks: string[]) {
  return new Response(sseStream(chunks), { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const context = { symbol: 'HYPE', interval: '1h' } as unknown as AiContext

describe('requestRead / requestAsk SSE parsing', () => {
  it('accumulates JSON-encoded token events into the full text and calls onToken per chunk', async () => {
    const chunks = [
      `data: ${JSON.stringify('{"bias":')}\n\n`,
      `data: ${JSON.stringify('"long"}')}\n\n`,
      `data: [DONE]\n\n`,
    ]
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(chunks))
    vi.stubGlobal('fetch', fetchMock)

    const onToken = vi.fn()
    const full = await requestRead(context, onToken)

    expect(full).toBe('{"bias":"long"}')
    expect(onToken).toHaveBeenNthCalledWith(1, '{"bias":')
    expect(onToken).toHaveBeenNthCalledWith(2, '"long"}')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/read',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(context) }),
    )
  })

  it('handles an SSE event split across two stream chunks', async () => {
    // The "data: ...\n\n" boundary lands mid-event; the parser must buffer until the
    // full "\n\n"-terminated event is available before JSON.parsing it.
    const token = JSON.stringify('hello world')
    const event = `data: ${token}\n\n`
    const splitPoint = Math.floor(event.length / 2)
    const chunks = [event.slice(0, splitPoint), event.slice(splitPoint), 'data: [DONE]\n\n']

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(chunks)))

    const onToken = vi.fn()
    const full = await requestRead(context, onToken)

    expect(full).toBe('hello world')
    expect(onToken).toHaveBeenCalledTimes(1)
  })

  it('requestAsk posts { context, question } to /api/ask', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(['data: [DONE]\n\n']))
    vi.stubGlobal('fetch', fetchMock)

    await requestAsk(context, 'what is the trend?', vi.fn())

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ask',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ context, question: 'what is the trend?' }),
      }),
    )
  })

  it('throws when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })))
    await expect(requestRead(context, vi.fn())).rejects.toThrow('/api/read failed: 500')
  })
})
