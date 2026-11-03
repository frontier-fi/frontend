import { useQuery } from '@apollo/client/react'
import { GetProtocolStatsPerChainDocument } from '../services/api/generated/graphql'
import { GqlChainValues } from '../services/api/graphql-enums'
import { secondsToMilliseconds } from 'date-fns'

export function useApiHealth() {
  const { error } = useQuery(GetProtocolStatsPerChainDocument, {
    variables: {
      chain: GqlChainValues.Sepolia,
    },
    pollInterval: secondsToMilliseconds(15),
  })

  return {
    apiOK: !error,
  }
}
