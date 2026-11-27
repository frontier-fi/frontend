import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { bn, fNum } from '../utils/numbers'
import { getYieldBearingTokenUrl, useAprTooltip } from './useAprTooltip'
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

it('builds yield-bearing token URLs for Aave, Aave Pro, Neverland, and Euler', () => {
  expect(
    getYieldBearingTokenUrl({
      protocolId: 'boosted_aave',
      chain: GqlChainValues.Monad,
      tokenAddress: '0xc554affe2f581f5e0811e0d42d484ecac5c6b8e2',
      underlyingAddress: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
      underlyingSymbol: 'USDC',
    })
  ).toBe(
    'https://app.aave.com/reserve-overview/?underlyingAsset=0x754704bc059f8c67012fed69bc8a327a5aafb603&marketName=proto_monad_v3'
  )

  expect(
    getYieldBearingTokenUrl({
      protocolId: 'boosted_aave_pro',
      chain: GqlChainValues.Mainnet,
      tokenAddress: '0x531e90a2376902de8915789fcc1075e3b0c153e7',
      underlyingAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      underlyingSymbol: 'USDC',
    })
  ).toBe('https://pro.aave.com/explore/earn')

  expect(
    getYieldBearingTokenUrl({
      protocolId: 'boosted_neverland',
      chain: GqlChainValues.Monad,
      tokenAddress: '0x8d5c2df3eef09088fcccf3376d8ecd0dd505f642',
      underlyingAddress: '0x754704bc059f8c67012fed69bc8a327a5aafb603',
      underlyingSymbol: 'USDC',
    })
  ).toBe('https://app.neverland.money/markets?asset=usdc')

  expect(
    getYieldBearingTokenUrl({
      protocolId: 'boosted_euler',
      chain: GqlChainValues.Monad,
      tokenAddress: '0xe1bca19baa63894d374578320551633320436523',
      underlyingAddress: '0x754704bc059f8c67012fed69bc8a327a5aafb603',
      underlyingSymbol: 'USDC',
    })
  ).toBe('https://app.euler.finance/vault/0xe1bca19baa63894d374578320551633320436523?network=monad')

  expect(
    getYieldBearingTokenUrl({
      protocolId: 'boosted_unknown',
      chain: GqlChainValues.Monad,
      tokenAddress: '0x1234',
    })
  ).toBeUndefined()
})
