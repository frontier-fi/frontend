import { Pool } from '../pool.types'
import { Address } from 'viem'
import { HumanAmount } from '@balancer/sdk'

export const migrateStakeTooltipLabel = `veBAL gauges are the mechanism to distribute BAL liquidity incentives following community voting.
The gauge where you have staked your LP tokens has been deprecated.
So it's likely best for you to migrate to the new gauge in order to get future BAL liquidity incentives.`

export type UnstakeQuote = {
  gaugeAddress: Address
  amountOut: HumanAmount
}

/*
  Frontier has no gauges — unstake quotes are always empty.
*/
export function getUnstakeQuote(_pool: Pool): UnstakeQuote {
  return {
    gaugeAddress: '' as Address,
    amountOut: '0',
  }
}

export function hasPreferentialGauge(_pool: Pool): boolean {
  return false
}

export function hasNonPreferentialStakedBalance(_pool: Pool): boolean {
  return false
}

export function getCanStake(_pool: Pool): boolean {
  // Gauges are not deployed, so staking BAL or BPTs is unavailable.
  return false
}

export function findFirstNonPreferentialStakedWithBalance(_pool: Pool): undefined {
  return undefined
}

type StakingData = {
  nonPreferentialGaugeAddress: Address
  nonPreferentialStakedBalance: HumanAmount
  isClaimable: boolean
}

export function findFirstNonPreferentialStaking(_pool: Pool): StakingData {
  return {
    nonPreferentialGaugeAddress: '' as Address,
    nonPreferentialStakedBalance: '0',
    isClaimable: false,
  }
}

/*
  This is a very rare edge case that should not happen to any user
*/
export function hasMultipleNonPreferentialStakedBalance(_pool: Pool): boolean {
  return false
}
