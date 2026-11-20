import { ExactInQueryOutput, ExactOutQueryOutput } from '@frontier-fi/sdk'
import mainnetNetworkConfig from '@repo/lib/config/networks/mainnet'
import sepoliaNetworkConfig from '@repo/lib/config/networks/sepolia'
import { GqlChainValues, GqlSorSwapTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import { defaultTestUserAccount, isChainSupported } from '@repo/test/anvil/anvil-setup'
import { apolloTestClient } from '@repo/test/utils/apollo-test-client'
import { SwapTokenInput } from '../swap.types'
import { DefaultSwapHandler } from './DefaultSwap.handler'

const SWAP_SIMULATION_TEST_TIMEOUT_MS = 120_000

describe.runIf(isChainSupported(GqlChainValues.Sepolia))(
  'Pool Swap handler with Sepolia v3 pool',
  () => {
    const sepoliaV3PoolId = '0x4898409f170de235844822a9545a54dbe637c049'
    const usdcAaveAddress = '0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8' as const
    const daiAaveAddress = '0xff34b3d4aee8ddcd6f9afffb6fe49bd371b8a357' as const
    const handler = new DefaultSwapHandler(apolloTestClient)

    it(
      'simulates exact in swap on Sepolia v3',
      async () => {
        const result = await handler.simulate({
          chain: GqlChainValues.Sepolia,
          swapType: GqlSorSwapTypeValues.ExactIn,
          swapAmount: '1',
          tokenIn: usdcAaveAddress,
          tokenOut: daiAaveAddress,
          poolIds: [sepoliaV3PoolId],
        })

        expect(result.hopCount).toBeGreaterThan(0)
        expect(result.protocolVersion).toBe(3)

        const queryOutput = result.queryOutput as ExactInQueryOutput
        expect(queryOutput.amountIn.token.address).toBe(usdcAaveAddress)
        expect(queryOutput.amountIn.amount).toBe(1000000n)
        expect(queryOutput.expectedAmountOut.token.address).toBe(daiAaveAddress)
        expect(queryOutput.expectedAmountOut.amount).toBeGreaterThan(0n)
      },
      SWAP_SIMULATION_TEST_TIMEOUT_MS
    )

    it(
      'builds exact in swap on Sepolia v3',
      async () => {
        const result = await handler.simulate({
          chain: GqlChainValues.Sepolia,
          swapType: GqlSorSwapTypeValues.ExactIn,
          swapAmount: '1',
          tokenIn: usdcAaveAddress,
          tokenOut: daiAaveAddress,
          poolIds: [sepoliaV3PoolId],
        })

        const tokenIn: SwapTokenInput = {
          address: usdcAaveAddress,
          amount: '1',
          scaledAmount: 1000000n,
        }

        const tokenOut: SwapTokenInput = {
          address: daiAaveAddress,
          amount: '1',
          scaledAmount: 1000000000000000000n,
        }

        const txConfig = handler.build({
          simulateResponse: result,
          swapType: GqlSorSwapTypeValues.ExactIn,
          tokenIn,
          tokenOut,
          account: defaultTestUserAccount,
          selectedChain: GqlChainValues.Sepolia,
          slippagePercent: '0.2',
          wethIsEth: false,
        })

        expect(txConfig.account).toBe(defaultTestUserAccount)
        expect(txConfig.to).toBe(sepoliaNetworkConfig.contracts.balancer.router)
      },
      SWAP_SIMULATION_TEST_TIMEOUT_MS
    )

    it(
      'simulates exact out swap on Sepolia v3',
      async () => {
        const result = await handler.simulate({
          chain: GqlChainValues.Sepolia,
          swapType: GqlSorSwapTypeValues.ExactOut,
          swapAmount: '1',
          tokenIn: usdcAaveAddress,
          tokenOut: daiAaveAddress,
          poolIds: [sepoliaV3PoolId],
        })

        expect(result.hopCount).toBeGreaterThan(0)
        expect(result.protocolVersion).toBe(3)

        const queryOutput = result.queryOutput as ExactOutQueryOutput
        expect(queryOutput.amountOut.token.address).toBe(daiAaveAddress)
        expect(queryOutput.amountOut.amount).toBe(1000000000000000000n)
        expect(queryOutput.expectedAmountIn.token.address).toBe(usdcAaveAddress)
        expect(queryOutput.expectedAmountIn.amount).toBeGreaterThan(0n)
      },
      SWAP_SIMULATION_TEST_TIMEOUT_MS
    )
  }
)

describe.runIf(isChainSupported(GqlChainValues.Mainnet))(
  'Pool Swap handler with Mainnet v3 pool',
  () => {
    const mainnetV3PoolId = '0xbe4f51b275f3d4d6a0130988be79b25523549c7a' // 0xFF-50WBTC-50WETH
    const wethAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' as const
    const wbtcAddress = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599' as const
    const handler = new DefaultSwapHandler(apolloTestClient)

    it(
      'simulates exact in swap on Mainnet v3',
      async () => {
        const result = await handler.simulate({
          chain: GqlChainValues.Mainnet,
          swapType: GqlSorSwapTypeValues.ExactIn,
          swapAmount: '0.001',
          tokenIn: wethAddress,
          tokenOut: wbtcAddress,
          poolIds: [mainnetV3PoolId],
        })

        expect(result.hopCount).toBeGreaterThan(0)
        expect(result.protocolVersion).toBe(3)

        const queryOutput = result.queryOutput as ExactInQueryOutput
        expect(queryOutput.amountIn.token.address).toBe(wethAddress)
        expect(queryOutput.amountIn.amount).toBe(1000000000000000n)
        expect(queryOutput.expectedAmountOut.token.address).toBe(wbtcAddress)
        expect(queryOutput.expectedAmountOut.amount).toBeGreaterThan(0n)
      },
      SWAP_SIMULATION_TEST_TIMEOUT_MS
    )

    it(
      'builds exact in swap on Mainnet v3',
      async () => {
        const result = await handler.simulate({
          chain: GqlChainValues.Mainnet,
          swapType: GqlSorSwapTypeValues.ExactIn,
          swapAmount: '0.001',
          tokenIn: wethAddress,
          tokenOut: wbtcAddress,
          poolIds: [mainnetV3PoolId],
        })

        const tokenIn: SwapTokenInput = {
          address: wethAddress,
          amount: '0.001',
          scaledAmount: 1000000000000000n,
        }

        const tokenOut: SwapTokenInput = {
          address: wbtcAddress,
          amount: '0.00001',
          scaledAmount: 1000n,
        }

        const txConfig = handler.build({
          simulateResponse: result,
          swapType: GqlSorSwapTypeValues.ExactIn,
          tokenIn,
          tokenOut,
          account: defaultTestUserAccount,
          selectedChain: GqlChainValues.Mainnet,
          slippagePercent: '0.2',
          wethIsEth: false,
        })

        expect(txConfig.account).toBe(defaultTestUserAccount)
        expect(txConfig.to).toBe(mainnetNetworkConfig.contracts.balancer.router)
      },
      SWAP_SIMULATION_TEST_TIMEOUT_MS
    )

    it(
      'simulates exact out swap on Mainnet v3',
      async () => {
        const result = await handler.simulate({
          chain: GqlChainValues.Mainnet,
          swapType: GqlSorSwapTypeValues.ExactOut,
          swapAmount: '0.00001',
          tokenIn: wethAddress,
          tokenOut: wbtcAddress,
          poolIds: [mainnetV3PoolId],
        })

        expect(result.hopCount).toBeGreaterThan(0)
        expect(result.protocolVersion).toBe(3)

        const queryOutput = result.queryOutput as ExactOutQueryOutput
        expect(queryOutput.amountOut.token.address).toBe(wbtcAddress)
        expect(queryOutput.amountOut.amount).toBe(1000n)
        expect(queryOutput.expectedAmountIn.token.address).toBe(wethAddress)
        expect(queryOutput.expectedAmountIn.amount).toBeGreaterThan(0n)
      },
      SWAP_SIMULATION_TEST_TIMEOUT_MS
    )
  }
)
