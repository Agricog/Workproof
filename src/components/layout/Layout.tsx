/**
 * WorkProof Layout Component
 * Main app shell with navigation
 * WCAG 2.1 AA Compliant
 */
import { ReactNode, useCallback } from 'react'
import Navigation from './Navigation'
import { useSessionTimeout } from '../../hooks/useSessionTimeout'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  
  const { signOut, isLoaded } = useAuth()

  const handleTimeout = useCallback(async () => {
    try {
      if (signOut && isLoaded) {
        await signOut()
      }
    } catch {
      // Ignore errors
    }
    navigate('/login?reason=timeout')
  }, [signOut, isLoaded, navigate])

  useSessionTimeout({
    onTimeout: handleTimeout,
  })

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Skip Navigation - WCAG 2.4.1 */}
      
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        Skip to main content
      </a>

      {/* Main content */}
      <main id="main-content" className="flex-1 pb-20" tabIndex={-1}>
        <div className="max-w-lg mx-auto px-4 py-6">{children}</div>
      </main>

      {/* Bottom navigation */}
      <Navigation />

      {/* Safe area for iOS */}
      <div className="safe-area-bottom" />
    </div>
  )
}
