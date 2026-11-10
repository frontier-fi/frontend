// Ensures returned value is an Error type.
export function ensureError(value: unknown): Error & { shortMessage?: string; digest?: string } {
  if (value instanceof Error) return value

  let stringified = '[Unable to stringify thrown value]'

  try {
    stringified = JSON.stringify(value)
  } catch {
    /* empty */
  }

  const shortMessage = stringified

  const error = new ErrorWithShortMessage(
    `This value was thrown as is, not through an Error: ${stringified}`,
    shortMessage
  )

  return error
}

class ErrorWithShortMessage extends Error {
  shortMessage: string

  constructor(message: string, shortMessage: string) {
    super(message)
    this.shortMessage = shortMessage

    Object.setPrototypeOf(this, ErrorWithShortMessage.prototype)
  }
}

/**
 * Extracts message string from any Error
 * @param error
 */
export function parseError(error: unknown) {
  if (typeof error === 'string') return error

  if (error instanceof Error) {
    return error.message
  }

  return undefined
}

export const swapApolloNetworkErrorMessage = 'Apollo network error in DefaultSwapHandler'

/*
  This kind of error is thrown from apollo client when the request fails without a clear error code.
  Causes could be:
  - Connectivity issues
  - Browser or extensions blocking the request
  - CORS issues
*/
export function isFailedToFetchApolloError(error: Error): boolean {
  return error.message === 'Failed to fetch'
}

export type ErrorCause = {
  id: string
  title: string
  description: string
}

export class ErrorWithCauses extends Error {
  causes: ErrorCause[]

  constructor(message: string, causes: ErrorCause[]) {
    super(message)
    this.causes = causes
  }
}
