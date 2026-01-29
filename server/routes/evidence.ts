import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import { USER_FIELDS, TASK_FIELDS, JOB_FIELDS, EVIDENCE_FIELDS } from '../lib/smartsuite-fields.js'
import { authMiddleware, getAuth } from '../middleware/auth.js'
import { rateLimitMiddleware } from '../middleware/rateLimit.js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Evidence, Task, User } from '../types/index.js'

const evidence = new Hono()

// Apply middleware to all routes
evidence.use('*', rateLimitMiddleware)
evidence.use('*', authMiddleware)

// R2 Configuration
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'workproof-evidence'

// Simple in-memory cache for user record IDs (clerk_id -> smartsuite_id)
const userIdCache = new Map<string, { id: string; timestamp: number }>()
const USER_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// SmartSuite option ID -> label mappings (from SmartSuite field settings)
// Evidence Type options
const EVIDENCE_TYPE_OPTIONS: Record<string, string> = {
  'mVsNo': 'Before Photo',
  'FTVO5': 'After Photo',
  'DcHm5': 'Meter Reading',
  'YR4xA': 'Test Result',
  'Kj7Bp': 'Label Photo',
  'X9vNc': 'Certificate Photo',
  'Qw3Rt': 'Client Signature',
  'Lm8Ky': 'Wiring Photo',
  'Np2Zx': 'Distribution Board',
  'Hf6Vb': 'Earthing Arrangement',
  'Gt4Ws': 'Bonding Connection',
  'Jk9Pd': 'RCD Test Reading',
  'Uy1Oe': 'Insulation Test Reading',
  'Bv5Ia': 'Continuity Reading',
  'Cx7Mu': 'ZS Reading',
}

// Photo Stage options
const PHOTO_STAGE_OPTIONS: Record<string, string> = {
  'DZX3Z': 'Before',
  'U6zl3': 'After',
  'Mw4Rd': 'During',
}

// Map frontend evidence types to SmartSuite dropdown labels (for writing)
const EVIDENCE_TYPE_MAP: Record<string, string> = {
  'before_photo': 'Before Photo',
  'after_photo': 'After Photo',
  'meter_reading': 'Meter Reading',
  'test_meter_readings': 'Meter Reading',
  'test_result': 'Test Result',
  'label_photo': 'Label Photo',
  'label_applied': 'Label Photo',
  'certificate_photo': 'Certificate Photo',
  'client_signature': 'Client Signature',
  'wiring_photo': 'Wiring Photo',
  'distribution_board': 'Distribution Board',
  'earthing_arrangement': 'Earthing Arrangement',
  'bonding_connection': 'Bonding Connection',
  'rcd_test_reading': 'RCD Test Reading',
  'insulation_test_reading': 'Insulation Test Reading',
  'continuity_reading': 'Continuity Reading',
  'zs_reading': 'ZS Reading',
  'equipment_photo': 'Before Photo',
  'completed_installation': 'After Photo',
  'initial_fault_indication': 'Before Photo',
  'investigation_photos': 'Before Photo',
  'resolution': 'After Photo',
  'test_confirmation': 'Test Result',
}

// Map frontend photo stages to SmartSuite dropdown labels (for writing)
const PHOTO_STAGE_MAP: Record<string, string> = {
  'before': 'Before',
  'during': 'During',
  'after': 'After',
}

// Initialize S3 client for R2
function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
    }
  })
}

// Helper: Retry wrapper for SmartSuite calls with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      const errorMessage = String(error)
      
      // If it's a 429, use longer delays
      const is429 = errorMessage.includes('429')
      const delay = is429 ? baseDelayMs * Math.pow(2, i) : baseDelayMs * (i + 1)
      
      console.error(`[EVIDENCE] Retry ${i + 1}/${retries + 1} failed (waiting ${delay}ms):`, errorMessage.slice(0, 100))
      
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

// Helper: Get user record ID from Clerk ID (with caching)
async function getUserRecordId(clerkId: string): Promise<string | null> {
  // Check cache first
  const cached = userIdCache.get(clerkId)
  if (cached && Date.now() - cached.timestamp < USER_CACHE_TTL) {
    return cached.id
  }
  
  const client = getSmartSuiteClient()
  
  try {
    const user = await withRetry(() => 
      client.findByField<User>(TABLES.USERS, USER_FIELDS.clerk_id, clerkId)
    )
    
    if (user?.id) {
      userIdCache.set(clerkId, { id: user.id, timestamp: Date.now() })
      return user.id
    }
    return null
  } catch (error) {
    console.error('[EVIDENCE] Error finding user:', error)
    return null
  }
}

// Helper: Extract task IDs from linked record field
function extractTaskIds(taskValue: unknown): string[] {
  if (!taskValue) return []
  if (Array.isArray(taskValue)) {
    return taskValue.flatMap(item => {
      if (typeof item === 'string') return [item]
      if (typeof item === 'object' && item !== null && 'id' in item) {
        return [(item as { id: string }).id]
      }
      return []
    })
  }
  if (typeof taskValue === 'string') return [taskValue]
  if (typeof taskValue === 'object' && taskValue !== null && 'id' in taskValue) {
    return [(taskValue as { id: string }).id]
  }
  return []
}

// Helper: Verify user owns the task (through job ownership)
async function verifyTaskOwnership(taskId: string, clerkId: string): Promise<boolean> {
  console.log('[EVIDENCE] verifyTaskOwnership called - taskId:', taskId, 'clerkId:', clerkId)
  
  const client = getSmartSuiteClient()
  const userRecordId = await getUserRecordId(clerkId)
  
  if (!userRecordId) {
    console.error('[EVIDENCE] Failed to get user record ID')
    return false
  }

  try {
    // Get task to find job
    const task = await withRetry(() => 
      client.getRecord<Task>(TABLES.TASKS, taskId)
    )
    
    const taskJobIds = task[TASK_FIELDS.job as keyof Task] as string[] | string
    const jobId = Array.isArray(taskJobIds) ? taskJobIds[0] : taskJobIds

    if (!jobId) {
      console.error('[EVIDENCE] Task has no job')
      return false
    }

    // Get job to verify ownership
    const job = await withRetry(async () => {
      const result = await client.getRecord(TABLES.JOBS, jobId)
      return result as unknown as Record<string, unknown>
    })
    
    const jobUserIds = job[JOB_FIELDS.user] as string[] | string | undefined
    if (!jobUserIds) {
      console.error('[EVIDENCE] Job has no user')
      return false
    }
    
    const userIds = Array.isArray(jobUserIds) ? jobUserIds : [jobUserIds]
    const isOwner = userIds.includes(userRecordId)
    
    console.log('[EVIDENCE] Ownership check:', isOwner)
    return isOwner
  } catch (error) {
    console.error('[EVIDENCE] Error verifying ownership:', error)
    return false
  }
}

// Helper: Extract single select value from SmartSuite format (option ID -> label)
function extractSingleSelectValue(field: unknown, optionMap: Record<string, string>): string | null {
  if (!field) return null
  
  // If it's a string, check if it's an option ID we can look up
  if (typeof field === 'string') {
    // Try to look up in option map first
    if (optionMap[field]) {
      return optionMap[field].toLowerCase()
    }
    // Log unknown option IDs so we can add them
    if (/^[a-zA-Z0-9]{5,6}$/.test(field)) {
      console.log('[EVIDENCE] Unknown option ID:', field, '- please add to mapping')
      return null
    }
    // It's already a readable label
    return field.toLowerCase()
  }
  
  // If it's an object with label/value
  if (typeof field === 'object' && field !== null) {
    const obj = field as Record<string, unknown>
    if (obj.label && typeof obj.label === 'string') {
      return obj.label.toLowerCase()
    }
    if (obj.value && typeof obj.value === 'string') {
      // Try to look up value in option map
      if (optionMap[obj.value]) {
        return optionMap[obj.value].toLowerCase()
      }
      if (!/^[a-zA-Z0-9]{5,6}$/.test(obj.value)) {
        return obj.value.toLowerCase()
      }
    }
  }
  
  return null
}

// Helper: Transform evidence record to readable format
function transformEvidence(item: Record<string, unknown>): Record<string, unknown> {
  const taskIds = extractTaskIds(item[EVIDENCE_FIELDS.task])
  const taskId = taskIds.length > 0 ? taskIds[0] : taskIds

  // Handle captured_at date format
  let capturedAt = item[EVIDENCE_FIELDS.captured_at]
  if (capturedAt && typeof capturedAt === 'object' && 'date' in (capturedAt as Record<string, unknown>)) {
    capturedAt = (capturedAt as Record<string, unknown>).date
  }

  // Handle synced_at date format
  let syncedAt = item[EVIDENCE_FIELDS.synced_at]
  if (syncedAt && typeof syncedAt === 'object' && 'date' in (syncedAt as Record<string, unknown>)) {
    syncedAt = (syncedAt as Record<string, unknown>).date
  }

  // Handle isSynced checkbox field
  let isSynced = false
  const isSyncedField = item[EVIDENCE_FIELDS.is_synced]
  if (typeof isSyncedField === 'boolean') {
    isSynced = isSyncedField
  } else if (isSyncedField && typeof isSyncedField === 'object') {
    const obj = isSyncedField as Record<string, unknown>
    isSynced = (obj.completed_items as number) > 0
  }

  return {
    id: item.id,
    taskId: taskId || null,
    evidenceType: extractSingleSelectValue(item[EVIDENCE_FIELDS.evidence_type], EVIDENCE_TYPE_OPTIONS),
    photoStage: extractSingleSelectValue(item[EVIDENCE_FIELDS.photo_stage], PHOTO_STAGE_OPTIONS),
    photoUrl: item[EVIDENCE_FIELDS.photo_url] || null,
    photoHash: item[EVIDENCE_FIELDS.photo_hash] || null,
    latitude: item[EVIDENCE_FIELDS.latitude] || null,
    longitude: item[EVIDENCE_FIELDS.longitude] || null,
    gpsAccuracy: item[EVIDENCE_FIELDS.gps_accuracy] || null,
    capturedAt: capturedAt || null,
    syncedAt: syncedAt || null,
    isSynced: isSynced
  }
}

// Get evidence by task ID
evidence.get('/task/:taskId', async (c) => {
  const auth = getAuth(c)
  const taskId = c.req.param('taskId')
  const client = getSmartSuiteClient()

  console.log('[EVIDENCE] GET /task/:taskId called - taskId:', taskId)

  try {
    const isOwner = await verifyTaskOwnership(taskId, auth.userId)
    if (!isOwner) {
      console.error('[EVIDENCE] Ownership check failed')
      return c.json({ error: 'Forbidden' }, 403)
    }

    const result = await withRetry(() => 
      client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 500 })
    )

    const filteredItems = result.items.filter((item) => {
      const evidenceTaskIds = extractTaskIds(item[EVIDENCE_FIELDS.task as keyof Evidence])
      return evidenceTaskIds.includes(taskId)
    })

    const transformedItems = filteredItems.map(item =>
      transformEvidence(item as unknown as Record<string, unknown>)
    )

    console.log('[EVIDENCE] Returning', transformedItems.length, 'items')
    return c.json({
      items: transformedItems,
      total: transformedItems.length
    })
  } catch (error) {
    console.error('[EVIDENCE] Error listing evidence:', error)
    return c.json({ error: 'Failed to list evidence' }, 500)
  }
})

// List evidence (query param version)
evidence.get('/', async (c) => {
  const auth = getAuth(c)
  const taskId = c.req.query('task_id')
  const client = getSmartSuiteClient()

  console.log('[EVIDENCE] GET / called - task_id:', taskId)

  if (!taskId) {
    return c.json({ error: 'Missing task_id parameter' }, 400)
  }

  try {
    const isOwner = await verifyTaskOwnership(taskId, auth.userId)
    if (!isOwner) {
      console.error('[EVIDENCE] Ownership check failed')
      return c.json({ error: 'Forbidden' }, 403)
    }

    const result = await withRetry(() => 
      client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 500 })
    )

    const filteredItems = result.items.filter((item) => {
      const evidenceTaskIds = extractTaskIds(item[EVIDENCE_FIELDS.task as keyof Evidence])
      return evidenceTaskIds.includes(taskId)
    })

    const transformedItems = filteredItems.map(item =>
      transformEvidence(item as unknown as Record<string, unknown>)
    )

    console.log('[EVIDENCE] Returning', transformedItems.length, 'items')
    return c.json({
      items: transformedItems,
      total: transformedItems.length
    })
  } catch (error) {
    console.error('[EVIDENCE] Error listing evidence:', error)
    return c.json({ error: 'Failed to list evidence' }, 500)
  }
})

// Get evidence counts by job
evidence.get('/counts-by-job', async (c) => {
  const auth = getAuth(c)
  const jobId = c.req.query('job_id')
  const client = getSmartSuiteClient()

  console.log('[EVIDENCE] GET /counts-by-job called - jobId:', jobId)

  if (!jobId) {
    return c.json({ error: 'Missing job_id parameter' }, 400)
  }

  try {
    // Get user record ID for ownership check
    const userRecordId = await getUserRecordId(auth.userId)
    if (!userRecordId) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Verify job ownership
    const job = await withRetry(async () => {
      const result = await client.getRecord(TABLES.JOBS, jobId)
      return result as unknown as Record<string, unknown>
    })
    
    const jobUserIds = job[JOB_FIELDS.user] as string[] | string | undefined
    const userIds = Array.isArray(jobUserIds) ? jobUserIds : [jobUserIds || '']
    
    if (!userIds.includes(userRecordId)) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Get all tasks for this job
    const tasksResult = await withRetry(() => 
      client.listRecords<Task>(TABLES.TASKS, { limit: 200 })
    )
    
    const jobTasks = tasksResult.items.filter(task => {
      const taskJobIds = task[TASK_FIELDS.job as keyof Task] as string[] | string
      const ids = Array.isArray(taskJobIds) ? taskJobIds : [taskJobIds]
      return ids.includes(jobId)
    })

    const taskIds = jobTasks.map(t => t.id)

    // Get all evidence
    const evidenceResult = await withRetry(() => 
      client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 500 })
    )

    // Count evidence per task
    const counts: Record<string, number> = {}
    taskIds.forEach(id => { counts[id] = 0 })

    evidenceResult.items.forEach(item => {
      const record = item as unknown as Record<string, unknown>
      const evidenceTaskIds = extractTaskIds(record[EVIDENCE_FIELDS.task])
      
      evidenceTaskIds.forEach(taskId => {
        if (taskIds.includes(taskId)) {
          counts[taskId] = (counts[taskId] || 0) + 1
        }
      })
    })

    return c.json({ counts })
  } catch (error) {
    console.error('[EVIDENCE] Error getting evidence counts:', error)
    return c.json({ error: 'Failed to get evidence counts' }, 500)
  }
})

// Get single evidence by ID
evidence.get('/:id', async (c) => {
  const auth = getAuth(c)
  const evidenceId = c.req.param('id')
  const client = getSmartSuiteClient()

  console.log('[EVIDENCE] GET /:id called - evidenceId:', evidenceId)

  try {
    const evidenceRecord = await withRetry(() => 
      client.getRecord<Evidence>(TABLES.EVIDENCE, evidenceId)
    )

    const taskIds = extractTaskIds(evidenceRecord[EVIDENCE_FIELDS.task as keyof Evidence])
    const taskId = taskIds[0]

    if (!taskId) {
      return c.json({ error: 'Evidence has no task' }, 400)
    }

    const isOwner = await verifyTaskOwnership(taskId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const transformed = transformEvidence(evidenceRecord as unknown as Record<string, unknown>)
    return c.json(transformed)
  } catch (error) {
    console.error('[EVIDENCE] Error fetching evidence:', error)
    return c.json({ error: 'Failed to fetch evidence' }, 500)
  }
})

// Get signed upload URL for R2
evidence.post('/upload-url', async (c) => {
  const auth = getAuth(c)

  console.log('[EVIDENCE] POST /upload-url called')

  try {
    const body = await c.req.json() as Record<string, unknown>
    const filename = body.filename as string
    const contentType = (body.content_type || body.contentType || 'image/jpeg') as string
    const taskId = (body.task_id || body.taskId) as string | undefined
    const jobId = (body.job_id || body.jobId) as string | undefined

    if (!filename) {
      return c.json({ error: 'Missing filename' }, 400)
    }

    // Generate unique key with better organization
    const timestamp = Date.now()
    const safeTaskId = taskId || 'unknown'
    const safeJobId = jobId || 'unknown'
    const key = `evidence/${auth.userId}/${safeJobId}/${safeTaskId}/${timestamp}-${filename}`

    const r2Client = getR2Client()

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType
    })

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 })

    const publicUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL}/${key}`
      : `https://${R2_BUCKET}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`

    console.log('[EVIDENCE] Generated upload URL for key:', key)

    return c.json({
      upload_url: uploadUrl,
      photo_url: publicUrl,
      key
    })
  } catch (error) {
    console.error('[EVIDENCE] Error generating upload URL:', error)
    return c.json({ error: 'Failed to generate upload URL' }, 500)
  }
})

// Create new evidence record
evidence.post('/', async (c) => {
  const auth = getAuth(c)
  const client = getSmartSuiteClient()

  console.log('[EVIDENCE] POST / called')

  try {
    const body = await c.req.json() as Record<string, unknown>
    
    console.log('[EVIDENCE] Request body:', JSON.stringify(body, null, 2))

    // Support both formats
    const taskId = (body.task_id || body.taskId) as string
    const evidenceTypeRaw = (body.evidence_type || body.evidenceType) as string
    const photoStageRaw = (body.photo_stage || body.photoStage) as string | undefined
    const photoUrl = (body.photo_url || body.photoUrl) as string
    const photoHash = (body.photo_hash || body.photoHash) as string

    // Map to SmartSuite dropdown labels
    const evidenceType = EVIDENCE_TYPE_MAP[evidenceTypeRaw] || evidenceTypeRaw
    const photoStage = photoStageRaw ? (PHOTO_STAGE_MAP[photoStageRaw.toLowerCase()] || photoStageRaw) : undefined

    console.log('[EVIDENCE] Parsed fields:', { taskId, evidenceTypeRaw, evidenceType, photoStageRaw, photoStage, photoUrl: photoUrl?.slice(0, 50) })

    // Validate required fields
    if (!taskId || !evidenceTypeRaw || !photoUrl) {
      return c.json({ error: 'Missing required fields: task_id, evidence_type, photo_url' }, 400)
    }

    // Verify ownership
    const isOwner = await verifyTaskOwnership(taskId, auth.userId)
    if (!isOwner) {
      console.error('[EVIDENCE] Ownership check failed')
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Build evidence data with SmartSuite field IDs
    const evidenceData: Record<string, unknown> = {
      title: `${evidenceTypeRaw} - ${Date.now()}`,
      [EVIDENCE_FIELDS.task]: [taskId],
      [EVIDENCE_FIELDS.evidence_type]: evidenceType,
      [EVIDENCE_FIELDS.photo_url]: photoUrl,
      [EVIDENCE_FIELDS.photo_hash]: photoHash || '',
      [EVIDENCE_FIELDS.captured_at]: (body.captured_at || body.capturedAt) as string || new Date().toISOString(),
      [EVIDENCE_FIELDS.synced_at]: new Date().toISOString(),
      [EVIDENCE_FIELDS.is_synced]: { checked: true }
    }

    // Add photo_stage if provided
    if (photoStage) {
      evidenceData[EVIDENCE_FIELDS.photo_stage] = photoStage
      console.log('[EVIDENCE] Adding photo_stage:', photoStage)
    }

    // Add optional GPS fields
    if (body.latitude !== undefined || body.lat !== undefined) {
      evidenceData[EVIDENCE_FIELDS.latitude] = body.latitude || body.lat
    }
    if (body.longitude !== undefined || body.lng !== undefined || body.lon !== undefined) {
      evidenceData[EVIDENCE_FIELDS.longitude] = body.longitude || body.lng || body.lon
    }
    if (body.gps_accuracy !== undefined || body.gpsAccuracy !== undefined) {
      evidenceData[EVIDENCE_FIELDS.gps_accuracy] = body.gps_accuracy || body.gpsAccuracy
    }

    console.log('[EVIDENCE] Creating record with data:', JSON.stringify(evidenceData, null, 2))

    const newEvidence = await withRetry(() => 
      client.createRecord<Evidence>(TABLES.EVIDENCE, evidenceData as Partial<Evidence>)
    )

    const transformed = transformEvidence(newEvidence as unknown as Record<string, unknown>)
    
    console.log('[EVIDENCE] Created evidence:', transformed.id)

    return c.json(transformed, 201)
  } catch (error) {
    console.error('[EVIDENCE] Error creating evidence:', error)
    return c.json({ error: 'Failed to create evidence' }, 500)
  }
})

// Delete evidence
evidence.delete('/:id', async (c) => {
  const auth = getAuth(c)
  const evidenceId = c.req.param('id')
  const client = getSmartSuiteClient()

  console.log('[EVIDENCE] DELETE /:id called - evidenceId:', evidenceId)

  try {
    const evidenceRecord = await withRetry(() => 
      client.getRecord<Evidence>(TABLES.EVIDENCE, evidenceId)
    )

    const taskIds = extractTaskIds(evidenceRecord[EVIDENCE_FIELDS.task as keyof Evidence])
    const taskId = taskIds[0]

    if (!taskId) {
      return c.json({ error: 'Evidence has no task' }, 400)
    }

    const isOwner = await verifyTaskOwnership(taskId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await withRetry(() => 
      client.deleteRecord(TABLES.EVIDENCE, evidenceId)
    )

    return c.json({ success: true })
  } catch (error) {
    console.error('[EVIDENCE] Error deleting evidence:', error)
    return c.json({ error: 'Failed to delete evidence' }, 500)
  }
})

export default evidence
