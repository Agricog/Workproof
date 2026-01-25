/**
 * WorkProof CSRF Protection
 * Protect state-changing operations with CSRF tokens
 */

import type { CsrfToken, CsrfValidation } from '../types/security'

const CSRF_HEADER = 'X-CSRF-Token'
const CSRF_STORAGE_KEY = 'workproof_csrf'

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

export async function getCsrfToken(): Promise<string> {
  try {
    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to get CSRF token')
    }

    const data: CsrfToken = await response.json()
    
    // Store token with expiry
    sessionStorage.setItem(
      CSRF_STORAGE_KEY,
      JSON.stringify({
        token: data.token,
        expiresAt: data.expiresAt,
      })
    )

    return data.token
  } catch (error) {
    console.error('CSRF token fetch failed:', error)
    throw error
  }
}

export function getStoredCsrfToken(): string | null {
  try {
    const stored = sessionStorage.getItem(CSRF_STORAGE_KEY)
    if (!stored) return null

    const data: CsrfToken = JSON.parse(stored)
    
    // Check expiry
    if (Date.now() > data.expiresAt) {
      sessionStorage.removeItem(CSRF_STORAGE_KEY)
      return null
    }

    return data.token
  } catch {
    return null
  }
}

export async function ensureCsrfToken(): Promise<string> {
  const stored = getStoredCsrfToken()
  if (stored) return stored
  return getCsrfToken()
}

export function clearCsrfToken(): void {
  sessionStorage.removeItem(CSRF_STORAGE_KEY)
}

// ============================================================================
// SECURE FORM SUBMISSION
// ============================================================================

export async function submitWithCsrf<T>(
  endpoint: string,
  data: Record<string, unknown>,
  method: 'POST' | 'PUT' | 'DELETE' = 'POST'
): Promise<T> {
  const csrfToken = await ensureCsrfToken()

  const response = await fetch(endpoint, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      [CSRF_HEADER]: csrfToken,
    },
    body: JSON.stringify(data),
  })

  if (response.status === 403) {
    // Token may have expired, refresh and retry once
    clearCsrfToken()
    const newToken = await getCsrfToken()
    
    const retryResponse = await fetch(endpoint, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        [CSRF_HEADER]: newToken,
      },
      body: JSON.stringify(data),
    })

    if (!retryResponse.ok) {
      throw new Error(`Request failed: ${retryResponse.status}`)
    }

    return retryResponse.json()
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json()
}

// ============================================================================
// VALIDATION (Server-side helper types)
// ============================================================================

export function validateCsrfToken(
  token: string | null,
  expectedToken: string,
  expiresAt: number
): CsrfValidation {
  if (!token) {
    return { isValid: false, reason: 'missing' }
  }

  if (Date.now() > expiresAt) {
    return { isValid: false, reason: 'expired' }
  }

  if (token !== expectedToken) {
    return { isValid: false, reason: 'invalid' }
  }

  return { isValid: true }
}
