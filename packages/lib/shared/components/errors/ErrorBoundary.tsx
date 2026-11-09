'use client'

import { Button, Box, Text, Heading, VStack } from '@chakra-ui/react'
import { useEffect } from 'react'
import { ensureError } from '../../utils/errors'
import { reportClientError } from '../../utils/error-logger'
import { shouldIgnore } from '../../utils/query-errors'
import { DefaultPageContainer } from '../containers/DefaultPageContainer'

interface BoundaryErrorProps {
  error: unknown
  resetErrorBoundary: () => void
}

export function BoundaryError({ error, resetErrorBoundary }: BoundaryErrorProps) {
  const _error = ensureError(error)

  useEffect(() => {
    if (shouldIgnore(_error.message, _error.stack)) return

    reportClientError({
      category: 'error-boundary',
      errorName: _error.name,
      message: _error.message,
      shortMessage: _error.shortMessage,
      digest: _error.digest,
      stack: _error.stack,
    })
  }, [_error])

  return (
    <Box border="2px dashed" borderColor="red.500" minH="200px" p="md" rounded="lg" w="full">
      <VStack align="start" spacing="md">
        <Heading size="md">Something went wrong! :(</Heading>
        <VStack align="start" spacing="xs">
          <Text>
            {_error?.name
              ? `${_error?.name}: ${_error?.shortMessage || ''}`
              : _error?.shortMessage || ''}
          </Text>
          <Text>{_error?.message}</Text>
          <Text>
            Error Digest: {_error?.digest} (this can be passed on to support to help with debugging)
          </Text>
        </VStack>

        <Button onClick={resetErrorBoundary} size="sm">
          Try again
        </Button>
      </VStack>
    </Box>
  )
}

export function PageErrorBoundary(props: BoundaryErrorProps) {
  return (
    <DefaultPageContainer minH="80vh">
      <BoundaryError {...props} />
    </DefaultPageContainer>
  )
}
