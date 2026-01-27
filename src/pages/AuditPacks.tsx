import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@clerk/clerk-react'
import { FileText, Download, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { trackPageView, trackAuditPackGenerated, trackAuditPackDownloaded, trackError } from '../utils/analytics'
import { captureError } from '../utils/errorTracking'
import { auditPackApi, jobsApi } from '../services/api'
import type { Job } from '../types/models'

// API response shape for audit packs
interface AuditPackResponse {
  id: string
  job_id: string
  generated_at: string
  pdf_url?: string
  evidence_count: number
  hash: string
}

export default function AuditPacks() {
  const { getToken } = useAuth()
  const [packs, setPacks] = useState<AuditPackResponse[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    trackPageView('/audit-packs', 'Audit Packs')
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const token = await getToken()

      // Load jobs for selection
      const jobsResponse = await jobsApi.list(token)
      if (jobsResponse.data) {
        setJobs(jobsResponse.data)
        // Auto-select first job if available
        if (jobsResponse.data.length > 0 && !selectedJobId) {
          const firstJobId = jobsResponse.data[0]?.id
          if (firstJobId) {
            setSelectedJobId(firstJobId)
            // Load packs for first job
            await loadPacksForJob(firstJobId, token)
          }
        }
      }
    } catch (err) {
      const errorMessage = 'Failed to load data. Please try again.'
      setError(errorMessage)
      captureError(err, 'AuditPacks.loadData')
      trackError(
        err instanceof Error ? err.name : 'unknown',
        'audit_packs_load'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const loadPacksForJob = async (jobId: string, token?: string | null) => {
    if (!jobId) return

    try {
      const authToken = token || await getToken()
      const packsResponse = await auditPackApi.listByJob(jobId, authToken)
      if (packsResponse.data) {
        setPacks(packsResponse.data)
      }
    } catch (err) {
      captureError(err, 'AuditPacks.loadPacksForJob')
    }
  }

  const handleJobChange = async (jobId: string) => {
    setSelectedJobId(jobId)
    if (jobId) {
      await loadPacksForJob(jobId)
    } else {
      setPacks([])
    }
  }

  const handleGenerate = async () => {
    if (!selectedJobId) {
      setError('Please select a job')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const token = await getToken()

      const response = await auditPackApi.generate(selectedJobId, token)

      if (response.error) {
        setError(response.error)
        trackError('api_error', 'audit_pack_generate')
        return
      }

      if (response.data) {
        // Add new pack to list
        setPacks((prev) => [response.data!, ...prev])
        trackAuditPackGenerated(response.data.evidence_count || 0)
      }
    } catch (err) {
      const errorMessage = 'Failed to generate audit pack. Please try again.'
      setError(errorMessage)
      captureError(err, 'AuditPacks.handleGenerate')
      trackError(
        err instanceof Error ? err.name : 'unknown',
        'audit_pack_generate'
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = () => {
    trackAuditPackDownloaded()
    // URL will open in new tab via the anchor tag
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading audit packs">
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-48 bg-gray-200 rounded"></div>
      </div>
    )
  }

  return (
    <div>
      <Helmet>
        <title>Audit Packs | WorkProof</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Audit Packs</h1>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 text-sm">{error}</p>
              <button
                onClick={loadData}
                className="text-red-600 text-sm font-medium mt-2 flex items-center gap-1 hover:text-red-700"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Generate New Pack */}
        <div className="card mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Generate New Pack</h2>
          <p className="text-sm text-gray-600 mb-4">
            Create a PDF audit pack with evidence from your jobs
          </p>

          {/* Job Selection */}
          <div className="mb-4">
            <label htmlFor="jobSelect" className="block text-sm font-medium text-gray-700 mb-1">
              Select Job
            </label>
            <select
              id="jobSelect"
              value={selectedJobId}
              onChange={(e) => handleJobChange(e.target.value)}
              className="input-field"
              aria-label="Select a job for audit pack"
            >
              <option value="">Select a job...</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.clientName} - {job.address}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filters */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedJobId}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" aria-hidden="true" />
                <span>Generate Audit Pack</span>
              </>
            )}
          </button>
        </div>

        {/* Previous Packs */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Previous Packs</h2>

          {packs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden="true" />
              <p className="text-gray-500">No audit packs generated yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Generate your first pack above
              </p>
            </div>
          ) : (
            <div className="space-y-3" role="list" aria-label="Audit packs list">
              {packs.map((pack) => (
                <div
                  key={pack.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  role="listitem"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {new Date(pack.generated_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-sm text-gray-500">
                      {pack.evidence_count || 0} evidence items
                    </p>
                  </div>
                  {pack.pdf_url && (
                    <a
                      href={pack.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleDownload}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      aria-label={`Download audit pack from ${new Date(pack.generated_at).toLocaleDateString('en-GB')}`}
                    >
                      <Download className="w-5 h-5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
