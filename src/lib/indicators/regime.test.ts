import { describe, expect, it } from 'vitest'
import { classifyRegime } from './regime'

describe('classifyRegime', () => {
  it('is compressing when volatility has contracted well below its trailing average', () => {
    const regime = classifyRegime({
      price: 100,
      ema9: 102,
      ema21: 101,
      ema55: 99,
      atrPercent: 1,
      atrPercentAvg: 2,
    })
    expect(regime).toBe('compressing')
  })

  it('is trending when the EMA stack is monotonic with real separation', () => {
    const regime = classifyRegime({
      price: 100,
      ema9: 102,
      ema21: 101,
      ema55: 99,
      atrPercent: 1,
      atrPercentAvg: 1,
    })
    expect(regime).toBe('trending')
  })

  it('is trending on a monotonic downward stack too', () => {
    const regime = classifyRegime({
      price: 100,
      ema9: 98,
      ema21: 99,
      ema55: 101,
      atrPercent: 1,
      atrPercentAvg: 1,
    })
    expect(regime).toBe('trending')
  })

  it('is ranging when the EMA stack is not monotonically ordered', () => {
    const regime = classifyRegime({
      price: 100,
      ema9: 100.1,
      ema21: 99.9,
      ema55: 100.05,
      atrPercent: 1,
      atrPercentAvg: 1,
    })
    expect(regime).toBe('ranging')
  })

  it('is ranging when the stack is ordered but barely separated', () => {
    const regime = classifyRegime({
      price: 100,
      ema9: 100.2,
      ema21: 100.1,
      ema55: 100.0,
      atrPercent: 1,
      atrPercentAvg: 1,
    })
    expect(regime).toBe('ranging')
  })
})
