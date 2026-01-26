import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
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
  const user = await client.findByField<User>(TABLES.USERS, 'clerk_id', clerkId)
  return user?.id || null
}

// Helper: Verify user owns the job
async function verifyJobOwnership(jobId: string, clerkId: string): Promise<boolean> {
  const client = getSmartSuiteClient()
  const userRecordId = await getUserRecordId(clerkId)
  
  if (!userRecordId) return false

  try {
    const job = await client.getRecord<Job>(TABLES.JOBS, jobId)
    return job.user === userRecordId
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

    const result = await client.listRecords<AuditPack>(TABLES.AUDIT_PACKS, {
      filter: {
        operator: 'and',
        fields: [{ field: 'job', comparison: 'is', value: jobId }]
      },
      sort: [{ field: 'generated_at', direction: 'desc' }]
    })

    return c.json({
      items: result.items,
      total: result.total
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

    // Verify ownership through job
    const isOwner = await verifyJobOwnership(pack.job, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    return c.json(pack)
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

    // Get all tasks for the job
    const tasksResult = await client.listRecords<Task>(TABLES.TASKS, {
      filter: {
        operator: 'and',
        fields: [{ field: 'job', comparison: 'is', value: body.job }]
      },
      sort: [{ field: 'order', direction: 'asc' }]
    })

    // Get all evidence for all tasks
    const taskIds = tasksResult.items.map(t => t.id)
    let allEvidence: Evidence[] = []

    for (const taskId of taskIds) {
      const evidenceResult = await client.listRecords<Evidence>(TABLES.EVIDENCE, {
        filter: {
          operator: 'and',
          fields: [{ field: 'task', comparison: 'is', value: taskId }]
        },
        sort: [{ field: 'captured_at', direction: 'asc' }]
      })
      allEvidence = allEvidence.concat(evidenceResult.items)
    }

    // Generate pack hash from all evidence hashes
    const evidenceHashes = allEvidence.map(e => e.photo_hash).sort().join('')
    const packHash = await generateHash(
      `${body.job}:${job.title}:${evidenceHashes}:${new Date().toISOString()}`
    )

    // Create audit pack record
    const packData: Omit<AuditPack, 'id'> = {
      job: body.job,
      generated_at: new Date().toISOString(),
      evidence_count: allEvidence.length,
      hash: packHash
    }

    const auditPack = await client.createRecord<AuditPack>(TABLES.AUDIT_PACKS, packData)

    // Return pack with summary
    return c.json({
      ...auditPack,
      summary: {
        jobTitle: job.title,
        address: job.address,
        postcode: job.postcode,
        clientName: job.client_name,
        taskCount: tasksResult.total,
        evidenceCount: allEvidence.length,
        completedTasks: tasksResult.items.filter(t => t.status === 'completed').length
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

    // Verify ownership through job
    const isOwner = await verifyJobOwnership(pack.job, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Get job details
    const job = await client.getRecord<Job>(TABLES.JOBS, pack.job)

    // Get user details
    const userRecordId = await getUserRecordId(auth.userId)
    const user = userRecordId 
      ? await client.getRecord<User>(TABLES.USERS, userRecordId)
      : null

    // Get all tasks
    const tasksResult = await client.listRecords<Task>(TABLES.TASKS, {
      filter: {
        operator: 'and',
        fields: [{ field: 'job', comparison: 'is', value: pack.job }]
      },
      sort: [{ field: 'order', direction: 'asc' }]
    })

    // Get evidence for each task
    const tasksWithEvidence = await Promise.all(
      tasksResult.items.map(async (task) => {
        const evidenceResult = await client.listRecords<Evidence>(TABLES.EVIDENCE, {
          filter: {
            operator: 'and',
            fields: [{ field: 'task', comparison: 'is', value: task.id }]
          },
          sort: [{ field: 'captured_at', direction: 'asc' }]
        })
        return {
          ...task,
          evidence: evidenceResult.items
        }
      })
    )

    return c.json({
      pack,
      job,
      user: user ? {
        full_name: user.full_name,
        company_name: user.company_name,
        niceic_number: user.niceic_number,
        email: user.email,
        phone: user.phone
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

    // Verify ownership
    const isOwner = await verifyJobOwnership(pack.job, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const updatedPack = await client.updateRecord<AuditPack>(
      TABLES.AUDIT_PACKS,
      packId,
      { downloaded_at: new Date().toISOString() }
    )

    return c.json(updatedPack)
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

    // Verify ownership
    const isOwner = await verifyJobOwnership(pack.job, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Update shared_with field
    await client.updateRecord<AuditPack>(
      TABLES.AUDIT_PACKS,
      packId,
      { shared_with: body.email }
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

    // Verify ownership
    const isOwner = await verifyJobOwnership(pack.job, auth.userId)
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
