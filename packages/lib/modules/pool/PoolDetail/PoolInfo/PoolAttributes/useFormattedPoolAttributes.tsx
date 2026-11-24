'use client'

import { useMemo } from 'react'
import { usePool } from '../../../PoolProvider'
import { format } from 'date-fns'
import { zeroAddress } from 'viem'
import { abbreviateAddress, isSameAddress } from '@repo/lib/shared/utils/addresses'
import { fNum } from '@repo/lib/shared/utils/numbers'
import {
  isBoosted,
  isCowAmmPool,
  isGyro,
  isQuantAmmPool,
  isStable,
  isV2Pool,
  isV3Pool,
} from '../../../pool.helpers'
import { useCurrency } from '@repo/lib/shared/hooks/useCurrency'
import { getPoolTypeLabel, shouldHideSwapFee } from '../../../pool.utils'
import { useTokens } from '@repo/lib/modules/tokens/TokensProvider'
import { usePoolsMetadata } from '../../../metadata/PoolsMetadataProvider'
import { getErc4626ProtocolName, type Erc4626Metadata } from '../../../metadata/getErc4626Metadata'
import { getErc4626MarketUrl } from '../../../metadata/getErc4626MarketUrl'
import { compact, uniqBy } from 'lodash'
import { getChainId, getNetworkConfig } from '@repo/lib/config/app.config'
import { getBlockExplorerAddressUrl } from '@repo/lib/shared/utils/blockExplorer'
import { toSafeHttpsUrl } from '@repo/lib/shared/utils/strings'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { Pool } from '../../../pool.types'

export type PoolAttributeItem = {
  label: string
  link?: string
}

type FormattedPoolAttributes = {
  title: string
  value: string
  link?: string
  items?: PoolAttributeItem[]
}

export type RehypothecatedNestedTokenInput = {
  address: string
  symbol: string
  index?: number | null
  isErc4626?: boolean | null
  useUnderlyingForAddRemove?: boolean | null
  underlyingToken?: {
    address: string
    symbol: string
  } | null
}

export type RehypothecatedTokenInput = RehypothecatedNestedTokenInput & {
  hasNestedPool?: boolean | null
  nestedPool?: {
    tokens: readonly RehypothecatedNestedTokenInput[]
  } | null
}

export type RehypothecatedPoolInput = Pick<Pool, 'protocolVersion' | 'tags'> & {
  address?: string
  chain?: Pool['chain']
  poolTokens?: readonly RehypothecatedTokenInput[]
}

type PoolProtocolInfo = {
  id: string
  name: string
  readMoreURL?: string
}

function getFlattenedRehypothecatedTokens(
  pool: Pick<RehypothecatedPoolInput, 'address' | 'poolTokens'>
): RehypothecatedNestedTokenInput[] {
  if (!pool.poolTokens || pool.poolTokens.length === 0) return []

  const topLevelTokens = [...pool.poolTokens]
    .filter(token => !pool.address || !isSameAddress(token.address, pool.address))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))

  const flattened: RehypothecatedNestedTokenInput[] = []

  topLevelTokens.forEach(token => {
    if (token.hasNestedPool && token.nestedPool?.tokens) {
      const nestedTokens = [...token.nestedPool.tokens]
        .filter(nested => !isSameAddress(nested.address, token.address))
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))

      flattened.push(...nestedTokens)
    } else {
      flattened.push(token)
    }
  })

  return uniqBy(flattened, token => token.address.toLowerCase())
}

function getPoolProtocolInfos(
  pool: Pick<Pool, 'tags'>,
  erc4626Metadata: Erc4626Metadata[]
): PoolProtocolInfo[] {
  if (erc4626Metadata.length > 0) {
    return uniqBy(
      erc4626Metadata
        .map(metadata => ({
          id: metadata.id,
          name: getErc4626ProtocolName(metadata),
          readMoreURL: metadata.readMoreURL,
        }))
        .filter(protocol => Boolean(protocol.name)),
      protocol => protocol.id.toLowerCase()
    )
  }

  const tagProtocols = (pool.tags ?? [])
    .filter((tag): tag is string => !!tag && /^boosted_/i.test(tag))
    .map(tag => {
      const rawName = tag.replace(/^boosted_/i, '')

      return {
        id: tag.toLowerCase(),
        name: rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase(),
      }
    })

  return uniqBy(tagProtocols, protocol => protocol.id)
}

function buildTokenRehypothecatedItem(
  token: RehypothecatedNestedTokenInput,
  protocol: PoolProtocolInfo,
  chain?: Pool['chain']
): PoolAttributeItem {
  const assetSymbol = token.underlyingToken?.symbol || token.symbol
  const label = protocol.name ? `${assetSymbol} (${protocol.name})` : assetSymbol

  const link = chain
    ? getErc4626MarketUrl({
        protocolId: protocol.id,
        chain,
        vaultAddress: token.address,
        vaultSymbol: token.symbol,
        underlyingAddress: token.underlyingToken?.address,
        underlyingSymbol: token.underlyingToken?.symbol,
        readMoreURL: protocol.readMoreURL,
      })
    : toSafeHttpsUrl(protocol.readMoreURL)

  return { label, link }
}

export function getPoolTypeText(pool: Pick<Pool, 'type'> & { version?: number }) {
  if (isGyro(pool.type)) {
    return 'Concentrated (Gyroscope Elliptic CLP)'
  }

  const label = getPoolTypeLabel(pool.type)
  return pool.version ? `${label} (V${pool.version})` : label
}

export function getRehypothecatedItems(
  pool: RehypothecatedPoolInput,
  erc4626Metadata: Erc4626Metadata[]
): PoolAttributeItem[] {
  if (!isBoosted(pool)) {
    return []
  }

  const chainIdKey = pool.chain ? String(getChainId(pool.chain)) : undefined
  const poolProtocols = getPoolProtocolInfos(pool, erc4626Metadata)
  const flattenedTokens = getFlattenedRehypothecatedTokens(pool)
  const items: PoolAttributeItem[] = []

  flattenedTokens.forEach(token => {
    const matchedMetadata = chainIdKey
      ? erc4626Metadata.find(metadata =>
          metadata.addresses?.[chainIdKey]?.some(addr => isSameAddress(addr, token.address))
        )
      : undefined

    if (matchedMetadata) {
      items.push(
        buildTokenRehypothecatedItem(
          token,
          {
            id: matchedMetadata.id,
            name: getErc4626ProtocolName(matchedMetadata),
            readMoreURL: matchedMetadata.readMoreURL,
          },
          pool.chain
        )
      )

      return
    }

    if (token.isErc4626 && token.useUnderlyingForAddRemove) {
      const [soleProtocol] = poolProtocols

      if (poolProtocols.length === 1 && soleProtocol) {
        items.push(buildTokenRehypothecatedItem(token, soleProtocol, pool.chain))
      } else {
        items.push({ label: token.underlyingToken?.symbol || token.symbol })
      }
    }
  })

  if (items.length > 0) {
    return items
  }

  if (poolProtocols.length > 0) {
    return uniqBy(
      poolProtocols.map(protocol => ({
        label: protocol.name,
        link: toSafeHttpsUrl(protocol.readMoreURL),
      })),
      'label'
    )
  }

  return [{ label: 'Yes' }]
}

export function getRehypothecatedText(
  pool: RehypothecatedPoolInput,
  erc4626Metadata: Erc4626Metadata[]
) {
  const items = getRehypothecatedItems(pool, erc4626Metadata)
  return items.length > 0 ? items.map(item => item.label).join(', ') : 'No'
}

export function useFormattedPoolAttributes() {
  const { pool } = usePool()
  const { toCurrency } = useCurrency()
  const { usdValueForTokenAddress } = useTokens()
  const { getErc4626Metadata } = usePoolsMetadata()

  const isV2 = isV2Pool(pool)
  const isV3 = isV3Pool(pool)
  const delegateOwner = PROJECT_CONFIG.delegateOwner

  const poolOwnerData = useMemo(() => {
    if (!pool?.swapFeeManager) return
    const { swapFeeManager, chain } = pool

    // swapFeeManager replaces the deprecated owner field. Zero means immutable on v2
    // and governance on v3.
    const isImmutable =
      isCowAmmPool(pool.type) || (isSameAddress(swapFeeManager, zeroAddress) && isV2)

    const isGovernance =
      isSameAddress(swapFeeManager, delegateOwner) ||
      (isSameAddress(swapFeeManager, zeroAddress) && isV3)

    if (isImmutable) {
      return {
        title: 'No owner',
        link: '',
        editableText: 'non-editable',
        attributeImmutabilityText: '',
      }
    }

    if (isGovernance) {
      return {
        title: `Delegate ${isV2 ? 'owner' : 'manager'}`,
        link: '',
        editableText: 'editable by governance',
        attributeImmutabilityText: isStable(pool.type)
          ? ' except for swap fees and AMP factor editable by governance'
          : ' except for swap fees editable by governance',
      }
    }

    const editableBy = `editable by ${isV2 ? 'pool owner' : 'swap fee manager'}`

    return {
      title: abbreviateAddress(swapFeeManager),
      link: getBlockExplorerAddressUrl(swapFeeManager, chain),
      editableText: editableBy,
      attributeImmutabilityText: isStable(pool.type)
        ? ` except for swap fees and AMP factor ${editableBy}`
        : ` except for swap fees ${editableBy}`,
    }
  }, [pool, isV2, isV3, delegateOwner])

  const formattedPoolAttributes = useMemo((): FormattedPoolAttributes[] => {
    if (!pool) return []
    const { name, symbol, createTime, dynamicData, type, chain } = pool
    const networkConfig = getNetworkConfig(chain)

    const editNote = poolOwnerData?.editableText ? ` (${poolOwnerData.editableText})` : ''
    const erc4626Metadata = getErc4626Metadata(pool)
    const rehypothecatedItems = getRehypothecatedItems(pool, erc4626Metadata)

    const attributes = compact([
      {
        title: 'Name',
        value: name,
      },
      {
        title: 'Symbol',
        value: symbol,
      },
      {
        title: 'Type',
        value: getPoolTypeText(pool),
      },
      {
        title: 'Rehypothecated',
        value:
          rehypothecatedItems.length > 0
            ? rehypothecatedItems.map(item => item.label).join(', ')
            : 'No',
        items: rehypothecatedItems.length > 0 ? rehypothecatedItems : undefined,
      },
      {
        title: 'Protocol',
        value: isCowAmmPool(pool.type) ? 'CoW AMM' : 'Frontier Finance',
      },
      {
        title: 'Network',
        value: networkConfig.shortName,
      },
      {
        title: 'Swap fees',
        value: `${fNum('feePercent', dynamicData.swapFee, { hideSmallPercentage: false })}${editNote}`,
      },
      isStable(pool.type) && 'amp' in pool
        ? {
            title: 'AMP factor',
            value: `${fNum('integer', pool.amp)}${editNote}`,
          }
        : null,
      poolOwnerData
        ? {
            title: isV2 ? 'Pool owner' : 'Swap fee manager',
            value: poolOwnerData.title,
            link: poolOwnerData.link || undefined,
          }
        : null,
      {
        title: 'Attribute immutability',
        value: isQuantAmmPool(type)
          ? 'Immutable except for swap fees editable by governance, and dynamic weight shifts per smart contract.'
          : `Immutable${poolOwnerData?.attributeImmutabilityText ?? ''}`,
      },
      {
        title: 'Creation date',
        value: format(createTime * 1000, 'dd MMMM yyyy'),
      },
      {
        title: 'LP token price',
        value: toCurrency(usdValueForTokenAddress(pool.address, pool.chain, '1')),
      },
    ])

    if (shouldHideSwapFee(pool?.type)) {
      return attributes.filter(a => a?.title !== 'Swap fees')
    }

    return attributes
  }, [pool, poolOwnerData, isV2, toCurrency, usdValueForTokenAddress, getErc4626Metadata])

  return formattedPoolAttributes
}
