/**
 * WorkProof Layout Component
 * Main app shell with navigation
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
  
  // useAuth is safer - returns undefined values when outside ClerkProvider
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
```

Wait - `useAuth` will also fail outside ClerkProvider. The real issue is the env variable not being set during build.

---

### Actual Fix: Confirm Railway Variable Name

In Railway, check that the variable is **exactly**:
```
VITE_CLERK_PUBLISHABLE_KEY
