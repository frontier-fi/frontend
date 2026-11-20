'use client'

import { fadeIn } from '@repo/lib/shared/utils/animations'
import { BalancerLogo } from '../imgs/BalancerLogo'
import { BalancerLogoType } from '../imgs/BalancerLogoType'
import { Box, HStack, Link, Text } from '@chakra-ui/react'
import { motion } from 'motion/react'
import NextLink from 'next/link'

export function NavLogo() {
  return (
    <Box as={motion.div} variants={fadeIn}>
      <Link as={NextLink} href="/pools" prefetch variant="nav">
        <HStack spacing="sm">
          <Box display={{ base: 'block', md: 'none' }}>
            <BalancerLogo width="32px" />
          </Box>
          <Box display={{ base: 'none', md: 'block' }}>
            <BalancerLogoType width="40px" />
          </Box>
          <Text
            color="font.maxContrast"
            fontSize={{ base: 'lg', md: 'xl' }}
            fontWeight="bold"
            letterSpacing="-0.02em"
            lineHeight="1"
          >
            Frontier
          </Text>
        </HStack>
      </Link>
    </Box>
  )
}
