import { describe, expect, it } from 'vitest'
import {
  buildTxBatch,
  getPendingNestedSteps,
  hasSomePendingNestedTxInBatch,
  isTxBatchReady,
} from './tx-batch.helpers'

describe('buildTxBatch', () => {
  it('builds a single-element batch when there are no nested steps', () => {
    const step = { batchableTxCall: { to: '0xaaa', value: 1n } } as any
    expect(buildTxBatch(step)).toEqual([{ to: '0xaaa', value: 1n }])
  })

  it('keeps the value as bigint (converted to string at the submitter boundary)', () => {
    const step = { batchableTxCall: { to: '0xaaa' } } as any
    expect(buildTxBatch(step)).toEqual([{ to: '0xaaa' }])
  })

  it('prepends pending nested step calls and always appends the parent call', () => {
    const step = {
      nestedSteps: [
        { isComplete: () => false, batchableTxCall: { to: '0xbbb' } },
        { isComplete: () => true, batchableTxCall: { to: '0xccc' } },
      ],
      batchableTxCall: { to: '0xaaa' },
    } as any

    expect(buildTxBatch(step)).toEqual([{ to: '0xbbb' }, { to: '0xaaa' }])
  })

  it('omits undefined calls when step calldata is still loading', () => {
    const step = {
      nestedSteps: [{ isComplete: () => false, batchableTxCall: undefined }],
      batchableTxCall: undefined,
    } as any

    expect(buildTxBatch(step)).toEqual([])
  })
})

describe('isTxBatchReady', () => {
  it('returns false when parent or pending nested calls are missing', () => {
    expect(isTxBatchReady({ batchableTxCall: undefined } as any)).toBe(false)

    expect(
      isTxBatchReady({
        batchableTxCall: { to: '0xaaa', data: '0x' },
        nestedSteps: [{ isComplete: () => false, batchableTxCall: undefined }],
      } as any)
    ).toBe(false)
  })

  it('returns true when parent and all pending nested calls are built', () => {
    expect(
      isTxBatchReady({
        batchableTxCall: { to: '0xaaa', data: '0x' },
        nestedSteps: [
          { isComplete: () => false, batchableTxCall: { to: '0xbbb', data: '0x' } },
          { isComplete: () => true, batchableTxCall: undefined },
        ],
      } as any)
    ).toBe(true)
  })
})

describe('getPendingNestedSteps / hasSomePendingNestedTxInBatch', () => {
  const pendingStep = { isComplete: () => false }
  const completedStep = { isComplete: () => true }

  it('filters out completed nested steps', () => {
    const step = { nestedSteps: [pendingStep, completedStep] } as any
    expect(getPendingNestedSteps(step)).toHaveLength(1)
  })

  it('returns true when any nested step is pending', () => {
    const step = { nestedSteps: [pendingStep, completedStep] } as any
    expect(hasSomePendingNestedTxInBatch(step)).toBe(true)
  })

  it('returns false when all nested steps are complete or absent', () => {
    expect(hasSomePendingNestedTxInBatch({ nestedSteps: [completedStep] } as any)).toBe(false)
    expect(hasSomePendingNestedTxInBatch({} as any)).toBe(false)
  })
})
