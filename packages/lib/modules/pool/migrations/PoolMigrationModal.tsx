'use client'

import { Modal, ModalBody, ModalCloseButton, ModalContent } from '@chakra-ui/react'
import { ActionModalFooter } from '@repo/lib/shared/components/modals/ActionModalFooter'
import { SuccessOverlay } from '@repo/lib/shared/components/modals/SuccessOverlay'
import { TransactionModalHeader } from '@repo/lib/shared/components/modals/TransactionModalHeader'
import { useBreakpoints } from '@repo/lib/shared/hooks/useBreakpoints'
import { useEffect } from 'react'
import { useTokens } from '../../tokens/TokensProvider'
import { useAddLiquidityReceipt } from '../../transactions/transaction-steps/receipts/receipt.hooks'
import { DesktopStepTracker } from '../../transactions/transaction-steps/step-tracker/DesktopStepTracker'
import { getStylesForModalContentWithStepTracker } from '../../transactions/transaction-steps/step-tracker/step-tracker.utils'
import { useShouldBatchTransactions } from '../../transactions/transaction-steps/tx-batch.hooks'
import { useOnUserAccountChanged } from '../../web3/useOnUserAccountChanged'
import { useUserAccount } from '../../web3/UserAccountProvider'
import { useAddLiquidity } from '../actions/add-liquidity/AddLiquidityProvider'
import { usePoolRedirect } from '../pool.hooks'
import { ProtocolVersion } from '../pool.types'
import { useMigrateLiquidity } from './MigrateLiquidityProvider'
import { MigrateLiquiditySummary } from './MigrateLiquiditySummary'

export function PoolMigrationModal() {
  const { isDesktop } = useBreakpoints()
  const { userAddress } = useUserAccount()
  const shouldBatchTransactions = useShouldBatchTransactions()
  const { stopTokenPricePolling } = useTokens()
  const { newPool, migrationSteps, hasQuoteContext } = useMigrateLiquidity()
  const { addLiquidityTxHash, urlTxHash, lastTransaction: addLiquidityTx } = useAddLiquidity()

  const addLiquidityReceipt = useAddLiquidityReceipt({
    chain: newPool.chain,
    txHash: addLiquidityTxHash,
    userAddress,
    protocolVersion: newPool.protocolVersion as ProtocolVersion,
    txReceipt: addLiquidityTx?.result,
  })

  const isSuccess = !!addLiquidityTxHash && addLiquidityReceipt.hasReceipt
  const { redirectToPoolPage } = usePoolRedirect(newPool)

  useOnUserAccountChanged(redirectToPoolPage)

  useEffect(() => {
    stopTokenPricePolling()
  }, [])

  return (
    <Modal
      isCentered
      isOpen={true}
      onClose={redirectToPoolPage}
      preserveScrollBarGap
      trapFocus={!isSuccess}
    >
      <SuccessOverlay startAnimation={!!addLiquidityTxHash && hasQuoteContext} />

      <ModalContent {...getStylesForModalContentWithStepTracker(isDesktop && hasQuoteContext)}>
        {isDesktop && hasQuoteContext && (
          <DesktopStepTracker
            chain={newPool.chain}
            isTxBatch={shouldBatchTransactions}
            transactionSteps={migrationSteps}
          />
        )}

        <TransactionModalHeader
          chain={newPool.chain}
          isReceiptLoading={addLiquidityReceipt.isLoading}
          label="Migrate liquidity"
          txHash={addLiquidityTxHash}
        />

        <ModalCloseButton />

        <ModalBody>
          <MigrateLiquiditySummary addLiquidityReceipt={addLiquidityReceipt} />
        </ModalBody>

        <ActionModalFooter
          currentStep={migrationSteps.currentStep}
          isSuccess={isSuccess}
          returnAction={redirectToPoolPage}
          returnLabel="Go to new pool"
          urlTxHash={urlTxHash}
        />
      </ModalContent>
    </Modal>
  )
}
