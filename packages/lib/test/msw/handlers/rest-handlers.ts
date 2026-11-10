import { http, HttpResponse } from 'msw'

// Capture real setTimeout before any test calls vi.useFakeTimers()
const realSetTimeout = globalThis.setTimeout.bind(globalThis)
const realDelay = (ms: number) => new Promise(resolve => realSetTimeout(resolve, ms))

export const defaultPostMswHandlers = [
  // Handle happy-dom's CORS preflights locally instead of hitting the real network.
  http.options('*', () => {
    return new HttpResponse(null, {
      status: 200,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': '*',
        'access-control-allow-headers': '*',
      },
    })
  }),
  http.post(/^http:\/\/127\.0\.0\.1:8\d+\/.*/, async () => {
    await realDelay(200)
    return HttpResponse.json({})
  }),
  http.get('/', () => HttpResponse.text('')),
]
