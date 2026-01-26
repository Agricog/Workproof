import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import { authMiddleware, getAuth } from '../middleware/auth.js'
import { rateLimitMiddleware, strictRateLimitMiddleware } from '../middleware/rateLimit.js'
import type { Evidence, Task, Job, User, CreateEvidenceRequest } from '../types/index.js'

const evidence = new Hono()

// Apply middleware to all routes
evidence.use('*', rateLimitMiddleware)
evidence.use('*', authMiddleware)

// Helper: Get user record ID from Clerk ID
async function getUserRecordId(clerkId: string): Promise<string | null> {
  const client = getSmartSuiteClient()
  const user = await client.findByField<User>(TABLES.USERS, 'clerk_id', clerkId)
  return user?.id || null
}

// Helper: Verify user owns the task (through job)
async function verifyTaskOwnership(taskId: string, clerkId: string): Promise<boolean> {
  const client = getSmartSuiteClient()
  const userRecordId = await getUserRecordId(clerkId)
  
  if (!userRecordId) return false

  try {
    const task = await client.getRecord<Task>(TABLES.TASKS, taskId)
    const job = await client.getRecord<Job>(TABLES.JOBS, task.job)
    return job.user === userRecordId
  } catch {
    return false
  }
}

// List evidence for a task
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

    const result = await client.listRecords<Evidence>(TABLES.EVIDENCE, {
      filter: {
        operator: 'and',
        fields: [{ field: 'task', comparison: 'is', value: taskId }]
      },
      sort: [{ field: 'captured_at', direction: 'asc' }]
    })

    return c.json({
      items: result.items,
      total: result.total
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

    // Verify ownership through task
    const isOwner = await verifyTaskOwnership(evidenceRecord.task, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    return c.json(evidenceRecord)
  } catch (error) {
    console.error('Error fetching evidence:', error)
    return c.json({ error: 'Failed to fetch evidence' }, 500)
  }
})

// Create evidence record (after photo uploaded to R2)
evidence.post('/', async (c) => {
  const auth = getAuth(c)
  const client = getSmartSuiteClient()

  try {
    const body = await c.req.json() as CreateEvidenceRequest

    // Validate required fields
    const requiredFields = ['task', 'evidence_type', 'photo_url', 'photo_hash', 'captured_at']
    for (const field of requiredFields) {
      if (!body[field as keyof CreateEvidenceRequest]) {
        return c.json({ error: `Missing required field: ${field}` }, 400)
      }
    }

    // Verify ownership
    const isOwner = await verifyTaskOwnership(body.task, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Create evidence record
    const evidenceData: Omit<Evidence, 'id'> = {
      task: body.task,
      evidence_type: body.evidence_type,
      photo_url: body.photo_url,
      photo_hash: body.photo_hash,
      latitude: body.latitude,
      longitude: body.longitude,
      gps_accuracy: body.gps_accuracy,
      captured_at: body.captured_at,
      synced_at: new Date().toISOString(),
      is_synced: true,
      notes: body.notes
    }

    const evidenceRecord = await client.createRecord<Evidence>(TABLES.EVIDENCE, evidenceData)

    return c.json(evidenceRecord, 201)
  } catch (error) {
    console.error('Error creating evidence:', error)
    return c.json({ error: 'Failed to create evidence' }, 500)
  }
})

// Generate R2 upload URL (strict rate limit)
evidence.post('/upload-url', strictRateLimitMiddleware, async (c) => {
  const auth = getAuth(c)

  try {
    const body = await c.req.json() as { 
      taskId: string
      filename: string
      contentType: string 
    }

    if (!body.taskId || !body.filename || !body.contentType) {
      return c.json({ error: 'Missing required fields: taskId, filename, contentType' }, 400)
    }

    // Validate content type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(body.contentType)) {
      return c.json({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP' }, 400)
    }

    // Verify ownership
    const isOwner = await verifyTaskOwnership(body.taskId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Generate unique key
    const timestamp = Date.now()
    const sanitizedFilename = body.filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    const key = `evidence/${auth.userId}/${body.taskId}/${timestamp}-${sanitizedFilename}`

    // Generate signed upload URL using R2
    const r2AccountId = process.env.R2_ACCOUNT_ID
    const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID
    const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    const r2BucketName = process.env.R2_BUCKET_NAME

    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName) {
      console.error('R2 credentials not configured')
      return c.json({ error: 'Storage not configured' }, 500)
    }

    // For R2, we'll use a simple approach: return the key and let frontend upload via presigned URL
    // In production, you'd use AWS SDK v3 with R2 endpoint to generate presigned URLs
    
    const uploadUrl = `https://${r2AccountId}.r2.cloudflarestorage.com/${r2BucketName}/${key}`
    const publicUrl = `https://${process.env.R2_PUBLIC_DOMAIN || r2BucketName + '.r2.dev'}/${key}`

    return c.json({
      uploadUrl,
      publicUrl,
      key,
      expiresIn: 300 // 5 minutes
    })
  } catch (error) {
    console.error('Error generating upload URL:', error)
    return c.json({ error: 'Failed to generate upload URL' }, 500)
  }
})

// Update evidence
evidence.patch('/:id', async (c) => {
  const auth = getAuth(c)
  const evidenceId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    // Get existing evidence
    const existingEvidence = await client.getRecord<Evidence>(TABLES.EVIDENCE, evidenceId)

    // Verify ownership
    const isOwner = await verifyTaskOwnership(existingEvidence.task, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const body = await c.req.json()

    // Only allow updating notes
    const updateData: Partial<Evidence> = {}
    if (body.notes !== undefined) {
      updateData.notes = body.notes
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'No valid fields to update' }, 400)
    }

    const updatedEvidence = await client.updateRecord<Evidence>(
      TABLES.EVIDENCE,
      evidenceId,
      updateData
    )

    return c.json(updatedEvidence)
  } catch (error) {
    console.error('Error updating evidence:', error)
    return c.json({ error: 'Failed to update evidence' }, 500)
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

    // Verify ownership
    const isOwner = await verifyTaskOwnership(existingEvidence.task, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await client.deleteRecord(TABLES.EVIDENCE, evidenceId)

    // Note: R2 file deletion would be handled separately (cleanup job)

    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting evidence:', error)
    return c.json({ error: 'Failed to delete evidence' }, 500)
  }
})

// Bulk sync evidence (for offline-captured photos)
evidence.post('/sync', async (c) => {
  const auth = getAuth(c)
  const client = getSmartSuiteClient()

  try {
    const body = await c.req.json() as { items: CreateEvidenceRequest[] }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return c.json({ error: 'Missing items array' }, 400)
    }

    // Limit batch size
    if (body.items.length > 50) {
      return c.json({ error: 'Maximum 50 items per sync' }, 400)
    }

    // Verify ownership for all tasks
    const taskIds = [...new Set(body.items.map(item => item.task))]
    for (const taskId of taskIds) {
      const isOwner = await verifyTaskOwnership(taskId, auth.userId)
      if (!isOwner) {
        return c.json({ error: `Forbidden: invalid task ${taskId}` }, 403)
      }
    }

    // Create all evidence records
    const evidenceRecords = body.items.map(item => ({
      task: item.task,
      evidence_type: item.evidence_type,
      photo_url: item.photo_url,
      photo_hash: item.photo_hash,
      latitude: item.latitude,
      longitude: item.longitude,
      gps_accuracy: item.gps_accuracy,
      captured_at: item.captured_at,
      synced_at: new Date().toISOString(),
      is_synced: true,
      notes: item.notes
    }))

    const created = await client.bulkCreate<Evidence>(TABLES.EVIDENCE, evidenceRecords)

    return c.json({ 
      items: created,
      synced: created.length 
    }, 201)
  } catch (error) {
    console.error('Error syncing evidence:', error)
    return c.json({ error: 'Failed to sync evidence' }, 500)
  }
})

export default evidence
