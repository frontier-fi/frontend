'use client'

import { Heading, Stack, Skeleton, SimpleGrid, Card, Flex, HStack, Button } from '@chakra-ui/react'
import { usePortfolio } from '../../PortfolioProvider'
import { useUserAccount } from '@repo/lib/modules/web3/UserAccountProvider'
import { type ReactNode } from 'react'
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
import { GqlChainValues, type AppChain } from '@repo/lib/shared/services/api/graphql-enums'

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
 * Only the Merkl rewards alert remains.
 */
export function ClaimNetworkPools() {
  const { poolsWithOnchainUserBalances, isLoadingPortfolio } = usePortfolio()

  const { isConnected } = useUserAccount()

  const chainIds = PROJECT_CONFIG.merklRewardsChains.map(chain => getChainId(chain))
  const { hasMerklRewards } = useHasMerklRewards(poolsWithOnchainUserBalances, chainIds)

  const { isDesktop } = useBreakpoints()
  const iconSize = isDesktop ? 12 : 8

  const currentNetworks = balancerNetworksConfig

  // Empty network placeholders (Eth / Arb / Base "Nothing to claim") are intentional
  // on Balancer when gauges exist elsewhere; Frontier has no gauges, so hide the
  // section entirely until there is something concrete to claim.
  if (!isLoadingPortfolio && isConnected && !hasMerklRewards) {
    return null
  }

  return (
    <FadeInOnView>
      <Stack gap={5}>
        <Heading size="h4" variant="special">
          Claimable incentives
        </Heading>
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
          hasMerklRewards && (
            <AnimatedAlert>
              <MerklAlert />
            </AnimatedAlert>
          )
        )}
      </Stack>
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
