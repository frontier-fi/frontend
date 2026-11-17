import { handleWalletCheckRequest } from '@repo/lib/shared/services/hypernative/checkAddressReputation'
import type { NextRequest } from 'next/server'

type Params = {
  params: Promise<{
    address: string
  }>
}

export async function GET(request: NextRequest, props: Params) {
  const { address } = await props.params

  return handleWalletCheckRequest(request, address)
}
