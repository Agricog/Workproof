import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import * as Sentry from '@sentry/react'
import App from './App'
import { initializeSentry } from './utils/errorTracking'
import { ErrorFallback } from './components/ErrorFallback'
import './index.css'

// Initialize Sentry
initializeSentry()

// Register service worker
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope)
      })
      .catch((error) => {
        console.error('SW registration failed:', error)
      })
  })
}

const container = document.getElementById('root')

if (container) {
  const root = ReactDOM.createRoot(container)
  root.render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(
        Sentry.ErrorBoundary,
        { fallback: ErrorFallback },
        React.createElement(
          HelmetProvider,
          null,
          React.createElement(App, null)
        )
      )
    )
  )
}
