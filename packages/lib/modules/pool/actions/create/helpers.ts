import { PoolType } from '@frontier-fi/sdk'
import { isDev } from '@repo/lib/config/app.config'
import { Address, zeroAddress } from 'viem'
import { bn, fNumCustom, isBnParseable } from '@repo/lib/shared/utils/numbers'
import type { GqlPoolType } from '@repo/lib/shared/services/api/generated/graphql'
import { GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import {
  isConstantRateProvider,
  isDynamicRateProvider,
  isMarketRateProvider,
} from '@repo/lib/modules/tokens/token.helpers'
import { ApiOrCustomToken } from '@repo/lib/modules/tokens/token.types'
import {
  WeightedPoolStructure,
  COW_AMM_RAW_WEIGHT_50,
  COW_AMM_RAW_WEIGHT_80,
  COW_AMM_RAW_WEIGHT_20,
  BALANCER_PROTOCOL_ID,
  COW_PROTOCOL_ID,
} from './constants'
import { PoolCreationToken } from './types'

const sdkToGqlPoolType: Partial<Record<PoolType, GqlPoolType>> = {
  [PoolType.Weighted]: GqlPoolTypeValues.Weighted,
  [PoolType.Stable]: GqlPoolTypeValues.Stable,
  [PoolType.GyroE]: GqlPoolTypeValues.GyroE,
}

export function getGqlPoolType(poolType: PoolType): GqlPoolType {
  const gqlPoolType = sdkToGqlPoolType[poolType]
  if (!gqlPoolType) throw new Error(`Invalid pool type: ${poolType}`)
  return gqlPoolType
}

export function getSwapFeePercentageOptions(
  poolType: PoolType
): [SwapFeePercentageOption, SwapFeePercentageOption] {
  if (poolType === PoolType.Stable) {
    return [
      { value: '0.01', tip: 'Best for super stable pairs' },
      { value: '0.05', tip: 'Best for stable-ish pairs' },
    ]
  } else if (poolType === PoolType.Weighted) {
    return [
      { value: '0.30', tip: 'Best for most weighted pairs' },
      { value: '1.00', tip: 'Best for exotic pairs' },
    ]
  } else if (poolType === PoolType.GyroE) {
    return [
      { value: '0.30', tip: 'Best for most Elliptic CLP pairs' },
      { value: '1.00', tip: 'Best for exotic pairs' },
    ]
  } else {
    return [
      { value: '0.30', tip: 'Best for most AutoRange pairs' },
      { value: '1.00', tip: 'Best for exotic pairs' },
    ]
  }
}

export function getMinSwapFeePercentage(poolType: PoolType): number {
  if (poolType === PoolType.Stable) {
    return 0.0001
  } else {
    return 0.001
  }
}

export function getPercentFromPrice(value: string, price: string) {
  if (!isBnParseable(value) || !isBnParseable(price) || bn(price).isZero()) return '0.00'
  return bn(value).minus(price).div(price).times(100).toFixed(2)
}

export function getCowRawWeight(weight: string | undefined) {
  if (weight === '50') return COW_AMM_RAW_WEIGHT_50
  if (weight === '80') return COW_AMM_RAW_WEIGHT_80
  if (weight === '20') return COW_AMM_RAW_WEIGHT_20
  throw new Error(`Invalid weight for cow amm: ${weight}`)
}

export const formatNumber = (value: string) => {
  if (!isBnParseable(value)) return ''
  let numFormat = '0.000000'
  if (Number(value) > 1000) numFormat = '0,000.00'
  if (Number(value) > 100000) numFormat = '0,000'

  return fNumCustom(value, numFormat)
}

export function isStablePool(poolType: PoolType): boolean {
  return poolType === PoolType.Stable
}

export function isStableSurgePool(_poolType: PoolType): boolean {
  return false
}

export function isWeightedPool(poolType: PoolType): boolean {
  return poolType === PoolType.Weighted
}

export function isCustomWeightedPool(
  poolType: PoolType,
  weightedPoolStructure: WeightedPoolStructure
): boolean {
  return poolType === PoolType.Weighted && weightedPoolStructure === WeightedPoolStructure.Custom
}

export function isAutoRangePool(_poolType: PoolType): boolean {
  return false
}

export function isGyroEllipticPool(poolType: PoolType): boolean {
  return poolType === PoolType.GyroE
}

export function isEclpCreationDisabled(poolType: PoolType, isDevEnv = isDev): boolean {
  return !isDevEnv && isGyroEllipticPool(poolType)
}

export function isCowPool(_poolType: PoolType | undefined): boolean {
  return false
}

export function isCowProtocol(protocol: string): boolean {
  return protocol.toLowerCase() === COW_PROTOCOL_ID.toLowerCase()
}

export function isBalancerProtocol(protocol: string): boolean {
  const normalized = protocol.toLowerCase()
  return (
    normalized === BALANCER_PROTOCOL_ID.toLowerCase() ||
    normalized === 'frontier finance v3' ||
    normalized === 'balancer v3' ||
    normalized === 'balancer'
  )
}

export function isPoolCreatorEnabled(poolType: PoolType): boolean {
  // AutoRange and eclp factories still require zero address
  return poolType === PoolType.Stable || poolType === PoolType.Weighted
}

export function getVerifiedRateProviderAddress(
  token: ApiOrCustomToken | undefined
): Address | undefined {
  if (!token || !('priceRateProviderData' in token) || !token.priceRateProviderData) {
    return undefined
  }

  if (isConstantRateProvider(token) || isDynamicRateProvider(token)) return undefined

  return token.priceRateProviderData.address as Address | undefined
}

export function getDefaultPaysYieldFees(
  token: Pick<PoolCreationToken, 'rateProvider' | 'data'>
): boolean {
  const rateProvider = token.rateProvider
  if (!rateProvider || rateProvider === zeroAddress) return false
  const verifiedAddress = getVerifiedRateProviderAddress(token.data)
  if (!verifiedAddress) return false
  return (
    verifiedAddress.toLowerCase() === rateProvider.toLowerCase() &&
    !isMarketRateProvider(token.data)
  )
}

export type SwapFeePercentageOption = { value: string; tip: string }
