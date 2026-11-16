import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { NetworkConfig } from '../config.types'
import { convertHexToLowerCase } from '@repo/lib/shared/utils/objects'
import { PoolIssue } from '@repo/lib/modules/pool/alerts/pool-issues/PoolIssue.type'
import { CSP_ISSUE_POOL_IDS } from '@repo/lib/shared/data/csp-issue'
import { zeroAddress } from 'viem'
import { hyperEvm } from 'viem/chains'

const networkConfig: NetworkConfig = {
  chainId: hyperEvm.id,
  name: hyperEvm.name,
  shortName: hyperEvm.name,
  chain: GqlChainValues.Hyperevm,
  iconPath: '/images/chains/HYPEREVM.svg',
  blockExplorer: {
    baseUrl: 'https://hyperevmscan.io/',
    name: 'Hyperscan',
  },
  tokens: {
    addresses: {
      bal: zeroAddress,
      wNativeAsset: '0x5555555555555555555555555555555555555555',
    },
    nativeAsset: {
      name: 'HYPE',
      address: '0x2222222222222222222222222222222222222222',
      symbol: 'HYPE',
      decimals: 18,
    },
    defaultSwapTokens: {
      tokenIn: '0x2222222222222222222222222222222222222222',
    },
    popularTokens: {
      '0x2222222222222222222222222222222222222222': 'HYPE',
      '0x0000000000000000000000000000000000000000': 'BAL',
      '0xbF2D3b1a37D54ce86d0e1455884dA875a97C87a8': 'USDt',
      '0x69f8AFbC9DE9fD819eC78eDc553488a6B4269938': 'USDC',
    },
  },
  contracts: {
    multicall2: zeroAddress,
    multicall3: hyperEvm.contracts.multicall3.address,
    balancer: {
      vaultV2: zeroAddress,
      relayerV6: zeroAddress,
      minter: zeroAddress,
    },
    veDelegationProxy: zeroAddress,
  },
  pools: convertHexToLowerCase({
    issues: {
      [PoolIssue.CspPoolVulnWarning]: CSP_ISSUE_POOL_IDS[GqlChainValues.Hyperevm],
      [PoolIssue.FxPoolVulnWarning]: [],
    },
  }),
  layerZeroChainId: 367,
  supportsVeBalSync: false,
  lbps: {
    collateralTokens: [
      '0x5555555555555555555555555555555555555555', // wHYPE
      '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb', // USDT
    ],
  },
}

export default networkConfig
