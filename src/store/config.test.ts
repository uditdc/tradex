import { beforeEach, describe, expect, it } from 'vitest'
import { useConfigStore } from './config'

beforeEach(() => {
  localStorage.clear()
  useConfigStore.setState({
    watchlist: ['HYPE', 'BTC', 'ETH', 'SOL', 'XRP', 'DOGE'],
    defaultInterval: '1h',
    lookback: 210,
    botEnabled: false,
    sessionStartedAt: null,
    activeStrategy: 'momentum',
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

  it('startSession/endSession flip botEnabled, off by default', () => {
    expect(useConfigStore.getState().botEnabled).toBe(false)
    useConfigStore.getState().startSession()
    expect(useConfigStore.getState().botEnabled).toBe(true)
    useConfigStore.getState().endSession()
    expect(useConfigStore.getState().botEnabled).toBe(false)
  })

  it('startSession records when the session started; endSession clears it', () => {
    expect(useConfigStore.getState().sessionStartedAt).toBeNull()
    useConfigStore.getState().startSession()
    expect(useConfigStore.getState().sessionStartedAt).not.toBeNull()
    useConfigStore.getState().endSession()
    expect(useConfigStore.getState().sessionStartedAt).toBeNull()
  })
})
