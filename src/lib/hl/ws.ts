import { rawCandleToCandle } from './mappers'
import type { Candle, RawCandle } from './types'

const WS_URL = 'wss://api.hyperliquid.xyz/ws'
const PING_INTERVAL_MS = 15_000

export type ConnectionStatus = 'connecting' | 'open' | 'closed'

export interface SubscribeCandlesOptions {
  onCandle: (candle: Candle) => void
  onStatus?: (status: ConnectionStatus) => void
  /** Round-trip time in ms, measured via Hyperliquid's ping/pong heartbeat. */
  onLatency?: (ms: number) => void
  /** Overridable so tests can inject a fake WebSocket; defaults to the global one. */
  WebSocketImpl?: typeof WebSocket
  minBackoffMs?: number
  maxBackoffMs?: number
  pingIntervalMs?: number
}

export interface CandleSubscription {
  close: () => void
}

interface CandleChannelMessage {
  channel: 'candle'
  data: RawCandle
}

function channelOf(msg: unknown): string | null {
  if (typeof msg !== 'object' || msg === null) return null
  const channel = (msg as { channel?: unknown }).channel
  return typeof channel === 'string' ? channel : null
}

function isCandleMessage(msg: unknown): msg is CandleChannelMessage {
  return channelOf(msg) === 'candle'
}

export function subscribeCandles(
  coin: string,
  interval: string,
  options: SubscribeCandlesOptions,
): CandleSubscription {
  const {
    onCandle,
    onStatus,
    onLatency,
    WebSocketImpl = WebSocket,
    minBackoffMs = 500,
    maxBackoffMs = 30_000,
    pingIntervalMs = PING_INTERVAL_MS,
  } = options

  let ws: WebSocket | null = null
  let backoffMs = minBackoffMs
  let closedByCaller = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let pingTimer: ReturnType<typeof setInterval> | null = null
  let lastPingSentAt: number | null = null

  function stopPinging() {
    if (pingTimer) clearInterval(pingTimer)
    pingTimer = null
    lastPingSentAt = null
  }

  function connect() {
    onStatus?.('connecting')
    const socket = new WebSocketImpl(WS_URL)
    ws = socket

    socket.onopen = () => {
      backoffMs = minBackoffMs
      onStatus?.('open')
      socket.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'candle', coin, interval } }))

      pingTimer = setInterval(() => {
        lastPingSentAt = Date.now()
        socket.send(JSON.stringify({ method: 'ping' }))
      }, pingIntervalMs)
    }

    socket.onmessage = (event: MessageEvent) => {
      let msg: unknown
      try {
        msg = JSON.parse(event.data as string)
      } catch {
        return
      }
      if (isCandleMessage(msg)) {
        onCandle(rawCandleToCandle(msg.data))
      } else if (channelOf(msg) === 'pong' && lastPingSentAt !== null) {
        onLatency?.(Date.now() - lastPingSentAt)
        lastPingSentAt = null
      }
    }

    socket.onclose = () => {
      stopPinging()
      onStatus?.('closed')
      if (closedByCaller) return
      reconnectTimer = setTimeout(connect, backoffMs)
      backoffMs = Math.min(backoffMs * 2, maxBackoffMs)
    }

    socket.onerror = () => {
      socket.close()
    }
  }

  connect()

  return {
    close() {
      closedByCaller = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      stopPinging()
      ws?.close()
    },
  }
}
