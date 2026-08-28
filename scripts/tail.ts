import { CandleBuffer } from '../src/lib/hl/buffer'
import { DEFAULT_CANDLE_LOOKBACK, intervalMs } from '../src/lib/hl/intervals'
import { candleSnapshot } from '../src/lib/hl/rest'
import { subscribeCandles } from '../src/lib/hl/ws'
import { MIN_CANDLES, computeAll } from '../src/lib/indicators'
import type { Candle } from '../src/lib/hl/types'

const [coin, interval] = process.argv.slice(2)
if (!coin || !interval) {
  console.error('usage: pnpm tail <coin> <interval>')
  process.exit(1)
}

function logTick(candle: Candle, buffer: CandleBuffer) {
  const time = new Date(candle.openTime).toISOString()
  if (buffer.all.length < MIN_CANDLES) {
    console.log(`${time}  price ${candle.close}  (warming up: ${buffer.all.length}/${MIN_CANDLES})`)
    return
  }
  const dict = computeAll(buffer.all)
  console.log(
    `${time}  price ${candle.close}  bias ${dict.bias}  regime ${dict.regime}  rsi14 ${dict.rsi14.toFixed(2)}  atr% ${dict.atrPercent.toFixed(3)}`,
  )
}

async function main() {
  const ms = intervalMs(interval)
  const snapshot = await candleSnapshot(coin, interval, Date.now() - DEFAULT_CANDLE_LOOKBACK * ms, Date.now())
  const buffer = new CandleBuffer(snapshot)

  console.log(`${coin} ${interval} — bootstrapped with ${snapshot.length} candles, tailing live...`)

  let closedCount = 0

  const subscription = subscribeCandles(coin, interval, {
    onStatus: (status) => console.log(`[ws] ${status}`),
    onCandle: (candle) => {
      const closed = buffer.push(candle)
      if (closed) {
        closedCount++
        const time = new Date(closed.openTime).toISOString()
        console.log(
          `CLOSED #${closedCount}  ${time}  O ${closed.open}  H ${closed.high}  L ${closed.low}  C ${closed.close}  V ${closed.volume}`,
        )
      }
      logTick(candle, buffer)
    },
  })

  process.on('SIGINT', () => {
    console.log(`\nstopping — observed ${closedCount} closed bar(s)`)
    subscription.close()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
