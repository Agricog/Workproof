import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import { USER_FIELDS, JOB_FIELDS, TASK_FIELDS, EVIDENCE_FIELDS, AUDIT_PACK_FIELDS } from '../lib/smartsuite-fields.js'
import { authMiddleware, getAuth } from '../middleware/auth.js'
import { rateLimitMiddleware, strictRateLimitMiddleware } from '../middleware/rateLimit.js'
import { cacheGet, cacheSet, CACHE_KEYS, CACHE_TTL } from '../lib/redis.js'
import type { AuditPack, Job, Task, Evidence, User } from '../types/index.js'

const auditPacks = new Hono()

// Apply middleware to all routes
auditPacks.use('*', rateLimitMiddleware)
auditPacks.use('*', authMiddleware)

// Helper: Get user record ID from Clerk ID (with caching)
async function getUserRecordId(clerkId: string): Promise<string | null> {
  const cacheKey = CACHE_KEYS.userRecord(clerkId)
  
  const cached = await cacheGet<string>(cacheKey)
  if (cached) {
    return cached
  }
  
  const client = getSmartSuiteClient()
  const user = await client.findByField<User>(TABLES.USERS, USER_FIELDS.clerk_id, clerkId)
  
  if (user?.id) {
    cacheSet(cacheKey, user.id, CACHE_TTL.userRecord)
    return user.id
  }
  return null
}

// Helper: Verify user owns the job (with caching)
async function verifyJobOwnership(jobId: string, clerkId: string): Promise<boolean> {
  const userRecordId = await getUserRecordId(clerkId)
  
  if (!userRecordId) return false

  const ownershipKey = CACHE_KEYS.jobOwnership(jobId, userRecordId)
  const cachedOwnership = await cacheGet<boolean>(ownershipKey)
  if (cachedOwnership !== null) {
    return cachedOwnership
  }

  const client = getSmartSuiteClient()

  try {
    const job = await client.getRecord<Job>(TABLES.JOBS, jobId)
    const jobUserIds = job[JOB_FIELDS.user as keyof Job] as string[] | string | undefined
    
    if (!jobUserIds) return false
    
    const userIds = Array.isArray(jobUserIds) ? jobUserIds : [jobUserIds]
    const isOwner = userIds.includes(userRecordId)
    
    cacheSet(ownershipKey, isOwner, CACHE_TTL.jobOwnership)
    return isOwner
  } catch {
    return false
  }
}

// Helper: Generate SHA-256 hash
async function generateHash(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Helper: Extract job ID from linked record field
function extractJobId(jobField: unknown): string | null {
  if (typeof jobField === 'string') return jobField
  if (Array.isArray(jobField) && jobField.length > 0) return jobField[0]
  return null
}

// Helper: Check if record's linked field contains the target ID
function linkedFieldContains(linkedField: unknown, targetId: string): boolean {
  if (!linkedField) return false
  if (typeof linkedField === 'string') return linkedField === targetId
  if (Array.isArray(linkedField)) return linkedField.includes(targetId)
  return false
}

// List audit packs for a job
auditPacks.get('/job/:jobId', async (c) => {
  const auth = getAuth(c)
  const jobId = c.req.param('jobId')
  const client = getSmartSuiteClient()

  try {
    // Verify ownership
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Fetch all audit packs and filter client-side
    const result = await client.listRecords<AuditPack>(TABLES.AUDIT_PACKS, { limit: 100 })
    
    const filteredItems = result.items.filter(pack => 
      linkedFieldContains(pack[AUDIT_PACK_FIELDS.job as keyof AuditPack], jobId)
    )

    // Sort by generated_at descending
    filteredItems.sort((a, b) => {
      const aDate = a[AUDIT_PACK_FIELDS.generated_at as keyof AuditPack] as string || ''
      const bDate = b[AUDIT_PACK_FIELDS.generated_at as keyof AuditPack] as string || ''
      return bDate.localeCompare(aDate)
    })

    // Map to response format
    const items = filteredItems.map(pack => ({
      id: pack.id,
      job: extractJobId(pack[AUDIT_PACK_FIELDS.job as keyof AuditPack]),
      generated_at: pack[AUDIT_PACK_FIELDS.generated_at as keyof AuditPack],
      pdf_url: pack[AUDIT_PACK_FIELDS.pdf_url as keyof AuditPack],
      evidence_count: pack[AUDIT_PACK_FIELDS.evidence_count as keyof AuditPack],
      hash: pack[AUDIT_PACK_FIELDS.hash as keyof AuditPack],
      downloaded_at: pack[AUDIT_PACK_FIELDS.downloaded_at as keyof AuditPack]
    }))

    return c.json({
      items,
      total: items.length
    })
  } catch (error) {
    console.error('Error listing audit packs:', error)
    return c.json({ error: 'Failed to list audit packs' }, 500)
  }
})

// Get single audit pack by ID
auditPacks.get('/:id', async (c) => {
  const auth = getAuth(c)
  const packId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    const pack = await client.getRecord<AuditPack>(TABLES.AUDIT_PACKS, packId)
    
    // Get job ID from linked field
    const jobId = extractJobId(pack[AUDIT_PACK_FIELDS.job as keyof AuditPack])
    if (!jobId) {
      return c.json({ error: 'Invalid audit pack' }, 400)
    }

    // Verify ownership through job
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    return c.json({
      id: pack.id,
      job: jobId,
      generated_at: pack[AUDIT_PACK_FIELDS.generated_at as keyof AuditPack],
      pdf_url: pack[AUDIT_PACK_FIELDS.pdf_url as keyof AuditPack],
      evidence_count: pack[AUDIT_PACK_FIELDS.evidence_count as keyof AuditPack],
      hash: pack[AUDIT_PACK_FIELDS.hash as keyof AuditPack],
      downloaded_at: pack[AUDIT_PACK_FIELDS.downloaded_at as keyof AuditPack],
      shared_with: pack[AUDIT_PACK_FIELDS.shared_with as keyof AuditPack]
    })
  } catch (error) {
    console.error('Error fetching audit pack:', error)
    return c.json({ error: 'Failed to fetch audit pack' }, 500)
  }
})

// Generate new audit pack (strict rate limit - resource intensive)
auditPacks.post('/generate', strictRateLimitMiddleware, async (c) => {
  const auth = getAuth(c)
  const client = getSmartSuiteClient()

  try {
    const body = await c.req.json() as { job: string }
    
    if (!body.job) {
      return c.json({ error: 'Missing required field: job' }, 400)
    }

    // Verify ownership
    const isOwner = await verifyJobOwnership(body.job, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Get job details
    const job = await client.getRecord<Job>(TABLES.JOBS, body.job)
    const jobTitle = (job[JOB_FIELDS.title as keyof Job] as string) || 'Untitled Job'
    const jobAddress = (job[JOB_FIELDS.address as keyof Job] as string) || ''
    const jobPostcode = (job[JOB_FIELDS.postcode as keyof Job] as string) || ''
    const clientName = (job[JOB_FIELDS.client_name as keyof Job] as string) || ''

    // Get all tasks and filter for this job (same pattern as tasks.ts)
    const tasksResult = await client.listRecords<Task>(TABLES.TASKS, { limit: 200 })
    const jobTasks = tasksResult.items.filter(task => 
      linkedFieldContains(task[TASK_FIELDS.job as keyof Task], body.job)
    )

    // Get all evidence and filter for tasks belonging to this job
    const taskIds = jobTasks.map(t => t.id)
    const evidenceResult = await client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 500 })
    const allEvidence = evidenceResult.items.filter(ev => {
      const evTaskId = ev[EVIDENCE_FIELDS.task as keyof Evidence]
      return taskIds.some(taskId => linkedFieldContains(evTaskId, taskId))
    })

    // Generate pack hash from all evidence hashes
    const evidenceHashes = allEvidence
      .map(e => e[EVIDENCE_FIELDS.photo_hash as keyof Evidence] as string || '')
      .filter(h => h)
      .sort()
      .join('')
    
    const packHash = await generateHash(
      `${body.job}:${jobTitle}:${evidenceHashes}:${new Date().toISOString()}`
    )

    // Create audit pack record with SmartSuite field IDs
    const packData: Record<string, unknown> = {
      [AUDIT_PACK_FIELDS.job]: [body.job], // Linked records are arrays
      [AUDIT_PACK_FIELDS.generated_at]: new Date().toISOString(),
      [AUDIT_PACK_FIELDS.evidence_count]: allEvidence.length,
      [AUDIT_PACK_FIELDS.hash]: packHash
    }

    const auditPack = await client.createRecord<AuditPack>(TABLES.AUDIT_PACKS, packData as Partial<AuditPack>)

    // Count completed tasks
    const completedTasks = jobTasks.filter(t => {
      const status = t[TASK_FIELDS.status as keyof Task]
      if (typeof status === 'string') return status === 'completed'
      if (status && typeof status === 'object' && 'value' in status) {
        return (status as { value: string }).value === 'completed'
      }
      return false
    }).length

    // Return pack with summary
    return c.json({
      id: auditPack.id,
      job: body.job,
      generated_at: packData[AUDIT_PACK_FIELDS.generated_at],
      evidence_count: allEvidence.length,
      hash: packHash,
      summary: {
        jobTitle,
        address: jobAddress,
        postcode: jobPostcode,
        clientName,
        taskCount: jobTasks.length,
        evidenceCount: allEvidence.length,
        completedTasks
      }
    }, 201)
  } catch (error) {
    console.error('Error generating audit pack:', error)
    return c.json({ error: 'Failed to generate audit pack' }, 500)
  }
})

// Get full audit pack data (for PDF generation)
auditPacks.get('/:id/full', async (c) => {
  const auth = getAuth(c)
  const packId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    const pack = await client.getRecord<AuditPack>(TABLES.AUDIT_PACKS, packId)
    
    // Get job ID from linked field
    const jobId = extractJobId(pack[AUDIT_PACK_FIELDS.job as keyof AuditPack])
    if (!jobId) {
      return c.json({ error: 'Invalid audit pack' }, 400)
    }

    // Verify ownership through job
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Get job details
    const job = await client.getRecord<Job>(TABLES.JOBS, jobId)

    // Get user details
    const userRecordId = await getUserRecordId(auth.userId)
    const user = userRecordId 
      ? await client.getRecord<User>(TABLES.USERS, userRecordId)
      : null

    // Get all tasks and filter for this job
    const tasksResult = await client.listRecords<Task>(TABLES.TASKS, { limit: 200 })
    const jobTasks = tasksResult.items.filter(task => 
      linkedFieldContains(task[TASK_FIELDS.job as keyof Task], jobId)
    )

    // Get all evidence
    const evidenceResult = await client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 500 })

    // Get evidence for each task
    const tasksWithEvidence = jobTasks.map(task => {
      const taskEvidence = evidenceResult.items.filter(ev =>
        linkedFieldContains(ev[EVIDENCE_FIELDS.task as keyof Evidence], task.id)
      )
      return {
        ...task,
        evidence: taskEvidence
      }
    })

    return c.json({
      pack: {
        id: pack.id,
        job: jobId,
        generated_at: pack[AUDIT_PACK_FIELDS.generated_at as keyof AuditPack],
        evidence_count: pack[AUDIT_PACK_FIELDS.evidence_count as keyof AuditPack],
        hash: pack[AUDIT_PACK_FIELDS.hash as keyof AuditPack]
      },
      job: {
        id: job.id,
        title: job[JOB_FIELDS.title as keyof Job],
        address: job[JOB_FIELDS.address as keyof Job],
        postcode: job[JOB_FIELDS.postcode as keyof Job],
        client_name: job[JOB_FIELDS.client_name as keyof Job],
        start_date: job[JOB_FIELDS.start_date as keyof Job]
      },
      user: user ? {
        full_name: user[USER_FIELDS.full_name as keyof User],
        company_name: user[USER_FIELDS.company_name as keyof User],
        niceic_number: user[USER_FIELDS.niceic_number as keyof User],
        email: user[USER_FIELDS.email as keyof User],
        phone: user[USER_FIELDS.phone as keyof User]
      } : null,
      tasks: tasksWithEvidence
    })
  } catch (error) {
    console.error('Error fetching full audit pack:', error)
    return c.json({ error: 'Failed to fetch audit pack data' }, 500)
  }
})

// Mark audit pack as downloaded
auditPacks.post('/:id/downloaded', async (c) => {
  const auth = getAuth(c)
  const packId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    const pack = await client.getRecord<AuditPack>(TABLES.AUDIT_PACKS, packId)
    
    // Get job ID from linked field
    const jobId = extractJobId(pack[AUDIT_PACK_FIELDS.job as keyof AuditPack])
    if (!jobId) {
      return c.json({ error: 'Invalid audit pack' }, 400)
    }

    // Verify ownership
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const updateData: Record<string, unknown> = {
      [AUDIT_PACK_FIELDS.downloaded_at]: new Date().toISOString()
    }

    const updatedPack = await client.updateRecord<AuditPack>(
      TABLES.AUDIT_PACKS,
      packId,
      updateData as Partial<AuditPack>
    )

    return c.json({
      id: updatedPack.id,
      downloaded_at: updatedPack[AUDIT_PACK_FIELDS.downloaded_at as keyof AuditPack]
    })
  } catch (error) {
    console.error('Error updating audit pack:', error)
    return c.json({ error: 'Failed to update audit pack' }, 500)
  }
})

// Share audit pack via email
auditPacks.post('/:id/share', strictRateLimitMiddleware, async (c) => {
  const auth = getAuth(c)
  const packId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    const body = await c.req.json() as { email: string }
    
    if (!body.email) {
      return c.json({ error: 'Missing required field: email' }, 400)
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return c.json({ error: 'Invalid email format' }, 400)
    }

    const pack = await client.getRecord<AuditPack>(TABLES.AUDIT_PACKS, packId)
    
    // Get job ID from linked field
    const jobId = extractJobId(pack[AUDIT_PACK_FIELDS.job as keyof AuditPack])
    if (!jobId) {
      return c.json({ error: 'Invalid audit pack' }, 400)
    }

    // Verify ownership
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Update shared_with field
    const updateData: Record<string, unknown> = {
      [AUDIT_PACK_FIELDS.shared_with]: body.email
    }

    await client.updateRecord<AuditPack>(
      TABLES.AUDIT_PACKS,
      packId,
      updateData as Partial<AuditPack>
    )

    // TODO: Send email via Resend
    // For now, just return success - email integration comes later

    return c.json({ 
      success: true,
      message: `Audit pack will be shared with ${body.email}`
    })
  } catch (error) {
    console.error('Error sharing audit pack:', error)
    return c.json({ error: 'Failed to share audit pack' }, 500)
  }
})

// Delete audit pack
auditPacks.delete('/:id', async (c) => {
  const auth = getAuth(c)
  const packId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    const pack = await client.getRecord<AuditPack>(TABLES.AUDIT_PACKS, packId)
    
    // Get job ID from linked field
    const jobId = extractJobId(pack[AUDIT_PACK_FIELDS.job as keyof AuditPack])
    if (!jobId) {
      return c.json({ error: 'Invalid audit pack' }, 400)
    }

    // Verify ownership
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await client.deleteRecord(TABLES.AUDIT_PACKS, packId)

    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting audit pack:', error)
    return c.json({ error: 'Failed to delete audit pack' }, 500)
  }
})

export default auditPacks

