import { isDev, isStaging } from '@repo/lib/config/app.config'
import { DefaultPageContainer } from '@repo/lib/shared/components/containers/DefaultPageContainer'
import { notFound } from 'next/navigation'
import { PropsWithChildren } from 'react'

export default function DebugLayout({ children }: PropsWithChildren) {
  if (!isDev && !isStaging) {
    notFound()
  }

  return (
    <DefaultPageContainer maxW="90%" width="90%">
      {children}
    </DefaultPageContainer>
  )
}
