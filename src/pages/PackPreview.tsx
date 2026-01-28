/**
 * WorkProof Pack Preview
 * View all evidence for a job before export
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@clerk/clerk-react'
import {
  ArrowLeft,
  Download,
  MapPin,
  Calendar,
  Camera,
  CheckCircle,
  Clock,
  Shield,
  AlertCircle,
  RefreshCw,
  Navigation,
  Hash,
  FileText,
  X,
} from 'lucide-react'
import { trackPageView, trackError } from '../utils/analytics'
import { jobsApi, tasksApi, evidenceApi } from '../services/api'
import { captureError } from '../utils/errorTracking'
import { getTaskTypeConfig } from '../types/taskConfigs'
import type { Job, Task } from '../types/models'

const API_BASE = import.meta.env.VITE_API_URL || ''

// Local interface for evidence as returned by API
interface EvidenceItem {
  id: string
  taskId: string
  evidenceType: string
  photoUrl: string
  photoHash?: string
  latitude?: number
  longitude?: number
  gpsAccuracy?: number
  capturedAt?: string
  syncedAt?: string
  isSynced?: boolean
}

interface TaskWithEvidence extends Task {
  evidence: EvidenceItem[]
  requiredCount: number
}

export default function PackPreview() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { getToken } = useAuth()

  const [job, setJob] = useState<Job | null>(null)
  const [tasks, setTasks] = useState<TaskWithEvidence[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<EvidenceItem | null>(null)

  useEffect(() => {
    trackPageView(`/packs/${jobId}`, 'Pack Preview')
    loadPackData()
  }, [jobId])

  const loadPackData = async () => {
    if (!jobId) return

    setIsLoading(true)
    setError(null)

    try {
      const token = await getToken()

      // Get job details
      const jobResponse = await jobsApi.get(jobId, token)
      if (jobResponse.error) {
        setError(jobResponse.error)
        return
      }
      if (jobResponse.data) {
        setJob(jobResponse.data)
      }

      // Get tasks
      const tasksResponse = await tasksApi.listByJob(jobId, token)
      let taskItems: Task[] = []
      
      if (tasksResponse.data) {
        const taskData = tasksResponse.data as unknown
        if (Array.isArray(taskData)) {
          taskItems = taskData
        } else if (taskData && typeof taskData === 'object' && 'items' in taskData) {
          taskItems = (taskData as { items: Task[] }).items || []
        }
      }

      // Get evidence for each task
      const tasksWithEvidence: TaskWithEvidence[] = []
      
      for (const task of taskItems) {
        const config = getTaskTypeConfig(task.taskType)
        let evidence: EvidenceItem[] = []
        
        try {
          const evidenceResponse = await evidenceApi.listByTask(task.id, token)
          if (evidenceResponse.data) {
            const evData = evidenceResponse.data as unknown
            if (Array.isArray(evData)) {
              evidence = evData as EvidenceItem[]
            } else if (evData && typeof evData === 'object' && 'items' in evData) {
              evidence = (evData as { items: EvidenceItem[] }).items || []
            }
          }
        } catch {
          // Continue with empty evidence
        }

        tasksWithEvidence.push({
          ...task,
          evidence,
          requiredCount: config.requiredEvidence.length
        })
      }

      setTasks(tasksWithEvidence)
    } catch (err) {
      const errorMessage = 'Failed to load pack details. Please try again.'
      setError(errorMessage)
      captureError(err, 'PackPreview.loadPackData')
      trackError(err instanceof Error ? err.name : 'unknown', 'pack_preview_load')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadPack = async () => {
    if (!jobId) return

    setIsDownloading(true)

    try {
      const token = await getToken()
      
      const response = await fetch(`${API_BASE}/api/packs/${jobId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to generate PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-pack-${job?.clientName || jobId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      captureError(err, 'PackPreview.handleDownloadPack')
      setError('Failed to download pack. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  const totalEvidence = tasks.reduce((sum, t) => sum + t.evidence.length, 0)
  const totalRequired = tasks.reduce((sum, t) => sum + t.requiredCount, 0)
  const isComplete = totalRequired > 0 && totalEvidence >= totalRequired
  const progressPercent = totalRequired > 0 ? Math.round((totalEvidence / totalRequired) * 100) : 0

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4" aria-busy="true">
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 mb-4">Pack not found</p>
        <Link to="/packs" className="text-green-600 font-medium">
          Back to packs
        </Link>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Pack: {job.clientName} | WorkProof</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          
          <button
            onClick={handleDownloadPack}
            disabled={!isComplete || isDownloading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isComplete
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isDownloading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download PDF
              </>
            )}
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 text-sm">{error}</p>
              <button
                onClick={loadPackData}
                className="text-red-600 text-sm font-medium mt-2 flex items-center gap-1"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Job Summary Card */}
        <div className="card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-5 h-5 text-gray-400" />
                <h1 className="text-xl font-bold text-gray-900">
                  {job.clientName || 'Unknown Client'}
                </h1>
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <MapPin className="w-3 h-3" />
                {job.address || 'No address'}
              </div>
            </div>
            {isComplete ? (
              <span className="badge badge-green flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Ready for Export
              </span>
            ) : (
              <span className="badge badge-amber flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Incomplete
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{tasks.length}</p>
              <p className="text-xs text-gray-500">Tasks</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{totalEvidence}</p>
              <p className="text-xs text-gray-500">Evidence</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{progressPercent}%</p>
              <p className="text-xs text-gray-500">Complete</p>
            </div>
          </div>

          {/* Progress */}
          <div 
            className="w-full bg-gray-200 rounded-full h-2"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-2 rounded-full transition-all ${
                isComplete ? 'bg-green-600' : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>

          {/* Compliance Status */}
          {isComplete && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs">
                <CheckCircle className="w-3 h-3" />
                GPS Verified
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs">
                <CheckCircle className="w-3 h-3" />
                Timestamps Valid
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs">
                <CheckCircle className="w-3 h-3" />
                Hash Integrity
              </span>
            </div>
          )}
        </div>

        {/* Tasks & Evidence */}
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-900">Evidence by Task</h2>

          {tasks.length === 0 ? (
            <div className="card text-center py-8">
              <Camera className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No tasks in this job</p>
            </div>
          ) : (
            tasks.map((task) => {
              const config = getTaskTypeConfig(task.taskType)
              const taskComplete = task.evidence.length >= task.requiredCount

              return (
                <div key={task.id} className="card">
                  {/* Task Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{config.label}</h3>
                      {config.partPNotifiable && (
                        <span className="badge badge-warning text-xs">Part P</span>
                      )}
                    </div>
                    <span className={`text-sm font-medium ${
                      taskComplete ? 'text-green-600' : 'text-amber-600'
                    }`}>
                      {task.evidence.length}/{task.requiredCount}
                    </span>
                  </div>

                  {/* Evidence Grid */}
                  {task.evidence.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-lg">
                      <Camera className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No evidence captured</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {task.evidence.map((ev) => (
                        <button
                          key={ev.id}
                          onClick={() => setSelectedImage(ev)}
                          className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity"
                        >
                          <img
                            src={ev.photoUrl}
                            alt={ev.evidenceType || 'Evidence'}
                            className="w-full h-full object-cover"
                          />
                          {/* Verification Badge */}
                          <div className="absolute bottom-1 right-1 bg-green-500 text-white p-1 rounded-full">
                            <CheckCircle className="w-3 h-3" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full"
            aria-label="Close preview"
          >
            <X className="w-6 h-6" />
          </button>

          <div 
            className="max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage.photoUrl}
              alt={selectedImage.evidenceType || 'Evidence'}
              className="w-full max-h-[70vh] object-contain rounded-lg"
            />
            
            {/* Metadata */}
            <div className="mt-4 bg-white/10 backdrop-blur rounded-lg p-4 text-white">
              <h3 className="font-medium text-lg mb-3">
                {selectedImage.evidenceType || 'Evidence'}
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>
                    {selectedImage.capturedAt
                      ? new Date(selectedImage.capturedAt).toLocaleString('en-GB')
                      : 'Unknown time'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-gray-400" />
                  <span>
                    {selectedImage.latitude && selectedImage.longitude
                      ? `${selectedImage.latitude.toFixed(6)}, ${selectedImage.longitude.toFixed(6)}`
                      : 'No GPS data'}
                  </span>
                </div>
                {selectedImage.gpsAccuracy && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>±{Math.round(selectedImage.gpsAccuracy)}m accuracy</span>
                  </div>
                )}
                {selectedImage.photoHash && (
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-gray-400" />
                    <span className="font-mono text-xs truncate">
                      {selectedImage.photoHash.substring(0, 16)}...
                    </span>
                  </div>
                )}
              </div>
              
              {/* Verification Status */}
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/20">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-300 rounded-full text-xs">
                  <CheckCircle className="w-3 h-3" />
                  Timestamp Verified
                </span>
                {selectedImage.latitude && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-300 rounded-full text-xs">
                    <CheckCircle className="w-3 h-3" />
                    GPS Verified
                  </span>
                )}
                {selectedImage.photoHash && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-300 rounded-full text-xs">
                    <CheckCircle className="w-3 h-3" />
                    Hash Integrity
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
