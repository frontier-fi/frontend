'use client'

import { getGqlChain } from '@repo/lib/config/app.config'
import { SupportedChainId } from '@repo/lib/config/config.types'
import { useTokens } from '@repo/lib/modules/tokens/TokensProvider'
import { useUserAccount } from '@repo/lib/modules/web3/UserAccountProvider'
import { isSameAddress } from '@repo/lib/shared/utils/addresses'
import { vaultExtensionAbi_V3 } from '@frontier-fi/sdk'
import { useMemo } from 'react'
import { Address, erc20Abi, formatUnits } from 'viem'
import { useReadContracts } from 'wagmi'
import { BALANCER_V3_CONTRACTS, isBalV3SupportedChain } from './balv3.constants'
import { PoolMigration } from './getPoolMigrations'

export type MigratableBalV3Position = {
  migration: PoolMigration
  walletBptBalance: bigint
  stakedBptBalance: bigint
  totalBptBalance: bigint
  estimatedUsdValue: number
}

type MulticallEntry = {
  migration: PoolMigration
  walletIndex: number
  gaugeIndex?: number
  totalSupplyIndex: number
  tokenInfoIndex: number
}

type PoolTokenInfoTuple = readonly [
  readonly Address[],
  readonly unknown[],
  readonly bigint[],
  readonly bigint[],
]

type ContractReadConfig =
  | {
      chainId: number
      abi: typeof erc20Abi
      address: Address
      functionName: 'balanceOf'
      args: readonly [Address]
    }
  | {
      chainId: number
      abi: typeof erc20Abi
      address: Address
      functionName: 'totalSupply'
    }
  | {
      chainId: number
      abi: typeof vaultExtensionAbi_V3
      address: Address
      functionName: 'getPoolTokenInfo'
      args: readonly [Address]
    }

export function useBalV3MigratablePositions(poolMigrations: PoolMigration[]) {
  const { userAddress, isConnected } = useUserAccount()
  const { usdValueForTokenAddress } = useTokens()

  const supportedMigrations = useMemo(
    () =>
      poolMigrations.filter(
        migration => migration.old.protocol === 3 && isBalV3SupportedChain(migration.old.chainId)
      ),
    [poolMigrations]
  )

  const isEnabled = isConnected && Boolean(userAddress) && supportedMigrations.length > 0

  const { contracts, entries } = useMemo(() => {
    if (!isEnabled || !userAddress) {
      return { contracts: [] as ContractReadConfig[], entries: [] as MulticallEntry[] }
    }

    const builtContracts: ContractReadConfig[] = []
    const builtEntries: MulticallEntry[] = []

    for (const migration of supportedMigrations) {
      const chainId = migration.old.chainId

      if (!isBalV3SupportedChain(chainId)) continue

      const walletIndex = builtContracts.length

      builtContracts.push({
        chainId,
        abi: erc20Abi,
        address: migration.old.id,
        functionName: 'balanceOf',
        args: [userAddress],
      })

      let gaugeIndex: number | undefined

      if (migration.old.gaugeAddress) {
        gaugeIndex = builtContracts.length

        builtContracts.push({
          chainId,
          abi: erc20Abi,
          address: migration.old.gaugeAddress,
          functionName: 'balanceOf',
          args: [userAddress],
        })
      }

      const totalSupplyIndex = builtContracts.length

      builtContracts.push({
        chainId,
        abi: erc20Abi,
        address: migration.old.id,
        functionName: 'totalSupply',
      })

      const tokenInfoIndex = builtContracts.length

      builtContracts.push({
        chainId,
        abi: vaultExtensionAbi_V3,
        address: BALANCER_V3_CONTRACTS[chainId].vault,
        functionName: 'getPoolTokenInfo',
        args: [migration.old.id],
      })

      builtEntries.push({
        migration,
        walletIndex,
        gaugeIndex,
        totalSupplyIndex,
        tokenInfoIndex,
      })
    }

    return { contracts: builtContracts, entries: builtEntries }
  }, [isEnabled, supportedMigrations, userAddress])

  const { data, isLoading, refetch } = useReadContracts({
    query: {
      enabled: isEnabled && contracts.length > 0,
    },
    allowFailure: true,
    contracts,
  })

  const migratablePositions = useMemo<MigratableBalV3Position[]>(() => {
    if (!isEnabled || !data || entries.length === 0) return []

    const positions: MigratableBalV3Position[] = []

    for (const entry of entries) {
      const walletBptBalance = readBigintResult(data[entry.walletIndex])

      const stakedBptBalance =
        entry.gaugeIndex !== undefined ? readBigintResult(data[entry.gaugeIndex]) : 0n

      const totalBptBalance = walletBptBalance + stakedBptBalance

      if (totalBptBalance <= 0n) continue

      const totalSupply = readBigintResult(data[entry.totalSupplyIndex])
      const tokenInfo = readTokenInfoResult(data[entry.tokenInfoIndex])

      const estimatedUsdValue = estimatePositionUsdValue({
        migration: entry.migration,
        totalBptBalance,
        totalSupply,
        tokenInfo,
        usdValueForTokenAddress,
      })

      positions.push({
        migration: entry.migration,
        walletBptBalance,
        stakedBptBalance,
        totalBptBalance,
        estimatedUsdValue,
      })
    }

    return positions
  }, [data, entries, isEnabled, usdValueForTokenAddress])

  return {
    migratablePositions,
    hasMigratablePositions: migratablePositions.length > 0,
    isLoading: isEnabled ? isLoading : false,
    refetch,
  }
}

function readBigintResult(item: { status: string; result?: unknown } | undefined): bigint {
  if (item?.status !== 'success' || typeof item.result !== 'bigint') return 0n
  return item.result
}

function readTokenInfoResult(
  item: { status: string; result?: unknown } | undefined
): PoolTokenInfoTuple | undefined {
  if (item?.status !== 'success' || !Array.isArray(item.result)) return undefined
  const [tokens, tokenInfo, balancesRaw, lastBalancesLiveScaled18] = item.result

  if (!Array.isArray(tokens) || !Array.isArray(balancesRaw)) return undefined

  return [
    tokens as readonly Address[],
    Array.isArray(tokenInfo) ? tokenInfo : [],
    balancesRaw as readonly bigint[],
    Array.isArray(lastBalancesLiveScaled18) ? (lastBalancesLiveScaled18 as readonly bigint[]) : [],
  ]
}

function estimatePositionUsdValue({
  migration,
  totalBptBalance,
  totalSupply,
  tokenInfo,
  usdValueForTokenAddress,
}: {
  migration: PoolMigration
  totalBptBalance: bigint
  totalSupply: bigint
  tokenInfo: PoolTokenInfoTuple | undefined
  usdValueForTokenAddress: ReturnType<typeof useTokens>['usdValueForTokenAddress']
}): number {
  if (!tokenInfo || totalSupply <= 0n) return 0

  try {
    const gqlChain = getGqlChain(migration.old.chainId as SupportedChainId)
    const [onchainTokens, , balancesRaw] = tokenInfo
    let totalUsd = 0

    for (let i = 0; i < onchainTokens.length; i++) {
      const tokenAddress = onchainTokens[i]
      const poolBalance = balancesRaw[i]

      if (!tokenAddress || typeof poolBalance !== 'bigint' || poolBalance <= 0n) continue

      const tokenMeta = migration.old.tokens.find(token =>
        isSameAddress(token.address, tokenAddress)
      )

      const decimals = tokenMeta?.decimals ?? 18
      const proRataBalance = (totalBptBalance * poolBalance) / totalSupply

      if (proRataBalance <= 0n) continue

      const humanAmount = formatUnits(proRataBalance, decimals)
      const directUsd = parseUsdValue(usdValueForTokenAddress(tokenAddress, gqlChain, humanAmount))

      if (directUsd > 0) {
        totalUsd += directUsd
      } else if (tokenMeta?.underlyingToken?.address) {
        const underlyingUsd = parseUsdValue(
          usdValueForTokenAddress(tokenMeta.underlyingToken.address, gqlChain, humanAmount)
        )

        totalUsd += underlyingUsd
      }
    }

    return totalUsd
  } catch {
    // Valuation must never hide or drop a funded position
    return 0
  }
}

function parseUsdValue(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}
