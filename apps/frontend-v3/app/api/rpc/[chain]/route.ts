import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { postRpcCall } from '@repo/lib/shared/utils/internal-api/rpc'
import type { NextRequest } from 'next/server'

type Params = {
  params: Promise<{
    chain: string
  }>
}

export async function POST(request: NextRequest, props: Params) {
  const { chain } = await props.params

  return postRpcCall(request, chain as GqlChain)
}
