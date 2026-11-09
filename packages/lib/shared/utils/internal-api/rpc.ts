import { NextRequest } from 'next/server'
import type { GqlChain } from '../../services/api/generated/graphql'
import { drpcUrl } from '../rpc'

const DRPC_KEY = process.env.DRPC_API_KEY || ''

export async function postRpcCall(request: NextRequest, chain: GqlChain) {
  if (!DRPC_KEY) {
    return new Response(JSON.stringify({ error: 'DRPC_API_KEY is missing' }), {
      status: 500,
    })
  }

  const rpcUrl = drpcUrl(chain, DRPC_KEY)
  const rpcBody = await request.json()

  const rpcResponse = await fetch(rpcUrl, {
    method: 'POST',
    body: JSON.stringify(rpcBody),
    next: {
      revalidate: 0,
    },
  })

  return rpcResponse.json()
}
