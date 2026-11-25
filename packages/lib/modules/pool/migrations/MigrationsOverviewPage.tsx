'use client'

import {
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Heading,
  HStack,
  Link,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from '@chakra-ui/react'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { BalBadge } from '@repo/lib/shared/components/badges/BalBadge'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'
import { NetworkIcon } from '@repo/lib/shared/components/icons/NetworkIcon'
import { useCurrency } from '@repo/lib/shared/hooks/useCurrency'
import { abbreviateAddress, isSameAddress } from '@repo/lib/shared/utils/addresses'
import NextLink from 'next/link'
import { ConnectWallet } from '../../web3/ConnectWallet'
import { useUserAccount } from '../../web3/UserAccountProvider'
import {
  formatBptAmount,
  getMigrationDisplayMeta,
  useTargetMigrationPools,
} from './BalV3MigrationPromptModal'
import { usePoolMigrations } from './PoolMigrationsProvider'

export function MigrationsOverviewPage() {
  const { isConnected } = useUserAccount()

  const { poolMigrations, migratablePositions, hasMigratablePositions, isLoading, refetch } =
    usePoolMigrations()

  const { toCurrency } = useCurrency()
  const { targetPoolsByKey, isLoadingTargetPools } = useTargetMigrationPools(poolMigrations)

  return (
    <DefaultPageContainer minH="100vh">
      <VStack align="start" spacing="xl" w="full">
        <VStack align="start" spacing="xs" w="full">
          <Heading as="h1" size="h2" variant="special">
            {`Migrate to ${PROJECT_CONFIG.projectName}`}
          </Heading>
          <Text color="font.secondary">
            {`Scan your connected wallet and Balancer V3 gauges to migrate liquidity directly into ${PROJECT_CONFIG.projectName} V3 pools.`}
          </Text>
        </VStack>

        <VStack align="start" spacing="md" w="full">
          <Heading as="h2" size="h4">
            Your Balancer V3 positions
          </Heading>

          {!isConnected && (
            <Card variant="level2">
              <VStack align="start" spacing="md" w="full">
                <Heading as="h3" size="h5">
                  Connect your wallet
                </Heading>
                <Text color="font.secondary">
                  {`Connect a wallet to check Mainnet, Base, and Monad for Balancer V3 wallet and gauge-staked positions eligible to migrate to ${PROJECT_CONFIG.projectName}.`}
                </Text>
                <Box>
                  <ConnectWallet />
                </Box>
              </VStack>
            </Card>
          )}

          {isConnected && isLoading && (
            <Stack spacing="md" w="full">
              <Skeleton height="120px" rounded="lg" w="full" />
              <Skeleton height="120px" rounded="lg" w="full" />
            </Stack>
          )}

          {isConnected && !isLoading && !hasMigratablePositions && (
            <Card variant="level2">
              <VStack align="start" spacing="md" w="full">
                <Heading as="h3" size="h5">
                  No migratable Balancer V3 positions found
                </Heading>
                <Text color="font.secondary">
                  {`We found no active Balancer V3 wallet or gauge-staked balances matching supported ${PROJECT_CONFIG.projectName} migration routes.`}
                </Text>
                <HStack spacing="sm" wrap="wrap">
                  <Button as={NextLink} href="/pools" variant="primary">
                    {`Explore ${PROJECT_CONFIG.projectName} pools`}
                  </Button>
                  <Button onClick={() => void refetch()} variant="tertiary">
                    Refresh
                  </Button>
                </HStack>
              </VStack>
            </Card>
          )}

          {isConnected && !isLoading && hasMigratablePositions && (
            <VStack spacing="md" w="full">
              {migratablePositions.map(position => {
                const {
                  migration,
                  walletBptBalance,
                  stakedBptBalance,
                  totalBptBalance,
                  estimatedUsdValue,
                } = position

                const {
                  oldGqlChain,
                  chainName,
                  targetPool,
                  targetApr,
                  targetPoolHref,
                  migrateHref,
                } = getMigrationDisplayMeta(migration, targetPoolsByKey)

                return (
                  <Card key={`${migration.old.chainId}:${migration.old.id}`} variant="level2">
                    <VStack align="start" spacing="md" w="full">
                      <HStack justify="space-between" w="full" wrap="wrap">
                        <VStack align="start" spacing="xs">
                          <HStack spacing="xs" wrap="wrap">
                            <BalBadge textTransform="none">
                              <HStack spacing="1.5">
                                <NetworkIcon chain={oldGqlChain} size={4} />
                                <Text fontSize="xs" fontWeight="semibold">
                                  {chainName}
                                </Text>
                              </HStack>
                            </BalBadge>
                            {migration.old.isPaused && (
                              <Badge colorScheme="orange" fontSize="xs" rounded="full">
                                Recovery exit
                              </Badge>
                            )}
                          </HStack>

                          <HStack spacing="xs" wrap="wrap">
                            <Text fontSize="lg" fontWeight="bold">
                              {migration.old.symbol}
                            </Text>
                            <Text color="font.secondary" fontSize="sm">
                              →
                            </Text>
                            <Link
                              as={NextLink}
                              fontSize="md"
                              fontWeight="semibold"
                              href={targetPoolHref}
                              textDecoration="underline"
                            >
                              {targetPool?.symbol ||
                                migration.new.symbol ||
                                targetPool?.name ||
                                migration.new.name ||
                                abbreviateAddress(migration.new.id)}
                            </Link>
                          </HStack>

                          {migration.old.name !== migration.old.symbol && (
                            <Text color="font.secondary" fontSize="xs">
                              {migration.old.name}
                            </Text>
                          )}
                        </VStack>

                        <HStack spacing="sm">
                          <Button as={NextLink} href={targetPoolHref} size="sm" variant="tertiary">
                            View target pool
                          </Button>
                          <Button as={NextLink} href={migrateHref} size="sm" variant="primary">
                            Migrate
                          </Button>
                        </HStack>
                      </HStack>

                      <Divider />

                      <SimpleGrid columns={{ base: 2, md: 5 }} spacing="md" w="full">
                        <Box>
                          <Text color="font.secondary" fontSize="xs">
                            Wallet BPT
                          </Text>
                          <Text fontSize="sm" fontWeight="semibold">
                            {formatBptAmount(walletBptBalance)}
                          </Text>
                        </Box>
                        <Box>
                          <Text color="font.secondary" fontSize="xs">
                            Staked BPT
                          </Text>
                          <Text fontSize="sm" fontWeight="semibold">
                            {formatBptAmount(stakedBptBalance)}
                          </Text>
                        </Box>
                        <Box>
                          <Text color="font.secondary" fontSize="xs">
                            Total BPT
                          </Text>
                          <Text fontSize="sm" fontWeight="semibold">
                            {formatBptAmount(totalBptBalance)}
                          </Text>
                        </Box>
                        <Box>
                          <Text color="font.secondary" fontSize="xs">
                            Est. Value
                          </Text>
                          <Text fontSize="sm" fontWeight="semibold">
                            {estimatedUsdValue > 0
                              ? toCurrency(estimatedUsdValue, { abbreviated: false })
                              : '—'}
                          </Text>
                        </Box>
                        <Box>
                          <Text color="font.secondary" fontSize="xs">
                            {`Target ${PROJECT_CONFIG.projectName} APR`}
                          </Text>
                          {isLoadingTargetPools ? (
                            <Skeleton height="18px" mt="1" width="56px" />
                          ) : (
                            <Text fontSize="sm" fontWeight="semibold">
                              {targetApr ?? '—'}
                            </Text>
                          )}
                        </Box>
                      </SimpleGrid>
                    </VStack>
                  </Card>
                )
              })}
            </VStack>
          )}
        </VStack>

        <VStack align="start" spacing="md" w="full">
          <HStack spacing="sm">
            <Heading as="h2" size="h4">
              All supported Balancer V3 pools
            </Heading>
            <BalBadge>
              <Text fontSize="xs" fontWeight="semibold">
                {poolMigrations.length}
              </Text>
            </BalBadge>
          </HStack>

          <Card variant="level2" w="full">
            {poolMigrations.length === 0 ? (
              <Text color="font.secondary">
                No Balancer V3 migration routes are currently configured.
              </Text>
            ) : (
              <Box overflowX="auto" w="full">
                <Table size="sm" variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Network</Th>
                      <Th>Source Balancer V3 pool</Th>
                      <Th>{`Target ${PROJECT_CONFIG.projectName} pool`}</Th>
                      <Th isNumeric>Target APR</Th>
                      <Th isNumeric>Action</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {poolMigrations.map(migration => {
                      const {
                        oldGqlChain,
                        chainName,
                        targetPool,
                        targetApr,
                        sourcePoolHref,
                        targetPoolHref,
                        migrateHref,
                      } = getMigrationDisplayMeta(migration, targetPoolsByKey)

                      const hasPosition =
                        isConnected &&
                        migratablePositions.some(
                          position =>
                            position.migration.old.chainId === migration.old.chainId &&
                            isSameAddress(position.migration.old.id, migration.old.id)
                        )

                      return (
                        <Tr key={`${migration.old.chainId}:${migration.old.id}`}>
                          <Td>
                            <HStack spacing="xs">
                              <NetworkIcon chain={oldGqlChain} size={5} />
                              <Text fontSize="sm">{chainName}</Text>
                            </HStack>
                          </Td>

                          <Td>
                            <VStack align="start" spacing="0">
                              <HStack spacing="xs">
                                <Link
                                  fontSize="sm"
                                  fontWeight="semibold"
                                  href={sourcePoolHref}
                                  isExternal
                                  textDecoration="underline"
                                >
                                  {migration.old.symbol}
                                </Link>
                                {migration.old.isPaused && (
                                  <Badge colorScheme="orange" fontSize="2xs" rounded="full">
                                    Recovery
                                  </Badge>
                                )}
                              </HStack>
                              <Text color="font.secondary" fontSize="xs">
                                {migration.old.name}
                              </Text>
                            </VStack>
                          </Td>

                          <Td>
                            <VStack align="start" spacing="0">
                              <Link
                                as={NextLink}
                                fontSize="sm"
                                fontWeight="semibold"
                                href={targetPoolHref}
                                textDecoration="underline"
                              >
                                {targetPool?.symbol ||
                                  migration.new.symbol ||
                                  abbreviateAddress(migration.new.id)}
                              </Link>
                              {isLoadingTargetPools && !targetPool && !migration.new.name ? (
                                <Skeleton height="14px" mt="1" width="120px" />
                              ) : (
                                <Text color="font.secondary" fontSize="xs">
                                  {targetPool?.name ||
                                    migration.new.name ||
                                    abbreviateAddress(migration.new.id)}
                                </Text>
                              )}
                            </VStack>
                          </Td>

                          <Td isNumeric>
                            {isLoadingTargetPools ? (
                              <Skeleton height="16px" ml="auto" width="48px" />
                            ) : (
                              <Text fontSize="sm" fontWeight="medium">
                                {targetApr ?? '—'}
                              </Text>
                            )}
                          </Td>

                          <Td isNumeric>
                            <Button
                              as={NextLink}
                              href={hasPosition ? migrateHref : targetPoolHref}
                              size="xs"
                              variant={hasPosition ? 'primary' : 'tertiary'}
                            >
                              {hasPosition ? 'Migrate' : 'View pool'}
                            </Button>
                          </Td>
                        </Tr>
                      )
                    })}
                  </Tbody>
                </Table>
              </Box>
            )}
          </Card>
        </VStack>
      </VStack>
    </DefaultPageContainer>
  )
}
