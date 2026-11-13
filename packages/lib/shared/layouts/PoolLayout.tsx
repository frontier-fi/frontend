import { Pool, PoolVariant } from '@repo/lib/modules/pool/pool.types'
import {
  ChainSlug,
  getPoolTypeLabel,
  getSupportedChainFromSlug,
} from '@repo/lib/modules/pool/pool.utils'
import { PropsWithChildren, Suspense } from 'react'
import { PoolDetailSkeleton } from '@repo/lib/modules/pool/PoolDetail/PoolDetailSkeleton'
import { getApolloServerClient } from '@repo/lib/shared/services/api/apollo-server.client'
import { Metadata } from 'next'
import { PoolProvider } from '@repo/lib/modules/pool/PoolProvider'
import { arrayToSentence } from '@repo/lib/shared/utils/strings'
import { notFound } from 'next/navigation'
import { getUserReferenceTokens } from '@repo/lib/modules/pool/pool-tokens.utils'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { getPoolQuery } from '@repo/lib/modules/pool/queries/fetchPool'

type PoolLayoutProps = PropsWithChildren<{
  chain: ChainSlug
  id: string
  variant?: PoolVariant
}>

export type PoolMetadata = {
  metadata: Metadata
  pool?: Pool
}

export async function generatePoolMetadata({
  id,
  chain,
  variant,
}: PoolLayoutProps): Promise<PoolMetadata> {
  if (!getSupportedChainFromSlug(chain)) return { metadata: {} }

  const { data } = await getPoolQuery(getApolloServerClient(), chain, id)

  const pool = data?.pool
  if (!pool) return { metadata: {} }

  const displayTokens = getUserReferenceTokens(pool)
  const poolTokenString = arrayToSentence(displayTokens.map(token => token.symbol))
  const poolSymbol = PROJECT_CONFIG.options.showPoolName ? 'This' : pool.symbol // pool name is already shown in the title so we don't need to show it twice

  return {
    metadata: {
      title: `Liquidity Pool (${variant}): ${pool.name}`,
      description: `${poolSymbol} is a Frontier Finance ${variant} ${getPoolTypeLabel(
        pool.type
      )} liquidity pool which contains ${poolTokenString}.`,
    },
    pool: pool as Pool,
  }
}

export async function PoolLayout({ id, chain, variant, children }: PoolLayoutProps) {
  const _chain = getSupportedChainFromSlug(chain)

  if (!_chain) {
    notFound()
  }

  const { data, error } = await getPoolQuery(getApolloServerClient(), chain, id)

  if (error) {
    if (error.message.includes('Pool with id does not exist')) {
      notFound()
    }

    throw new Error(`Failed to fetch pool (${_chain} ${id}): ${error.message}`)
  } else if (!data) {
    throw new Error(`Failed to fetch pool (${_chain} ${id}): empty response`)
  }

  return (
    <Suspense fallback={<PoolDetailSkeleton />}>
      <PoolProvider chain={_chain} data={data} id={id} variant={variant}>
        {children}
      </PoolProvider>
    </Suspense>
  )
}
