import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { addBotLogEntry, getBotLog } from './botLog'
import type { BotLogEntry } from './botLog'

const ENTRY: BotLogEntry = {
  coin: 'BTC',
  timestamp: 2000,
  strategy: 'momentum',
  scenario: { choice: 'bull', confidence: 0.9, probabilities: { bull: 0.9, bear: 0.05, neutral: 0.05 } },
  action: { choice: 'buy', confidence: 0.8, probabilities: { buy: 0.8, sell: 0.1, hold: 0.1 } },
  riskWidth: { score: 1, confidence: 0.5 },
  factors: [{ key: 'trend', label: 'Trend', kind: 'directional', score: 3, confidence: 0.8 }],
}

beforeEach(() => {
  indexedDB = new IDBFactory()
})

describe('addBotLogEntry / getBotLog', () => {
  it('starts empty', async () => {
    expect(await getBotLog()).toEqual([])
  })

  it('records a Jev decision', async () => {
    await addBotLogEntry(ENTRY)
    const log = await getBotLog()
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject(ENTRY)
  })

  it('returns entries ordered by timestamp ascending', async () => {
    await addBotLogEntry({ ...ENTRY, timestamp: 3000, coin: 'A' })
    await addBotLogEntry({ ...ENTRY, timestamp: 1000, coin: 'B' })
    await addBotLogEntry({ ...ENTRY, timestamp: 2000, coin: 'C' })
    const log = await getBotLog()
    expect(log.map((e) => e.coin)).toEqual(['B', 'C', 'A'])
  })
})
