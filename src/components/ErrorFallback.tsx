import React from 'react'

interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return React.createElement(
    'div',
    { style: { padding: '2rem', textAlign: 'center' } },
    React.createElement('h2', null, 'Something went wrong'),
    React.createElement('p', null, error.message),
    React.createElement(
      'button',
      { onClick: resetErrorBoundary },
      'Try again'
    )
  )
}
