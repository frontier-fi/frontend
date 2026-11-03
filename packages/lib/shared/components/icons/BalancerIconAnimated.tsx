'use client'

import { Image } from '@chakra-ui/react'
import { motion } from 'motion/react'

const FF_LOGO_SRC = '/images/icons/0xff.png'

export function BalancerLogoAnimated({
  noShadow,
  size = 128,
}: {
  iconColor?: string
  noShadow?: boolean
  size?: number
}) {
  return (
    <motion.div
      animate={{ scale: [1, 1.03, 1] }}
      style={{
        filter: noShadow ? 'none' : 'drop-shadow(0 0 20px rgba(0, 0, 0, 0.3))',
        padding: '16px',
        borderRadius: '50%',
      }}
      transition={{
        duration: 2.6,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <Image
        alt="Frontier Finance"
        borderRadius="md"
        h={`${size}px`}
        objectFit="contain"
        src={FF_LOGO_SRC}
        w={`${size}px`}
      />
    </motion.div>
  )
}
