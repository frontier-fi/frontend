import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFxRates, hasValidFxRates, SupportedCurrency, symbolForCurrency } from './currencies'

describe('currencies', () => {
  const originalApiKey = process.env.CURRENCYAPI_KEY
  const originalAppEnv = process.env.NEXT_PUBLIC_APP_ENV

  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.NEXT_PUBLIC_APP_ENV = 'prod'
  })

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.CURRENCYAPI_KEY
    } else {
      process.env.CURRENCYAPI_KEY = originalApiKey
    }

    if (originalAppEnv === undefined) {
      delete process.env.NEXT_PUBLIC_APP_ENV
    } else {
      process.env.NEXT_PUBLIC_APP_ENV = originalAppEnv
    }
  })

  it('returns the expected currency symbol', () => {
    expect(symbolForCurrency(SupportedCurrency.USD)).toBe('$')
    expect(symbolForCurrency(SupportedCurrency.EUR)).toBe('€')
    expect(symbolForCurrency(SupportedCurrency.GBP)).toBe('£')
    expect(symbolForCurrency(SupportedCurrency.BTC)).toBe('₿')
    expect(symbolForCurrency(SupportedCurrency.ETH)).toBe('Ξ')
  })

  it('skips fetching in dev even when CURRENCYAPI_KEY is configured', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'dev'
    process.env.CURRENCYAPI_KEY = 'test-key'
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const rates = await getFxRates()

    expect(rates).toBeUndefined()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('skips fetching when CURRENCYAPI_KEY is not configured', async () => {
    delete process.env.CURRENCYAPI_KEY
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const rates = await getFxRates()

    expect(rates).toBeUndefined()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fetches FX rates with a timeout signal when CURRENCYAPI_KEY is set in prod', async () => {
    process.env.CURRENCYAPI_KEY = 'test-key'

    const mockRates = {
      USD: { code: 'USD', value: 1 },
      EUR: { code: 'EUR', value: 0.92 },
    }

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ data: mockRates }), { status: 200 }))

    const rates = await getFxRates()

    expect(rates).toEqual(mockRates)
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      'https://api.currencyapi.com/v3/latest?apikey=test-key'
    )

    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('retries transient ECONNRESET failures and succeeds on subsequent attempt', async () => {
    process.env.CURRENCYAPI_KEY = 'test-key'

    const mockRates = {
      USD: { code: 'USD', value: 1 },
    }

    const resetError = new TypeError('fetch failed', {
      cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
    })

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(resetError)
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: mockRates }), { status: 200 }))

    const rates = await getFxRates()

    expect(rates).toEqual(mockRates)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('does not retry non-retryable 4xx responses and does not parse body as FX rates', async () => {
    process.env.CURRENCYAPI_KEY = 'invalid-key'
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid authentication credentials' }), {
        status: 401,
      })
    )

    const rates = await getFxRates()

    expect(rates).toBeUndefined()
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    expect(errorSpy).toHaveBeenCalledWith(
      'Unable to fetch FX rates:',
      'FX rates request failed with status 401'
    )
  })

  it('does not retry when monthly quota is exhausted (429 with zero remaining month quota)', async () => {
    process.env.CURRENCYAPI_KEY = 'exhausted-key'
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'You have hit your rate limit or your monthly limit.',
        }),
        {
          status: 429,
          headers: { 'x-ratelimit-remaining-quota-month': '0' },
        }
      )
    )

    const rates = await getFxRates()

    expect(rates).toBeUndefined()
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    expect(errorSpy).toHaveBeenCalledWith(
      'Unable to fetch FX rates:',
      'FX rates monthly quota exhausted (status 429)'
    )
  })

  it('returns undefined when response payload contains no valid currency rates', async () => {
    process.env.CURRENCYAPI_KEY = 'test-key'

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), { status: 200 })
    )

    const rates = await getFxRates()

    expect(rates).toBeUndefined()
    expect(hasValidFxRates(undefined)).toBe(false)
    expect(hasValidFxRates({})).toBe(false)
  })
})
