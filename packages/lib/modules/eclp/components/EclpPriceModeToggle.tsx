import ButtonGroup, {
  ButtonGroupOption,
} from '@repo/lib/shared/components/btns/button-group/ButtonGroup'

const PRICE_MODE_OPTIONS: readonly ButtonGroupOption[] = [
  {
    value: 'market',
    label: 'Market',
    tabTooltipLabel: 'Prices in regular market units for the displayed token pair.',
  },
  {
    value: 'normalized',
    label: 'Normalized',
    tabTooltipLabel: 'Rate-provider normalized prices (Vault-scaled bounds as configured onchain).',
  },
]

interface EclpPriceModeToggleProps {
  isNormalized: boolean
  setIsNormalized: (isNormalized: boolean) => void
  groupId?: string
}

export function EclpPriceModeToggle({
  isNormalized,
  setIsNormalized,
  groupId = 'eclp-price-mode',
}: EclpPriceModeToggleProps) {
  const currentOption = isNormalized ? PRICE_MODE_OPTIONS[1] : PRICE_MODE_OPTIONS[0]

  return (
    <ButtonGroup
      currentOption={currentOption}
      groupId={groupId}
      onChange={option => setIsNormalized(option.value === 'normalized')}
      options={PRICE_MODE_OPTIONS}
      size="xxs"
    />
  )
}
