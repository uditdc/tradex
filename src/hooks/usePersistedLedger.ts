import { useEffect } from 'react'
import { getLedger } from '../lib/storage/ledger'
import { useAppStore } from '../store'

/** Loads the realized-PnL ledger (total and full history) from IndexedDB once on startup. Mount exactly once (in App.tsx). */
export function usePersistedLedger(): void {
  useEffect(() => {
    let cancelled = false
    void getLedger().then((entries) => {
      if (cancelled) return
      const total = entries.reduce((sum, e) => sum + e.pnl, 0)
      const { hydrateRealizedPnl, hydrateLedger } = useAppStore.getState()
      hydrateRealizedPnl(total)
      // getLedger returns oldest-first; the UI wants newest-first.
      hydrateLedger([...entries].reverse())
    })
    return () => {
      cancelled = true
    }
  }, [])
}
