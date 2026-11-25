import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { MigrationsOverviewPage } from '@repo/lib/modules/pool/migrations/MigrationsOverviewPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: `Migrate liquidity to ${PROJECT_CONFIG.projectName}`,
  description: `Review your Balancer V3 liquidity positions and migrate them to ${PROJECT_CONFIG.projectName} V3 pools.`,
}

export default function MigratePage() {
  return <MigrationsOverviewPage />
}
