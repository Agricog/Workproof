import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import { USER_FIELDS, JOB_FIELDS } from '../lib/smartsuite-fields.js'
import { authMiddleware, getAuth } from '../middleware/auth.js'
import { rateLimitMiddleware } from '../middleware/rateLimit.js'
import type { Job, User, CreateJobRequest, UpdateJobRequest } from '../types/index.js'

const jobs = new Hono()

// Apply middleware to all routes
jobs.use('*', rateLimitMiddleware)
jobs.use('*', authMiddleware)

// Helper: Get user record ID from Clerk ID
async function getUserRecordId(clerkId: string): Promise<string | null> {
  const client = getSmartSuiteClient()
  const user = await client.findByField<User>(TABLES.USERS, USER_FIELDS.clerk_id, clerkId)
  return user?.id || null
}

// List all jobs for current user
jobs.get('/', async (c) => {
  const auth = getAuth(c)
  const client = getSmartSuiteClient()

  try {
    const userRecordId = await getUserRecordId(auth.userId)
    if (!userRecordId) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Get query params for filtering
    const status = c.req.query('status')
    const limit = parseInt(c.req.query('limit') || '50')
    const offset = parseInt(c.req.query('offset') || '0')

    // Build filter using field IDs
    const filterFields: Array<{ field: string; comparison: string; value: unknown }> = [
      { field: JOB_FIELDS.user, comparison: 'is', value: userRecordId }
    ]

    if (status) {
      filterFields.push({ field: JOB_FIELDS.status, comparison: 'is', value: status })
    }

    const result = await client.listRecords<Job>(TABLES.JOBS, {
      filter: {
        operator: 'and',
        fields: filterFields
      },
      sort: [{ field: JOB_FIELDS.created_at, direction: 'desc' }],
      limit,
      offset
    })

    return c.json({
      items: result.items,
      total: result.total,
      limit,
      offset
    })
  } catch (error) {
    console.error('Error listing jobs:', error)
    return c.json({ error: 'Failed to list jobs' }, 500)
  }
})

// Get single job by ID
jobs.get('/:id', async (c) => {
  const auth = getAuth(c)
  const jobId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    const job = await client.getRecord<Job>(TABLES.JOBS, jobId)

    // Verify ownership - check using field ID
    const userRecordId = await getUserRecordId(auth.userId)
    const jobUserId = job[JOB_FIELDS.user as keyof Job]
    
    if (jobUserId !== userRecordId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    return c.json(job)
  } catch (error) {
    console.error('Error fetching job:', error)
    return c.json({ error: 'Failed to fetch job' }, 500)
  }
})

// Create new job
jobs.post('/', async (c) => {
  const auth = getAuth(c)
  const client = getSmartSuiteClient()

  try {
    const userRecordId = await getUserRecordId(auth.userId)
    if (!userRecordId) {
      return c.json({ error: 'User not found' }, 404)
    }

    const body = await c.req.json() as CreateJobRequest

    // Validate required fields (using request field names)
    if (!body.address) {
      return c.json({ error: 'Missing required field: address' }, 400)
    }
    if (!body.clientName && !body.client_name) {
      return c.json({ error: 'Missing required field: client_name' }, 400)
    }

    // Create job with SmartSuite field IDs
    const jobData: Record<string, unknown> = {
      title: body.title || `${body.clientName || body.client_name} - ${body.address}`,
      [JOB_FIELDS.user]: userRecordId,
      [JOB_FIELDS.address]: body.address,
      [JOB_FIELDS.postcode]: body.postcode?.toUpperCase() || '',
      [JOB_FIELDS.client_name]: body.clientName || body.client_name,
      [JOB_FIELDS.status]: 'active',
      [JOB_FIELDS.start_date]: body.startDate || body.start_date || new Date().toISOString().split('T')[0]
    }

    // Add optional fields if provided
    if (body.client_phone || body.clientPhone) {
      jobData[JOB_FIELDS.client_phone] = body.client_phone || body.clientPhone
    }
    if (body.client_email || body.clientEmail) {
      jobData[JOB_FIELDS.client_email] = body.client_email || body.clientEmail
    }
    if (body.notes) {
      jobData[JOB_FIELDS.notes] = body.notes
    }

    const job = await client.createRecord<Job>(TABLES.JOBS, jobData as Omit<Job, 'id'>)

    return c.json(job, 201)
  } catch (error) {
    console.error('Error creating job:', error)
    return c.json({ error: 'Failed to create job' }, 500)
  }
})

// Update job
jobs.patch('/:id', async (c) => {
  const auth = getAuth(c)
  const jobId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    // Get existing job and verify ownership
    const existingJob = await client.getRecord<Job>(TABLES.JOBS, jobId)
    const userRecordId = await getUserRecordId(auth.userId)
    
    const jobUserId = existingJob[JOB_FIELDS.user as keyof Job]
    if (jobUserId !== userRecordId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const body = await c.req.json() as UpdateJobRequest

    // Map request fields to SmartSuite field IDs
    const fieldMapping: Record<string, string> = {
      title: 'title',
      address: JOB_FIELDS.address,
      postcode: JOB_FIELDS.postcode,
      client_name: JOB_FIELDS.client_name,
      clientName: JOB_FIELDS.client_name,
      client_phone: JOB_FIELDS.client_phone,
      clientPhone: JOB_FIELDS.client_phone,
      client_email: JOB_FIELDS.client_email,
      clientEmail: JOB_FIELDS.client_email,
      status: JOB_FIELDS.status,
      completion_date: JOB_FIELDS.completion_date,
      completionDate: JOB_FIELDS.completion_date,
      notes: JOB_FIELDS.notes
    }

    const updateData: Record<string, unknown> = {}
    
    for (const [requestField, smartsuiteField] of Object.entries(fieldMapping)) {
      const value = body[requestField as keyof UpdateJobRequest]
      if (value !== undefined) {
        // Uppercase postcode
        if (requestField === 'postcode' && typeof value === 'string') {
          updateData[smartsuiteField] = value.toUpperCase()
        } else {
          updateData[smartsuiteField] = value
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'No valid fields to update' }, 400)
    }

    const updatedJob = await client.updateRecord<Job>(
      TABLES.JOBS,
      jobId,
      updateData as Partial<Job>
    )

    return c.json(updatedJob)
  } catch (error) {
    console.error('Error updating job:', error)
    return c.json({ error: 'Failed to update job' }, 500)
  }
})

// Also support PUT for updates
jobs.put('/:id', async (c) => {
  const auth = getAuth(c)
  const jobId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    // Get existing job and verify ownership
    const existingJob = await client.getRecord<Job>(TABLES.JOBS, jobId)
    const userRecordId = await getUserRecordId(auth.userId)
    
    const jobUserId = existingJob[JOB_FIELDS.user as keyof Job]
    if (jobUserId !== userRecordId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const body = await c.req.json() as UpdateJobRequest

    // Map request fields to SmartSuite field IDs
    const fieldMapping: Record<string, string> = {
      title: 'title',
      address: JOB_FIELDS.address,
      postcode: JOB_FIELDS.postcode,
      client_name: JOB_FIELDS.client_name,
      clientName: JOB_FIELDS.client_name,
      client_phone: JOB_FIELDS.client_phone,
      clientPhone: JOB_FIELDS.client_phone,
      client_email: JOB_FIELDS.client_email,
      clientEmail: JOB_FIELDS.client_email,
      status: JOB_FIELDS.status,
      completion_date: JOB_FIELDS.completion_date,
      completionDate: JOB_FIELDS.completion_date,
      notes: JOB_FIELDS.notes
    }

    const updateData: Record<string, unknown> = {}
    
    for (const [requestField, smartsuiteField] of Object.entries(fieldMapping)) {
      const value = body[requestField as keyof UpdateJobRequest]
      if (value !== undefined) {
        // Uppercase postcode
        if (requestField === 'postcode' && typeof value === 'string') {
          updateData[smartsuiteField] = value.toUpperCase()
        } else {
          updateData[smartsuiteField] = value
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'No valid fields to update' }, 400)
    }

    const updatedJob = await client.updateRecord<Job>(
      TABLES.JOBS,
      jobId,
      updateData as Partial<Job>
    )

    return c.json(updatedJob)
  } catch (error) {
    console.error('Error updating job:', error)
    return c.json({ error: 'Failed to update job' }, 500)
  }
})

// Delete job (soft delete - set status to archived)
jobs.delete('/:id', async (c) => {
  const auth = getAuth(c)
  const jobId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    // Get existing job and verify ownership
    const existingJob = await client.getRecord<Job>(TABLES.JOBS, jobId)
    const userRecordId = await getUserRecordId(auth.userId)
    
    const jobUserId = existingJob[JOB_FIELDS.user as keyof Job]
    if (jobUserId !== userRecordId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Soft delete by setting status to archived
    await client.updateRecord<Job>(TABLES.JOBS, jobId, {
      [JOB_FIELDS.status]: 'archived'
    } as Partial<Job>)

    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting job:', error)
    return c.json({ error: 'Failed to delete job' }, 500)
  }
})

export default jobs
