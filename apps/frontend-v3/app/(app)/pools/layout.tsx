import { BalV3MigrationPromptModal } from '@repo/lib/modules/pool/migrations/BalV3MigrationPromptModal'
import { Metadata } from 'next'
import { PropsWithChildren } from 'react'

export const metadata: Metadata = {
  title: 'Frontier Finance DeFi Liquidity Pools',
  description: `
    Explore DeFi liquidity pools or create your own.
    Provide liquidity to accumulate yield from swap fees
    while retaining your token exposure as prices move.
  `,
}

export default async function Pools({ children }: PropsWithChildren) {
  return (
    <>
      <BalV3MigrationPromptModal />
      {children}
    </>
  )
}
