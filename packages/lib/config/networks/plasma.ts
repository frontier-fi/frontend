import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { NetworkConfig } from '../config.types'
import { convertHexToLowerCase } from '@repo/lib/shared/utils/objects'
import { CSP_ISSUE_POOL_IDS } from '@repo/lib/shared/data/csp-issue'
import { PoolIssue } from '@repo/lib/modules/pool/alerts/pool-issues/PoolIssue.type'
import { zeroAddress } from 'viem'
import { plasma } from 'viem/chains'

const nativeAssetAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as const
const wXplAddress = '0x6100e367285b01f48d07953803a2d8dca5d19873' as const

const networkConfig: NetworkConfig = {
  chainId: plasma.id,
  name: plasma.name,
  shortName: plasma.name,
  chain: GqlChainValues.Plasma,
  iconPath: '/images/chains/PLASMA.svg',
  blockExplorer: {
    baseUrl: plasma.blockExplorers.default.url,
    name: plasma.blockExplorers.default.name,
  },
  tokens: {
    addresses: {
      bal: zeroAddress,
      wNativeAsset: wXplAddress,
    },
    nativeAsset: {
      name: plasma.nativeCurrency.name,
      address: nativeAssetAddress,
      symbol: plasma.nativeCurrency.symbol,
      decimals: plasma.nativeCurrency.decimals,
    },
    defaultSwapTokens: {
      tokenIn: nativeAssetAddress,
    },
    popularTokens: {
      [nativeAssetAddress]: plasma.nativeCurrency.symbol,
      [wXplAddress]: `W${plasma.nativeCurrency.symbol}`,
      '0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb': 'USDT0',
      '0x9895d81bb462a195b4922ed7de0e3acd007c32cb': 'WETH',
    },
  },
  contracts: {
    multicall2: zeroAddress,
    multicall3: '0xca11bde05977b3631167028862be2a173976ca11',
    balancer: {
      vaultV2: '0xba12222222228d8ba445958a75a0704d566bf2c8',
      relayerV6: zeroAddress,
      minter: zeroAddress,
    },
  },
  pools: convertHexToLowerCase({
    issues: { [PoolIssue.CspPoolVulnWarning]: CSP_ISSUE_POOL_IDS[GqlChainValues.Plasma] },
  }),
  supportsVeBalSync: false,
}

export default networkConfig
