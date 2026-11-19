import { Box, Text } from '@chakra-ui/react'
import { REHYPE_LABEL } from '../pool.helpers'

type RehypeTagProps = {
  isHighlighted?: boolean
  size?: 'sm' | 'md'
}

export function RehypeTag({ isHighlighted = true, size = 'md' }: RehypeTagProps) {
  const isSmall = size === 'sm'

  return (
    <Box
      alignItems="center"
      background="background.level2"
      border="1px solid"
      borderColor={isHighlighted ? 'font.highlight' : 'border.base'}
      display="flex"
      h={isSmall ? '18px' : { base: '28px' }}
      px={isSmall ? '1.5' : 'sm'}
      py={isSmall ? '0' : 'xs'}
      rounded="full"
      shadow="sm"
    >
      <Text
        color={isHighlighted ? 'font.highlight' : 'font.secondary'}
        fontSize={isSmall ? 'xs' : 'sm'}
        fontWeight={isSmall ? 'semibold' : 'normal'}
        lineHeight="1"
        variant="secondary"
      >
        {REHYPE_LABEL}
      </Text>
    </Box>
  )
}
