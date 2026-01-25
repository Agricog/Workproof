/**
 * WorkProof Offline Hook
 * Manages online/offline state and sync queue
 */

import { useState, useEffect, useCallback } from 'react'
import {
  getPendingEvidence,
  getStorageStats,
  isStorageNearLimit,
} from '../utils/indexedDB'
import type { OfflineStorageStats } from '../types/api'

interface UseOfflineReturn {
  isOnline: boolean
  pendingCount: number
  storageStats: OfflineStorageStats | null
  isStorageWarning: boolean
  triggerSync: () => void
  refreshStats: () => Promise<void>
}

export function useOffline(): UseOfflineReturn {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [storageStats, setStorageStats] = useState<OfflineStorageStats | null>(null)
  const [isStorageWarning, setIsStorageWarning] = useState(false)

  // Update online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      triggerSync()
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Refresh stats on mount and periodically
  useEffect(() => {
    refreshStats()

    const interval = setInterval(refreshStats, 30000) // Every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const refreshStats = useCallback(async () => {
    try {
      const pending = await getPendingEvidence()
      setPendingCount(pending.length)

      const stats = await getStorageStats()
      setStorageStats(stats)

      const warning = await isStorageNearLimit()
      setIsStorageWarning(warning)
    } catch (error) {
      console.error('Failed to refresh offline stats:', error)
    }
  }, [])

  const triggerSync = useCallback(() => {
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration) => {
        // @ts-expect-error - sync is not in standard types yet
        registration.sync.register('sync-evidence')
      })
    }

    // Also dispatch custom event for manual sync handling
    window.dispatchEvent(new CustomEvent('workproof:sync'))
  }, [])

  return {
    isOnline,
    pendingCount,
    storageStats,
    isStorageWarning,
    triggerSync,
    refreshStats,
  }
}
