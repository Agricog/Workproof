/**
 * WorkProof Photo Capture Component
 * Captures photos with GPS, timestamp, and hash for immutable evidence
 */

import { useState, useEffect, useCallback } from 'react'
import { Camera, X, RotateCcw, Check, MapPin, Clock, AlertCircle } from 'lucide-react'
import { useCamera } from '../../hooks/useCamera'
import { useGeolocation, formatCoordinates } from '../../hooks/useGeolocation'
import { compressImage, generateThumbnail } from '../../utils/compression'
import { generateEvidenceHash, getDeviceId, generateId } from '../../utils/crypto'
import { saveEvidence, isStorageNearLimit } from '../../utils/indexedDB'
import { captureError } from '../../utils/errorTracking'
import type { EvidenceType } from '../../types/models'
import type { OfflineEvidenceItem } from '../../types/api'

interface PhotoCaptureProps {
  taskId: string
  evidenceType: EvidenceType
  workerId: string
  onCapture: (evidence: OfflineEvidenceItem) => void
  onCancel: () => void
  label: string
}

export default function PhotoCapture({
  taskId,
  evidenceType,
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
      setCapturedBlob(compressed)

      // Generate thumbnail for preview
      const thumb = await generateThumbnail(compressed)
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
      const deviceId = getDeviceId()

      // Generate immutable hash
      const hash = await generateEvidenceHash(capturedBlob, capturedAt, workerId)

      const evidence: OfflineEvidenceItem = {
        id: generateId(),
        taskId,
        evidenceType,
        photoBlob: capturedBlob,
        photoBytesHash: hash,
        capturedAt,
        capturedLat: location?.latitude ?? null,
        capturedLng: location?.longitude ?? null,
        workerId,
        deviceId,
        syncStatus: 'pending',
        retryCount: 0,
        createdAt: capturedAt,
      }

      // Save to IndexedDB
      await saveEvidence(evidence)

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
  }, [capturedBlob, taskId, evidenceType, workerId, location, onCapture])

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
        <span className="text-white font-medium text-sm truncate max-w-[200px]">
          {label}
        </span>
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
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />
            <canvas ref={canvasRef} className="hidden" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            {thumbnail && (
              <img
                src={thumbnail}
                alt="Captured photo"
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
        )}

        {/* Storage Warning */}
        {storageWarning && (
          <div className="absolute top-4 left-4 right-4 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Storage nearly full. Sync pending photos soon.</span>
          </div>
        )}
      </div>

      {/* Metadata Display */}
      <div className="bg-gray-900/80 backdrop-blur-sm px-4 py-2">
        <div className="flex items-center gap-4 text-xs text-gray-300">
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {geoLoading ? (
              <span>Getting location...</span>
            ) : geoError ? (
              <span className="text-amber-400">Location unavailable</span>
            ) : location ? (
              <span>{formatCoordinates(location.latitude, location.longitude)}</span>
            ) : (
              <span>No location</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{new Date().toLocaleTimeString('en-GB')}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-900 px-4 py-6 safe-area-bottom">
        {saveError && (
          <div className="mb-4 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm text-center">
            {saveError}
          </div>
        )}

        {!capturedBlob ? (
          <div className="flex justify-center">
            <button
              onClick={handleCapture}
              disabled={!isReady || isCapturing}
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform"
              aria-label="Take photo"
            >
              <Camera className="w-8 h-8 text-gray-900" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-8">
            <button
              onClick={handleRetake}
              disabled={isSaving}
              className="flex flex-col items-center gap-1 text-white disabled:opacity-50"
            >
              <div className="w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center">
                <RotateCcw className="w-6 h-6" />
              </div>
              <span className="text-xs">Retake</span>
            </button>

            <button
              onClick={handleConfirm}
              disabled={isSaving}
              className="flex flex-col items-center gap-1 text-white disabled:opacity-50"
            >
              <div className="w-14 h-14 bg-green-600 rounded-full flex items-center justify-center">
                {isSaving ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
