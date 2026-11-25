'use client'

import {
  Badge,
  Box,
  Button,
  Card,
  Divider,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Skeleton,
  Text,
  VStack,
} from '@chakra-ui/react'
import { useQuery } from '@apollo/client/react'
import { getChainId, getChainShortName, getGqlChain } from '@repo/lib/config/app.config'
import { SupportedChainId } from '@repo/lib/config/config.types'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { BalBadge } from '@repo/lib/shared/components/badges/BalBadge'
import { NetworkIcon } from '@repo/lib/shared/components/icons/NetworkIcon'
import { useCurrency } from '@repo/lib/shared/hooks/useCurrency'
import { GetPoolsDocument, GetPoolsQuery } from '@repo/lib/shared/services/api/generated/graphql'
import { isSameAddress } from '@repo/lib/shared/utils/addresses'
import { fNum } from '@repo/lib/shared/utils/numbers'
import { uniq } from 'lodash'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatUnits } from 'viem'
import { BPT_DECIMALS } from '../pool.constants'
import { BaseVariant } from '../pool.types'
import { chainToSlugMap, getTotalAprLabel } from '../pool.utils'
import { emptyAddress } from '../../web3/contracts/wagmi-helpers'
import { useUserAccount } from '../../web3/UserAccountProvider'
import { PoolMigration } from './getPoolMigrations'
import { usePoolMigrations } from './PoolMigrationsProvider'
import { MigratableBalV3Position } from './useBalV3MigratablePositions'

export const BAL_V3_MIGRATION_PROMPT_DISMISS_PREFIX = 'frontier.dismissedBalV3MigrationPrompt.'
export const BAL_V3_MIGRATION_PROMPT_SESSION_PREFIX = 'frontier.sessionBalV3MigrationPrompt.'
export const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000

export type MigrationTargetPool = GetPoolsQuery['pools'][number]

export function getBalV3PromptDismissKey(userAddress: string): string {
  return `${BAL_V3_MIGRATION_PROMPT_DISMISS_PREFIX}${userAddress.toLowerCase()}`
}

function getBalV3PromptSessionKey(userAddress: string): string {
  return `${BAL_V3_MIGRATION_PROMPT_SESSION_PREFIX}${userAddress.toLowerCase()}`
}

export function getBalV3SourcePoolUrl(migration: PoolMigration): string {
  const gqlChain = getGqlChain(migration.old.chainId as SupportedChainId)
  const chainSlug = chainToSlugMap[gqlChain] ?? 'ethereum'
  return `https://balancer.fi/pools/${chainSlug}/${BaseVariant.v3}/${migration.old.id}`
}

export function getBalV3TargetPoolPath(migration: PoolMigration): string {
  const gqlChain = getGqlChain(migration.new.chainId as SupportedChainId)
  const chainSlug = chainToSlugMap[gqlChain] ?? 'ethereum'
  return `/pools/${chainSlug}/${BaseVariant.v3}/${migration.new.id}`
}

export function getBalV3MigratePoolPath(migration: PoolMigration): string {
  return `${getBalV3TargetPoolPath(migration)}/migrate-pool?from=${migration.old.id}`
}

export function getPrimaryBalV3MigrationPath(positions: MigratableBalV3Position[]): string {
  if (positions.length === 1 && positions[0]) {
    return getBalV3MigratePoolPath(positions[0].migration)
  }

  return '/migrate'
}

export function getMigrationTargetPoolKey(chainId: number, poolId: string): string {
  return `${chainId}:${poolId.toLowerCase()}`
}

export function getMigrationDisplayMeta(
  migration: PoolMigration,
  targetPoolsByKey: Map<string, MigrationTargetPool>
) {
  const oldGqlChain = getGqlChain(migration.old.chainId as SupportedChainId)
  const chainName = getChainShortName(migration.old.chainId as SupportedChainId)

  const targetPool = targetPoolsByKey.get(
    getMigrationTargetPoolKey(migration.new.chainId, migration.new.id)
  )

  const targetApr = targetPool ? getTotalAprLabel(targetPool.dynamicData.aprItems, true) : undefined

  return {
    oldGqlChain,
    chainName,
    targetPool,
    targetApr,
    sourcePoolHref: getBalV3SourcePoolUrl(migration),
    targetPoolHref: getBalV3TargetPoolPath(migration),
    migrateHref: getBalV3MigratePoolPath(migration),
  }
}

export function formatBptAmount(amount: bigint): string {
  return fNum('token', formatUnits(amount, BPT_DECIMALS))
}

export function useTargetMigrationPools(migrations: PoolMigration[]) {
  const targetIds = useMemo(
    () => uniq(migrations.map(migration => migration.new.id.toLowerCase())),
    [migrations]
  )

  const chainIn = useMemo(
    () => uniq(migrations.map(migration => getGqlChain(migration.new.chainId as SupportedChainId))),
    [migrations]
  )

  const { data, loading } = useQuery(GetPoolsDocument, {
    variables: {
      first: Math.max(targetIds.length, 1),
      where: {
        idIn: targetIds,
        chainIn,
      },
    },
    skip: targetIds.length === 0 || chainIn.length === 0,
  })

  const targetPoolsByKey = useMemo(() => {
    const map = new Map<string, MigrationTargetPool>()

    for (const pool of data?.pools ?? []) {
      const chainId = getChainId(pool.chain)
      map.set(getMigrationTargetPoolKey(chainId, pool.id), pool)
    }

    return map
  }, [data?.pools])

  return {
    targetPoolsByKey,
    isLoadingTargetPools: loading,
  }
}

function isPromptDismissedForWallet(userAddress: string, now = Date.now()): boolean {
  if (typeof window === 'undefined') return false

  try {
    const raw = window.localStorage.getItem(getBalV3PromptDismissKey(userAddress))
    if (!raw) return false

    const expiresAt = Number(raw)
    return Number.isFinite(expiresAt) && expiresAt > now
  } catch {
    return false
  }
}

function dismissPromptForSevenDays(userAddress: string, now = Date.now()): void {
  if (typeof window === 'undefined') return

  try {
    const expiresAt = now + SEVEN_DAYS_IN_MS
    window.localStorage.setItem(getBalV3PromptDismissKey(userAddress), String(expiresAt))
  } catch {
    // Ignore storage errors (e.g. quota exceeded or private mode)
  }
}

function hasPromptedInSession(userAddress: string): boolean {
  if (typeof window === 'undefined') return false

  try {
    return window.sessionStorage.getItem(getBalV3PromptSessionKey(userAddress)) === 'true'
  } catch {
    return false
  }
}

function markPromptedInSession(userAddress: string): void {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.setItem(getBalV3PromptSessionKey(userAddress), 'true')
  } catch {
    // Ignore storage errors
  }
}

export function BalV3MigrationPromptModal() {
  const router = useRouter()
  const { isConnected, userAddress } = useUserAccount()
  const { migratablePositions, hasMigratablePositions } = usePoolMigrations()
  const { toCurrency } = useCurrency()
  const [isOpen, setIsOpen] = useState(false)
  const promptedInMountRef = useRef<Set<string>>(new Set())

  const migrationsForPositions = useMemo(
    () => migratablePositions.map(position => position.migration),
    [migratablePositions]
  )

  const { targetPoolsByKey, isLoadingTargetPools } = useTargetMigrationPools(migrationsForPositions)

  useEffect(() => {
    if (
      !isConnected ||
      !userAddress ||
      isSameAddress(userAddress, emptyAddress) ||
      !hasMigratablePositions
    ) {
      setIsOpen(false)
      return
    }

    const normalizedAddress = userAddress.toLowerCase()

    if (
      promptedInMountRef.current.has(normalizedAddress) ||
      hasPromptedInSession(normalizedAddress) ||
      isPromptDismissedForWallet(normalizedAddress)
    ) {
      return
    }

    promptedInMountRef.current.add(normalizedAddress)
    markPromptedInSession(normalizedAddress)
    setIsOpen(true)
  }, [hasMigratablePositions, isConnected, userAddress])

  const handleClose = () => {
    setIsOpen(false)
  }

  const handleRemindMeLater = () => {
    if (userAddress && !isSameAddress(userAddress, emptyAddress)) {
      dismissPromptForSevenDays(userAddress)
    }

    setIsOpen(false)
  }

  const handleNavigate = (href: string) => {
    setIsOpen(false)
    router.push(href)
  }

  const hasMultiplePositions = migratablePositions.length > 1
  const singlePosition = migratablePositions.length === 1 ? migratablePositions[0] : undefined

  return (
    <Modal isCentered isOpen={isOpen} onClose={handleClose} preserveScrollBarGap size="xl">
      <ModalOverlay />
      <ModalContent maxW="600px">
        <ModalHeader>{`Migrate Balancer V3 positions to ${PROJECT_CONFIG.projectName}`}</ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <VStack align="start" spacing="md" w="full">
            <Text color="font.secondary" fontSize="sm">
              {`We detected Balancer V3 liquidity in your wallet. Migrate your position to ${PROJECT_CONFIG.projectName} in one guided flow.`}
            </Text>

            <VStack maxH="360px" overflowY="auto" spacing="sm" w="full">
              {migratablePositions.map(position => {
                const { migration, walletBptBalance, stakedBptBalance, estimatedUsdValue } =
                  position

                const { oldGqlChain, chainName, targetApr, migrateHref } = getMigrationDisplayMeta(
                  migration,
                  targetPoolsByKey
                )

                return (
                  <Card
                    key={`${migration.old.chainId}:${migration.old.id}`}
                    variant="modalSubSection"
                  >
                    <VStack align="start" spacing="sm" w="full">
                      <HStack justify="space-between" w="full" wrap="wrap">
                        <VStack align="start" spacing="0">
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
                          <Text fontSize="md" fontWeight="bold" mt="1">
                            {migration.old.symbol}
                          </Text>
                          {migration.old.name !== migration.old.symbol && (
                            <Text color="font.secondary" fontSize="xs">
                              {migration.old.name}
                            </Text>
                          )}
                        </VStack>

                        {hasMultiplePositions && (
                          <Button
                            onClick={() => handleNavigate(migrateHref)}
                            size="sm"
                            variant="primary"
                          >
                            Migrate
                          </Button>
                        )}
                      </HStack>

                      <Divider />

                      <SimpleGrid columns={{ base: 2, sm: 4 }} spacing="sm" w="full">
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
                            {`${PROJECT_CONFIG.projectName} APR`}
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
          </VStack>
        </ModalBody>

        <ModalFooter pb="lg" pt="md">
          <HStack justify="space-between" spacing="sm" w="full" wrap="wrap">
            <Button onClick={handleRemindMeLater} variant="tertiary">
              Remind me later
            </Button>

            <HStack spacing="sm">
              <Button
                onClick={() => handleNavigate('/migrate')}
                variant={hasMultiplePositions ? 'primary' : 'tertiary'}
              >
                View all
              </Button>

              {singlePosition && (
                <Button
                  onClick={() => handleNavigate(getBalV3MigratePoolPath(singlePosition.migration))}
                  variant="primary"
                >
                  Migrate
                </Button>
              )}
            </HStack>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
