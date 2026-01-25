/**
 * WorkProof Image Compression
 * Compress photos to 300KB for iOS PWA storage limits
 */

import type { CompressionOptions } from '../types/api'

export const DEFAULT_COMPRESSION: CompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.7,
  format: 'image/jpeg',
}

// Target size: 300KB
const TARGET_SIZE_BYTES = 300 * 1024

// ============================================================================
// MAIN COMPRESSION FUNCTION
// ============================================================================

export async function compressImage(
  file: File | Blob,
  options: Partial<CompressionOptions> = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_COMPRESSION, ...options }

  // Create image from file
  const imageBitmap = await createImageBitmap(file)

  // Calculate new dimensions
  const { width, height } = calculateDimensions(
    imageBitmap.width,
    imageBitmap.height,
    opts.maxWidth,
    opts.maxHeight
  )

  // Create canvas
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  // Draw image
  ctx.drawImage(imageBitmap, 0, 0, width, height)

  // Initial compression
  let blob = await canvas.convertToBlob({
    type: opts.format,
    quality: opts.quality,
  })

  // If still too large, reduce quality iteratively
  let quality = opts.quality
  while (blob.size > TARGET_SIZE_BYTES && quality > 0.3) {
    quality -= 0.1
    blob = await canvas.convertToBlob({
      type: opts.format,
      quality,
    })
  }

  // If still too large, reduce dimensions
  if (blob.size > TARGET_SIZE_BYTES) {
    return compressImage(file, {
      ...opts,
      maxWidth: Math.round(opts.maxWidth * 0.8),
      maxHeight: Math.round(opts.maxHeight * 0.8),
    })
  }

  return blob
}

// ============================================================================
// DIMENSION CALCULATION
// ============================================================================

function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth
  let height = originalHeight

  // Scale down if exceeds max dimensions
  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width)
    width = maxWidth
  }

  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height)
    height = maxHeight
  }

  return { width, height }
}

// ============================================================================
// THUMBNAIL GENERATION
// ============================================================================

export async function generateThumbnail(
  file: File | Blob,
  maxSize: number = 200
): Promise<string> {
  const imageBitmap = await createImageBitmap(file)

  const { width, height } = calculateDimensions(
    imageBitmap.width,
    imageBitmap.height,
    maxSize,
    maxSize
  )

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  ctx.drawImage(imageBitmap, 0, 0, width, height)

  const blob = await canvas.convertToBlob({
    type: 'image/jpeg',
    quality: 0.6,
  })

  return blobToDataUrl(blob)
}

// ============================================================================
// HELPERS
// ============================================================================

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }

  return new Blob([u8arr], { type: mime })
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
