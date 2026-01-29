/**
 * WorkProof Photo Capture Component
 * Captures photos with GPS, timestamp, hash, and photo stage for immutable evidence
 */
import { useState, useEffect, useCallback } from 'react'
import { Camera, X, RotateCcw, Check, MapPin, Clock, AlertCircle } from 'lucide-react'
import { useCamera } from '../../hooks/useCamera'
import { useGeolocation } from '../../hooks/useGeolocation'
import { compressImage, generateThumbnail, blobToBase64 } from '../../utils/compression'
import { generateEvidenceHash, generateId } from '../../utils/crypto'
import { saveEvidence, isStorageNearLimit } from '../../utils/indexedDB'
import { captureError } from '../../utils/errorTracking'
import { trackEvidenceCaptured } from '../../utils/analytics'
import type { EvidenceType, PhotoStage } from '../../types/models'
import { PHOTO_STAGE_LABELS, PHOTO_STAGE_COLORS } from '../../types/models'
import type { StoredEvidence } from '../../utils/indexedDB'

interface PhotoCaptureProps {
  taskId: string
  jobId: string
  evidenceType: EvidenceType
  photoStage?: PhotoStage
  workerId: string
  onCapture: (evidence: StoredEvidence) => void
  onCancel: () => void
  label: string
}

export default function PhotoCapture({
  taskId,
  jobId,
  evidenceType,
  photoStage,
  workerId,
  onCapture,
  onCancel,
  label,
}: PhotoCaptureProps) {
  const {
    videoRef,
    canvasRef,
    isReady,
    isCapturing,
    error: cameraError,
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
  } = useCamera({ facingMode: 'environment', resolution: 'medium' })

  const {
    location,
    error: geoError,
    isLoading: geoLoading,
    getLocation,
  } = useGeolocation()

  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [storageWarning, setStorageWarning] = useState(false)

  // Start camera and get location on mount
  useEffect(() => {
    startCamera()
    getLocation()
    checkStorage()

    return () => {
      stopCamera()
    }
  }, [])

  const checkStorage = async () => {
    const nearLimit = await isStorageNearLimit()
    setStorageWarning(nearLimit)
  }

  const handleCapture = useCallback(async () => {
    const blob = await capturePhoto()
    if (!blob) return

    try {
      // Compress immediately
      const compressed = await compressImage(blob)
      setCapturedBlob(compressed.blob)

      // Generate thumbnail for preview
      const thumb = await generateThumbnail(compressed.blob)
      setThumbnail(thumb)

      // Refresh location
      await getLocation()
    } catch (err) {
      captureError(err, 'PhotoCapture.handleCapture')
      setSaveError('Failed to process photo')
    }
  }, [capturePhoto, getLocation])

  const handleRetake = useCallback(() => {
    setCapturedBlob(null)
    setThumbnail(null)
    setSaveError(null)
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!capturedBlob) return

    setIsSaving(true)
    setSaveError(null)

    try {
      const capturedAt = new Date().toISOString()

      // Generate immutable hash
      const hash = await generateEvidenceHash(capturedBlob, capturedAt, workerId)

      // Convert blob to base64 for storage
      const photoData = await blobToBase64(capturedBlob)
      const thumbnailData = thumbnail || ''

      const evidence: StoredEvidence = {
        id: generateId(),
        taskId,
        jobId,
        evidenceType,
        photoStage: photoStage || null,  // NEW: Include photo stage
        photoData,
        thumbnailData,
        hash,
        capturedAt,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        accuracy: location?.accuracy ?? null,
        workerId,
        synced: false,
        syncedAt: null,
        createdAt: capturedAt,
      }

      // Save to IndexedDB
      await saveEvidence(evidence)

      // Track analytics
      trackEvidenceCaptured(evidenceType, location !== null)

      // Trigger sync if online
      if (navigator.onLine) {
        window.dispatchEvent(new CustomEvent('workproof:sync'))
      }

      onCapture(evidence)
    } catch (err) {
      captureError(err, 'PhotoCapture.handleConfirm')
      setSaveError('Failed to save photo. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }, [capturedBlob, thumbnail, taskId, jobId, evidenceType, photoStage, workerId, location, onCapture])

  // Error state
  if (cameraError) {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Camera Error</h2>
          <p className="text-gray-600 mb-4">{cameraError}</p>
          <button
            onClick={onCancel}
            className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900/80 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
        <button
          onClick={onCancel}
          className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          aria-label="Cancel"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="text-center">
          <span className="text-white font-medium text-sm truncate max-w-[200px] block">
            {label}
          </span>
          {/* Photo Stage Badge */}
          {photoStage && (
            <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${PHOTO_STAGE_COLORS[photoStage]}`}>
              {PHOTO_STAGE_LABELS[photoStage]} Photo
            </span>
          )}
        </div>
        <button
          onClick={switchCamera}
          className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          aria-label="Switch camera"
        >
          <RotateCcw className="w-6 h-6" />
        </button>
      </div>

      {/* Camera / Preview */}
      <div className="flex-1 relative overflow-hidden">
        {!capturedBlob ? (
          <>
            {/* Live camera */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Camera overlay */}
            {!isReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <div className="text-white text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
                  <p>Starting camera...</p>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Captured preview */
          <img
            src={thumbnail || ''}
            alt="Captured photo"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* GPS Status */}
      <div className="bg-gray-900/80 backdrop-blur-sm px-4 py-2">
        <div className="flex items-center justify-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <MapPin className={`w-4 h-4 ${location ? 'text-green-400' : 'text-gray-400'}`} />
            <span className={location ? 'text-green-400' : 'text-gray-400'}>
              {geoLoading ? 'Getting location...' : location ? 'GPS locked' : geoError || 'No GPS'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <Clock className="w-4 h-4" />
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Storage warning */}
      {storageWarning && (
        <div className="bg-amber-500 text-white px-4 py-2 text-sm text-center">
          Storage nearly full. Please sync your photos.
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="bg-red-500 text-white px-4 py-2 text-sm text-center">
          {saveError}
        </div>
      )}

      {/* Controls */}
      <div className="bg-gray-900 px-4 py-6 safe-area-bottom">
        {!capturedBlob ? (
          /* Capture button */
          <button
            onClick={handleCapture}
            disabled={!isReady || isCapturing}
            className="mx-auto block w-20 h-20 rounded-full border-4 border-white bg-white/20 
              hover:bg-white/30 active:scale-95 transition-all disabled:opacity-50"
            aria-label="Take photo"
          >
            <Camera className="w-8 h-8 text-white mx-auto" />
          </button>
        ) : (
          /* Confirm/Retake buttons */
          <div className="flex justify-center gap-8">
            <button
              onClick={handleRetake}
              disabled={isSaving}
              className="flex flex-col items-center gap-1 text-white disabled:opacity-50"
            >
              <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center">
                <X className="w-6 h-6" />
              </div>
              <span className="text-xs">Retake</span>
            </button>

            <button
              onClick={handleConfirm}
              disabled={isSaving}
              className="flex flex-col items-center gap-1 text-white disabled:opacity-50"
            >
              <div className="w-14 h-14 rounded-full bg-green-600 flex items-center justify-center">
                {isSaving ? (
                  <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Check className="w-6 h-6" />
                )}
              </div>
              <span className="text-xs">{isSaving ? 'Saving...' : 'Confirm'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
