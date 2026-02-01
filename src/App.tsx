import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ClerkProvider, SignedIn, SignedOut, useAuth } from '@clerk/clerk-react'
import Layout from './components/layout/Layout'
import { startSyncService, stopSyncService } from './services/sync'

// Lazy load pages
const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Jobs = lazy(() => import('./pages/Jobs'))
const NewJob = lazy(() => import('./pages/NewJob'))
const JobDetail = lazy(() => import('./pages/JobDetail'))
const AddTasks = lazy(() => import('./pages/AddTasks'))
const TaskDetail = lazy(() => import('./pages/TaskDetail'))
const AuditPacks = lazy(() => import('./pages/AuditPacks'))
const Packs = lazy(() => import('./pages/Packs'))
const PackPreview = lazy(() => import('./pages/PackPreview'))
const Settings = lazy(() => import('./pages/Settings'))
const Profile = lazy(() => import('./pages/Profile'))
const Verify = lazy(() => import('./pages/Verify'))

// Loading spinner
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )
}

// Sync service initializer - must be inside ClerkProvider
function SyncServiceInit() {
  const { getToken } = useAuth()

  useEffect(() => {
    // Start sync service with token getter
    startSyncService(getToken)

    return () => {
      stopSyncService()
    }
  }, [getToken])

  return null
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <SignedIn>
      <Layout>{children}</Layout>
    </SignedIn>
  )
}

// Get Clerk publishable key
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

export default function App() {
  // If no Clerk key, show app without auth (development mode)
  if (!clerkPubKey) {
    return (
      <BrowserRouter>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Navigate to="/dashboard" replace />} />
            {/* Public verification page - no auth required */}
            <Route path="/verify/:packId" element={<Verify />} />
            <Route
              path="/dashboard"
              element={
                <Layout>
                  <Dashboard />
                </Layout>
              }
            />
            <Route
              path="/jobs"
              element={
                <Layout>
                  <Jobs />
                </Layout>
              }
            />
            <Route
              path="/jobs/new"
              element={
                <Layout>
                  <NewJob />
                </Layout>
              }
            />
            <Route
              path="/jobs/:jobId"
              element={
                <Layout>
                  <JobDetail />
                </Layout>
              }
            />
            <Route
              path="/jobs/:jobId/add-tasks"
              element={
                <Layout>
                  <AddTasks />
                </Layout>
              }
            />
            <Route
              path="/jobs/:jobId/tasks/:taskId"
              element={
                <Layout>
                  <TaskDetail />
                </Layout>
              }
            />
            <Route
              path="/audit-packs"
              element={
                <Layout>
                  <AuditPacks />
                </Layout>
              }
            />
            <Route
              path="/packs"
              element={
                <Layout>
                  <Packs />
                </Layout>
              }
            />
            <Route
              path="/packs/:jobId"
              element={
                <Layout>
                  <PackPreview />
                </Layout>
              }
            />
            <Route
              path="/settings"
              element={
                <Layout>
                  <Settings />
                </Layout>
              }
            />
            <Route
              path="/profile"
              element={
                <Layout>
                  <Profile />
                </Layout>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    )
  }

  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <SyncServiceInit />
      <BrowserRouter>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            {/* Public verification page - no auth required */}
            <Route path="/verify/:packId" element={<Verify />} />
            <Route
              path="/login/*"
              element={
                <>
                  <SignedIn>
                    <Navigate to="/dashboard" replace />
                  </SignedIn>
                  <SignedOut>
                    <Login />
                  </SignedOut>
                </>
              }
            />

            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs"
              element={
                <ProtectedRoute>
                  <Jobs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs/new"
              element={
                <ProtectedRoute>
                  <NewJob />
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs/:jobId"
              element={
                <ProtectedRoute>
                  <JobDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs/:jobId/add-tasks"
              element={
                <ProtectedRoute>
                  <AddTasks />
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs/:jobId/tasks/:taskId"
              element={
                <ProtectedRoute>
                  <TaskDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit-packs"
              element={
                <ProtectedRoute>
                  <AuditPacks />
                </ProtectedRoute>
              }
            />
            <Route
              path="/packs"
              element={
                <ProtectedRoute>
                  <Packs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/packs/:jobId"
              element={
                <ProtectedRoute>
                  <PackPreview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ClerkProvider>
  )
}
