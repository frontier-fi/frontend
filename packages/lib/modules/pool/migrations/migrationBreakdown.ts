import { HumanAmount } from '@frontier-fi/sdk'
import { HumanTokenAmount, HumanTokenAmountWithSymbol } from '@repo/lib/modules/tokens/token.types'
import { isSameAddress } from '@repo/lib/shared/utils/addresses'
import { bn, isBnParseable, safeSum } from '@repo/lib/shared/utils/numbers'
import BigNumber from 'bignumber.js'

// Above this share of the removed value left out of the deposit, the user is asked to confirm it
export const LEFTOVER_ACKNOWLEDGEMENT_RATIO = 0.05

// A confirmation still holds when a later quote leaves at most this much more behind
export const LEFTOVER_ACKNOWLEDGEMENT_TOLERANCE = 0.01

export type MigrationBreakdown = {
  // What comes out of the source pool
  removed: HumanTokenAmountWithSymbol[]
  // The part of it that goes into the target pool
  deposited: HumanTokenAmountWithSymbol[]
  // The part that does not, and stays in the wallet as plain tokens
  leftover: HumanTokenAmountWithSymbol[]
  removedUsd: string
  depositedUsd: string
  leftoverUsd: string
  /**
   * Share of what is removed that stays in the wallet, from 0 to 1. Measured in USD when every
   * removed token has a price. Otherwise the largest share among the tokens, which can only
   * overstate it.
   */
  leftoverRatio: number
  isPricedInUsd: boolean
}

export const EMPTY_MIGRATION_BREAKDOWN: MigrationBreakdown = {
  removed: [],
  deposited: [],
  leftover: [],
  removedUsd: '0',
  depositedUsd: '0',
  leftoverUsd: '0',
  leftoverRatio: 0,
  isPricedInUsd: false,
}

function toPositiveAmount(humanAmount: string | undefined): BigNumber {
  // bn() throws on anything that is not a number
  if (!humanAmount || !isBnParseable(humanAmount)) return bn(0)

  const amount = bn(humanAmount)
  return amount.isFinite() && amount.gt(0) ? amount : bn(0)
}

function toRatio(part: BigNumber, total: BigNumber): number {
  if (total.lte(0)) return 0
  const ratio = part.div(total).toNumber()
  return Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0
}

function toPositiveAmounts(amounts: HumanTokenAmountWithSymbol[]): HumanTokenAmountWithSymbol[] {
  return amounts
    .filter(amount => toPositiveAmount(amount.humanAmount).gt(0))
    .map(({ tokenAddress, humanAmount, symbol, decimals }) => ({
      tokenAddress,
      humanAmount,
      symbol,
      decimals,
    }))
}

/**
 * Splits what a migration removes from the source pool into what the target pool takes and what
 * is left in the wallet, so the three can be shown side by side and add up.
 */
export function calculateMigrationBreakdown({
  removed,
  deposited,
  usdValueFor,
}: {
  removed: HumanTokenAmountWithSymbol[]
  deposited: HumanTokenAmountWithSymbol[]
  // USD value of one token amount, '0' when the token has no price
  usdValueFor: (amount: HumanTokenAmount) => string
}): MigrationBreakdown {
  const removedAmounts = toPositiveAmounts(removed)
  if (removedAmounts.length === 0) return EMPTY_MIGRATION_BREAKDOWN

  const depositedAmounts = toPositiveAmounts(deposited)

  const leftover: HumanTokenAmountWithSymbol[] = []
  let largestTokenLeftoverRatio = 0

  for (const removedAmount of removedAmounts) {
    const removedValue = toPositiveAmount(removedAmount.humanAmount)

    const depositedValue = depositedAmounts
      .filter(amount => isSameAddress(amount.tokenAddress, removedAmount.tokenAddress))
      .reduce((sum, amount) => sum.plus(toPositiveAmount(amount.humanAmount)), bn(0))

    const leftoverValue = removedValue.minus(depositedValue)
    if (leftoverValue.lte(0)) continue

    leftover.push({ ...removedAmount, humanAmount: leftoverValue.toFixed() as HumanAmount })

    largestTokenLeftoverRatio = Math.max(
      largestTokenLeftoverRatio,
      toRatio(leftoverValue, removedValue)
    )
  }

  const toUsd = (amount: HumanTokenAmount) => toPositiveAmount(usdValueFor(amount)).toFixed()

  const removedUsdValues = removedAmounts.map(toUsd)
  const removedUsd = safeSum(removedUsdValues)
  const leftoverUsd = safeSum(leftover.map(toUsd))
  const isPricedInUsd = removedUsdValues.every(usd => bn(usd).gt(0))

  return {
    removed: removedAmounts,
    deposited: depositedAmounts,
    leftover,
    removedUsd,
    depositedUsd: safeSum(depositedAmounts.map(toUsd)),
    leftoverUsd,
    leftoverRatio: isPricedInUsd
      ? toRatio(bn(leftoverUsd), bn(removedUsd))
      : largestTokenLeftoverRatio,
    isPricedInUsd,
  }
}
