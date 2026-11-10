'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { VStack, Stack } from '@chakra-ui/react'
import { PoolComposition } from './PoolComposition'
import { PoolInfoLayout } from './PoolInfo/PoolInfoLayout'
import { usePool } from '../PoolProvider'
import PoolMyLiquidity from './PoolMyLiquidity'
import { PoolStatsLayout } from './PoolStats/PoolStatsLayout'
import { PoolHeader } from './PoolHeader/PoolHeader'
import { PoolAlerts } from '../alerts/PoolAlerts'
import { ClaimProvider } from '../actions/claim/ClaimProvider'
import PoolUserEvents from './PoolUserEvents/PoolUserEvents'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'
import { PoolActivity } from './PoolActivity/PoolActivity'
import { useUserPoolEvents } from '../useUserPoolEvents'
import { hasTotalBalance } from '@repo/lib/modules/pool/user-balance.helpers'
import { RelayerSignatureProvider } from '@repo/lib/modules/relayer/RelayerSignatureProvider'

export function PoolDetail() {
  const { pool } = usePool()
  const router = useRouter()
  const pathname = usePathname()

  const { userPoolEvents, hasPoolEvents } = useUserPoolEvents()

  const userHasLiquidity = hasTotalBalance(pool)

  useEffect(() => {
    // Prefetch pool action pages.
    router.prefetch(`${pathname}/add-liquidity`)
    router.prefetch(`${pathname}/enable-recovery-mode`)

    if (userHasLiquidity) {
      router.prefetch(`${pathname}/remove-liquidity`)
      router.prefetch(`${pathname}/stake`)
      router.prefetch(`${pathname}/unstake`)
    }
  }, [router])

  return (
    <>
      <DefaultPageContainer>
        <RelayerSignatureProvider>
          <ClaimProvider pools={[pool]}>
            <VStack spacing="2xl" w="full">
              <VStack spacing="md" w="full">
                <PoolAlerts />
                <PoolHeader />
                <PoolStatsLayout />
              </VStack>
              {(userHasLiquidity || hasPoolEvents) && (
                <Stack
                  direction={{ base: 'column', xl: 'row' }}
                  justifyContent="stretch"
                  spacing="md"
                  w="full"
                >
                  <PoolMyLiquidity />
                  <PoolUserEvents userPoolEvents={userPoolEvents} />
                </Stack>
              )}
              <PoolActivity />
              <PoolComposition />
              <PoolInfoLayout />
            </VStack>
          </ClaimProvider>
        </RelayerSignatureProvider>
      </DefaultPageContainer>
    </>
  )
}
