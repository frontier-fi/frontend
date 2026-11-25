import {
  ChainId,
  getBoostedPoolStateWithBalancesV3,
  Permit2Helper,
  PublicWalletClient,
  routerAbi_V3,
} from '@frontier-fi/sdk'
import { HumanTokenAmountWithSymbol } from '@repo/lib/modules/tokens/token.types'
import { isSameAddress } from '@repo/lib/shared/utils/addresses'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import {
  defaultAnvilTestPrivateKey,
  defaultTestUserAccount,
  getTestRpcSetup,
  isChainSupported,
} from '@repo/test/anvil/anvil-setup'
import { mainnetTestPublicClient } from '@repo/test/utils/wagmi/wagmi-test-clients'
import {
  approveToken,
  getTokenUserBalance,
  setNativeUserBalance,
} from '@repo/lib/test/integration/sdk-utils'
import {
  Address,
  encodeAbiParameters,
  erc20Abi,
  Hex,
  keccak256,
  maxUint256,
  pad,
  parseAbi,
  parseAbiParameters,
  toHex,
  zeroAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'
import { fetchPoolMock, minimalPoolQuery } from '../__mocks__/fetchPoolMock'
import { isBoosted } from '../pool.helpers'
import { SdkQueryAddLiquidityOutput } from '../actions/add-liquidity/add-liquidity.types'
import { constructBaseBuildCallInput } from '../actions/add-liquidity/handlers/add-liquidity.utils'
import { selectAddLiquidityHandler } from '../actions/add-liquidity/handlers/selectAddLiquidityHandler'
import { LiquidityActionHelpers } from '../actions/LiquidityActionHelpers'
import { BALANCER_V3_CONTRACTS } from './balv3.constants'
import { BALV3_MIGRATION_FALLBACKS, SourceBalV3PoolInfo } from './getPoolMigrations'
import { deriveTargetMigrationAmounts } from './MigrateLiquidityProvider'
import { BalV3BptPermit } from './steps/useBalV3BptAuthStep'
import {
  BalV3ReceivedToken,
  buildBalV3RemoveCallData,
  parseBalV3RemoveReceipt,
} from './steps/useBalV3RemoveStep'
import {
  applyBalV3ExitSlippage,
  BalV3ExitMode,
  getBalV3ExpectedOutputTokens,
  getBalV3ExitTargetRouter,
  getBalV3UnwrapWrapped,
  resolveBalV3ExitMode,
} from './steps/useSimulateBalV3ExitQuery'

const ANVIL_TEST_TIMEOUT_MS = 120_000
// Anvil runs with --mixed-mining (--block-time 1): eth_estimateGas can run at the previous
// block's timestamp (skipping gauge _checkpoint / ERC4626 rate updates) while the mined block
// advances timestamp by >=1s and uses ~100k more gas. Explicit gas avoids spurious OOG reverts.
const ANVIL_TX_GAS_LIMIT = 2_000_000n
const SLIPPAGE_PERCENT = '0.5'
const BPT_PROBE_VALUE = 1337_1337_1337_1337_1337_1337n

const RETH_WAETHWETH_POOL: SourceBalV3PoolInfo = {
  protocol: 3,
  chainId: ChainId.MAINNET,
  id: '0x1ea5870f7c037930ce1d5d8d9317c670e89e13e3',
  name: 'rETH-waEthWETH',
  symbol: 'rETH-waEthWETH',
  type: 'STABLE',
  gaugeAddress: '0x62a66eb9abf7a788f48d0ce7c0c065df9e09da19',
  isPaused: false,
  tokens: [
    {
      index: 0,
      address: '0x0bfc9d54fc184518a81162f8fb99c2eaca081202',
      symbol: 'waEthWETH',
      decimals: 18,
      isErc4626: true,
      unwrapOnExit: false,
      underlyingToken: {
        address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        symbol: 'WETH',
        decimals: 18,
      },
    },
    {
      index: 1,
      address: '0xae78736cd615f374d3085123a210448e74fc6393',
      symbol: 'rETH',
      decimals: 18,
      isErc4626: false,
    },
  ],
}

const PAUSED_GHO_USDT_USDC_ID = '0x85b2b559bc2d21104c4defdd6efca8a20343361d'
const FRONTIER_WAETH_USDC_USDT_ID = '0x0a22eae1008c218d22c27a00b6f712483e32229a'

const balV3GaugeAbi = parseAbi([
  'function deposit(uint256 value) external',
  'function withdraw(uint256 value) external',
])

const eip712DomainAbi = parseAbi([
  'function eip712Domain() view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)',
])

const eip2612NoncesAbi = parseAbi(['function nonces(address owner) view returns (uint256)'])

const permitTypedDataTypes = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

const defaultAnvilAccount = privateKeyToAccount(defaultAnvilTestPrivateKey as Hex)

/**
 * Computes a small non-zero BPT test amount strictly below `totalSupply` so Vault burn and
 * proportional exit transfers remain well within existing pool reserves.
 */
function computeTestBptAmount(totalSupply: bigint): bigint {
  return totalSupply > 1000n ? totalSupply / 1000n : totalSupply / 10n
}

/**
 * Funds `account` with Balancer V3 BPT on an Anvil fork by probing nested mapping slots in the
 * Balancer V3 Vault (`ERC20MultiToken._balances`), restoring any non-matching slots.
 */
async function setBalV3BptBalance({
  poolAddress,
  account,
  balance,
}: {
  poolAddress: Address
  account: Address
  balance: bigint
}): Promise<void> {
  const vaultAddress = BALANCER_V3_CONTRACTS[ChainId.MAINNET].vault
  const probeHex = toHex(BPT_PROBE_VALUE, { size: 32 })
  const targetHex = toHex(balance, { size: 32 })

  for (let slot = 0n; slot <= 80n; slot++) {
    for (const [firstKey, secondKey] of [
      [poolAddress, account] as const,
      [account, poolAddress] as const,
    ]) {
      const outerSlot = keccak256(
        encodeAbiParameters(parseAbiParameters('address, uint256'), [firstKey, slot])
      )

      const candidateSlot = keccak256(
        encodeAbiParameters(parseAbiParameters('address, bytes32'), [secondKey, outerSlot])
      )

      const prevValue = await mainnetTestPublicClient.getStorageAt({
        address: vaultAddress,
        slot: candidateSlot,
      })

      await mainnetTestPublicClient.setStorageAt({
        address: vaultAddress,
        index: candidateSlot,
        value: probeHex,
      })

      const observed = await mainnetTestPublicClient.readContract({
        address: poolAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account],
      })

      if (observed === BPT_PROBE_VALUE) {
        await mainnetTestPublicClient.setStorageAt({
          address: vaultAddress,
          index: candidateSlot,
          value: targetHex,
        })

        return
      }

      await mainnetTestPublicClient.setStorageAt({
        address: vaultAddress,
        index: candidateSlot,
        value: prevValue ?? pad('0x0', { size: 32 }),
      })
    }
  }

  throw new Error(`Unable to locate Balancer V3 Vault BPT balance slot for pool ${poolAddress}`)
}

/**
 * Reads `eip712Domain()` and `nonces()` from the source Balancer V3 BPT and signs an EIP-2612
 * `Permit` authorization for `spender` using the local Anvil test private key.
 */
async function signBalV3BptPermit({
  bptAddress,
  spender,
  amount,
}: {
  bptAddress: Address
  spender: Address
  amount: bigint
}): Promise<BalV3BptPermit> {
  const [domainResult, nonce] = await Promise.all([
    mainnetTestPublicClient.readContract({
      abi: eip712DomainAbi,
      address: bptAddress,
      functionName: 'eip712Domain',
      args: [],
    }),
    mainnetTestPublicClient.readContract({
      abi: eip2612NoncesAbi,
      address: bptAddress,
      functionName: 'nonces',
      args: [defaultAnvilAccount.address],
    }),
  ])

  const [, name, version, domainChainId, verifyingContract] = domainResult
  const deadline = maxUint256

  const signature = await mainnetTestPublicClient.signTypedData({
    account: defaultAnvilAccount,
    domain: {
      name,
      version,
      chainId: Number(domainChainId),
      verifyingContract,
    },
    types: permitTypedDataTypes,
    primaryType: 'Permit',
    message: {
      owner: defaultAnvilAccount.address,
      spender,
      value: amount,
      nonce,
      deadline,
    },
  })

  return {
    approval: {
      token: bptAddress,
      owner: defaultAnvilAccount.address,
      spender,
      amount,
      nonce,
      deadline,
    },
    signature,
  }
}

/**
 * Simulates a Balancer V3 exit (`proportional` or `recovery`), signs an EIP-2612 BPT permit,
 * executes `permitBatchAndCall` on the Balancer V3 Router, and returns parsed received tokens.
 */
async function executeBalV3PermitExit({
  oldPool,
  expectedExitMode,
  exactBptAmountIn,
}: {
  oldPool: SourceBalV3PoolInfo
  expectedExitMode: Exclude<BalV3ExitMode, 'erc4626Unwrap'>
  exactBptAmountIn: bigint
}): Promise<BalV3ReceivedToken[]> {
  const exitMode = resolveBalV3ExitMode(oldPool)
  expect(exitMode).toBe(expectedExitMode)

  const unwrapWrapped = getBalV3UnwrapWrapped(oldPool)
  const targetRouter = getBalV3ExitTargetRouter(ChainId.MAINNET, exitMode)!
  expect(targetRouter).toBe(BALANCER_V3_CONTRACTS[ChainId.MAINNET].router)

  const { result: simulatedAmountsOut } =
    expectedExitMode === 'recovery'
      ? await mainnetTestPublicClient.simulateContract({
          address: targetRouter,
          abi: routerAbi_V3,
          functionName: 'queryRemoveLiquidityRecovery',
          args: [oldPool.id, exactBptAmountIn],
          account: zeroAddress,
        })
      : await mainnetTestPublicClient.simulateContract({
          address: targetRouter,
          abi: routerAbi_V3,
          functionName: 'queryRemoveLiquidityProportional',
          args: [oldPool.id, exactBptAmountIn, zeroAddress, '0x'],
          account: zeroAddress,
        })

  const minAmountsOut = applyBalV3ExitSlippage(simulatedAmountsOut, SLIPPAGE_PERCENT)
  const outputTokens = getBalV3ExpectedOutputTokens(oldPool, exitMode)

  const bptPermit = await signBalV3BptPermit({
    bptAddress: oldPool.id,
    spender: targetRouter,
    amount: exactBptAmountIn,
  })

  const removeCallData = buildBalV3RemoveCallData({
    oldPool,
    exitMode,
    unwrapWrapped,
    exactBptAmountIn,
    minAmountsOut,
    bptPermit,
  })

  const removeHash = await mainnetTestPublicClient.sendTransaction({
    account: defaultTestUserAccount,
    chain: mainnetTestPublicClient.chain,
    to: targetRouter,
    data: removeCallData,
    gas: ANVIL_TX_GAS_LIMIT,
  })

  const removeReceipt = await mainnetTestPublicClient.waitForTransactionReceipt({
    hash: removeHash,
  })

  expect(removeReceipt.status).toBe('success')

  return parseBalV3RemoveReceipt(removeReceipt.logs, defaultTestUserAccount, outputTokens)
}

async function prepareMainnetTestUser(): Promise<void> {
  await setNativeUserBalance({
    client: mainnetTestPublicClient,
    account: defaultTestUserAccount,
    humanAmount: '10',
  })

  await mainnetTestPublicClient.impersonateAccount({
    address: defaultTestUserAccount,
  })
}

async function readTotalSupplyAndFundBpt(poolAddress: Address): Promise<bigint> {
  const totalSupply = await mainnetTestPublicClient.readContract({
    address: poolAddress,
    abi: erc20Abi,
    functionName: 'totalSupply',
  })

  const bptAmount = computeTestBptAmount(totalSupply)
  expect(bptAmount).toBeGreaterThan(0n)

  await setBalV3BptBalance({
    poolAddress,
    account: defaultTestUserAccount,
    balance: bptAmount,
  })

  return bptAmount
}

describe.runIf(isChainSupported(GqlChainValues.Mainnet))(
  'Balancer V3 to Frontier Mainnet Anvil migration integration tests',
  () => {
    it(
      'unstakes from BalV3 gauge, signs EIP-2612 permit, and executes proportional exit on rETH-waEthWETH',
      async () => {
        await prepareMainnetTestUser()

        const gaugeAddress = RETH_WAETHWETH_POOL.gaugeAddress!
        const bptAmount = await readTotalSupplyAndFundBpt(RETH_WAETHWETH_POOL.id)

        const approved = await approveToken({
          client: mainnetTestPublicClient,
          account: defaultTestUserAccount,
          token: RETH_WAETHWETH_POOL.id,
          spender: gaugeAddress,
          amount: bptAmount,
        })

        expect(approved).toBe(true)

        const depositHash = await mainnetTestPublicClient.writeContract({
          account: defaultTestUserAccount,
          chain: mainnetTestPublicClient.chain,
          address: gaugeAddress,
          abi: balV3GaugeAbi,
          functionName: 'deposit',
          args: [bptAmount],
          gas: ANVIL_TX_GAS_LIMIT,
        })

        const depositReceipt = await mainnetTestPublicClient.waitForTransactionReceipt({
          hash: depositHash,
        })

        expect(depositReceipt.status).toBe('success')

        const stakedBefore = await getTokenUserBalance({
          client: mainnetTestPublicClient,
          account: defaultTestUserAccount,
          tokenAddress: gaugeAddress,
        })

        expect(stakedBefore).toBe(bptAmount)

        const withdrawHash = await mainnetTestPublicClient.writeContract({
          account: defaultTestUserAccount,
          chain: mainnetTestPublicClient.chain,
          address: gaugeAddress,
          abi: balV3GaugeAbi,
          functionName: 'withdraw',
          args: [stakedBefore],
          gas: ANVIL_TX_GAS_LIMIT,
        })

        const withdrawReceipt = await mainnetTestPublicClient.waitForTransactionReceipt({
          hash: withdrawHash,
        })

        expect(withdrawReceipt.status).toBe('success')

        const stakedAfter = await getTokenUserBalance({
          client: mainnetTestPublicClient,
          account: defaultTestUserAccount,
          tokenAddress: gaugeAddress,
        })

        expect(stakedAfter).toBe(0n)

        const unstakedBptBalance = await getTokenUserBalance({
          client: mainnetTestPublicClient,
          account: defaultTestUserAccount,
          tokenAddress: RETH_WAETHWETH_POOL.id,
        })

        expect(unstakedBptBalance).toBe(bptAmount)

        const receivedTokens = await executeBalV3PermitExit({
          oldPool: RETH_WAETHWETH_POOL,
          expectedExitMode: 'proportional',
          exactBptAmountIn: unstakedBptBalance,
        })

        const receivedWaEthWeth = receivedTokens.find(token =>
          isSameAddress(token.tokenAddress, RETH_WAETHWETH_POOL.tokens[0]!.address)
        )

        const receivedReth = receivedTokens.find(token =>
          isSameAddress(token.tokenAddress, RETH_WAETHWETH_POOL.tokens[1]!.address)
        )

        expect(receivedWaEthWeth?.rawAmount).toBeGreaterThan(0n)
        expect(receivedReth?.rawAmount).toBeGreaterThan(0n)

        const balV3BptBalance = await getTokenUserBalance({
          client: mainnetTestPublicClient,
          account: defaultTestUserAccount,
          tokenAddress: RETH_WAETHWETH_POOL.id,
        })

        expect(balV3BptBalance).toBe(0n)
      },
      ANVIL_TEST_TIMEOUT_MS
    )

    it(
      'exits paused Aave GHO/USDT/USDC via recovery mode and deposits waEthUSDC + waEthUSDT into Frontier V3',
      async () => {
        await prepareMainnetTestUser()

        const migration = BALV3_MIGRATION_FALLBACKS.find(
          entry =>
            isSameAddress(entry.old.id, PAUSED_GHO_USDT_USDC_ID) &&
            isSameAddress(entry.new.id, FRONTIER_WAETH_USDC_USDT_ID)
        )

        if (!migration) {
          throw new Error('Expected recovery migration fallback entry was not found')
        }

        const frontierPool = await fetchPoolMock({
          poolId: migration.new.id,
          chain: GqlChainValues.Mainnet,
          query: minimalPoolQuery,
        })

        const frontierBptBefore = await getTokenUserBalance({
          client: mainnetTestPublicClient,
          account: defaultTestUserAccount,
          tokenAddress: migration.new.id,
        })

        const bptAmount = await readTotalSupplyAndFundBpt(migration.old.id)

        const receivedTokens = await executeBalV3PermitExit({
          oldPool: migration.old,
          expectedExitMode: 'recovery',
          exactBptAmountIn: bptAmount,
        })

        const receivedWaEthUsdt = receivedTokens.find(token =>
          isSameAddress(token.tokenAddress, migration.old.tokens[0]!.address)
        )

        const receivedGho = receivedTokens.find(token =>
          isSameAddress(token.tokenAddress, migration.old.tokens[1]!.address)
        )

        const receivedWaEthUsdc = receivedTokens.find(token =>
          isSameAddress(token.tokenAddress, migration.old.tokens[2]!.address)
        )

        expect(receivedWaEthUsdt?.rawAmount).toBeGreaterThan(0n)
        expect(receivedGho?.rawAmount).toBeGreaterThan(0n)
        expect(receivedWaEthUsdc?.rawAmount).toBeGreaterThan(0n)

        const helpers = new LiquidityActionHelpers(frontierPool)
        const rpcUrl = getTestRpcSetup(mainnet.id).rpcUrl

        const poolStateWithBalances = await getBoostedPoolStateWithBalancesV3(
          helpers.boostedPoolState,
          ChainId.MAINNET,
          rpcUrl
        )

        const { migratedAmounts, desiredWrapUpdates, referenceAmountAddress } =
          deriveTargetMigrationAmounts({
            newPool: frontierPool,
            exitTokens: receivedTokens,
            currentWrapUnderlying: [true, true],
            poolStateWithBalances,
          })

        expect(migratedAmounts).toHaveLength(2)
        expect(referenceAmountAddress).toBeDefined()

        const wrapUnderlying = frontierPool.poolTokens.map((_, index) => {
          const update = desiredWrapUpdates.find(item => item.index === index)
          return update ? update.value : false
        })

        expect(wrapUnderlying).toEqual([false, false])

        const humanAmountsIn: HumanTokenAmountWithSymbol[] = migratedAmounts

        const permit2Address = BALANCER_V3_CONTRACTS[ChainId.MAINNET].permit2

        for (const token of humanAmountsIn) {
          const approved = await approveToken({
            client: mainnetTestPublicClient,
            account: defaultTestUserAccount,
            token: token.tokenAddress,
            spender: permit2Address,
          })

          expect(approved).toBe(true)
        }

        const handler = selectAddLiquidityHandler(frontierPool, true, wrapUnderlying)

        const queryOutput = (await handler.simulate(
          humanAmountsIn,
          defaultTestUserAccount,
          referenceAmountAddress,
          Number(SLIPPAGE_PERCENT)
        )) as SdkQueryAddLiquidityOutput

        expect(queryOutput.bptOut.amount).toBeGreaterThan(0n)

        const baseBuildInput = constructBaseBuildCallInput({
          humanAmountsIn,
          slippagePercent: SLIPPAGE_PERCENT,
          sdkQueryOutput: queryOutput.sdkQueryOutput,
          pool: frontierPool,
        })

        const sdkClient = mainnetTestPublicClient as unknown as PublicWalletClient

        const sdkOwner = defaultAnvilAccount as unknown as Parameters<
          typeof Permit2Helper.signAddLiquidityApproval
        >[0]['owner']

        const permit2 = isBoosted(frontierPool)
          ? await Permit2Helper.signAddLiquidityBoostedApproval({
              ...baseBuildInput,
              client: sdkClient,
              owner: sdkOwner,
            })
          : await Permit2Helper.signAddLiquidityApproval({
              ...baseBuildInput,
              client: sdkClient,
              owner: sdkOwner,
            })

        const addTxConfig = await handler.buildCallData({
          humanAmountsIn,
          account: defaultTestUserAccount,
          slippagePercent: SLIPPAGE_PERCENT,
          queryOutput,
          permit2,
        })

        const addHash = await mainnetTestPublicClient.sendTransaction({
          account: defaultTestUserAccount,
          chain: mainnetTestPublicClient.chain,
          to: addTxConfig.to,
          data: addTxConfig.data,
          value: addTxConfig.value,
          gas: ANVIL_TX_GAS_LIMIT,
        })

        const addReceipt = await mainnetTestPublicClient.waitForTransactionReceipt({
          hash: addHash,
        })

        expect(addReceipt.status).toBe('success')

        const frontierBptAfter = await getTokenUserBalance({
          client: mainnetTestPublicClient,
          account: defaultTestUserAccount,
          tokenAddress: migration.new.id,
        })

        const balV3BptBalance = await getTokenUserBalance({
          client: mainnetTestPublicClient,
          account: defaultTestUserAccount,
          tokenAddress: migration.old.id,
        })

        const ghoBalanceAfter = await getTokenUserBalance({
          client: mainnetTestPublicClient,
          account: defaultTestUserAccount,
          tokenAddress: receivedGho!.tokenAddress,
        })

        expect(frontierBptAfter).toBeGreaterThan(frontierBptBefore)
        expect(frontierBptAfter).toBeGreaterThan(0n)
        expect(balV3BptBalance).toBe(0n)
        expect(ghoBalanceAfter).toBeGreaterThanOrEqual(receivedGho!.rawAmount)
      },
      ANVIL_TEST_TIMEOUT_MS
    )
  }
)
