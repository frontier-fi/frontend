import { getChainId, getNetworkConfig } from '@repo/lib/config/app.config'
import type { GqlPoolTokenDetail } from '@repo/lib/shared/services/api/graphql-derived-types'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { useMemo, useState, useCallback } from 'react'
import { Pool } from '../pool.types'
import {
  hasRateProvider,
  hasReviewedHook,
  hasReviewedRateProvider,
  isV2Pool,
} from '../pool.helpers'
import { VulnerabilityDataMap } from './pool-issues/PoolIssue.labels'
import { PoolIssue } from './pool-issues/PoolIssue.type'
import { BalAlertProps } from '@repo/lib/shared/components/alerts/BalAlert'
import { useHook } from '../../hooks/useHook'
import { usePoolMetadata } from '../metadata/usePoolMetadata'
import { Address } from 'viem'
import { usePoolTokenPriceWarnings } from '../usePoolTokenPriceWarnings'
import { recoveryModeAlert } from '../actions/recovery-mode/RecoveryModeAlert'

export type PoolAlert = {
  identifier: string
} & BalAlertProps

export function usePoolAlerts(pool: Pool) {
  const { hooks } = useHook(pool)
  const poolMetadata = usePoolMetadata(pool)
  const { isAnyTokenWithoutPrice, poolWarning } = usePoolTokenPriceWarnings(pool)

  const getNetworkPoolAlerts = (pool: Pool): PoolAlert[] => {
    const networkPoolsIssues = getNetworkConfig(pool.chain).pools?.issues

    if (!networkPoolsIssues) return []

    const poolIssues: string[] = []

    Object.keys(networkPoolsIssues).forEach(issue => {
      const poolIds = networkPoolsIssues[issue as PoolIssue]

      if (!poolIds) return
      if (!poolIds.includes(pool.id)) return

      poolIssues.push(issue)
    })

    return poolIssues.map(issue => {
      const vulnerabilityData = VulnerabilityDataMap[issue as PoolIssue]

      return {
        identifier: issue,
        content: vulnerabilityData.jsxTitle,
        learnMoreLink: vulnerabilityData.learnMoreLink,
        status: 'error',
        isSoftWarning: false,
      }
    })
  }

  const getTokenPoolAlerts = (pool: Pool): PoolAlert[] => {
    // Disable alerts for Sepolia pools
    if (pool.chain === GqlChainValues.Sepolia) return []

    const poolTokens = pool.poolTokens as GqlPoolTokenDetail[]
    const hook = pool.hook

    const alerts: PoolAlert[] = []

    if (isAnyTokenWithoutPrice) {
      alerts.push({
        identifier: 'tokensWithoutPrice',
        content: poolWarning,
        status: 'warning',
        isSoftWarning: false,
      })
    }

    poolTokens?.forEach(token => {
      const priceRateProviderData = token.priceRateProviderData

      if (isV2Pool(pool) && !token.isAllowed) {
        alerts.push({
          identifier: `TokenNotAllowed-${token.symbol}`,
          content: `The token ${token.symbol} is currently not supported.`,
          status: 'error',
          isSoftWarning: false,
        })
      }

      if (!hasRateProvider(token)) {
        return
      }

      if (!hasReviewedRateProvider(token)) {
        alerts.push({
          identifier: `RateProviderNotReviewed-${token.symbol}`,
          content: `The rate provider for ${token.symbol} has not been reviewed. For your safety, you can’t interact with this pool on this UI.`,
          status: 'error',
          isSoftWarning: true,
        })
      }

      if (priceRateProviderData && priceRateProviderData?.summary !== 'safe') {
        alerts.push({
          identifier: `UnsafeRateProvider-${token.symbol}`,
          content: `The rate provider for ${token.symbol} has been reviewed as 'unsafe'. For your safety, you can't interact with this pool on this UI.`,
          status: 'error',
          isSoftWarning: true,
        })
      }
    })

    if (hook) {
      const hookName = hooks.find(
        hook =>
          pool.hook &&
          hook?.addresses[getChainId(pool.chain)]?.includes(pool.hook.address as Address)
      )?.name

      if ('reviewData' in hook && !hasReviewedHook(hook)) {
        alerts.push({
          identifier: `PoolHookNotReviewed`,
          content: `This pool contains a hook called ${hookName} which has not been reviewed. For your safety, you can’t interact with this pool on this UI.`,
          status: 'error',
          isSoftWarning: true,
        })
      }

      const hookReviewData =
        'reviewData' in hook
          ? (hook as { reviewData?: { summary?: string; warnings?: string[] } }).reviewData
          : undefined

      if (hookReviewData?.summary === 'unsafe') {
        alerts.push({
          identifier: `PoolHookReviewedUnsafe`,
          content: `This pool contains a hook called ${hookName} which has been reviewed as 'unsafe'. For your safety, you can’t interact with this pool on this UI.`,
          status: 'error',
          isSoftWarning: true,
        })
      }

      if (hookReviewData?.summary === 'safe' && (hookReviewData.warnings?.length ?? 0) > 0) {
        alerts.push({
          identifier: `PoolHookReviewedSafeWithWarnings`,
          content: `This pool contains a a hook called ${hookName} which has been reviewed as ‘safe’ but with warnings. Please review it in the Pool contracts section.`,
          status: 'error',
          isSoftWarning: true,
        })
      }
    }

    // check alerts for nested pools & tokens
    poolTokens?.forEach(token => {
      if (token.hasNestedPool && token.nestedPool) {
        const nestedPool = token.nestedPool

        if (!nestedPool.hook) {
          return
        }

        if (nestedPool.hook) {
          const hookName = hooks.find(
            hook =>
              nestedPool.hook &&
              hook?.addresses[getChainId(pool.chain)]?.includes(nestedPool.hook.address as Address)
          )?.name

          if ('reviewData' in nestedPool.hook && !hasReviewedHook(nestedPool.hook)) {
            alerts.push({
              identifier: `NestedPoolHookNotReviewed`,
              content: `This pool contains a nested pool with a hook called ${hookName} which has not been reviewed. For your safety, you can’t interact with this pool on this UI.`,
              status: 'error',
              isSoftWarning: true,
            })
          }

          const nestedHookReviewData =
            'reviewData' in nestedPool.hook
              ? (
                  nestedPool.hook as {
                    reviewData?: { summary?: string; warnings?: string[] }
                  }
                ).reviewData
              : undefined

          if (nestedHookReviewData?.summary === 'unsafe') {
            alerts.push({
              identifier: `NestedPoolHookReviewedUnsafe`,
              content: `This pool contains a nested pool with a hook called ${hookName} which has been reviewed as 'unsafe'. For your safety, you can’t interact with this pool on this UI.`,
              status: 'error',
              isSoftWarning: true,
            })
          }

          if (
            nestedHookReviewData?.summary === 'safe' &&
            (nestedHookReviewData.warnings?.length ?? 0) > 0
          ) {
            alerts.push({
              identifier: `NestedPoolHookReviewedSafeWithWarnings`,
              content: `This pool contains a a hook called ${hookName} which has been reviewed as ‘safe’ but with warnings. Please review it in the Pool contracts section.`,
              status: 'error',
              isSoftWarning: true,
            })
          }
        }

        nestedPool.tokens.forEach((nestedToken: any) => {
          if (!hasRateProvider(nestedToken)) {
            return
          }

          if (!hasReviewedRateProvider(nestedToken)) {
            alerts.push({
              identifier: `NestedRateProviderNotReviewed-${nestedToken.symbol}`,
              content: `The rate provider for ${nestedToken.symbol} in a nested pool has not been reviewed. For your safety, you can’t interact with this pool on this UI.`,
              status: 'error',
              isSoftWarning: true,
            })
          }

          if (
            nestedToken.priceRateProviderData &&
            nestedToken.priceRateProviderData?.summary !== 'safe'
          ) {
            alerts.push({
              identifier: `UnsafeNestedRateProvider-${nestedToken.symbol}`,
              content: `The rate provider for ${nestedToken.symbol} in a nested pool has been reviewed as 'unsafe'. For your safety, you can't interact with this pool on this UI.`,
              status: 'error',
              isSoftWarning: true,
            })
          }
        })
      }
    })

    return alerts
  }

  const getUserAlerts = (_pool: Pool): PoolAlert[] => {
    // Frontier has no gauges — migrate-stake alert removed.
    return []
  }

  const getPoolAlerts = (pool: Pool): PoolAlert[] => {
    const alerts: PoolAlert[] = []

    // alert for specific AutoRange pool
    // https://balancer.fi/pools/plasma/v3/0xe14ba497a7c51f34896d327ec075f3f18210a270
    if (pool.id === '0xe14ba497a7c51f34896d327ec075f3f18210a270') {
      alerts.push({
        identifier: 'poolIsAutoRange',
        content:
          'By auto-adjusting their concentrated liquidity range, AutoRange pools can get more swap fees but also increase the risk of impermanent loss.',
        status: 'info',
        isSoftWarning: false,
        learnMoreLink: '/risks#autorange',
      })
    }

    if (pool.dynamicData.isPaused && pool.dynamicData.isInRecoveryMode) {
      alerts.push({
        identifier: 'poolIsPausedAndInRecoveryMode',
        content: 'This pool is paused and in recovery mode',
        status: 'warning',
        isSoftWarning: false,
      })
    } else if (pool.dynamicData.isPaused) {
      alerts.push(recoveryModeAlert(pool))
    } else if (pool.dynamicData.isInRecoveryMode) {
      alerts.push({
        identifier: 'poolIsInRecoveryMode',
        content: 'This pool is in recovery mode',
        status: 'warning',
        isSoftWarning: false,
      })
    }

    if (poolMetadata?.warning) {
      alerts.push({
        identifier: 'poolWarning',
        content: poolMetadata.warning.text,
        status: poolMetadata.warning.type,
        isSoftWarning: false,
      })
    }

    return alerts
  }

  const allAlerts = useMemo(() => {
    const networkPoolAlerts = getNetworkPoolAlerts(pool)
    const tokenPoolAlerts = getTokenPoolAlerts(pool)
    const userAlerts = getUserAlerts(pool)
    const poolSpecificAlerts = getPoolAlerts(pool)

    return [...networkPoolAlerts, ...tokenPoolAlerts, ...userAlerts, ...poolSpecificAlerts]
  }, [
    pool,
    hooks,
    poolMetadata,
    isAnyTokenWithoutPrice,
    poolWarning,
    getNetworkPoolAlerts,
    getTokenPoolAlerts,
    getUserAlerts,
    getPoolAlerts,
  ])

  const [dismissedAlertsByPool, setDismissedAlertsByPool] = useState<Record<string, string[]>>({})

  const dismissAlert = useCallback(
    (identifier: string) => {
      setDismissedAlertsByPool(prev => {
        const dismissedForPool = prev[pool.id] ?? []
        if (dismissedForPool.includes(identifier)) return prev

        return {
          ...prev,
          [pool.id]: [...dismissedForPool, identifier],
        }
      })
    },
    [pool.id]
  )

  const poolAlerts = useMemo(() => {
    const dismissed = dismissedAlertsByPool[pool.id] ?? []

    return allAlerts.filter(alert => !dismissed.includes(alert.identifier))
  }, [allAlerts, dismissedAlertsByPool, pool.id])

  return {
    poolAlerts,
    dismissAlert,
  }
}
