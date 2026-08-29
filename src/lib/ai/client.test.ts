import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestAsk, requestRead } from './client'
import type { AiContext } from './types'

function jsonResponse(text: string) {
  return new Response(JSON.stringify({ text }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const context = { symbol: 'HYPE', interval: '1h' } as unknown as AiContext

describe('requestRead / requestAsk', () => {
  it('posts the context to /api/read and returns the response text', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse('{"bias":"long"}'))
    vi.stubGlobal('fetch', fetchMock)

    const text = await requestRead(context)

    expect(text).toBe('{"bias":"long"}')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/read',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(context) }),
    )
  })

  it('requestAsk posts { context, question } to /api/ask', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse('the trend is up'))
    vi.stubGlobal('fetch', fetchMock)

    const text = await requestAsk(context, 'what is the trend?')

    expect(text).toBe('the trend is up')
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
    await expect(requestRead(context)).rejects.toThrow('/api/read failed: 500')
  })
})
