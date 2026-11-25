'use client'

import { isSameAddress } from '@repo/lib/shared/utils/addresses'
import { useMandatoryContext } from '@repo/lib/shared/utils/contexts'
import { createContext, PropsWithChildren, useCallback, useMemo } from 'react'
import { PoolMigration } from './getPoolMigrations'
import { useBalV3MigratablePositions } from './useBalV3MigratablePositions'

export type UsePoolsMigrationsResult = ReturnType<typeof usePoolsMigrationsLogic>
export const PoolsMigrationsContext = createContext<UsePoolsMigrationsResult | null>(null)

export function usePoolsMigrationsLogic(poolMigrations: PoolMigration[]) {
  const { migratablePositions, hasMigratablePositions, isLoading, refetch } =
    useBalV3MigratablePositions(poolMigrations)

  const needsMigrationCallback = useCallback(
    (protocolVersion: number, chainId: number, poolId: string) =>
      needsMigration(poolMigrations, protocolVersion, chainId, poolId),
    [poolMigrations]
  )

  const getMigrationCallback = useCallback(
    (protocolVersion: number, chainId: number, poolId: string) =>
      getMigration(poolMigrations, protocolVersion, chainId, poolId),
    [poolMigrations]
  )

  const getMigrationsForTargetCallback = useCallback(
    (chainId: number, frontierPoolId: string) =>
      getMigrationsForTarget(poolMigrations, chainId, frontierPoolId),
    [poolMigrations]
  )

  const getMigrationBySourceCallback = useCallback(
    (chainId: number, sourcePoolId: string) =>
      getMigrationBySource(poolMigrations, chainId, sourcePoolId),
    [poolMigrations]
  )

  return useMemo(
    () => ({
      poolMigrations,
      needsMigration: needsMigrationCallback,
      getMigration: getMigrationCallback,
      getMigrationsForTarget: getMigrationsForTargetCallback,
      getMigrationBySource: getMigrationBySourceCallback,
      migratablePositions,
      hasMigratablePositions,
      isLoading,
      refetch,
    }),
    [
      poolMigrations,
      needsMigrationCallback,
      getMigrationCallback,
      getMigrationsForTargetCallback,
      getMigrationBySourceCallback,
      migratablePositions,
      hasMigratablePositions,
      isLoading,
      refetch,
    ]
  )
}

export function PoolMigrationsProvider({
  children,
  poolMigrations,
}: PropsWithChildren & { poolMigrations: PoolMigration[] }) {
  const hook = usePoolsMigrationsLogic(poolMigrations)
  return <PoolsMigrationsContext.Provider value={hook}>{children}</PoolsMigrationsContext.Provider>
}

export const usePoolMigrations = () =>
  useMandatoryContext(PoolsMigrationsContext, 'PoolsMigrations')

function needsMigration(
  migrations: PoolMigration[],
  protocolVersion: number,
  chainId: number,
  poolId: string
) {
  return getMigration(migrations, protocolVersion, chainId, poolId) !== undefined
}

function getMigration(
  migrations: PoolMigration[],
  protocolVersion: number,
  chainId: number,
  poolId: string
) {
  return migrations.find(
    migration =>
      migration.old.protocol === protocolVersion &&
      migration.old.chainId === chainId &&
      isSameAddress(migration.old.id, poolId)
  )
}

function getMigrationsForTarget(
  migrations: PoolMigration[],
  chainId: number,
  frontierPoolId: string
): PoolMigration[] {
  return migrations.filter(
    migration =>
      migration.new.chainId === chainId && isSameAddress(migration.new.id, frontierPoolId)
  )
}

function getMigrationBySource(
  migrations: PoolMigration[],
  chainId: number,
  sourcePoolId: string
): PoolMigration | undefined {
  return migrations.find(
    migration => migration.old.chainId === chainId && isSameAddress(migration.old.id, sourcePoolId)
  )
}
