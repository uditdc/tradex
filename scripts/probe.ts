import { candleSnapshot, metaAndAssetCtxs } from '../src/lib/hl/rest'

const [coin, interval] = process.argv.slice(2)
if (!coin || !interval) {
  console.error('usage: pnpm probe <coin> <interval>')
  process.exit(1)
}

const oneDayMs = 24 * 60 * 60 * 1000

async function main() {
  const [candles, ctx] = await Promise.all([
    candleSnapshot(coin, interval, Date.now() - oneDayMs, Date.now()),
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
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
