import { Box, Text } from '@chakra-ui/react'

type Props = {
  enableUnlistedToken?: boolean
}

export function TokenSelectNoResults({ enableUnlistedToken = false }: Props) {
  return (
    <Box p="lg">
      <Text color="font.error" fontWeight="bold" mb="xxs">
        No tokens found
      </Text>
      <Text color="font.secondary" fontSize="sm">
        Are you sure this token is on this network?
      </Text>
      <Text color="font.secondary" fontSize="sm">
        You can search by token name, symbol or address
      </Text>
      {enableUnlistedToken && (
        <Text color="font.warning" fontSize="sm">
          To search for unlisted tokens, use the contract address
        </Text>
      )}
    </Box>
  )
}
