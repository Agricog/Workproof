import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
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
  const user = await client.findByField<User>(TABLES.USERS, 'clerk_id', clerkId)
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

    // Build filter
    const filterFields: Array<{ field: string; comparison: string; value: unknown }> = [
      { field: 'user', comparison: 'is', value: userRecordId }
    ]

    if (status) {
      filterFields.push({ field: 'status', comparison: 'is', value: status })
    }

    const result = await client.listRecords<Job>(TABLES.JOBS, {
      filter: {
        operator: 'and',
        fields: filterFields
      },
      sort: [{ field: 'created_at', direction: 'desc' }],
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

    // Verify ownership
    const userRecordId = await getUserRecordId(auth.userId)
    if (job.user !== userRecordId) {
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

    // Validate required fields
    const requiredFields = ['title', 'address', 'postcode', 'client_name', 'start_date']
    for (const field of requiredFields) {
      if (!body[field as keyof CreateJobRequest]) {
        return c.json({ error: `Missing required field: ${field}` }, 400)
      }
    }

    // Create job with defaults
    const jobData: Omit<Job, 'id'> = {
      user: userRecordId,
      title: body.title,
      address: body.address,
      postcode: body.postcode.toUpperCase(),
      client_name: body.client_name,
      client_phone: body.client_phone || undefined,
      client_email: body.client_email || undefined,
      status: 'draft',
      start_date: body.start_date,
      notes: body.notes || undefined
    }

    const job = await client.createRecord<Job>(TABLES.JOBS, jobData)

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
    if (existingJob.user !== userRecordId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const body = await c.req.json() as UpdateJobRequest

    // Only allow updating specific fields
    const allowedFields = [
      'title',
      'address',
      'postcode',
      'client_name',
      'client_phone',
      'client_email',
      'status',
      'completion_date',
      'notes'
    ]

    const updateData: Partial<Job> = {}
    for (const field of allowedFields) {
      if (body[field as keyof UpdateJobRequest] !== undefined) {
        let value = body[field as keyof UpdateJobRequest]
        
        // Uppercase postcode
        if (field === 'postcode' && typeof value === 'string') {
          value = value.toUpperCase()
        }
        
        updateData[field as keyof Job] = value
      }
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'No valid fields to update' }, 400)
    }

    const updatedJob = await client.updateRecord<Job>(
      TABLES.JOBS,
      jobId,
      updateData
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
    if (existingJob.user !== userRecordId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Soft delete by setting status to archived
    await client.updateRecord<Job>(TABLES.JOBS, jobId, {
      status: 'archived'
    })

    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting job:', error)
    return c.json({ error: 'Failed to delete job' }, 500)
  }
})

export default jobs
