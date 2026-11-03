import { describe, expect, it } from 'vitest'
import type {
  GetTokensQuery,
  GetTokenPricesQuery,
  GetPoolQuery,
  GetPoolsQuery,
  GetPoolEventsQuery,
  PoolTokensFragment,
  HookFragment,
  Erc4626ReviewDataFragment,
} from './generated/graphql'
import type {
  GqlToken,
  GqlTokenPrice,
  GqlPoolElement,
  GqlPoolWeighted,
  GqlPoolGyro,
  GqlPoolTokenDetail,
  GqlNestedPool,
  GqlPoolUserBalance,
  GqlPoolAddRemoveEventV3,
  GqlPoolSwapEventV3,
  GqlHook,
  Erc4626ReviewData,
} from './graphql-derived-types'

describe('graphql-derived-types', () => {
  it('derived types are structurally compatible with generated types', () => {
    type _CheckToken = GqlToken extends GetTokensQuery['tokens'][number] ? true : never
    type _CheckTokenPrice = GqlTokenPrice extends GetTokenPricesQuery['tokenPrices'][number]
      ? true
      : never
    type _CheckPoolElement = GqlPoolElement extends GetPoolQuery['pool'] ? true : never
    type _CheckPoolWeighted = GqlPoolWeighted extends GetPoolQuery['pool'] ? true : never
    type _CheckPoolGyro = GqlPoolGyro extends GetPoolQuery['pool'] ? true : never
    type _CheckPoolTokenDetail = GqlPoolTokenDetail extends PoolTokensFragment ? true : never
    type _CheckNestedPool =
      GqlNestedPool extends NonNullable<PoolTokensFragment['nestedPool']> ? true : never
    type _CheckPoolUserBalance =
      GqlPoolUserBalance extends NonNullable<GetPoolsQuery['pools'][number]['userBalance']>
        ? true
        : never
    type _CheckPoolAddRemoveEventV3 =
      GqlPoolAddRemoveEventV3 extends GetPoolEventsQuery['poolEvents'][number] ? true : never
    type _CheckPoolSwapEventV3 = GqlPoolSwapEventV3 extends GetPoolEventsQuery['poolEvents'][number]
      ? true
      : never
    type _CheckHook = GqlHook extends HookFragment ? true : never
    type _CheckErc4626ReviewData = Erc4626ReviewData extends Erc4626ReviewDataFragment
      ? true
      : never

    expect(true).toBe(true)
  })
})
