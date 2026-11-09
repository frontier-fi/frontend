'use client'

import {
  Heading,
  Stack,
  Skeleton,
  SimpleGrid,
  Text,
  Card,
  Flex,
  HStack,
  Button,
  useDisclosure,
  Box,
} from '@chakra-ui/react'
import { usePortfolio } from '../../PortfolioProvider'
import { useUserAccount } from '@repo/lib/modules/web3/UserAccountProvider'
import { useMemo, type ReactNode } from 'react'
import FadeInOnView from '@repo/lib/shared/components/containers/FadeInOnView'
import { useHasMerklRewards } from '../../merkl/useHasMerklRewards'
import { MerklAlert } from '../../merkl/MerklAlert'
import { motion } from 'motion/react'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { getChainId } from '@repo/lib/config/app.config'
import { useBreakpoints } from '@repo/lib/shared/hooks/useBreakpoints'
import { NetworkIcon } from '@repo/lib/shared/components/icons/NetworkIcon'
import { WalletIcon } from '@repo/lib/shared/components/icons/WalletIcon'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { BalAlert } from '@repo/lib/shared/components/alerts/BalAlert'
import { sumRecoveredFundsTotal, useRecoveredFunds } from '../recovered-funds/useRecoveredFunds'
import { ClaimRecoveredFundsModal } from '../recovered-funds/ClaimRecoveredFundsModal'
import { BalAlertLink } from '@repo/lib/shared/components/alerts/BalAlertLink'
import { RecoveredFundsLearnMoreModal } from '../recovered-funds/RecoveredFundsLearnMoreModal'
import { GqlChainValues, type AppChain } from '@repo/lib/shared/services/api/graphql-enums'
import { ClaimNetworkBlock } from './ClaimNetworkBlock'

interface NetworkConfig {
  chain: AppChain
  name: string
  displayProps?: Record<string, any>
}

const balancerNetworksConfig: NetworkConfig[] = [
  { chain: GqlChainValues.Mainnet, name: 'Ethereum', displayProps: {} },
  {
    chain: GqlChainValues.Arbitrum,
    name: 'Arbitrum',
    displayProps: { display: { base: 'none', md: 'block' } },
  },
  {
    chain: GqlChainValues.Base,
    name: 'Base',
    displayProps: { display: { base: 'none', md: 'none', lg: 'block' } },
  },
]

const SLOT_COUNT = 3
const GRID_COLUMNS = { base: 1, md: 2, lg: 3 }

/**
 * Gauge claim network UI is disabled on Frontier (no gauges).
 * Keeps Merkl alert + non-gauge recovered funds claim surface.
 */
export function ClaimNetworkPools() {
  const { poolsWithOnchainUserBalances, isLoadingPortfolio } = usePortfolio()

  const { hasRecoveredFunds, claims: recoveredFundsClaims } = useRecoveredFunds()

  const {
    isOpen: isClaimRecoveredFundModalOpen,
    onOpen: openClaimRecoveredFundModal,
    onClose: onClaimRecoveredFundModalClose,
  } = useDisclosure()

  const {
    isOpen: isRecoveredFundsLearnMoreModalOpen,
    onOpen: openRecoveredFundsLearnMoreModal,
    onClose: onRecoveredFundsLearnMoreModalClose,
  } = useDisclosure()

  const { isConnected } = useUserAccount()

  const chainIds = PROJECT_CONFIG.merklRewardsChains.map(chain => getChainId(chain))
  const { hasMerklRewards } = useHasMerklRewards(poolsWithOnchainUserBalances, chainIds)

  const { isDesktop } = useBreakpoints()
  const iconSize = isDesktop ? 12 : 8

  const currentNetworks = balancerNetworksConfig

  const claimableItems = useMemo(() => {
    const items: {
      type: string
      chain: AppChain
      amount: number
      icon?: string
    }[] = []

    if (hasRecoveredFunds) {
      items.push({
        type: 'recovered-funds',
        chain: PROJECT_CONFIG.defaultNetwork,
        amount: sumRecoveredFundsTotal(recoveredFundsClaims),
        icon: '/images/icons/heart.svg',
      })
    }

    return items.sort((a, b) => b.amount - a.amount)
  }, [hasRecoveredFunds, recoveredFundsClaims])

  const hasClaimableContent = claimableItems.length > 0 || hasMerklRewards || hasRecoveredFunds

  // Empty network placeholders (Eth / Arb / Base "Nothing to claim") are intentional
  // on Balancer when gauges exist elsewhere; Frontier has no gauges, so hide the
  // section entirely until there is something concrete to claim.
  if (!isLoadingPortfolio && isConnected && !hasClaimableContent) {
    return null
  }

  return (
    <FadeInOnView>
      <Stack gap={5}>
        <Heading size="h4" variant="special">
          Claimable incentives
        </Heading>
        {hasRecoveredFunds && (
          <AnimatedAlert>
            <BalAlert
              content={
                <Text color="font.dark" fontWeight="medium">
                  Claim your share of recovered funds from the November 2025 security incident
                  affecting some v2 Composable Stable pools.{' '}
                  <BalAlertLink onClick={openRecoveredFundsLearnMoreModal}>Learn more</BalAlertLink>
                </Text>
              }
              status="warning"
            />
          </AnimatedAlert>
        )}
        {isLoadingPortfolio ? (
          <SimpleGrid columns={GRID_COLUMNS} spacing="md">
            {Array.from({ length: SLOT_COUNT }).map((_, index) => (
              <Skeleton height="85px" key={`claim-network-skeleton-${index}`} w="full" />
            ))}
          </SimpleGrid>
        ) : !isConnected ? (
          <ConnectButton.Custom>
            {({ openConnectModal }: { openConnectModal: () => void }) => (
              <SimpleGrid columns={GRID_COLUMNS} spacing="md">
                {currentNetworks.map(network => (
                  <Card
                    flex="1"
                    key={network.name}
                    p={['sm', 'md']}
                    shadow="innerLg"
                    variant="level1"
                    w="full"
                    {...network.displayProps}
                  >
                    <Flex alignItems="center" justifyContent="space-between">
                      <HStack gap="ms">
                        <NetworkIcon chain={network.chain} shadow="md" size={iconSize} />
                        <Stack gap={1}>
                          <Heading size="sm" textTransform="capitalize">
                            {network.name}
                          </Heading>
                          <Heading color="font.secondary" size="md">
                            –
                          </Heading>
                        </Stack>
                      </HStack>
                      <Button gap="xs" onClick={openConnectModal} variant="tertiary">
                        <WalletIcon size={20} strokeWidth={2} />
                        Connect
                      </Button>
                    </Flex>
                  </Card>
                ))}
              </SimpleGrid>
            )}
          </ConnectButton.Custom>
        ) : (
          <>
            {hasMerklRewards && (
              <AnimatedAlert>
                <MerklAlert />
              </AnimatedAlert>
            )}
            {claimableItems.length > 0 && (
              <SimpleGrid columns={GRID_COLUMNS} spacing="md">
                {claimableItems.map((item, index) => (
                  <ClaimNetworkBlock
                    chain={item.chain}
                    icon={item.icon}
                    key={`item-${index}`}
                    networkTotalClaimableFiatBalance={item.amount}
                    onClick={openClaimRecoveredFundModal}
                    title="v2 incident recovered funds"
                  />
                ))}
                {claimableItems.length < SLOT_COUNT &&
                  Array.from({ length: SLOT_COUNT - claimableItems.length }).map((_, i) => {
                    const slotIndex = claimableItems.length + i

                    const displayProps =
                      slotIndex === 2
                        ? { base: 'none', md: 'none', lg: 'block' }
                        : { base: 'none', md: 'block' }

                    return <Box aria-hidden display={displayProps} key={`placeholder-${i}`} />
                  })}
              </SimpleGrid>
            )}
          </>
        )}
      </Stack>

      <ClaimRecoveredFundsModal
        isOpen={isClaimRecoveredFundModalOpen}
        onClose={onClaimRecoveredFundModalClose}
      />
      <RecoveredFundsLearnMoreModal
        isOpen={isRecoveredFundsLearnMoreModalOpen}
        onClose={onRecoveredFundsLearnMoreModalClose}
      />
    </FadeInOnView>
  )
}

function AnimatedAlert({ children }: { children: ReactNode }) {
  return (
    <motion.div animate={{ opacity: 1, height: 'auto' }} initial={{ opacity: 0, height: 0 }} layout>
      {children}
    </motion.div>
  )
}
