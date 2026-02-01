/**
 * Public Verification Page
 * Allows anyone to verify an audit pack's authenticity via QR code
 * No authentication required - this is intentionally public
 */
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { 
  Shield, 
  ShieldCheck, 
  ShieldX, 
  MapPin, 
  Calendar, 
  Camera, 
  Hash, 
  Building2,
  Clock,
  AlertCircle,
  ExternalLink
} from 'lucide-react'

interface VerificationData {
  verified: boolean
  packId: string
  jobTitle: string
  clientName: string
  address: string
  postcode: string
  generatedAt: string
  evidenceCount: number
  hashValid: boolean
  packHash: string
  gpsVerified: boolean
  gpsSummary: {
    latitude: number
    longitude: number
    radius: number
  } | null
  evidenceSummary: {
    beforeCount: number
    duringCount: number
    afterCount: number
    customCount: number
  }
}

export default function Verify() {
  const { packId } = useParams<{ packId: string }>()
  const [data, setData] = useState<VerificationData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (packId) {
      verifyPack(packId)
    }
  }, [packId])

  const verifyPack = async (id: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const apiUrl = import.meta.env.VITE_API_URL || ''
      const response = await fetch(`${apiUrl}/api/verify/${id}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Audit pack not found. Please check the verification link.')
        } else {
          setError('Unable to verify this pack. Please try again later.')
        }
        return
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError('Connection error. Please check your internet and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Verifying audit pack...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Helmet>
          <title>Verification Failed | WorkProof</title>
        </Helmet>
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldX className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Verification Failed</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
          >
            Go to WorkProof
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>
          {data.verified ? 'Verified' : 'Unverified'} Audit Pack | WorkProof
        </title>
        <meta 
          name="description" 
          content={`Verification status for audit pack: ${data.jobTitle}`} 
        />
      </Helmet>

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-green-600" />
              <span className="font-bold text-gray-900">WorkProof</span>
            </div>
            <span className="text-sm text-gray-500">Evidence Verification</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Verification Status Card */}
        <div className={`rounded-2xl p-6 mb-6 ${
          data.verified 
            ? 'bg-green-50 border-2 border-green-200' 
            : 'bg-red-50 border-2 border-red-200'
        }`}>
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${
              data.verified ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {data.verified ? (
                <ShieldCheck className="w-7 h-7 text-green-600" />
              ) : (
                <ShieldX className="w-7 h-7 text-red-600" />
              )}
            </div>
            <div>
              <h1 className={`text-xl font-bold ${
                data.verified ? 'text-green-800' : 'text-red-800'
              }`}>
                {data.verified 
                  ? 'Cryptographically Verified' 
                  : 'Verification Failed'
                }
              </h1>
              <p className={`mt-1 ${
                data.verified ? 'text-green-700' : 'text-red-700'
              }`}>
                {data.verified 
                  ? 'This audit pack has not been tampered with since creation.'
                  : 'This audit pack could not be verified. It may have been modified.'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Job Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Job Details</h2>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">{data.jobTitle}</p>
                <p className="text-sm text-gray-600">{data.clientName}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-gray-900">{data.address}</p>
                <p className="text-sm text-gray-600">{data.postcode}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-gray-900">Pack Generated</p>
                <p className="text-sm text-gray-600">{formatDate(data.generatedAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Evidence Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Evidence Summary</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <Camera className="w-6 h-6 text-gray-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{data.evidenceCount}</p>
              <p className="text-sm text-gray-600">Total Photos</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <MapPin className="w-6 h-6 text-gray-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {data.gpsVerified ? 'Yes' : 'Partial'}
              </p>
              <p className="text-sm text-gray-600">GPS Verified</p>
            </div>
          </div>

          {/* Photo Stage Breakdown */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Photo Stages</p>
            <div className="flex gap-2 flex-wrap">
              {data.evidenceSummary.beforeCount > 0 && (
                <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
                  {data.evidenceSummary.beforeCount} Before
                </span>
              )}
              {data.evidenceSummary.duringCount > 0 && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                  {data.evidenceSummary.duringCount} During
                </span>
              )}
              {data.evidenceSummary.afterCount > 0 && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                  {data.evidenceSummary.afterCount} After
                </span>
              )}
              {data.evidenceSummary.customCount > 0 && (
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                  {data.evidenceSummary.customCount} Custom
                </span>
              )}
            </div>
          </div>

          {/* GPS Location */}
          {data.gpsSummary && (
            <div className="border-t border-gray-100 pt-4 mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">GPS Location</p>
              <p className="text-sm text-gray-600">
                All photos captured within {data.gpsSummary.radius}m of coordinates:
              </p>
              <p className="text-xs font-mono text-gray-500 mt-1">
                {data.gpsSummary.latitude.toFixed(6)}, {data.gpsSummary.longitude.toFixed(6)}
              </p>
            </div>
          )}
        </div>

        {/* Cryptographic Hash */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Hash className="w-5 h-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Cryptographic Verification</h2>
          </div>
          
          <div className={`p-4 rounded-lg ${
            data.hashValid ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {data.hashValid ? (
                <ShieldCheck className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <span className={`font-medium ${
                data.hashValid ? 'text-green-700' : 'text-red-700'
              }`}>
                {data.hashValid ? 'Hash Valid' : 'Hash Mismatch'}
              </span>
            </div>
            <p className="text-xs font-mono text-gray-600 break-all">
              SHA-256: {data.packHash}
            </p>
          </div>

          <p className="text-sm text-gray-500 mt-4">
            This hash is computed from all evidence photos, timestamps, and GPS coordinates. 
            Any modification to the original data would produce a different hash.
          </p>
        </div>

        {/* Verification Timestamp */}
        <div className="text-center text-sm text-gray-500">
          <Clock className="w-4 h-4 inline-block mr-1" />
          Verified on {new Date().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 mb-2">
            Powered by WorkProof - Tamper-proof evidence for UK electricians
          </p>
          <a
            href="https://workproof.co.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 text-sm font-medium"
          >
            Learn more about WorkProof
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </main>
    </div>
  )
}
