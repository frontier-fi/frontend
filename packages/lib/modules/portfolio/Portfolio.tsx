'use client'
import { HStack, Stack, Text, VStack } from '@chakra-ui/react'
import { getChainName } from '@repo/lib/config/app.config'
import { SupportedChainId } from '@repo/lib/config/config.types'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { BalAlert } from '@repo/lib/shared/components/alerts/BalAlert'
import { BalAlertButton } from '@repo/lib/shared/components/alerts/BalAlertButton'
import { useRouter } from 'next/navigation'
import { getPrimaryBalV3MigrationPath } from '../pool/migrations/BalV3MigrationPromptModal'
import { usePoolMigrations } from '../pool/migrations/PoolMigrationsProvider'
import { useUserAccount } from '../web3/UserAccountProvider'
import { PortfolioSummary } from './PortfolioSummary'
import { PortfolioTable } from './PortfolioTable/PortfolioTable'
import { ClaimNetworkPools } from './PortfolioClaim/ClaimNetworkPools/ClaimNetworkPools'
import { TransactionStateProvider } from '../transactions/transaction-steps/TransactionStateProvider'
import { PortfolioFiltersProvider } from './PortfolioTable/PortfolioFiltersProvider'

export default function Portfolio() {
  const router = useRouter()
  const { isConnected } = useUserAccount()
  const { hasMigratablePositions, migratablePositions } = usePoolMigrations()

  const showMigrationBanner =
    isConnected && hasMigratablePositions && migratablePositions.length > 0

  const firstPosition = migratablePositions[0]
  const migrationTargetHref = getPrimaryBalV3MigrationPath(migratablePositions)

  const bannerText =
    migratablePositions.length === 1 && firstPosition
      ? `You have liquidity in Balancer V3 ${firstPosition.migration.old.symbol} on ${getChainName(firstPosition.migration.old.chainId as SupportedChainId)} ready to migrate to ${PROJECT_CONFIG.projectName}.`
      : `You have ${migratablePositions.length} Balancer V3 liquidity positions ready to migrate to ${PROJECT_CONFIG.projectName}.`

  return (
    <Stack gap={20} width="full">
      <VStack spacing="md" width="full">
        {showMigrationBanner && (
          <BalAlert
            content={
              <HStack
                flexWrap={{ base: 'wrap', md: 'nowrap' }}
                gap="md"
                justifyContent="space-between"
                w="full"
              >
                <Text color="black">{bannerText}</Text>
                <BalAlertButton onClick={() => router.push(migrationTargetHref)}>
                  View & Migrate
                </BalAlertButton>
              </HStack>
            }
            status="info"
          />
        )}
        <PortfolioSummary />
      </VStack>
      <TransactionStateProvider>
        <ClaimNetworkPools />
      </TransactionStateProvider>
      <PortfolioFiltersProvider>
        <PortfolioTable />
      </PortfolioFiltersProvider>
    </Stack>
  )
}
