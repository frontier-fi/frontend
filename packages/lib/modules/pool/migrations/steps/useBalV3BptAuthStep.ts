'use client'

import { Button, VStack, useToast } from '@chakra-ui/react'
import { getGqlChain } from '@repo/lib/config/app.config'
import { SupportedChainId } from '@repo/lib/config/config.types'
import { useTokenApprovalSteps } from '@repo/lib/modules/tokens/approvals/useTokenApprovalSteps'
import { TransactionStep } from '@repo/lib/modules/transactions/transaction-steps/lib'
import { useShouldBatchTransactions } from '@repo/lib/modules/transactions/transaction-steps/tx-batch.hooks'
import { useUserSettings } from '@repo/lib/modules/user/settings/UserSettingsProvider'
import { ConnectWallet } from '@repo/lib/modules/web3/ConnectWallet'
import { useUserAccount } from '@repo/lib/modules/web3/UserAccountProvider'
import { useIsSafeAccount } from '@repo/lib/modules/web3/safe.hooks'
import {
  SignatureState,
  isSignatureDisabled,
  isSignatureLoading,
} from '@repo/lib/modules/web3/signatures/signature.helpers'
import {
  NetworkSwitchButton,
  NetworkSwitchButtonProps,
  useChainSwitch,
} from '@repo/lib/modules/web3/useChainSwitch'
import { useSdkWalletClient } from '@repo/lib/modules/web3/useSdkViemClient'
import { BalAlert } from '@repo/lib/shared/components/alerts/BalAlert'
import { LabelWithIcon } from '@repo/lib/shared/components/btns/button-group/LabelWithIcon'
import { Toast } from '@repo/lib/shared/components/toasts/Toast'
import { ensureError } from '@repo/lib/shared/utils/errors'
import { createElement, useCallback, useEffect, useMemo, useState } from 'react'
import { Address, Hex, maxUint256, parseAbi, zeroAddress } from 'viem'
import { usePublicClient } from 'wagmi'
import { isBalV3SupportedChain } from '../balv3.constants'
import { SourceBalV3PoolInfo } from '../getPoolMigrations'

export const SIGN_BALV3_BPT_PERMIT_STEP_ID = 'sign-balv3-bpt-permit'

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

export type BalV3BptPermitApproval = {
  token: Address
  owner: Address
  spender: Address
  amount: bigint
  nonce: bigint
  deadline: bigint
}

export type BalV3BptPermit = {
  approval: BalV3BptPermitApproval
  signature: Hex
}

export type UseBalV3BptAuthStepParams = {
  oldPool: SourceBalV3PoolInfo
  spender: Address | undefined
  exactBptAmountIn: bigint
  isRemoveComplete?: boolean
  enabled?: boolean
}

export type UseBalV3BptAuthStepResult = {
  steps: TransactionStep[]
  bptPermit: BalV3BptPermit | undefined
  isLoading: boolean
  shouldUsePermit: boolean
}

type BalV3SignPermitButtonProps = {
  error: string | undefined
  isConnected: boolean
  isLoading: boolean
  shouldChangeNetwork: boolean
  networkSwitchButtonProps: NetworkSwitchButtonProps
  isDisabled: boolean
  buttonLabel: string
  signPermit: () => void
}

function BalV3SignPermitButton({
  error,
  isConnected,
  isLoading,
  shouldChangeNetwork,
  networkSwitchButtonProps,
  isDisabled,
  buttonLabel,
  signPermit,
}: BalV3SignPermitButtonProps) {
  return createElement(
    VStack,
    { width: 'full' },
    error ? createElement(BalAlert, { content: error, status: 'error' }) : null,
    !isConnected ? createElement(ConnectWallet, { isLoading, width: 'full' }) : null,
    shouldChangeNetwork && isConnected
      ? createElement(NetworkSwitchButton, networkSwitchButtonProps)
      : null,
    !shouldChangeNetwork && isConnected
      ? createElement(
          Button,
          {
            isDisabled,
            isLoading,
            loadingText: buttonLabel,
            onClick: signPermit,
            size: 'lg',
            variant: 'primary',
            w: 'full',
            width: 'full',
          },
          createElement(LabelWithIcon, { icon: 'sign' }, buttonLabel)
        )
      : null
  )
}

/**
 * Step 1: authorizes the Balancer V3 Router / CompositeLiquidityRouter to spend the user's BPT.
 * Uses gasless EIP-2612 `Permit` signatures when `shouldUseSignatures && !isSafeAccount && !shouldBatchTransactions`,
 * and automatically falls back to `useTokenApprovalSteps` (`erc20Abi.approve` of the exact BPT amount) otherwise.
 * Latches completion once the remove step completes so step indices remain stable after BPT/allowance is spent.
 */
export function useBalV3BptAuthStep({
  oldPool,
  spender,
  exactBptAmountIn,
  isRemoveComplete = false,
  enabled = true,
}: UseBalV3BptAuthStepParams): UseBalV3BptAuthStepResult {
  const toast = useToast()
  const { userAddress, isConnected } = useUserAccount()
  const { shouldUseSignatures } = useUserSettings()
  const isSafeAccount = useIsSafeAccount()
  const shouldBatchTransactions = useShouldBatchTransactions()
  const [isPermitUnsupported, setIsPermitUnsupported] = useState(false)

  const shouldUsePermit =
    shouldUseSignatures && !isSafeAccount && !shouldBatchTransactions && !isPermitUnsupported

  const supportedChainId = isBalV3SupportedChain(oldPool.chainId) ? oldPool.chainId : undefined
  const publicClient = usePublicClient({ chainId: supportedChainId })
  const { sdkClient, isLoading: isWalletLoading } = useSdkWalletClient()

  const { shouldChangeNetwork, networkSwitchButtonProps } = useChainSwitch(
    oldPool.chainId as SupportedChainId
  )

  const authScopeKey = `${oldPool.chainId}:${oldPool.id}:${spender ?? ''}:${userAddress ?? ''}`

  const [latchedState, setLatchedState] = useState<{
    scopeKey: string
    bptAmount: bigint
    isComplete: boolean
  }>({
    scopeKey: authScopeKey,
    bptAmount: exactBptAmountIn > 0n ? exactBptAmountIn : 0n,
    isComplete: isRemoveComplete,
  })

  const [signedPermit, setSignedPermit] = useState<BalV3BptPermit | undefined>()
  const [signPermitState, setSignPermitState] = useState<SignatureState>(SignatureState.Ready)
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    setLatchedState(prev => {
      if (prev.scopeKey !== authScopeKey) {
        return {
          scopeKey: authScopeKey,
          bptAmount: exactBptAmountIn > 0n ? exactBptAmountIn : 0n,
          isComplete: isRemoveComplete,
        }
      }

      const nextComplete = prev.isComplete || isRemoveComplete

      const nextAmount = !nextComplete && exactBptAmountIn > 0n ? exactBptAmountIn : prev.bptAmount

      if (prev.isComplete === nextComplete && prev.bptAmount === nextAmount) {
        return prev
      }

      return {
        scopeKey: authScopeKey,
        bptAmount: nextAmount,
        isComplete: nextComplete,
      }
    })
  }, [authScopeKey, exactBptAmountIn, isRemoveComplete])

  useEffect(() => {
    setSignedPermit(undefined)
    setSignPermitState(SignatureState.Ready)
    setError(undefined)
    setIsPermitUnsupported(false)
  }, [authScopeKey])

  useEffect(() => {
    if (isRemoveComplete) return

    if (
      signedPermit &&
      exactBptAmountIn > 0n &&
      signedPermit.approval.amount !== exactBptAmountIn
    ) {
      setSignedPermit(undefined)
      setSignPermitState(SignatureState.Ready)
    }
  }, [exactBptAmountIn, isRemoveComplete, signedPermit])

  const effectiveScopeMatch = latchedState.scopeKey === authScopeKey
  const effectiveLatchedComplete = effectiveScopeMatch ? latchedState.isComplete : isRemoveComplete

  const effectiveBptAmount = effectiveScopeMatch
    ? latchedState.bptAmount
    : exactBptAmountIn > 0n
      ? exactBptAmountIn
      : 0n

  const signPermit = useCallback(async () => {
    if (!userAddress || !spender || effectiveBptAmount <= 0n || !sdkClient) {
      throw new Error('Missing wallet client, spender, or BPT amount for permit signature')
    }

    setSignPermitState(SignatureState.Confirming)
    setError(undefined)

    try {
      const [domainResult, nonce] = publicClient
        ? await Promise.all([
            publicClient.readContract({
              abi: eip712DomainAbi,
              address: oldPool.id,
              functionName: 'eip712Domain',
              args: [],
            }),
            publicClient.readContract({
              abi: eip2612NoncesAbi,
              address: oldPool.id,
              functionName: 'nonces',
              args: [userAddress],
            }),
          ])
        : await Promise.all([
            sdkClient.readContract({
              abi: eip712DomainAbi,
              address: oldPool.id,
              functionName: 'eip712Domain',
              args: [],
            }),
            sdkClient.readContract({
              abi: eip2612NoncesAbi,
              address: oldPool.id,
              functionName: 'nonces',
              args: [userAddress],
            }),
          ])

      const [, name, version, domainChainId, verifyingContract] = domainResult
      const deadline = maxUint256

      const signature = await sdkClient.signTypedData({
        account: userAddress,
        domain: {
          name,
          version,
          chainId: Number(domainChainId),
          verifyingContract,
        },
        types: permitTypedDataTypes,
        primaryType: 'Permit',
        message: {
          owner: userAddress,
          spender,
          value: effectiveBptAmount,
          nonce,
          deadline,
        },
      })

      setSignedPermit({
        approval: {
          token: oldPool.id,
          owner: userAddress,
          spender,
          amount: effectiveBptAmount,
          nonce,
          deadline,
        },
        signature,
      })

      setSignPermitState(SignatureState.Completed)

      toast({
        title: 'Approval signed!',
        description: '',
        status: 'success',
        duration: 5000,
        isClosable: true,
        render: ({ ...rest }) => createElement(Toast, rest),
      })
    } catch (err) {
      if (isUserRejectedSignatureError(err)) {
        setSignPermitState(SignatureState.Ready)
        return
      }

      if (isUnsupportedSignatureError(err)) {
        setIsPermitUnsupported(true)
        setSignPermitState(SignatureState.Ready)
        return
      }

      console.error(err)
      setError('Error in permit signature call')
      setSignPermitState(SignatureState.Ready)
    }
  }, [userAddress, spender, effectiveBptAmount, sdkClient, publicClient, oldPool.id, toast])

  const effectivePermitState =
    isWalletLoading && !signedPermit ? SignatureState.Preparing : signPermitState

  const isPermitComplete =
    effectiveLatchedComplete ||
    (signPermitState === SignatureState.Completed && Boolean(signedPermit))

  const permitButtonLabel = getPermitButtonLabel(effectivePermitState, oldPool.symbol)

  const isPermitLoading =
    isSignatureLoading(effectivePermitState) || !spender || effectiveBptAmount <= 0n

  const isPermitDisabled =
    isSignatureDisabled(effectivePermitState) ||
    !sdkClient ||
    !spender ||
    effectiveBptAmount <= 0n ||
    !enabled ||
    effectiveLatchedComplete

  const permitStep = useMemo<TransactionStep>(
    () => ({
      id: SIGN_BALV3_BPT_PERMIT_STEP_ID,
      stepType: 'signPermit',
      details: { gasless: true },
      labels: {
        title: `Permit ${oldPool.symbol} pool token`,
        init: 'Sign permit',
        tooltip: `Sign EIP-2612 permit for ${oldPool.symbol}`,
      },
      isComplete: () => isPermitComplete,
      renderAction: () =>
        createElement(BalV3SignPermitButton, {
          error,
          isConnected,
          isLoading: isPermitLoading,
          shouldChangeNetwork,
          networkSwitchButtonProps,
          isDisabled: isPermitDisabled,
          buttonLabel: permitButtonLabel,
          signPermit,
        }),
    }),
    [
      oldPool.symbol,
      isPermitComplete,
      error,
      isConnected,
      isPermitLoading,
      shouldChangeNetwork,
      networkSwitchButtonProps,
      isPermitDisabled,
      permitButtonLabel,
      signPermit,
    ]
  )

  const { isLoading: isApprovalLoading, steps: rawApprovalSteps } = useTokenApprovalSteps({
    spenderAddress: spender ?? zeroAddress,
    chain: getGqlChain((supportedChainId ?? 1) as SupportedChainId),
    approvalAmounts: [
      {
        rawAmount: effectiveBptAmount,
        address: oldPool.id,
        symbol: oldPool.symbol,
      },
    ],
    actionType: 'RemoveLiquidity',
    bptSymbol: oldPool.symbol,
    // One-off exit through an external router: approve what is removed, like the permit path does
    approveMaxBigInt: false,
    enabled: Boolean(
      enabled &&
      !shouldUsePermit &&
      supportedChainId &&
      spender &&
      effectiveBptAmount > 0n &&
      !effectiveLatchedComplete
    ),
  })

  const approvalSteps = useMemo<TransactionStep[]>(
    () =>
      rawApprovalSteps.map(step => ({
        ...step,
        isComplete: () => effectiveLatchedComplete || step.isComplete(),
        ...(enabled || effectiveLatchedComplete
          ? {}
          : {
              batchableTxCall: undefined,
              renderAction: () =>
                createElement(
                  Button,
                  {
                    isDisabled: true,
                    size: 'lg',
                    variant: 'primary',
                    w: 'full',
                    width: 'full',
                  },
                  step.labels.init
                ),
            }),
      })),
    [rawApprovalSteps, effectiveLatchedComplete, enabled]
  )

  return {
    steps: shouldUsePermit ? [permitStep] : approvalSteps,
    bptPermit: shouldUsePermit ? signedPermit : undefined,
    isLoading: shouldUsePermit ? false : isApprovalLoading,
    shouldUsePermit,
  }
}

function getPermitButtonLabel(signPermitState: SignatureState, poolSymbol?: string) {
  if (signPermitState === SignatureState.Ready) {
    return poolSymbol ? `Sign approval: ${poolSymbol}` : 'Sign approval'
  }

  if (signPermitState === SignatureState.Confirming) return 'Confirm approval with signature'
  if (signPermitState === SignatureState.Preparing) return 'Preparing'
  if (signPermitState === SignatureState.Completed) return 'Approval signed'
  return ''
}

function isUserRejectedSignatureError(err: unknown): boolean {
  const error = ensureError(err)
  if (error.name === 'UserRejectedRequestError') return true

  const walkable = err as { walk?: (fn: (node: unknown) => boolean) => unknown } | null

  if (typeof walkable?.walk === 'function') {
    return Boolean(
      walkable.walk(node => node instanceof Error && node.name === 'UserRejectedRequestError')
    )
  }

  return false
}

const UNSUPPORTED_SIGNATURE_PATTERNS = [
  'no signer available',
  'eth_signtypeddata',
  'methodnotfound',
  'methodnotsupported',
  'method not found',
  'method not supported',
]

function isUnsupportedSignatureError(err: unknown): boolean {
  const error = ensureError(err)

  const matchesUnsupported = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false

    const errNode = node as { name?: string; message?: string; details?: string }

    const combined =
      `${errNode.name ?? ''} ${errNode.message ?? ''} ${errNode.details ?? ''}`.toLowerCase()

    return UNSUPPORTED_SIGNATURE_PATTERNS.some(pattern => combined.includes(pattern))
  }

  if (matchesUnsupported(error)) return true

  const walkable = err as { walk?: (fn: (node: unknown) => boolean) => unknown } | null

  if (typeof walkable?.walk === 'function') {
    return Boolean(walkable.walk(matchesUnsupported))
  }

  return false
}
