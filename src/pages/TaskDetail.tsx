/**
 * WorkProof Task Detail
 * View task with evidence checklist and photo capture
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@clerk/clerk-react'
import { ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react'
import { getTaskTypeConfig } from '../types/taskConfigs'
import { trackTaskStarted, trackTaskCompleted, trackError } from '../utils/analytics'
import { captureError } from '../utils/errorTracking'
import { tasksApi, evidenceApi } from '../services/api'
import type { Task, TaskStatus, EvidenceType } from '../types/models'
import type { StoredEvidence } from '../utils/indexedDB'
import PhotoCapture from '../components/capture/PhotoCapture'
import EvidenceChecklist from '../components/capture/EvidenceChecklist'

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  pending: { label: 'Not Started', color: 'gray' },
  in_progress: { label: 'In Progress', color: 'amber' },
  complete: { label: 'Complete', color: 'blue' },
  signed_off: { label: 'Signed Off', color: 'green' },
}

export default function TaskDetail() {
  const params = useParams<{ jobId: string; taskId: string }>()
  const jobId = params.jobId
  const taskId = params.taskId
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const [task, setTask] = useState<Task | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [selectedEvidenceType, setSelectedEvidenceType] = useState<EvidenceType | null>(null)
  const [capturedEvidence, setCapturedEvidence] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadTaskData()
  }, [taskId])

  const loadTaskData = async () => {
    if (!taskId) return

    setIsLoading(true)
    setError(null)

    try {
      const token = await getToken()

      // Fetch task details
      const taskResponse = await tasksApi.get(taskId, token)
      if (taskResponse.error) {
        setError(taskResponse.error)
        trackError('api_error', 'task_detail_load')
        return
      }

      if (taskResponse.data) {
        setTask(taskResponse.data)

        // Fetch existing evidence for this task
        const evidenceResponse = await evidenceApi.listByTask(taskId, token)
        if (evidenceResponse.data) {
          // Mark captured evidence types
          const captured: Record<string, boolean> = {}
          evidenceResponse.data.forEach((ev) => {
            if (ev.evidenceType) {
              captured[ev.evidenceType] = true
            }
          })
          setCapturedEvidence(captured)
        }
      }
    } catch (err) {
      const errorMessage = 'Failed to load task details. Please try again.'
      setError(errorMessage)
      captureError(err, 'TaskDetail.loadTaskData')
      trackError(
        err instanceof Error ? err.name : 'unknown',
        'task_detail_load'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleCaptureStart = async (evidenceType: string) => {
    setSelectedEvidenceType(evidenceType as EvidenceType)
    setShowCamera(true)

    // Update task status to in_progress if pending
    if (task && task.status === 'pending') {
      try {
        const token = await getToken()
        const response = await tasksApi.update(task.id, { status: 'in_progress' }, token)
        if (response.data) {
          setTask(response.data)
        }
      } catch (err) {
        captureError(err, 'TaskDetail.updateStatus')
      }
    }

    // Track task started on first evidence capture
    if (task && Object.keys(capturedEvidence).length === 0) {
      trackTaskStarted(task.taskType)
    }
  }

  const handleCaptureComplete = async (evidence: StoredEvidence) => {
    if (evidence.evidenceType) {
      setCapturedEvidence((prev) => {
        const updated = {
          ...prev,
          [evidence.evidenceType]: true,
        }

        // Check if task is now complete
        if (task) {
          const config = getTaskTypeConfig(task.taskType)
          const requiredCount = config.requiredEvidence.length
          const capturedCount = Object.keys(updated).length

          if (capturedCount >= requiredCount) {
            trackTaskCompleted(task.taskType, capturedCount)
            // Update task status to complete
            updateTaskStatus('complete')
          }
        }

        return updated
      })
    }
    setShowCamera(false)
    setSelectedEvidenceType(null)

    // Refresh task data to get updated evidence count
    loadTaskData()
  }

  const updateTaskStatus = async (status: TaskStatus) => {
    if (!task) return

    try {
      const token = await getToken()
      const response = await tasksApi.update(task.id, { status }, token)
      if (response.data) {
        setTask(response.data)
      }
    } catch (err) {
      captureError(err, 'TaskDetail.updateTaskStatus')
    }
  }

  const handleCaptureCancel = () => {
    setShowCamera(false)
    setSelectedEvidenceType(null)
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading task details">
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden="true" />
        <p className="text-gray-500 mb-4">Task not found</p>
        <button
          onClick={() => navigate(-1)}
          className="text-green-600 font-medium"
        >
          Go back
        </button>
      </div>
    )
  }

  const config = getTaskTypeConfig(task.taskType)
  const statusConfig = TASK_STATUS_CONFIG[task.status]

  if (showCamera && selectedEvidenceType) {
    return (
      <PhotoCapture
        evidenceType={selectedEvidenceType}
        taskId={task.id}
        jobId={jobId || task.jobId}
        workerId={task.workerId}
        label={config.label}
        onCapture={handleCaptureComplete}
        onCancel={handleCaptureCancel}
      />
    )
  }

  return (
    <div>
      <Helmet>
        <title>{config.label} | WorkProof</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{config.label}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`badge badge-${statusConfig.color}`}>
                {statusConfig.label}
              </span>
              {config.partPNotifiable && (
                <span className="badge badge-warning">Part P</span>
              )}
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 text-sm">{error}</p>
              <button
                onClick={loadTaskData}
                className="text-red-600 text-sm font-medium mt-2 flex items-center gap-1 hover:text-red-700"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Progress Card */}
        <div className="card mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Progress</h2>
          <div className="flex items-center gap-3">
            <div
              className="flex-1 bg-gray-200 rounded-full h-3"
              role="progressbar"
              aria-valuenow={task.requiredEvidenceCount ? ((task.evidenceCount || 0) / task.requiredEvidenceCount) * 100 : 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Evidence collection progress"
            >
              <div
                className="bg-green-600 h-3 rounded-full transition-all"
                style={{
                  width: `${
                    task.requiredEvidenceCount
                      ? ((task.evidenceCount || 0) / task.requiredEvidenceCount) * 100
                      : 0
                  }%`,
                }}
              ></div>
            </div>
            <span className="text-sm font-medium text-gray-700">
              {task.evidenceCount || 0}/{task.requiredEvidenceCount || 0}
            </span>
          </div>
        </div>

        {/* Evidence Checklist */}
        <EvidenceChecklist
          taskType={task.taskType}
          capturedEvidence={capturedEvidence}
          onCaptureStart={handleCaptureStart}
        />
      </div>
    </div>
  )
}
