/**
 * WorkProof Layout Component
 * Main app shell with navigation
 */
import { ReactNode } from 'react'
import Navigation from './Navigation'
import { useSessionTimeout } from '../../hooks/useSessionTimeout'
import { useNavigate } from 'react-router-dom'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  
  // Dynamically import Clerk to avoid errors when not in ClerkProvider
  let signOut: (() => Promise<void>) | null = null
  
  try {
    // Only use Clerk if available
    const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
    if (clerkKey) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { useClerk } = require('@clerk/clerk-react')
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const clerk = useClerk()
      signOut = clerk.signOut
    }
  } catch {
    // Clerk not available
  }

  const handleTimeout = async () => {
    try {
      if (signOut) {
        await signOut()
      }
    } catch {
      // Ignore errors
    }
    navigate('/login?reason=timeout')
  }

  useSessionTimeout({
    onTimeout: handleTimeout,
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
