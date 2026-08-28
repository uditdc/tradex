import { beforeEach, describe, expect, it } from 'vitest'
import { useConfigStore } from './config'

beforeEach(() => {
  localStorage.clear()
  useConfigStore.setState({
    watchlist: ['HYPE', 'BTC', 'ETH', 'SOL', 'XRP', 'DOGE'],
    defaultInterval: '1h',
    lookback: 210,
  })
})

describe('useConfigStore', () => {
  it('toggleWatchlist removes a coin that is already present', () => {
    useConfigStore.getState().toggleWatchlist('BTC')
    expect(useConfigStore.getState().watchlist).not.toContain('BTC')
  })

  it('toggleWatchlist adds a coin that is absent', () => {
    useConfigStore.setState({ watchlist: ['HYPE'] })
    useConfigStore.getState().toggleWatchlist('BTC')
    expect(useConfigStore.getState().watchlist).toEqual(['HYPE', 'BTC'])
  })

  it('caps the watchlist at 6 coins', () => {
    useConfigStore.setState({ watchlist: ['A', 'B', 'C', 'D', 'E', 'F'] })
    useConfigStore.getState().toggleWatchlist('G')
    expect(useConfigStore.getState().watchlist).toHaveLength(6)
    expect(useConfigStore.getState().watchlist).not.toContain('G')
  })

  it('setDefaultInterval and setLookback update state', () => {
    useConfigStore.getState().setDefaultInterval('4h')
    useConfigStore.getState().setLookback(300)
    expect(useConfigStore.getState().defaultInterval).toBe('4h')
    expect(useConfigStore.getState().lookback).toBe(300)
  })
})
