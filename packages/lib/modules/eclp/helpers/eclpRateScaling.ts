import { BigNumber } from 'bignumber.js'
import { bn, safeParseFixedBigInt } from '@repo/lib/shared/utils/numbers'

export const ONE_E18 = 10n ** 18n
export const RATE_ADJUSTMENT_EPSILON = 1e-6

/**
 * Computes the ERC-4626 `convertToAssets` share input matching Balancer V3's
 * 18-decimal `ERC4626RateProvider` convention, plus the remaining power of 10
 * needed to normalize the returned `assets` to 18 decimals.
 */
export function getErc4626UnwrapShareInput(
  shareDecimals: number,
  underlyingDecimals: number
): { shares: bigint; scaleUpExponent: number } {
  const exponent = 18 - underlyingDecimals + shareDecimals

  if (exponent >= 0) {
    return { shares: 10n ** BigInt(exponent), scaleUpExponent: 0 }
  }

  return { shares: 10n ** BigInt(shareDecimals), scaleUpExponent: 18 - underlyingDecimals }
}

/**
 * Normalizes the raw `assets` returned by `convertToAssets` into an
 * 18-decimal fixed-point unwrap rate.
 */
export function normalizeErc4626AssetsTo18(assets: bigint, scaleUpExponent: number): bigint {
  if (scaleUpExponent > 0) return assets * 10n ** BigInt(scaleUpExponent)
  if (scaleUpExponent < 0) return assets / 10n ** BigInt(-scaleUpExponent)
  return assets
}

/**
 * Computes the multiplier from Vault-scaled (normalized) price space to
 * displayed market price space (`token1 / token0`):
 *
 *   multiplier = (rate0 / unwrap0) / (rate1 / unwrap1)
 *
 * Exact bigint equality (`rate_i === unwrap_i`) cancels identically to 1, and
 * sub-epsilon diffs (<= `RATE_ADJUSTMENT_EPSILON`) snap each token factor and
 * final multiplier to exact `1` so tiny cross-block/rounding deltas never leak
 * into displayed bounds.
 */
export function calculateMarketRateMultiplier(
  tokenRates: readonly [bigint, bigint],
  unwrapRates: readonly [bigint, bigint]
): { multiplier: BigNumber; hasRateAdjustment: boolean } {
  const [rate0, rate1] = tokenRates
  const [unwrap0, unwrap1] = unwrapRates

  if (rate0 <= 0n || rate1 <= 0n || unwrap0 <= 0n || unwrap1 <= 0n) {
    return { multiplier: bn(1), hasRateAdjustment: false }
  }

  if (rate0 === unwrap0 && rate1 === unwrap1) {
    return { multiplier: bn(1), hasRateAdjustment: false }
  }

  const rawEff0 = rate0 === unwrap0 ? bn(1) : bn(rate0.toString()).div(unwrap0.toString())
  const rawEff1 = rate1 === unwrap1 ? bn(1) : bn(rate1.toString()).div(unwrap1.toString())

  const eff0 = rawEff0.minus(1).abs().lte(RATE_ADJUSTMENT_EPSILON) ? bn(1) : rawEff0
  const eff1 = rawEff1.minus(1).abs().lte(RATE_ADJUSTMENT_EPSILON) ? bn(1) : rawEff1
  const multiplier = eff0.div(eff1)

  const hasRateAdjustment =
    multiplier.isFinite() &&
    multiplier.gt(0) &&
    multiplier.minus(1).abs().gt(RATE_ADJUSTMENT_EPSILON)

  if (!hasRateAdjustment) {
    return { multiplier: bn(1), hasRateAdjustment: false }
  }

  return { multiplier, hasRateAdjustment }
}

/**
 * Parses a decimal string or bigint rate into an 18-decimal positive bigint,
 * defaulting to `ONE_E18` when missing, empty, or non-positive.
 */
export function parseRateTo18(rate: string | bigint | undefined): bigint {
  if (typeof rate === 'bigint') {
    return rate > 0n ? rate : ONE_E18
  }

  if (typeof rate === 'string') {
    const trimmed = rate.trim()
    if (!trimmed) return ONE_E18

    try {
      const parsed = safeParseFixedBigInt(trimmed, 18)
      return parsed > 0n ? parsed : ONE_E18
    } catch {
      return ONE_E18
    }
  }

  return ONE_E18
}
