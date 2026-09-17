import type { BotDecisionResult } from '../ai/bot'
import { BOT_LOG_STORE, withStore } from './db'

/** One entry in the running Jev decision log (every call, not just the latest per coin). */
export interface BotLogEntry extends BotDecisionResult {
  timestamp: number
  coin: string
}

export async function addBotLogEntry(entry: BotLogEntry): Promise<void> {
  await withStore(BOT_LOG_STORE, 'readwrite', (store) => store.add(entry))
}

export async function getBotLog(): Promise<BotLogEntry[]> {
  const all = await withStore<BotLogEntry[]>(BOT_LOG_STORE, 'readonly', (store) => store.getAll())
  return all.sort((a, b) => a.timestamp - b.timestamp)
}
