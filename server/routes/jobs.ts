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

// ============================================================================
// STATUS OPTION ID MAPPING
// SmartSuite single-select fields require option IDs, not labels
// ============================================================================
const JOB_STATUS_TO_OPTION_ID: Record<string, string> = {
  'draft': 'zjJD8',
  'in_progress': 'z3hUD',
  'completed': 'SDzSd',
  'archived': 'Dr8R1',
}

const OPTION_ID_TO_JOB_STATUS: Record<string, string> = {
  'zjJD8': 'draft',
  'z3hUD': 'in_progress',
  'SDzSd': 'completed',
  'Dr8R1': 'archived',
}

/**
 * Convert status label to SmartSuite option ID
 */
function getStatusOptionId(status: string): string {
  const normalized = status.toLowerCase().replace(/\s+/g, '_')
  return JOB_STATUS_TO_OPTION_ID[normalized] || JOB_STATUS_TO_OPTION_ID['draft']
}

/**
 * Extract status label from SmartSuite field value
 */
function extractStatus(value: unknown): string {
  if (!value) return 'draft'

  // If it's already a known status string
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().replace(/\s+/g, '_')
    if (JOB_STATUS_TO_OPTION_ID[normalized]) {
      return normalized
    }
    // Check if it's an option ID
    if (OPTION_ID_TO_JOB_STATUS[value]) {
      return OPTION_ID_TO_JOB_STATUS[value]
    }
    return 'draft'
  }

  // If it's an object with value/label
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>
    if (obj.value && typeof obj.value === 'string') {
      if (OPTION_ID_TO_JOB_STATUS[obj.value]) {
        return OPTION_ID_TO_JOB_STATUS[obj.value]
      }
    }
    if (obj.label && typeof obj.label === 'string') {
      return obj.label.toLowerCase().replace(/\s+/g, '_')
    }
  }

  return 'draft'
}

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

  // Handle created_at field
  const createdAtRaw = record[JOB_FIELDS.created_at]
  let createdAt: string | undefined
  if (createdAtRaw && typeof createdAtRaw === 'object' && 'date' in createdAtRaw) {
    createdAt = (createdAtRaw as { date: string }).date
  } else if (typeof createdAtRaw === 'string') {
    createdAt = createdAtRaw
  }

  // Extract status using the helper
  const status = extractStatus(record[JOB_FIELDS.status])

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
    createdAt: createdAt,
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
        const jobStatus = extractStatus(jobRecord[JOB_FIELDS.status])
        return jobStatus === status.toLowerCase().replace(/\s+/g, '_')
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

// Get job with all tasks and evidence (for pack preview - single API call)
jobs.get('/:id/pack-data', async (c) => {
  const auth = getAuth(c)
  const jobId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    const userRecordId = await getUserRecordId(auth.userId)
    if (!userRecordId) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Fetch everything in parallel - single round trip to SmartSuite
    const [job, tasksResult, evidenceResult] = await Promise.all([
      client.getRecord<Job>(TABLES.JOBS, jobId),
      client.listRecords<Task>(TABLES.TASKS, { limit: 500 }),
      client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 1000 })
    ])

    // Verify ownership
    if (!userOwnsJob(job as unknown as Record<string, unknown>, userRecordId)) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Get tasks for this job
    const jobTasks = getTasksForJob(tasksResult.items, jobId)
    const taskIds = jobTasks.map(t => t.id)

    // Get evidence for these tasks
    const jobEvidence = evidenceResult.items.filter(ev => {
      const evTaskIds = (ev as unknown as Record<string, unknown>)[EVIDENCE_FIELDS.task] as string[] | string | undefined
      if (!evTaskIds) return false
      const ids = Array.isArray(evTaskIds) ? evTaskIds : [evTaskIds]
      return ids.some(id => taskIds.includes(id))
    })

    // Transform job
    const transformedJob = transformJob(
      job as unknown as Record<string, unknown>,
      jobTasks.length,
      jobEvidence.length
    )

    // Transform tasks
    const transformedTasks = jobTasks.map(task => {
      const t = task as unknown as Record<string, unknown>
      return {
        id: t.id,
        jobId: jobId,
        taskType: t[TASK_FIELDS.task_type] || 'unknown',
        status: t[TASK_FIELDS.status] || 'pending',
        notes: t[TASK_FIELDS.notes] || '',
        order: t[TASK_FIELDS.order] || 0
      }
    })

    // Transform evidence
    const transformedEvidence = jobEvidence.map(ev => {
      const e = ev as unknown as Record<string, unknown>
      const taskField = e[EVIDENCE_FIELDS.task]
      const taskId = Array.isArray(taskField) ? taskField[0] : taskField

      // Handle date fields
      const capturedAtRaw = e[EVIDENCE_FIELDS.captured_at]
      const capturedAt = capturedAtRaw && typeof capturedAtRaw === 'object' && 'date' in capturedAtRaw
        ? (capturedAtRaw as { date: string }).date
        : capturedAtRaw

      // Ensure numeric types for coordinates
      const latRaw = e[EVIDENCE_FIELDS.latitude]
      const lngRaw = e[EVIDENCE_FIELDS.longitude]
      const accRaw = e[EVIDENCE_FIELDS.gps_accuracy]
      
      const latitude = latRaw ? parseFloat(String(latRaw)) : null
      const longitude = lngRaw ? parseFloat(String(lngRaw)) : null
      const gpsAccuracy = accRaw ? parseFloat(String(accRaw)) : null

      return {
        id: e.id,
        taskId: taskId,
        evidenceType: e[EVIDENCE_FIELDS.evidence_type] || 'unknown',
        photoStage: e[EVIDENCE_FIELDS.photo_stage] || null,
        photoUrl: e[EVIDENCE_FIELDS.photo_url] || null,
        photoHash: e[EVIDENCE_FIELDS.photo_hash] || null,
        latitude: latitude,
        longitude: longitude,
        gpsAccuracy: gpsAccuracy,
        capturedAt: capturedAt,
        notes: e[EVIDENCE_FIELDS.notes] || null
      }
    })

    return c.json({
      job: transformedJob,
      tasks: transformedTasks,
      evidence: transformedEvidence
    })
  } catch (error) {
    console.error('Error fetching pack data:', error)
    return c.json({ error: 'Failed to fetch pack data' }, 500)
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
    const status = body.status as string | undefined

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
    const createdAtDate = new Date().toISOString().split('T')[0]

    // Get status option ID (default to 'draft')
    const statusOptionId = getStatusOptionId(status || 'draft')

    // Create job with SmartSuite field IDs
    const jobData: Record<string, unknown> = {
      title: jobTitle,
      [JOB_FIELDS.user]: [userRecordId],
      [JOB_FIELDS.address]: address,
      [JOB_FIELDS.postcode]: postcode?.toUpperCase() || '',
      [JOB_FIELDS.client_name]: clientName,
      [JOB_FIELDS.status]: statusOptionId,
      [JOB_FIELDS.start_date]: formattedStartDate,
      [JOB_FIELDS.created_at]: createdAtDate
    }

    if (clientPhone) {
      // Format as UK number for SmartSuite phone field
      const formattedPhone = clientPhone.replace(/\s+/g, '')
      if (formattedPhone.startsWith('0')) {
        jobData[JOB_FIELDS.client_phone] = '+44' + formattedPhone.substring(1)
      } else if (!formattedPhone.startsWith('+')) {
        jobData[JOB_FIELDS.client_phone] = '+44' + formattedPhone
      } else {
        jobData[JOB_FIELDS.client_phone] = formattedPhone
      }
    }
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
    if (body.notes !== undefined) updateData[JOB_FIELDS.notes] = body.notes
    
    // Handle status with option ID conversion
    if (body.status !== undefined) {
      updateData[JOB_FIELDS.status] = getStatusOptionId(body.status as string)
    }
    
    // Handle date fields
    if (body.completion_date !== undefined) {
      updateData[JOB_FIELDS.completion_date] = { date: body.completion_date }
    }
    if (body.completionDate !== undefined) {
      updateData[JOB_FIELDS.completion_date] = { date: body.completionDate }
    }
    if (body.start_date !== undefined) {
      updateData[JOB_FIELDS.start_date] = { date: body.start_date }
    }
    if (body.startDate !== undefined) {
      updateData[JOB_FIELDS.start_date] = { date: body.startDate }
    }

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
    if (body.notes !== undefined) updateData[JOB_FIELDS.notes] = body.notes
    
    // Handle status with option ID conversion
    if (body.status !== undefined) {
      updateData[JOB_FIELDS.status] = getStatusOptionId(body.status as string)
    }
    
    // Handle date fields
    if (body.completion_date !== undefined) {
      updateData[JOB_FIELDS.completion_date] = { date: body.completion_date }
    }
    if (body.completionDate !== undefined) {
      updateData[JOB_FIELDS.completion_date] = { date: body.completionDate }
    }
    if (body.start_date !== undefined) {
      updateData[JOB_FIELDS.start_date] = { date: body.start_date }
    }
    if (body.startDate !== undefined) {
      updateData[JOB_FIELDS.start_date] = { date: body.startDate }
    }

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
