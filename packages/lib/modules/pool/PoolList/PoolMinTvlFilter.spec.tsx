import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  DEFAULT_STOP_INDEX,
  MAX_TVL_VALUE,
  MIN_TVL_VALUE,
  PoolMinTvlFilter,
  stopIndexToTvl,
  TVL_STOPS,
  tvlToStopIndex,
} from './PoolMinTvlFilter'
import { DEFAULT_MIN_TVL } from './usePoolListQueryState'

const mockSetMinTvl = vi.fn()
const mockToCurrency = vi.fn((value: number | string) => `$${Number(value).toLocaleString()}`)

vi.mock('./PoolListProvider', async importOriginal => {
  const actual = await importOriginal<typeof import('./PoolListProvider')>()
  return {
    ...actual,
    usePoolList: vi.fn(),
  }
})

vi.mock('@repo/lib/shared/hooks/useCurrency', () => ({
  useCurrency: () => ({ toCurrency: mockToCurrency }),
}))

import { usePoolList } from './PoolListProvider'

const mockedUsePoolList = vi.mocked(usePoolList)

describe('PoolMinTvlFilter', () => {
  it('snaps logarithmically across round 1 / 2.5 / 5 / 10 TVL stops between $1 and $1M', () => {
    expect(tvlToStopIndex(MIN_TVL_VALUE)).toBe(0)
    expect(tvlToStopIndex(10)).toBe(3)
    expect(tvlToStopIndex(DEFAULT_MIN_TVL)).toBe(DEFAULT_STOP_INDEX)
    expect(tvlToStopIndex(1_000)).toBe(9)
    expect(tvlToStopIndex(10_000)).toBe(12)
    expect(tvlToStopIndex(MAX_TVL_VALUE)).toBe(TVL_STOPS.length - 1)

    expect(stopIndexToTvl(0)).toBe(1)
    expect(stopIndexToTvl(DEFAULT_STOP_INDEX)).toBe(100)
    expect(stopIndexToTvl(9)).toBe(1_000)
    expect(stopIndexToTvl(12)).toBe(10_000)
    expect(stopIndexToTvl(TVL_STOPS.length - 1)).toBe(MAX_TVL_VALUE)

    // Arbitrary intermediate values snap to nearest logarithmic round stop
    expect(stopIndexToTvl(tvlToStopIndex(95))).toBe(100)
    expect(stopIndexToTvl(tvlToStopIndex(110))).toBe(100)
  })

  it('resets the slider to the new minTvl value when minTvl changes', () => {
    mockedUsePoolList.mockReturnValue({
      queryState: {
        minTvl: DEFAULT_MIN_TVL,
        setMinTvl: mockSetMinTvl,
      },
    } as unknown as ReturnType<typeof usePoolList>)

    const { rerender, container } = render(<PoolMinTvlFilter />)

    const slider = container.querySelector('[role="slider"]')
    expect(slider).toHaveAttribute('aria-valuenow', String(DEFAULT_STOP_INDEX))

    mockedUsePoolList.mockReturnValue({
      queryState: {
        minTvl: 1_000_000,
        setMinTvl: mockSetMinTvl,
      },
    } as unknown as ReturnType<typeof usePoolList>)

    rerender(<PoolMinTvlFilter />)

    const resetSlider = container.querySelector('[role="slider"]')
    expect(resetSlider).toHaveAttribute('aria-valuenow', '18')
  })

  it('shows the swap routing note only when minTvl is below $100', () => {
    mockedUsePoolList.mockReturnValue({
      queryState: {
        minTvl: DEFAULT_MIN_TVL,
        setMinTvl: mockSetMinTvl,
      },
    } as unknown as ReturnType<typeof usePoolList>)

    const { rerender } = render(<PoolMinTvlFilter />)

    expect(screen.queryByText(/excluded from swap routing/i)).not.toBeInTheDocument()

    mockedUsePoolList.mockReturnValue({
      queryState: {
        minTvl: 1,
        setMinTvl: mockSetMinTvl,
      },
    } as unknown as ReturnType<typeof usePoolList>)

    rerender(<PoolMinTvlFilter />)

    expect(
      screen.getByText('Pools under $100 TVL are excluded from swap routing.')
    ).toBeInTheDocument()
  })
})
