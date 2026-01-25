/**
 * WorkProof Cryptographic Utilities
 * SHA-256 hash generation for immutable evidence chain
 */

/**
 * Generate SHA-256 hash from data
 */
export async function generateHash(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buffer = data instanceof Uint8Array ? data.buffer : data
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate evidence hash: SHA256(photo_bytes + captured_at + worker_id)
 * This creates an immutable proof-of-work chain
 */
export async function generateEvidenceHash(
  photoData: ArrayBuffer | Uint8Array,
  capturedAt: string,
  workerId: string
): Promise<string> {
  // Convert photo data to Uint8Array if needed
  const photoBytes = photoData instanceof Uint8Array 
    ? photoData 
    : new Uint8Array(photoData)
  
  // Encode metadata as UTF-8
  const encoder = new TextEncoder()
  const timestampBytes = encoder.encode(capturedAt)
  const workerBytes = encoder.encode(workerId)
  
  // Concatenate all data
  const combined = new Uint8Array(
    photoBytes.length + timestampBytes.length + workerBytes.length
  )
  combined.set(photoBytes, 0)
  combined.set(timestampBytes, photoBytes.length)
  combined.set(workerBytes, photoBytes.length + timestampBytes.length)
  
  return generateHash(combined)
}

/**
 * Verify evidence hash matches the original data
 */
export async function verifyEvidenceHash(
  photoData: ArrayBuffer | Uint8Array,
  capturedAt: string,
  workerId: string,
  expectedHash: string
): Promise<boolean> {
  const computedHash = await generateEvidenceHash(photoData, capturedAt, workerId)
  return computedHash === expectedHash
}

/**
 * Generate a random UUID
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Hash a string (for non-binary data)
 */
export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  return generateHash(data)
}
