/**
 * WorkProof Error Tracking
 * Sentry integration for production error monitoring
 * Filters sensitive data before sending
 */

import * as Sentry from '@sentry/react'

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initializeSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN

  if (!dsn) {
    console.warn('Sentry DSN not configured - error tracking disabled')
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    beforeSend(event) {
      // Filter sensitive data
      if (event.request?.headers) {
        delete event.request.headers['Authorization']
        delete event.request.headers['X-CSRF-Token']
        delete event.request.headers['Cookie']
      }

      // Redact user data
      if (event.user) {
        delete event.user.email
        delete event.user.ip_address
      }

      // Filter breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((crumb) => {
          if (crumb.data?.url) {
            crumb.data.url = redactUrl(crumb.data.url)
          }
          return crumb
        })
      }

      return event
    },
  })
}

// ============================================================================
// ERROR CAPTURE
// ============================================================================

export function captureError(
  error: unknown,
  context: string,
  extras?: Record<string, unknown>
): void {
  console.error(`[${context}]`, error)

  Sentry.captureException(error, {
    tags: {
      context,
      type: 'application_error',
    },
    extra: {
      ...extras,
      timestamp: new Date().toISOString(),
    },
  })
}

export function captureCalculatorError(error: unknown, context: string): void {
  captureError(error, context, { category: 'calculator' })
}

export function captureSyncError(
  error: unknown,
  entityType: string,
  entityId: string
): void {
  captureError(error, 'sync_error', {
    category: 'sync',
    entityType,
    entityId,
  })
}

export function captureUploadError(error: unknown, fileType: string): void {
  captureError(error, 'upload_error', {
    category: 'upload',
    fileType,
  })
}

// ============================================================================
// USER CONTEXT
// ============================================================================

export function setUserContext(userId: string, orgId: string): void {
  Sentry.setUser({
    id: userId,
    // Don't include email or other PII
  })

  Sentry.setTag('org_id', orgId)
}

export function clearUserContext(): void {
  Sentry.setUser(null)
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

export function startTransaction(
  name: string,
  operation: string
): Sentry.Span | undefined {
  return Sentry.startInactiveSpan({
    name,
    op: operation,
  })
}

// ============================================================================
// HELPERS
// ============================================================================

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Remove query params that might contain sensitive data
    parsed.search = ''
    return parsed.toString()
  } catch {
    return '[redacted-url]'
  }
}

// ============================================================================
// ERROR BOUNDARY FALLBACK
// ============================================================================

export function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error
  resetErrorBoundary: () => void
}): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
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
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Something went wrong
        </h2>
        <p className="text-gray-600 mb-4">
          We've been notified and are working on a fix.
        </p>
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
