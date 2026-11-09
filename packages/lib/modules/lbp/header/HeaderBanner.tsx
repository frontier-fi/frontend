import { Box, Heading, HStack, Stack, Text, VStack } from '@chakra-ui/react'
import { NoisyCard } from '@repo/lib/shared/components/containers/NoisyCard'
import { FeatureLink } from './FeatureLink'
import { LbpBenefitsScalesIcon } from '@repo/lib/shared/components/icons/lbp/LbpBenefitsScalesIcon'
import { LbpBenefitsChartIcon } from '@repo/lib/shared/components/icons/lbp/LbpBenefitsChartIcon'
import { LbpBenefitsLightningIcon } from '@repo/lib/shared/components/icons/lbp/LbpBenefitsLightningIcon'
import { LbpLearnMoreModal } from '../modal/LbpLearnMoreModal'

export function HeaderBanner() {
  const fairPriceDescription = `
  The dynamic weight adjustment mechanism in LBPs prevent price manipulation
  and ensures natural price discovery. The gradual shift from a high token
  weight to a lower weight over time creates a smoother pricing curve, making
  it more difficult for whales to dominate the initial distribution.
`

  const capitalEfficiencyDescription = `
  Projects can launch with minimal starting capital since LBPs don't require
  the traditional 50:50 asset ratio. Teams can start with as little as 5-10%
  of the collateral asset (like USDC or ETH) paired with their token, significantly
  reducing initial capital requirements.
`

  const immediateLiquidityDescription = `
  Once the LBP concludes, you get immediate access to the funds raised. Further,
  the new token holders can immediately trade their tokens, providing instant
  liquidity without lengthy lock-up periods. This gives early supporters flexibility
  in managing their positions.
`

  return (
    <NoisyCard
      cardProps={{
        w: 'full',
        overflow: 'hidden',
        rounded: 'xl',
        mb: 'xl',
      }}
    >
      <HStack
        alignItems={{ base: 'start', md: 'center' }}
        flexDirection={{ base: 'column', lg: 'row' }}
        justifyContent={{ base: 'start', lg: 'space-between' }}
        p={{ base: 'lg', lg: 'xl' }}
        spacing={{ base: 'md', lg: undefined }}
        w="full"
      >
        <VStack
          alignItems="start"
          pt="sm"
          spacing="30px"
          w={{ base: 'full', lg: undefined }}
          zIndex={1}
        >
          <VStack alignItems="start" spacing="ms">
            <Box maxW="290px">
              <Heading as="h1" size="lg" sx={{ textWrap: 'nowrap' }} variant="special">
                Create an LBP token sale
              </Heading>
            </Box>

            <Text color="font.secondary" maxW="38ch" sx={{ textWrap: 'balance' }}>
              A fair, transparent mechanism for price discovery that protects both project creators
              and early supporters.
            </Text>

            <LbpLearnMoreModal buttonLabel="Learn more" />
          </VStack>
        </VStack>

        <Stack
          direction={{ base: 'column', md: 'row' }}
          justifyContent="stretch"
          spacing={{ base: 4, md: 2, lg: 4, xl: 8 }}
          w="full"
        >
          <FeatureLink
            description={fairPriceDescription}
            icon={<LbpBenefitsScalesIcon />}
            title="Fair price discovery"
            transformBackground="rotate(0deg)"
          />
          <FeatureLink
            description={capitalEfficiencyDescription}
            icon={<LbpBenefitsChartIcon />}
            title="Capital efficiency"
            transformBackground="rotate(90deg)"
          />
          <FeatureLink
            description={immediateLiquidityDescription}
            icon={<LbpBenefitsLightningIcon />}
            title="Immediate liquidity"
            transformBackground="rotate(-90deg)"
          />
        </Stack>
      </HStack>
    </NoisyCard>
  )
}
