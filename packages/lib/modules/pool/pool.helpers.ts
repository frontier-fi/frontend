import { getChainId, getChainName, getNetworkConfig } from '@repo/lib/config/app.config'
import type {
  GqlPoolBase,
  GqlPoolStakingGauge,
  GqlPoolStakingOtherGauge,
  GqlPoolTokenDetail,
} from '@repo/lib/shared/services/api/graphql-derived-types'
import { HookFragment } from '@repo/lib/shared/services/api/generated/graphql'
import type {
  GqlChain,
  GqlHookType,
  GqlPoolType,
} from '@repo/lib/shared/services/api/generated/graphql'
import { GqlChainValues, GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import { isSameAddress } from '@repo/lib/shared/utils/addresses'
import { bn, isTooSmallToRemoveUsd } from '@repo/lib/shared/utils/numbers'
import BigNumber from 'bignumber.js'
import { isEmpty, isNil } from 'lodash'
import { Address, getAddress, parseUnits, zeroAddress } from 'viem'
import { BPT_DECIMALS } from './pool.constants'
import { isChainDeprecated } from '../chains/chain.utils'
import { ClaimablePool } from './actions/claim/ClaimProvider'
import { PoolIssue } from './alerts/pool-issues/PoolIssue.type'
import {
  getUserTotalBalanceInt,
  getUserWalletBalance,
  getUserWalletBalanceUsd,
} from './user-balance.helpers'
import { differenceInCalendarDays, secondsToMilliseconds } from 'date-fns'
import { dateToUnixTimestamp } from '@repo/lib/shared/utils/time'
import { balancerV2VaultAbi } from '../web3/contracts/abi/generated'
import { supportsNestedActions } from './actions/LiquidityActionHelpers'
import { vaultAbi_V3 } from '@balancer/sdk'
import { Pool, PoolCore, PoolFilterType } from './pool.types'
import { getBlockExplorerAddressUrl } from '@repo/lib/shared/utils/blockExplorer'
import { allPoolTokens, isStandardOrUnderlyingRootToken } from './pool-tokens.utils'
import { PoolMetadata } from './metadata/getPoolsMetadata'
import { getPoolTypeLabel } from '@repo/lib/modules/pool/pool.utils'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'

/**
 * METHODS
 */
export function addressFor(poolId: string): string {
  return getAddress(poolId.slice(0, 42))
}

export function isStable(poolType: GqlPoolType): boolean {
  return poolType === GqlPoolTypeValues.Stable
}

export function isNonComposableStable(poolType: GqlPoolType): boolean {
  return poolType === GqlPoolTypeValues.Stable
}

/** Frontier API has no META_STABLE — always false. */
export function isMetaStable(_poolType: GqlPoolType | string): boolean {
  return false
}

/** Frontier API has no COMPOSABLE_STABLE — always false. */
export function isComposableStable(_poolType: GqlPoolType | string): boolean {
  return false
}

export function isComposableStableV1(pool: Pool): boolean {
  return isComposableStable(pool.type) && pool.version === 1
}

/** Frontier API has no FX — always false. */
export function isFx(_poolType: GqlPoolType | string): boolean {
  return false
}

export function isBoosted(pool: Pick<PoolCore, 'protocolVersion' | 'tags'>) {
  return isV3Pool(pool) && pool.tags?.includes('BOOSTED')
}

/** Non-ECLP Gyro types are not in the Frontier API. ECLP is matched via isGyroEPool. */
export function isGyro(poolType: GqlPoolType | string) {
  return poolType === GqlPoolTypeValues.Eclp
}

export function isClp(poolType: GqlPoolType | string) {
  return isGyro(poolType)
}

export function isGyroEPool(
  pool: Pool
): pool is Pool & { __typename: 'GqlPoolEclp'; type: typeof GqlPoolTypeValues.Eclp } {
  // Frontier API uses type ECLP / __typename GqlPoolEclp (formerly GyroE).
  return pool.type === GqlPoolTypeValues.Eclp
}

/** Frontier API has no RECLAMM / AutoRange — always false. */
export function isAutoRange(_poolType: GqlPoolType | string): boolean {
  return false
}

export function isUnknownType(poolType: any): boolean {
  return !Object.values(GqlPoolTypeValues).includes(poolType)
}

/** LBP is out of scope for Frontier; stubs remain so call sites compile. */
export function isLiquidityBootstrapping(_poolType: GqlPoolType): boolean {
  return false
}

export function isLBP(_poolType: GqlPoolType): boolean {
  return false
}

export function isV3LBP(_pool: Pool): boolean {
  return false
}

export function isFixedLBP(_pool: Pool): boolean {
  return false
}

export function isDynamicLBP(_pool: Pool): boolean {
  return false
}

export function isWeighted(poolType: GqlPoolType): boolean {
  return poolType === GqlPoolTypeValues.Weighted
}

export function isWeightedV1(pool: Pool): boolean {
  return pool.version === 1 && isWeighted(pool.type)
}

/** Frontier API has no INVESTMENT / managed pools — always false. */
export function isManaged(_poolType: GqlPoolType | string): boolean {
  return false
}

export function isWeightedLike(poolType: GqlPoolType): boolean {
  return isWeighted(poolType) || isManaged(poolType)
}

export function isStableLike(poolType: GqlPoolType): boolean {
  return isStable(poolType) || isGyro(poolType)
}

export function isSwappingHaltable(poolType: GqlPoolType): boolean {
  return isManaged(poolType)
}

export function isVebalPool(poolId: string): boolean {
  return (
    poolId.toLowerCase() === '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014'
  )
}

/** Frontier API has no COW_AMM — always false. */
export function isCowAmmPool(_poolType: GqlPoolType | string): boolean {
  return false
}

/** Frontier API has no QUANT_AMM_WEIGHTED — always false. */
export function isQuantAmmPool(_poolType: GqlPoolType | string): boolean {
  return false
}

export function getPoolActivityTitle(activeTab: string | undefined, count: number) {
  const singularTitleByTab = {
    all: 'transaction',
    adds: 'add',
    removes: 'remove',
    swaps: 'swap',
  } as const

  if (!activeTab) return ''

  const singularTitle = singularTitleByTab[activeTab as keyof typeof singularTitleByTab]
  if (!singularTitle) return activeTab

  return count === 1 ? singularTitle : `${singularTitle}s`
}

export function noInitLiquidity(pool: GqlPoolBase): boolean {
  // Uncomment to DEBUG
  // if (
  //   pool.id ===
  //   '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014'
  // )
  //   return true;
  return bn(pool.dynamicData.totalShares || '0').eq(0)
}

export function preMintedBptIndex(pool: GqlPoolBase): number | void {
  return allPoolTokens(pool).findIndex(token => isSameAddress(token.address, pool.address))
}

export function createdAfterTimestamp(pool: GqlPoolBase): boolean {
  // Pools should always have valid createTime so, for safety, we block the pool in case we don't get it
  // (createTime should probably not be treated as optional in the SDK types)
  if (!pool.createTime) return true

  const creationTimestampLimit = dateToUnixTimestamp('2023-03-29')

  // // Uncomment to debug
  // if (
  //   pool.id ===
  //   '0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080'
  // )
  //   creationTimestampLimit = dateToUnixTimestamp('2021-08-13'); //DEBUG DATE

  // Epoch timestamp is bigger if the date is older
  return pool.createTime > creationTimestampLimit
}

export function calcUserShareOfPool(pool: Pool) {
  const userBalance = getUserTotalBalanceInt(pool)
  return calcShareOfPool(pool, userBalance)
}

export function calcFutureUserShareOfPool(pool: Pool, bptAmount: BigNumber) {
  const userBalance = getUserTotalBalanceInt(pool)
  const poolBalance = calcPoolBalance(pool)

  const newUserBalance = bn(userBalance).plus(bn(bptAmount))
  const newPoolBalance = poolBalance.plus(bn(bptAmount))
  return bn(newUserBalance).div(newPoolBalance)
}

export function calcShareOfPool(pool: Pool, rawBalance: bigint) {
  const poolBalance = calcPoolBalance(pool)
  return bn(rawBalance).div(bn(poolBalance))
}

export function calcPoolBalance(pool: Pool) {
  return bn(parseUnits(pool.dynamicData.totalShares, BPT_DECIMALS))
}

export function getPoolHelpers(pool: Pool, chain: GqlChain) {
  // Frontier has no gauges — gauge fields stay empty.
  const poolExplorerLink = getBlockExplorerAddressUrl(pool.address as Address, chain)
  const chainId = getChainId(pool.chain)

  return {
    poolExplorerLink,
    gaugeExplorerLink: '',
    hasGaugeAddress: false,
    gaugeAddress: '',
    chainId,
  }
}

export function hasNestedPools(pool: Pool) {
  if (!pool.poolTokens) return false

  return pool.poolTokens.some(token => token.hasNestedPool)
}

export function isNotSupported(pool: Pool) {
  if (!hasNestedPools(pool) || !pool.poolTokens) return false

  const tokens = pool.poolTokens.filter(token => !isSameAddress(token.address, pool.address))
  const numTokensWithNestedPool = tokens.filter(token => !!token.nestedPool).length

  // replacement for 'nestingType' in pool && pool.nestingType === 'HAS_ONLY_PHANTOM_BPT'
  return numTokensWithNestedPool === tokens.length && tokens.length > 0
}

/**
 * Returns true if the gauge is claimable within this UI. We don't support
 * claiming for v1 gauges on child-chains because they are deprecated and don't
 * conform to the the same interface as v1 gauges on mainnet and v2 gauges on child-chains.
 * Frontier has no gauges — always false.
 */
export function isClaimableGauge(
  _gauge: GqlPoolStakingGauge | GqlPoolStakingOtherGauge,
  _chain: GqlChain | number
): boolean {
  return false
}

/**
 * Returns all gauge addresses for a pool that are claimable.
 * Frontier has no gauges — always empty.
 */
export function allClaimableGaugeAddressesFor(_pool: ClaimablePool): Address[] {
  return []
}

export function hasReviewedRateProvider(token: GqlPoolTokenDetail | any): boolean {
  return !!token.priceRateProvider && !!token.priceRateProviderData
}

export function hasRateProvider(token: GqlPoolTokenDetail | any): boolean {
  const hasNoPriceRateProvider =
    isNil(token.priceRateProvider) || // if null, we consider rate provider as zero address
    token.priceRateProvider === zeroAddress ||
    token.priceRateProvider === token.nestedPool?.address

  return !hasNoPriceRateProvider && !isNil(token.priceRateProviderData)
}

export function hasReviewedHook(hook: HookFragment): boolean {
  // Frontier Hook fragment has no reviewData — treat as N/A (do not block as unreviewed)
  if (!('reviewData' in hook)) return true
  return !!(hook as { reviewData?: unknown }).reviewData
}

export function hasHooks(pool: Pool): boolean {
  const nestedHooks = pool.poolTokens
    .filter(token => token.hasNestedPool)
    .map(token => token.nestedPool?.hook)

  return !![pool.hook, ...nestedHooks].filter(Boolean).length
}

export function hasSurgeHook(_pool: Pool): boolean {
  // Frontier hook type is UNKNOWN only — STABLE_SURGE is not available
  return false
}

export function hasHookType(pool: Pool, hookType: GqlHookType | string): boolean {
  const nestedHooks = pool.poolTokens.flatMap(token =>
    token.nestedPool ? token.nestedPool.hook : []
  )

  const hooks = [...(pool.hook ? [pool.hook] : []), ...nestedHooks]

  // Compare as string to avoid TS2367 when callers pass legacy hook type constants
  return hooks.some(hook => hook && (hook.type as string) === hookType)
}

export function hasReviewedErc4626(token: GqlPoolTokenDetail): boolean {
  return token.isErc4626 && !!token.erc4626ReviewData
}

// Emergency flag to block adds for all V3 pools
const shouldBlockV3PoolAdds = false

/**
 * Returns true if we should block the user from adding liquidity to the pool.
 * @see https://github.com/balancer/frontend-v3/issues/613#issuecomment-2149443249
 */
export function shouldBlockAddLiquidity(pool: Pool, metadata?: PoolMetadata) {
  const reasons = getPoolAddBlockedReason(pool, metadata)
  return reasons.length > 0
}

export function getPoolAddBlockedReason(pool: Pool, metadata?: PoolMetadata): string[] {
  // we allow the metadata to override the default behavior
  if (metadata?.allowAddLiquidity === true) return []

  const reasons: string[] = []

  if (isV3Pool(pool) && shouldBlockV3PoolAdds) {
    reasons.push('Adds are temporarily blocked for all pools')
  }

  if (isManaged(pool.type)) reasons.push('Managed pools are not supported.')
  if (pool.dynamicData.isPaused) reasons.push('Paused pool')
  if (pool.dynamicData.isInRecoveryMode) reasons.push('Pool in recovery')

  if (isAffectedByV2Exploit(pool)) {
    reasons.push('This pool type is affected by an exploit. Adding liquidity is not allowed')
  }

  if (isNotSupported(pool)) {
    reasons.push(
      `This pool type is not currently supported in the ${PROJECT_CONFIG.projectName} UI`
    )
  }

  if (isChainDeprecated(pool.chain)) {
    reasons.push(`${getChainName(pool.chain)} is being sunset on ${PROJECT_CONFIG.projectName}`)
  }

  // Mainnet registry review checks (hooks, rate providers, ERC4626, token allowlist) are skipped on Sepolia testnet
  if (pool.chain === GqlChainValues.Sepolia) return reasons

  if (pool.hook && !hasReviewedHook(pool.hook)) reasons.push('Unreviewed hook')

  if (
    pool.hook &&
    'reviewData' in pool.hook &&
    (pool.hook as { reviewData?: { summary?: string } }).reviewData?.summary === 'unsafe'
  ) {
    reasons.push('Unsafe hook')
  }

  const poolTokens = pool.poolTokens as GqlPoolTokenDetail[]

  for (const token of poolTokens) {
    // if token is not allowed - we should block adding liquidity
    if (!token.isAllowed) {
      reasons.push(`Token: ${token.symbol} is not currently supported`)
    }

    if (
      token.priceRateProvider &&
      // if rateProvider is null - we consider it as zero address and not block adding liquidity
      token.priceRateProvider !== zeroAddress &&
      // if rateProvider is the nested pool address - we consider it as safe
      token.priceRateProvider !== token.nestedPool?.address
    ) {
      // if price rate provider is set but is not reviewed - we should block adding liquidity
      if (!hasReviewedRateProvider(token)) {
        reasons.push(`Rate provider for token ${token.symbol} was not yet reviewed`)
      } else if (token.priceRateProviderData?.summary !== 'safe') {
        reasons.push(`Rate provider for token ${token.symbol} is not safe`)
      }
    }

    if (isBoosted(pool) && token.isErc4626 && token.useUnderlyingForAddRemove) {
      if (!hasReviewedErc4626(token)) {
        reasons.push(`Tokenized vault for token ${token.symbol} was not yet reviewed`)
      } else if (token.erc4626ReviewData?.summary !== 'safe') {
        reasons.push(`Tokenized vault for token ${token.symbol} is not safe`)
      }
    }
  }

  return reasons
}

export function isAffectedByV2Exploit(pool: Pool) {
  if (isV2Pool(pool) && (isComposableStable(pool.type) || isMetaStable(pool.type))) {
    if (
      pool.poolTokens.some(
        token => token.priceRateProvider && token.priceRateProvider !== zeroAddress
      )
    ) {
      return true
    }
  }

  return false
}

export function shouldBlockRemoveLiquidity(pool: Pool) {
  const reasons = getPoolRemoveBlockedReason(pool)
  return reasons.length > 0
}

export function getPoolRemoveBlockedReason(pool: Pool): string[] {
  const hasUnstakedBalance = bn(getUserWalletBalance(pool)).gt(0)

  const hasTooSmallBalance =
    pool.chain !== GqlChainValues.Sepolia && isTooSmallToRemoveUsd(getUserWalletBalanceUsd(pool))

  const reasons: string[] = []

  if (isManaged(pool.type)) reasons.push('Managed pools are not supported.')
  if (!hasUnstakedBalance) reasons.push("You don't have any unstaked balance to remove")
  if (hasTooSmallBalance) reasons.push('Your balance is too small to remove')

  return reasons
}

export function isAffectedByCspIssue(pool: Pool) {
  return isAffectedBy(pool, PoolIssue.CspPoolVulnWarning)
}

function isAffectedBy(pool: Pool, poolIssue: PoolIssue) {
  const issues = getNetworkConfig(getChainId(pool.chain)).pools.issues
  const affectedPoolIds = issues[poolIssue] ?? []
  return affectedPoolIds.includes(pool.id.toLowerCase())
}

export function getVaultConfig(pool: Pool) {
  const networkConfig = getNetworkConfig(pool.chain)

  const vaultAddress =
    pool.protocolVersion === 3
      ? networkConfig.contracts.balancer.vaultV3!
      : networkConfig.contracts.balancer.vaultV2

  const balancerVaultAbi = pool.protocolVersion === 3 ? vaultAbi_V3 : balancerV2VaultAbi

  return { vaultAddress, balancerVaultAbi }
}

type PoolWithProtocolVersion = Pick<PoolCore, 'protocolVersion'>

export function isV1Pool(pool: PoolWithProtocolVersion): boolean {
  return pool.protocolVersion === 1
}

export function isV2Pool(pool: PoolWithProtocolVersion): boolean {
  return pool.protocolVersion === 2
}

export function isV3Pool(pool: PoolWithProtocolVersion): boolean {
  return pool.protocolVersion === 3
}

export function isV3WithNestedActionsPool(pool: Pool): boolean {
  return supportsNestedActions(pool) && isV3Pool(pool)
}

export function supportsWethIsEth(pool: Pool): boolean {
  /*
    Currently all SDK handlers support wethIsEth
    and Cow AMM pools is the only scenario that doesn't support wethIsEth
  */
  return !isCowAmmPool(pool.type) && !pool.hasErc4626 && !pool.hasNestedErc4626
}

export function requiresPermit2Approval(pool: Pool): boolean {
  return isV3Pool(pool)
}

export function isUnbalancedLiquidityDisabled(pool: Pool): boolean {
  return !!pool.liquidityManagement?.disableUnbalancedLiquidity
}

export function getWarnings(warnings: string[]) {
  return warnings.filter(warning => !isEmpty(warning))
}

/*
  Allowed pool swaps:
    1. From a standard root token to another standard root token
    2. From a standard root token to a nested child token
    3. From a nested child token to a standard root token
  Disallowed pool swaps:
    1. From a nested child token to another nested child token
*/
export function isPoolSwapAllowed(pool: Pool, token1: Address, token2: Address): boolean {
  if (
    !isStandardOrUnderlyingRootToken(pool, token1) &&
    !isStandardOrUnderlyingRootToken(pool, token2)
  ) {
    return false
  }

  return true
}

export function poolTypeLabel(poolType: PoolFilterType) {
  // Widen to string: filters use legacy keys (e.g. GYRO) while the API returns ECLP
  switch (poolType as string) {
    case GqlPoolTypeValues.Weighted:
      return 'Weighted'
    case GqlPoolTypeValues.Stable:
      return 'Stable'
    // Gyro filter maps to Frontier ECLP pools
    case GqlPoolTypeValues.Gyro:
    case GqlPoolTypeValues.Eclp:
      return 'E-CLP'
    default:
      return getPoolTypeLabel(poolType as GqlPoolType)
  }
}

export function poolHasRateProviderExternalOracle(pool: Pool): boolean {
  return pool.poolTokens.some(token =>
    token.priceRateProviderData?.warnings?.includes('market-rate')
  )
}

/**
 * Returns a human-readable caption for pool activity date range.
 * - 0 days ago → 'today'
 * - 1 day ago → 'since yesterday'
 * - 2+ days ago → 'in last N days'
 */
export function getPoolActivityDateCaption(minTimestampSeconds: number): string {
  const diffInDays = differenceInCalendarDays(
    new Date(),
    new Date(secondsToMilliseconds(minTimestampSeconds))
  )

  if (diffInDays === 0) return 'today'
  if (diffInDays === 1) return 'since yesterday'
  return `in last ${diffInDays} days`
}
