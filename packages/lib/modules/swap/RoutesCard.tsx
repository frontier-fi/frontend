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

  const inputToken = getToken(paths[0]!.tokens[0]!.address, chain)!
  const outputToken = getToken(paths[0]!.tokens[paths[0]!.tokens.length - 1]!.address, chain)!

  const inputValue = bn(totalInputAmount).times(priceFor(inputToken.address, chain))
  const outputValue = bn(totalOutputAmount).times(priceFor(outputToken.address, chain))
  const outputPercentage = inputValue.isZero() ? 0 : outputValue.div(inputValue).toNumber()

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
                {`${fNum('token', totalInputAmount)} ${inputToken.symbol}`}
              </Text>
              <Text color="font.secondary">
                <ArrowRight size="16" />
              </Text>
            </HStack>
            <Text fontSize="sm" fontWeight="bold" letterSpacing="normal">
              {`${fNum('token', totalOutputAmount)} ${outputToken.symbol}`}
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
        <Text>
          {`${toCurrency(outputValue)} (${fNum('sharePercent', -(1 - outputPercentage), {
            hideSmallPercentage: false,
          })})`}
        </Text>
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
  protocolVersion: number
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
  protocolVersion: number
}

export function RoutesCard({
  paths,
  chain,
  totalInputAmount,
  totalOutputAmount,
  protocolVersion,
}: Props) {
  if (!paths || paths.length === 0) return null

  const maxHops = paths.reduce((acc, path) => {
    return acc + (path.isBuffer || []).filter(buffer => buffer === false).length
  }, 0)

  return (
    <Box pt="3" w="full">
      <VStack align="stretch" bg="background.level2" borderRadius="xl" p="md" spacing="3" w="full">
        <HStack justify="space-between" w="full">
          <Text color="font.secondary" fontSize="sm">
            Swap route
          </Text>
          <Text color="font.secondary" fontSize="sm">
            {paths.length > 1 ? `${paths.length} paths, ` : ''}
            {maxHops} {pluralize('hop', maxHops)} (Bv{protocolVersion})
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
