import { PoolCore } from '@repo/lib/modules/pool/pool.types'
import { Box, HStack, Text } from '@chakra-ui/react'
import { PoolVersionTag } from '@repo/lib/modules/pool/PoolList/PoolListTable/PoolVersionTag'
import { isBoosted, toRehypeLabel } from '@repo/lib/modules/pool/pool.helpers'
import { getPoolTypeLabel } from '@repo/lib/modules/pool/pool.utils'
import Image from 'next/image'
import { PoolHookTag } from '@repo/lib/modules/pool/PoolDetail/PoolHookTag'
import { useHook } from '../../../hooks/useHook'
import { usePoolsMetadata } from '../../metadata/PoolsMetadataProvider'
import { Erc4626Metadata } from '../../metadata/getErc4626Metadata'
import { TooltipWithTouch } from '@repo/lib/shared/components/tooltips/TooltipWithTouch'
import { RehypeTag } from '@repo/lib/modules/pool/PoolDetail/RehypeTag'

function getPoolDisplayTypeLabel(pool: PoolCore, erc4626Metadata: Erc4626Metadata[]) {
  const rehypeTooltipLabel = [...erc4626Metadata.map(m => toRehypeLabel(m.name))].join(' & ')

  return (
    <HStack>
      <Text fontWeight="medium" textAlign="left">
        {getPoolTypeLabel(pool.type)}
      </Text>

      {isBoosted(pool) && (
        <TooltipWithTouch label={rehypeTooltipLabel}>
          <HStack flexShrink={0} gap="0.25rem">
            <Box flexShrink={0}>
              <RehypeTag size="sm" />
            </Box>
            {erc4626Metadata.map(metadata => (
              <Box
                flexShrink={0}
                h="18px"
                key={metadata.name}
                overflow="hidden"
                rounded="full"
                shadow="md"
                w="18px"
              >
                <Image
                  alt={toRehypeLabel(metadata.name)}
                  height={18}
                  src={metadata.iconUrl || ''}
                  style={{ width: 18, height: 18 }}
                  width={18}
                />
              </Box>
            ))}
          </HStack>
        </TooltipWithTouch>
      )}
    </HStack>
  )
}

interface Props {
  pool: PoolCore
}

export function PoolListTableDetailsCell({ pool }: Props) {
  const { getErc4626Metadata } = usePoolsMetadata()
  const { hasHook } = useHook(pool)

  const erc4626Metadata = getErc4626Metadata(pool)

  return (
    <HStack gap="0.25rem">
      <Box pr="0.1875rem">
        <PoolVersionTag isSmall pool={pool} />
      </Box>
      {getPoolDisplayTypeLabel(pool, erc4626Metadata)}
      {hasHook && (
        <HStack gap="0.25rem">
          <Text color="border.base" fontSize="0.5rem">
            •
          </Text>
          <PoolHookTag onlyShowIcon pool={pool} />
        </HStack>
      )}
    </HStack>
  )
}
