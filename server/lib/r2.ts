/**
 * Cloudflare R2 Client
 * S3-compatible signed URL generation for secure file uploads
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// R2 Configuration from environment
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || ''
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || ''
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || ''
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'workproof-evidence'
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''

// Validate configuration
export function validateR2Config(): { valid: boolean; missing: string[] } {
  const missing: string[] = []
  
  if (!R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID')
  if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID')
  if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY')
  if (!R2_BUCKET_NAME) missing.push('R2_BUCKET_NAME')
  if (!R2_PUBLIC_URL) missing.push('R2_PUBLIC_URL')
  
  return {
    valid: missing.length === 0,
    missing
  }
}

// Create S3 client configured for R2
function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY
    }
  })
}

/**
 * Generate a signed URL for uploading a file to R2
 * @param key - The object key (path) in the bucket
 * @param contentType - The MIME type of the file
 * @param expiresIn - URL expiration time in seconds (default: 5 minutes)
 */
export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 300
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const client = getR2Client()
  
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType
  })
  
  const uploadUrl = await getSignedUrl(client, command, { expiresIn })
  const publicUrl = `${R2_PUBLIC_URL}/${key}`
  
  return {
    uploadUrl,
    publicUrl,
    key
  }
}

/**
 * Generate a signed URL for downloading a file from R2
 * @param key - The object key (path) in the bucket
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getR2Client()
  
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key
  })
  
  return await getSignedUrl(client, command, { expiresIn })
}

/**
 * Delete a file from R2
 * @param key - The object key (path) in the bucket
 */
export async function deleteObject(key: string): Promise<void> {
  const client = getR2Client()
  
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key
  })
  
  await client.send(command)
}

/**
 * Generate a unique key for evidence files
 * Format: evidence/{userId}/{jobId}/{taskId}/{timestamp}-{hash}.jpg
 */
export function generateEvidenceKey(
  userId: string,
  jobId: string,
  taskId: string,
  filename: string
): string {
  const timestamp = Date.now()
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `evidence/${userId}/${jobId}/${taskId}/${timestamp}-${sanitizedFilename}`
}

/**
 * Extract the key from a public URL
 */
export function extractKeyFromUrl(url: string): string | null {
  if (!url.startsWith(R2_PUBLIC_URL)) return null
  return url.replace(`${R2_PUBLIC_URL}/`, '')
}
