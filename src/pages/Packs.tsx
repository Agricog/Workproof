/**
 * WorkProof Packs List
 * Shows completed jobs ready for audit pack export
 * Uses server-side aggregation with Redis caching for instant loading
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@clerk/clerk-react'
import {
  CheckCircle,
  Clock,
  Eye,
  MapPin,
  Calendar,
  Camera,
  AlertCircle,
  RefreshCw,
  Package,
  Shield,
  Zap,
} from 'lucide-react'
import { trackPageView, trackError } from '../utils/analytics'
import { captureError } from '../utils/errorTracking'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface PackJob {
  id: string
  clientName: string
  address: string
  startDate: string
  status: string
  tasks: Array<{
    id: string
    taskType: string
  }>
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
  const [isCached, setIsCached] = useState(false)

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
      
      // Single API call - server does all the aggregation
      const response = await fetch(`${API_BASE}/api/packs/list`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to load packs')
      }

      const data = await response.json()
      setPacks(data.items || [])
      setIsCached(data.cached || false)

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
              {isCached && (
                <span className="inline-flex items-center gap-1 ml-2 text-green-600">
                  <Zap className="w-3 h-3" />
                  Instant
                </span>
              )}
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

                  {/* Action - Preview Only */}
                  <div className="pt-3 border-t border-gray-100">
                    <Link
                      to={`/packs/${pack.id}`}
                      className={`w-full flex items-center justify-center gap-2 text-sm px-4 py-3 rounded-lg transition-colors ${
                        pack.isComplete
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'btn-secondary'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      {pack.isComplete ? 'Preview & Download' : 'Preview Progress'}
                    </Link>
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
