import { Box, BoxProps, CardProps } from '@chakra-ui/react'
import { ReactNode } from 'react'

type NoisyCardProps = {
  cardProps?: CardProps
  contentProps?: BoxProps
  shadowContainerProps?: BoxProps
  children?: ReactNode | ReactNode[]
}

export function NoisyCard({
  children,
  cardProps = {},
  contentProps = {},
  shadowContainerProps = {},
}: NoisyCardProps) {
  return (
    <Box
      backgroundImage={`url('/images/background-noise.png')`}
      borderWidth={0}
      position="relative"
      rounded="sm"
      width="full"
      {...cardProps}
    >
      <Box
        content=""
        height="full"
        pointerEvents="none"
        position="absolute"
        shadow="innerXl"
        width="full"
        {...shadowContainerProps}
      />
      <Box
        backgroundColor="background.level0WithOpacity"
        height="full"
        width="full"
        {...contentProps}
      >
        {children}
      </Box>
    </Box>
  )
}
