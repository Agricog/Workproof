/**
 * WorkProof Task Detail
 * Evidence capture for a specific task
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowLeft, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import EvidenceChecklist from '../components/capture/EvidenceChecklist'
import PhotoCapture from '../components/capture/PhotoCapture'
import { getTaskTypeConfig, getEvidenceLabel } from '../types/taskConfigs'
import { getEvidenceByTask } from '../utils/indexedDB'
import { blobToDataUrl } from '../utils/compression'
import type { Task, TaskStatus, EvidenceType } from '../types/models'
import type { OfflineEvidenceItem } from '../types/api'

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Not Started', color: 'gray', icon: Clock },
  in_progress: { label: 'In Progress', color: 'amber', icon: Clock },
  complete: { label: 'Complete', color: 'blue', icon: CheckCircle },
  signed_off: { label: 'Signed Off', color: 'green', icon: CheckCircle },
}

export default function TaskDetail() {
  const { jobId, taskId } = useParams<{ jobId: string; taskId: string }>()
  const navigate = useNavigate()

  const [task, setTask] = useState<Task | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [captureMode, setCaptureMode] = useState<EvidenceType | null>(null)
  const [viewingEvidence, setViewingEvidence] = useState<OfflineEvidenceItem | null>(null)
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null)

  // Mock worker ID - would come from auth context
  const workerId = 'worker1'

  useEffect(() => {
    loadTaskData()
  }, [taskId])

  const loadTaskData = async () => {
    setIsLoading(true)
    try {
      // TODO: Fetch from API
      // Placeholder data
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
      })
    } catch (error) {
      console.error('Failed to load task:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCaptureClick = useCallback((evidenceType: EvidenceType) => {
    setCaptureMode(evidenceType)
  }, [])

  const handleViewClick = useCallback(async (evidence: OfflineEvidenceItem) => {
    setViewingEvidence(evidence)
    
    // Generate preview URL
    if (evidence.photoBlob) {
      const dataUrl = await blobToDataUrl(evidence.photoBlob)
      setEvidencePreview(dataUrl)
    }
  }, [])

  const handleCaptureComplete = useCallback((evidence: OfflineEvidenceItem) => {
    setCaptureMode(null)
    // Refresh the checklist
    loadTaskData()
  }, [])

  const handleCaptureCancel = useCallback(() => {
    setCaptureMode(null)
  }, [])

  const handleClosePreview = useCallback(() => {
    setViewingEvidence(null)
    setEvidencePreview(null)
  }, [])

  const handleMarkComplete = async () => {
    if (!task) return

    // Check if all required evidence is captured
    const evidence = await getEvidenceByTask(task.id)
    const config = getTaskTypeConfig(task.taskType)
    const capturedTypes = new Set(evidence.map((e) => e.evidenceType))
    const missingRequired = config.requiredEvidence.filter((type) => !capturedTypes.has(type))

    if (missingRequired.length > 0) {
      alert(`Please capture all required evidence before marking complete.\n\nMissing: ${missingRequired.map(getEvidenceLabel).join(', ')}`)
      return
    }

    // TODO: Update via API
    setTask((prev) => prev ? { ...prev, status: 'complete', completedAt: new Date().toISOString() } : null)
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/2" />
        <div className="h-32 bg-gray-200 rounded" />
        <div className="h-48 bg-gray-200 rounded" />
      </div>
    )
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Task not found</p>
        <button onClick={() => navigate(-1)} className="text-green-600 font-medium">
          Go back
        </button>
      </div>
    )
  }

  const config = getTaskTypeConfig(task.taskType)
  const statusConfig = STATUS_CONFIG[task.status]
  const StatusIcon = statusConfig.icon

  return (
    <>
      <Helmet>
        <title>{config.label} | WorkProof</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Photo Capture Modal */}
      {captureMode && (
        <PhotoCapture
          taskId={task.id}
          evidenceType={captureMode}
          workerId={workerId}
          onCapture={handleCaptureComplete}
          onCancel={handleCaptureCancel}
          label={getEvidenceLabel(captureMode)}
        />
      )}

      {/* Evidence Preview Modal */}
      {viewingEvidence && evidencePreview && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="bg-black/80 px-4 py-3 flex items-center justify-between">
            <button
              onClick={handleClosePreview}
              className="text-white font-medium"
            >
              Close
            </button>
            <span className="text-white text-sm">
              {getEvidenceLabel(viewingEvidence.evidenceType as EvidenceType)}
            </span>
            <div className="w-12" /> {/* Spacer */}
          </div>
          
          <div className="flex-1 flex items-center justify-center p-4">
            <img
              src={evidencePreview}
              alt="Evidence"
              className="max-w-full max-h-full object-contain"
            />
          </div>

          <div className="bg-black/80 px-4 py-3 text-white text-xs space-y-1">
            <p>Captured: {new Date(viewingEvidence.capturedAt).toLocaleString('en-GB')}</p>
            {viewingEvidence.capturedLat && viewingEvidence.capturedLng && (
              <p>Location: {viewingEvidence.capturedLat.toFixed(6)}, {viewingEvidence.capturedLng.toFixed(6)}</p>
            )}
            <p className="font-mono text-[10px] opacity-70 truncate">
              Hash: {viewingEvidence.photoBytesHash}
            </p>
            <p className={`flex items-center gap-1 ${
              viewingEvidence.syncStatus === 'synced' ? 'text-green-400' : 'text-amber-400'
            }`}>
              {viewingEvidence.syncStatus === 'synced' ? (
                <CheckCircle className="w-3 h-3" />
              ) : (
                <AlertCircle className="w-3 h-3" />
              )}
              {viewingEvidence.syncStatus === 'synced' ? 'Synced' : 'Pending sync'}
            </p>
          </div>
        </div>
      )}

      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{config.label}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`badge badge-${statusConfig.color} flex items-center gap-1`}>
                <StatusIcon className="w-3 h-3" />
                {statusConfig.label}
              </span>
              {config.partPNotifiable && (
                <span className="badge badge-warning">Part P</span>
              )}
            </div>
          </div>
        </div>

        {/* Task Info */}
        <div className="card mb-6">
          <p className="text-sm text-gray-600">{config.description}</p>
          
          {config.niceicRelevance === 'high' && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                High NICEIC relevance - ensure all evidence is captured thoroughly
              </p>
            </div>
          )}
        </div>

        {/* Evidence Checklist */}
        <EvidenceChecklist
          taskId={task.id}
          taskType={task.taskType}
          onCaptureClick={handleCaptureClick}
          onViewClick={handleViewClick}
        />

        {/* Complete Button */}
        {task.status !== 'complete' && task.status !== 'signed_off' && (
          <div className="mt-6">
            <button
              onClick={handleMarkComplete}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Mark Task Complete
            </button>
          </div>
        )}

        {task.status === 'complete' && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <CheckCircle className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="font-medium text-blue-900">Task Complete</p>
            <p className="text-sm text-blue-700 mt-1">
              Completed {task.completedAt && new Date(task.completedAt).toLocaleDateString('en-GB')}
            </p>
          </div>
        )}
      </div>
    </>
  )
}
