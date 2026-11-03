import { getCompositionTokens, getFlatCompositionTokens } from '../pool-tokens.utils'
import { usePool } from '../PoolProvider'
import { PoolWeightChart } from './PoolWeightCharts/PoolWeightChart'
import { useTokens } from '@repo/lib/modules/tokens/TokensProvider'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { Pool } from '../pool.types'
import { Skeleton, Flex } from '@chakra-ui/react'
import { NoisyCard } from '@repo/lib/shared/components/containers/NoisyCard'
import { RadialPattern } from '@repo/lib/shared/components/zen/RadialPattern'

interface CompositionViewProps {
  chain: GqlChain
  heightPx: number
  isMobile: boolean
  pool: Pool
  totalLiquidity: string
}

function CompositionView({ chain, pool, totalLiquidity }: CompositionViewProps) {
  return (
    <>
      <RadialPattern
        circleCount={8}
        height={890}
        innerHeight={240}
        innerWidth={240}
        left="calc(50% - 445px)"
        opacity={0.35}
        pointerEvents="none"
        position="absolute"
        top="calc(50% - 465px)"
        width={890}
        zIndex={0}
      />

      <Flex h="full">
        <PoolWeightChart
          chain={chain}
          displayTokens={getFlatCompositionTokens(pool)}
          hasLegend
          totalLiquidity={totalLiquidity}
        />
      </Flex>
    </>
  )
}

export function PoolCompositionChart({ height, isMobile }: { height: number; isMobile: boolean }) {
  const { chain, isLoading, pool } = usePool()
  const { calcTotalUsdValue } = useTokens()

  const compositionTokens = getCompositionTokens(pool)
  const totalLiquidity = calcTotalUsdValue(compositionTokens, chain)
  const heightPx = height - 35

  const compositionViewProps: CompositionViewProps = {
    chain,
    heightPx,
    isMobile,
    pool,
    totalLiquidity,
  }

  return (
    <NoisyCard
      cardProps={{
        height: ['300px', `${heightPx}px`],
        overflow: 'hidden',
        position: 'relative',
      }}
      contentProps={{ alignItems: 'center', display: 'flex', justifyContent: 'center' }}
    >
      {isLoading ? <Skeleton h="full" w="full" /> : <CompositionView {...compositionViewProps} />}
    </NoisyCard>
  )
}
