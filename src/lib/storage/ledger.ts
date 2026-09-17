import { LEDGER_STORE, withStore } from './db'

export type CloseReason = 'manual' | 'stop_loss' | 'take_profit' | 'bot'

/** One realized close (manual or SL/TP-triggered), booked for the running paper-portfolio ledger. */
export interface LedgerEntry {
  id: number
  coin: string
  interval: string
  side: 'long' | 'short'
  sizeUsd: number
  leverage: number
  entryPrice: number
  exitPrice: number
  pnl: number
  openedAt: number
  closedAt: number
  reason: CloseReason
}

type NewLedgerEntry = Omit<LedgerEntry, 'id'>

export async function addLedgerEntry(entry: NewLedgerEntry): Promise<void> {
  await withStore(LEDGER_STORE, 'readwrite', (store) => store.add(entry))
}

export async function getLedger(): Promise<LedgerEntry[]> {
  const all = await withStore<LedgerEntry[]>(LEDGER_STORE, 'readonly', (store) => store.getAll())
  return all.sort((a, b) => a.closedAt - b.closedAt)
}
