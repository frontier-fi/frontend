import { HumanAmount } from '@frontier-fi/sdk'
import { HumanTokenAmount, HumanTokenAmountWithSymbol } from '@repo/lib/modules/tokens/token.types'
import { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { calculateMigrationBreakdown, EMPTY_MIGRATION_BREAKDOWN } from './migrationBreakdown'

const TETH: Address = '0xd11c452fc99cf405034ee446803b6f6c1f6d5ed8'
const WAETH_LIDOWSTETH: Address = '0x775f661b0bd1739349b9a2a3ef60be277c5d2d29'
const GHO: Address = '0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f'

const PRICES: Record<string, number> = {
  [TETH]: 2000,
  [WAETH_LIDOWSTETH]: 2500,
  [GHO]: 1,
}

function usdValueFor({ tokenAddress, humanAmount }: HumanTokenAmount): string {
  const price = PRICES[tokenAddress.toLowerCase()]
  return price ? String(price * Number(humanAmount)) : '0'
}

function amount(
  tokenAddress: Address,
  symbol: string,
  humanAmount: string
): HumanTokenAmountWithSymbol {
  return { tokenAddress, symbol, humanAmount: humanAmount as HumanAmount, decimals: 18 }
}

describe('calculateMigrationBreakdown', () => {
  it('splits what is removed into what is deposited and what stays in the wallet', () => {
    const breakdown = calculateMigrationBreakdown({
      removed: [amount(WAETH_LIDOWSTETH, 'waEthLidowstETH', '4'), amount(TETH, 'tETH', '5')],
      deposited: [amount(WAETH_LIDOWSTETH, 'waEthLidowstETH', '3.9'), amount(TETH, 'tETH', '3')],
      usdValueFor,
    })

    expect(breakdown.removed).toEqual([
      amount(WAETH_LIDOWSTETH, 'waEthLidowstETH', '4'),
      amount(TETH, 'tETH', '5'),
    ])

    expect(breakdown.deposited).toEqual([
      amount(WAETH_LIDOWSTETH, 'waEthLidowstETH', '3.9'),
      amount(TETH, 'tETH', '3'),
    ])

    expect(breakdown.leftover).toEqual([
      amount(WAETH_LIDOWSTETH, 'waEthLidowstETH', '0.1'),
      amount(TETH, 'tETH', '2'),
    ])

    expect(breakdown.removedUsd).toBe('20000')
    expect(breakdown.depositedUsd).toBe('15750')
    expect(breakdown.leftoverUsd).toBe('4250')
    expect(breakdown.isPricedInUsd).toBe(true)
    expect(breakdown.leftoverRatio).toBeCloseTo(0.2125, 10)

    // The three totals always add up
    expect(Number(breakdown.depositedUsd) + Number(breakdown.leftoverUsd)).toBe(
      Number(breakdown.removedUsd)
    )
  })

  it('leaves a token the target pool does not take entirely in the wallet', () => {
    const breakdown = calculateMigrationBreakdown({
      removed: [amount(TETH, 'tETH', '1'), amount(GHO, 'GHO', '500')],
      deposited: [amount(TETH, 'tETH', '1')],
      usdValueFor,
    })

    expect(breakdown.leftover).toEqual([amount(GHO, 'GHO', '500')])
    expect(breakdown.leftoverUsd).toBe('500')
    expect(breakdown.leftoverRatio).toBeCloseTo(0.2, 10)
  })

  it('reports no leftover when everything removed is deposited', () => {
    const breakdown = calculateMigrationBreakdown({
      removed: [amount(TETH, 'tETH', '1')],
      deposited: [amount(TETH, 'tETH', '1')],
      usdValueFor,
    })

    expect(breakdown.leftover).toEqual([])
    expect(breakdown.leftoverUsd).toBe('0')
    expect(breakdown.leftoverRatio).toBe(0)
  })

  it('never reports a negative leftover when a deposit exceeds what was removed', () => {
    const breakdown = calculateMigrationBreakdown({
      removed: [amount(TETH, 'tETH', '1')],
      deposited: [amount(TETH, 'tETH', '1.5')],
      usdValueFor,
    })

    expect(breakdown.leftover).toEqual([])
    expect(breakdown.leftoverRatio).toBe(0)
  })

  it('matches tokens whatever the address casing and adds up repeated deposit entries', () => {
    const breakdown = calculateMigrationBreakdown({
      removed: [amount(TETH, 'tETH', '5')],
      deposited: [
        amount(TETH.toUpperCase().replace('0X', '0x') as Address, 'tETH', '1.25'),
        amount(TETH, 'tETH', '1.75'),
      ],
      usdValueFor,
    })

    expect(breakdown.leftover).toEqual([amount(TETH, 'tETH', '2')])
    expect(breakdown.leftoverRatio).toBeCloseTo(0.4, 10)
  })

  it('keeps full precision for very small leftovers', () => {
    const breakdown = calculateMigrationBreakdown({
      removed: [amount(TETH, 'tETH', '1.000000000000000001')],
      deposited: [amount(TETH, 'tETH', '1')],
      usdValueFor,
    })

    expect(breakdown.leftover).toEqual([amount(TETH, 'tETH', '0.000000000000000001')])
  })

  it('falls back to the largest share among the tokens when a removed token has no price', () => {
    const unpriced: Address = '0x1111111111111111111111111111111111111111'

    const breakdown = calculateMigrationBreakdown({
      removed: [amount(TETH, 'tETH', '10'), amount(unpriced, 'NOPRICE', '10')],
      deposited: [amount(TETH, 'tETH', '9'), amount(unpriced, 'NOPRICE', '7')],
      usdValueFor,
    })

    expect(breakdown.isPricedInUsd).toBe(false)
    // 10% of tETH and 30% of NOPRICE stay behind: without prices, assume the worse of the two
    expect(breakdown.leftoverRatio).toBeCloseTo(0.3, 10)
  })

  it('ignores zero and invalid amounts', () => {
    const breakdown = calculateMigrationBreakdown({
      removed: [amount(TETH, 'tETH', '2'), amount(GHO, 'GHO', '0'), amount(GHO, 'GHO', '')],
      deposited: [amount(TETH, 'tETH', '1'), amount(GHO, 'GHO', 'not-a-number')],
      usdValueFor,
    })

    expect(breakdown.removed).toEqual([amount(TETH, 'tETH', '2')])
    expect(breakdown.deposited).toEqual([amount(TETH, 'tETH', '1')])
    expect(breakdown.leftover).toEqual([amount(TETH, 'tETH', '1')])
    expect(breakdown.leftoverRatio).toBeCloseTo(0.5, 10)
  })

  it('returns an empty breakdown when nothing is removed', () => {
    expect(
      calculateMigrationBreakdown({
        removed: [],
        deposited: [amount(TETH, 'tETH', '1')],
        usdValueFor,
      })
    ).toEqual(EMPTY_MIGRATION_BREAKDOWN)
  })
})
