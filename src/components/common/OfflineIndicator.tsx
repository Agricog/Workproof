/**
 * WorkProof Offline Indicator
 * Shows banner when offline
 */

import { useState, useEffect } from 'react'
import { WifiOff, X } from 'lucide-react'

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isDismissed, setIsDismissed] = useState(false)
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setIsDismissed(false)
      setShowReconnected(true)

      // Hide reconnected message after 3 seconds
      setTimeout(() => {
        setShowReconnected(false)
      }, 3000)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setIsDismissed(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Show nothing if online and no reconnected message
  if (isOnline && !showReconnected) {
    return null
  }

  // Reconnected message
  if (isOnline && showReconnected) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80">
        <div className="bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-sm font-medium">Back online - syncing...</span>
        </div>
      </div>
    )
  }

  // Dismissed offline banner
  if (isDismissed) {
    return (
      <button
        onClick={() => setIsDismissed(false)}
        className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white p-3 rounded-full shadow-lg"
        aria-label="Show offline status"
      >
        <WifiOff className="w-5 h-5" />
      </button>
    )
  }

  // Full offline banner
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80">
      <div className="bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <WifiOff className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">You're offline</p>
              <p className="text-gray-300 text-xs mt-0.5">
                Photos will sync when you reconnect
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsDismissed(true)}
            className="text-gray-400 hover:text-white p-1"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
