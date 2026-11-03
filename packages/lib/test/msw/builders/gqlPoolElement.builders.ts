import {
  poolId,
  wETHAddress,
  wjAuraAddress,
  aaveEthAddress,
  wstEthAddress,
  poolId2,
} from '@repo/lib/debug-helpers'
import {
  aTokenExpandedMock,
  someGqlTokenMocks,
} from '@repo/lib/modules/tokens/__mocks__/token.builders'
import type {
  GqlPoolElement,
  GqlPoolTokenDetail,
  GqlPoolWeighted,
} from '@repo/lib/shared/services/api/graphql-derived-types'
import { GqlChainValues, GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import { getPoolAddress } from '@balancer/sdk'
import { Address, Hex } from 'viem'

function baseWeightedPool(overrides: Partial<GqlPoolWeighted> = {}): GqlPoolWeighted {
  return {
    __typename: 'GqlPoolWeighted',
    protocolVersion: 2,
    address: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56',
    poolTokens: someGqlTokenMocks(['BAL', 'WETH']) as unknown as GqlPoolTokenDetail[],
    chain: GqlChainValues.Mainnet,
    createTime: 1620153071,
    decimals: 18,
    dynamicData: {
      __typename: 'GqlPoolDynamicData',
      totalLiquidity: '176725796.079429',
      totalShares: '13131700.67391808961378162',
      volume24h: '545061.9941007149',
      fees24h: '5450.619941007149',
      holdersCount: '1917',
      swapFee: '0.01',
      isInRecoveryMode: false,
      isPaused: false,
      poolId: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014',
      surplus24h: '0',
      swapEnabled: true,
      aprItems: [],
    },
    factory: '0xa5bf2ddf098bb0ef6d120c98217dd6b141c74ee0',
    id: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014',
    name: 'Balancer 80 BAL 20 WETH',
    pauseManager: null,
    poolCreator: null,
    swapFeeManager: '0xba1ba1ba1ba1ba1ba1ba1ba1ba1ba1ba1ba1ba1b',
    symbol: 'B-80BAL-20WETH',
    type: GqlPoolTypeValues.Weighted,
    version: 1,
    hasErc4626: false,
    hasNestedErc4626: false,
    hook: null,
    liquidityManagement: null,
    tags: null,
    userBalance: null,
    ...overrides,
  } as GqlPoolWeighted
}

export function aBalWethPoolElementMock(...options: Partial<GqlPoolElement>[]): GqlPoolElement {
  const id = '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014'
  return aGqlPoolElementMock({
    id,
    address: getPoolAddress(id),
    poolTokens: someGqlTokenMocks(['BAL', 'WETH']) as unknown as GqlPoolTokenDetail[],
    protocolVersion: 2,
    ...Object.assign({}, ...options),
  })
}

export function aWjAuraWethPoolElementMock(...options: Partial<GqlPoolElement>[]): GqlPoolElement {
  const tokens = [
    aTokenExpandedMock({ address: wjAuraAddress }),
    aTokenExpandedMock({ address: wETHAddress }),
  ]

  return aGqlPoolElementMock({
    id: poolId,
    address: getPoolAddress(poolId),
    poolTokens: tokens as unknown as GqlPoolTokenDetail[],
    protocolVersion: 2,
    ...Object.assign({}, ...options),
  })
}

export function aWeightedV2PoolMock(...options: Partial<GqlPoolElement>[]): GqlPoolElement {
  const tokens = [
    aTokenExpandedMock({ address: wstEthAddress }),
    aTokenExpandedMock({ address: aaveEthAddress }),
  ]

  return aGqlPoolElementMock({
    id: poolId2,
    address: getPoolAddress(poolId2),
    poolTokens: tokens as unknown as GqlPoolTokenDetail[],
    protocolVersion: 2,
    ...Object.assign({}, ...options),
  })
}

export function toGqlWeighedPoolMock(poolElement: GqlPoolElement): GqlPoolElement {
  return {
    ...poolElement,
    __typename: 'GqlPoolWeighted',
  } as GqlPoolElement
}

export function aGqlPoolElementMock(...options: Partial<GqlPoolElement>[]): GqlPoolElement {
  return baseWeightedPool(
    Object.assign({}, ...options) as Partial<GqlPoolWeighted>
  ) as GqlPoolElement
}

export function aPhantomStablePoolMock(): GqlPoolElement {
  const id: Hex = '0x42ed016f826165c2e5976fe5bc3df540c5ad0af700000000000000000000058b'
  const wstETH: Address = '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0'
  const sfrxETH: Address = '0xac3e018457b222d93114458476f3e3416abbe38f'
  const rETH: Address = '0xae78736cd615f374d3085123a210448e74fc6393'

  const tokens = [
    aTokenExpandedMock({ address: wstETH }),
    aTokenExpandedMock({ address: rETH }),
    aTokenExpandedMock({ address: sfrxETH }),
  ]

  return aGqlPoolElementMock({
    id,
    address: getPoolAddress(id),
    poolTokens: tokens as unknown as GqlPoolTokenDetail[],
    type: GqlPoolTypeValues.Stable,
    protocolVersion: 2,
  })
}
