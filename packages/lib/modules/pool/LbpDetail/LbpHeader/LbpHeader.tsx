import { Box, Grid, GridItem, VStack } from '@chakra-ui/react'
import { PoolBreadcrumbs } from '../../PoolDetail/PoolHeader/PoolBreadcrumbs'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'
import FadeInOnView from '@repo/lib/shared/components/containers/FadeInOnView'
import Noise from '@repo/lib/shared/components/layout/Noise'
import { LbpHeaderTitleDescription } from './LbpHeaderTitleDescription'
import { LbpHeaderTimeInfo } from './LbpHeaderTimeInfo'
import { LbpHeaderStats } from './LbpHeaderStats'

export function LbpHeader() {
  return (
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
            <VStack align="start" w="full">
              <PoolBreadcrumbs />
              <Grid gap="4" templateColumns={{ base: '1fr', md: '2fr 1fr' }} w="full">
                <GridItem pr="2">
                  <LbpHeaderTitleDescription />
                </GridItem>
                <GridItem>
                  <VStack align="start" h="full">
                    <LbpHeaderTimeInfo />
                    <Box mt="auto">
                      <LbpHeaderStats />
                    </Box>
                  </VStack>
                </GridItem>
              </Grid>
            </VStack>
          </FadeInOnView>
        </DefaultPageContainer>
      </Noise>
    </Box>
  )
}
