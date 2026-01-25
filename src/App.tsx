/**
 * WorkProof Main App
 * Routing and global providers
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import * as Sentry from '@sentry/react'
import Layout from './components/layout/Layout'
import OfflineIndicator from './components/common/OfflineIndicator'

// Pages (lazy loaded)
import { lazy, Suspense } from 'react'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Jobs = lazy(() => import('./pages/Jobs'))
const JobDetail = lazy(() => import('./pages/JobDetail'))
const NewJob = lazy(() => import('./pages/NewJob'))
const TaskDetail = lazy(() => import('./pages/TaskDetail'))
const AuditPacks = lazy(() => import('./pages/AuditPacks'))
const Settings = lazy(() => import('./pages/Settings'))
const Login = lazy(() => import('./pages/Login'))
const Landing = lazy(() => import('./pages/Landing'))

// Clerk publishable key
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPubKey) {
  console.warn('Clerk publishable key not found - auth disabled')
}

// Sentry routing integration
const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes)

// Loading spinner
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-600 text-sm">Loading...</p>
      </div>
    </div>
  )
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!clerkPubKey) {
    // Auth disabled - allow access
    return <>{children}</>
  }

  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}

export default function App() {
  const content = (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <SentryRoutes>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs"
            element={
              <ProtectedRoute>
                <Layout>
                  <Jobs />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs/new"
            element={
              <ProtectedRoute>
                <Layout>
                  <NewJob />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs/:jobId"
            element={
              <ProtectedRoute>
                <Layout>
                  <JobDetail />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs/:jobId/tasks/:taskId"
            element={
              <ProtectedRoute>
                <Layout>
                  <TaskDetail />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-packs"
            element={
              <ProtectedRoute>
                <Layout>
                  <AuditPacks />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </SentryRoutes>
      </Suspense>

      {/* Global components */}
      <OfflineIndicator />
    </BrowserRouter>
  )

  // Wrap with Clerk if key available
  if (clerkPubKey) {
    return <ClerkProvider publishableKey={clerkPubKey}>{content}</ClerkProvider>
  }

  return content
}
