import { useQuery } from '@apollo/client/react'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { GetProtocolStatsPerChainDocument } from '../services/api/generated/graphql'
import { secondsToMilliseconds } from 'date-fns'

export function useApiHealth() {
  const { error } = useQuery(GetProtocolStatsPerChainDocument, {
    variables: {
      chain: PROJECT_CONFIG.defaultNetwork,
    },
    pollInterval: secondsToMilliseconds(15),
  })

  return {
    apiOK: !error,
  }
}
