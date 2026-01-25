/**
 * WorkProof Job Detail
 * View job with tasks and evidence progress
 */

import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  ChevronRight,
  MoreVertical,
  CheckCircle,
  Clock,
  Camera,
  Edit,
  Trash2,
  Archive,
} from 'lucide-react'
import { getTaskTypeConfig } from '../types/taskConfigs'
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

  const [job, setJob] = useState<Job | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    loadJobData()
  }, [jobId])

  const loadJobData = async () => {
    setIsLoading(true)
    try {
      // TODO: Fetch from API - Placeholder data
      setJob({
        id: jobId || '1',
        orgId: '1',
        address: '42 High Street, Bristol BS1 2AW',
        clientName: 'Mrs Johnson',
        startDate: '2026-01-24',
        status: 'active',
        equipmentId: null,
        createdAt: '2026-01-24T09:00:00Z',
      })

      setTasks([
        {
          id: '1',
          jobId: jobId || '1',
          taskType: 'consumer_unit_replacement',
          workerId: 'worker1',
          status: 'in_progress',
          startedAt: '2026-01-24T09:30:00Z',
          completedAt: null,
          signedOffAt: null,
          signedOffBy: null,
          notes: null,
          createdAt: '2026-01-24T09:00:00Z',
          evidenceCount: 4,
          requiredEvidenceCount: 7,
        },
      ])
    } catch (error) {
      console.error('Failed to load job:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteJob = async () => {
    if (!confirm('Are you sure you want to delete this job? This cannot be undone.')) {
      return
    }
    navigate('/jobs')
  }

  const handleArchiveJob = async () => {
    setShowMenu(false)
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-32 bg-gray-200 rounded" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="text-center py-12">
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

  return (
    <>
      <Helmet>
        <title>{job.clientName} | WorkProof</title>
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
            >
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <button
                    onClick={() => setShowMenu(false)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Job
                  </button>
                  <button
                    onClick={handleArchiveJob}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Archive className="w-4 h-4" />
                    Archive Job
                  </button>
                  <hr className="my-1" />
                  <button
                    onClick={handleDeleteJob}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Job
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Job Info Card */}
        <div className="card mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-3">{job.clientName}</h1>

          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2 text-gray-600">
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{job.address}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>
                Started{' '}
                {new Date(job.startDate).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600">Evidence Progress</span>
              <span className="font-medium text-gray-900">
                {totalEvidence}/{totalRequired} ({progressPercent}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Tasks */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Tasks</h2>

          {tasks.length === 0 ? (
            <div className="card text-center py-8">
              <Camera className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No tasks added yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const config = getTaskTypeConfig(task.taskType)
                const statusConfig = TASK_STATUS_CONFIG[task.status]
                const progress = task.requiredEvidenceCount
                  ? Math.round(((task.evidenceCount || 0) / task.requiredEvidenceCount) * 100)
                  : 0

                return (
                  <Link
                    key={task.id}
                    to={`/jobs/${jobId}/tasks/${task.id}`}
                    className="card block hover:border-gray-300 transition-colors"
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
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>

                    {/* Mini progress bar */}
                    <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          progress === 100 ? 'bg-green-600' : 'bg-amber-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
