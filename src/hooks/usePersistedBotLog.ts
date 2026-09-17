import { useEffect } from 'react'
import { getBotLog } from '../lib/storage/botLog'
import { useAppStore } from '../store'

/** Loads the Jev call log from IndexedDB once on startup, newest first. Mount exactly once (in App.tsx). */
export function usePersistedBotLog(): void {
  useEffect(() => {
    let cancelled = false
    void getBotLog().then((entries) => {
      if (cancelled) return
      // getBotLog returns oldest-first; the UI (and addBotLogEntry) want newest-first.
      useAppStore.getState().hydrateBotLog([...entries].reverse())
    })
    return () => {
      cancelled = true
    }
  }, [])
}
