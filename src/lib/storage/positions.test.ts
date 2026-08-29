import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { deletePosition, loadPositions, savePosition } from './positions'
import type { SimPosition } from './positions'

const POSITION: SimPosition = {
  id: 1000,
  coin: 'BTC',
  interval: '1h',
  side: 'long',
  sizeUsd: 5000,
  leverage: 5,
  entryPrice: 65000,
  openedAt: 1000,
}

beforeEach(() => {
  indexedDB = new IDBFactory()
})

describe('savePosition / loadPositions / deletePosition', () => {
  it('starts empty', async () => {
    expect(await loadPositions()).toEqual([])
  })

  it('round-trips a saved position', async () => {
    await savePosition(POSITION)
    expect(await loadPositions()).toEqual([POSITION])
  })

  it('loads multiple saved positions', async () => {
    await savePosition(POSITION)
    await savePosition({ ...POSITION, id: 2000, coin: 'ETH' })
    const loaded = await loadPositions()
    expect(loaded).toHaveLength(2)
    expect(loaded.map((p) => p.coin).sort()).toEqual(['BTC', 'ETH'])
  })

  it('deletes a position by id', async () => {
    await savePosition(POSITION)
    await savePosition({ ...POSITION, id: 2000, coin: 'ETH' })
    await deletePosition(1000)
    const loaded = await loadPositions()
    expect(loaded).toEqual([{ ...POSITION, id: 2000, coin: 'ETH' }])
  })
})
