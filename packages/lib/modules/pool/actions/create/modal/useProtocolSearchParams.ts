import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { usePoolCreationForm } from '../PoolCreationFormProvider'
import { isCowProtocol, isBalancerProtocol } from '../helpers'
import type { GqlPoolType } from '@repo/lib/shared/services/api/generated/graphql'
import { PoolType } from '@balancer/sdk'

interface UseProtocolSearchParams {
  poolType: GqlPoolType
}

export function useProtocolSearchParams({ poolType: _poolType }: UseProtocolSearchParams) {
  const { poolCreationForm, resetPoolCreationForm, isFirstStep } = usePoolCreationForm()
  const searchParams = useSearchParams()

  const protocolSearchParam = searchParams.get('protocol')

  const isProtocolParamCow = !!protocolSearchParam && isCowProtocol(protocolSearchParam)
  const isProtocolParamBalancer = !!protocolSearchParam && isBalancerProtocol(protocolSearchParam)

  // Cow AMM is not a Frontier pool type — never treat current form as CoW AMM
  const showCowAmmWarning = false
  const showBalancerWarning = false

  const shouldSwitchToCowProtocol = isProtocolParamCow && isFirstStep
  const shouldSwitchToBalancerProtocol = isProtocolParamBalancer && isFirstStep

  const setupCowCreation = () => {
    // Frontier has no CowAmm POOL_TYPES entry — fall back to Stable under CoW protocol label
    poolCreationForm.setValue('protocol', 'CoW')
    poolCreationForm.setValue('poolType', PoolType.Stable)
    poolCreationForm.trigger('protocol')
    poolCreationForm.trigger('poolType')
  }

  useEffect(() => {
    if (shouldSwitchToCowProtocol) {
      // setTimeout defers to next tick to ensure form is fully hydrated from localStorage,
      // otherwise form state fails to update when user navigating from another page that is not "/create"
      setTimeout(() => setupCowCreation(), 0)
    } else if (shouldSwitchToBalancerProtocol) {
      setTimeout(() => resetPoolCreationForm(), 0)
    }
  }, [shouldSwitchToCowProtocol, shouldSwitchToBalancerProtocol])

  return { setupCowCreation, showCowAmmWarning, showBalancerWarning }
}
