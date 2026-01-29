/**
 * WorkProof Camera Hook
 * Access device camera for evidence capture
 */
import { useState, useRef, useCallback, useEffect } from 'react'

interface UseCameraOptions {
  facingMode?: 'user' | 'environment'
  resolution?: 'low' | 'medium' | 'high'
}

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
  isReady: boolean
  isCapturing: boolean
  error: string | null
  startCamera: () => Promise<void>
  stopCamera: () => void
  capturePhoto: () => Promise<Blob | null>
  switchCamera: () => Promise<void>
}

const RESOLUTIONS = {
  low: { width: 1280, height: 720 },
  medium: { width: 1920, height: 1080 },
  high: { width: 2560, height: 1440 },
}

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const { facingMode = 'environment', resolution = 'medium' } = options

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [isReady, setIsReady] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentFacingMode, setCurrentFacingMode] = useState(facingMode)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsReady(false)
  }, [])

  const startCamera = useCallback(async () => {
    setError(null)

    // Check for camera support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera not supported on this device')
      return
    }

    // Stop existing stream
    stopCamera()

    const res = RESOLUTIONS[resolution]

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: currentFacingMode,
          width: { ideal: res.width },
          height: { ideal: res.height },
        },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsReady(true)
      }
    } catch (err) {
      const error = err as Error
      if (error.name === 'NotAllowedError') {
        setError('Camera permission denied. Please enable in settings.')
      } else if (error.name === 'NotFoundError') {
        setError('No camera found on this device.')
      } else if (error.name === 'NotReadableError') {
        setError('Camera is in use by another application.')
      } else {
        setError('Failed to access camera.')
      }
      console.error('Camera error:', error)
    }
  }, [currentFacingMode, resolution, stopCamera])

  const switchCamera = useCallback(async () => {
    const newMode = currentFacingMode === 'environment' ? 'user' : 'environment'
    setCurrentFacingMode(newMode)
    
    // Restart with new facing mode
    stopCamera()
    
    // Small delay to allow cleanup
    await new Promise((resolve) => setTimeout(resolve, 100))
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newMode,
          width: { ideal: RESOLUTIONS[resolution].width },
          height: { ideal: RESOLUTIONS[resolution].height },
        },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsReady(true)
      }
    } catch (err) {
      setError('Failed to switch camera')
      console.error('Switch camera error:', err)
    }
  }, [currentFacingMode, resolution, stopCamera])

  const capturePhoto = useCallback(async (): Promise<Blob | null> => {
    if (!videoRef.current || !canvasRef.current || !isReady) {
      return null
    }

    setIsCapturing(true)

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        throw new Error('Failed to get canvas context')
      }

      // Set canvas size to video size
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0)

      // Convert to blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(
          (blob) => resolve(blob),
          'image/jpeg',
          0.9
        )
      })

      return blob
    } catch (err) {
      console.error('Capture error:', err)
      setError('Failed to capture photo')
      return null
    } finally {
      setIsCapturing(false)
    }
  }, [isReady])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  return {
    videoRef,
    canvasRef,
    isReady,
    isCapturing,
    error,
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
  }
}
