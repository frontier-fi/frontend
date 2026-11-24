import { Box, Card, Stack, Heading, Text, VStack, Divider, HStack, Link } from '@chakra-ui/react'
import { useFormattedPoolAttributes } from './useFormattedPoolAttributes'
import { ArrowUpRight } from 'lucide-react'
import { isGyroEPool } from '../../../pool.helpers'
import { usePool } from '../../../PoolProvider'
import { ClpPoolAttributes } from './ClpPoolAttributes'

export function PoolAttributes() {
  const { pool } = usePool()
  const formattedAttributes = useFormattedPoolAttributes()

  return (
    <Card>
      <VStack alignItems="flex-start" spacing={{ base: 'sm', md: 'md' }} width="full">
        <Heading fontSize="1.25rem" variant="h4">
          Pool attributes
        </Heading>
        <Divider />
        <VStack width="full">
          {formattedAttributes.map(attribute => {
            const items = attribute.items

            return (
              <Stack
                direction={{ base: 'column', md: 'row' }}
                key={`pool-attribute-${attribute.title}`}
                spacing={{ base: 'xxs', md: 'xl' }}
                width="full"
              >
                <Box flexShrink={0} minWidth="160px">
                  <Text variant={{ base: 'primary', md: 'secondary' }}>{attribute.title}:</Text>
                </Box>
                {items && items.length > 0 ? (
                  <HStack flexWrap="wrap" gap="0" mb={{ base: 'sm', md: '0' }} rowGap="xxs">
                    {items.map((item, index) => (
                      <HStack gap="0" key={`${item.label}-${item.link ?? index}`}>
                        {item.link ? (
                          <Link
                            alignItems="center"
                            display="inline-flex"
                            gap="xxs"
                            href={item.link}
                            isExternal
                            variant="link"
                          >
                            <Text as="span" color="link">
                              {item.label}
                            </Text>
                            <ArrowUpRight size={12} />
                          </Link>
                        ) : (
                          <Text as="span" variant="secondary">
                            {item.label}
                          </Text>
                        )}
                        {index < items.length - 1 && (
                          <Text as="span" mr="xs" variant="secondary">
                            ,
                          </Text>
                        )}
                      </HStack>
                    ))}
                  </HStack>
                ) : attribute.link ? (
                  <Link href={attribute.link} isExternal variant="link">
                    <HStack gap="xxs">
                      <Text color="link">{attribute.value}</Text>
                      <ArrowUpRight size={12} />
                    </HStack>
                  </Link>
                ) : (
                  <Text
                    mb={{ base: 'sm', md: '0' }}
                    variant={{ base: 'secondary', md: 'secondary' }}
                  >
                    {attribute.value}
                  </Text>
                )}
              </Stack>
            )
          })}
        </VStack>

        {isGyroEPool(pool) && <ClpPoolAttributes pool={pool} />}
      </VStack>
    </Card>
  )
}
