import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { FileText, Download, Loader2 } from 'lucide-react'
import { trackEvent } from '../utils/analytics'

interface AuditPack {
  id: string
  createdAt: string
  jobCount: number
  evidenceCount: number
  url: string
}

export default function AuditPacks() {
  const [packs] = useState<AuditPack[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    trackEvent('page_view', {
      page_name: 'audit_packs',
      existing_packs_count: packs.length
    })
  }, [])

  const handleGenerate = async () => {
    setIsGenerating(true)
    
    trackEvent('audit_pack_generate_start', {
      date_from: dateFrom || 'not_set',
      date_to: dateTo || 'not_set',
      has_date_range: !!(dateFrom && dateTo)
    })

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      
      trackEvent('audit_pack_generate_success', {
        date_from: dateFrom || 'not_set',
        date_to: dateTo || 'not_set'
      })
    } catch (error) {
      trackEvent('audit_pack_generate_error', {
        error_type: error instanceof Error ? error.name : 'unknown'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = (pack: AuditPack) => {
    trackEvent('audit_pack_download', {
      pack_id: pack.id,
      job_count: pack.jobCount,
      evidence_count: pack.evidenceCount,
      pack_age_days: Math.floor(
        (Date.now() - new Date(pack.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      )
    })
  }

  return (
    <div>
      <Helmet>
        <title>Audit Packs | WorkProof</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Audit Packs</h1>

        <div className="card mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Generate New Pack</h2>
          <p className="text-sm text-gray-600 mb-4">
            Create a PDF audit pack with evidence from your jobs
          </p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                <span>Generate Audit Pack</span>
              </>
            )}
          </button>
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Previous Packs</h2>

          {packs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No audit packs generated yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Generate your first pack above
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {packs.map((pack) => (
                <div
                  key={pack.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {new Date(pack.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-sm text-gray-500">
                      {pack.jobCount} jobs • {pack.evidenceCount} evidence items
                    </p>
                  </div>
                  
                    href={pack.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleDownload(pack)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
