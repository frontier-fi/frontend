import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { isAfter, isBefore } from 'date-fns'
import { Address } from 'viem'
import { now } from '@repo/lib/shared/utils/time'

export type LbpPrice = {
  timestamp: Date
  projectTokenPrice: number
}

export type LbpSnapshot = {
  timestamp: Date
  projectTokenPrice: number
  reserveTokenPrice: number
  cumulativeVolume: number
  cumulativeFees: number
  tvl: number
  projectTokenBalance: number
  reserveTokenBalance: number
}

export type HourlyDataPoint = {
  timestamp: number
  tvl: number
  fees: number
  volume: number
}

/** LBP price charts are not on the Frontier API. Callers get empty series. */
export function usePriceInfo(_chain: GqlChain, _poolId: Address, _isFixedLbp = false) {
  return {
    isLoading: false,
    snapshots: [] as LbpSnapshot[],
    hourlyData: [] as HourlyDataPoint[],
  }
}

export function getCurrentPrice(snapshots: LbpSnapshot[]) {
  return getCurrentSnapshotValue(snapshots, snapshot => snapshot.projectTokenPrice)
}

export function getCurrentReserveTokenBalance(snapshots: LbpSnapshot[]) {
  return getCurrentSnapshotValue(snapshots, snapshot => snapshot.reserveTokenBalance)
}

function getCurrentSnapshotValue(
  snapshots: LbpSnapshot[],
  selector: (snapshot: LbpSnapshot) => number
) {
  if (snapshots.length === 0) return 0

  const currentTime = now()
  const firstSnapshot = snapshots[0]!
  const lastSnapshot = snapshots[snapshots.length - 1]!

  if (isBefore(currentTime, firstSnapshot.timestamp)) return selector(firstSnapshot)

  if (isAfter(currentTime, lastSnapshot.timestamp)) {
    return selector(lastSnapshot)
  }

  // Find the last snapshot before or at current time
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const snapshot = snapshots[i]

    if (snapshot && !isAfter(snapshot.timestamp, currentTime)) {
      return selector(snapshot)
    }
  }

  return selector(firstSnapshot)
}

export function min(prices: LbpPrice[]) {
  return Math.min(...prices.map(point => point.projectTokenPrice))
}

export function max(prices: LbpPrice[]) {
  return Math.max(...prices.map(point => point.projectTokenPrice))
}
