/**
 * WorkProof Entry Point
 * Initializes app with error boundary, Sentry, and service worker
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App'
import { initializeSentry, ErrorFallback } from './utils/errorTracking'
import { initDB } from './utils/indexedDB'
import { setupAutoSync } from './services/sync'
import './index.css'
import { HelmetProvider } from 'react-helmet-async'
// Then wrap: <HelmetProvider><App /></HelmetProvider>

// Initialize Sentry
initializeSentry()

// Initialize IndexedDB
initDB().catch((error) => {
  console.error('Failed to initialize IndexedDB:', error)
  Sentry.captureException(error)
})

// Setup auto sync
setupAutoSync()

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope)

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                if (confirm('New version available! Reload to update?')) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' })
                  window.location.reload()
                }
              }
            })
          }
        })
      })
      .catch((error) => {
        console.error('SW registration failed:', error)
      })
  })

  // Handle controller change (new SW activated)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })

  // Listen for sync messages from SW
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SYNC_REQUESTED') {
      window.dispatchEvent(new CustomEvent('workproof:sync'))
    }
  })
}

// Render app
const container = document.getElementById('root')

if (!container) {
  throw new Error('Root element not found')
}

const root = createRoot(container)

root.render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={ErrorFallback} showDialog>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>
)
