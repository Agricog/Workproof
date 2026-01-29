import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import { USER_FIELDS, TASK_FIELDS, JOB_FIELDS, EVIDENCE_FIELDS } from '../lib/smartsuite-fields.js'
import { authMiddleware, getAuth } from '../middleware/auth.js'
import { rateLimitMiddleware } from '../middleware/rateLimit.js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Evidence, Task, Job, User } from '../types/index.js'

const evidence = new Hono()

// Apply middleware to all routes
evidence.use('*', rateLimitMiddleware)
evidence.use('*', authMiddleware)

// R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
  }
})

const R2_BUCKET = process.env.R2_BUCKET || 'workproof-evidence'

// Helper: Get user record ID from Clerk ID
async function getUserRecordId(clerkId: string): Promise<string | null> {
  const client = getSmartSuiteClient()
  const result = await client.listRecords<User>(TABLES.USERS, {
    filter: {
      operator: 'and',
      fields: [{ field: USER_FIELDS.clerk_id, comparison: 'is', value: clerkId }]
    },
    limit: 1
  })
  return result.items[0]?.id || null
}

// Helper: Verify task ownership through job
async function verifyTaskOwnership(taskId: string, clerkId: string): Promise<boolean> {
  const client = getSmartSuiteClient()

  // Get user record ID
  const userRecordId = await getUserRecordId(clerkId)
  if (!userRecordId) return false

  // Get task
  const task = await client.getRecord<Task>(TABLES.TASKS, taskId)
  if (!task) return false

  // Get job ID from task
  const jobIds = task[TASK_FIELDS.job as keyof Task] as string[] | string
  const jobId = Array.isArray(jobIds) ? jobIds[0] : jobIds
  if (!jobId) return false

  // Get job
  const job = await client.getRecord<Job>(TABLES.JOBS, jobId)
  if (!job) return false

  // Check if job belongs to user
  const jobUserIds = job[JOB_FIELDS.user as keyof Job] as string[] | string
  const jobUserId = Array.isArray(jobUserIds) ? jobUserIds[0] : jobUserIds

  return jobUserId === userRecordId
}

// Helper: Extract value from SmartSuite single-select field
function extractSingleSelectValue(field: unknown): string | null {
  if (!field) return null
  if (typeof field === 'string') return field
  if (typeof field === 'object' && field !== null) {
    const obj = field as Record<string, unknown>
    // SmartSuite returns { value: "...", label: "..." } for single-select
    if ('value' in obj && typeof obj.value === 'string') {
      return obj.value
    }
    // Sometimes it's just the label
    if ('label' in obj && typeof obj.label === 'string') {
      return obj.label.toLowerCase()
    }
  }
  return null
}

// Transform SmartSuite evidence to API format
function transformEvidence(item: Record<string, unknown>): Record<string, unknown> {
  const taskIds = item[EVIDENCE_FIELDS.task] as string[] | string | undefined
  const taskId = Array.isArray(taskIds) ? taskIds[0] : taskIds

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
    // SmartSuite checkbox returns { completed_items: n }
    const obj = isSyncedField as Record<string, unknown>
    isSynced = (obj.completed_items as number) > 0
  }

  return {
    id: item.id,
    taskId: taskId || null,
    evidenceType: extractSingleSelectValue(item[EVIDENCE_FIELDS.evidence_type]),
    photoStage: extractSingleSelectValue(item[EVIDENCE_FIELDS.photo_stage]),
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

// Get evidence by task ID (with in-memory filtering for linked records)
evidence.get('/task/:taskId', async (c) => {
  const auth = getAuth(c)
  const taskId = c.req.param('taskId')
  const client = getSmartSuiteClient()

  try {
    // Verify ownership
    const isOwner = await verifyTaskOwnership(taskId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Fetch all evidence (linked record fields don't support comparison operators)
    const result = await client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 500 })

    // Filter in-memory by task ID
    const filteredItems = result.items.filter((item) => {
      const evidenceTaskIds = item[EVIDENCE_FIELDS.task as keyof Evidence] as string[] | string | undefined
      if (!evidenceTaskIds) return false
      const ids = Array.isArray(evidenceTaskIds) ? evidenceTaskIds : [evidenceTaskIds]
      return ids.includes(taskId)
    })

    // Transform to readable format
    const transformed = filteredItems.map((item) =>
      transformEvidence(item as unknown as Record<string, unknown>)
    )

    return c.json(transformed)
  } catch (error) {
    console.error('Error fetching evidence by task:', error)
    return c.json({ error: 'Failed to fetch evidence' }, 500)
  }
})

// Get evidence by job ID (for audit packs)
evidence.get('/job/:jobId', async (c) => {
  const auth = getAuth(c)
  const jobId = c.req.param('jobId')
  const client = getSmartSuiteClient()

  try {
    // Get user record ID
    const userRecordId = await getUserRecordId(auth.userId)
    if (!userRecordId) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Verify job ownership
    const job = await client.getRecord<Job>(TABLES.JOBS, jobId)
    if (!job) {
      return c.json({ error: 'Job not found' }, 404)
    }
    const jobUserIds = job[JOB_FIELDS.user as keyof Job] as string[] | string
    const jobUserId = Array.isArray(jobUserIds) ? jobUserIds[0] : jobUserIds
    if (jobUserId !== userRecordId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Get all tasks for this job
    const tasksResult = await client.listRecords<Task>(TABLES.TASKS, { limit: 100 })
    const jobTasks = tasksResult.items.filter((task) => {
      const taskJobIds = task[TASK_FIELDS.job as keyof Task] as string[] | string | undefined
      if (!taskJobIds) return false
      const ids = Array.isArray(taskJobIds) ? taskJobIds : [taskJobIds]
      return ids.includes(jobId)
    })
    const taskIds = jobTasks.map((t) => t.id)

    // Get all evidence and filter by task IDs
    const evidenceResult = await client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 500 })
    const jobEvidence = evidenceResult.items.filter((item) => {
      const evidenceTaskIds = item[EVIDENCE_FIELDS.task as keyof Evidence] as string[] | string | undefined
      if (!evidenceTaskIds) return false
      const ids = Array.isArray(evidenceTaskIds) ? evidenceTaskIds : [evidenceTaskIds]
      return ids.some((id) => taskIds.includes(id))
    })

    // Transform and return
    const transformed = jobEvidence.map((item) =>
      transformEvidence(item as unknown as Record<string, unknown>)
    )

    return c.json(transformed)
  } catch (error) {
    console.error('Error fetching evidence by job:', error)
    return c.json({ error: 'Failed to fetch evidence' }, 500)
  }
})

// Count evidence by job (fast)
evidence.get('/job/:jobId/count', async (c) => {
  const auth = getAuth(c)
  const jobId = c.req.param('jobId')
  const client = getSmartSuiteClient()

  try {
    // Get user record ID
    const userRecordId = await getUserRecordId(auth.userId)
    if (!userRecordId) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Verify job ownership
    const job = await client.getRecord<Job>(TABLES.JOBS, jobId)
    if (!job) {
      return c.json({ error: 'Job not found' }, 404)
    }
    const jobUserIds = job[JOB_FIELDS.user as keyof Job] as string[] | string
    const jobUserId = Array.isArray(jobUserIds) ? jobUserIds[0] : jobUserIds
    if (jobUserId !== userRecordId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Get all tasks for this job
    const tasksResult = await client.listRecords<Task>(TABLES.TASKS, { limit: 100 })
    const jobTasks = tasksResult.items.filter((task) => {
      const taskJobIds = task[TASK_FIELDS.job as keyof Task] as string[] | string | undefined
      if (!taskJobIds) return false
      const ids = Array.isArray(taskJobIds) ? taskJobIds : [taskJobIds]
      return ids.includes(jobId)
    })
    const taskIds = jobTasks.map((t) => t.id)

    // Count evidence
    const evidenceResult = await client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 500 })
    const count = evidenceResult.items.filter((item) => {
      const evidenceTaskIds = item[EVIDENCE_FIELDS.task as keyof Evidence] as string[] | string | undefined
      if (!evidenceTaskIds) return false
      const ids = Array.isArray(evidenceTaskIds) ? evidenceTaskIds : [evidenceTaskIds]
      return ids.some((id) => taskIds.includes(id))
    }).length

    return c.json({ count })
  } catch (error) {
    console.error('Error counting evidence:', error)
    return c.json({ error: 'Failed to count evidence' }, 500)
  }
})

// Get single evidence by ID
evidence.get('/:id', async (c) => {
  const auth = getAuth(c)
  const evidenceId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    const evidenceRecord = await client.getRecord<Evidence>(TABLES.EVIDENCE, evidenceId)

    if (!evidenceRecord) {
      return c.json({ error: 'Evidence not found' }, 404)
    }

    // Get task ID from evidence
    const evidenceTaskIds = evidenceRecord[EVIDENCE_FIELDS.task as keyof Evidence] as string[] | string
    const taskId = Array.isArray(evidenceTaskIds) ? evidenceTaskIds[0] : evidenceTaskIds

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
    const body = (await c.req.json()) as Record<string, unknown>
    const filename = body.filename as string
    const contentType = (body.content_type || body.contentType || 'image/jpeg') as string

    if (!filename) {
      return c.json({ error: 'Missing filename' }, 400)
    }

    // Generate unique key
    const timestamp = Date.now()
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    const key = `evidence/${auth.userId}/${timestamp}-${sanitizedFilename}`

    // Generate signed upload URL
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType
    })

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 })

    // Public URL for accessing the file
    const publicUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL}/${key}`
      : `https://${R2_BUCKET}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`

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
    const body = (await c.req.json()) as Record<string, unknown>

    // Support both formats
    const taskId = (body.task_id || body.taskId) as string
    const evidenceType = (body.evidence_type || body.evidenceType) as string
    const photoStage = (body.photo_stage || body.photoStage) as string | undefined
    const photoUrl = (body.photo_url || body.photoUrl) as string
    const photoHash = (body.photo_hash || body.photoHash) as string

    // Validate required fields
    if (!taskId || !evidenceType || !photoUrl) {
      return c.json({ error: 'Missing required fields: task_id, evidence_type, photo_url' }, 400)
    }

    // Validate photo_stage if provided
    const validStages = ['before', 'during', 'after']
    if (photoStage && !validStages.includes(photoStage)) {
      return c.json({ error: 'Invalid photo_stage. Must be: before, during, or after' }, 400)
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
      [EVIDENCE_FIELDS.captured_at]:
        ((body.captured_at || body.capturedAt) as string) || new Date().toISOString(),
      [EVIDENCE_FIELDS.synced_at]: new Date().toISOString()
    }

    // Add photo_stage if provided
    if (photoStage) {
      evidenceData[EVIDENCE_FIELDS.photo_stage] = photoStage
    }

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

    const created = await client.createRecord<Evidence>(
      TABLES.EVIDENCE,
      evidenceData as Omit<Evidence, 'id'>
    )

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
    const evidenceTaskIds = existingEvidence[EVIDENCE_FIELDS.task as keyof Evidence] as
      | string[]
      | string
    const taskId = Array.isArray(evidenceTaskIds) ? evidenceTaskIds[0] : evidenceTaskIds

    // Verify ownership through task
    const isOwner = await verifyTaskOwnership(taskId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await client.deleteRecord(TABLES.EVIDENCE, evidenceId)

    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting evidence:', error)
    return c.json({ error: 'Failed to delete evidence' }, 500)
  }
})

export default evidence

