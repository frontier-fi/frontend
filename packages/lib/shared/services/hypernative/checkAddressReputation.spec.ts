import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkAddressReputation } from './checkAddressReputation'

const VALID_ADDRESS = '0x1111111111111111111111111111111111111111'

describe('checkAddressReputation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 400 without calling Hypernative when address is invalid', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await checkAddressReputation({
      address: 'not-a-valid-address',
      hypernativeApiId: 'id',
      hypernativeApiSecret: 'secret',
    })

    expect(res.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('logs structured error with upstream HTTP status and fails open when Hypernative returns non-2xx', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Service Unavailable', { status: 503 })
    )

    const res = await checkAddressReputation({
      address: VALID_ADDRESS,
      hypernativeApiId: 'id',
      hypernativeApiSecret: 'secret',
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ isAuthorized: true })
    expect(errorSpy).toHaveBeenCalledOnce()

    const logged = JSON.parse(errorSpy.mock.calls[0]?.[0] as string)

    expect(logged).toMatchObject({
      level: 'error',
      source: 'hypernative',
      status: 503,
      address: VALID_ADDRESS,
      message: 'Failed to fetch reputation. Response status: 503',
    })
  })

  it('logs 504 on upstream timeout and fails open', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    )

    const res = await checkAddressReputation({
      address: VALID_ADDRESS,
      hypernativeApiId: 'id',
      hypernativeApiSecret: 'secret',
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ isAuthorized: true })
    expect(errorSpy).toHaveBeenCalledOnce()

    const logged = JSON.parse(errorSpy.mock.calls[0]?.[0] as string)

    expect(logged).toMatchObject({
      level: 'error',
      source: 'hypernative',
      status: 504,
      errorName: 'TimeoutError',
      address: VALID_ADDRESS,
    })
  })
})
