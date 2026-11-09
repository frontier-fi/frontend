import { describe, expect, it } from 'vitest'
import { ErrorWithCauses, ensureError, isFailedToFetchApolloError, parseError } from './errors'

describe('errors utils', () => {
  describe('ensureError', () => {
    it('returns an existing Error instance unchanged', () => {
      const original = new Error('boom')
      expect(ensureError(original)).toBe(original)
    })

    it('wraps non-Error values in an Error with shortMessage', () => {
      const wrapped = ensureError({ code: 4001, reason: 'rejected' })
      expect(wrapped).toBeInstanceOf(Error)
      expect(wrapped.message).toContain('{"code":4001,"reason":"rejected"}')
      expect(wrapped.shortMessage).toBe('{"code":4001,"reason":"rejected"}')
    })
  })

  describe('parseError', () => {
    it('extracts message from string or Error and returns undefined otherwise', () => {
      expect(parseError('plain error')).toBe('plain error')
      expect(parseError(new Error('from error'))).toBe('from error')
      expect(parseError(123)).toBeUndefined()
    })
  })

  describe('isFailedToFetchApolloError', () => {
    it('identifies Failed to fetch errors', () => {
      expect(isFailedToFetchApolloError(new Error('Failed to fetch'))).toBe(true)
      expect(isFailedToFetchApolloError(new Error('Other network error'))).toBe(false)
    })
  })

  describe('ErrorWithCauses', () => {
    it('stores structured causes on the error instance', () => {
      const causes = [{ id: '1', title: 'Swap failed', description: 'Slippage exceeded' }]
      const err = new ErrorWithCauses('Composite failure', causes)
      expect(err.message).toBe('Composite failure')
      expect(err.causes).toEqual(causes)
    })
  })
})
