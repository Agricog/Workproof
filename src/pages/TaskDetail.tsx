/**
 * WorkProof Task Detail
 * View task with evidence checklist and photo capture with stage selection
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
import type { Task, TaskStatus, EvidenceType, PhotoStage } from '../types/models'
import type { StoredEvidence } from '../utils/indexedDB'
import PhotoCapture from '../components/capture/PhotoCapture'
import EvidenceChecklist from '../components/capture/EvidenceChecklist'

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  pending: { label: 'Not Started', color: 'gray' },
  in_progress: { label: 'In Progress', color: 'amber' },
  complete: { label: 'Complete', color: 'blue' },
  signed_off: { label: 'Signed Off', color: 'green' },
}

// Captured evidence info including stage
interface CapturedEvidenceInfo {
  captured: boolean
  stage?: PhotoStage
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
  const [selectedPhotoStage, setSelectedPhotoStage] = useState<PhotoStage | null>(null)
  const [capturedEvidence, setCapturedEvidence] = useState<Record<string, CapturedEvidenceInfo>>({})

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
          // Mark captured evidence types with their stages
          const captured: Record<string, CapturedEvidenceInfo> = {}
          // Handle both array and { items: [] } response formats
          const evidenceList = Array.isArray(evidenceResponse.data) 
            ? evidenceResponse.data 
            : (evidenceResponse.data as unknown as { items: Array<{ evidenceType?: string; photoStage?: string }> }).items || []
          evidenceList.forEach((ev) => {
            if (ev.evidenceType) {
              captured[ev.evidenceType] = {
                captured: true,
                stage: ev.photoStage as PhotoStage | undefined
              }
            }
          })
          setCapturedEvidence(captured)
        }
      }
    } catch (err) {
      const errorMessage = 'Failed to load task details. Please try again.'
      setError(errorMessage)
      captureError(err, 'TaskDetail.loadTaskData')
      trackError(err instanceof Error ? err.name : 'unknown', 'task_detail_load')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCaptureStart = async (evidenceType: EvidenceType, stage: PhotoStage) => {
    setSelectedEvidenceType(evidenceType)
    setSelectedPhotoStage(stage)
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
          [evidence.evidenceType]: {
            captured: true,
            stage: selectedPhotoStage || undefined
          },
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
    setSelectedPhotoStage(null)

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
    setSelectedPhotoStage(null)
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={loadTaskData}
          className="btn btn-primary inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Task not found</p>
      </div>
    )
  }

  const config = getTaskTypeConfig(task.taskType)
  const statusConfig = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.pending

  if (showCamera && selectedEvidenceType) {
    return (
      <PhotoCapture
        evidenceType={selectedEvidenceType}
        photoStage={selectedPhotoStage || undefined}
        taskId={task.id}
        jobId={jobId || task.jobId}
        workerId="current-user"
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
              <span className={`badge badge-${statusConfig.color}`}>{statusConfig.label}</span>
              {config.partPNotifiable && <span className="badge badge-warning">Part P</span>}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="card mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Progress</h2>
          <div className="flex items-center gap-3">
            <div
              className="flex-1 bg-gray-200 rounded-full h-3"
              role="progressbar"
              aria-valuenow={
                config.requiredEvidence.length
                  ? (Object.keys(capturedEvidence).length / config.requiredEvidence.length) * 100
                  : 0
              }
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Evidence collection progress"
            >
              <div
                className="bg-green-600 h-3 rounded-full transition-all"
                style={{
                  width: `${
                    config.requiredEvidence.length
                      ? (Object.keys(capturedEvidence).length / config.requiredEvidence.length) * 100
                      : 0
                  }%`,
                }}
              ></div>
            </div>
            <span className="text-sm font-medium text-gray-700">
              {Object.keys(capturedEvidence).length}/{config.requiredEvidence.length}
            </span>
          </div>
        </div>

        {/* Evidence Checklist with Stage Selection */}
        <EvidenceChecklist
          taskType={task.taskType}
          capturedEvidence={capturedEvidence}
          onCaptureStart={handleCaptureStart}
        />
      </div>
    </div>
  )
}

