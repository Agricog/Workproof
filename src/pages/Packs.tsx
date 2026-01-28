/**
 * WorkProof Packs List
 * Shows completed jobs ready for audit pack export
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@clerk/clerk-react'
import {
  CheckCircle,
  Clock,
  Download,
  Eye,
  MapPin,
  Calendar,
  Camera,
  AlertCircle,
  RefreshCw,
  Package,
  Shield,
} from 'lucide-react'
import { trackPageView, trackError } from '../utils/analytics'
import { jobsApi, tasksApi } from '../services/api'
import { captureError } from '../utils/errorTracking'
import { getTaskTypeConfig } from '../types/taskConfigs'
import type { Job, Task } from '../types/models'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface PackJob extends Job {
  tasks: Task[]
  totalEvidence: number
  totalRequired: number
  isComplete: boolean
}

type PackFilter = 'all' | 'ready' | 'incomplete'

export default function Packs() {
  const { getToken } = useAuth()
  const [packs, setPacks] = useState<PackJob[]>([])
  const [filteredPacks, setFilteredPacks] = useState<PackJob[]>([])
  const [filter, setFilter] = useState<PackFilter>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    trackPageView('/packs', 'Packs')
    loadPacks()
  }, [])

  useEffect(() => {
    filterPacks()
  }, [packs, filter])

  const loadPacks = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const token = await getToken()
      
      // Get all jobs
      const jobsResponse = await jobsApi.list(token)
      
      if (jobsResponse.error) {
        setError(jobsResponse.error)
        trackError('api_error', 'packs_load')
        return
      }

      // Handle response format
      const jobData = jobsResponse.data as unknown
      let jobItems: Job[] = []
      
      if (Array.isArray(jobData)) {
        jobItems = jobData
      } else if (jobData && typeof jobData === 'object' && 'items' in jobData) {
        jobItems = (jobData as { items: Job[] }).items || []
      }

      // For each job, get tasks and evidence counts
      const packsWithDetails: PackJob[] = []
      
      for (const job of jobItems) {
        // Get tasks for this job
        const tasksResponse = await tasksApi.listByJob(job.id, token)
        let tasks: Task[] = []
        
        if (tasksResponse.data) {
          const taskData = tasksResponse.data as unknown
          if (Array.isArray(taskData)) {
            tasks = taskData
          } else if (taskData && typeof taskData === 'object' && 'items' in taskData) {
            tasks = (taskData as { items: Task[] }).items || []
          }
        }

        // Get evidence counts
        let evidenceCounts: Record<string, number> = {}
        
        try {
          const countsResponse = await fetch(`${API_BASE}/api/evidence/counts-by-job?job_id=${job.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          })
          
          if (countsResponse.ok) {
            const countsData = await countsResponse.json()
            evidenceCounts = countsData.counts || {}
          }
        } catch {
          // Continue with zero counts
        }

        // Calculate totals
        let totalEvidence = 0
        let totalRequired = 0
        
        tasks.forEach(task => {
          const config = getTaskTypeConfig(task.taskType)
          totalEvidence += evidenceCounts[task.id] || 0
          totalRequired += config.requiredEvidence.length
        })

        const isComplete = totalRequired > 0 && totalEvidence >= totalRequired

        packsWithDetails.push({
          ...job,
          tasks,
          totalEvidence,
          totalRequired,
          isComplete
        })
      }

      setPacks(packsWithDetails)
    } catch (err) {
      const errorMessage = 'Failed to load packs. Please try again.'
      setError(errorMessage)
      captureError(err, 'Packs.loadPacks')
      trackError(err instanceof Error ? err.name : 'unknown', 'packs_load')
    } finally {
      setIsLoading(false)
    }
  }

  const filterPacks = () => {
    let filtered = [...packs]

    if (filter === 'ready') {
      filtered = filtered.filter(p => p.isComplete)
    } else if (filter === 'incomplete') {
      filtered = filtered.filter(p => !p.isComplete)
    }

    // Sort by completion status (complete first), then by date
    filtered.sort((a, b) => {
      if (a.isComplete !== b.isComplete) {
        return a.isComplete ? -1 : 1
      }
      return new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime()
    })

    setFilteredPacks(filtered)
  }

  const handleDownloadPack = async (e: React.MouseEvent, jobId: string) => {
    e.preventDefault()
    e.stopPropagation()

    setDownloadingId(jobId)

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

      // Get the blob and create download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-pack-${jobId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      captureError(err, 'Packs.handleDownloadPack')
      setError('Failed to download pack. Please try again.')
    } finally {
      setDownloadingId(null)
    }
  }

  const readyCount = packs.filter(p => p.isComplete).length
  const incompleteCount = packs.filter(p => !p.isComplete).length

  return (
    <>
      <Helmet>
        <title>Audit Packs | WorkProof</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Packs</h1>
            <p className="text-sm text-gray-500 mt-1">
              Evidence packages for NICEIC compliance
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="badge badge-green flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              {readyCount} Ready
            </span>
            <span className="badge badge-gray flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {incompleteCount} In Progress
            </span>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 text-sm">{error}</p>
              <button
                onClick={loadPacks}
                className="text-red-600 text-sm font-medium mt-2 flex items-center gap-1 hover:text-red-700"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2" role="group" aria-label="Filter packs">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            aria-pressed={filter === 'all'}
          >
            All ({packs.length})
          </button>
          <button
            onClick={() => setFilter('ready')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === 'ready'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            aria-pressed={filter === 'ready'}
          >
            Ready ({readyCount})
          </button>
          <button
            onClick={() => setFilter('incomplete')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === 'incomplete'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            aria-pressed={filter === 'incomplete'}
          >
            In Progress ({incompleteCount})
          </button>
        </div>

        {/* Packs List */}
        {isLoading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading packs">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : filteredPacks.length === 0 ? (
          <div className="card text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden="true" />
            <p className="text-gray-500 mb-2">
              {filter === 'ready' 
                ? 'No completed packs yet'
                : filter === 'incomplete'
                ? 'No jobs in progress'
                : 'No jobs yet'}
            </p>
            <Link to="/jobs/new" className="text-green-600 font-medium text-sm">
              Create your first job
            </Link>
          </div>
        ) : (
          <div className="space-y-3" role="list" aria-label="Audit packs list">
            {filteredPacks.map((pack) => {
              const progressPercent = pack.totalRequired > 0 
                ? Math.round((pack.totalEvidence / pack.totalRequired) * 100)
                : 0
              const isDownloading = downloadingId === pack.id

              return (
                <div
                  key={pack.id}
                  className="card"
                  role="listitem"
                >
                  {/* Pack Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900 truncate">
                          {pack.clientName || 'Unknown Client'}
                        </h3>
                        {pack.isComplete ? (
                          <span className="badge badge-green flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            Ready
                          </span>
                        ) : (
                          <span className="badge badge-gray flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            In Progress
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <MapPin className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                        <span className="truncate">{pack.address || 'No address'}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" aria-hidden="true" />
                          {pack.startDate ? new Date(pack.startDate).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          }) : 'No date'}
                        </div>
                        <div className="flex items-center gap-1">
                          <Camera className="w-3 h-3" aria-hidden="true" />
                          {pack.totalEvidence}/{pack.totalRequired} evidence
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div 
                      className="w-full bg-gray-200 rounded-full h-2"
                      role="progressbar"
                      aria-valuenow={progressPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={`h-2 rounded-full transition-all ${
                          pack.isComplete ? 'bg-green-600' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(progressPercent, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Compliance Indicators */}
                  {pack.isComplete && (
                    <div className="flex flex-wrap gap-2 mb-4 text-xs">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        GPS Verified
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Timestamps Valid
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        All Evidence Captured
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <Link
                      to={`/packs/${pack.id}`}
                      className="flex-1 btn-secondary flex items-center justify-center gap-2 text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      Preview
                    </Link>
                    <button
                      onClick={(e) => handleDownloadPack(e, pack.id)}
                      disabled={!pack.isComplete || isDownloading}
                      className={`flex-1 flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors ${
                        pack.isComplete
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
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
