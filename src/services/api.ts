/**
 * WorkProof API Service
 * Secure API calls with CSRF protection
 * NEVER expose API keys - all sensitive calls through backend
 */

import { ensureCsrfToken, clearCsrfToken } from '../utils/csrf'
import { captureError } from '../utils/errorTracking'
import { validateRelativeUrl } from '../utils/validation'
import type { ApiResult, ApiError } from '../types/api'

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
}

// ============================================================================
// CORE FETCH FUNCTION
// ============================================================================

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: Record<string, unknown>
  headers?: Record<string, string>
  requiresCsrf?: boolean
  timeout?: number
}

export async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<ApiResult<T>> {
  const {
    method = 'GET',
    body,
    headers = {},
    requiresCsrf = method !== 'GET',
    timeout = 30000,
  } = options

  // SSRF Prevention - only allow relative URLs
  if (!validateRelativeUrl(endpoint)) {
    const error: ApiError = {
      success: false,
      error: {
        code: 'INVALID_URL',
        message: 'Only relative URLs are allowed',
      },
    }
    return error
  }

  const url = `${API_BASE_URL}${endpoint}`

  try {
    const requestHeaders: Record<string, string> = {
      ...DEFAULT_HEADERS,
      ...headers,
    }

    // Add CSRF token for state-changing requests
    if (requiresCsrf) {
      try {
        const csrfToken = await ensureCsrfToken()
        requestHeaders['X-CSRF-Token'] = csrfToken
      } catch {
        // Continue without CSRF if token fetch fails
        console.warn('CSRF token unavailable')
      }
    }

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Handle CSRF token expiry
    if (response.status === 403) {
      clearCsrfToken()
    }

    // Parse response
    const data = await response.json()

    if (!response.ok) {
      const error: ApiError = {
        success: false,
        error: {
          code: data.code || `HTTP_${response.status}`,
          message: data.message || 'Request failed',
          details: data.details,
        },
      }
      return error
    }

    return {
      success: true,
      data: data as T,
    }
  } catch (err) {
    const error = err as Error

    // Don't log abort errors
    if (error.name !== 'AbortError') {
      captureError(error, 'apiFetch', { endpoint, method })
    }

    const apiError: ApiError = {
      success: false,
      error: {
        code: error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
        message:
          error.name === 'AbortError'
            ? 'Request timed out'
            : 'Network error. Please check your connection.',
      },
    }

    return apiError
  }
}

// ============================================================================
// CONVENIENCE METHODS
// ============================================================================

export const api = {
  get: <T>(endpoint: string, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    apiFetch<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(
    endpoint: string,
    body: Record<string, unknown>,
    options?: Omit<FetchOptions, 'method' | 'body'>
  ) => apiFetch<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T>(
    endpoint: string,
    body: Record<string, unknown>,
    options?: Omit<FetchOptions, 'method' | 'body'>
  ) => apiFetch<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T>(
    endpoint: string,
    body: Record<string, unknown>,
    options?: Omit<FetchOptions, 'method' | 'body'>
  ) => apiFetch<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T>(endpoint: string, options?: Omit<FetchOptions, 'method'>) =>
    apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isApiError(result: ApiResult<unknown>): result is ApiError {
  return !result.success
}

export function isApiSuccess<T>(
  result: ApiResult<T>
): result is { success: true; data: T } {
  return result.success
}

// ============================================================================
// ERROR HELPERS
// ============================================================================

export function getErrorMessage(result: ApiError): string {
  return result.error.message
}

export function getErrorCode(result: ApiError): string {
  return result.error.code
}
