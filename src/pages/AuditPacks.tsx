/**
 * WorkProof Audit Packs
 * Generate and manage audit packs for NICEIC assessments
 */

import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  FileText,
  Plus,
  Calendar,
  Download,
  Filter,
  ChevronRight,
  X,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import type { AuditPack } from '../types/models'

export default function AuditPacks() {
  const [packs, setPacks] = useState<AuditPack[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showGenerator, setShowGenerator] = useState(false)
  const [generatorState, setGeneratorState] = useState<'form' | 'preview' | 'generating' | 'complete'>('form')
  
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  })
  
  const [preview, setPreview] = useState({
    jobCount: 0,
    evidenceCount: 0,
    estimatedPages: 0,
  })

  const handleGeneratePreview = async () => {
    setGeneratorState('preview')
    
    // TODO: Fetch preview from API
    // Placeholder
    setPreview({
      jobCount: 12,
      evidenceCount: 89,
      estimatedPages: 24,
    })
  }

  const handleGenerate = async () => {
    setGeneratorState('generating')
    
    // TODO: Generate via API
    // Simulate generation
    await new Promise((resolve) => setTimeout(resolve, 3000))
    
    setGeneratorState('complete')
  }

  const handleDownload = (packId: string) => {
    // TODO: Download PDF
    console.log('Download pack:', packId)
  }

  const resetGenerator = () => {
    setShowGenerator(false)
    setGeneratorState('form')
    setDateRange({
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
    })
  }

  return (
    <>
      <Helmet>
        <title>Audit Packs | WorkProof</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Audit Packs</h1>
          <button
            onClick={() => setShowGenerator(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Generate
          </button>
        </div>

        {/* Info Card */}
        <div className="card mb-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-green-900">NICEIC Ready</h3>
              <p className="text-sm text-green-700 mt-1">
                Generate audit packs with hash verification, GPS coordinates, and timestamps.
                Perfect for your annual assessment.
              </p>
            </div>
          </div>
        </div>

        {/* Packs List */}
        {packs.length === 0 ? (
          <div className="card text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="font-medium text-gray-900 mb-2">No audit packs yet</h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Generate your first audit pack to create a NICEIC-ready PDF with all your evidence.
            </p>
            <button
              onClick={() => setShowGenerator(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Generate Audit Pack
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {packs.map((pack) => (
              <div key={pack.id} className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {new Date(pack.dateRangeStart).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}{' '}
                      -{' '}
                      {new Date(pack.dateRangeEnd).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {pack.jobsIncluded.length} jobs • Generated{' '}
                      {new Date(pack.generatedAt).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDownload(pack.id)}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Generator Modal */}
        {showGenerator && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md overflow-hidden animate-slide-up">
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  {generatorState === 'form' && 'Generate Audit Pack'}
                  {generatorState === 'preview' && 'Preview'}
                  {generatorState === 'generating' && 'Generating...'}
                  {generatorState === 'complete' && 'Complete'}
                </h3>
                <button
                  onClick={resetGenerator}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4">
                {generatorState === 'form' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date Range
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">From</label>
                          <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) =>
                              setDateRange((prev) => ({ ...prev, start: e.target.value }))
                            }
                            className="input-field"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">To</label>
                          <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) =>
                              setDateRange((prev) => ({ ...prev, end: e.target.value }))
                            }
                            className="input-field"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Filter className="w-4 h-4" />
                        <span>All job types included</span>
                      </div>
                    </div>

                    <button onClick={handleGeneratePreview} className="btn-primary w-full">
                      Preview
                    </button>
                  </div>
                )}

                {generatorState === 'preview' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold text-gray-900">{preview.jobCount}</p>
                        <p className="text-xs text-gray-500">Jobs</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold text-gray-900">{preview.evidenceCount}</p>
                        <p className="text-xs text-gray-500">Evidence</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold text-gray-900">~{preview.estimatedPages}</p>
                        <p className="text-xs text-gray-500">Pages</p>
                      </div>
                    </div>

                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-green-900">Hash verification included</p>
                          <p className="text-green-700">
                            Each photo will include SHA-256 verification
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setGeneratorState('form')}
                        className="btn-secondary flex-1"
                      >
                        Back
                      </button>
                      <button onClick={handleGenerate} className="btn-primary flex-1">
                        Generate PDF
                      </button>
                    </div>
                  </div>
                )}

                {generatorState === 'generating' && (
                  <div className="py-8 text-center">
                    <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="font-medium text-gray-900">Generating your audit pack...</p>
                    <p className="text-sm text-gray-500 mt-1">This may take a minute</p>
                  </div>
                )}

                {generatorState === 'complete' && (
                  <div className="py-8 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <p className="font-medium text-gray-900 mb-1">Audit Pack Ready</p>
                    <p className="text-sm text-gray-500 mb-6">
                      Your NICEIC-ready PDF has been generated
                    </p>
                    <div className="flex gap-3">
                      <button onClick={resetGenerator} className="btn-secondary flex-1">
                        Close
                      </button>
                      <button className="btn-primary flex-1 flex items-center justify-center gap-2">
                        <Download className="w-4 h-4" />
                        Download PDF
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
