/**
 * WorkProof Layout Component
 * Main app shell with navigation
 */

import { ReactNode } from 'react'
import Navigation from './Navigation'
import { useSessionTimeout, clearSession } from '../../hooks/useSessionTimeout'
import { useNavigate } from 'react-router-dom'
import { useClerk } from '@clerk/clerk-react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const { signOut } = useClerk()

  const handleTimeout = async () => {
    clearSession()
    try {
      await signOut()
    } catch {
      // Ignore errors
    }
    navigate('/login?reason=timeout')
  }

  const handleWarning = () => {
    // Could show a modal warning here
    console.log('Session expiring soon')
  }

  useSessionTimeout({
    onTimeout: handleTimeout,
    onWarning: handleWarning,
    warningBeforeMs: 60000, // 1 minute warning
  })

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Main content */}
      <main className="flex-1 pb-20">
        <div className="max-w-lg mx-auto px-4 py-6">{children}</div>
      </main>

      {/* Bottom navigation */}
      <Navigation />

      {/* Safe area for iOS */}
      <div className="safe-area-bottom" />
    </div>
  )
}
