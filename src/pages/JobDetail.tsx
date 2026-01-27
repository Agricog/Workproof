/**
 * WorkProof Job Detail
 * View job with tasks and progress
 */
import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@clerk/clerk-react'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  ChevronRight,
  MoreVertical,
  Camera,
  Edit,
  Trash2,
  Archive,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { getTaskTypeConfig } from '../types/taskConfigs'
import { trackPageView, trackError } from '../utils/analytics'
import { captureError } from '../utils/errorTracking'
import { jobsApi, tasksApi } from '../services/api'
import type { Job, Task, TaskStatus } from '../types/models'

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  pending: { label: 'Not Started', color: 'gray' },
  in_progress: { label: 'In Progress', color: 'amber' },
  complete: { label: 'Complete', color: 'blue' },
  signed_off: { label: 'Signed Off', color: 'green' },
}

export default function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { getToken } = useAuth()

  const [job, setJob] = useState<Job | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    trackPageView(`/jobs/${jobId}`, 'Job Detail')
    loadJobData()
  }, [jobId])

  const loadJobData = async () => {
    if (!jobId) return

    setIsLoading(true)
    setError(null)

    try {
      const token = await getToken()

      // Fetch job details
      const jobResponse = await jobsApi.get(jobId, token)

      if (jobResponse.error) {
        setError(jobResponse.error)
        trackError('api_error', 'job_detail_load')
        return
      }

      if (jobResponse.data) {
        setJob(jobResponse.data)
      }

      // Fetch tasks for this job
      const tasksResponse = await tasksApi.listByJob(jobId, token)

      if (tasksResponse.data) {
        // Handle both array and paginated response formats
        // API returns { items: [...], total: N }
        const taskData = tasksResponse.data as unknown
        let taskItems: Task[] = []
        
        if (Array.isArray(taskData)) {
          taskItems = taskData
        } else if (taskData && typeof taskData === 'object' && 'items' in taskData) {
          taskItems = (taskData as { items: Task[] }).items || []
        }
        
        setTasks(taskItems)
      }
    } catch (err) {
      const errorMessage = 'Failed to load job details. Please try again.'
      setError(errorMessage)
      captureError(err, 'JobDetail.loadJobData')
      trackError(
        err instanceof Error ? err.name : 'unknown',
        'job_detail_load'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteJob = async () => {
    if (!jobId) return

    if (!confirm('Are you sure you want to delete this job? This cannot be undone.')) {
      return
    }

    setIsDeleting(true)
    setShowMenu(false)

    try {
      const token = await getToken()
      const response = await jobsApi.delete(jobId, token)

      if (response.error) {
        setError(response.error)
        return
      }

      navigate('/jobs')
    } catch (err) {
      captureError(err, 'JobDetail.handleDeleteJob')
      setError('Failed to delete job. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleArchiveJob = async () => {
    if (!jobId) return

    setShowMenu(false)

    try {
      const token = await getToken()
      const response = await jobsApi.update(jobId, { status: 'archived' }, token)

      if (response.error) {
        setError(response.error)
        return
      }

      if (response.data) {
        setJob(response.data)
      }
    } catch (err) {
      captureError(err, 'JobDetail.handleArchiveJob')
      setError('Failed to archive job. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading job details">
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden="true" />
        <p className="text-gray-500 mb-4">Job not found</p>
        <Link to="/jobs" className="text-green-600 font-medium">
          Back to jobs
        </Link>
      </div>
    )
  }

  const totalEvidence = tasks.reduce((sum, t) => sum + (t.evidenceCount || 0), 0)
  const totalRequired = tasks.reduce((sum, t) => sum + (t.requiredEvidenceCount || 0), 0)
  const progressPercent = totalRequired > 0 ? Math.round((totalEvidence / totalRequired) * 100) : 0

  // Get display values with fallbacks
  const clientName = job.clientName || 'Unknown Client'
  const address = job.address || 'No address'
  const startDate = job.startDate || new Date().toISOString()

  return (
    <div>
      <Helmet>
        <title>{clientName} | WorkProof</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="More options"
              aria-expanded={showMenu}
              aria-haspopup="menu"
            >
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>

            {showMenu && (
              <div>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                  aria-hidden="true"
                ></div>
                <div 
                  className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20"
                  role="menu"
                >
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      navigate(`/jobs/${jobId}/edit`)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    role="menuitem"
                  >
                    <Edit className="w-4 h-4" aria-hidden="true" />
                    Edit Job
                  </button>
                  <button
                    onClick={handleArchiveJob}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    role="menuitem"
                  >
                    <Archive className="w-4 h-4" aria-hidden="true" />
                    Archive Job
                  </button>
                  <hr className="my-1" />
                  <button
                    onClick={handleDeleteJob}
                    disabled={isDeleting}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50"
                    role="menuitem"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    {isDeleting ? 'Deleting...' : 'Delete Job'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 text-sm">{error}</p>
              <button
                onClick={loadJobData}
                className="text-red-600 text-sm font-medium mt-2 flex items-center gap-1 hover:text-red-700"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Job Details Card */}
        <div className="card mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-3">{clientName}</h1>

          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2 text-gray-600">
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>{address}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4" aria-hidden="true" />
              <span>
                Started{' '}
                {new Date(startDate).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600">Evidence Progress</span>
              <span className="font-medium text-gray-900">
                {totalEvidence}/{totalRequired} ({progressPercent}%)
              </span>
            </div>
            <div 
              className="w-full bg-gray-200 rounded-full h-2"
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Evidence collection progress"
            >
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Tasks Section */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Tasks</h2>

          {tasks.length === 0 ? (
            <div className="card text-center py-8">
              <Camera className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden="true" />
              <p className="text-gray-500">No tasks added yet</p>
            </div>
          ) : (
            <div className="space-y-3" role="list" aria-label="Job tasks">
              {tasks.map((task) => {
                const config = getTaskTypeConfig(task.taskType)
                const taskStatus = (task.status || 'pending') as TaskStatus
                const statusConfig = TASK_STATUS_CONFIG[taskStatus] || TASK_STATUS_CONFIG.pending
                const progress = task.requiredEvidenceCount
                  ? Math.round(((task.evidenceCount || 0) / task.requiredEvidenceCount) * 100)
                  : 0

                return (
                  <Link
                    key={task.id}
                    to={`/jobs/${jobId}/tasks/${task.id}`}
                    className="card block hover:border-gray-300 transition-colors"
                    role="listitem"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900">{config.label}</h3>
                          {config.partPNotifiable && (
                            <span className="badge badge-warning text-xs">Part P</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`badge badge-${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                          <span className="text-sm text-gray-500">
                            {task.evidenceCount || 0}/{task.requiredEvidenceCount || 0} photos
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" aria-hidden="true" />
                    </div>
                    <div 
                      className="mt-3 w-full bg-gray-200 rounded-full h-1.5"
                      role="progressbar"
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          progress === 100 ? 'bg-green-600' : 'bg-amber-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

