import {
  fetchAndMapMetadata,
  lowerCaseAddresses,
} from '@repo/lib/shared/utils/fetchAndLowercaseAddresses'
import { Address } from 'viem'

// Set AGGREGATORS_METADATA_BASE_URL (e.g. http://localhost:4100/aggregators) to test a local metadata checkout
const AGGREGATORS_BASE_URL =
  process.env.AGGREGATORS_METADATA_BASE_URL?.replace(/\/$/, '') ||
  'https://raw.githubusercontent.com/frontier-fi/metadata/refs/heads/main/aggregators'

const AGGREGATORS_METADATA_URL = `${AGGREGATORS_BASE_URL}/index.json`
const AGGREGATORS_LOGO_BASE_URL = `${AGGREGATORS_BASE_URL}/images`

export type AggregatorMetadata = {
  id: string
  name: string
  logo: string
  logoUrl: string
  url?: string
  addresses: Record<string, Address[]> // chainId -> addresses[]
}

function withLogoUrl(metadata: AggregatorMetadata[]): AggregatorMetadata[] {
  return metadata.map(aggregator => ({
    ...aggregator,
    logoUrl: `${AGGREGATORS_LOGO_BASE_URL}/${aggregator.logo}`,
  }))
}

export async function getAggregatorsMetadata(): Promise<AggregatorMetadata[] | undefined> {
  return fetchAndMapMetadata<AggregatorMetadata>(AGGREGATORS_METADATA_URL, metadata =>
    withLogoUrl(lowerCaseAddresses(metadata))
  )
}
