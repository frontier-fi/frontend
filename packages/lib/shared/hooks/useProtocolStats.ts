import { useQuery } from '@apollo/client/react'
import { useSupportedNetworks } from '@repo/lib/modules/chains/useSupportedNetworks'
import { GetProtocolStatsDocument } from '../services/api/generated/graphql'

export function useProtocolStats() {
  const supportedNetworks = useSupportedNetworks()

  const statQuery = useQuery(GetProtocolStatsDocument, {
    variables: {
      chains: supportedNetworks,
    },
  })

  return {
    statQuery,
  }
}
