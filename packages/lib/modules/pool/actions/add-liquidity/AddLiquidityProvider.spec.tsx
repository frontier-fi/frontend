import { afterEach } from 'vitest'
import {
  balAddress,
  daiAddress,
  usdcAddress,
  usdtAddress,
  wETHAddress,
} from '@repo/lib/debug-helpers'
import type { GqlPoolElement } from '@repo/lib/shared/services/api/graphql-derived-types'
import {
  DefaultAddLiquidityTestProvider,
  buildDefaultPoolTestProvider,
  testHook,
} from '@repo/lib/test/utils/custom-renderers'
import { AddLiquidityHandler } from './handlers/AddLiquidity.handler'
import { PropsWithChildren } from 'react'
import { useAddLiquidityLogic } from './AddLiquidityProvider'
import { nestedPoolMock } from '../../__mocks__/nestedPoolMock'
import { aBalWethPoolElementMock } from '@repo/lib/test/msw/builders/gqlPoolElement.builders'

let mockSupportsNestedActions: boolean | undefined

vi.mock('@repo/lib/config/app.config', async importOriginal => {
  const actual = await importOriginal<typeof import('@repo/lib/config/app.config')>()
  return {
    ...actual,
    getNetworkConfig: (chain?: Parameters<typeof actual.getNetworkConfig>[0]) => {
      const config = actual.getNetworkConfig(chain)
      if (mockSupportsNestedActions === undefined) return config
      return {
        ...config,
        pools: {
          ...config.pools,
          supportsNestedActions: mockSupportsNestedActions,
        },
      }
    },
  }
})

afterEach(() => {
  mockSupportsNestedActions = undefined
})

async function testUseAddLiquidity(pool: GqlPoolElement = aBalWethPoolElementMock()) {
  const PoolProvider = buildDefaultPoolTestProvider(pool)

  function Providers({ children }: PropsWithChildren) {
    return (
      <PoolProvider>
        <DefaultAddLiquidityTestProvider>{children}</DefaultAddLiquidityTestProvider>
      </PoolProvider>
    )
  }

  const { result } = testHook(() => useAddLiquidityLogic(), {
    wrapper: Providers,
  })

  return result
}

test('returns amountsIn with empty input amount by default', async () => {
  const result = await testUseAddLiquidity()

  expect(result.current.humanAmountsIn).toEqual([
    {
      tokenAddress: balAddress,
      humanAmount: '',
    },
    {
      tokenAddress: wETHAddress,
      humanAmount: '',
    },
  ])
})

test('uses custom add liquidity handler selector and forwards handler to custom steps hook', async () => {
  const pool = aBalWethPoolElementMock()
  const PoolProvider = buildDefaultPoolTestProvider(pool)

  const customHandler: AddLiquidityHandler = {
    simulate: vi.fn(),
    getPriceImpact: vi.fn(),
    buildCallData: vi.fn(),
  }

  const addLiquidityHandlerSelector = vi.fn(() => customHandler)
  const useAddLiquiditySteps = vi.fn(() => ({ steps: [], isLoadingSteps: false }))

  function Providers({ children }: PropsWithChildren) {
    return (
      <PoolProvider>
        <DefaultAddLiquidityTestProvider>{children}</DefaultAddLiquidityTestProvider>
      </PoolProvider>
    )
  }

  const { result } = testHook(
    () => useAddLiquidityLogic(undefined, addLiquidityHandlerSelector, useAddLiquiditySteps),
    {
      wrapper: Providers,
    }
  )

  expect(result.current.handler).toBe(customHandler)
  expect(addLiquidityHandlerSelector).toHaveBeenCalledWith(pool, false, [false, false])

  expect(useAddLiquiditySteps).toHaveBeenCalledWith(
    expect.objectContaining({
      handler: customHandler,
    })
  )
})

test('returns valid tokens for a nested pool when nested actions are enabled', async () => {
  mockSupportsNestedActions = true
  const result = await testUseAddLiquidity(nestedPoolMock as GqlPoolElement)

  const validAddresses = result.current.validTokens.map(t => t.address)

  expect(validAddresses).toEqual(
    expect.arrayContaining([wETHAddress, daiAddress, usdtAddress, usdcAddress])
  )

  expect(validAddresses).toHaveLength(4)
})

test('returns root tokens for a nested pool on Frontier Mainnet (nested actions disabled)', async () => {
  const result = await testUseAddLiquidity(nestedPoolMock as GqlPoolElement)

  const validAddresses = result.current.validTokens.map(t => t.address)

  expect(validAddresses).toEqual(
    expect.arrayContaining([wETHAddress, '0x79c58f70905f734641735bc61e45c19dd9ad60bc'])
  )

  expect(validAddresses).toHaveLength(2)
})
