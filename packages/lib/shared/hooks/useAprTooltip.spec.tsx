import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { bn, fNum } from '../utils/numbers'
import { useAprTooltip } from './useAprTooltip'
import { aprTooltipDataMock } from './_mocks_/aprTooltipDataMock'
import BigNumber from 'bignumber.js'
import type { GqlPoolAprItem } from '../services/api/graphql-derived-types'
import { GqlChainValues } from '../services/api/graphql-enums'
import { getApiPoolMock } from '@repo/lib/modules/pool/__mocks__/api-mocks/api-mocks'
import { boostedCoinshiftUsdcUsdl } from '@repo/lib/modules/pool/__mocks__/pool-examples/boosted'

const defaultNumberFormatter = (value: string) => bn(bn(value).toFixed(4, BigNumber.ROUND_HALF_UP))

function testUseAprTooltip({ aprItems }: { aprItems: GqlPoolAprItem[] }) {
  const { result } = testHook(() =>
    useAprTooltip({
      aprItems,
      numberFormatter: defaultNumberFormatter,
      chain: GqlChainValues.Mainnet,
    })
  )

  return result
}

describe('useAprTooltip', () => {
  test('formats APRs with default formatter', () => {
    const result = testUseAprTooltip({ aprItems: aprTooltipDataMock.aprItems })

    expect(result.current.swapFeesDisplayed.toFixed()).toBe('0.0007')
    expect(fNum('apr', result.current.swapFeesDisplayed)).toBe('<0.1%')

    const yieldBearingTokensApr = result.current.yieldBearingTokensDisplayed[0]!.apr
    expect(yieldBearingTokensApr.toFixed()).toBe('0.0068')
    expect(fNum('apr', yieldBearingTokensApr)).toBe('0.7%')

    const totalBaseDisplayed = result.current.totalBaseDisplayed
    expect(totalBaseDisplayed.toFixed()).toBe('0.0075')
    expect(fNum('apr', totalBaseDisplayed)).toBe('0.8%') // 0.07% + 0.68% = 0.75% -> 0.8%
  })
})

it('When the pool has multiple Yield bearing token APRs', () => {
  const pool = getApiPoolMock(boostedCoinshiftUsdcUsdl)

  const result = testUseAprTooltip({ aprItems: pool.dynamicData.aprItems })

  /* APR should tooltip should display:
    - Yield bearing tokens 3.72%
                    csUSDL 1.72%
                    csUSDC 2%
  */
  expect(result.current.yieldBearingTokensAprDisplayed).toMatchInlineSnapshot(`"0.0372"`)

  expect(result.current.yieldBearingTokensDisplayed).toMatchInlineSnapshot(`
    [
      {
        "apr": "0.0172",
        "title": "csUSDL",
      },
      {
        "apr": "0.02",
        "title": "csUSDC",
      },
    ]
  `)
})

it('When the pool has multiple MERKL token incentives', () => {
  const pool = getApiPoolMock(boostedCoinshiftUsdcUsdl)

  const result = testUseAprTooltip({ aprItems: pool.dynamicData.aprItems })

  /* APR should tooltip should display
    - Merkl.xyz incentives: 1.80%
                     MORPHO 1.80%
  */
  expect(result.current.merklIncentivesAprDisplayed).toMatchInlineSnapshot(`"0.01778366853303084"`)

  expect(result.current.merklTokensDisplayed).toMatchInlineSnapshot(`
    [
      {
        "apr": "0.0178",
        "id": "0x10a04efba5b880e169920fd4348527c64fb29d4d-morpho",
        "title": "MORPHO",
      },
    ]
  `)
})

it('parses per-opportunity Merkl items with asset title and clickable Merkl URLs', () => {
  const aprItems: GqlPoolAprItem[] = [
    {
      __typename: 'GqlPoolAprItem',
      id: '0x43b9b77653f4240e764546d921df5c08b4c66a28-merkl-3250124745872902091',
      title: '0xFF-avUSD-waMonUSDC',
      apr: 0.0372,
      type: 'MERKL',
      rewardTokenAddress: '0x3bd359c1119da7da1d913d1c4d2b7c461115433a',
      rewardTokenSymbol: 'WMON',
    },
    {
      __typename: 'GqlPoolAprItem',
      id: '0x43b9b77653f4240e764546d921df5c08b4c66a28-merkl-9212343318075137075',
      title: 'waMonUSDC',
      apr: 0.0052,
      type: 'MERKL',
      rewardTokenAddress: '0x561ad6156d0106e7a59ee788759df7b7ec679bd0',
      rewardTokenSymbol: 'WMON',
    },
  ]

  const result = testUseAprTooltip({ aprItems })

  expect(result.current.merklIncentivesAprDisplayed.toFixed(4)).toBe('0.0424')

  expect(result.current.merklTokensDisplayed).toEqual([
    {
      id: '0x43b9b77653f4240e764546d921df5c08b4c66a28-merkl-3250124745872902091',
      title: '0xFF-avUSD-waMonUSDC',
      apr: bn('0.0372'),
      opportunityId: '3250124745872902091',
      opportunityUrl: 'https://app.merkl.xyz/opportunities/3250124745872902091',
    },
    {
      id: '0x43b9b77653f4240e764546d921df5c08b4c66a28-merkl-9212343318075137075',
      title: 'waMonUSDC',
      apr: bn('0.0052'),
      opportunityId: '9212343318075137075',
      opportunityUrl: 'https://app.merkl.xyz/opportunities/9212343318075137075',
    },
  ])
})
