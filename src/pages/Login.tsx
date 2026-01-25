/**
 * WorkProof Login Page
 * Clerk authentication
 */

import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SignIn, useUser } from '@clerk/clerk-react'
import { Helmet } from 'react-helmet-async'
import { Shield, AlertCircle } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isSignedIn, isLoaded } = useUser()

  const reason = searchParams.get('reason')

  // Redirect if already signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate('/dashboard')
    }
  }, [isLoaded, isSignedIn, navigate])

  return (
    <>
      <Helmet>
        <title>Sign In | WorkProof</title>
        <meta name="description" content="Sign in to WorkProof to capture and manage your electrical compliance evidence." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <header className="px-4 py-6">
          <a href="/" className="flex items-center gap-2 w-fit">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">WorkProof</span>
          </a>
        </header>

        {/* Main */}
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md">
            {/* Session timeout message */}
            {reason === 'timeout' && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Session expired</p>
                  <p className="text-sm text-amber-700">
                    Please sign in again to continue.
                  </p>
                </div>
              </div>
            )}

            {/* Clerk SignIn */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
              <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
                Welcome back
              </h1>
              <p className="text-gray-600 text-center mb-8">
                Sign in to continue to WorkProof
              </p>

              <SignIn
                appearance={{
                  elements: {
                    rootBox: 'w-full',
                    card: 'shadow-none p-0',
                    headerTitle: 'hidden',
                    headerSubtitle: 'hidden',
                    formButtonPrimary:
                      'bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg',
                    formFieldInput:
                      'border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500',
                    footerActionLink: 'text-green-600 hover:text-green-700',
                  },
                }}
                routing="path"
                path="/login"
                signUpUrl="/login"
                afterSignInUrl="/dashboard"
              />
            </div>

            {/* Back link */}
            <p className="text-center mt-6">
              <a href="/" className="text-sm text-gray-600 hover:text-gray-900">
                ← Back to home
              </a>
            </p>
          </div>
        </main>
      </div>
    </>
  )
}
