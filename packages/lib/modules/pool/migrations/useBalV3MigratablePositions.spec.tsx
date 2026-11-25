import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { mswServer } from '@repo/lib/test/msw/server'
import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { BALANCER_V3_CONTRACTS, isBalV3SupportedChain } from './balv3.constants'
import {
  BALV3_MIGRATION_FALLBACKS,
  getPoolMigrations,
  hasCompatibleMigrationTokenOverlap,
  parseCompactMigrationItem,
  parseCompactPoolRef,
  PoolMigration,
} from './getPoolMigrations'
import { PoolMigrationsProvider, usePoolMigrations } from './PoolMigrationsProvider'
import { useBalV3MigratablePositions } from './useBalV3MigratablePositions'

const { useUserAccountMock, useReadContractsMock, useTokensMock, usdValueForTokenAddressMock } =
  vi.hoisted(() => ({
    useUserAccountMock: vi.fn(),
    useReadContractsMock: vi.fn(),
    useTokensMock: vi.fn(),
    usdValueForTokenAddressMock: vi.fn(),
  }))

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>()

  return {
    ...actual,
    useReadContracts: useReadContractsMock,
  }
})

vi.mock('@repo/lib/modules/web3/UserAccountProvider', async importOriginal => {
  const actual = await importOriginal<typeof import('@repo/lib/modules/web3/UserAccountProvider')>()

  return {
    ...actual,
    useUserAccount: useUserAccountMock,
  }
})

vi.mock('@repo/lib/modules/tokens/TokensProvider', async importOriginal => {
  const actual = await importOriginal<typeof import('@repo/lib/modules/tokens/TokensProvider')>()

  return {
    ...actual,
    useTokens: useTokensMock,
  }
})

const USER_ADDRESS = '0x1234567890123456789012345678901234567890' as const

const MIGRATIONS_URL =
  'https://raw.githubusercontent.com/frontier-fi/metadata/main/pools/migration.json'

const MAINNET_RETH_WAETHWETH: PoolMigration = {
  old: {
    protocol: 3,
    chainId: 1,
    id: '0x1ea5870f7c037930ce1d5d8d9317c670e89e13e3',
    name: 'rETH-waEthWETH',
    symbol: 'rETH-waEthWETH',
    type: 'STABLE',
    gaugeAddress: '0x62a66eb9abf7a788f48d0ce7c0c065df9e09da19',
    tokens: [
      {
        index: 0,
        address: '0x0bfc9d54fc184518a81162f8fb99c2eaca081202',
        symbol: 'waEthWETH',
        decimals: 18,
        isErc4626: true,
        unwrapOnExit: false,
        underlyingToken: {
          address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          symbol: 'WETH',
          decimals: 18,
        },
      },
      {
        index: 1,
        address: '0xae78736cd615f374d3085123a210448e74fc6393',
        symbol: 'rETH',
        decimals: 18,
        isErc4626: false,
      },
    ],
  },
  new: {
    protocol: 3,
    chainId: 1,
    id: '0x0a22eae1008c218d22c27a00b6f712483e32229a',
  },
}

const SURGE_TETH_WSTETH: PoolMigration = {
  old: {
    protocol: 3,
    chainId: 1,
    id: '0x9ed5175aecb6653c1bdaa19793c16fd74fbeeb37',
    name: 'Surge tETH-Lido wstETH',
    symbol: 'Surge tETH-Lido wstETH',
    type: 'STABLE',
    gaugeAddress: '0xd5a0eb558d62780b10ecc202d0049b89f6145073',
    tokens: [
      {
        index: 0,
        address: '0x775f661b0bd1739349b9a2a3ef60be277c5d2d29',
        symbol: 'waEthLidowstETH',
        decimals: 18,
        isErc4626: true,
        unwrapOnExit: true,
        underlyingToken: {
          address: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
          symbol: 'wstETH',
          decimals: 18,
        },
      },
      {
        index: 1,
        address: '0xd11c452fc99cf405034ee446803b6f6c1f6d5ed8',
        symbol: 'tETH',
        decimals: 18,
        isErc4626: true,
        unwrapOnExit: false,
      },
    ],
  },
  new: {
    protocol: 3,
    chainId: 1,
    id: '0x2222222222222222222222222222222222222222',
  },
}

const OSETH_WAWETH: PoolMigration = {
  old: {
    protocol: 3,
    chainId: 1,
    id: '0x57c23c58b1d8c3292c15becf07c62c5c52457a42',
    name: 'osETH-waWETH',
    symbol: 'osETH-waWETH',
    type: 'STABLE',
    gaugeAddress: '0x70a1c01902dab7a45dca1098ca76a8314dd8adba',
    tokens: [
      {
        index: 0,
        address: '0x0bfc9d54fc184518a81162f8fb99c2eaca081202',
        symbol: 'waEthWETH',
        decimals: 18,
        isErc4626: true,
        unwrapOnExit: false,
        underlyingToken: {
          address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          symbol: 'WETH',
          decimals: 18,
        },
      },
      {
        index: 1,
        address: '0xf1c9acdc66974dfb6decb12aa385b9cd01190e38',
        symbol: 'osETH',
        decimals: 18,
      },
    ],
  },
  new: {
    protocol: 3,
    chainId: 1,
    id: '0x3333333333333333333333333333333333333333',
  },
}

const PRL_WETH_80_20: PoolMigration = {
  old: {
    protocol: 3,
    chainId: 1,
    id: '0x1846c6cbe0d433e152fa358e5ff27968e18bce7c',
    name: '80PRL-20WETH',
    symbol: '80PRL-20WETH',
    type: 'WEIGHTED',
    gaugeAddress: '0x30fb447441195a5b72a382ef14c5865c0fc1a9aa',
    tokens: [
      {
        index: 0,
        address: '0x6c0aeceedc55c9d55d8b99216a670d85330941c3',
        symbol: 'PRL',
        decimals: 18,
      },
      {
        index: 1,
        address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        symbol: 'WETH',
        decimals: 18,
      },
    ],
  },
  new: {
    protocol: 3,
    chainId: 1,
    id: '0x4444444444444444444444444444444444444444',
  },
}

const BASE_NO_GAUGE_POOL: PoolMigration = {
  old: {
    protocol: 3,
    chainId: 8453,
    id: '0xb7b8b3afc010169779c5c2385ec0eb0477fe3347',
    name: 'Balancer rETH-Aave wETH',
    symbol: 'rETH-waBasWETH',
    type: 'STABLE',
    tokens: [
      {
        index: 0,
        address: '0xb6fe221fe9eef5aba221c348ba20a1bf5e73624c',
        symbol: 'rETH',
        decimals: 18,
      },
      {
        index: 1,
        address: '0xe298b938631f750dd409fb18227c4a23dcdaab9b',
        symbol: 'waBasWETH',
        decimals: 18,
        isErc4626: true,
        underlyingToken: {
          address: '0x4200000000000000000000000000000000000006',
          symbol: 'WETH',
          decimals: 18,
        },
      },
    ],
  },
  new: {
    protocol: 3,
    chainId: 8453,
    id: '0x9999999999999999999999999999999999999999',
  },
}

describe('BALANCER_V3_CONTRACTS & isBalV3SupportedChain', () => {
  it('exposes verified Balancer V3 addresses for Mainnet, Base, and Monad', () => {
    expect(isBalV3SupportedChain(1)).toBe(true)
    expect(isBalV3SupportedChain(8453)).toBe(true)
    expect(isBalV3SupportedChain(143)).toBe(true)
    expect(isBalV3SupportedChain(11155111)).toBe(false)
    expect(isBalV3SupportedChain(42161)).toBe(false)

    expect(BALANCER_V3_CONTRACTS[1]).toEqual({
      vault: '0xbA1333333333a1BA1108E8412f11850A5C319bA9',
      router: '0xAE563E3f8219521950555F5962419C8919758Ea2',
      compositeLiquidityRouter: '0xb21A277466e7dB6934556a1Ce12eb3F032815c8A',
      permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    })

    expect(BALANCER_V3_CONTRACTS[8453]).toEqual({
      vault: '0xbA1333333333a1BA1108E8412f11850A5C319bA9',
      router: '0x3f170631ed9821Ca51A59D996aB095162438DC10',
      compositeLiquidityRouter: '0x9dA18982a33FD0c7051B19F0d7C76F2d5E7e017c',
      permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    })

    expect(BALANCER_V3_CONTRACTS[143]).toEqual({
      vault: '0xbA1333333333a1BA1108E8412f11850A5C319bA9',
      router: '0x9dA18982a33FD0c7051B19F0d7C76F2d5E7e017c',
      compositeLiquidityRouter: '0x3f170631ed9821Ca51A59D996aB095162438DC10',
      permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    })
  })
})

describe('getPoolMigrations', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns BALV3_MIGRATION_FALLBACKS when fetched JSON is empty and NEXT_PUBLIC_MIGRATIONS_FALLBACK is true', async () => {
    vi.stubEnv('NEXT_PUBLIC_MIGRATIONS_FALLBACK', 'true')
    mswServer.use(http.get(MIGRATIONS_URL, () => HttpResponse.json([])))

    const migrations = await getPoolMigrations()

    expect(migrations).toEqual(BALV3_MIGRATION_FALLBACKS)
    expect(migrations[0]?.old.id).toBe('0x85b2b559bc2d21104c4defdd6efca8a20343361d')
    expect(migrations[0]?.old.isPaused).toBe(true)
    expect(migrations[0]?.old.isInRecoveryMode).toBe(true)
    expect(migrations[0]?.new.id).toBe('0x0a22eae1008c218d22c27a00b6f712483e32229a')
    expect(migrations[1]?.old.chainId).toBe(143)
    expect(migrations[1]?.old.id).toBe('0x2daa146dfb7eaef0038f9f15b2ec1e4de003f72b')
    expect(migrations[1]?.new.chainId).toBe(143)
    expect(migrations[1]?.new.id).toBe('0xdcf3c45696cc9e81ecc48330f7f0e764dae27c44')
  })

  it('returns empty array when fetched JSON is empty and fallback flag is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_MIGRATIONS_FALLBACK', 'false')
    mswServer.use(http.get(MIGRATIONS_URL, () => HttpResponse.json([])))

    const migrations = await getPoolMigrations()

    expect(migrations).toEqual([])
  })

  it('prefers fetched migrations over fallback when remote JSON is non-empty', async () => {
    vi.stubEnv('NEXT_PUBLIC_MIGRATIONS_FALLBACK', 'true')
    mswServer.use(http.get(MIGRATIONS_URL, () => HttpResponse.json([SURGE_TETH_WSTETH])))

    const migrations = await getPoolMigrations()

    expect(migrations).toEqual([SURGE_TETH_WSTETH])
  })

  it('parses compact chain/v3/address refs and compact objects with checksummed or /pools/-prefixed paths', () => {
    expect(parseCompactPoolRef('base/v3/0x2be9d6899432e988a8b71eb80ee29a49521e2cba')).toEqual({
      protocol: 3,
      gqlChain: GqlChainValues.Base,
      chainId: 8453,
      id: '0x2be9d6899432e988a8b71eb80ee29a49521e2cba',
    })

    expect(parseCompactPoolRef('base/v3/0xc1D4D6608D346a3aCBF1614881A8C11564143970')).toEqual({
      protocol: 3,
      gqlChain: GqlChainValues.Base,
      chainId: 8453,
      id: '0xc1d4d6608d346a3acbf1614881a8c11564143970',
    })

    expect(
      parseCompactPoolRef('/pools/ethereum/v3/0x85b2b559bc2d21104c4defdd6efca8a20343361d')
    ).toEqual({
      protocol: 3,
      gqlChain: GqlChainValues.Mainnet,
      chainId: 1,
      id: '0x85b2b559bc2d21104c4defdd6efca8a20343361d',
    })

    expect(
      parseCompactMigrationItem({
        old: 'base/v3/0x2be9d6899432e988a8b71eb80ee29a49521e2cba',
        new: 'base/v3/0xc1D4D6608D346a3aCBF1614881A8C11564143970',
      })
    ).toEqual({
      old: {
        protocol: 3,
        gqlChain: GqlChainValues.Base,
        chainId: 8453,
        id: '0x2be9d6899432e988a8b71eb80ee29a49521e2cba',
      },
      new: {
        protocol: 3,
        gqlChain: GqlChainValues.Base,
        chainId: 8453,
        id: '0xc1d4d6608d346a3acbf1614881a8c11564143970',
      },
    })

    expect(
      parseCompactPoolRef('base/v2/0x2be9d6899432e988a8b71eb80ee29a49521e2cba')
    ).toBeUndefined()
  })

  it('hydrates compact object mappings via Balancer V3 + Frontier GraphQL and infers unwrapOnExit', async () => {
    const frontierApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.frontier.fi/graphql'

    mswServer.use(
      http.get(MIGRATIONS_URL, () =>
        HttpResponse.json([
          {
            old: 'base/v3/0x2be9d6899432e988a8b71eb80ee29a49521e2cba',
            new: 'base/v3/0xc1D4D6608D346a3aCBF1614881A8C11564143970',
          },
          {
            old: 'monad/v3/0x2daa146dfb7eaef0038f9f15b2ec1e4de003f72b',
            new: 'monad/v3/0xdcf3c45696cc9e81ecc48330f7f0e764dae27c44',
          },
        ])
      ),
      http.post('https://api-v3.balancer.fi/graphql', () =>
        HttpResponse.json({
          data: {
            poolGetPools: [
              {
                id: '0x2be9d6899432e988a8b71eb80ee29a49521e2cba',
                chain: GqlChainValues.Base,
                name: 'tETH waBaswstETH',
                symbol: 'tETH-waBaswstETH',
                type: 'STABLE',
                dynamicData: { isPaused: false, isInRecoveryMode: false },
                staking: { gauge: { gaugeAddress: '0x5b0ceddf480846b123a61732297aaa2e4388e93e' } },
                poolTokens: [
                  {
                    index: 1,
                    address: '0xd09acb80c1e8f2291862c4978a008791c9167003',
                    symbol: 'tETH',
                    decimals: 18,
                    isErc4626: false,
                    underlyingToken: null,
                  },
                  {
                    index: 0,
                    address: '0x0830820d1a9aa1554364752d6d8f55c836871b74',
                    symbol: 'waBaswstETH',
                    decimals: 18,
                    isErc4626: true,
                    underlyingToken: {
                      address: '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452',
                      symbol: 'wstETH',
                      decimals: 18,
                    },
                  },
                ],
              },
              {
                id: '0x2daa146dfb7eaef0038f9f15b2ec1e4de003f72b',
                chain: GqlChainValues.Monad,
                name: 'wnAUSD / wnUSDC / wnUSDT0',
                symbol: 'wnAUSD-wnUSDC-wnUSDT0',
                type: 'STABLE',
                dynamicData: { isPaused: false, isInRecoveryMode: false },
                staking: null,
                poolTokens: [
                  {
                    index: 0,
                    address: '0x4e8aaecce10ad9394e96fe5f2bd4e587a7b04298',
                    symbol: 'wnUSDT0',
                    decimals: 6,
                    isErc4626: true,
                    underlyingToken: {
                      address: '0xe7cd86e13ac4309349f30b3435a9d337750fc82d',
                      symbol: 'USDT0',
                      decimals: 6,
                    },
                  },
                  {
                    index: 1,
                    address: '0x82c370ba90e38ef6acd8b1b078d34fd86fc6bac9',
                    symbol: 'wnAUSD',
                    decimals: 6,
                    isErc4626: true,
                    underlyingToken: {
                      address: '0x00000000efe302beaa2b3e6e1b18d08d69a9012a',
                      symbol: 'AUSD',
                      decimals: 6,
                    },
                  },
                  {
                    index: 2,
                    address: '0x8d5c2df3eef09088fcccf3376d8ecd0dd505f642',
                    symbol: 'wnUSDC',
                    decimals: 6,
                    isErc4626: true,
                    underlyingToken: {
                      address: '0x754704bc059f8c67012fed69bc8a327a5aafb603',
                      symbol: 'USDC',
                      decimals: 6,
                    },
                  },
                ],
              },
            ],
          },
        })
      ),
      http.post(frontierApiUrl, () =>
        HttpResponse.json({
          data: {
            poolGetPools: [
              {
                id: '0xc1d4d6608d346a3acbf1614881a8c11564143970',
                chain: GqlChainValues.Base,
                poolTokens: [
                  {
                    index: 0,
                    address: '0x0830820d1a9aa1554364752d6d8f55c836871b74',
                    useUnderlyingForAddRemove: true,
                    underlyingToken: {
                      address: '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452',
                    },
                  },
                  {
                    index: 1,
                    address: '0xd09acb80c1e8f2291862c4978a008791c9167003',
                    useUnderlyingForAddRemove: null,
                    underlyingToken: null,
                  },
                ],
              },
              {
                id: '0xdcf3c45696cc9e81ecc48330f7f0e764dae27c44',
                chain: GqlChainValues.Monad,
                poolTokens: [
                  {
                    index: 0,
                    address: '0xaaaa000000000000000000000000000000000001',
                    useUnderlyingForAddRemove: true,
                    underlyingToken: {
                      address: '0x00000000efe302beaa2b3e6e1b18d08d69a9012a',
                    },
                  },
                  {
                    index: 1,
                    address: '0xaaaa000000000000000000000000000000000002',
                    useUnderlyingForAddRemove: true,
                    underlyingToken: {
                      address: '0x754704bc059f8c67012fed69bc8a327a5aafb603',
                    },
                  },
                ],
              },
            ],
          },
        })
      )
    )

    const migrations = await getPoolMigrations()

    expect(migrations).toHaveLength(2)

    const [baseMigration, monadMigration] = migrations

    expect(baseMigration).toEqual({
      old: {
        protocol: 3,
        chainId: 8453,
        id: '0x2be9d6899432e988a8b71eb80ee29a49521e2cba',
        name: 'tETH waBaswstETH',
        symbol: 'tETH-waBaswstETH',
        type: 'STABLE',
        gaugeAddress: '0x5b0ceddf480846b123a61732297aaa2e4388e93e',
        isPaused: false,
        isInRecoveryMode: false,
        tokens: [
          {
            index: 0,
            address: '0x0830820d1a9aa1554364752d6d8f55c836871b74',
            symbol: 'waBaswstETH',
            decimals: 18,
            isErc4626: true,
            unwrapOnExit: false,
            underlyingToken: {
              address: '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452',
              symbol: 'wstETH',
              decimals: 18,
            },
          },
          {
            index: 1,
            address: '0xd09acb80c1e8f2291862c4978a008791c9167003',
            symbol: 'tETH',
            decimals: 18,
            isErc4626: false,
            unwrapOnExit: false,
          },
        ],
      },
      new: {
        protocol: 3,
        chainId: 8453,
        id: '0xc1d4d6608d346a3acbf1614881a8c11564143970',
      },
    })

    expect(monadMigration?.old.gaugeAddress).toBeUndefined()
    expect(monadMigration?.old.tokens[0]?.unwrapOnExit).toBe(false) // dropped wnUSDT0
    expect(monadMigration?.old.tokens[1]?.unwrapOnExit).toBe(true) // wnAUSD -> waMonAUSD
    expect(monadMigration?.old.tokens[2]?.unwrapOnExit).toBe(true) // wnUSDC -> waMonUSDC
  })

  it('falls back to poolGetPool for zero-TVL pools omitted from poolGetPools and ignores non-V3/missing pools', async () => {
    const frontierApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.frontier.fi/graphql'

    mswServer.use(
      http.get(MIGRATIONS_URL, () =>
        HttpResponse.json([
          {
            old: 'monad/v3/0x47a4aaf5bbe897c4558c5780b150535eee6aa58b',
            new: 'monad/v3/0x14884CD9aC81c018E6C5156F8785bD57BeeAB2C5',
          },
          {
            old: 'monad/v3/0x9999999999999999999999999999999999999999',
            new: 'monad/v3/0x14884CD9aC81c018E6C5156F8785bD57BeeAB2C5',
          },
          {
            old: 'monad/v3/0x8888888888888888888888888888888888888888',
            new: 'monad/v3/0x14884CD9aC81c018E6C5156F8785bD57BeeAB2C5',
          },
        ])
      ),
      http.post('https://api-v3.balancer.fi/graphql', async ({ request }) => {
        const body = (await request.json()) as {
          query?: string
          variables?: { id?: string; chain?: string }
        }

        if (body.query?.includes('poolGetPools')) {
          return HttpResponse.json({
            data: {
              poolGetPools: [],
            },
          })
        }

        if (body.variables?.id === '0x47a4aaf5bbe897c4558c5780b150535eee6aa58b') {
          return HttpResponse.json({
            data: {
              poolGetPool: {
                id: '0x47a4aaf5bbe897c4558c5780b150535eee6aa58b',
                chain: GqlChainValues.Monad,
                protocolVersion: 3,
                name: 'Curvance AUSD-USDC',
                symbol: 'Curvance-AUSD-USDC',
                type: 'STABLE',
                dynamicData: { isPaused: false, isInRecoveryMode: false },
                staking: null,
                poolTokens: [
                  {
                    index: 0,
                    address: '0x215394b5677cb7a18b6fa8cc2cd155c024ee6b2e',
                    symbol: 'blbUSDC',
                    decimals: 6,
                    isErc4626: true,
                    underlyingToken: {
                      address: '0x754704bc059f8c67012fed69bc8a327a5aafb603',
                      symbol: 'USDC',
                      decimals: 6,
                    },
                  },
                  {
                    index: 1,
                    address: '0xc2ddc1004ca0d6cc4bfd1dcd03dcf855bed8e670',
                    symbol: 'blbAUSD',
                    decimals: 6,
                    isErc4626: true,
                    underlyingToken: {
                      address: '0x00000000efe302beaa2b3e6e1b18d08d69a9012a',
                      symbol: 'AUSD',
                      decimals: 6,
                    },
                  },
                ],
              },
            },
          })
        }

        if (body.variables?.id === '0x9999999999999999999999999999999999999999') {
          return HttpResponse.json({
            data: {
              poolGetPool: {
                id: '0x9999999999999999999999999999999999999999',
                chain: GqlChainValues.Monad,
                protocolVersion: 2,
                name: 'Legacy V2 Pool',
                symbol: 'LEGACY-V2',
                type: 'WEIGHTED',
                dynamicData: { isPaused: false, isInRecoveryMode: false },
                staking: null,
                poolTokens: [],
              },
            },
          })
        }

        return HttpResponse.json({
          data: null,
          errors: [{ message: 'Pool does not exist' }],
        })
      }),
      http.post(frontierApiUrl, () =>
        HttpResponse.json({
          data: {
            poolGetPools: [
              {
                id: '0x14884cd9ac81c018e6c5156f8785bd57beeab2c5',
                chain: GqlChainValues.Monad,
                name: 'Curvance blbUSDC-blbAUSD',
                symbol: '0xFF-blbUSDC-blbAUSD',
                poolTokens: [
                  {
                    index: 0,
                    address: '0x215394b5677cb7a18b6fa8cc2cd155c024ee6b2e',
                    useUnderlyingForAddRemove: true,
                    underlyingToken: {
                      address: '0x754704bc059f8c67012fed69bc8a327a5aafb603',
                    },
                  },
                  {
                    index: 1,
                    address: '0xc2ddc1004ca0d6cc4bfd1dcd03dcf855bed8e670',
                    useUnderlyingForAddRemove: true,
                    underlyingToken: {
                      address: '0x00000000efe302beaa2b3e6e1b18d08d69a9012a',
                    },
                  },
                ],
              },
            ],
          },
        })
      )
    )

    const migrations = await getPoolMigrations()

    expect(migrations).toHaveLength(1)

    expect(migrations[0]?.old.symbol).toBe('Curvance-AUSD-USDC')

    expect(migrations[0]?.new).toEqual({
      protocol: 3,
      chainId: 143,
      id: '0x14884cd9ac81c018e6c5156f8785bd57beeab2c5',
      name: 'Curvance blbUSDC-blbAUSD',
      symbol: '0xFF-blbUSDC-blbAUSD',
    })
  })

  it('hasCompatibleMigrationTokenOverlap filters mismatched routes and respects recovery-mode unwrap restrictions', () => {
    // Monad Avant: avUSD-AUSD -> avUSD-USDC only matches 1 of 2 target tokens (AUSD != USDC)
    expect(
      hasCompatibleMigrationTokenOverlap(
        [
          {
            address: '0x0d9d740000000000000000000000000000000001',
            symbol: 'avUSD',
            decimals: 18,
            isErc4626: false,
          },
          {
            address: '0x9e1acc0000000000000000000000000000000002',
            symbol: 'waMonAUSD',
            decimals: 6,
            isErc4626: true,
            underlyingToken: {
              address: '0x00000000efe302beaa2b3e6e1b18d08d69a9012a',
              symbol: 'AUSD',
              decimals: 6,
            },
          },
        ],
        [
          {
            address: '0x0d9d740000000000000000000000000000000001',
            useUnderlyingForAddRemove: null,
            underlyingToken: null,
          },
          {
            address: '0xc554af0000000000000000000000000000000003',
            useUnderlyingForAddRemove: true,
            underlyingToken: {
              address: '0x754704bc059f8c67012fed69bc8a327a5aafb603',
            },
          },
        ]
      )
    ).toBe(false)

    // Mainnet 80TREE-20AavePrimeWETH is paused: recovery exit returns waEthLidoWETH (cannot unwrap to WETH),
    // which does not match target waEthWETH
    const treeWethSource = [
      {
        address: '0x0fe9060000000000000000000000000000000001',
        symbol: 'waEthLidoWETH',
        decimals: 18,
        isErc4626: true,
        underlyingToken: {
          address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          symbol: 'WETH',
          decimals: 18,
        },
      },
      {
        address: '0x7714670000000000000000000000000000000002',
        symbol: 'TREE',
        decimals: 18,
        isErc4626: false,
      },
    ]

    const treeWethTarget = [
      {
        address: '0x0bfc9d54fc184518a81162f8fb99c2eaca081202',
        useUnderlyingForAddRemove: true,
        underlyingToken: {
          address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        },
      },
      {
        address: '0x7714670000000000000000000000000000000002',
        useUnderlyingForAddRemove: null,
        underlyingToken: null,
      },
    ]

    expect(hasCompatibleMigrationTokenOverlap(treeWethSource, treeWethTarget, true)).toBe(false)
    expect(hasCompatibleMigrationTokenOverlap(treeWethSource, treeWethTarget, false)).toBe(true)
  })

  it('drops mismatched routes during hydrateCompactMigrations and keeps compatible ones', async () => {
    const frontierApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.frontier.fi/graphql'

    mswServer.use(
      http.get(MIGRATIONS_URL, () =>
        HttpResponse.json([
          {
            old: 'monad/v3/0x234b49e87a7fff921a060c21d2c013291bbd7ff1',
            new: 'monad/v3/0x43b9B77653f4240E764546D921Df5C08B4c66a28',
          },
          {
            old: 'ethereum/v3/0xdaba3d8ccf79ef289a7e2dbce51871b39ea445a2',
            new: 'ethereum/v3/0xfbdC1B996B4A0AF6F2A049d3AA4a960099dEa1e9',
          },
          {
            old: 'ethereum/v3/0x1535d7ca00323aa32bd62aeddf7ca651e4b95966',
            new: 'ethereum/v3/0x16B14c92bC1926D64a5Ded68528A5135E4C00d23',
          },
        ])
      ),
      http.post('https://api-v3.balancer.fi/graphql', () =>
        HttpResponse.json({
          data: {
            poolGetPools: [
              {
                id: '0x234b49e87a7fff921a060c21d2c013291bbd7ff1',
                chain: GqlChainValues.Monad,
                name: 'Avant avUSD-AUSD',
                symbol: 'avUSD-AUSD',
                type: 'STABLE',
                dynamicData: { isPaused: false, isInRecoveryMode: false },
                staking: null,
                poolTokens: [
                  {
                    index: 0,
                    address: '0x0d9d740000000000000000000000000000000001',
                    symbol: 'avUSD',
                    decimals: 18,
                    isErc4626: false,
                    underlyingToken: null,
                  },
                  {
                    index: 1,
                    address: '0x9e1acc0000000000000000000000000000000002',
                    symbol: 'waMonAUSD',
                    decimals: 6,
                    isErc4626: true,
                    underlyingToken: {
                      address: '0x00000000efe302beaa2b3e6e1b18d08d69a9012a',
                      symbol: 'AUSD',
                      decimals: 6,
                    },
                  },
                ],
              },
              {
                id: '0xdaba3d8ccf79ef289a7e2dbce51871b39ea445a2',
                chain: GqlChainValues.Mainnet,
                name: '80TREE-20AavePrimeWETH',
                symbol: '80TREE-20AavePrimeWETH',
                type: 'WEIGHTED',
                dynamicData: { isPaused: true, isInRecoveryMode: true },
                staking: null,
                poolTokens: [
                  {
                    index: 0,
                    address: '0x0fe9060000000000000000000000000000000001',
                    symbol: 'waEthLidoWETH',
                    decimals: 18,
                    isErc4626: true,
                    underlyingToken: {
                      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
                      symbol: 'WETH',
                      decimals: 18,
                    },
                  },
                  {
                    index: 1,
                    address: '0x7714670000000000000000000000000000000002',
                    symbol: 'TREE',
                    decimals: 18,
                    isErc4626: false,
                    underlyingToken: null,
                  },
                ],
              },
              {
                id: '0x1535d7ca00323aa32bd62aeddf7ca651e4b95966',
                chain: GqlChainValues.Mainnet,
                name: '80ALCX-20WETH',
                symbol: '80ALCX-20WETH',
                type: 'WEIGHTED',
                dynamicData: { isPaused: true, isInRecoveryMode: true },
                staking: null,
                poolTokens: [
                  {
                    index: 0,
                    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
                    symbol: 'WETH',
                    decimals: 18,
                    isErc4626: false,
                    underlyingToken: null,
                  },
                  {
                    index: 1,
                    address: '0xdbdb4d16eda451d0503b854cf79d55697f90c8df',
                    symbol: 'ALCX',
                    decimals: 18,
                    isErc4626: false,
                    underlyingToken: null,
                  },
                ],
              },
            ],
          },
        })
      ),
      http.post(frontierApiUrl, () =>
        HttpResponse.json({
          data: {
            poolGetPools: [
              {
                id: '0x43b9b77653f4240e764546d921df5c08b4c66a28',
                chain: GqlChainValues.Monad,
                poolTokens: [
                  {
                    index: 0,
                    address: '0x0d9d740000000000000000000000000000000001',
                    useUnderlyingForAddRemove: null,
                    underlyingToken: null,
                  },
                  {
                    index: 1,
                    address: '0xc554af0000000000000000000000000000000003',
                    useUnderlyingForAddRemove: true,
                    underlyingToken: { address: '0x754704bc059f8c67012fed69bc8a327a5aafb603' },
                  },
                ],
              },
              {
                id: '0xfbdc1b996b4a0af6f2a049d3aa4a960099dea1e9',
                chain: GqlChainValues.Mainnet,
                poolTokens: [
                  {
                    index: 0,
                    address: '0x0bfc9d54fc184518a81162f8fb99c2eaca081202',
                    useUnderlyingForAddRemove: true,
                    underlyingToken: { address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },
                  },
                  {
                    index: 1,
                    address: '0x7714670000000000000000000000000000000002',
                    useUnderlyingForAddRemove: null,
                    underlyingToken: null,
                  },
                ],
              },
              {
                id: '0x16b14c92bc1926d64a5ded68528a5135e4c00d23',
                chain: GqlChainValues.Mainnet,
                poolTokens: [
                  {
                    index: 0,
                    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
                    useUnderlyingForAddRemove: null,
                    underlyingToken: null,
                  },
                  {
                    index: 1,
                    address: '0xdbdb4d16eda451d0503b854cf79d55697f90c8df',
                    useUnderlyingForAddRemove: null,
                    underlyingToken: null,
                  },
                ],
              },
            ],
          },
        })
      )
    )

    const migrations = await getPoolMigrations()

    expect(migrations).toHaveLength(1)
    expect(migrations[0]?.old.id).toBe('0x1535d7ca00323aa32bd62aeddf7ca651e4b95966')
  })
})

describe('useBalV3MigratablePositions', () => {
  const refetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    useUserAccountMock.mockReturnValue({
      userAddress: USER_ADDRESS,
      isConnected: true,
    })

    usdValueForTokenAddressMock.mockImplementation((address: string, _chain, amount) => {
      const lower = address.toLowerCase()
      const numericAmount = Number(amount)

      if (lower === '0x0bfc9d54fc184518a81162f8fb99c2eaca081202') {
        return String(numericAmount * 3000)
      }

      if (lower === '0xae78736cd615f374d3085123a210448e74fc6393') {
        return String(numericAmount * 3300)
      }

      if (lower === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2') {
        return String(numericAmount * 3000)
      }

      if (lower === '0xb6fe221fe9eef5aba221c348ba20a1bf5e73624c') {
        return String(numericAmount * 3300)
      }

      if (lower === '0x4200000000000000000000000000000000000006') {
        return String(numericAmount * 3000)
      }

      if (lower === '0xdac17f958d2ee523a2206206994597c13d831ec7') {
        return String(numericAmount * 1)
      }

      if (lower === '0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f') {
        return String(numericAmount * 1)
      }

      if (lower === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48') {
        return String(numericAmount * 1)
      }

      if (
        lower === '0x00000000efe302beaa2b3e6e1b18d08d69a9012a' ||
        lower === '0x754704bc059f8c67012fed69bc8a327a5aafb603' ||
        lower === '0xe7cd86e13ac4309349f30b3435a9d337750fc82d'
      ) {
        return String(numericAmount * 1)
      }

      return '0'
    })

    useTokensMock.mockReturnValue({
      usdValueForTokenAddress: usdValueForTokenAddressMock,
    })
  })

  it('detects wallet-only BPT balance and estimates USD value', async () => {
    useReadContractsMock.mockReturnValue({
      data: [
        { status: 'success', result: 2_000_000_000_000_000_000n },
        { status: 'success', result: 0n },
        { status: 'success', result: 10_000_000_000_000_000_000n },
        {
          status: 'success',
          result: [
            [
              '0x0bfc9d54fc184518a81162f8fb99c2eaca081202',
              '0xae78736cd615f374d3085123a210448e74fc6393',
            ],
            [],
            [5_000_000_000_000_000_000n, 5_000_000_000_000_000_000n],
            [5_000_000_000_000_000_000n, 5_000_000_000_000_000_000n],
          ],
        },
      ],
      isLoading: false,
      refetch: refetchMock,
    })

    const { result } = testHook(() => useBalV3MigratablePositions([MAINNET_RETH_WAETHWETH]))

    await waitFor(() => expect(result.current.hasMigratablePositions).toBe(true))

    expect(result.current.migratablePositions).toHaveLength(1)

    expect(result.current.migratablePositions[0]).toEqual({
      migration: MAINNET_RETH_WAETHWETH,
      walletBptBalance: 2_000_000_000_000_000_000n,
      stakedBptBalance: 0n,
      totalBptBalance: 2_000_000_000_000_000_000n,
      estimatedUsdValue: 6300,
    })
  })

  it('detects gauge-staked-only BPT balance', () => {
    useReadContractsMock.mockReturnValue({
      data: [
        { status: 'success', result: 0n },
        { status: 'success', result: 5_000_000_000_000_000_000n },
        { status: 'success', result: 10_000_000_000_000_000_000n },
        {
          status: 'success',
          result: [
            [
              '0x0bfc9d54fc184518a81162f8fb99c2eaca081202',
              '0xae78736cd615f374d3085123a210448e74fc6393',
            ],
            [],
            [4_000_000_000_000_000_000n, 4_000_000_000_000_000_000n],
            [4_000_000_000_000_000_000n, 4_000_000_000_000_000_000n],
          ],
        },
      ],
      isLoading: false,
      refetch: refetchMock,
    })

    const { result } = testHook(() => useBalV3MigratablePositions([MAINNET_RETH_WAETHWETH]))

    expect(result.current.hasMigratablePositions).toBe(true)

    expect(result.current.migratablePositions[0]).toEqual({
      migration: MAINNET_RETH_WAETHWETH,
      walletBptBalance: 0n,
      stakedBptBalance: 5_000_000_000_000_000_000n,
      totalBptBalance: 5_000_000_000_000_000_000n,
      estimatedUsdValue: 12600,
    })
  })

  it('combines wallet + gauge-staked BPT across Mainnet and Base in a single multicall', () => {
    useReadContractsMock.mockReturnValue({
      data: [
        // Mainnet pool (with gauge: 4 calls)
        { status: 'success', result: 1_000_000_000_000_000_000n },
        { status: 'success', result: 3_000_000_000_000_000_000n },
        { status: 'success', result: 10_000_000_000_000_000_000n },
        {
          status: 'success',
          result: [
            [
              '0x0bfc9d54fc184518a81162f8fb99c2eaca081202',
              '0xae78736cd615f374d3085123a210448e74fc6393',
            ],
            [],
            [5_000_000_000_000_000_000n, 5_000_000_000_000_000_000n],
            [5_000_000_000_000_000_000n, 5_000_000_000_000_000_000n],
          ],
        },
        // Base pool (without gauge: 3 calls)
        { status: 'success', result: 2_000_000_000_000_000_000n },
        { status: 'success', result: 4_000_000_000_000_000_000n },
        {
          status: 'success',
          result: [
            [
              '0xb6fe221fe9eef5aba221c348ba20a1bf5e73624c',
              '0xe298b938631f750dd409fb18227c4a23dcdaab9b',
            ],
            [],
            [2_000_000_000_000_000_000n, 2_000_000_000_000_000_000n],
            [2_000_000_000_000_000_000n, 2_000_000_000_000_000_000n],
          ],
        },
      ],
      isLoading: false,
      refetch: refetchMock,
    })

    const { result } = testHook(() =>
      useBalV3MigratablePositions([MAINNET_RETH_WAETHWETH, BASE_NO_GAUGE_POOL])
    )

    expect(useReadContractsMock).toHaveBeenCalledTimes(1)

    const callArg = useReadContractsMock.mock.calls[0]?.[0]

    expect(callArg.allowFailure).toBe(true)
    expect(callArg.query.enabled).toBe(true)
    expect(callArg.contracts).toHaveLength(7)
    expect(callArg.contracts[3].address).toBe(BALANCER_V3_CONTRACTS[1].vault)
    expect(callArg.contracts[6].address).toBe(BALANCER_V3_CONTRACTS[8453].vault)

    expect(result.current.migratablePositions).toHaveLength(2)

    expect(result.current.migratablePositions[0]).toMatchObject({
      walletBptBalance: 1_000_000_000_000_000_000n,
      stakedBptBalance: 3_000_000_000_000_000_000n,
      totalBptBalance: 4_000_000_000_000_000_000n,
      estimatedUsdValue: 12600,
    })

    expect(result.current.migratablePositions[1]).toMatchObject({
      walletBptBalance: 2_000_000_000_000_000_000n,
      stakedBptBalance: 0n,
      totalBptBalance: 2_000_000_000_000_000_000n,
      estimatedUsdValue: 6300,
    })
  })

  it('prices mixed 6-decimal and 18-decimal tokens accurately via underlying fallback', () => {
    const pausedStableMigration = BALV3_MIGRATION_FALLBACKS[0]!

    useReadContractsMock.mockReturnValue({
      data: [
        { status: 'success', result: 250_000_000_000_000_000_000n },
        { status: 'success', result: 250_000_000_000_000_000_000n },
        { status: 'success', result: 1_000_000_000_000_000_000_000n },
        {
          status: 'success',
          result: [
            [
              '0x7bc3485026ac48b6cf9baf0a377477fff5703af8',
              '0xc71ea051a5f82c67adcf634c36ffe6334793d24c',
              '0xd4fa2d31b7968e448877f69a96de69f5de8cd23e',
            ],
            [],
            [300_000_000n, 400_000_000_000_000_000_000n, 300_000_000n],
            [],
          ],
        },
      ],
      isLoading: false,
      refetch: refetchMock,
    })

    const { result } = testHook(() => useBalV3MigratablePositions([pausedStableMigration]))

    expect(result.current.migratablePositions).toHaveLength(1)

    expect(result.current.migratablePositions[0]).toMatchObject({
      walletBptBalance: 250_000_000_000_000_000_000n,
      stakedBptBalance: 250_000_000_000_000_000_000n,
      totalBptBalance: 500_000_000_000_000_000_000n,
      estimatedUsdValue: 500,
    })
  })

  it('detects Monad (chainId 143) Balancer V3 position and estimates USD via underlying fallback', () => {
    const monadMigration = BALV3_MIGRATION_FALLBACKS[1]!

    useReadContractsMock.mockReturnValue({
      data: [
        { status: 'success', result: 200_000_000_000_000_000_000n },
        { status: 'success', result: 1_000_000_000_000_000_000_000n },
        {
          status: 'success',
          result: [
            [
              '0x4e8aaecce10ad9394e96fe5f2bd4e587a7b04298',
              '0x82c370ba90e38ef6acd8b1b078d34fd86fc6bac9',
              '0x8d5c2df3eef09088fcccf3376d8ecd0dd505f642',
            ],
            [],
            [300_000_000n, 400_000_000n, 300_000_000n],
            [],
          ],
        },
      ],
      isLoading: false,
      refetch: refetchMock,
    })

    const { result } = testHook(() => useBalV3MigratablePositions([monadMigration]))

    const callArg = useReadContractsMock.mock.calls[0]?.[0]
    expect(callArg.contracts).toHaveLength(3)
    expect(callArg.contracts[0].chainId).toBe(143)
    expect(callArg.contracts[2].chainId).toBe(143)
    expect(callArg.contracts[2].address).toBe(BALANCER_V3_CONTRACTS[143].vault)

    expect(result.current.migratablePositions).toHaveLength(1)

    expect(result.current.migratablePositions[0]).toMatchObject({
      migration: monadMigration,
      walletBptBalance: 200_000_000_000_000_000_000n,
      stakedBptBalance: 0n,
      totalBptBalance: 200_000_000_000_000_000_000n,
      estimatedUsdValue: 200,
    })
  })

  it('filters out 0n and failed balance reads', () => {
    useReadContractsMock.mockReturnValue({
      data: [
        { status: 'success', result: 0n },
        { status: 'success', result: 0n },
        { status: 'success', result: 10_000_000_000_000_000_000n },
        { status: 'failure', error: new Error('revert') },
        { status: 'failure', error: new Error('rpc error') },
        { status: 'success', result: 4_000_000_000_000_000_000n },
        { status: 'failure', error: new Error('revert') },
      ],
      isLoading: false,
      refetch: refetchMock,
    })

    const { result } = testHook(() =>
      useBalV3MigratablePositions([MAINNET_RETH_WAETHWETH, BASE_NO_GAUGE_POOL])
    )

    expect(result.current.hasMigratablePositions).toBe(false)
    expect(result.current.migratablePositions).toEqual([])
  })

  it('makes zero RPC calls when wallet is disconnected or migrations list is empty', () => {
    useUserAccountMock.mockReturnValue({
      userAddress: '',
      isConnected: false,
    })

    useReadContractsMock.mockReturnValue({
      data: [{ status: 'success', result: 999n }],
      isLoading: true,
      refetch: refetchMock,
    })

    const { result: disconnectedResult } = testHook(() =>
      useBalV3MigratablePositions([MAINNET_RETH_WAETHWETH])
    )

    expect(useReadContractsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: { enabled: false },
        contracts: [],
      })
    )

    expect(disconnectedResult.current.hasMigratablePositions).toBe(false)
    expect(disconnectedResult.current.migratablePositions).toEqual([])
    expect(disconnectedResult.current.isLoading).toBe(false)

    useUserAccountMock.mockReturnValue({
      userAddress: USER_ADDRESS,
      isConnected: true,
    })

    const { result: emptyMigrationsResult } = testHook(() => useBalV3MigratablePositions([]))

    expect(useReadContractsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: { enabled: false },
        contracts: [],
      })
    )

    expect(emptyMigrationsResult.current.hasMigratablePositions).toBe(false)
    expect(emptyMigrationsResult.current.migratablePositions).toEqual([])
  })

  it('falls back to underlyingToken price and never drops a funded position if USD valuation fails', () => {
    // Wrapped waEthWETH returns '0', so hook must fall back to underlying WETH
    usdValueForTokenAddressMock.mockImplementation((address: string, chain, amount) => {
      if (
        chain === GqlChainValues.Mainnet &&
        address.toLowerCase() === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
      ) {
        return String(Number(amount) * 3000)
      }

      return '0'
    })

    useReadContractsMock.mockReturnValue({
      data: [
        { status: 'success', result: 1_000_000_000_000_000_000n },
        { status: 'success', result: 0n },
        { status: 'success', result: 10_000_000_000_000_000_000n },
        {
          status: 'success',
          result: [
            [
              '0x0bfc9d54fc184518a81162f8fb99c2eaca081202',
              '0xae78736cd615f374d3085123a210448e74fc6393',
            ],
            [],
            [10_000_000_000_000_000_000n, 10_000_000_000_000_000_000n],
            [10_000_000_000_000_000_000n, 10_000_000_000_000_000_000n],
          ],
        },
        // Base pool has failed totalSupply & getPoolTokenInfo calls
        { status: 'success', result: 2_500_000_000_000_000_000n },
        { status: 'failure', error: new Error('totalSupply failed') },
        { status: 'failure', error: new Error('getPoolTokenInfo failed') },
      ],
      isLoading: false,
      refetch: refetchMock,
    })

    const { result } = testHook(() =>
      useBalV3MigratablePositions([MAINNET_RETH_WAETHWETH, BASE_NO_GAUGE_POOL])
    )

    expect(result.current.migratablePositions).toHaveLength(2)

    expect(result.current.migratablePositions[0]).toMatchObject({
      totalBptBalance: 1_000_000_000_000_000_000n,
      estimatedUsdValue: 3000,
    })

    expect(result.current.migratablePositions[1]).toMatchObject({
      totalBptBalance: 2_500_000_000_000_000_000n,
      estimatedUsdValue: 0,
    })
  })

  it('keeps funded position with 0 estimatedUsdValue if price lookup throws', () => {
    usdValueForTokenAddressMock.mockImplementation(() => {
      throw new Error('price lookup failure')
    })

    useReadContractsMock.mockReturnValue({
      data: [
        { status: 'success', result: 1_000_000_000_000_000_000n },
        { status: 'success', result: 0n },
        { status: 'success', result: 1_000_000_000_000_000_000n },
        {
          status: 'success',
          result: [
            ['0x0bfc9d54fc184518a81162f8fb99c2eaca081202'],
            [],
            [1_000_000_000_000_000_000n],
            [1_000_000_000_000_000_000n],
          ],
        },
      ],
      isLoading: false,
      refetch: refetchMock,
    })

    const { result } = testHook(() => useBalV3MigratablePositions([MAINNET_RETH_WAETHWETH]))

    expect(result.current.hasMigratablePositions).toBe(true)
    expect(result.current.migratablePositions).toHaveLength(1)

    expect(result.current.migratablePositions[0]).toMatchObject({
      totalBptBalance: 1_000_000_000_000_000_000n,
      estimatedUsdValue: 0,
    })
  })
})

describe('PoolMigrationsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useUserAccountMock.mockReturnValue({
      userAddress: USER_ADDRESS,
      isConnected: true,
    })

    usdValueForTokenAddressMock.mockReturnValue('0')

    useTokensMock.mockReturnValue({
      usdValueForTokenAddress: usdValueForTokenAddressMock,
    })

    useReadContractsMock.mockReturnValue({
      data: [
        { status: 'success', result: 1_000_000_000_000_000_000n },
        { status: 'success', result: 0n },
        { status: 'success', result: 1_000_000_000_000_000_000n },
        { status: 'failure', error: new Error('unavailable') },
      ],
      isLoading: false,
      refetch: vi.fn(),
    })
  })

  it('supports case-insensitive source and target lookups across Spec pool types and exposes migratable positions', () => {
    const migrations = [
      MAINNET_RETH_WAETHWETH,
      SURGE_TETH_WSTETH,
      OSETH_WAWETH,
      PRL_WETH_80_20,
      BASE_NO_GAUGE_POOL,
    ]

    const wrapper = ({ children }: PropsWithChildren) => (
      <PoolMigrationsProvider poolMigrations={migrations}>{children}</PoolMigrationsProvider>
    )

    const { result } = renderHook(() => usePoolMigrations(), { wrapper })

    expect(result.current.poolMigrations).toEqual(migrations)

    expect(result.current.needsMigration(3, 1, '0x1EA5870F7C037930CE1D5D8D9317C670E89E13E3')).toBe(
      true
    )

    expect(result.current.getMigration(3, 1, '0x9ED5175AECB6653C1BDAA19793C16FD74FBEEB37')).toEqual(
      SURGE_TETH_WSTETH
    )

    expect(
      result.current.getMigrationBySource(1, '0x1846C6CBE0D433E152FA358E5FF27968E18BCE7C')
    ).toEqual(PRL_WETH_80_20)

    expect(
      result.current.getMigrationBySource(8453, '0xB7B8B3AFC010169779C5C2385EC0EB0477FE3347')
    ).toEqual(BASE_NO_GAUGE_POOL)

    expect(
      result.current.getMigrationsForTarget(1, '0x0A22EAE1008C218D22C27A00B6F712483E32229A')
    ).toEqual([MAINNET_RETH_WAETHWETH])

    expect(
      result.current.getMigrationsForTarget(8453, '0x0A22EAE1008C218D22C27A00B6F712483E32229A')
    ).toEqual([])

    expect(result.current.hasMigratablePositions).toBe(true)
    expect(result.current.migratablePositions).toHaveLength(1)
  })
})
