import { logServerEvent } from './server-log'
import { mins } from './time'

export enum SupportedCurrency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  JPY = 'JPY',
  CNY = 'CNY',
  BTC = 'BTC',
  ETH = 'ETH',
}

export type FxRates = Record<SupportedCurrency, { code: string; value: number }>
type FxRatesResponse = {
  data?: FxRates
}

export function symbolForCurrency(currency: SupportedCurrency): string {
  switch (currency) {
    case SupportedCurrency.USD:
      return '$'
    case SupportedCurrency.EUR:
      return '€'
    case SupportedCurrency.GBP:
      return '£'
    case SupportedCurrency.JPY:
      return '¥'
    case SupportedCurrency.CNY:
      return '¥'
    case SupportedCurrency.BTC:
      return '₿'
    case SupportedCurrency.ETH:
      return 'Ξ'
    default:
      return '$'
  }
}

const FX_RATES_URL = 'https://api.currencyapi.com/v3/latest'
const FX_RATES_TIMEOUT_MS = 5_000
const FX_RATES_MAX_ATTEMPTS = 3
const FX_RATES_RETRY_DELAY_MS = 250

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function getFxRates(): Promise<FxRates | undefined> {
  const apiKey = process.env.CURRENCYAPI_KEY?.trim()
  if (!apiKey) return undefined

  let lastError: unknown

  for (let attempt = 1; attempt <= FX_RATES_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${FX_RATES_URL}?apikey=${encodeURIComponent(apiKey)}`, {
        next: { revalidate: mins(5).toSecs() },
        signal: AbortSignal.timeout(FX_RATES_TIMEOUT_MS),
      })

      if (!res.ok) {
        const statusError = new Error(`FX rates request failed with status ${res.status}`)

        if (!isRetryableStatus(res.status)) {
          logServerEvent({
            level: 'error',
            source: 'fx-rates',
            category: 'fx_rates_fetch',
            status: res.status,
            message: `Unable to fetch FX rates: ${statusError.message}`,
          })

          return undefined
        }

        throw statusError
      }

      const { data: rates } = (await res.json()) as FxRatesResponse
      return rates
    } catch (error) {
      lastError = error

      if (attempt < FX_RATES_MAX_ATTEMPTS) {
        await delay(FX_RATES_RETRY_DELAY_MS * attempt)
      }
    }
  }

  const baseReason = lastError instanceof Error ? lastError.message : String(lastError)

  const causeReason =
    lastError instanceof Error && lastError.cause instanceof Error
      ? lastError.cause.message
      : undefined

  const rawReason = causeReason ? `${baseReason} (${causeReason})` : baseReason
  const reason = apiKey ? rawReason.replaceAll(apiKey, '[REDACTED]') : rawReason

  logServerEvent({
    level: 'error',
    source: 'fx-rates',
    category: 'fx_rates_fetch',
    errorName: lastError instanceof Error ? lastError.name : undefined,
    message: `Unable to fetch FX rates: ${reason}`,
  })

  return undefined
}
