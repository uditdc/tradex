import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeCandles } from './ws'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  url: string
  sent: string[] = []
  closed = false
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.closed = true
    this.onclose?.()
  }

  // test helpers, not part of the real WebSocket surface
  emitOpen() {
    this.onopen?.()
  }

  emitMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }

  emitServerClose() {
    this.onclose?.()
  }
}

beforeEach(() => {
  FakeWebSocket.instances = []
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const candleMessage = {
  channel: 'candle',
  data: {
    t: 1787915580000,
    T: 1787915639999,
    s: 'HYPE',
    i: '1m',
    o: '83.284',
    c: '83.374',
    h: '83.385',
    l: '83.276',
    v: '945.73',
    n: 160,
  },
}

describe('subscribeCandles', () => {
  it('sends a subscribe message for the requested coin/interval on open', () => {
    subscribeCandles('HYPE', '1m', {
      onCandle: vi.fn(),
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
    })

    const socket = FakeWebSocket.instances[0]
    socket.emitOpen()

    expect(JSON.parse(socket.sent[0])).toEqual({
      method: 'subscribe',
      subscription: { type: 'candle', coin: 'HYPE', interval: '1m' },
    })
  })

  it('maps candle-channel messages into typed Candle objects', () => {
    const onCandle = vi.fn()
    subscribeCandles('HYPE', '1m', { onCandle, WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket })

    const socket = FakeWebSocket.instances[0]
    socket.emitOpen()
    socket.emitMessage(candleMessage)

    expect(onCandle).toHaveBeenCalledWith(
      expect.objectContaining({ openTime: 1787915580000, close: 83.374, symbol: 'HYPE' }),
    )
  })

  it('ignores non-candle channel messages', () => {
    const onCandle = vi.fn()
    subscribeCandles('HYPE', '1m', { onCandle, WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket })

    FakeWebSocket.instances[0].emitMessage({ channel: 'subscriptionResponse', data: {} })

    expect(onCandle).not.toHaveBeenCalled()
  })

  it('reconnects with exponential backoff after a server-initiated close', () => {
    const onStatus = vi.fn()
    subscribeCandles('HYPE', '1m', {
      onCandle: vi.fn(),
      onStatus,
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
      minBackoffMs: 100,
      maxBackoffMs: 1_000,
    })

    expect(FakeWebSocket.instances).toHaveLength(1)
    FakeWebSocket.instances[0].emitServerClose()

    // Not reconnected yet — still waiting out the backoff.
    vi.advanceTimersByTime(99)
    expect(FakeWebSocket.instances).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(FakeWebSocket.instances).toHaveLength(2)

    // Backoff doubles on each successive drop.
    FakeWebSocket.instances[1].emitServerClose()
    vi.advanceTimersByTime(199)
    expect(FakeWebSocket.instances).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(FakeWebSocket.instances).toHaveLength(3)
  })

  it('resets backoff to the minimum after a successful reconnect', () => {
    subscribeCandles('HYPE', '1m', {
      onCandle: vi.fn(),
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
      minBackoffMs: 100,
      maxBackoffMs: 1_000,
    })

    FakeWebSocket.instances[0].emitServerClose()
    vi.advanceTimersByTime(100)
    expect(FakeWebSocket.instances).toHaveLength(2)

    FakeWebSocket.instances[1].emitOpen() // successful reconnect resets backoff
    FakeWebSocket.instances[1].emitServerClose()
    vi.advanceTimersByTime(99)
    expect(FakeWebSocket.instances).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(FakeWebSocket.instances).toHaveLength(3)
  })

  it('does not reconnect after the caller explicitly closes the subscription', () => {
    const subscription = subscribeCandles('HYPE', '1m', {
      onCandle: vi.fn(),
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
      minBackoffMs: 100,
    })

    subscription.close()
    vi.advanceTimersByTime(10_000)

    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(FakeWebSocket.instances[0].closed).toBe(true)
  })
})
