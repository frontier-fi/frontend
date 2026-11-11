import type { GqlHookReviewData } from '@repo/lib/shared/services/api/graphql-derived-types'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  VStack,
  HStack,
  Text,
  Heading,
  Box,
  Icon,
} from '@chakra-ui/react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { getWarnings } from '../../pool.helpers'
import { PropsWithChildren } from 'react'
import { normalizeRelativeReviewPath } from '@repo/lib/shared/utils/strings'

type PopoverInfoBodyProps = {
  data: GqlHookReviewData | undefined | null
  level: number
}

type HookInfoPopOverProps = PopoverInfoBodyProps & PropsWithChildren

function PopoverInfoBody({ data, level }: PopoverInfoBodyProps) {
  const warnings = getWarnings(data?.warnings || [])
  const reviewPath = normalizeRelativeReviewPath(data?.reviewFile)

  return (
    <>
      {level === 0 && (
        <>
          <Text fontSize="sm">
            This hook has not been reviewed.
            <br />
            Proceed with caution.
          </Text>
          <Text fontSize="sm">
            Learn more about{' '}
            <Link href="/risks#hooks-risk" rel="noopener noreferrer" target="_blank">
              <Box as="span" color="font.link">
                hook risks
              </Box>
            </Link>
          </Text>
        </>
      )}
      {level !== 0 && (
        <>
          <VStack alignItems="flex-start" gap="0">
            <Text color="grayText" fontSize="sm">
              Review summary:
            </Text>
            <Text fontSize="sm">
              {data?.summary === 'safe' ? 'No vulnerabilities were reported' : 'Unsafe'}
            </Text>
          </VStack>
          <VStack alignItems="flex-start" gap="0">
            <Text color="grayText" fontSize="sm">
              Warnings:
            </Text>
            {warnings.length > 0 ? (
              <Text fontSize="sm">Yes, see review details</Text>
            ) : (
              <Text fontSize="sm">
                None except{' '}
                <Link href="/risks#hooks-risk" rel="noopener noreferrer" target="_blank">
                  <Box as="span" color="font.link">
                    hook risks
                  </Box>
                </Link>
              </Text>
            )}
          </VStack>
          {reviewPath && (
            <Link
              href={`https://github.com/frontier-fi/code-review/blob/main/hooks/${reviewPath}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              <HStack gap="xxs">
                <Text color="font.link" fontSize="sm">
                  View review details
                </Text>
                <Icon as={ArrowUpRight} color="font.link" size={12} />
              </HStack>
            </Link>
          )}
        </>
      )}
    </>
  )
}

export function HookInfoPopOver({ data, level, children }: HookInfoPopOverProps) {
  // Frontier hooks have no reviewData — show minimal info without warnings
  const body = data ? (
    <PopoverInfoBody data={data} level={level} />
  ) : (
    <Text fontSize="sm">Hook address registered. Review data is unavailable.</Text>
  )

  return (
    <Popover trigger="hover">
      <PopoverTrigger>{children}</PopoverTrigger>
      <PopoverContent w="auto">
        <PopoverArrow bg="background.level3" />
        <PopoverBody>
          <VStack alignItems="flex-start" spacing="ms" w="full">
            <HStack w="full">
              <Heading fontSize="1.125rem" variant="h4">
                Hook
              </Heading>
            </HStack>
            {body}
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  )
}
