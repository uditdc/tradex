import { computeAll } from '../src/lib/indicators'
import { candleSnapshot, metaAndAssetCtxs } from '../src/lib/hl/rest'
import { DEFAULT_CANDLE_LOOKBACK, intervalMs } from '../src/lib/hl/intervals'

const [coin, interval] = process.argv.slice(2)
if (!coin || !interval) {
  console.error('usage: pnpm probe <coin> <interval>')
  process.exit(1)
}

async function main() {
  const ms = intervalMs(interval)

  const [candles, ctx] = await Promise.all([
    candleSnapshot(coin, interval, Date.now() - DEFAULT_CANDLE_LOOKBACK * ms, Date.now()),
    metaAndAssetCtxs(coin),
  ])

  console.log(`${coin} ${interval} — last 5 candles`)
  for (const candle of candles.slice(-5)) {
    const time = new Date(candle.openTime).toISOString()
    console.log(
      `${time}  O ${candle.open}  H ${candle.high}  L ${candle.low}  C ${candle.close}  V ${candle.volume}`,
    )
  }

  console.log()
  console.log(`mark ${ctx.markPx}  oracle ${ctx.oraclePx}  mid ${ctx.midPx}`)
  console.log(`funding ${ctx.funding}  openInterest ${ctx.openInterest}`)

  console.log()
  console.log(`indicators (${candles.length} candles)`)
  const dict = computeAll(candles)
  console.log(`bias ${dict.bias}  regime ${dict.regime}`)
  console.log(`ema9 ${dict.ema9.toFixed(4)}  ema21 ${dict.ema21.toFixed(4)}  ema55 ${dict.ema55.toFixed(4)}`)
  console.log(`rsi14 ${dict.rsi14.toFixed(2)}  atr% ${dict.atrPercent.toFixed(3)}  volRatio ${dict.volumeRatio.toFixed(3)}`)
  console.log(
    `support ${dict.swingSupport ? `${dict.swingSupport.price} (-${dict.swingSupport.distancePercent.toFixed(2)}%)` : 'none'}`,
  )
  console.log(
    `resistance ${dict.swingResistance ? `${dict.swingResistance.price} (+${dict.swingResistance.distancePercent.toFixed(2)}%)` : 'none'}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
