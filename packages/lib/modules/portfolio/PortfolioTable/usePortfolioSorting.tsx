import type { GqlPoolOrderBy } from '@repo/lib/shared/services/api/generated/graphql'
import { useMemo, useCallback, useReducer, useEffect } from 'react'
import { getTotalApr } from '../../pool/pool.utils'
import { usePortfolioFilters } from './PortfolioFiltersProvider'
import { bn } from '@repo/lib/shared/utils/numbers'

export type PortfolioTableSortingId = 'vebal' | 'liquidity' | 'apr'
export interface PortfolioSortingData {
  id: PortfolioTableSortingId | GqlPoolOrderBy
  desc: boolean
}

export const portfolioOrderByFn: () => {
  title: string
  id: PortfolioTableSortingId
}[] = () => [
  {
    title: 'My liquidity',
    id: 'liquidity',
  },
  {
    title: 'APR',
    id: 'apr',
  },
]

type SortingState = PortfolioSortingData | null

type SortingAction =
  { type: 'SET_SORTING'; payload: PortfolioSortingData } | { type: 'RESET_SORTING' }

function sortingReducer(state: SortingState, action: SortingAction): SortingState {
  switch (action.type) {
    case 'SET_SORTING':
      return action.payload
    case 'RESET_SORTING':
      return null
    default:
      return state
  }
}

export function usePortfolioSorting() {
  const { filteredExpandedPools, selectedNetworks, selectedPoolTypes, selectedStakingTypes } =
    usePortfolioFilters()

  const [manualSortingObj, dispatch] = useReducer(sortingReducer, null)

  // need useMemo here to prevent infinite loop in useEffect below
  const filterStateKey = useMemo(() => {
    return `${selectedNetworks?.length || 0}-${selectedPoolTypes?.length || 0}-${selectedStakingTypes?.length || 0}`
  }, [selectedNetworks, selectedPoolTypes, selectedStakingTypes])

  // Dispatch reset when filter state changes
  useEffect(() => {
    dispatch({ type: 'RESET_SORTING' })
  }, [filterStateKey])

  const currentSortingObj = useMemo(() => {
    if (manualSortingObj) {
      return manualSortingObj
    }

    return { id: 'liquidity' as const, desc: true }
  }, [manualSortingObj])

  const setSorting = useCallback((sorting: PortfolioSortingData) => {
    dispatch({ type: 'SET_SORTING', payload: sorting })
  }, [])

  const sortedPools = useMemo(() => {
    if (!filteredExpandedPools?.length) return []
    const arr = [...filteredExpandedPools]

    return arr.sort((a, b) => {
      if (currentSortingObj.id === 'liquidity') {
        const aTotalBalance = a.poolPositionUsd
        const bTotalBalance = b.poolPositionUsd

        return currentSortingObj.desc
          ? bTotalBalance - aTotalBalance
          : aTotalBalance - bTotalBalance
      }

      if (currentSortingObj.id === 'apr') {
        const [aApr] = getTotalApr(a.dynamicData.aprItems)
        const [bApr] = getTotalApr(b.dynamicData.aprItems)
        return currentSortingObj.desc
          ? bn(bApr).minus(aApr).toNumber()
          : bn(aApr).minus(bApr).toNumber()
      }

      return 0
    })
  }, [filteredExpandedPools, currentSortingObj.id, currentSortingObj.desc])

  return { sortedPools, setSorting, currentSortingObj }
}
