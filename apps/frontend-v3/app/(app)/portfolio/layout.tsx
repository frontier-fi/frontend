import { BalV3MigrationPromptModal } from '@repo/lib/modules/pool/migrations/BalV3MigrationPromptModal'
import { PortfolioProvider } from '@repo/lib/modules/portfolio/PortfolioProvider'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'
import { PropsWithChildren } from 'react'

export default async function PortfolioLayout({ children }: PropsWithChildren) {
  return (
    <DefaultPageContainer minH="100vh">
      <PortfolioProvider>
        <BalV3MigrationPromptModal />
        {children}
      </PortfolioProvider>
    </DefaultPageContainer>
  )
}
