import type {
  GqlNestedPool,
  GqlPoolElement,
  QuantAmmWeightSnapshot,
} from '@repo/lib/shared/services/api/graphql-derived-types'
import {
  GetPoolsQuery,
  GetPoolsQueryVariables,
} from '@repo/lib/shared/services/api/generated/graphql'
import type {
  GqlChain,
  GqlPoolType,
  GqlPoolOrderBy,
} from '@repo/lib/shared/services/api/generated/graphql'
import { GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import { Address, Hex } from 'viem'
import { ApiToken } from '../tokens/token.types'

export type Pool = GqlPoolElement
/** @deprecated Prefer Pool['staking'] — kept for leftover imports. */
export type LegacyPoolStaking = NonNullable<Pool['staking']>

/** Legacy LBP shape. Frontier pools do not include these fields. */
export type LbpV3 = Pool & {
  startTime: number
  endTime: number
  /** Address string in some call sites; token object in others. */
  projectToken?: any
  projectTokenIndex: number
  reserveTokenIndex: number
  projectTokenRate?: string
  reserveToken?: any
  isProjectTokenSwapInBlocked?: boolean
  topTrades?: Array<{
    value: string
    address: string
    timestamp?: number
  }>
  lbpName?: string
  description?: string
  website?: string
  x?: string | null
  discord?: string | null
  telegram?: string | null
  owner?: string
  poolCreator?: string
  isSeedless?: boolean
}
export type PoolId = Hex
export type PoolList = GetPoolsQuery['pools']
export type PoolListItem = PoolList[0]

type ApiTokenWithNestedPool = ApiToken & { nestedPool?: GqlNestedPool }
export type VotingPool = Pick<
  PoolListItem,
  | 'id'
  | 'address'
  | 'chain'
  | 'type'
  | 'symbol'
  // We need these fields to display boosted underlying tokens in pool token pills (shared by voting, portfolio and standard pool list)
  | 'protocolVersion'
  | 'hasErc4626'
  // We need tags to display erc4626Metadata in PoolListTableDetailsCell
  | 'tags'
  // We need hook to show when the pool has hooks in the voting list
  | 'hook'
> & { poolTokens: ApiTokenWithNestedPool[] }

// PoolCore defines the shared fields between PoolListItem, Pool that are required for pool related shared logic
export type PoolCore = VotingPool | Pool | PoolListItem

export enum BaseVariant {
  v2 = 'v2',
  v3 = 'v3',
}

export type ProtocolVersion = 1 | 2 | 3

// these variants support extra features in project config
export enum PartnerVariant {
  cow = 'cow',
}

export type PoolVariant = BaseVariant | PartnerVariant

export type PoolAction = 'add-liquidity' | 'remove-liquidity' | 'stake' | 'unstake'

export interface FetchPoolProps {
  id: string
  // chain & variant are not used yet, but will be needed in the future.
  chain: GqlChain
  variant?: PoolVariant
}

export interface PoolSearchParams {
  first?: string
  skip?: string
  orderBy?: string
  orderDirection?: string
  poolTypes?: string
  networks?: string
  textSearch?: string
  userAddress?: string
}

export interface PoolsColumnSort {
  id: GqlPoolOrderBy
  desc: boolean
}

export interface PoolsQueryVariables extends GetPoolsQueryVariables {
  first: number
  skip: number
}

export const poolTypeFilters = [
  GqlPoolTypeValues.Weighted,
  GqlPoolTypeValues.Stable,
  GqlPoolTypeValues.Gyro,
  GqlPoolTypeValues.CowAmm,
  GqlPoolTypeValues.Fx,
  GqlPoolTypeValues.QuantAmmWeighted,
  'AUTORANGE', // will be mapped to GqlPoolTypeValues.Reclamm
] as const

export type PoolFilterType = (typeof poolTypeFilters)[number]

/** Pool types accepted by the live Frontier GraphQL schema. */
export const API_GQL_POOL_TYPES = [
  GqlPoolTypeValues.Weighted,
  GqlPoolTypeValues.Stable,
  GqlPoolTypeValues.Eclp,
] as const satisfies readonly GqlPoolType[]

export type ApiGqlPoolType = (typeof API_GQL_POOL_TYPES)[number]

export function isApiGqlPoolType(type: string): type is ApiGqlPoolType {
  return (API_GQL_POOL_TYPES as readonly string[]).includes(type)
}

// We need to map toggalable pool types to their corresponding set of GqlPoolTypes.
// Values not in API_GQL_POOL_TYPES are filtered out before queries hit the API.
export const POOL_TYPE_MAP: { [key in PoolFilterType]: GqlPoolType[] } = {
  [GqlPoolTypeValues.Weighted]: [GqlPoolTypeValues.Weighted],
  [GqlPoolTypeValues.Stable]: [GqlPoolTypeValues.Stable],
  // Frontier renamed Gyro ECLP pools to type ECLP.
  [GqlPoolTypeValues.Gyro]: [GqlPoolTypeValues.Eclp],
  [GqlPoolTypeValues.CowAmm]: [GqlPoolTypeValues.CowAmm],
  [GqlPoolTypeValues.Fx]: [GqlPoolTypeValues.Fx],
  [GqlPoolTypeValues.QuantAmmWeighted]: [GqlPoolTypeValues.QuantAmmWeighted],
  AUTORANGE: [GqlPoolTypeValues.Reclamm],
}

export const poolTagFilters = [
  'INCENTIVIZED',
  'VE8020',
  'POINTS',
  'BOOSTED',
  'RWA',
  'DYNAMIC_ECLP',
] as const
export type PoolTagType = (typeof poolTagFilters)[number]

export const poolHookTagFilters = [
  'HOOKS_STABLESURGE',
  'HOOKS_MEVCAPTURE',
  'HOOKS_EXITFEE',
  'HOOKS_FEETAKING',
] as const
export type PoolHookTagType = (typeof poolHookTagFilters)[number]

export type SortingState = PoolsColumnSort[]

export const orderByHash: { [key: string]: string } = {
  totalLiquidity: 'TVL',
  volume24h: 'Volume (24h)',
  apr: 'APR',
  userbalanceUsd: 'My liquidity',
}

/*
  Core token info required for pool actions
  PoolToken and GqlTokens are super sets of TokenCore
*/
export type TokenCore = {
  address: Address
  name: string
  symbol: string
  decimals: number
  index: number
}

export type PoolToken = ApiToken &
  Pool['poolTokens'][0] & {
    nestedPool?: GqlNestedPool
  }

export enum PoolDisplayType {
  Name = 'name',
  TokenPills = 'token-pills',
}

export type PoolWithWeightSnapshots = Pool & { weightSnapshots?: QuantAmmWeightSnapshot[] }
