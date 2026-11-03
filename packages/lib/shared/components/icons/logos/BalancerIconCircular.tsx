import { Image } from '@chakra-ui/react'

const FF_LOGO_SRC = '/images/icons/0xff.png'

export function BalancerIconCircular({ size = 28 }: { size?: number }) {
  return (
    <Image
      alt="Frontier Finance"
      borderRadius="full"
      h={`${size}px`}
      objectFit="cover"
      src={FF_LOGO_SRC}
      w={`${size}px`}
    />
  )
}
