import { PoolCore } from '@repo/lib/modules/pool/pool.types'
import { Box, HStack, Text } from '@chakra-ui/react'
import { PoolVersionTag } from '@repo/lib/modules/pool/PoolList/PoolListTable/PoolVersionTag'
import { isBoosted, isGyro } from '@repo/lib/modules/pool/pool.helpers'
import { getPoolTypeLabel } from '@repo/lib/modules/pool/pool.utils'
import Image from 'next/image'
import { PoolHookTag } from '@repo/lib/modules/pool/PoolDetail/PoolHookTag'
import { useHook } from '../../../hooks/useHook'
import { usePoolsMetadata } from '../../metadata/PoolsMetadataProvider'
import { Erc4626Metadata } from '../../metadata/getErc4626Metadata'
import { Protocol } from '@repo/lib/modules/protocols/useProtocols'
import { ProtocolIcon } from '@repo/lib/shared/components/icons/ProtocolIcon'
import { BoostedIcon } from '@repo/lib/shared/components/icons/BoostedIcon'
import { TooltipWithTouch } from '@repo/lib/shared/components/tooltips/TooltipWithTouch'

function getPoolDisplayTypeLabel(pool: PoolCore, erc4626Metadata: Erc4626Metadata[]) {
  const boostedTooltipLabel = [...erc4626Metadata.map(m => m.name)].join(' & ')
  const hasIconTags = isGyro(pool.type) || isBoosted(pool)

  return (
    <HStack>
      <Text fontWeight="medium" textAlign="left">
        {getPoolTypeLabel(pool.type)}
      </Text>

      {hasIconTags && (
        <HStack gap="0.25rem">
          {isGyro(pool.type) && (
            <TooltipWithTouch label="Built by Gyroscope">
              <Box h="18px" rounded="full" shadow="md" w="18px">
                <ProtocolIcon
                  protocol={Protocol.Gyro}
                  size={18}
                  sx={{ rounded: 'full', shadow: 'md' }}
                />
              </Box>
            </TooltipWithTouch>
          )}

          {isBoosted(pool) && (
            <>
              {isGyro(pool.type) && (
                <Text color="border.base" fontSize="0.5rem">
                  •
                </Text>
              )}
              <TooltipWithTouch label={boostedTooltipLabel}>
                <HStack gap="0.25rem">
                  <Box rounded="full" shadow="md">
                    <BoostedIcon size={18} />
                  </Box>
                  {erc4626Metadata.map(metadata => (
                    <Box key={metadata.name} rounded="full" shadow="md">
                      <Image
                        alt={metadata.name}
                        height={18}
                        src={metadata.iconUrl || ''}
                        width={18}
                      />
                    </Box>
                  ))}
                </HStack>
              </TooltipWithTouch>
            </>
          )}
        </HStack>
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
