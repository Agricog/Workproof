/**
 * WorkProof Secure Fetch Hook
 * CSRF protection + SSRF prevention
 * AUTAIMATE BUILD STANDARD v2 - OWASP Compliant
 */

import { useState, useCallback } from 'react'
import { captureError } from '../utils/errorTracking'

interface FetchState<T> {
  data: T | null
  error: string | null
  isLoading: boolean
}

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: Record<string, unknown>
  headers?: Record<string, string>
  csrfToken?: string
}

interface UseFetchReturn<T> {
  data: T | null
  error: string | null
  isLoading: boolean
  execute: (endpoint: string, options?: FetchOptions) => Promise<T | null>
  reset: () => void
}

export function useFetch<T = unknown>(): UseFetchReturn<T> {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    error: null,
    isLoading: false,
  })

  const execute = useCallback(async (
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<T | null> => {
    // SSRF Protection: Only allow relative URLs
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      const error = 'SSRF protection: Use relative URLs only'
      setState({ data: null, error, isLoading: false })
      captureError(new Error(error), 'useFetch.ssrf_blocked')
      return null
    }

    // Ensure endpoint starts with /
    const safeEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
      }

      // Add CSRF token if provided
      if (options.csrfToken) {
        headers['X-CSRF-Token'] = options.csrfToken
      }

      const response = await fetch(safeEndpoint, {
        method: options.method || 'GET',
        credentials: 'include', // Send cookies for session
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      })

      // Handle non-OK responses
      if (!response.ok) {
        let errorMessage = 'Request failed'

        // Don't leak sensitive error details
        if (response.status === 401) {
          errorMessage = 'Please sign in to continue'
        } else if (response.status === 403) {
          errorMessage = 'You do not have permission to do this'
        } else if (response.status === 404) {
          errorMessage = 'Not found'
        } else if (response.status === 429) {
          errorMessage = 'Too many requests. Please wait and try again.'
        } else if (response.status >= 500) {
          errorMessage = 'Server error. Please try again later.'
        }

        setState({ data: null, error: errorMessage, isLoading: false })
        captureError(new Error(`HTTP ${response.status}`), `useFetch.${safeEndpoint}`)
        return null
      }

      // Parse response
      const data = await response.json() as T
      setState({ data, error: null, isLoading: false })
      return data

    } catch (err) {
      const errorMessage = 'Network error. Please check your connection.'
      setState({ data: null, error: errorMessage, isLoading: false })
      captureError(err, `useFetch.${safeEndpoint}`)
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setState({ data: null, error: null, isLoading: false })
  }, [])

  return {
    data: state.data,
    error: state.error,
    isLoading: state.isLoading,
    execute,
    reset,
  }
}

/**
 * Simple fetch wrapper for one-off requests
 * Use useFetch hook for component state management
 */
export async function secureFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<{ data: T | null; error: string | null }> {
  // SSRF Protection
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return { data: null, error: 'Use relative URLs only' }
  }

  const safeEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (options.csrfToken) {
      headers['X-CSRF-Token'] = options.csrfToken
    }

    const response = await fetch(safeEndpoint, {
      method: options.method || 'GET',
      credentials: 'include',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    if (!response.ok) {
      return { data: null, error: `Request failed: ${response.status}` }
    }

    const data = await response.json() as T
    return { data, error: null }

  } catch (err) {
    captureError(err, `secureFetch.${safeEndpoint}`)
    return { data: null, error: 'Network error' }
  }
}
