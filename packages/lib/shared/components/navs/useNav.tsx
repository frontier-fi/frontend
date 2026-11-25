import { usePathname } from 'next/navigation'
import { useParams } from 'next/navigation'
import { ReactNode } from 'react'
import { IconType } from './SocialIcon'

export type AppLink = {
  href?: string
  label?: string
  icon?: ReactNode
  isExternal?: boolean
  iconType?: IconType
  onClick?: () => void
}

export function useNav() {
  const pathname = usePathname()
  const { chain } = useParams()
  const swapHref = chain ? '/swap/' + chain : '/swap'

  const defaultAppLinks: AppLink[] = [
    {
      href: '/pools',
      label: 'Pools',
    },
    {
      href: swapHref,
      label: 'Swap',
    },
    {
      href: '/portfolio',
      label: 'Portfolio',
    },
    {
      href: '/create',
      label: 'Create',
    },
    {
      href: '/migrate',
      label: 'Migrate',
    },
  ]

  function linkColorFor(path: string) {
    if (path === '/create' && pathname.startsWith('/create')) {
      return 'font.highlight'
    }

    if (
      path === '/migrate' &&
      (pathname.startsWith('/migrate') || pathname.endsWith('/migrate-pool'))
    ) {
      return 'font.highlight'
    }

    return pathname === path ? 'font.highlight' : 'font.primary'
  }

  return { defaultAppLinks, linkColorFor }
}
