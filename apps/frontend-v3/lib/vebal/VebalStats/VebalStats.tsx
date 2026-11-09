'use client'

import { BoxProps, Card, CardProps, VStack } from '@chakra-ui/react'
import { NoisyCard } from '@repo/lib/shared/components/containers/NoisyCard'
import { UserVebalStatsValues } from './UserVebalStatsValues'

const COMMON_NOISY_CARD_PROPS: { contentProps: BoxProps; cardProps: BoxProps } = {
  contentProps: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 'none',
    borderTopLeftRadius: 'none',
    borderBottomRightRadius: 'none',
  },
  cardProps: {
    position: 'relative',
    height: 'full',
  },
}

export function VebalStats({ ...props }: CardProps) {
  return (
    <Card position="relative" {...props}>
      <NoisyCard
        cardProps={COMMON_NOISY_CARD_PROPS.cardProps}
        contentProps={COMMON_NOISY_CARD_PROPS.contentProps}
      >
        <VStack
          align="flex-start"
          h="full"
          justify="flex-start"
          m="auto"
          p={{ base: 'lg', md: 'lg' }}
          role="group"
          spacing="xl"
          w="full"
          zIndex={1}
        >
          <UserVebalStatsValues />
        </VStack>
      </NoisyCard>
    </Card>
  )
}
