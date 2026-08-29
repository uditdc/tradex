import { POSITIONS_STORE, withStore } from './db'

/**
 * A hypothetical, local-only position opened from the AI trade suggestion panel.
 * Purely a paper-trading tracker against live prices — no order is ever placed
 * (see CLAUDE.md non-goals: no execution, no wallet, no keys).
 */
export interface SimPosition {
  id: number
  coin: string
  interval: string
  side: 'long' | 'short'
  sizeUsd: number
  leverage: number
  entryPrice: number
  openedAt: number
}

export async function savePosition(position: SimPosition): Promise<void> {
  await withStore(POSITIONS_STORE, 'readwrite', (store) => store.put(position))
}

export async function deletePosition(id: number): Promise<void> {
  await withStore(POSITIONS_STORE, 'readwrite', (store) => store.delete(id))
}

export async function loadPositions(): Promise<SimPosition[]> {
  return withStore<SimPosition[]>(POSITIONS_STORE, 'readonly', (store) => store.getAll())
}
