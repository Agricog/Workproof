import * as Sentry from '@sentry/react'

export function initializeSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) {
    console.warn('Sentry DSN not configured')
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  })
}

export function captureError(error: unknown, context?: string): void {
  console.error(context || 'Error', error)
  Sentry.captureException(error, {
    tags: { context: context || 'unknown' },
  })
}

export function captureCalculatorError(error: unknown, context: string): void {
  captureError(error, 'calculator:' + context)
}

export function captureSyncError(error: unknown, context: string): void {
  captureError(error, 'sync:' + context)
}

export function captureUploadError(error: unknown, context: string): void {
  captureError(error, 'upload:' + context)
}

export function setUserContext(userId: string): void {
  Sentry.setUser({ id: userId })
}

export function clearUserContext(): void {
  Sentry.setUser(null)
}
