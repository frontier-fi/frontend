import { Metadata } from 'next'
import { PropsWithChildren } from 'react'

export const metadata: Metadata = {
  title: 'Frontier Finance DeFi Liquidity Pool Creation',
  description: `
    Create a new DeFi liquidity pool on Frontier Finance.
  `,
}

export default async function Layout({ children }: PropsWithChildren) {
  return <>{children}</>
}
