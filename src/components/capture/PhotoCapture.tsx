/**
 * WorkProof Photo Capture Component
 * Captures photos with GPS, timestamp, hash, photo stage, and notes for immutable evidence
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { Camera, X, RotateCcw, Check, MapPin, Clock, AlertCircle, FileText, Zap, Mic, Square, Loader2 } from 'lucide-react'
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

// Evidence types that should show test result inputs
const TEST_EVIDENCE_TYPES = [
  'test_meter_readings',
  'sample_circuit_tests',
  'test_result',
  'battery_test_readings',
  'test_confirmation'
]

interface TestResults {
  voltage: string
  resistance: string
  rcdTripTime: string
  continuity: string
  polarity: 'pass' | 'fail' | null
}

interface PhotoCaptureProps {
  taskId: string
  jobId: string
  evidenceType: EvidenceType
  photoStage?: PhotoStage
  customName?: string
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
  customName,
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
    isLoading: geoLoading,
    getLocation,
  } = useGeolocation()

  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [storageWarning, setStorageWarning] = useState(false)
  
  // Test results state
  const [testResults, setTestResults] = useState<TestResults>({
    voltage: '',
    resistance: '',
    rcdTripTime: '',
    continuity: '',
    polarity: null
  })
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioTranscript, setAudioTranscript] = useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Check if this evidence type needs test results
  const showTestResults = TEST_EVIDENCE_TYPES.includes(evidenceType)

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
    setNotes('')
    setSaveError(null)
    setTestResults({
      voltage: '',
      resistance: '',
      rcdTripTime: '',
      continuity: '',
      polarity: null
    })
    setAudioBlob(null)
    setAudioTranscript(null)
    setRecordingTime(0)
  }, [])

  // Voice recording functions
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(audioBlob)
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
        
        // Clear timer
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = null
        }
        
        // Auto-transcribe
        await transcribeAudio(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 30) {
            // Auto-stop at 30 seconds
            stopRecording()
            return prev
          }
          return prev + 1
        })
      }, 1000)
      
    } catch (error) {
      console.error('Failed to start recording:', error)
      setSaveError('Microphone access denied')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [])

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true)
    try {
      // Convert blob to base64
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = reader.result as string
          resolve(base64.split(',')[1]) // Remove data URL prefix
        }
      })
      reader.readAsDataURL(blob)
      const audioBase64 = await base64Promise

      // Send to backend for transcription
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: audioBase64 })
      })

      if (response.ok) {
        const { transcript } = await response.json()
        setAudioTranscript(transcript)
        // Append to notes if transcript exists
        if (transcript) {
          setNotes(prev => prev ? `${prev}\n\n🎤 ${transcript}` : `🎤 ${transcript}`)
        }
      } else {
        console.error('Transcription failed')
        setAudioTranscript('[Transcription failed - audio saved]')
      }
    } catch (error) {
      console.error('Transcription error:', error)
      setAudioTranscript('[Transcription failed - audio saved]')
    } finally {
      setIsTranscribing(false)
    }
  }

  const deleteRecording = useCallback(() => {
    setAudioBlob(null)
    setAudioTranscript(null)
    setRecordingTime(0)
    // Remove voice note from notes if present
    setNotes(prev => prev.replace(/\n\n🎤 .*$/s, '').replace(/^🎤 .*$/s, ''))
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

      // For custom evidence, prepend the custom name to notes
      let finalNotes = notes.trim() || null
      if (customName) {
        finalNotes = customName + (finalNotes ? `: ${finalNotes}` : '')
      }

      // For custom evidence, use 'additional_evidence' as the type
      const finalEvidenceType = customName ? 'additional_evidence' : evidenceType

      const evidence: StoredEvidence = {
        id: generateId(),
        taskId,
        jobId,
        evidenceType: finalEvidenceType as EvidenceType,
        photoStage: photoStage || null,
        notes: finalNotes,
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
        // Test results (null if not applicable)
        testVoltage: testResults.voltage ? parseFloat(testResults.voltage) : null,
        testResistance: testResults.resistance ? parseFloat(testResults.resistance) : null,
        testRcdTripTime: testResults.rcdTripTime ? parseFloat(testResults.rcdTripTime) : null,
        testContinuity: testResults.continuity ? parseFloat(testResults.continuity) : null,
        testPolarity: testResults.polarity,
        // Voice note (base64 audio data)
        audioData: audioBlob ? await blobToBase64(audioBlob) : null,
        audioTranscript: audioTranscript,
      }

      // Save to IndexedDB
      await saveEvidence(evidence)

      // Track analytics
      trackEvidenceCaptured(finalEvidenceType, location !== null)

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
  }, [capturedBlob, thumbnail, notes, taskId, jobId, evidenceType, photoStage, customName, workerId, location, testResults, audioBlob, audioTranscript, onCapture])

  // Display label - use customName if provided
  const displayLabel = customName || label

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
            {displayLabel}
          </span>
          {/* Photo Stage Badge */}
          {photoStage && (
            <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${PHOTO_STAGE_COLORS[photoStage]}`}>
              {PHOTO_STAGE_LABELS[photoStage]} Photo
            </span>
          )}
          {/* Custom Evidence Badge */}
          {customName && (
            <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block bg-purple-100 text-purple-700 ml-1">
              Custom
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
      <div className={`px-4 py-2 ${!location && !geoLoading ? 'bg-amber-900/90' : 'bg-gray-900/80'} backdrop-blur-sm`}>
        <div className="flex items-center justify-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <MapPin className={`w-4 h-4 ${location ? 'text-green-400' : geoLoading ? 'text-gray-400' : 'text-amber-400'}`} />
            <span className={location ? 'text-green-400' : geoLoading ? 'text-gray-400' : 'text-amber-300'}>
              {geoLoading ? 'Getting location...' : location ? `GPS locked (±${Math.round(location.accuracy || 0)}m)` : 'GPS unavailable'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <Clock className="w-4 h-4" />
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
        {!location && !geoLoading && (
          <p className="text-amber-200 text-xs text-center mt-1">
            Photo will still be saved with timestamp
          </p>
        )}
      </div>

      {/* Notes Input - shown after photo capture */}
      {capturedBlob && (
        <div className="bg-gray-800 px-4 py-3">
          <div className="flex items-start gap-2">
            <FileText className="w-5 h-5 text-gray-400 mt-2 flex-shrink-0" />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes (optional) - e.g. 'Main DB before replacement'"
              maxLength={500}
              rows={2}
              className="flex-1 bg-gray-700 text-white placeholder-gray-400 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <p className="text-gray-500 text-xs text-right mt-1">{notes.length}/500</p>
        </div>
      )}

      {/* Voice Note - shown after photo capture */}
      {capturedBlob && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-purple-400" />
              <span className="text-white font-medium text-sm">Voice Note</span>
              <span className="text-gray-500 text-xs">(max 30s)</span>
            </div>
            
            {!audioBlob && !isRecording && (
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
              >
                <Mic className="w-4 h-4" />
                Record
              </button>
            )}
            
            {isRecording && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-400 text-sm font-mono">{recordingTime}s</span>
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              </div>
            )}
            
            {audioBlob && !isRecording && (
              <div className="flex items-center gap-2">
                {isTranscribing ? (
                  <div className="flex items-center gap-2 text-purple-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Transcribing...
                  </div>
                ) : (
                  <>
                    <span className="text-green-400 text-sm">✓ Recorded</span>
                    <button
                      type="button"
                      onClick={deleteRecording}
                      className="text-gray-400 hover:text-red-400 text-sm"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          
          {audioTranscript && (
            <div className="mt-2 p-2 bg-gray-700 rounded-lg">
              <p className="text-gray-300 text-sm italic">"{audioTranscript}"</p>
            </div>
          )}
        </div>
      )}

      {/* Test Results Input - shown for test evidence types */}
      {capturedBlob && showTestResults && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-amber-400" />
            <span className="text-white font-medium text-sm">Test Results (optional)</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs block mb-1">Voltage (V)</label>
              <input
                type="number"
                step="0.1"
                value={testResults.voltage}
                onChange={(e) => setTestResults(prev => ({ ...prev, voltage: e.target.value }))}
                placeholder="230.5"
                className="w-full bg-gray-700 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            
            <div>
              <label className="text-gray-400 text-xs block mb-1">Resistance (Ω)</label>
              <input
                type="number"
                step="0.01"
                value={testResults.resistance}
                onChange={(e) => setTestResults(prev => ({ ...prev, resistance: e.target.value }))}
                placeholder="0.45"
                className="w-full bg-gray-700 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            
            <div>
              <label className="text-gray-400 text-xs block mb-1">RCD Trip (ms)</label>
              <input
                type="number"
                step="1"
                value={testResults.rcdTripTime}
                onChange={(e) => setTestResults(prev => ({ ...prev, rcdTripTime: e.target.value }))}
                placeholder="28"
                className="w-full bg-gray-700 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            
            <div>
              <label className="text-gray-400 text-xs block mb-1">Continuity (Ω)</label>
              <input
                type="number"
                step="0.01"
                value={testResults.continuity}
                onChange={(e) => setTestResults(prev => ({ ...prev, continuity: e.target.value }))}
                placeholder="0.12"
                className="w-full bg-gray-700 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          
          <div className="mt-3">
            <label className="text-gray-400 text-xs block mb-2">Polarity</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTestResults(prev => ({ ...prev, polarity: 'pass' }))}
                className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                  testResults.polarity === 'pass'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                ✓ Pass
              </button>
              <button
                type="button"
                onClick={() => setTestResults(prev => ({ ...prev, polarity: 'fail' }))}
                className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                  testResults.polarity === 'fail'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                ✗ Fail
              </button>
            </div>
          </div>
        </div>
      )}

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
