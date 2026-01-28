import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import { USER_FIELDS, TASK_FIELDS, EVIDENCE_FIELDS } from '../lib/smartsuite-fields.js'
import { authMiddleware, getAuth } from '../middleware/auth.js'
import { rateLimitMiddleware } from '../middleware/rateLimit.js'
import { getSignedUploadUrl, generateEvidenceKey, validateR2Config, deleteObject, extractKeyFromUrl } from '../lib/r2.js'
import type { Evidence, Task, User } from '../types/index.js'

const evidence = new Hono()

// Apply middleware to all routes
evidence.use('*', rateLimitMiddleware)
evidence.use('*', authMiddleware)

// Helper: Get user record ID from Clerk ID
async function getUserRecordId(clerkId: string): Promise<string | null> {
  const client = getSmartSuiteClient()
  const user = await client.findByField<User>(TABLES.USERS, USER_FIELDS.clerk_id, clerkId)
  return user?.id || null
}

// Helper: Extract task ID from various SmartSuite linked record formats
function extractTaskIds(taskValue: unknown): string[] {
  if (!taskValue) return []
  
  // Handle array format
  if (Array.isArray(taskValue)) {
    return taskValue.flatMap(item => {
      if (typeof item === 'string') return [item]
      if (typeof item === 'object' && item !== null && 'id' in item) {
        return [(item as { id: string }).id]
      }
      return []
    })
  }
  
  // Handle string format
  if (typeof taskValue === 'string') {
    return [taskValue]
  }
  
  // Handle object format { id: "xxx" }
  if (typeof taskValue === 'object' && taskValue !== null && 'id' in taskValue) {
    return [(taskValue as { id: string }).id]
  }
  
  return []
}

// Helper: Check if evidence belongs to task
function evidenceBelongsToTask(evidence: Record<string, unknown>, taskId: string): boolean {
  const taskValue = evidence[EVIDENCE_FIELDS.task]
  const taskIds = extractTaskIds(taskValue)
  return taskIds.includes(taskId)
}

// Helper: Verify user owns the task (through job ownership)
async function verifyTaskOwnership(taskId: string, clerkId: string): Promise<boolean> {
  const client = getSmartSuiteClient()
  const userRecordId = await getUserRecordId(clerkId)
  
  if (!userRecordId) return false

  try {
    // Get task to find job
    const task = await client.getRecord<Task>(TABLES.TASKS, taskId)
    const taskJobIds = task[TASK_FIELDS.job as keyof Task] as string[] | string
    const jobId = Array.isArray(taskJobIds) ? taskJobIds[0] : taskJobIds

    if (!jobId) return false

    // Get job to verify ownership
    const job = await client.getRecord(TABLES.JOBS, jobId) as unknown as Record<string, unknown>
    const jobUserIds = job['s11e8c3905'] as string[] | string | undefined // JOB_FIELDS.user
    if (!jobUserIds) return false
    
    const userIds = Array.isArray(jobUserIds) ? jobUserIds : [jobUserIds]
    return userIds.includes(userRecordId)
  } catch {
    return false
  }
}

// Helper: Transform SmartSuite evidence record to readable format
function transformEvidence(record: Record<string, unknown>): Record<string, unknown> {
  // Task field may be array (linked record)
  const taskIds = extractTaskIds(record[EVIDENCE_FIELDS.task])
  const taskId = taskIds[0] || ''

  return {
    id: record.id,
    taskId: taskId,
    evidenceType: record[EVIDENCE_FIELDS.evidence_type] || 'unknown',
    photoUrl: record[EVIDENCE_FIELDS.photo_url] || '',
    photoHash: record[EVIDENCE_FIELDS.photo_hash] || '',
    latitude: record[EVIDENCE_FIELDS.latitude],
    longitude: record[EVIDENCE_FIELDS.longitude],
    gpsAccuracy: record[EVIDENCE_FIELDS.gps_accuracy],
    capturedAt: record[EVIDENCE_FIELDS.captured_at],
    syncedAt: record[EVIDENCE_FIELDS.synced_at],
    isSynced: record[EVIDENCE_FIELDS.is_synced] || false
  }
}

// List evidence for a task
evidence.get('/', async (c) => {
  const auth = getAuth(c)
  const taskId = c.req.query('task_id')
  const client = getSmartSuiteClient()

  if (!taskId) {
    return c.json({ error: 'Missing task_id parameter' }, 400)
  }

  try {
    // Verify ownership
    const isOwner = await verifyTaskOwnership(taskId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Fetch all evidence and filter in memory (SmartSuite linked record limitation)
    const result = await client.listRecords<Evidence>(TABLES.EVIDENCE, {
      limit: 200
    })

    // Debug logging - check Railway logs
    console.log('[Evidence API] Searching for taskId:', taskId)
    console.log('[Evidence API] Total evidence records fetched:', result.items.length)
    
    if (result.items.length > 0) {
      const sampleItem = result.items[0] as unknown as Record<string, unknown>
      const sampleTaskField = sampleItem[EVIDENCE_FIELDS.task]
      console.log('[Evidence API] Sample task field value:', JSON.stringify(sampleTaskField))
      console.log('[Evidence API] Sample task field type:', typeof sampleTaskField)
      console.log('[Evidence API] Extracted task IDs from sample:', extractTaskIds(sampleTaskField))
    }

    // Filter by task ID in memory
    const filteredItems = result.items.filter(item => {
      const record = item as unknown as Record<string, unknown>
      const matches = evidenceBelongsToTask(record, taskId)
      if (matches) {
        console.log('[Evidence API] Found matching evidence:', record.id)
      }
      return matches
    })

    console.log('[Evidence API] Filtered items count:', filteredItems.length)

    // Transform each evidence to readable format
    const transformedItems = filteredItems.map(item =>
      transformEvidence(item as unknown as Record<string, unknown>)
    )

    return c.json({
      items: transformedItems,
      total: transformedItems.length
    })
  } catch (error) {
    console.error('Error listing evidence:', error)
    return c.json({ error: 'Failed to list evidence' }, 500)
  }
})

// Get single evidence by ID
evidence.get('/:id', async (c) => {
  const auth = getAuth(c)
  const evidenceId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    const evidenceRecord = await client.getRecord<Evidence>(TABLES.EVIDENCE, evidenceId)

    // Get task ID from evidence
    const taskIds = extractTaskIds(evidenceRecord[EVIDENCE_FIELDS.task as keyof Evidence])
    const taskId = taskIds[0]

    // Verify ownership through task
    const isOwner = await verifyTaskOwnership(taskId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Transform to readable format
    const transformed = transformEvidence(evidenceRecord as unknown as Record<string, unknown>)

    return c.json(transformed)
  } catch (error) {
    console.error('Error fetching evidence:', error)
    return c.json({ error: 'Failed to fetch evidence' }, 500)
  }
})

// Get signed upload URL for R2
evidence.post('/upload-url', async (c) => {
  const auth = getAuth(c)

  try {
    // Validate R2 configuration
    const r2Config = validateR2Config()
    if (!r2Config.valid) {
      console.error('R2 configuration missing:', r2Config.missing)
      return c.json({ error: 'File storage not configured' }, 500)
    }

    const body = await c.req.json() as Record<string, unknown>
    const filename = body.filename as string
    const contentType = (body.content_type || body.contentType || 'image/jpeg') as string
    const jobId = (body.job_id || body.jobId || 'unknown') as string
    const taskId = (body.task_id || body.taskId || 'unknown') as string

    if (!filename) {
      return c.json({ error: 'Missing filename' }, 400)
    }

    // Validate content type (only allow images)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    if (!allowedTypes.includes(contentType)) {
      return c.json({ error: 'Invalid file type. Only JPEG, PNG, WebP, and HEIC images are allowed.' }, 400)
    }

    // Generate unique key with proper structure
    const key = generateEvidenceKey(auth.userId, jobId, taskId, filename)

    // Generate signed upload URL (expires in 5 minutes)
    const { uploadUrl, publicUrl } = await getSignedUploadUrl(key, contentType, 300)

    return c.json({
      upload_url: uploadUrl,
      photo_url: publicUrl,
      key
    })
  } catch (error) {
    console.error('Error generating upload URL:', error)
    return c.json({ error: 'Failed to generate upload URL' }, 500)
  }
})

// Create new evidence record
evidence.post('/', async (c) => {
  const auth = getAuth(c)
  const client = getSmartSuiteClient()

  try {
    const body = await c.req.json() as Record<string, unknown>

    // Support both formats
    const taskId = (body.task_id || body.taskId) as string
    const evidenceType = (body.evidence_type || body.evidenceType) as string
    const photoUrl = (body.photo_url || body.photoUrl) as string
    const photoHash = (body.photo_hash || body.photoHash) as string

    // Validate required fields
    if (!taskId || !evidenceType || !photoUrl) {
      return c.json({ error: 'Missing required fields: task_id, evidence_type, photo_url' }, 400)
    }

    // Verify ownership
    const isOwner = await verifyTaskOwnership(taskId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Create evidence with SmartSuite field IDs
    const evidenceData: Record<string, unknown> = {
      title: `${evidenceType} - ${Date.now()}`,
      [EVIDENCE_FIELDS.task]: [taskId],
      [EVIDENCE_FIELDS.evidence_type]: evidenceType,
      [EVIDENCE_FIELDS.photo_url]: photoUrl,
      [EVIDENCE_FIELDS.photo_hash]: photoHash || '',
      [EVIDENCE_FIELDS.captured_at]: (body.captured_at || body.capturedAt) as string || new Date().toISOString(),
      [EVIDENCE_FIELDS.synced_at]: new Date().toISOString()
    }

    // Note: is_synced is a Checklist field - omit it or use proper format if needed

    // Add optional GPS fields
    const latitude = body.latitude as number | undefined
    const longitude = body.longitude as number | undefined
    const gpsAccuracy = (body.gps_accuracy || body.gpsAccuracy) as number | undefined

    if (latitude !== undefined && latitude !== null) {
      evidenceData[EVIDENCE_FIELDS.latitude] = latitude
    }
    if (longitude !== undefined && longitude !== null) {
      evidenceData[EVIDENCE_FIELDS.longitude] = longitude
    }
    if (gpsAccuracy !== undefined && gpsAccuracy !== null) {
      evidenceData[EVIDENCE_FIELDS.gps_accuracy] = gpsAccuracy
    }

    const created = await client.createRecord<Evidence>(TABLES.EVIDENCE, evidenceData as Omit<Evidence, 'id'>)

    // Transform to readable format
    const transformed = transformEvidence(created as unknown as Record<string, unknown>)

    return c.json(transformed, 201)
  } catch (error) {
    console.error('Error creating evidence:', error)
    return c.json({ error: 'Failed to create evidence' }, 500)
  }
})

// Delete evidence
evidence.delete('/:id', async (c) => {
  const auth = getAuth(c)
  const evidenceId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    // Get existing evidence
    const existingEvidence = await client.getRecord<Evidence>(TABLES.EVIDENCE, evidenceId)

    // Get task ID from evidence
    const taskIds = extractTaskIds(existingEvidence[EVIDENCE_FIELDS.task as keyof Evidence])
    const taskId = taskIds[0]

    // Verify ownership through task
    const isOwner = await verifyTaskOwnership(taskId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Delete file from R2 if URL exists
    const photoUrl = existingEvidence[EVIDENCE_FIELDS.photo_url as keyof Evidence] as string
    if (photoUrl) {
      const key = extractKeyFromUrl(photoUrl)
      if (key) {
        try {
          await deleteObject(key)
        } catch (r2Error) {
          console.error('Failed to delete file from R2:', r2Error)
          // Continue with SmartSuite deletion even if R2 fails
        }
      }
    }

    await client.deleteRecord(TABLES.EVIDENCE, evidenceId)

    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting evidence:', error)
    return c.json({ error: 'Failed to delete evidence' }, 500)
  }
})

export default evidence
