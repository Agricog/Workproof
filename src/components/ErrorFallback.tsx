import React from 'react'

interface ErrorFallbackProps {
  error: Error
  componentStack: string
  eventId: string
  resetError: () => void
}

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return React.createElement(
    'div',
    { 
      style: { 
        padding: '2rem', 
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb'
      } 
    },
    React.createElement('h2', { style: { marginBottom: '1rem', color: '#111827' } }, 'Something went wrong'),
    React.createElement('p', { style: { marginBottom: '1.5rem', color: '#6b7280' } }, error.message),
    React.createElement(
      'button',
      { 
        onClick: resetError,
        style: {
          padding: '0.75rem 1.5rem',
          backgroundColor: '#16a34a',
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          fontWeight: '500'
        }
      },
      'Try again'
    )
  )
}
