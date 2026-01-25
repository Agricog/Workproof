/**
 * WorkProof Crypto Utilities
 * SHA-256 hashing for immutable evidence chain
 * Hash = SHA256(photo_bytes + captured_at + worker_id)
 */

// ============================================================================
// SHA-256 HASHING
// ============================================================================

export async function sha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256String(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  return sha256(data)
}

export async function sha256Blob(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer()
  return sha256(arrayBuffer)
}

// ============================================================================
// EVIDENCE HASH GENERATION
// ============================================================================

/**
 * Generate immutable evidence hash
 * Components: photo bytes + captured timestamp + worker ID
 * Cannot be backdated, reattributed, or altered
 */
export async function generateEvidenceHash(
  photoBlob: Blob,
  capturedAt: string,
  workerId: string
): Promise<string> {
  const photoHash = await sha256Blob(photoBlob)
  const combinedString = `${photoHash}:${capturedAt}:${workerId}`
  return sha256String(combinedString)
}

/**
 * Verify evidence hash matches original
 */
export async function verifyEvidenceHash(
  photoBlob: Blob,
  capturedAt: string,
  workerId: string,
  expectedHash: string
): Promise<boolean> {
  const computedHash = await generateEvidenceHash(photoBlob, capturedAt, workerId)
  return computedHash === expectedHash
}

// ============================================================================
// DEVICE ID GENERATION
// ============================================================================

const DEVICE_ID_KEY = 'workproof_device_id'

export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)

  if (!deviceId) {
    deviceId = generateDeviceId()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }

  return deviceId
}

function generateDeviceId(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    Math.random().toString(36).substring(2),
    crypto.getRandomValues(new Uint32Array(4)).join('-'),
  ]

  const combined = components.join('|')
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }

  const prefix = 'WP'
  const timestamp = Date.now().toString(36).toUpperCase()
  const hashHex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')

  return `${prefix}-${timestamp}-${hashHex}`
}

// ============================================================================
// HASH VERIFICATION CHAIN
// ============================================================================

export interface HashVerificationResult {
  isValid: boolean
  computedHash: string
  expectedHash: string
  verifiedAt: string
  discrepancy?: 'hash_mismatch' | 'data_corrupted'
}

export async function createVerificationRecord(
  photoBlob: Blob,
  capturedAt: string,
  workerId: string,
  expectedHash: string
): Promise<HashVerificationResult> {
  const computedHash = await generateEvidenceHash(photoBlob, capturedAt, workerId)
  const isValid = computedHash === expectedHash

  return {
    isValid,
    computedHash,
    expectedHash,
    verifiedAt: new Date().toISOString(),
    discrepancy: isValid ? undefined : 'hash_mismatch',
  }
}

// ============================================================================
// TIMESTAMP HANDLING
// ============================================================================

export async function getCaptureTimestamp(): Promise<string> {
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      })
    })
    return new Date(position.timestamp).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function isValidTimestamp(isoString: string): boolean {
  const timestamp = new Date(isoString).getTime()
  const now = Date.now()

  // Reject future timestamps (5 min tolerance)
  if (timestamp > now + 5 * 60 * 1000) {
    return false
  }

  // Reject timestamps > 7 days old
  if (timestamp < now - 7 * 24 * 60 * 60 * 1000) {
    return false
  }

  return true
}

// ============================================================================
// UNIQUE ID GENERATION
// ============================================================================

export function generateId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = crypto.getRandomValues(new Uint32Array(2))
  const random = Array.from(randomPart)
    .map((n) => n.toString(36))
    .join('')
  return `${timestamp}-${random}`.toUpperCase()
}
