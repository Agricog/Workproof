/**
 * WorkProof Jobs List
 * All jobs with filtering
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
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
} from 'lucide-react'
import type { Job, JobStatus } from '../types/models'

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; icon: typeof Clock }> = {
  active: { label: 'Active', color: 'green', icon: Clock },
  completed: { label: 'Completed', color: 'blue', icon: CheckCircle },
  archived: { label: 'Archived', color: 'gray', icon: Archive },
}

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadJobs()
  }, [])

  useEffect(() => {
    filterJobs()
  }, [jobs, searchQuery, statusFilter])

  const loadJobs = async () => {
    setIsLoading(true)
    try {
      // TODO: Fetch from API
      // Placeholder data
      setJobs([
        {
          id: '1',
          orgId: '1',
          address: '42 High Street, Bristol BS1 2AW',
          clientName: 'Mrs Johnson',
          startDate: '2026-01-24',
          status: 'active',
          equipmentId: null,
          createdAt: '2026-01-24T09:00:00Z',
          taskCount: 1,
          evidenceCount: 4,
          completedEvidenceCount: 7,
        },
        {
          id: '2',
          orgId: '1',
          address: 'The Crown Inn, Exeter EX1 1AA',
          clientName: 'Mr Davies',
          startDate: '2026-01-22',
          status: 'active',
          equipmentId: null,
          createdAt: '2026-01-22T08:30:00Z',
          taskCount: 2,
          evidenceCount: 0,
          completedEvidenceCount: 12,
        },
        {
          id: '3',
          orgId: '1',
          address: 'Unit 7, Industrial Estate, Plymouth',
          clientName: 'ABC Motors Ltd',
          startDate: '2026-01-20',
          status: 'completed',
          equipmentId: null,
          createdAt: '2026-01-20T10:00:00Z',
          taskCount: 1,
          evidenceCount: 6,
          completedEvidenceCount: 6,
        },
      ])
    } catch (error) {
      console.error('Failed to load jobs:', error)
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
          job.clientName.toLowerCase().includes(query) ||
          job.address.toLowerCase().includes(query)
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

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              statusFilter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
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
            >
              {STATUS_CONFIG[status].label}
            </button>
          ))}
        </div>

        {/* Jobs List */}
        {isLoading ? (
          <div className="space-y-3">
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
                <Filter className="w-12 h-12 text-gray-300 mx-auto mb-3" />
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
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No jobs yet</p>
                <Link to="/jobs/new" className="btn-primary inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Create your first job
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredJobs.map((job) => {
              const statusConfig = STATUS_CONFIG[job.status]
              const StatusIcon = statusConfig.icon

              return (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  className="card block hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900 truncate">
                          {job.clientName}
                        </h3>
                        <span
                          className={`badge badge-${statusConfig.color} flex items-center gap-1`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{job.address}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(job.startDate).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </div>
                        <div>
                          {job.taskCount} task{job.taskCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {job.evidenceCount}/{job.completedEvidenceCount}
                        </p>
                        <p className="text-xs text-gray-500">evidence</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
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
