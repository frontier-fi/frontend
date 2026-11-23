import { bn } from '@repo/lib/shared/utils/numbers'
import {
  ONE_E18,
  calculateMarketRateMultiplier,
  getErc4626UnwrapShareInput,
  normalizeErc4626AssetsTo18,
  parseRateTo18,
} from './eclpRateScaling'

describe('eclpRateScaling', () => {
  describe('getErc4626UnwrapShareInput and normalizeErc4626AssetsTo18', () => {
    it.each([
      { shareDecimals: 6, underlyingDecimals: 6, expectedShares: 10n ** 18n, expectedExp: 0 },
      { shareDecimals: 18, underlyingDecimals: 18, expectedShares: 10n ** 18n, expectedExp: 0 },
      { shareDecimals: 18, underlyingDecimals: 6, expectedShares: 10n ** 30n, expectedExp: 0 },
      { shareDecimals: 6, underlyingDecimals: 18, expectedShares: 10n ** 6n, expectedExp: 0 },
    ])(
      'computes shares and scale exponent for ($shareDecimals, $underlyingDecimals)',
      ({ shareDecimals, underlyingDecimals, expectedShares, expectedExp }) => {
        const result = getErc4626UnwrapShareInput(shareDecimals, underlyingDecimals)
        expect(result.shares).toBe(expectedShares)
        expect(result.scaleUpExponent).toBe(expectedExp)
      }
    )

    it('handles negative exponents when underlying decimals exceed share + 18', () => {
      const result = getErc4626UnwrapShareInput(6, 26)
      expect(result).toEqual({ shares: 10n ** 6n, scaleUpExponent: -8 })
      expect(normalizeErc4626AssetsTo18(1_23000000n * 10n ** 8n, -8)).toBe(1_23000000n)
    })

    it('scales assets cleanly when scaleUpExponent is zero or positive', () => {
      expect(normalizeErc4626AssetsTo18(1_050_000_000_000_000_000n, 0)).toBe(
        1_050_000_000_000_000_000n
      )

      expect(normalizeErc4626AssetsTo18(1_050_000n, 12)).toBe(1_050_000_000_000_000_000n)
    })
  })

  describe('calculateMarketRateMultiplier', () => {
    it('returns the wstETH / rETH market multiplier for composed ERC-4626 + LST pools', () => {
      // Ethereum waEthLidowstETH (r0 = aave * wstETH/ETH, u0 = aave) paired with rETH (r1 = rETH/ETH, u1 = 1)
      const r0 = 1_255081969318627477n
      const u0 = 1_004027778713733055n
      const r1 = 1_176331165938233836n
      const u1 = ONE_E18

      const { multiplier, hasRateAdjustment } = calculateMarketRateMultiplier([r0, r1], [u0, u1])

      expect(hasRateAdjustment).toBe(true)
      expect(multiplier.toNumber()).toBeCloseTo(1.0626659, 6)
    })

    it('cancels exact ERC-4626 rates to 1 with hasRateAdjustment false for Base waBasEURC / waBasUSDC', () => {
      const r0 = 1_037757538009107818n
      const r1 = 1_155701029828073487n

      const { multiplier, hasRateAdjustment } = calculateMarketRateMultiplier([r0, r1], [r0, r1])

      expect(hasRateAdjustment).toBe(false)
      expect(multiplier.toString()).toBe('1')
    })

    it('cancels half-boosted ERC-4626 pools like BAL / waEthUSDC to 1', () => {
      const r0 = ONE_E18
      const r1 = 1_195118650756646646n

      const { multiplier, hasRateAdjustment } = calculateMarketRateMultiplier([r0, r1], [r0, r1])

      expect(hasRateAdjustment).toBe(false)
      expect(multiplier.toString()).toBe('1')
    })

    it('computes market multiplier for non-boosted LST pools like wstETH / WETH', () => {
      const r0 = 1_250047056393720046n
      const r1 = ONE_E18

      const { multiplier, hasRateAdjustment } = calculateMarketRateMultiplier(
        [r0, r1],
        [ONE_E18, ONE_E18]
      )

      expect(hasRateAdjustment).toBe(true)
      expect(multiplier.toNumber()).toBeCloseTo(1.250047, 6)
    })

    it('returns multiplier 1 and hasRateAdjustment false for standard pools without rate providers', () => {
      const { multiplier, hasRateAdjustment } = calculateMarketRateMultiplier(
        [ONE_E18, ONE_E18],
        [ONE_E18, ONE_E18]
      )

      expect(hasRateAdjustment).toBe(false)
      expect(multiplier.toString()).toBe('1')
    })

    it('falls back safely when any rate or unwrap rate is zero or negative', () => {
      expect(
        calculateMarketRateMultiplier([0n, ONE_E18], [ONE_E18, ONE_E18]).multiplier.toString()
      ).toBe('1')

      expect(
        calculateMarketRateMultiplier([ONE_E18, ONE_E18], [ONE_E18, 0n]).hasRateAdjustment
      ).toBe(false)
    })

    it('snaps sub-epsilon diffs to exact multiplier 1 without leaking drift', () => {
      // ~1.5e9 wei delta (~1.5e-9 relative, well inside RATE_ADJUSTMENT_EPSILON = 1e-6)
      const r0 = 1_037814275417584008n
      const u0 = r0 - 1_500_000_000n
      const r1 = 1_155825319536900535n
      const u1 = r1 + 1_500_000_000n

      const res = calculateMarketRateMultiplier([r0, r1], [u0, u1])
      expect(res.hasRateAdjustment).toBe(false)
      expect(res.multiplier.toString()).toBe('1')
    })

    it('snaps sub-epsilon noise per token while preserving real LST scaling on the pair token', () => {
      const r0 = 1_004027778713733055n
      const u0 = r0 - 1_500_000_000n
      const r1 = 1_176331165938233836n
      const u1 = ONE_E18

      const res = calculateMarketRateMultiplier([r0, r1], [u0, u1])
      expect(res.hasRateAdjustment).toBe(true)

      expect(res.multiplier.toString()).toBe(
        bn(1).div(bn(r1.toString()).div(u1.toString())).toString()
      )
    })
  })

  describe('parseRateTo18', () => {
    it('handles undefined, empty, malformed, non-positive, decimal strings, and bigints', () => {
      expect(parseRateTo18(undefined)).toBe(ONE_E18)
      expect(parseRateTo18('')).toBe(ONE_E18)
      expect(parseRateTo18('.')).toBe(ONE_E18)
      expect(parseRateTo18('NaN')).toBe(ONE_E18)
      expect(parseRateTo18('0')).toBe(ONE_E18)
      expect(parseRateTo18('-1')).toBe(ONE_E18)
      expect(parseRateTo18('1.255')).toBe(1_255000000000000000n)
      expect(parseRateTo18(1255n)).toBe(1255n)
      expect(parseRateTo18(0n)).toBe(ONE_E18)
    })
  })
})
