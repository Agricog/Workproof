import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import { USER_FIELDS, JOB_FIELDS } from '../lib/smartsuite-fields.js'
import { authMiddleware, getAuth } from '../middleware/auth.js'
import { rateLimitMiddleware } from '../middleware/rateLimit.js'
import type { Job, User } from '../types/index.js'

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
    // Note: Linked record fields need 'has_any' comparison with array value
    const filterFields: Array<{ field: string; comparison: string; value: unknown }> = [
      { field: JOB_FIELDS.user, comparison: 'has_any', value: [userRecordId] }
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

// Also support query param for job_id filter (used by frontend)
jobs.get('/', async (c) => {
  const auth = getAuth(c)
  const client = getSmartSuiteClient()
  const jobId = c.req.query('job_id')

  // If job_id provided, return single job
  if (jobId) {
    try {
      const job = await client.getRecord<Job>(TABLES.JOBS, jobId)
      const userRecordId = await getUserRecordId(auth.userId)
      
      // Check ownership - linked record field returns array
      const jobUserIds = job[JOB_FIELDS.user as keyof Job] as string[] | string
      const userIds = Array.isArray(jobUserIds) ? jobUserIds : [jobUserIds]
      
      if (!userIds.includes(userRecordId || '')) {
        return c.json({ error: 'Forbidden' }, 403)
      }

      return c.json(job)
    } catch (error) {
      console.error('Error fetching job:', error)
      return c.json({ error: 'Failed to fetch job' }, 500)
    }
  }

  // Default: list all jobs (handled by first route)
})

// Get single job by ID
jobs.get('/:id', async (c) => {
  const auth = getAuth(c)
  const jobId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    const job = await client.getRecord<Job>(TABLES.JOBS, jobId)

    // Verify ownership - linked record field may return array
    const userRecordId = await getUserRecordId(auth.userId)
    const jobUserIds = job[JOB_FIELDS.user as keyof Job] as string[] | string
    const userIds = Array.isArray(jobUserIds) ? jobUserIds : [jobUserIds]
    
    if (!userIds.includes(userRecordId || '')) {
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

    // Parse body as generic object to handle both camelCase and snake_case
    const body = await c.req.json() as Record<string, unknown>

    // Get values supporting both camelCase and snake_case
    const address = body.address as string | undefined
    const clientName = (body.clientName || body.client_name) as string | undefined
    const startDate = (body.startDate || body.start_date) as string | undefined
    const postcode = body.postcode as string | undefined
    const title = body.title as string | undefined
    const clientPhone = (body.clientPhone || body.client_phone) as string | undefined
    const clientEmail = (body.clientEmail || body.client_email) as string | undefined
    const notes = body.notes as string | undefined

    // Validate required fields
    if (!address) {
      return c.json({ error: 'Missing required field: address' }, 400)
    }
    if (!clientName) {
      return c.json({ error: 'Missing required field: client_name' }, 400)
    }

    // Create unique title with timestamp to avoid SmartSuite unique constraint
    const timestamp = Date.now()
    const jobTitle = title || `${clientName} - ${address} (${timestamp})`

    // Create job with SmartSuite field IDs
    // Linked record fields need array value
    const jobData: Record<string, unknown> = {
      title: jobTitle,
      [JOB_FIELDS.user]: [userRecordId],
      [JOB_FIELDS.address]: address,
      [JOB_FIELDS.postcode]: postcode?.toUpperCase() || '',
      [JOB_FIELDS.client_name]: clientName,
      [JOB_FIELDS.status]: 'active',
      [JOB_FIELDS.start_date]: startDate || new Date().toISOString().split('T')[0]
    }

    // Add optional fields if provided
    if (clientPhone) {
      jobData[JOB_FIELDS.client_phone] = clientPhone
    }
    if (clientEmail) {
      jobData[JOB_FIELDS.client_email] = clientEmail
    }
    if (notes) {
      jobData[JOB_FIELDS.notes] = notes
    }

    const job = await client.createRecord<Job>(TABLES.JOBS, jobData as Omit<Job, 'id'>)

    return c.json(job, 201)
  } catch (error) {
    console.error('Error creating job:', error)
    return c.json({ error: 'Failed to create job' }, 500)
  }
})

// Update job (PATCH)
jobs.patch('/:id', async (c) => {
  const auth = getAuth(c)
  const jobId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    // Get existing job and verify ownership
    const existingJob = await client.getRecord<Job>(TABLES.JOBS, jobId)
    const userRecordId = await getUserRecordId(auth.userId)
    
    const jobUserIds = existingJob[JOB_FIELDS.user as keyof Job] as string[] | string
    const userIds = Array.isArray(jobUserIds) ? jobUserIds : [jobUserIds]
    
    if (!userIds.includes(userRecordId || '')) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const body = await c.req.json() as Record<string, unknown>

    // Map request fields to SmartSuite field IDs (support both cases)
    const updateData: Record<string, unknown> = {}
    
    if (body.title !== undefined) updateData.title = body.title
    if (body.address !== undefined) updateData[JOB_FIELDS.address] = body.address
    if (body.postcode !== undefined) updateData[JOB_FIELDS.postcode] = (body.postcode as string).toUpperCase()
    if (body.client_name !== undefined) updateData[JOB_FIELDS.client_name] = body.client_name
    if (body.clientName !== undefined) updateData[JOB_FIELDS.client_name] = body.clientName
    if (body.client_phone !== undefined) updateData[JOB_FIELDS.client_phone] = body.client_phone
    if (body.clientPhone !== undefined) updateData[JOB_FIELDS.client_phone] = body.clientPhone
    if (body.client_email !== undefined) updateData[JOB_FIELDS.client_email] = body.client_email
    if (body.clientEmail !== undefined) updateData[JOB_FIELDS.client_email] = body.clientEmail
    if (body.status !== undefined) updateData[JOB_FIELDS.status] = body.status
    if (body.completion_date !== undefined) updateData[JOB_FIELDS.completion_date] = body.completion_date
    if (body.completionDate !== undefined) updateData[JOB_FIELDS.completion_date] = body.completionDate
    if (body.notes !== undefined) updateData[JOB_FIELDS.notes] = body.notes

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

// Update job (PUT)
jobs.put('/:id', async (c) => {
  const auth = getAuth(c)
  const jobId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    // Get existing job and verify ownership
    const existingJob = await client.getRecord<Job>(TABLES.JOBS, jobId)
    const userRecordId = await getUserRecordId(auth.userId)
    
    const jobUserIds = existingJob[JOB_FIELDS.user as keyof Job] as string[] | string
    const userIds = Array.isArray(jobUserIds) ? jobUserIds : [jobUserIds]
    
    if (!userIds.includes(userRecordId || '')) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const body = await c.req.json() as Record<string, unknown>

    // Map request fields to SmartSuite field IDs (support both cases)
    const updateData: Record<string, unknown> = {}
    
    if (body.title !== undefined) updateData.title = body.title
    if (body.address !== undefined) updateData[JOB_FIELDS.address] = body.address
    if (body.postcode !== undefined) updateData[JOB_FIELDS.postcode] = (body.postcode as string).toUpperCase()
    if (body.client_name !== undefined) updateData[JOB_FIELDS.client_name] = body.client_name
    if (body.clientName !== undefined) updateData[JOB_FIELDS.client_name] = body.clientName
    if (body.client_phone !== undefined) updateData[JOB_FIELDS.client_phone] = body.client_phone
    if (body.clientPhone !== undefined) updateData[JOB_FIELDS.client_phone] = body.clientPhone
    if (body.client_email !== undefined) updateData[JOB_FIELDS.client_email] = body.client_email
    if (body.clientEmail !== undefined) updateData[JOB_FIELDS.client_email] = body.clientEmail
    if (body.status !== undefined) updateData[JOB_FIELDS.status] = body.status
    if (body.completion_date !== undefined) updateData[JOB_FIELDS.completion_date] = body.completion_date
    if (body.completionDate !== undefined) updateData[JOB_FIELDS.completion_date] = body.completionDate
    if (body.notes !== undefined) updateData[JOB_FIELDS.notes] = body.notes

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
    
    const jobUserIds = existingJob[JOB_FIELDS.user as keyof Job] as string[] | string
    const userIds = Array.isArray(jobUserIds) ? jobUserIds : [jobUserIds]
    
    if (!userIds.includes(userRecordId || '')) {
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
