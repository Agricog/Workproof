/**
 * WorkProof Image Compression
 * Optimized for iOS PWA 50MB limit
 */

const TARGET_SIZE_KB = 300
const MAX_DIMENSION = 2048
const QUALITY_STEPS = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]

export interface CompressionResult {
  blob: Blob
  width: number
  height: number
  originalSize: number
  compressedSize: number
  compressionRatio: number
}

/**
 * Compress image to target size
 */
export async function compressImage(
  file: File | Blob,
  targetSizeKB: number = TARGET_SIZE_KB
): Promise<CompressionResult> {
  const originalSize = file.size
  const targetSize = targetSizeKB * 1024

  // If already small enough, return as-is
  if (originalSize <= targetSize) {
    const dimensions = await getImageDimensions(file)
    return {
      blob: file instanceof File ? file : new Blob([file], { type: file.type }),
      width: dimensions.width,
      height: dimensions.height,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
    }
  }

  // Load image
  const img = await loadImage(file)
  const { width, height } = calculateDimensions(img.width, img.height, MAX_DIMENSION)

  // Create canvas
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  // Draw resized image
  ctx.drawImage(img, 0, 0, width, height)

  // Try different quality levels to hit target size
  let blob: Blob | null = null
  for (const quality of QUALITY_STEPS) {
    blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    if (blob.size <= targetSize) {
      break
    }
  }

  if (!blob) {
    throw new Error('Failed to compress image')
  }

  return {
    blob,
    width,
    height,
    originalSize,
    compressedSize: blob.size,
    compressionRatio: originalSize / blob.size,
  }
}

/**
 * Load image from file/blob
 */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load image'))
    }
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Get image dimensions without fully loading
 */
function getImageDimensions(file: File | Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      resolve({ width: img.width, height: img.height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to get image dimensions'))
    }
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Calculate new dimensions maintaining aspect ratio
 */
function calculateDimensions(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height }
  }

  const ratio = Math.min(maxDimension / width, maxDimension / height)
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  }
}

/**
 * Convert canvas to blob
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to create blob'))
        }
      },
      type,
      quality
    )
  })
}

/**
 * Convert blob to base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result
      if (typeof result === 'string') {
        resolve(result)
      } else {
        reject(new Error('Failed to convert to base64'))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Convert base64 to blob
 */
export function base64ToBlob(base64: string, type: string = 'image/jpeg'): Blob {
  const parts = base64.split(',')
  const byteString = atob(parts[1] || parts[0])
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)

  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }

  return new Blob([ab], { type })
}

/**
 * Get blob as ArrayBuffer
 */
export function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read as ArrayBuffer'))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

/**
 * Estimate storage used by evidence items
 */
export function estimateStorageSize(items: Array<{ thumbnailData?: string; photoData?: string }>): number {
  let totalBytes = 0

  for (const item of items) {
    if (item.thumbnailData) {
      // Base64 is ~33% larger than binary
      totalBytes += Math.ceil((item.thumbnailData.length * 3) / 4)
    }
    if (item.photoData) {
      totalBytes += Math.ceil((item.photoData.length * 3) / 4)
    }
  }

  return totalBytes
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
