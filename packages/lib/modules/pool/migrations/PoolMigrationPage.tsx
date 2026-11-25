'use client'

import { Button, Card, Heading, HStack, VStack } from '@chakra-ui/react'
import { getChainId } from '@repo/lib/config/app.config'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { BalAlert } from '@repo/lib/shared/components/alerts/BalAlert'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'
import { AddLiquidityLayout } from '@repo/lib/shared/layouts/AddLiquidityLayout'
import { isSameAddress } from '@repo/lib/shared/utils/addresses'
import NextLink from 'next/link'
import { useMemo } from 'react'
import { PoolActionsLayout } from '../actions/PoolActionsLayout'
import { usePool } from '../PoolProvider'
import { BaseVariant } from '../pool.types'
import { ChainSlug, getChainSlug, getPoolPath } from '../pool.utils'
import { PoolMigration } from './getPoolMigrations'
import { MigrateLiquidityProvider } from './MigrateLiquidityProvider'
import { PoolMigrationModal } from './PoolMigrationModal'
import { usePoolMigrations } from './PoolMigrationsProvider'

export interface PoolPathProps {
  id: string
  chain: ChainSlug
  variant: BaseVariant
}

export interface PoolMigrationPageProps extends PoolPathProps {
  fromPoolId?: string
}

export function resolveTargetMigration(
  migrationsForTarget: PoolMigration[],
  fromPoolId?: string
): PoolMigration | undefined {
  if (migrationsForTarget.length === 0) return undefined

  if (fromPoolId) {
    return migrationsForTarget.find(migration => isSameAddress(migration.old.id, fromPoolId))
  }

  return migrationsForTarget[0]
}

export function PoolMigrationPage({ id, chain, variant, fromPoolId }: PoolMigrationPageProps) {
  const { pool } = usePool()
  const gqlChain = getChainSlug(chain)
  const chainId = getChainId(gqlChain)
  const { getMigrationsForTarget } = usePoolMigrations()

  const migration = useMemo(() => {
    if (variant !== BaseVariant.v3 || pool.protocolVersion !== 3) return undefined
    const targetMigrations = getMigrationsForTarget(chainId, id)
    return resolveTargetMigration(targetMigrations, fromPoolId)
  }, [variant, pool.protocolVersion, getMigrationsForTarget, chainId, id, fromPoolId])

  if (!migration) {
    return (
      <DefaultPageContainer>
        <Card maxW="lg" mx="auto" p="lg" variant="level2">
          <VStack align="start" spacing="md" w="full">
            <Heading as="h1" size="h4">
              Migration route not found
            </Heading>
            <BalAlert
              content={`No Balancer V3 migration route matches this ${PROJECT_CONFIG.projectName} pool${
                fromPoolId ? ` for source pool ${fromPoolId}` : ''
              }.`}
              status="warning"
            />
            <HStack spacing="sm">
              <Button as={NextLink} href="/migrate" variant="primary">
                View migrations
              </Button>
              <Button as={NextLink} href={getPoolPath(pool)} variant="tertiary">
                Back to pool
              </Button>
            </HStack>
          </VStack>
        </Card>
      </DefaultPageContainer>
    )
  }

  return (
    <AddLiquidityLayout>
      <PoolActionsLayout closeButton={false}>
        <MigrateLiquidityProvider migration={migration}>
          <PoolMigrationModal />
        </MigrateLiquidityProvider>
      </PoolActionsLayout>
    </AddLiquidityLayout>
  )
}
