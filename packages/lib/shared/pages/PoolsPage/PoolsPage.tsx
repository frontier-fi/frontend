'use client'

import { PoolList } from '@repo/lib/modules/pool/PoolList/PoolList'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'
import FadeInOnView from '@repo/lib/shared/components/containers/FadeInOnView'
import { Box, Skeleton, Flex, Heading, Text } from '@chakra-ui/react'
import { PropsWithChildren, Suspense } from 'react'
import Noise from '@repo/lib/shared/components/layout/Noise'
import { PoolPageStats } from './PoolPageStats'
import { FeaturedPartners } from './FeaturedPartners'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { fNumCustom } from '../../utils/numbers'
import { useProtocolStats } from '@repo/lib/modules/protocol/ProtocolStatsProvider'
import { useQuery } from '@apollo/client/react'
import { GetFeaturedPoolsDocument } from '@repo/lib/shared/services/api/generated/graphql'
import { FeaturedPools } from '@repo/lib/modules/featured-pools/FeaturedPools'

type PoolsPageProps = PropsWithChildren & {
  rewardsClaimed24h?: string
}

export function PoolsPage({ children, rewardsClaimed24h }: PoolsPageProps) {
  const { supportedNetworks } = PROJECT_CONFIG

  const { data: featuredPoolsData, loading: featuredPoolsLoading } = useQuery(
    GetFeaturedPoolsDocument,
    {
      variables: { chains: supportedNetworks },
      fetchPolicy: 'cache-and-network',
    }
  )

  const featuredPools = featuredPoolsData?.featuredPools || []

  const { protocolData } = useProtocolStats()

  return (
    <>
      <Box borderBottom="1px solid" borderColor="border.base">
        <Noise
          backgroundColor="background.level0WithOpacity"
          overflow="hidden"
          position="relative"
          shadow="innerBase"
        >
          <DefaultPageContainer
            pb={['xl', 'xl', '10']}
            pr={{ base: '0 !important', md: 'md !important' }}
            pt={['xl', '40px']}
          >
            <FadeInOnView animateOnce={false}>
              <Flex
                align={{ base: 'start', md: 'start' }}
                direction={{ base: 'column', lg: 'row' }}
                gap="4"
                justify={{ base: 'start', md: 'space-between' }}
                mb="10"
              >
                <Box>
                  <Heading pb="3" sx={{ textWrap: 'balance' }} variant="special">
                    Earn passively on {PROJECT_CONFIG.projectName}
                  </Heading>
                  <Text sx={{ textWrap: 'balance' }} variant="secondary">
                    {`Join ${fNumCustom(protocolData?.protocolMetricsAggregated.numLiquidityProviders || '0', '0a')}+ Liquidity Providers in purpose built pools`}
                  </Text>
                </Box>
                <PoolPageStats rewardsClaimed24h={rewardsClaimed24h} />
              </Flex>
            </FadeInOnView>
            <FadeInOnView animateOnce={false}>
              <Box pb={{ base: '0', md: '3' }}>{children}</Box>
            </FadeInOnView>
          </DefaultPageContainer>
        </Noise>
      </Box>
      <DefaultPageContainer
        noVerticalPadding
        pb="xl"
        pr={{ base: '0 !important', xl: 'md !important' }}
        pt={['lg', '54px']}
      >
        <FadeInOnView animateOnce={false}>
          <Suspense fallback={<Skeleton h="500px" w="full" />}>
            <PoolList />
          </Suspense>
        </FadeInOnView>
      </DefaultPageContainer>
      {(featuredPools.length > 0 || featuredPoolsLoading) && (
        <DefaultPageContainer mb="lg" py="0" rounded="2xl">
          <Box>
            {!featuredPoolsLoading && featuredPools.length > 0 && (
              <FeaturedPools featuredPools={featuredPools} />
            )}
            {featuredPoolsLoading && <Skeleton height="327px" width="100%" />}
          </Box>
        </DefaultPageContainer>
      )}
      <DefaultPageContainer mb="0" py="0" rounded="2xl">
        <FeaturedPartners />
      </DefaultPageContainer>
    </>
  )
}
