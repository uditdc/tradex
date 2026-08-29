import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { getLatestRead, getReadHistory, saveRead } from './reads'
import type { AiRead } from '../ai/types'

const READ: AiRead = {
  bias: 'long',
  key_levels: [],
  invalidation: 'breaks below 100',
  confidence: 0.7,
  rationale: 'trending up',
}

beforeEach(() => {
  indexedDB = new IDBFactory()
})

describe('saveRead / getLatestRead / getReadHistory', () => {
  it('returns null when nothing has been saved for a key', async () => {
    expect(await getLatestRead('BTC', '1h')).toBeNull()
  })

  it('round-trips a saved read', async () => {
    await saveRead('BTC', '1h', { timestamp: 1000, text: 'raw', parsed: READ })
    const latest = await getLatestRead('BTC', '1h')
    expect(latest).toMatchObject({ coin: 'BTC', interval: '1h', timestamp: 1000, text: 'raw', parsed: READ })
  })

  it('keeps histories separate per coin/interval key', async () => {
    await saveRead('BTC', '1h', { timestamp: 1000, text: 'btc-1h', parsed: null })
    await saveRead('BTC', '4h', { timestamp: 1000, text: 'btc-4h', parsed: null })
    await saveRead('ETH', '1h', { timestamp: 1000, text: 'eth-1h', parsed: null })

    expect((await getLatestRead('BTC', '1h'))?.text).toBe('btc-1h')
    expect((await getLatestRead('BTC', '4h'))?.text).toBe('btc-4h')
    expect((await getLatestRead('ETH', '1h'))?.text).toBe('eth-1h')
  })

  it('getLatestRead returns the most recent by timestamp, not insertion order', async () => {
    await saveRead('BTC', '1h', { timestamp: 2000, text: 'newer', parsed: null })
    await saveRead('BTC', '1h', { timestamp: 1000, text: 'older', parsed: null })
    expect((await getLatestRead('BTC', '1h'))?.text).toBe('newer')
  })

  it('getReadHistory returns ascending by timestamp', async () => {
    await saveRead('BTC', '1h', { timestamp: 2000, text: 'b', parsed: null })
    await saveRead('BTC', '1h', { timestamp: 1000, text: 'a', parsed: null })
    await saveRead('BTC', '1h', { timestamp: 3000, text: 'c', parsed: null })
    const history = await getReadHistory('BTC', '1h')
    expect(history.map((r) => r.text)).toEqual(['a', 'b', 'c'])
  })

  it('caps history per key, dropping the oldest entries first', async () => {
    for (let i = 0; i < 25; i++) {
      await saveRead('BTC', '1h', { timestamp: i, text: `read-${i}`, parsed: null })
    }
    const history = await getReadHistory('BTC', '1h')
    expect(history).toHaveLength(20)
    expect(history[0].text).toBe('read-5')
    expect(history[history.length - 1].text).toBe('read-24')
  })
})
