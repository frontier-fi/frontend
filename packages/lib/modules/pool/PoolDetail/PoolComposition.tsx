'use client'

import { BalAlert } from '@repo/lib/shared/components/alerts/BalAlert'
import {
  Box,
  Card,
  Divider,
  HStack,
  Heading,
  Skeleton,
  Stack,
  Text,
  VStack,
  Link,
} from '@chakra-ui/react'
import TokenRow from '@repo/lib/modules/tokens/TokenRow/TokenRow'
import { useTokens } from '@repo/lib/modules/tokens/TokensProvider'
import { useBreakpoints } from '@repo/lib/shared/hooks/useBreakpoints'
import { useCurrency } from '@repo/lib/shared/hooks/useCurrency'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { bn, fNum, isBnParseable } from '@repo/lib/shared/utils/numbers'
import { useLayoutEffect, useRef, useState, Fragment } from 'react'
import { Address } from 'viem'
import { usePoolsMetadata } from '../metadata/PoolsMetadataProvider'
import { isBoosted } from '../pool.helpers'
import { PoolToken } from '../pool.types'
import { usePool } from '../PoolProvider'
import { Pool } from '../pool.types'
import { PoolTypeTag } from './PoolTypeTag'
import { getCompositionTokens, getNestedPoolTokens } from '../pool-tokens.utils'
import { toSafeHttpsUrl } from '@repo/lib/shared/utils/strings'
import { useGetPoolTokensWithActualWeights } from '../useGetPoolTokensWithActualWeights'
import { PoolCompositionChart } from './PoolCompositionChart'
import { PoolTotalLiquidityDisplay } from './PoolTotalLiquidityDisplay'
import { formatStringsToSentenceList } from '../usePoolTokenPriceWarnings'

type CardContentProps = {
  totalLiquidity: string
  poolTokens: PoolToken[]
  chain: GqlChain
  pool: Pool
}

function CardContent({ totalLiquidity, poolTokens, chain, pool }: CardContentProps) {
  const { toCurrency } = useCurrency()
  const { poolTokensWithActualWeights } = useGetPoolTokensWithActualWeights(pool)

  return (
    <VStack spacing="md" width="full">
      <HStack justifyContent="space-between" width="full">
        <VStack alignItems="flex-start">
          <Heading fontWeight="bold" size="h5">
            Total liquidity
          </Heading>
        </VStack>
        <VStack alignItems="flex-end">
          {totalLiquidity ? (
            <PoolTotalLiquidityDisplay
              size="h5"
              totalLiquidity={toCurrency(totalLiquidity, {
                abbreviated: false,
              })}
            />
          ) : (
            <Skeleton height="24px" w="75px" />
          )}
        </VStack>
      </HStack>
      <Divider />
      <VStack spacing="md" width="full">
        {poolTokens.map(poolToken => {
          const actualWeight = poolTokensWithActualWeights[poolToken.address]

          return (
            <VStack key={`pool-${poolToken.address}`} w="full">
              <TokenRow
                actualWeight={actualWeight}
                address={poolToken.address as Address}
                chain={chain}
                pool={pool}
                showZeroAmountAsDash={true}
                targetWeight={poolToken.weight || undefined}
                value={poolToken.balance}
                {...(poolToken.hasNestedPool && {
                  isNestedBpt: true,
                })}
              />
              {poolToken.hasNestedPool && poolToken.nestedPool && (
                <VStack pl="8" w="full">
                  {getNestedPoolTokens(poolToken).map(nestedPoolToken => {
                    const calculatedWeight =
                      isBnParseable(nestedPoolToken.balanceUSD) &&
                      isBnParseable(poolToken.balanceUSD)
                        ? bn(nestedPoolToken.balanceUSD).div(bn(poolToken.balanceUSD))
                        : bn(0)

                    return (
                      <TokenRow
                        actualWeight={bn(actualWeight ?? 0)
                          .times(calculatedWeight)
                          .toString()}
                        address={nestedPoolToken.address as Address}
                        chain={chain}
                        iconSize={35}
                        isNestedToken
                        key={`nested-pool-${nestedPoolToken.address}`}
                        targetWeight={
                          nestedPoolToken.weight &&
                          poolToken.weight &&
                          isBnParseable(nestedPoolToken.weight) &&
                          isBnParseable(poolToken.weight)
                            ? bn(nestedPoolToken.weight).times(poolToken.weight).toString()
                            : undefined
                        }
                        value={nestedPoolToken.balance}
                      />
                    )
                  })}
                </VStack>
              )}
            </VStack>
          )
        })}
      </VStack>
    </VStack>
  )
}

export function PoolComposition() {
  const { pool, chain } = usePool()
  const { isMobile } = useBreakpoints()
  const { calcTotalUsdValue } = useTokens()
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [height, setHeight] = useState(0)
  const { getErc4626Metadata } = usePoolsMetadata()

  const compositionTokens = getCompositionTokens(pool)
  const totalLiquidity = calcTotalUsdValue(compositionTokens, chain)
  const erc4626Metadata = getErc4626Metadata(pool)

  const protocolLinks = erc4626Metadata.flatMap(metadata => {
    const readMoreUrl = toSafeHttpsUrl(metadata.readMoreURL)
    return readMoreUrl ? [{ name: metadata.name.split(' ')[0]!, readMoreUrl }] : []
  })

  const hasReadMoreURL = protocolLinks.length > 0

  const protocolNames = erc4626Metadata.map(metadata => metadata.name.split(' ')[0]!)
  const formattedProtocolNames = formatStringsToSentenceList(protocolNames)
  const boostedWarningMsg = `This Boosted pool uses wrapped ${formattedProtocolNames} tokens to generate yield from lending on ${protocolNames.length === 1 ? 'that protocol' : 'those protocols'}. This results in continuous appreciation of the pool's total value over time.`

  useLayoutEffect(() => {
    if (cardRef.current) {
      setHeight(cardRef.current.offsetHeight)
    }

    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0] && entries[0].target instanceof HTMLElement) {
        setHeight(entries[0].target.offsetHeight)
      }
    })

    if (cardRef.current) {
      resizeObserver.observe(cardRef.current)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [pool.id])

  return (
    <Card ref={cardRef}>
      <Stack
        direction={{ base: 'column', md: 'row' }}
        justifyContent="stretch"
        maxH="1000px"
        minH="400px"
        spacing="md"
      >
        <VStack align="flex-start" spacing="md" w="full">
          <HStack justifyContent="space-between" w="full">
            <Heading fontWeight="bold" size="h4">
              Pool composition
            </Heading>
            <PoolTypeTag pool={pool} />
          </HStack>
          {isBoosted(pool) && (
            <BalAlert
              content={
                <>
                  <Text color="font.dark" fontSize="sm">
                    {boostedWarningMsg}
                    {hasReadMoreURL && (
                      <>
                        {' '}
                        Read more about{' '}
                        {protocolLinks.map((protocol, index) => (
                          <Fragment key={index}>
                            <Link href={protocol.readMoreUrl} isExternal rel="noopener noreferrer">
                              <Box
                                as="span"
                                color="purple.500"
                                fontSize="sm"
                                fontWeight="bold"
                                textDecoration="underline"
                              >
                                {protocol.name}
                              </Box>
                            </Link>
                            {index < protocolLinks.length - 2
                              ? ', '
                              : index === protocolLinks.length - 2
                                ? ' & '
                                : ''}
                          </Fragment>
                        ))}
                        .
                      </>
                    )}
                  </Text>
                </>
              }
              status="info"
            />
          )}
          <Divider />
          <CardContent
            chain={chain}
            pool={pool}
            poolTokens={compositionTokens}
            totalLiquidity={totalLiquidity}
          />
          <Divider mt="auto" />
          <Text color="grayText" fontSize="sm" pb="sm">
            From {fNum('integer', pool.dynamicData.holdersCount)} Liquidity Providers
          </Text>
        </VStack>
        <PoolCompositionChart height={height} isMobile={!!isMobile} />
      </Stack>
    </Card>
  )
}
