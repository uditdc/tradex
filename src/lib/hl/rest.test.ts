import { afterEach, describe, expect, it, vi } from 'vitest'
import { candleSnapshot, l2Book, metaAndAssetCtxs } from './rest'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('candleSnapshot', () => {
  it('maps raw candles into typed, numeric Candle objects', async () => {
    const raw = [
      { t: 1769911200000, T: 1769914799999, s: 'HYPE', i: '1h', o: '31.789', c: '32.119', h: '32.436', l: '31.306', v: '488276.13', n: 13995 },
    ]
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(raw))
    vi.stubGlobal('fetch', fetchMock)

    const candles = await candleSnapshot('HYPE', '1h', 0, 1)

    expect(candles).toEqual([
      {
        openTime: 1769911200000,
        closeTime: 1769914799999,
        symbol: 'HYPE',
        interval: '1h',
        open: 31.789,
        high: 32.436,
        low: 31.306,
        close: 32.119,
        volume: 488276.13,
        trades: 13995,
      },
    ])

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.hyperliquid.xyz/info',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          type: 'candleSnapshot',
          req: { coin: 'HYPE', interval: '1h', startTime: 0, endTime: 1 },
        }),
      }),
    )
  })

  it('throws when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })))
    await expect(candleSnapshot('HYPE', '1h')).rejects.toThrow('Hyperliquid info request failed')
  })
})

describe('metaAndAssetCtxs', () => {
  const rawMeta = [
    { universe: [{ name: 'BTC', szDecimals: 5, maxLeverage: 40, marginTableId: 56 }, { name: 'HYPE', szDecimals: 2, maxLeverage: 10, marginTableId: 52 }] },
    [
      { funding: '0.0000100', openInterest: '1000', prevDayPx: '80', dayNtlVlm: '1', premium: '0', oraclePx: '90', markPx: '90.1', midPx: '90.2', impactPxs: ['90', '90'], dayBaseVlm: '1' },
      { funding: '0.0000125', openInterest: '25288032.92', prevDayPx: '82.262', dayNtlVlm: '855424965.19', premium: '0.000061193', oraclePx: '83.3429', markPx: '83.344', midPx: '83.355', impactPxs: ['83.348', '83.368'], dayBaseVlm: '10159076.28' },
    ],
  ]

  it('picks the asset ctx index-aligned with the coin in universe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(rawMeta)))

    const ctx = await metaAndAssetCtxs('HYPE')

    expect(ctx).toEqual({
      coin: 'HYPE',
      markPx: 83.344,
      oraclePx: 83.3429,
      midPx: 83.355,
      funding: 0.0000125,
      openInterest: 25288032.92,
      prevDayPx: 82.262,
      dayNtlVlm: 855424965.19,
    })
  })

  it('throws on an unknown coin', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(rawMeta)))
    await expect(metaAndAssetCtxs('NOPE')).rejects.toThrow('Unknown coin: NOPE')
  })
})

describe('l2Book', () => {
  // Modeled on a real l2Book response for HYPE: levels[0] is bids (descending from
  // best bid), levels[1] is asks (ascending from best ask).
  const rawBook = {
    coin: 'HYPE',
    time: 1787917808854,
    levels: [
      [
        { px: '83.086', sz: '21.99', n: 1 },
        { px: '83.085', sz: '26.8', n: 2 },
      ],
      [
        { px: '83.087', sz: '17.3', n: 1 },
        { px: '83.088', sz: '101.14', n: 2 },
      ],
    ],
  }

  it('maps levels into typed bids/asks', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(rawBook)))

    const book = await l2Book('HYPE')

    expect(book).toEqual({
      bids: [
        { price: 83.086, size: 21.99 },
        { price: 83.085, size: 26.8 },
      ],
      asks: [
        { price: 83.087, size: 17.3 },
        { price: 83.088, size: 101.14 },
      ],
    })
  })
})
