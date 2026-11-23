import { renderHook } from '@testing-library/react'
import { zeroAddress } from 'viem'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { ONE_E18 } from '@repo/lib/modules/eclp/helpers/eclpRateScaling'
import { PoolCreationToken } from '../types'
import { useCreatePoolUnwrapRates } from './useCreatePoolUnwrapRates'

const mockUseReadContracts = vi.fn()
const mockGetToken = vi.fn()

vi.mock('wagmi', () => ({
  useReadContracts: (config: unknown) => mockUseReadContracts(config),
}))

vi.mock('@repo/lib/modules/tokens/TokensProvider', () => ({
  useTokens: () => ({
    getToken: (address: string, chain: unknown) => mockGetToken(address, chain),
  }),
}))

const wrappedTokenAddress = '0x729f75aff28c726e32403e80cef2afb518cfbfa7' as const
const underlyingTokenAddress = '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42' as const
const rEthAddress = '0xae78736cd615f374d3085123a210448e74fc6393' as const

function createBoostedPoolTokens(): PoolCreationToken[] {
  return [
    {
      address: wrappedTokenAddress,
      rateProvider: '0x42533ea0dd0a1b75578f48a95407bae2104a870c',
      paysYieldFees: true,
      weight: '',
      amount: '',
      data: {
        address: wrappedTokenAddress,
        symbol: 'waBasEURC',
        name: 'Wrapped Aave Base EURC',
        decimals: 6,
        chain: GqlChainValues.Base,
        chainId: 8453,
        isErc4626: true,
        isBufferAllowed: true,
        priority: 0,
        tradable: true,
        logoURI: null,
        coingeckoId: null,
        priceRateProviderData: null,
      },
    },
    {
      address: rEthAddress,
      rateProvider: zeroAddress,
      paysYieldFees: false,
      weight: '',
      amount: '',
      data: {
        address: rEthAddress,
        symbol: 'rETH',
        name: 'Rocket Pool ETH',
        decimals: 18,
        chain: GqlChainValues.Base,
        chainId: 8453,
        isErc4626: false,
        isBufferAllowed: false,
        priority: 0,
        tradable: true,
        logoURI: null,
        coingeckoId: null,
        priceRateProviderData: null,
      },
    },
  ]
}

describe('useCreatePoolUnwrapRates', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockGetToken.mockImplementation((address: string) => {
      if (address.toLowerCase() === wrappedTokenAddress) {
        return createBoostedPoolTokens()[0]!.data
      }

      if (address.toLowerCase() === underlyingTokenAddress) {
        return {
          address: underlyingTokenAddress,
          symbol: 'EURC',
          name: 'EURC',
          decimals: 6,
          chain: GqlChainValues.Base,
          chainId: 8453,
          isErc4626: false,
          isBufferAllowed: false,
        }
      }

      return undefined
    })
  })

  it('returns unwrapRates: null and isLoading: true while asset() or convertToAssets() is pending', () => {
    mockUseReadContracts.mockImplementation(
      (config: { contracts?: { functionName?: string }[] }) => {
        const fn = config?.contracts?.[0]?.functionName

        if (fn === 'asset') {
          return { data: undefined, isPending: true, isLoading: true }
        }

        return { data: undefined, isPending: false, isLoading: false }
      }
    )

    const { result } = renderHook(() =>
      useCreatePoolUnwrapRates(createBoostedPoolTokens(), GqlChainValues.Base, true, [
        1_037814275417584008n,
        ONE_E18,
      ])
    )

    expect(result.current.isLoading).toBe(true)
    expect(result.current.unwrapRates).toBeNull()
  })

  it('falls back to tokenRates[i] when convertToAssets() fails on RPC', () => {
    const tokenRates: readonly [bigint, bigint] = [1_037814275417584008n, ONE_E18]

    mockUseReadContracts.mockImplementation(
      (config: { contracts?: { functionName?: string }[] }) => {
        const fn = config?.contracts?.[0]?.functionName

        if (fn === 'asset') {
          return {
            data: [{ status: 'success', result: underlyingTokenAddress }],
            isPending: false,
            isLoading: false,
          }
        }

        if (fn === 'convertToAssets') {
          return {
            data: [{ status: 'failure', error: new Error('RPC revert') }],
            isPending: false,
            isLoading: false,
          }
        }

        return { data: undefined, isPending: false, isLoading: false }
      }
    )

    const { result } = renderHook(() =>
      useCreatePoolUnwrapRates(createBoostedPoolTokens(), GqlChainValues.Base, true, tokenRates)
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.unwrapRates).toEqual([1_037814275417584008n, ONE_E18])
    expect(result.current.displaySymbols).toEqual(['EURC', 'rETH'])
  })

  it('returns [ONE_E18, ONE_E18] immediately when no token is ERC-4626 buffered', () => {
    const nonErcTokens = createBoostedPoolTokens().slice(1)
    mockUseReadContracts.mockReturnValue({ data: undefined, isPending: true, isLoading: false })

    const { result } = renderHook(() =>
      useCreatePoolUnwrapRates(nonErcTokens, GqlChainValues.Base, true, [ONE_E18, ONE_E18])
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.unwrapRates).toEqual([ONE_E18, ONE_E18])
    expect(result.current.displaySymbols).toEqual(['rETH'])
  })
})
