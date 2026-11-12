import { checkAddressReputation } from '@repo/lib/shared/services/hypernative/checkAddressReputation'
import { NextResponse } from 'next/server'
import { isAddress } from 'viem'

type Params = {
  params: Promise<{
    address: string
  }>
}

export async function GET(request: Request, props: Params) {
  const { address } = await props.params

  if (!isAddress(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  }

  const hypernativeApiId = process.env.HYPERNATIVE_API_ID
  const hypernativeApiSecret = process.env.HYPERNATIVE_API_SECRET

  if (!hypernativeApiId || !hypernativeApiSecret) {
    return NextResponse.json({ isAuthorized: true })
  }

  return checkAddressReputation({
    address,
    hypernativeApiId,
    hypernativeApiSecret,
  })
}
