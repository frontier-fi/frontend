/** Derived type aliases for broad schema object types that Codegen 6 no longer emits.
 *  Codegen 5 generated standalone types like GqlToken, GqlPoolElement, etc.
 *  Codegen 6 only emits operation-specific result types and fragment types.
 *  These aliases restore the old names so consumers don't need refactoring. */

import type {
  GetTokensQuery,
  GetTokenPricesQuery,
  GetPoolQuery,
  GetPoolsQuery,
  GetPoolEventsQuery,
  PoolTokensFragment,
  HookFragment,
  Erc4626ReviewDataFragment,
} from './generated/graphql.ts'

// ── Token types ──

type _GqlTokenData = GetTokensQuery['tokens'][number]
// Note: coingeckoId and priceRateProviderData are made required here to match
// ApiToken = Omit<GetTokensQuery['tokens'][number], '__typename'> which has them as required.
// Test data that omits these fields uses `as GqlToken` assertions.
export type GqlToken = Omit<_GqlTokenData, 'coingeckoId' | 'priceRateProviderData'> & {
  coingeckoId: string | null
  priceRateProviderData: _GqlTokenData['priceRateProviderData']
}
export type GqlTokenPrice = GetTokenPricesQuery['tokenPrices'][number]

// ── Pool discriminated union members ──

/** Any concrete pool returned by GetPool (Weighted | Stable | Eclp). */
export type GqlPoolElement = GetPoolQuery['pool'] & {
  /** Optional — Frontier schema omits gauges; kept for stake UI + test mocks. */
  staking?: GqlPoolStaking | null
  owner?: string
  poolCreator?: string
}
export type GqlPoolWeighted = Extract<GetPoolQuery['pool'], { __typename: 'GqlPoolWeighted' }>
/** Frontier API renamed Gyro ECLP pools to `GqlPoolEclp` / type `ECLP`. */
export type GqlPoolEclp = Extract<GetPoolQuery['pool'], { __typename: 'GqlPoolEclp' }>
/** @deprecated Use GqlPoolEclp — kept as an alias for existing helpers. */
export type GqlPoolGyro = GqlPoolEclp
export type GqlPoolStable = Extract<GetPoolQuery['pool'], { __typename: 'GqlPoolStable' }>
/** Removed from Frontier schema — kept as never for leftover imports. */
export type GqlPoolComposableStable = never
export type GqlPoolQuantAmmWeighted = never
export type GqlPoolLiquidityBootstrapping = never
/** Structural stub — LBP pages redirect away on Frontier but hydrate helpers remain. */
export type GqlPoolLiquidityBootstrappingV3 = {
  isSeedless?: boolean
  [key: string]: unknown
}
export type GqlPoolFixedPriceLbp = never

// ── Common pool type: union of all pool __typename variants ──

export type GqlPoolBase = GetPoolQuery['pool']

// ── Pool list (minimal) types ──

export type GqlPoolMinimal = GetPoolsQuery['pools'][number]

// ── Token detail / nested pool types ──

export type GqlPoolTokenDetail = PoolTokensFragment
export type GqlNestedPool = NonNullable<PoolTokensFragment['nestedPool']>

// ── Staking types (Frontier schema currently omits staking on pools) ──

export type GqlPoolStaking = {
  id?: string
  type?: string | null
  address?: string
  chain?: string
  gauge?: GqlPoolStakingGauge | null
  aura?: {
    id?: string
    apr?: number
    auraPoolAddress?: string
    auraPoolId?: string
    isShutdown?: boolean
  } | null
  reliquary?: {
    levels?: Array<{
      id?: string
      apr?: number
      allocationPoints?: number
      balance?: string
      level?: number
    }> | null
  } | null
  vebal?: {
    id?: string
    vebalAddress?: string
  } | null
}
export type GqlPoolStakingGauge = {
  id?: string
  gaugeAddress?: string
  version?: number
  status?: string
  workingSupply?: string
  otherGauges?: GqlPoolStakingOtherGauge[] | null
  rewards?: GqlPoolStakingGaugeReward[] | null
}
export type GqlPoolStakingOtherGauge = {
  id?: string
  gaugeAddress?: string
  version?: number
  status?: string
  rewards?: GqlPoolStakingGaugeReward[] | null
}
export type GqlPoolStakingGaugeReward = {
  id?: string
  tokenAddress?: string
  rewardPerSecond?: string
}

// ── User balance types ──

export type GqlPoolUserBalance = NonNullable<GetPoolsQuery['pools'][number]['userBalance']> & {
  stakedBalances?: GqlUserStakedBalance[] | null
}
export type GqlUserStakedBalance = {
  __typename?: 'GqlUserStakedBalance'
  stakingId: string
  balance: string
  balanceUsd: number
  stakingType: string
}

// ── Pool event types ──

export type GqlPoolAddRemoveEventV3 = Extract<
  GetPoolEventsQuery['poolEvents'][number],
  { __typename: 'GqlPoolAddRemoveEventV3' }
>
export type GqlPoolSwapEventV3 = Extract<
  GetPoolEventsQuery['poolEvents'][number],
  { __typename: 'GqlPoolSwapEventV3' }
>
/** Cow AMM events are not in the Frontier schema; keep a structural stub for leftover UI. */
export type GqlPoolSwapEventCowAmm = {
  __typename: 'GqlPoolSwapEventCowAmm'
  tokenIn: { address: string; amount: string }
  tokenOut: { address: string; amount: string }
}

// ── APR item types ──

export type GqlPoolAprItem = NonNullable<
  NonNullable<
    GetPoolQuery['pool'] extends infer P
      ? P extends { dynamicData?: { aprItems?: Array<infer T> } }
        ? T
        : never
      : never
  >
>

// ── Price rate provider / review data types (inline objects) ──

export type GqlPriceRateProviderData = {
  __typename?: 'GqlPriceRateProviderData'
  address: string
  reviewed: boolean
  name: string | null
  warnings: Array<string> | null
  summary?: string | null
  reviewFile?: string | null
  factory?: string | null
  upgradeableComponents?: Array<{
    __typename?: 'GqlPriceRateProviderUpgradeableComponent'
    entryPoint: string
    implementationReviewed: string
  } | null> | null
}
export type GqlPriceRateProviderUpgradeableComponent = NonNullable<
  NonNullable<GqlPriceRateProviderData['upgradeableComponents']>
>[number]

/** Frontier hooks have no review data; shape kept structurally so review UI can short-circuit. */
export type GqlHookReviewData = {
  warnings?: string[] | null
  summary?: string | null
  reviewFile?: string | null
}
export type GqlHook = HookFragment & {
  reviewData?: GqlHookReviewData | null
}

export type Erc4626ReviewData = Erc4626ReviewDataFragment

// ── Hook param types ──

export type StableSurgeHookParams = {
  __typename: 'StableSurgeHookParams'
  maxSurgeFeePercentage: string | null
  surgeThresholdPercentage: string | null
}
export type ExitFeeHookParams = {
  __typename: 'ExitFeeHookParams'
  exitFeePercentage: string | null
}
export type FeeTakingHookParams = {
  __typename: 'FeeTakingHookParams'
  addLiquidityFeePercentage: string | null
  removeLiquidityFeePercentage: string | null
  swapFeePercentage: string | null
}
export type MevTaxHookParams = {
  __typename: 'MevTaxHookParams'
  mevTaxThreshold: string | null
  mevTaxMultiplier: string | null
  maxMevSwapFeePercentage: string | null
}

// ── Quant / veBAL / STS / LBP stubs (removed from Frontier documents) ──

export type QuantAmmWeightSnapshot = {
  timestamp: number
  weights?: string[] | null
}

export type GqlVeBalLockSnapshot = never
export type GqlLBPTopTrade = {
  value: string
  address: string
  timestamp?: number
}
