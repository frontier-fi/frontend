'use client'

import { HStack, Link, Text, useDisclosure, VStack } from '@chakra-ui/react'
import { getChainId, getChainShortName } from '@repo/lib/config/app.config'
import { SupportedChainId } from '@repo/lib/config/config.types'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { BalAlert } from '@repo/lib/shared/components/alerts/BalAlert'
import { BalAlertButton } from '@repo/lib/shared/components/alerts/BalAlertButton'
import { abbreviateAddress, isSameAddress } from '@repo/lib/shared/utils/addresses'
import { useRouter } from 'next/navigation'
import { useUserAccount } from '../../web3/UserAccountProvider'
import { Pool } from '../pool.types'
import { getPoolPath } from '../pool.utils'
import { hasBalancerStakedBalance, hasTotalBalance } from '../user-balance.helpers'
import { getBalV3MigratePoolPath, getBalV3TargetPoolPath } from './BalV3MigrationPromptModal'
import { PoolMigration } from './getPoolMigrations'
import { usePoolMigrations } from './PoolMigrationsProvider'
import { UnstakeWarningModal } from './UnstakeWarningModal'
import { MigratableBalV3Position } from './useBalV3MigratablePositions'

type Props = {
  pool: Pool
}

export function MigrationAlert({ pool }: Props) {
  const { isConnected } = useUserAccount()
  const { getMigration, migratablePositions } = usePoolMigrations()
  const chainId = getChainId(pool.chain)

  const matchingBalV3Positions = isConnected
    ? migratablePositions.filter(
        position =>
          position.totalBptBalance > 0n &&
          position.migration.new.chainId === chainId &&
          isSameAddress(position.migration.new.id, pool.id)
      )
    : []

  if (matchingBalV3Positions.length > 0) {
    return <TargetPoolMigrationAlerts pool={pool} positions={matchingBalV3Positions} />
  }

  const migration = getMigration(pool.protocolVersion, chainId, pool.id)
  if (!migration) return null

  const userHasBalance = hasTotalBalance(pool)

  if (userHasBalance) {
    return <AlertWithBalance migration={migration} pool={pool} />
  } else {
    return <AlertWithoutBalance migration={migration} />
  }
}

function TargetPoolMigrationAlerts({
  pool,
  positions,
}: {
  pool: Pool
  positions: MigratableBalV3Position[]
}) {
  const router = useRouter()
  const basePoolPath = getPoolPath(pool)

  const alerts = positions.map(position => {
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

function AlertWithBalance({ pool, migration }: Props & { migration: PoolMigration }) {
  const router = useRouter()
  const { isOpen, onOpen, onClose } = useDisclosure()

  const targetPoolPath = getBalV3TargetPoolPath(migration)
  const migratePath = getBalV3MigratePoolPath(migration)
  const hasStakedBalance = hasBalancerStakedBalance(pool)

  const migrate = () => {
    if (hasStakedBalance) {
      onOpen()
    } else {
      router.push(migratePath)
    }
  }

  return (
    <>
      <BalAlert
        content={
          <HStack
            flexWrap={{ base: 'wrap', md: 'nowrap' }}
            gap="md"
            justifyContent="space-between"
            w="full"
          >
            <Text color="black">
              {`Migrate your position from ${pool.name} (on ${getChainShortName(pool.chain)}) to the recommended pool: `}
              <Link href={targetPoolPath} textDecoration="underline">
                {abbreviateAddress(migration.new.id)}
              </Link>
            </Text>
            <BalAlertButton onClick={migrate}>Migrate</BalAlertButton>
          </HStack>
        }
        status="info"
      />
      <UnstakeWarningModal isOpen={isOpen} onClose={onClose} pool={pool} />
    </>
  )
}

function AlertWithoutBalance({ migration }: { migration: PoolMigration }) {
  const targetPoolPath = getBalV3TargetPoolPath(migration)

  return (
    <BalAlert
      content={
        <Text color="black">
          The recommended similar pool for migration is:{' '}
          <Link href={targetPoolPath} textDecoration="underline">
            {migration.new.id}
          </Link>
        </Text>
      }
      status="info"
    />
  )
}
