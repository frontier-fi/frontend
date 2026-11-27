import { sortBy } from 'lodash'
import {
  GyroECLPMath,
  MathSol,
  WAD,
  type DerivedEclpParams,
  type EclpParams,
} from '@frontier-fi/maths'
import type { GqlPoolType } from '@repo/lib/shared/services/api/generated/graphql'
import { GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import { safeParseFixedBigInt } from '@repo/lib/shared/utils/numbers'
import { Pool } from '../../pool/pool.types'
import { isGyroEPool } from '../../pool/pool.helpers'

type GyroEParams = {
  balanceIn: bigint
  balanceOut: bigint
  decimalsIn: number
  decimalsOut: number
  gyroEParams: EclpParams
  derivedGyroEParams: DerivedEclpParams
  tokenRates: readonly [bigint, bigint] | null
}

function normalizeBalances(
  balances: [bigint, bigint],
  decimals: [number, number]
): [bigint, bigint] {
  return [
    (balances[0] * WAD) / 10n ** BigInt(decimals[0]),
    (balances[1] * WAD) / 10n ** BigInt(decimals[1]),
  ]
}

export function destructureRequiredPoolParams(
  pool: Pool,
  tokenRates?: readonly [bigint, bigint] | null
): GyroEParams | null {
  if (!isGyroEPool(pool)) return null

  const [token0, token1] = sortBy(pool.poolTokens, 'index')
  if (!token0?.balance || !token1?.balance) return null

  const balanceIn = safeParseFixedBigInt(token0.balance, token0.decimals)
  const balanceOut = safeParseFixedBigInt(token1.balance, token1.decimals)

  return {
    balanceIn,
    balanceOut,
    decimalsIn: token0.decimals,
    decimalsOut: token1.decimals,
    gyroEParams: {
      alpha: safeParseFixedBigInt(pool.alpha as string, 18),
      beta: safeParseFixedBigInt(pool.beta as string, 18),
      c: safeParseFixedBigInt(pool.c as string, 18),
      s: safeParseFixedBigInt(pool.s as string, 18),
      lambda: safeParseFixedBigInt(pool.lambda as string, 18),
    },
    derivedGyroEParams: {
      tauAlpha: {
        x: safeParseFixedBigInt(pool.tauAlphaX as string, 38),
        y: safeParseFixedBigInt(pool.tauAlphaY as string, 38),
      },
      tauBeta: {
        x: safeParseFixedBigInt(pool.tauBetaX as string, 38),
        y: safeParseFixedBigInt(pool.tauBetaY as string, 38),
      },
      u: safeParseFixedBigInt(pool.u as string, 38),
      v: safeParseFixedBigInt(pool.v as string, 38),
      w: safeParseFixedBigInt(pool.w as string, 38),
      z: safeParseFixedBigInt(pool.z as string, 38),
      dSq: safeParseFixedBigInt(pool.dSq as string, 38),
    },
    tokenRates: tokenRates ?? null,
  }
}

export function calculateSpotPrice(poolType: GqlPoolType | string, params: GyroEParams): bigint {
  if (poolType === GqlPoolTypeValues.GyroE) {
    return calculateGyroESpotPrice(params)
  }

  return 0n
}

function getScaledBalances(params: GyroEParams): [bigint, bigint] {
  const normalizedBalances = normalizeBalances(
    [params.balanceIn, params.balanceOut],
    [params.decimalsIn, params.decimalsOut]
  )

  const [rate0, rate1] = params.tokenRates ?? []

  return rate0 && rate1
    ? [
        MathSol.mulDownFixed(normalizedBalances[0], rate0),
        MathSol.mulDownFixed(normalizedBalances[1], rate1),
      ]
    : normalizedBalances
}

/**
 * Computes the pool's 18-decimal normalized (Vault-scaled) spot price and invariant `r`
 * in a single pass so callers don't compute the invariant twice.
 */
export function calculateGyroESpotPriceAndInvariant(params: GyroEParams): {
  spotPrice: bigint
  invariant: bigint
} {
  const scaledBalances = getScaledBalances(params)

  if (scaledBalances[0] === 0n && scaledBalances[1] === 0n) {
    return { spotPrice: 0n, invariant: 0n }
  }

  const [invariant] = GyroECLPMath.calculateInvariantWithError(
    scaledBalances,
    params.gyroEParams,
    params.derivedGyroEParams
  )

  const spotPrice = GyroECLPMath.calcSpotPrice0in1(
    scaledBalances,
    params.gyroEParams,
    params.derivedGyroEParams,
    invariant
  )

  return { spotPrice, invariant }
}

function calculateGyroESpotPrice(params: GyroEParams): bigint {
  return calculateGyroESpotPriceAndInvariant(params).spotPrice
}
