import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import { USER_FIELDS, JOB_FIELDS, TASK_FIELDS, EVIDENCE_FIELDS } from '../lib/smartsuite-fields.js'
import { authMiddleware, getAuth } from '../middleware/auth.js'
import { rateLimitMiddleware } from '../middleware/rateLimit.js'
import type { Job, Task, Evidence, User } from '../types/index.js'

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

// Helper: Get task IDs for a job
function getTasksForJob(tasks: Task[], jobId: string): Task[] {
  return tasks.filter(task => {
    const taskJobIds = (task as unknown as Record<string, unknown>)[TASK_FIELDS.job] as string[] | string | undefined
    if (!taskJobIds) return false
    const jobIds = Array.isArray(taskJobIds) ? taskJobIds : [taskJobIds]
    return jobIds.includes(jobId)
  })
}

// Helper: Get evidence count for tasks
function getEvidenceCountForTasks(evidence: Evidence[], taskIds: string[]): number {
  return evidence.filter(ev => {
    const evTaskIds = (ev as unknown as Record<string, unknown>)[EVIDENCE_FIELDS.task] as string[] | string | undefined
    if (!evTaskIds) return false
    const ids = Array.isArray(evTaskIds) ? evTaskIds : [evTaskIds]
    return ids.some(id => taskIds.includes(id))
  }).length
}

// Helper: Transform SmartSuite job record to readable format
function transformJob(
  record: Record<string, unknown>,
  taskCount: number = 0,
  evidenceCount: number = 0
): Record<string, unknown> {
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

  // Handle status field - may be string ID or object
  const statusRaw = record[JOB_FIELDS.status]
  let status = 'active'
  if (typeof statusRaw === 'string') {
    // Check if it's a known status or a SmartSuite ID
    const knownStatuses = ['draft', 'active', 'in_progress', 'completed', 'archived']
    if (knownStatuses.includes(statusRaw.toLowerCase())) {
      status = statusRaw.toLowerCase()
    }
  } else if (statusRaw && typeof statusRaw === 'object' && 'label' in statusRaw) {
    status = (statusRaw as { label: string }).label.toLowerCase().replace(/\s+/g, '_')
  }

  return {
    id: record.id,
    title: record.title,
    clientName: record[JOB_FIELDS.client_name] || record.title,
    address: record[JOB_FIELDS.address] || '',
    postcode: record[JOB_FIELDS.postcode] || '',
    clientPhone: record[JOB_FIELDS.client_phone],
    clientEmail: record[JOB_FIELDS.client_email],
    status: status,
    startDate: startDate,
    completionDate: record[JOB_FIELDS.completion_date],
    notes: record[JOB_FIELDS.notes],
    createdAt: record[JOB_FIELDS.created_at],
    taskCount: taskCount,
    evidenceCount: evidenceCount
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

    // Fetch jobs, tasks, and evidence in parallel for efficiency
    const [jobsResult, tasksResult, evidenceResult] = await Promise.all([
      client.listRecords<Job>(TABLES.JOBS, { limit: 100 }),
      client.listRecords<Task>(TABLES.TASKS, { limit: 500 }),
      client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 1000 })
    ])

    // Filter jobs by user ownership
    let filteredJobs = jobsResult.items.filter(item => 
      userOwnsJob(item as unknown as Record<string, unknown>, userRecordId)
    )

    // Apply status filter if provided
    if (status) {
      filteredJobs = filteredJobs.filter(item => {
        const jobRecord = item as unknown as Record<string, unknown>
        const statusRaw = jobRecord[JOB_FIELDS.status]
        if (typeof statusRaw === 'string') {
          return statusRaw === status
        } else if (statusRaw && typeof statusRaw === 'object' && 'label' in statusRaw) {
          return (statusRaw as { label: string }).label.toLowerCase() === status
        }
        return false
      })
    }

    // Sort by created_at descending
    filteredJobs.sort((a, b) => {
      const aRaw = (a as unknown as Record<string, unknown>)[JOB_FIELDS.created_at]
      const bRaw = (b as unknown as Record<string, unknown>)[JOB_FIELDS.created_at]
      const aDate = typeof aRaw === 'string' ? aRaw : (aRaw as { date?: string })?.date || ''
      const bDate = typeof bRaw === 'string' ? bRaw : (bRaw as { date?: string })?.date || ''
      return String(bDate).localeCompare(String(aDate))
    })

    // Transform each job with task and evidence counts
    const transformedItems = filteredJobs.map(job => {
      const jobRecord = job as unknown as Record<string, unknown>
      const jobId = jobRecord.id as string
      
      // Get tasks for this job
      const jobTasks = getTasksForJob(tasksResult.items, jobId)
      const taskIds = jobTasks.map(t => (t as unknown as Record<string, unknown>).id as string)
      
      // Get evidence count for these tasks
      const evidenceCount = getEvidenceCountForTasks(evidenceResult.items, taskIds)
      
      return transformJob(jobRecord, jobTasks.length, evidenceCount)
    })

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
    // Fetch job, tasks, and evidence in parallel
    const [job, tasksResult, evidenceResult] = await Promise.all([
      client.getRecord<Job>(TABLES.JOBS, jobId),
      client.listRecords<Task>(TABLES.TASKS, { limit: 500 }),
      client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 1000 })
    ])

    // Verify ownership
    const userRecordId = await getUserRecordId(auth.userId)
    if (!userRecordId || !userOwnsJob(job as unknown as Record<string, unknown>, userRecordId)) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Get tasks for this job
    const jobTasks = getTasksForJob(tasksResult.items, jobId)
    const taskIds = jobTasks.map(t => (t as unknown as Record<string, unknown>).id as string)
    
    // Get evidence count for these tasks
    const evidenceCount = getEvidenceCountForTasks(evidenceResult.items, taskIds)

    // Transform to readable format with counts
    const transformed = transformJob(
      job as unknown as Record<string, unknown>,
      jobTasks.length,
      evidenceCount
    )

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

    // Create unique title with timestamp
    const timestamp = Date.now()
    const jobTitle = title || `${clientName} - ${address} (${timestamp})`

    // Format date for SmartSuite
    const formattedStartDate = startDate || new Date().toISOString().split('T')[0]

    // Create job with SmartSuite field IDs
    const jobData: Record<string, unknown> = {
      title: jobTitle,
      [JOB_FIELDS.user]: [userRecordId],
      [JOB_FIELDS.address]: address,
      [JOB_FIELDS.postcode]: postcode?.toUpperCase() || '',
      [JOB_FIELDS.client_name]: clientName,
      [JOB_FIELDS.status]: 'active',
      [JOB_FIELDS.start_date]: formattedStartDate
    }

    if (clientPhone) jobData[JOB_FIELDS.client_phone] = clientPhone
    if (clientEmail) jobData[JOB_FIELDS.client_email] = clientEmail
    if (notes) jobData[JOB_FIELDS.notes] = notes

    const job = await client.createRecord<Job>(TABLES.JOBS, jobData as Omit<Job, 'id'>)

    // New job has 0 tasks and 0 evidence
    const transformed = transformJob(job as unknown as Record<string, unknown>, 0, 0)

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
    const existingJob = await client.getRecord<Job>(TABLES.JOBS, jobId)
    const userRecordId = await getUserRecordId(auth.userId)
    
    if (!userRecordId || !userOwnsJob(existingJob as unknown as Record<string, unknown>, userRecordId)) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const body = await c.req.json() as Record<string, unknown>

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

    // Fetch counts for the updated job
    const [tasksResult, evidenceResult] = await Promise.all([
      client.listRecords<Task>(TABLES.TASKS, { limit: 500 }),
      client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 1000 })
    ])

    const jobTasks = getTasksForJob(tasksResult.items, jobId)
    const taskIds = jobTasks.map(t => (t as unknown as Record<string, unknown>).id as string)
    const evidenceCount = getEvidenceCountForTasks(evidenceResult.items, taskIds)

    const transformed = transformJob(
      updatedJob as unknown as Record<string, unknown>,
      jobTasks.length,
      evidenceCount
    )

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
    const existingJob = await client.getRecord<Job>(TABLES.JOBS, jobId)
    const userRecordId = await getUserRecordId(auth.userId)
    
    if (!userRecordId || !userOwnsJob(existingJob as unknown as Record<string, unknown>, userRecordId)) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const body = await c.req.json() as Record<string, unknown>

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

    // Fetch counts for the updated job
    const [tasksResult, evidenceResult] = await Promise.all([
      client.listRecords<Task>(TABLES.TASKS, { limit: 500 }),
      client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 1000 })
    ])

    const jobTasks = getTasksForJob(tasksResult.items, jobId)
    const taskIds = jobTasks.map(t => (t as unknown as Record<string, unknown>).id as string)
    const evidenceCount = getEvidenceCountForTasks(evidenceResult.items, taskIds)

    const transformed = transformJob(
      updatedJob as unknown as Record<string, unknown>,
      jobTasks.length,
      evidenceCount
    )

    return c.json(transformed)
  } catch (error) {
    console.error('Error updating job:', error)
    return c.json({ error: 'Failed to update job' }, 500)
  }
})

// Delete job (hard delete)
jobs.delete('/:id', async (c) => {
  const auth = getAuth(c)
  const jobId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    const existingJob = await client.getRecord<Job>(TABLES.JOBS, jobId)
    const userRecordId = await getUserRecordId(auth.userId)
    
    if (!userRecordId || !userOwnsJob(existingJob as unknown as Record<string, unknown>, userRecordId)) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await client.deleteRecord(TABLES.JOBS, jobId)

    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting job:', error)
    return c.json({ error: 'Failed to delete job' }, 500)
  }
})

export default jobs
