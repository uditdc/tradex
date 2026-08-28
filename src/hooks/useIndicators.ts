import { useMemo } from 'react'
import { MIN_CANDLES, computeAll } from '../lib/indicators'
import type { IndicatorDict } from '../lib/indicators/types'
import { useAppStore } from '../store'

export function useIndicators(): IndicatorDict | null {
  const candles = useAppStore((s) => s.candles)

  return useMemo(() => {
    if (candles.length < MIN_CANDLES) return null
    return computeAll(candles)
  }, [candles])
}
