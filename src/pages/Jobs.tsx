/**
 * WorkProof Jobs List
 * All jobs with filtering
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@clerk/clerk-react'
import {
  Plus,
  Search,
  Filter,
  ChevronRight,
  MapPin,
  Calendar,
  CheckCircle,
  Clock,
  Archive,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { trackPageView, trackError } from '../utils/analytics'
import { jobsApi } from '../services/api'
import { captureError } from '../utils/errorTracking'
import type { Job, JobStatus } from '../types/models'

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; icon: typeof Clock }> = {
  active: { label: 'Active', color: 'green', icon: Clock },
  completed: { label: 'Completed', color: 'blue', icon: CheckCircle },
  archived: { label: 'Archived', color: 'gray', icon: Archive },
}

export default function Jobs() {
  const { getToken } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    trackPageView('/jobs', 'Jobs')
    loadJobs()
  }, [])

  useEffect(() => {
    filterJobs()
  }, [jobs, searchQuery, statusFilter])

  const loadJobs = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const token = await getToken()
      const response = await jobsApi.list(token)
      
      if (response.error) {
        setError(response.error)
        trackError('api_error', 'jobs_load')
        return
      }
      
      if (response.data) {
        // Handle both array and paginated response formats
        // API returns { items: [...], total: N }
        const jobData = response.data as unknown
        let jobItems: Job[] = []
        
        if (Array.isArray(jobData)) {
          jobItems = jobData
        } else if (jobData && typeof jobData === 'object' && 'items' in jobData) {
          jobItems = (jobData as { items: Job[] }).items || []
        }
        
        setJobs(jobItems)
      }
    } catch (err) {
      const errorMessage = 'Failed to load jobs. Please try again.'
      setError(errorMessage)
      captureError(err, 'Jobs.loadJobs')
      trackError(
        err instanceof Error ? err.name : 'unknown',
        'jobs_load'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const filterJobs = () => {
    let filtered = [...jobs]

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((job) => job.status === statusFilter)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (job) =>
          (job.clientName || '').toLowerCase().includes(query) ||
          (job.address || '').toLowerCase().includes(query)
      )
    }

    setFilteredJobs(filtered)
  }

  return (
    <>
      <Helmet>
        <title>Jobs | WorkProof</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <Link to="/jobs/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>New Job</span>
          </Link>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 text-sm">{error}</p>
              <button
                onClick={loadJobs}
                className="text-red-600 text-sm font-medium mt-2 flex items-center gap-1 hover:text-red-700"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
            aria-label="Search jobs"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1" role="group" aria-label="Filter jobs by status">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              statusFilter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            aria-pressed={statusFilter === 'all'}
          >
            All
          </button>
          {(Object.keys(STATUS_CONFIG) as JobStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === status
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              aria-pressed={statusFilter === status}
            >
              {STATUS_CONFIG[status].label}
            </button>
          ))}
        </div>

        {/* Jobs List */}
        {isLoading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading jobs">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="card text-center py-12">
            {searchQuery || statusFilter !== 'all' ? (
              <>
                <Filter className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden="true" />
                <p className="text-gray-500 mb-2">No jobs found</p>
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setStatusFilter('all')
                  }}
                  className="text-green-600 font-medium text-sm"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden="true" />
                <p className="text-gray-500 mb-4">No jobs yet</p>
                <Link to="/jobs/new" className="btn-primary inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Create your first job
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3" role="list" aria-label="Jobs list">
            {filteredJobs.map((job) => {
              const jobStatus = (job.status || 'active') as JobStatus
              const statusConfig = STATUS_CONFIG[jobStatus] || STATUS_CONFIG.active
              const StatusIcon = statusConfig.icon

              return (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  className="card block hover:border-gray-300 transition-colors"
                  role="listitem"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900 truncate">
                          {job.clientName || 'Unknown Client'}
                        </h3>
                        <span
                          className={`badge badge-${statusConfig.color} flex items-center gap-1`}
                        >
                          <StatusIcon className="w-3 h-3" aria-hidden="true" />
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <MapPin className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                        <span className="truncate">{job.address || 'No address'}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" aria-hidden="true" />
                          {job.startDate ? new Date(job.startDate).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          }) : 'No date'}
                        </div>
                        <div>
                          {job.taskCount || 0} task{(job.taskCount || 0) !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {job.evidenceCount || 0}/{job.completedEvidenceCount || 0}
                        </p>
                        <p className="text-xs text-gray-500">evidence</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" aria-hidden="true" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
