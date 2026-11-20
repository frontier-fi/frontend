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
import { compact } from 'lodash'
import { getNetworkConfig } from '@repo/lib/config/app.config'
import { getBlockExplorerAddressUrl } from '@repo/lib/shared/utils/blockExplorer'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { Pool } from '../../../pool.types'

type FormattedPoolAttributes = {
  title: string
  value: string
  link?: string
}

export function getPoolTypeText(pool: Pick<Pool, 'type'> & { version?: number }) {
  if (isGyro(pool.type)) {
    return 'Concentrated (Gyroscope Elliptic CLP)'
  }

  const label = getPoolTypeLabel(pool.type)
  return pool.version ? `${label} (V${pool.version})` : label
}

export function getRehypothecatedText(
  pool: Pick<Pool, 'protocolVersion' | 'tags'>,
  erc4626Metadata: Erc4626Metadata[]
) {
  if (!isBoosted(pool)) {
    return 'No'
  }

  const protocolNames = erc4626Metadata
    .map(metadata => getErc4626ProtocolName(metadata))
    .filter(Boolean)

  if (protocolNames.length > 0) {
    return [...new Set(protocolNames)].join(', ')
  }

  const tagProtocols = (pool.tags ?? [])
    .filter((tag): tag is string => !!tag && /^boosted_/i.test(tag))
    .map(tag => {
      const name = tag.replace(/^boosted_/i, '')
      return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
    })

  return tagProtocols.length > 0 ? [...new Set(tagProtocols)].join(', ') : 'Yes'
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
        value: getRehypothecatedText(pool, erc4626Metadata),
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
