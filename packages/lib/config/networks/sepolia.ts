import '@repo/lib/config/frontier/addresses'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { NetworkConfig } from '../config.types'
import { convertHexToLowerCase } from '@repo/lib/shared/utils/objects'
import { AddressProvider, ChainId, PERMIT2 } from '@balancer/sdk'
import { sepolia } from 'viem/chains'

const chainId = ChainId.SEPOLIA

const networkConfig: NetworkConfig = {
  chainId: sepolia.id,
  name: 'Ethereum Testnet Sepolia',
  shortName: 'Sepolia',
  chain: GqlChainValues.Sepolia,
  iconPath: '/images/chains/SEPOLIA.svg',
  blockExplorer: {
    baseUrl: 'https://sepolia.etherscan.io',
    name: 'Etherscan',
  },
  tokens: {
    addresses: {
      bal: '0xb19382073c7a0addbb56ac6af1808fa49e377b75',
      wNativeAsset: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
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
      vaultV2: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
      vaultV3: AddressProvider.Vault(chainId),
      router: AddressProvider.Router(chainId),
      batchRouter: AddressProvider.BatchRouter(chainId),
      compositeLiquidityRouterBoosted: AddressProvider.CompositeLiquidityRouter(chainId),
      relayerV6: '0x7852fB9d0895e6e8b3EedA553c03F6e2F9124dF9',
      minter: '0x1783Cd84b3d01854A96B4eD5843753C2CcbD574A',
      vaultAdminV3: AddressProvider.VaultAdmin(chainId),
      // Not deployed on Frontier Sepolia (AddressProvider throws if called).
      unbalancedAddViaSwapRouter: undefined,
      bCoWFactory: undefined,
    },
    permit2: PERMIT2[chainId],
  },
  pools: convertHexToLowerCase({
    issues: {},
    disallowNestedActions: [],
  }),
  layerZeroChainId: 10161,
  lbps: {
    collateralTokens: [
      '0x7b79995e5f793a07bc00c21412e50ecae098e7f9', // WETH
      '0x6bf294b80c7d8dc72dee762af5d01260b756a051', // USDT
      '0x80d6d3946ed8a1da4e226aa21ccddc32bd127d1a', // USDC
    ],
  },
}

export default networkConfig
