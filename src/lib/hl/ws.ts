import { rawCandleToCandle } from './mappers'
import type { Candle, RawCandle } from './types'

const WS_URL = 'wss://api.hyperliquid.xyz/ws'

export type ConnectionStatus = 'connecting' | 'open' | 'closed'

export interface SubscribeCandlesOptions {
  onCandle: (candle: Candle) => void
  onStatus?: (status: ConnectionStatus) => void
  /** Overridable so tests can inject a fake WebSocket; defaults to the global one. */
  WebSocketImpl?: typeof WebSocket
  minBackoffMs?: number
  maxBackoffMs?: number
}

export interface CandleSubscription {
  close: () => void
}

interface CandleChannelMessage {
  channel: 'candle'
  data: RawCandle
}

function isCandleMessage(msg: unknown): msg is CandleChannelMessage {
  return typeof msg === 'object' && msg !== null && (msg as { channel?: unknown }).channel === 'candle'
}

export function subscribeCandles(
  coin: string,
  interval: string,
  options: SubscribeCandlesOptions,
): CandleSubscription {
  const {
    onCandle,
    onStatus,
    WebSocketImpl = WebSocket,
    minBackoffMs = 500,
    maxBackoffMs = 30_000,
  } = options

  let ws: WebSocket | null = null
  let backoffMs = minBackoffMs
  let closedByCaller = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  function connect() {
    onStatus?.('connecting')
    const socket = new WebSocketImpl(WS_URL)
    ws = socket

    socket.onopen = () => {
      backoffMs = minBackoffMs
      onStatus?.('open')
      socket.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'candle', coin, interval } }))
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
      }
    }

    socket.onclose = () => {
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
      ws?.close()
    },
  }
}
