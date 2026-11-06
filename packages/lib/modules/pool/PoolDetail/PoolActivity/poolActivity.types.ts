import type { GqlPoolType } from '@repo/lib/shared/services/api/generated/graphql'
import { PoolVariant } from '../../pool.types'
import { ApiToken } from '@repo/lib/modules/tokens/token.types'

export type PoolActivityTokens = {
  token?: ApiToken
  amount: string
}

export type PoolActivityMetaData = {
  userAddress: string
  tokens: PoolActivityTokens[]
  tx: string
  usdValue: string
  action: 'swap' | 'add' | 'remove'
  id: string
}

export type PoolActivityEl = [number, string, PoolActivityMetaData]
export type PoolActivity = Record<'adds' | 'removes' | 'swaps', PoolActivityEl[]>
export type PoolActivityTab = 'all' | 'adds' | 'swaps' | 'removes'

export enum SortingBy {
  time = 'time',
  value = 'value',
  action = 'action',
}

export interface PoolActivityTypeTab {
  value: string
  label: string
}

export function getPoolActivityTabsList(_args: {
  variant: PoolVariant
  poolType: GqlPoolType
}): PoolActivityTypeTab[] {
  return [
    {
      value: 'all',
      label: 'All',
    },
    {
      value: 'adds',
      label: 'Adds',
    },
    {
      value: 'removes',
      label: 'Removes',
    },
    {
      value: 'swaps',
      label: 'Swaps',
    },
  ]
}
