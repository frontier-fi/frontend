import { Checkbox, Text } from '@chakra-ui/react'
import { useEclpChart } from '../hooks/EclpChartProvider'

export function EclpMeasureToggle() {
  const { canMeasureFromSpot, showPriceMeasure, setShowPriceMeasure } = useEclpChart()

  if (!canMeasureFromSpot) return null

  return (
    <Checkbox
      isChecked={showPriceMeasure}
      onChange={event => setShowPriceMeasure(event.target.checked)}
      size="sm"
      // Theme's unchecked control blends into the chart card — give it a visible outline.
      // global.css forces `border-color: inherit !important` on focused elements, and the
      // control keeps focus after a click, so the root must carry the same border colour.
      sx={{
        borderColor: 'font.secondary',
        '.chakra-checkbox__control:not([data-checked])': {
          borderColor: 'font.secondary',
          borderWidth: '1.5px',
        },
      }}
      whiteSpace="nowrap"
    >
      <Text color="font.secondary" fontSize="xs">
        Show price impact
      </Text>
    </Checkbox>
  )
}
