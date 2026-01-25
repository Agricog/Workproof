import { useState } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { useOffline } from '../../hooks/useOffline'

export default function SyncStatus() {
  const { isOnline, pendingCount, triggerSync } = useOffline()
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = async () => {
    if (isSyncing || !isOnline) return
    
    setIsSyncing(true)
    try {
      triggerSync()
    } finally {
      setTimeout(() => setIsSyncing(false), 1000)
    }
  }

  if (isOnline && pendingCount === 0) {
    return null
  }

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing || !isOnline}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
        transition-colors
        ${isOnline 
          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
          : 'bg-gray-100 text-gray-600'
        }
        ${isSyncing ? 'opacity-70' : ''}
      `}
    >
      {isOnline ? (
        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
      ) : (
        <CloudOff className="w-4 h-4" />
      )}
      <span>
        {isOnline 
          ? `${pendingCount} pending` 
          : 'Offline'
        }
      </span>
    </button>
  )
}
