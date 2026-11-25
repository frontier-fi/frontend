'use client'

import { HStack, Text, VStack } from '@chakra-ui/react'
import { getChainId, getChainShortName } from '@repo/lib/config/app.config'
import { SupportedChainId } from '@repo/lib/config/config.types'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { BalAlert } from '@repo/lib/shared/components/alerts/BalAlert'
import { BalAlertButton } from '@repo/lib/shared/components/alerts/BalAlertButton'
import { isSameAddress } from '@repo/lib/shared/utils/addresses'
import { useRouter } from 'next/navigation'
import { useUserAccount } from '../../web3/UserAccountProvider'
import { Pool } from '../pool.types'
import { getPoolPath } from '../pool.utils'
import { usePoolMigrations } from './PoolMigrationsProvider'

type Props = {
  pool: Pool
}

/**
 * Shown on a target pool when the connected wallet holds a Balancer V3 position that migrates to it.
 */
export function MigrationAlert({ pool }: Props) {
  const router = useRouter()
  const { isConnected } = useUserAccount()
  const { migratablePositions } = usePoolMigrations()
  const chainId = getChainId(pool.chain)

  const matchingBalV3Positions = isConnected
    ? migratablePositions.filter(
        position =>
          position.totalBptBalance > 0n &&
          position.migration.new.chainId === chainId &&
          isSameAddress(position.migration.new.id, pool.id)
      )
    : []

  if (matchingBalV3Positions.length === 0) return null

  const basePoolPath = getPoolPath(pool)

  const alerts = matchingBalV3Positions.map(position => {
    const source = position.migration.old
    const chainName = getChainShortName(source.chainId as SupportedChainId)
    const migrateHref = `${basePoolPath}/migrate-pool?from=${source.id}`

    return (
      <BalAlert
        content={
          <HStack
            flexWrap={{ base: 'wrap', md: 'nowrap' }}
            gap="md"
            justifyContent="space-between"
            w="full"
          >
            <Text color="black">
              {`You have liquidity in Balancer V3 ${source.symbol} on ${chainName}. Migrate your position to this ${PROJECT_CONFIG.projectName} pool.`}
            </Text>
            <BalAlertButton onClick={() => router.push(migrateHref)}>Migrate</BalAlertButton>
          </HStack>
        }
        key={`${source.chainId}:${source.id}`}
        status="info"
      />
    )
  })

  if (alerts.length === 1) return alerts[0]

  return (
    <VStack spacing="sm" w="full">
      {alerts}
    </VStack>
  )
}
