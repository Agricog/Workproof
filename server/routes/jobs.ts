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

// Helper: Check if user owns the job
function userOwnsJob(job: Record<string, unknown>, userRecordId: string): boolean {
  const jobUserIds = job[JOB_FIELDS.user] as string[] | string | undefined
  if (!jobUserIds) return false
  const userIds = Array.isArray(jobUserIds) ? jobUserIds : [jobUserIds]
  return userIds.includes(userRecordId)
}

// Helper: Transform SmartSuite job record to readable format
function transformJob(record: Record<string, unknown>): Record<string, unknown> {
  // Handle date field - may be object with date property
  const startDateRaw = record[JOB_FIELDS.start_date]
  let startDate: string
  if (startDateRaw && typeof startDateRaw === 'object' && 'date' in startDateRaw) {
    startDate = (startDateRaw as { date: string }).date
  } else if (typeof startDateRaw === 'string') {
    startDate = startDateRaw
  } else {
    startDate = new Date().toISOString().split('T')[0]
  }

  return {
    id: record.id,
    title: record.title,
    clientName: record[JOB_FIELDS.client_name] || record.title,
    address: record[JOB_FIELDS.address] || '',
    postcode: record[JOB_FIELDS.postcode] || '',
    clientPhone: record[JOB_FIELDS.client_phone],
    clientEmail: record[JOB_FIELDS.client_email],
    status: record[JOB_FIELDS.status] || 'active',
    startDate: startDate,
    completionDate: record[JOB_FIELDS.completion_date],
    notes: record[JOB_FIELDS.notes],
    createdAt: record[JOB_FIELDS.created_at]
  }
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

    // Fetch all jobs (SmartSuite linked record fields don't support comparison operators)
    // Then filter in memory
    const result = await client.listRecords<Job>(TABLES.JOBS, {
      limit: 100
    })

    // Filter by user ownership in memory
    let filteredItems = result.items.filter(item => 
      userOwnsJob(item as unknown as Record<string, unknown>, userRecordId)
    )

    // Exclude archived jobs by default (unless specifically requested)
    if (status !== 'archived') {
      filteredItems = filteredItems.filter(item => {
        const jobStatus = (item as unknown as Record<string, unknown>)[JOB_FIELDS.status]
        return jobStatus !== 'archived'
      })
    }

    // Apply status filter if provided
    if (status) {
      filteredItems = filteredItems.filter(item => {
        const jobStatus = (item as unknown as Record<string, unknown>)[JOB_FIELDS.status]
        return jobStatus === status
      })
    }

    // Sort by created_at descending
    filteredItems.sort((a, b) => {
      const aRaw = (a as unknown as Record<string, unknown>)[JOB_FIELDS.created_at]
      const bRaw = (b as unknown as Record<string, unknown>)[JOB_FIELDS.created_at]
      // Handle both string and object date formats
      const aDate = typeof aRaw === 'string' ? aRaw : (aRaw as { date?: string })?.date || ''
      const bDate = typeof bRaw === 'string' ? bRaw : (bRaw as { date?: string })?.date || ''
      return String(bDate).localeCompare(String(aDate))
    })

    // Transform each job to readable format
    const transformedItems = filteredItems.map(item => 
      transformJob(item as unknown as Record<string, unknown>)
    )

    return c.json({
      items: transformedItems,
      total: transformedItems.length,
      limit: 100,
      offset: 0
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
    if (!userRecordId || !userOwnsJob(job as unknown as Record<string, unknown>, userRecordId)) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Transform to readable format
    const transformed = transformJob(job as unknown as Record<string, unknown>)

    return c.json(transformed)
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

    // Format date for SmartSuite (plain string format)
    const formattedStartDate = startDate || new Date().toISOString().split('T')[0]

    // Create job with SmartSuite field IDs
    // Linked record fields need array value
    const jobData: Record<string, unknown> = {
      title: jobTitle,
      [JOB_FIELDS.user]: [userRecordId],
      [JOB_FIELDS.address]: address,
      [JOB_FIELDS.postcode]: postcode?.toUpperCase() || '',
      [JOB_FIELDS.client_name]: clientName,
      [JOB_FIELDS.status]: 'active',
      [JOB_FIELDS.start_date]: formattedStartDate
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

    // Transform to readable format
    const transformed = transformJob(job as unknown as Record<string, unknown>)

    return c.json(transformed, 201)
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
    
    if (!userRecordId || !userOwnsJob(existingJob as unknown as Record<string, unknown>, userRecordId)) {
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

    // Transform to readable format
    const transformed = transformJob(updatedJob as unknown as Record<string, unknown>)

    return c.json(transformed)
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
    
    if (!userRecordId || !userOwnsJob(existingJob as unknown as Record<string, unknown>, userRecordId)) {
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

    // Transform to readable format
    const transformed = transformJob(updatedJob as unknown as Record<string, unknown>)

    return c.json(transformed)
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
    
    if (!userRecordId || !userOwnsJob(existingJob as unknown as Record<string, unknown>, userRecordId)) {
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
