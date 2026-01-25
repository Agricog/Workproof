/**
 * WorkProof Session Timeout
 * Protect authenticated sessions from hijacking
 * Auto-logout after inactivity (30 min for field work)
 */

import { useEffect, useRef, useCallback } from 'react'
import { SESSION_CONFIG } from '../types/security'

interface UseSessionTimeoutOptions {
  onTimeout: () => void
  onWarning?: () => void
  warningBeforeMs?: number
}

export function useSessionTimeout(options: UseSessionTimeoutOptions): void {
  const { onTimeout, onWarning, warningBeforeMs = 60000 } = options
  
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const absoluteTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const sessionStartRef = useRef<number>(Date.now())

  const clearTimeouts = useCallback(() => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
      idleTimeoutRef.current = null
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
      warningTimeoutRef.current = null
    }
  }, [])

  const resetIdleTimeout = useCallback(() => {
    clearTimeouts()

    // Warning before timeout
    if (onWarning) {
      warningTimeoutRef.current = setTimeout(() => {
        onWarning()
      }, SESSION_CONFIG.idleTimeout - warningBeforeMs)
    }

    // Idle timeout
    idleTimeoutRef.current = setTimeout(() => {
      onTimeout()
    }, SESSION_CONFIG.idleTimeout)
  }, [clearTimeouts, onTimeout, onWarning, warningBeforeMs])

  useEffect(() => {
    // Track user activity
    const activityEvents = [
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'mousemove',
    ]

    const handleActivity = () => {
      resetIdleTimeout()
    }

    // Throttle activity handler
    let lastActivity = Date.now()
    const throttledHandler = () => {
      const now = Date.now()
      if (now - lastActivity > 1000) {
        lastActivity = now
        handleActivity()
      }
    }

    activityEvents.forEach((event) => {
      window.addEventListener(event, throttledHandler, { passive: true })
    })

    // Absolute session timeout (8 hours)
    absoluteTimeoutRef.current = setTimeout(() => {
      onTimeout()
    }, SESSION_CONFIG.absoluteTimeout)

    // Start idle tracking
    resetIdleTimeout()

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, throttledHandler)
      })
      clearTimeouts()
      if (absoluteTimeoutRef.current) {
        clearTimeout(absoluteTimeoutRef.current)
      }
    }
  }, [resetIdleTimeout, clearTimeouts, onTimeout])

  // Handle visibility change (tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if session has expired while tab was hidden
        const elapsed = Date.now() - sessionStartRef.current
        if (elapsed > SESSION_CONFIG.absoluteTimeout) {
          onTimeout()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [onTimeout])
}

// ============================================================================
// SESSION STORAGE HELPERS
// ============================================================================

const SESSION_START_KEY = 'workproof_session_start'
const LAST_ACTIVITY_KEY = 'workproof_last_activity'

export function initSession(): void {
  const now = Date.now().toString()
  sessionStorage.setItem(SESSION_START_KEY, now)
  sessionStorage.setItem(LAST_ACTIVITY_KEY, now)
}

export function updateActivity(): void {
  sessionStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString())
}

export function getSessionDuration(): number {
  const start = sessionStorage.getItem(SESSION_START_KEY)
  if (!start) return 0
  return Date.now() - parseInt(start, 10)
}

export function getIdleTime(): number {
  const lastActivity = sessionStorage.getItem(LAST_ACTIVITY_KEY)
  if (!lastActivity) return 0
  return Date.now() - parseInt(lastActivity, 10)
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_START_KEY)
  sessionStorage.removeItem(LAST_ACTIVITY_KEY)
}

export function isSessionValid(): boolean {
  const duration = getSessionDuration()
  const idle = getIdleTime()
  
  return (
    duration < SESSION_CONFIG.absoluteTimeout &&
    idle < SESSION_CONFIG.idleTimeout
  )
}
