import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import { USER_FIELDS, JOB_FIELDS, TASK_FIELDS, EVIDENCE_FIELDS, AUDIT_PACK_FIELDS } from '../lib/smartsuite-fields.js'
import { authMiddleware, getAuth } from '../middleware/auth.js'
import { rateLimitMiddleware, strictRateLimitMiddleware } from '../middleware/rateLimit.js'
import type { AuditPack, Job, Task, Evidence, User } from '../types/index.js'

const auditPacks = new Hono()

// Apply middleware to all routes
auditPacks.use('*', rateLimitMiddleware)
auditPacks.use('*', authMiddleware)

// Helper: Get user record ID from Clerk ID
async function getUserRecordId(clerkId: string): Promise<string | null> {
  const client = getSmartSuiteClient()
  const user = await client.findByField<User>(TABLES.USERS, USER_FIELDS.clerk_id, clerkId)
  return user?.id || null
}

// Helper: Verify user owns the job
async function verifyJobOwnership(jobId: string, clerkId: string): Promise<boolean> {
  const client = getSmartSuiteClient()
  const userRecordId = await getUserRecordId(clerkId)
  
  if (!userRecordId) return false

  try {
    const job = await client.getRecord<Job>(TABLES.JOBS, jobId)
    const jobUser = job[JOB_FIELDS.user as keyof Job]
    if (Array.isArray(jobUser)) {
      return jobUser.includes(userRecordId)
    }
    return jobUser === userRecordId
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

// Helper: Check if record belongs to job (like tasks.ts does)
function recordBelongsToJob(record: Record<string, unknown>, jobId: string, fieldKey: string): boolean {
  const linkedIds = record[fieldKey] as string[] | string | undefined
  if (!linkedIds) return false
  const ids = Array.isArray(linkedIds) ? linkedIds : [linkedIds]
  return ids.includes(jobId)
}

// Helper: Check if evidence belongs to task
function evidenceBelongsToTask(record: Record<string, unknown>, taskId: string): boolean {
  const linkedIds = record[EVIDENCE_FIELDS.task] as string[] | string | undefined
  if (!linkedIds) return false
  const ids = Array.isArray(linkedIds) ? linkedIds : [linkedIds]
  return ids.includes(taskId)
}

/**
 * Generate deterministic pack hash from evidence
 * MUST match verify.ts computation exactly
 */
async function generatePackHash(evidenceItems: Record<string, unknown>[]): Promise<string> {
  const hashes = evidenceItems
    .map(ev => ev[EVIDENCE_FIELDS.photo_hash] as string || '')
    .filter(h => h)
    .sort()
    .join('|')
  
  return generateHash(hashes)
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

    // Fetch all audit packs and filter in JavaScript (like tasks.ts pattern)
    const result = await client.listRecords<AuditPack>(TABLES.AUDIT_PACKS, { limit: 200 })
    
    const filteredPacks = result.items.filter(pack => 
      recordBelongsToJob(pack as unknown as Record<string, unknown>, jobId, AUDIT_PACK_FIELDS.job)
    )

    // Sort by generated_at descending
    filteredPacks.sort((a, b) => {
      const aDate = a[AUDIT_PACK_FIELDS.generated_at as keyof AuditPack] as string || ''
      const bDate = b[AUDIT_PACK_FIELDS.generated_at as keyof AuditPack] as string || ''
      return new Date(bDate).getTime() - new Date(aDate).getTime()
    })

    // Map to response format
    const items = filteredPacks.map(pack => ({
      id: pack.id,
      job: extractJobId(pack[AUDIT_PACK_FIELDS.job as keyof AuditPack]),
      generated_at: pack[AUDIT_PACK_FIELDS.generated_at as keyof AuditPack],
      pdf_url: pack[AUDIT_PACK_FIELDS.pdf_url as keyof AuditPack],
      evidence_count: pack[AUDIT_PACK_FIELDS.evidence_count as keyof AuditPack],
      hash: pack[AUDIT_PACK_FIELDS.hash as keyof AuditPack],
      downloaded_at: pack[AUDIT_PACK_FIELDS.downloaded_at as keyof AuditPack],
      signature_url: pack[AUDIT_PACK_FIELDS.signature_url as keyof AuditPack],
      signed_at: pack[AUDIT_PACK_FIELDS.signed_at as keyof AuditPack]
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
      shared_with: pack[AUDIT_PACK_FIELDS.shared_with as keyof AuditPack],
      signature_url: pack[AUDIT_PACK_FIELDS.signature_url as keyof AuditPack],
      signed_at: pack[AUDIT_PACK_FIELDS.signed_at as keyof AuditPack]
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

    // Get all tasks and filter by job (like tasks.ts pattern)
    const tasksResult = await client.listRecords<Task>(TABLES.TASKS, { limit: 200 })
    const jobTasks = tasksResult.items.filter(task =>
      recordBelongsToJob(task as unknown as Record<string, unknown>, body.job, TASK_FIELDS.job)
    )

    // Get all evidence and filter by task IDs
    const taskIds = jobTasks.map(t => t.id)
    const evidenceResult = await client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 500 })
    
    const allEvidence = evidenceResult.items.filter(ev => {
      const evTaskIds = (ev as unknown as Record<string, unknown>)[EVIDENCE_FIELDS.task] as string[] | string | undefined
      if (!evTaskIds) return false
      const ids = Array.isArray(evTaskIds) ? evTaskIds : [evTaskIds]
      return ids.some(id => taskIds.includes(id))
    })

    // Generate deterministic pack hash (must match verify.ts)
    const packHash = await generatePackHash(allEvidence as unknown as Record<string, unknown>[])

    // Create audit pack record with SmartSuite field IDs
    // Title includes date+time+seconds for uniqueness, hash prefix for audit traceability
    const generatedAt = new Date().toISOString()
    const dateTime = generatedAt.slice(0, 19).replace('T', ' ') // "2026-02-01 15:33:45"
    const packData: Record<string, unknown> = {
      title: `${clientName || jobTitle} - ${dateTime} [${packHash.slice(0, 8).toUpperCase()}]`,
      [AUDIT_PACK_FIELDS.job]: [body.job], // Linked records are arrays
      [AUDIT_PACK_FIELDS.generated_at]: generatedAt,
      [AUDIT_PACK_FIELDS.evidence_count]: allEvidence.length,
      [AUDIT_PACK_FIELDS.hash]: packHash
    }

    const auditPack = await client.createRecord<AuditPack>(TABLES.AUDIT_PACKS, packData as Partial<AuditPack>)

    // Count completed tasks
    const completedTasks = jobTasks.filter(t => {
      const status = (t as unknown as Record<string, unknown>)[TASK_FIELDS.status]
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

    // Get all tasks and filter by job
    const tasksResult = await client.listRecords<Task>(TABLES.TASKS, { limit: 200 })
    const jobTasks = tasksResult.items.filter(task =>
      recordBelongsToJob(task as unknown as Record<string, unknown>, jobId, TASK_FIELDS.job)
    )

    // Get all evidence
    const evidenceResult = await client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 500 })

    // Get evidence for each task
    const tasksWithEvidence = jobTasks.map(task => {
      const taskEvidence = evidenceResult.items.filter(ev =>
        evidenceBelongsToTask(ev as unknown as Record<string, unknown>, task.id)
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
        hash: pack[AUDIT_PACK_FIELDS.hash as keyof AuditPack],
        signature_url: pack[AUDIT_PACK_FIELDS.signature_url as keyof AuditPack],
        signed_at: pack[AUDIT_PACK_FIELDS.signed_at as keyof AuditPack]
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

// Save client signature to audit pack
auditPacks.put('/:id/signature', async (c) => {
  const auth = getAuth(c)
  const packId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    const body = await c.req.json() as { signature_url: string }
    
    if (!body.signature_url) {
      return c.json({ error: 'Missing required field: signature_url' }, 400)
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

    const updateData: Record<string, unknown> = {
      [AUDIT_PACK_FIELDS.signature_url]: body.signature_url,
      [AUDIT_PACK_FIELDS.signed_at]: new Date().toISOString()
    }

    const updatedPack = await client.updateRecord<AuditPack>(
      TABLES.AUDIT_PACKS,
      packId,
      updateData as Partial<AuditPack>
    )

    console.log('[Signature] Audit pack signed:', packId)

    return c.json({
      id: updatedPack.id,
      signature_url: updatedPack[AUDIT_PACK_FIELDS.signature_url as keyof AuditPack],
      signed_at: updatedPack[AUDIT_PACK_FIELDS.signed_at as keyof AuditPack]
    })
  } catch (error) {
    console.error('Error saving signature:', error)
    return c.json({ error: 'Failed to save signature' }, 500)
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

    // Get job details for email
    const job = await client.getRecord<Job>(TABLES.JOBS, jobId)
    const clientName = (job[JOB_FIELDS.client_name as keyof Job] as string) || 'Valued Customer'
    const jobAddress = (job[JOB_FIELDS.address as keyof Job] as string) || ''
    const postcode = (job[JOB_FIELDS.postcode as keyof Job] as string) || ''
    const fullAddress = postcode ? `${jobAddress}, ${postcode}` : jobAddress

    // Get user details for email signature
    const userRecordId = await getUserRecordId(auth.userId)
    let electricianName = 'Your Electrician'
    let electricianCompany: string | undefined
    let electricianEmail: string | undefined

    if (userRecordId) {
      const user = await client.getRecord<User>(TABLES.USERS, userRecordId)
      electricianName = (user[USER_FIELDS.full_name as keyof User] as string) || electricianName
      electricianCompany = user[USER_FIELDS.company_name as keyof User] as string | undefined
      electricianEmail = user[USER_FIELDS.email as keyof User] as string | undefined
    }

    // Send email
    const { sendAuditPackEmail } = await import('../lib/email.js')
    const verifyUrl = `https://workproof.co.uk/verify/${packId}`
    
    const emailResult = await sendAuditPackEmail({
      to: body.email,
      clientName,
      jobAddress: fullAddress,
      electricianName,
      electricianCompany,
      verifyUrl,
      packId,
      replyTo: electricianEmail
    })

    if (!emailResult.success) {
      console.error('[Share] Email failed:', emailResult.error)
      return c.json({ error: 'Failed to send email. Please try again.' }, 500)
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

    console.log('[Share] Audit pack shared:', packId, '→', body.email)

    return c.json({ 
      success: true,
      message: `Audit pack sent to ${body.email}`
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
