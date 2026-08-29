import { useEffect } from 'react'
import { loadPositions } from '../lib/storage/positions'
import { useAppStore } from '../store'

/** Loads open paper positions from IndexedDB once on startup. Mount exactly once (in App.tsx). */
export function usePersistedPositions(): void {
  useEffect(() => {
    let cancelled = false
    void loadPositions().then((positions) => {
      if (cancelled) return
      useAppStore.getState().hydratePositions([...positions].sort((a, b) => b.openedAt - a.openedAt))
    })
    return () => {
      cancelled = true
    }
  }, [])
}
