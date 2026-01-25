import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowLeft, Camera, CheckCircle, Clock } from 'lucide-react'
import { getTaskTypeConfig } from '../types/taskConfigs'
import type { Task, TaskStatus } from '../types/models'
import PhotoCapture from '../components/capture/PhotoCapture'
import EvidenceChecklist from '../components/capture/EvidenceChecklist'

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  pending: { label: 'Not Started', color: 'gray' },
  in_progress: { label: 'In Progress', color: 'amber' },
  complete: { label: 'Complete', color: 'blue' },
  signed_off: { label: 'Signed Off', color: 'green' },
}

export default function TaskDetail() {
  const { jobId, taskId } = useParams<{ jobId: string; taskId: string }>()
  const navigate = useNavigate()

  const [task, setTask] = useState<Task | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showCamera, setShowCamera] = useState(false)
  const [selectedEvidenceType, setSelectedEvidenceType] = useState<string | null>(null)
  const [capturedEvidence, setCapturedEvidence] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadTaskData()
  }, [taskId])

  const loadTaskData = async () => {
    setIsLoading(true)
    try {
      // TODO: Fetch from API
      setTask({
        id: taskId || '1',
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
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCaptureStart = (evidenceType: string) => {
    setSelectedEvidenceType(evidenceType)
    setShowCamera(true)
  }

  const handleCaptureComplete = (_photoData: string, _hash: string) => {
    if (selectedEvidenceType) {
      setCapturedEvidence((prev) => ({
        ...prev,
        [selectedEvidenceType]: true,
      }))
    }
    setShowCamera(false)
    setSelectedEvidenceType(null)
  }

  const handleCaptureCancel = () => {
    setShowCamera(false)
    setSelectedEvidenceType(null)
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

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Task not found</p>
      </div>
    )
  }

  if (showCamera && selectedEvidenceType) {
    return (
      <PhotoCapture
        evidenceType={selectedEvidenceType}
        taskId={task.id}
        onCapture={handleCaptureComplete}
        onCancel={handleCaptureCancel}
      />
    )
  }

  const config = getTaskTypeConfig(task.taskType)
  const statusConfig = TASK_STATUS_CONFIG[task.status]

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
              <span className={`badge badge-${statusConfig.color}`}>
                {statusConfig.label}
              </span>
              {config.partPNotifiable && (
                <span className="badge badge-warning">Part P</span>
              )}
            </div>
          </div>
        </div>

        <div className="card mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Progress</h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-200 rounded-full h-3">
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

        <EvidenceChecklist
          taskType={task.taskType}
          capturedEvidence={capturedEvidence}
          onCaptureStart={handleCaptureStart}
        />
      </div>
    </div>
  )
}
