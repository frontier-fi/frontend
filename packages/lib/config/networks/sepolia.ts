import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { NetworkConfig } from '../config.types'
import { convertHexToLowerCase } from '@repo/lib/shared/utils/objects'
import { AddressProvider, ChainId, PERMIT2 } from '@frontier-fi/sdk'
import { zeroAddress } from 'viem'
import { sepolia } from 'viem/chains'

const chainId = ChainId.SEPOLIA

const networkConfig: NetworkConfig = {
  chainId: sepolia.id,
  name: 'Ethereum Testnet Sepolia',
  shortName: 'Sepolia',
  chain: GqlChainValues.Sepolia,
  isTestnet: true,
  iconPath: '/images/chains/SEPOLIA.svg',
  blockExplorer: {
    baseUrl: 'https://sepolia.etherscan.io',
    name: 'Etherscan',
  },
  tokens: {
    addresses: {
      bal: '0xb19382073c7a0addbb56ac6af1808fa49e377b75',
      wNativeAsset: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    },
    nativeAsset: {
      name: 'Ether',
      address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      symbol: 'ETH',
      decimals: 18,
    },
    doubleApprovalRequired: [
      '0x6bf294b80c7d8dc72dee762af5d01260b756a051', // USDT
    ],
    defaultSwapTokens: {
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    },
  },
  contracts: {
    multicall2: '0xca11bde05977b3631167028862be2a173976ca11',
    balancer: {
      // Same pattern as other networks: SDK AddressProvider (Frontier Sepolia on frontier-fi/sdk).
      vaultV2: zeroAddress,
      vaultV3: AddressProvider.Vault(chainId),
      router: AddressProvider.Router(chainId),
      batchRouter: AddressProvider.BatchRouter(chainId),
      compositeLiquidityRouterBoosted: AddressProvider.CompositeLiquidityRouter(chainId),
      relayerV6: zeroAddress,
      minter: zeroAddress,
      vaultAdminV3: AddressProvider.VaultAdmin(chainId),
      bCoWFactory: undefined,
    },
    permit2: PERMIT2[chainId],
  },
  pools: convertHexToLowerCase({
    issues: {},
    supportsNestedActions: false,
    disallowNestedActions: [],
  }),
  layerZeroChainId: 10161,
  lbps: {
    collateralTokens: [
      '0xfff9976782d46cc05630d1f6ebab18b2324d6b14', // WETH
      '0x6bf294b80c7d8dc72dee762af5d01260b756a051', // USDT
      '0x80d6d3946ed8a1da4e226aa21ccddc32bd127d1a', // USDC
    ],
  },
}

export default networkConfig
