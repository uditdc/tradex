import { READS_STORE, withStore } from './db'
import type { AiRead } from '../ai/types'

export interface StoredRead {
  id: number
  key: string
  coin: string
  interval: string
  timestamp: number
  text: string
  parsed: AiRead | null
}

type NewStoredRead = Omit<StoredRead, 'id'>

/** Capped per `${coin}:${interval}` key so a long session doesn't grow the DB unbounded. */
const HISTORY_CAP = 20

function keyFor(coin: string, interval: string): string {
  return `${coin}:${interval}`
}

async function historyByKey(key: string): Promise<StoredRead[]> {
  const all = await withStore<StoredRead[]>(READS_STORE, 'readonly', (store) => store.index('key').getAll(key))
  return all.sort((a, b) => a.timestamp - b.timestamp)
}

/** Persists a completed read and trims that coin/interval's history back down to the cap. */
export async function saveRead(
  coin: string,
  interval: string,
  entry: { timestamp: number; text: string; parsed: AiRead | null },
): Promise<void> {
  const key = keyFor(coin, interval)
  const record: NewStoredRead = { key, coin, interval, ...entry }
  await withStore(READS_STORE, 'readwrite', (store) => store.add(record))

  const history = await historyByKey(key)
  const overflow = history.slice(0, Math.max(0, history.length - HISTORY_CAP))
  for (const stale of overflow) {
    await withStore(READS_STORE, 'readwrite', (store) => store.delete(stale.id))
  }
}

export async function getLatestRead(coin: string, interval: string): Promise<StoredRead | null> {
  const history = await historyByKey(keyFor(coin, interval))
  return history.length > 0 ? history[history.length - 1] : null
}

export async function getReadHistory(coin: string, interval: string): Promise<StoredRead[]> {
  return historyByKey(keyFor(coin, interval))
}
