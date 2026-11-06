import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { usePoolCreationForm } from '../PoolCreationFormProvider'
import { isCowProtocol, isBalancerProtocol } from '../helpers'
import type { GqlPoolType } from '@repo/lib/shared/services/api/generated/graphql'

interface UseProtocolSearchParams {
  poolType: GqlPoolType
}

export function useProtocolSearchParams({ poolType: _poolType }: UseProtocolSearchParams) {
  const { resetPoolCreationForm, isFirstStep } = usePoolCreationForm()
  const searchParams = useSearchParams()

  const protocolSearchParam = searchParams.get('protocol')

  const isProtocolParamCow = !!protocolSearchParam && isCowProtocol(protocolSearchParam)
  const isProtocolParamBalancer = !!protocolSearchParam && isBalancerProtocol(protocolSearchParam)

  // Cow AMM is not a Frontier pool type — never treat current form as CoW AMM
  const showCowAmmWarning = false
  const showBalancerWarning = false

  const shouldResetProtocol = (isProtocolParamCow || isProtocolParamBalancer) && isFirstStep

  const setupCowCreation = () => {
    resetPoolCreationForm()
  }

  useEffect(() => {
    if (shouldResetProtocol) {
      // setTimeout defers to next tick to ensure form is fully hydrated from localStorage,
      // otherwise form state fails to update when user navigating from another page that is not "/create"
      setTimeout(() => resetPoolCreationForm(), 0)
    }
  }, [shouldResetProtocol, resetPoolCreationForm])

  return { setupCowCreation, showCowAmmWarning, showBalancerWarning }
}
