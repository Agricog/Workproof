import { useEffect, useCallback, useRef } from 'react'

interface SessionTimeoutConfig {
  idleTimeoutMs?: number
  absoluteTimeoutMs?: number
  onTimeout: () => void
  enabled?: boolean
}

const DEFAULT_IDLE_TIMEOUT = 30 * 60 * 1000 // 30 minutes
const DEFAULT_ABSOLUTE_TIMEOUT = 8 * 60 * 60 * 1000 // 8 hours

export function useSessionTimeout({
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT,
  absoluteTimeoutMs = DEFAULT_ABSOLUTE_TIMEOUT,
  onTimeout,
  enabled = true,
}: SessionTimeoutConfig) {
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const absoluteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionStartRef = useRef<number>(Date.now())

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
    if (absoluteTimerRef.current) {
      clearTimeout(absoluteTimerRef.current)
      absoluteTimerRef.current = null
    }
  }, [])

  const resetIdleTimer = useCallback(() => {
    if (!enabled) return

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
    }

    idleTimerRef.current = setTimeout(() => {
      console.log('Session idle timeout reached')
      onTimeout()
    }, idleTimeoutMs)
  }, [enabled, idleTimeoutMs, onTimeout])

  const startAbsoluteTimer = useCallback(() => {
    if (!enabled) return

    sessionStartRef.current = Date.now()

    absoluteTimerRef.current = setTimeout(() => {
      console.log('Session absolute timeout reached')
      onTimeout()
    }, absoluteTimeoutMs)
  }, [enabled, absoluteTimeoutMs, onTimeout])

  useEffect(() => {
    if (!enabled) {
      clearTimers()
      return
    }

    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ]

    const handleActivity = () => {
      resetIdleTimer()
    }

    activityEvents.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    resetIdleTimer()
    startAbsoluteTimer()

    return () => {
      activityEvents.forEach((event) => {
        document.removeEventListener(event, handleActivity)
      })
      clearTimers()
    }
  }, [enabled, resetIdleTimer, startAbsoluteTimer, clearTimers])

  const getRemainingTime = useCallback(() => {
    const elapsed = Date.now() - sessionStartRef.current
    return Math.max(0, absoluteTimeoutMs - elapsed)
  }, [absoluteTimeoutMs])

  const extendSession = useCallback(() => {
    clearTimers()
    resetIdleTimer()
    startAbsoluteTimer()
  }, [clearTimers, resetIdleTimer, startAbsoluteTimer])

  return {
    getRemainingTime,
    extendSession,
    resetIdleTimer,
  }
}
