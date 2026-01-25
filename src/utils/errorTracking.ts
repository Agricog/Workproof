/**
 * WorkProof Error Tracking
 * Sentry integration with PII filtering
 */

import * as Sentry from '@sentry/react'

/**
 * Initialize Sentry error tracking
 */
export function initializeSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN

  if (!dsn) {
    console.warn('Sentry DSN not configured - error tracking disabled')
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD,

    // Sample rates
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Filter sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['Authorization']
        delete event.request.headers['X-CSRF-Token']
        delete event.request.headers['Cookie']
      }

      // Remove user PII
      if (event.user) {
        delete event.user.email
        delete event.user.ip_address
      }

      // Redact URLs with sensitive params
      if (event.request?.url) {
        event.request.url = redactUrl(event.request.url)
      }

      return event
    },

    // Filter breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Redact sensitive URLs in breadcrumbs
      if (breadcrumb.data?.url) {
        breadcrumb.data.url = redactUrl(breadcrumb.data.url)
      }
      return breadcrumb
    },
  })
}

/**
 * Redact sensitive query parameters from URLs
 */
function redactUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const sensitiveParams = ['token', 'key', 'password', 'secret', 'auth']

    sensitiveParams.forEach((param) => {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '[REDACTED]')
      }
    })

    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * Capture a general error
 */
export function captureError(
  error: unknown,
  context?: string,
  extra?: Record<string, unknown>
): void {
  console.error(`[${context || 'Error'}]`, error)

  Sentry.captureException(error, {
    tags: {
      context: context || 'unknown',
    },
    extra,
  })
}

/**
 * Capture a calculator/form error
 */
export function captureCalculatorError(error: unknown, context: string): void {
  captureError(error, `calculator:${context}`, {
    type: 'calculator_error',
  })
}

/**
 * Capture a sync error
 */
export function captureSyncError(
  error: unknown,
  context: string,
  itemCount?: number
): void {
  captureError(error, `sync:${context}`, {
    type: 'sync_error',
    itemCount,
  })
}

/**
 * Capture an upload error
 */
export function captureUploadError(
  error: unknown,
  context: string,
  fileSize?: number
): void {
  captureError(error, `upload:${context}`, {
    type: 'upload_error',
    fileSize,
  })
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: string, orgId?: string): void {
  Sentry.setUser({
    id: userId,
  })

  if (orgId) {
    Sentry.setTag('org_id', orgId)
  }
}

/**
 * Clear user context on logout
 */
export function clearUserContext(): void {
  Sentry.setUser(null)
}

/**
 * Error Fallback Component
 */
export function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error
  resetErrorBoundary: () => void
}): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Something went wrong
        </h2>
        <p className="text-gray-600 mb-4 text-sm">
          {error.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={resetErrorBoundary}
          className="w-full py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
