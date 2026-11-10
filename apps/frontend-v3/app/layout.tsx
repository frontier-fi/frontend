import { Metadata } from 'next'
import { satoshiFont } from '@repo/lib/assets/fonts/satoshi/satoshi'
import NextTopLoader from 'nextjs-toploader'
import '@repo/lib/assets/css/global.css'
import { PropsWithChildren } from 'react'
import { Providers } from '@repo/lib/shared/components/site/providers'
import { NavBarContainer } from '@bal/lib/components/navs/NavBarContainer'
import { ThemeProvider } from '@bal/lib/services/chakra/ThemeProvider'
import { BalancerLogoType } from '@bal/lib/components/imgs/BalancerLogoType'
import { Footer } from '@repo/lib/shared/components/navs/Footer'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'

export const metadata: Metadata = {
  metadataBase: new URL(PROJECT_CONFIG.appUrl),
  title: `Frontier Finance—DeFi Liquidity Pools`,
  description: `Explore liquidity pools on Frontier Finance and earn passively in yield-bearing pools.`,
  icons: [
    { rel: 'icon', type: 'image/x-icon', url: '/favicon.ico' },
    {
      rel: 'icon',
      type: 'image/png',
      url: '/favicon-light.png',
      media: '(prefers-color-scheme: light)',
    },
    {
      rel: 'icon',
      type: 'image/png',
      url: '/favicon-dark.png',
      media: '(prefers-color-scheme: dark)',
    },
  ],
  openGraph: {
    title: `Frontier Finance—DeFi Liquidity Pools`,
    description: `Explore liquidity pools on Frontier Finance and earn passively in yield-bearing pools.`,
    siteName: 'Frontier Finance',
    type: 'website',
  },
  other: {
    'base:app_id': '6a030a6b0ec9a0da335752af',
  },
}

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <body
        className={satoshiFont.className}
        style={{ marginRight: '0px !important' }} // Required to prevent layout shift introduced by Rainbowkit
      >
        <NextTopLoader color="#0DB2D0" showSpinner={false} />
        <ThemeProvider>
          <Providers>
            <NavBarContainer />
            {children}
            <Footer
              logoType={<BalancerLogoType />}
              subTitle="Frontier Finance is a battle-tested toolkit for true AMM experimentation and innovation."
              title="AMMs made easy"
            />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
