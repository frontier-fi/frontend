import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAndMapMetadata, lowerCaseAddresses } from './fetchAndLowercaseAddresses'

type TestMetadata = {
  id: string
  addresses: Record<string, string[]>
}

describe('fetchAndLowercaseAddresses', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches and lowercases metadata addresses on 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 'hook_1',
            addresses: {
              '11155111': ['0xAbCdEf0000000000000000000000000000001234'],
            },
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    const result = await fetchAndMapMetadata<TestMetadata>(
      'https://example.com/hooks/index.json',
      lowerCaseAddresses
    )

    expect(result).toEqual([
      {
        id: 'hook_1',
        addresses: {
          '11155111': ['0xabcdef0000000000000000000000000000001234'],
        },
      },
    ])
  })

  it('logs structured warn JSON via logServerEvent and returns undefined on non-2xx or network error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not Found', { status: 404 }))

    const result = await fetchAndMapMetadata<TestMetadata>(
      'https://example.com/hooks/index.json',
      lowerCaseAddresses
    )

    expect(result).toBeUndefined()
    expect(warnSpy).toHaveBeenCalledOnce()

    const logged = JSON.parse(warnSpy.mock.calls[0]?.[0] as string)

    expect(logged).toMatchObject({
      level: 'warn',
      source: 'pool-metadata',
      category: 'pool_metadata',
      url: 'https://example.com/hooks/index.json',
      message: 'Unable to fetch metadata from https://example.com/hooks/index.json: HTTP 404',
    })
  })
})
