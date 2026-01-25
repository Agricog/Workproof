/**
 * WorkProof Sync Status Component
 * Shows pending sync count and sync button
 */

import { useState, useEffect } from 'react'
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react'
import { useOffline } from '../../hooks/useOffline'
import { syncService } from '../../services/sync'
import { formatFileSize } from '../../utils/compression'

interface SyncStatusProps {
  variant?: 'compact' | 'full'
  className?: string
}

export default function SyncStatus({ variant = 'compact', className = '' }: SyncStatusProps) {
  const { isOnline, pendingCount, storageStats, isStorageWarning, triggerSync, refreshStats } =
    useOffline()

  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [lastSyncResult, setLastSyncResult] = useState<'success' | 'error' | null>(null)

  useEffect(() => {
    const unsubscribe = syncService.subscribe((state) => {
      setIsSyncing(state.isSyncing)
      setSyncProgress(state.progress)
    })

    return unsubscribe
  }, [])

  const handleSync = async () => {
    if (isSyncing || !isOnline) return

    setLastSyncResult(null)
    const result = await syncService.sync()
    setLastSyncResult(result.success ? 'success' : 'error')
    await refreshStats()

    // Clear result after 3 seconds
    setTimeout(() => setLastSyncResult(null), 3000)
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={handleSync}
        disabled={isSyncing || !isOnline}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          !isOnline
            ? 'bg-gray-100 text-gray-500'
            : pendingCount > 0
            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
            : 'bg-green-100 text-green-700 hover:bg-green-200'
        } ${className}`}
      >
        {!isOnline ? (
          <>
            <CloudOff className="w-4 h-4" />
            <span>Offline</span>
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>{syncProgress}%</span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <Cloud className="w-4 h-4" />
            <span>{pendingCount} pending</span>
          </>
        ) : lastSyncResult === 'success' ? (
          <>
            <Check className="w-4 h-4" />
            <span>Synced</span>
          </>
        ) : lastSyncResult === 'error' ? (
          <>
            <AlertCircle className="w-4 h-4" />
            <span>Sync failed</span>
          </>
        ) : (
          <>
            <Check className="w-4 h-4" />
            <span>Synced</span>
          </>
        )}
      </button>
    )
  }

  // Full variant
  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border border-gray-100 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Sync Status</h3>
        <div
          className={`w-3 h-3 rounded-full ${
            isOnline ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
        {isOnline ? (
          <>
            <Cloud className="w-4 h-4 text-green-600" />
            <span>Connected</span>
          </>
        ) : (
          <>
            <CloudOff className="w-4 h-4 text-gray-400" />
            <span>Working offline</span>
          </>
        )}
      </div>

      {/* Storage Info */}
      {storageStats && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Local storage</span>
            <span className="font-medium text-gray-900">
              {formatFileSize(storageStats.totalSizeBytes)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Pending uploads</span>
            <span
              className={`font-medium ${
                storageStats.pendingUploadCount > 0
                  ? 'text-amber-600'
                  : 'text-gray-900'
              }`}
            >
              {storageStats.pendingUploadCount}
            </span>
          </div>
        </div>
      )}

      {/* Storage Warning */}
      {isStorageWarning && (
        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            Storage is nearly full. Please sync your evidence soon.
          </p>
        </div>
      )}

      {/* Sync Button */}
      <button
        onClick={handleSync}
        disabled={isSyncing || !isOnline || pendingCount === 0}
        className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isSyncing ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Syncing... {syncProgress}%</span>
          </>
        ) : !isOnline ? (
          <span>Offline</span>
        ) : pendingCount === 0 ? (
          <>
            <Check className="w-4 h-4" />
            <span>All synced</span>
          </>
        ) : (
          <>
            <Cloud className="w-4 h-4" />
            <span>Sync {pendingCount} items</span>
          </>
        )}
      </button>

      {/* Last sync result */}
      {lastSyncResult && (
        <p
          className={`mt-2 text-sm text-center ${
            lastSyncResult === 'success' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {lastSyncResult === 'success' ? 'Sync completed!' : 'Some items failed to sync'}
        </p>
      )}
    </div>
  )
}
