import { describe, expect, it } from 'vitest'
import { proxyExternalImageUrl } from './image-proxy'

describe('proxyExternalImageUrl', () => {
  it('rewrites coingecko and subdomain image urls to the local image proxy', () => {
    expect(proxyExternalImageUrl('https://assets.coingecko.com/coins/1/icon.png')).toBe(
      '/api/proxy/image?url=https%3A%2F%2Fassets.coingecko.com%2Fcoins%2F1%2Ficon.png'
    )

    expect(proxyExternalImageUrl('https://coin-images.coingecko.com/coins/1/icon.png')).toBe(
      '/api/proxy/image?url=https%3A%2F%2Fcoin-images.coingecko.com%2Fcoins%2F1%2Ficon.png'
    )
  })

  it('leaves unrelated domains unchanged even when ending with similar text', () => {
    expect(proxyExternalImageUrl('https://notcoingecko.com/icon.png')).toBe(
      'https://notcoingecko.com/icon.png'
    )
  })
})
