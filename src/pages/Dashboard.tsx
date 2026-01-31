/**
 * WorkProof Dashboard
 * Overview of jobs, evidence, and sync status
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  Briefcase,
  Camera,
  FileCheck,
  Plus,
  ChevronRight,
  Calendar,
  MapPin,
} from 'lucide-react'
import { useUser } from '@clerk/clerk-react'
import SyncStatus from '../components/common/SyncStatus'
import { getStorageStats } from '../utils/indexedDB'
import { trackPageView, trackError } from '../utils/analytics'
import type { Job } from '../types/models'

export default function Dashboard() {
  const { user } = useUser()
  const [stats, setStats] = useState({
    activeJobs: 0,
    evidenceThisMonth: 0,
    pendingSync: 0,
  })
  const [recentJobs, setRecentJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    trackPageView('/dashboard', 'Dashboard')
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
  setIsLoading(true)
  try {
    // Get offline storage stats
    const storageStats = await getStorageStats()
    
    // Fetch real jobs from API
    const response = await fetch('/api/jobs', {
      credentials: 'include'
    })
    
    if (response.ok) {
      const jobs: Job[] = await response.json()
      const activeJobs = jobs.filter(j => j.status === 'active')
      
      // Calculate evidence count for this month
      const thisMonth = new Date().getMonth()
      const thisYear = new Date().getFullYear()
      const evidenceThisMonth = jobs.reduce((total, job) => {
        const jobDate = new Date(job.createdAt)
        if (jobDate.getMonth() === thisMonth && jobDate.getFullYear() === thisYear) {
          return total + (job.evidenceCount || 0)
        }
        return total + (job.evidenceCount || 0)
      }, 0)
      
      setStats({
        activeJobs: activeJobs.length,
        evidenceThisMonth: evidenceThisMonth || storageStats.pendingCount || 0,
        pendingSync: storageStats.pendingCount || 0,
      })
      
      // Show most recent active jobs (up to 5)
      setRecentJobs(activeJobs.slice(0, 5))
    } else {
      // API error - show empty state
      setStats({
        activeJobs: 0,
        evidenceThisMonth: storageStats.pendingCount || 0,
        pendingSync: storageStats.pendingCount || 0,
      })
      setRecentJobs([])
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
    trackError(
      error instanceof Error ? error.name : 'unknown',
      'dashboard_load'
    )
    setStats({
      activeJobs: 0,
      evidenceThisMonth: 0,
      pendingSync: 0,
    })
    setRecentJobs([])
  } finally {
    setIsLoading(false)
  }
}

  const firstName = user?.firstName || 'there'

  return (
    <>
      <Helmet>
        <title>Dashboard | WorkProof</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Hi {firstName} 👋
          </h1>
          <p className="text-gray-600 mt-1">
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>

        {/* Sync Status */}
        <SyncStatus />

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center">
            <Briefcase className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{stats.activeJobs}</p>
            <p className="text-xs text-gray-500">Active Jobs</p>
          </div>
          <div className="card text-center">
            <Camera className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{stats.evidenceThisMonth}</p>
            <p className="text-xs text-gray-500">This Month</p>
          </div>
          <div className="card text-center">
            <FileCheck className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-xs text-gray-500">Audit Packs</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/jobs/new"
            className="card flex items-center gap-3 hover:border-green-300 hover:bg-green-50 transition-colors"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-green-600" />
            </div>
            <span className="font-medium text-gray-900">New Job</span>
          </Link>
          <Link
            to="/audit-packs"
            className="card flex items-center gap-3 hover:border-purple-300 hover:bg-purple-50 transition-colors"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-purple-600" />
            </div>
            <span className="font-medium text-gray-900">Audit Pack</span>
          </Link>
        </div>

        {/* Recent Jobs */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Active Jobs</h2>
            <Link
              to="/jobs"
              className="text-sm text-green-600 font-medium hover:text-green-700"
            >
              View all
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="card animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : recentJobs.length === 0 ? (
            <div className="card text-center py-8">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No active jobs yet</p>
              <Link to="/jobs/new" className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create your first job
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  className="card block hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">
                        {job.clientName}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{job.address}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        <span>
                          {new Date(job.startDate).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span className="badge badge-success">
                        {job.evidenceCount || 0} photos
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
