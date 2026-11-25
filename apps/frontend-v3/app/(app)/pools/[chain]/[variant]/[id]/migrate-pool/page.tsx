import {
  PoolMigrationPage,
  PoolPathProps,
} from '@repo/lib/modules/pool/migrations/PoolMigrationPage'

export default async function MigratePoolWrapper({
  params,
  searchParams,
}: {
  params: Promise<PoolPathProps>
  searchParams: Promise<{ from?: string | string[] }>
}) {
  const { id, chain, variant } = await params
  const { from } = await searchParams
  const fromPoolId = Array.isArray(from) ? from[0] : from

  return <PoolMigrationPage chain={chain} fromPoolId={fromPoolId} id={id} variant={variant} />
}
