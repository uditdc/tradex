/** Latest bar's volume divided by the simple average of the trailing `period` bars (inclusive). */
export function volumeRatio(volumes: number[], period = 20): number | null {
  if (volumes.length < period) return null
  const window = volumes.slice(-period)
  const avg = window.reduce((sum, v) => sum + v, 0) / period
  if (avg === 0) return null
  return volumes[volumes.length - 1] / avg
}
