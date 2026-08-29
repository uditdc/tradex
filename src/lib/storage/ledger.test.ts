import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { addLedgerEntry, getLedger } from './ledger'
import type { LedgerEntry } from './ledger'

const ENTRY: Omit<LedgerEntry, 'id'> = {
  coin: 'BTC',
  interval: '1h',
  side: 'long',
  sizeUsd: 5000,
  leverage: 5,
  entryPrice: 65000,
  exitPrice: 66000,
  pnl: 384.6,
  openedAt: 1000,
  closedAt: 2000,
  reason: 'manual',
}

beforeEach(() => {
  indexedDB = new IDBFactory()
})

describe('addLedgerEntry / getLedger', () => {
  it('starts empty', async () => {
    expect(await getLedger()).toEqual([])
  })

  it('records a closed position', async () => {
    await addLedgerEntry(ENTRY)
    const ledger = await getLedger()
    expect(ledger).toHaveLength(1)
    expect(ledger[0]).toMatchObject(ENTRY)
  })

  it('returns entries ordered by closedAt ascending', async () => {
    await addLedgerEntry({ ...ENTRY, closedAt: 3000, pnl: 10 })
    await addLedgerEntry({ ...ENTRY, closedAt: 1000, pnl: 20 })
    await addLedgerEntry({ ...ENTRY, closedAt: 2000, pnl: 30 })
    const ledger = await getLedger()
    expect(ledger.map((e) => e.pnl)).toEqual([20, 30, 10])
  })
})
