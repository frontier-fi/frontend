import { useAddLiquidity } from '../AddLiquidityProvider'
import { useTokenBalances } from '@repo/lib/modules/tokens/TokenBalancesProvider'
import FadeInOnView from '@repo/lib/shared/components/containers/FadeInOnView'
import { PoolRiskAcknowledgements } from './PoolRiskAcknowledgements'

export function AddLiquidityFormCheckbox() {
  const { tokens, setAcceptPoolRisks } = useAddLiquidity()
  const { balanceFor, isBalancesLoading } = useTokenBalances()

  const hasNoPoolTokensInWallet = tokens.every(
    token => token && balanceFor(token.address)?.formatted === '0'
  )

  return (
    <FadeInOnView scaleUp={false}>
      <PoolRiskAcknowledgements
        isDisabled={isBalancesLoading || hasNoPoolTokensInWallet}
        onChange={setAcceptPoolRisks}
      />
    </FadeInOnView>
  )
}
