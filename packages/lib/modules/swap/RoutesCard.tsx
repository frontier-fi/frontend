'use client'

import { Path } from '@balancer/sdk'
import {
  Box,
  Divider,
  HStack,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Text,
  VStack,
} from '@chakra-ui/react'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { useTokens } from '../tokens/TokensProvider'
import { bn, fNum } from '@repo/lib/shared/utils/numbers'
import { ArrowRight } from 'lucide-react'
import { useCurrency } from '@repo/lib/shared/hooks/useCurrency'
import React, { ReactElement } from 'react'
import pluralize from 'pluralize'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { SwapRouteSankey } from './SwapRouteSankey'

type RoutesVisualizationProps = {
  paths: Path[]
  chain: GqlChain
  totalInputAmount: number
  totalOutputAmount: number
  maxHops: number
  chartHeight?: number
  showHeader?: boolean
}

export function RoutesVisualization({
  paths,
  chain,
  totalInputAmount,
  totalOutputAmount,
  maxHops,
  chartHeight,
  showHeader = true,
}: RoutesVisualizationProps) {
  const { getToken, priceFor } = useTokens()
  const { toCurrency } = useCurrency()

  const firstPath = paths[0]
  const rawInputAddress = firstPath?.tokens[0]?.address ?? ''
  const rawOutputAddress = firstPath?.tokens[firstPath.tokens.length - 1]?.address ?? ''
  const inputToken = rawInputAddress ? getToken(rawInputAddress, chain) : undefined
  const outputToken = rawOutputAddress ? getToken(rawOutputAddress, chain) : undefined

  const inputSymbol =
    inputToken?.symbol || (rawInputAddress ? `${rawInputAddress.slice(0, 6)}…` : '')

  const outputSymbol =
    outputToken?.symbol || (rawOutputAddress ? `${rawOutputAddress.slice(0, 6)}…` : '')

  const inputValue = bn(totalInputAmount).times(
    inputToken ? priceFor(inputToken.address, chain) : 0
  )

  const outputValue = bn(totalOutputAmount).times(
    outputToken ? priceFor(outputToken.address, chain) : 0
  )

  const outputPercentage = inputValue.isZero() ? 0 : outputValue.div(inputValue).toNumber()
  const valueDelta = -(1 - outputPercentage)
  const valueDeltaLabel = fNum('sharePercent', valueDelta, { hideSmallPercentage: false })

  const signedValueDeltaLabel =
    valueDelta > 0 && !valueDeltaLabel.startsWith('+') ? `+${valueDeltaLabel}` : valueDeltaLabel

  return (
    <VStack align="stretch" spacing="3" w="full">
      {showHeader && (
        <VStack align="start" spacing="1" w="full">
          <Text color="font.primary" fontSize="sm" fontWeight="bold">
            Proposed: {paths.length > 1 ? `${paths.length} paths, ` : ''}
            {maxHops} {pluralize('hop', maxHops)} via {PROJECT_CONFIG.projectName}
          </Text>
          <HStack justify="space-between" w="full">
            <HStack>
              <Text fontSize="sm" fontWeight="bold" letterSpacing="normal">
                {`${fNum('token', totalInputAmount)} ${inputSymbol}`}
              </Text>
              <Text color="font.secondary">
                <ArrowRight size="16" />
              </Text>
            </HStack>
            <Text fontSize="sm" fontWeight="bold" letterSpacing="normal">
              {`${fNum('token', totalOutputAmount)} ${outputSymbol}`}
            </Text>
          </HStack>
        </VStack>
      )}

      <Box bg="background.level3" borderRadius="xl" overflow="visible" px="3" py="1" w="full">
        <SwapRouteSankey chain={chain} height={chartHeight} paths={paths} />
      </Box>

      <HStack color="font.secondary" fontSize="sm" gap="1.5" justify="center" w="full">
        <Text>{toCurrency(inputValue)}</Text>
        <ArrowRight size="14" />
        <Text>{`${toCurrency(outputValue)} (${signedValueDeltaLabel})`}</Text>
      </HStack>
    </VStack>
  )
}

type RoutesPopoverProps = {
  children: ReactElement
  paths: Path[]
  chain: GqlChain
  totalInputAmount: number
  totalOutputAmount: number
  maxHops: number
}

export function RoutesPopover({
  children,
  paths,
  chain,
  totalInputAmount,
  totalOutputAmount,
  maxHops,
}: RoutesPopoverProps) {
  return (
    <Popover placement="top" trigger="hover">
      <PopoverTrigger>{children}</PopoverTrigger>
      <PopoverContent
        bg="background.level4"
        maxW="100vw"
        minW={{ base: '350px', md: '460px' }}
        p="0"
        rounded="lg"
        w={{ base: '350px', md: 'max-content' }}
      >
        <Box p="4" shadow="2xl">
          <RoutesVisualization
            chain={chain}
            chartHeight={200}
            maxHops={maxHops}
            paths={paths}
            totalInputAmount={totalInputAmount}
            totalOutputAmount={totalOutputAmount}
          />
        </Box>
      </PopoverContent>
    </Popover>
  )
}

type Props = {
  paths: Path[] | undefined
  chain: GqlChain
  totalInputAmount: number
  totalOutputAmount: number
}

export function RoutesCard({ paths, chain, totalInputAmount, totalOutputAmount }: Props) {
  if (!paths || paths.length === 0) return null

  const nonBufferHops = paths.reduce((acc, path) => {
    return acc + (path.isBuffer || []).filter(buffer => buffer === false).length
  }, 0)

  const totalSteps = paths.reduce((acc, path) => acc + (path.pools?.length || 0), 0)
  const maxHops = nonBufferHops > 0 ? nonBufferHops : Math.max(1, totalSteps)

  return (
    <Box pt="3" w="full">
      <VStack align="stretch" bg="background.level2" borderRadius="xl" p="md" spacing="3" w="full">
        <HStack justify="space-between" w="full">
          <Text color="font.secondary" fontSize="sm">
            Swap route
          </Text>
          <Text color="font.secondary" fontSize="sm">
            {paths.length > 1 ? `${paths.length} paths, ` : ''}
            {maxHops} {pluralize('hop', maxHops)}
          </Text>
        </HStack>

        <Divider />

        <RoutesVisualization
          chain={chain}
          chartHeight={Math.min(220, Math.max(130, 80 + maxHops * 36))}
          maxHops={maxHops}
          paths={paths}
          showHeader={false}
          totalInputAmount={totalInputAmount}
          totalOutputAmount={totalOutputAmount}
        />
      </VStack>
    </Box>
  )
}
