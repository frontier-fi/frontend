import { Box } from '@chakra-ui/react'
import { Metadata } from 'next'
import { PropsWithChildren } from 'react'

export const metadata: Metadata = {
  title: `Frontier Finance—The Frontier AMM`,
  description: `DeFi's most extensive AMM product suite. The Frontier Finance protocol delivers fungible and yield-bearing liquidity across Ethereum and select EVM chains.`,
  openGraph: {
    title: `Frontier Finance—The Frontier AMM`,
    description: `DeFi's most extensive AMM product suite. The Frontier Finance protocol delivers fungible and yield-bearing liquidity across Ethereum and select EVM chains.`,
    siteName: 'Frontier Finance',
  },
}

export default function MarketingLayout({ children }: PropsWithChildren) {
  return <Box>{children}</Box>
}
