import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import { 
  USER_FIELDS, 
  JOB_FIELDS, 
  TASK_FIELDS 
} from '../lib/smartsuite-fields.js'
import { authMiddleware, getAuth } from '../middleware/auth.js'
import { rateLimitMiddleware } from '../middleware/rateLimit.js'
import type { Task, Job, User } from '../types/index.js'

const tasks = new Hono()

// Apply middleware to all routes
tasks.use('*', rateLimitMiddleware)
tasks.use('*', authMiddleware)

// Simple in-memory cache for user record IDs (clerk_id -> smartsuite_id)
const userIdCache = new Map<string, { id: string; timestamp: number }>()
const USER_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Helper: Retry wrapper for SmartSuite calls
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 2,
  delayMs: number = 500
): Promise<T> {
  let lastError: Error | null = null
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      console.error(`[TASKS] Retry ${i + 1}/${retries + 1} failed:`, error)
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)))
      }
    }
  }
  throw lastError
}

// Helper: Get user record ID from Clerk ID (with caching)
async function getUserRecordId(clerkId: string): Promise<string | null> {
  // Check cache first
  const cached = userIdCache.get(clerkId)
  if (cached && Date.now() - cached.timestamp < USER_CACHE_TTL) {
    return cached.id
  }
  
  const client = getSmartSuiteClient()
  
  try {
    const user = await withRetry(() => 
      client.findByField<User>(TABLES.USERS, USER_FIELDS.clerk_id, clerkId)
    )
    
    if (user?.id) {
      userIdCache.set(clerkId, { id: user.id, timestamp: Date.now() })
      return user.id
    }
    return null
  } catch (error) {
    console.error('[TASKS] Error finding user:', error)
    return null
  }
}

// Helper: Check if user owns job
function userOwnsJob(job: Record<string, unknown>, userRecordId: string): boolean {
  const jobUserIds = job[JOB_FIELDS.user] as string[] | string | undefined
  
  console.log('[TASKS] Job user field value:', jobUserIds)
  console.log('[TASKS] Checking against userRecordId:', userRecordId)
  
  if (!jobUserIds) {
    console.error('[TASKS] Job has no user field')
    return false
  }
  
  const userIds = Array.isArray(jobUserIds) ? jobUserIds : [jobUserIds]
  const isOwner = userIds.includes(userRecordId)
  
  console.log('[TASKS] User owns job:', isOwner)
  return isOwner
}

// Helper: Verify user owns the job
async function verifyJobOwnership(jobId: string, clerkId: string): Promise<boolean> {
  console.log('[TASKS] verifyJobOwnership called - jobId:', jobId, 'clerkId:', clerkId)
  
  const client = getSmartSuiteClient()
  const userRecordId = await getUserRecordId(clerkId)
  
  if (!userRecordId) {
    console.error('[TASKS] Failed to get user record ID - returning 403')
    return false
  }

  try {
    const job = await withRetry(() => 
      client.getRecord<Job>(TABLES.JOBS, jobId)
    )
    
    console.log('[TASKS] Fetched job for ownership check')
    return userOwnsJob(job as unknown as Record<string, unknown>, userRecordId)
  } catch (error) {
    console.error('[TASKS] Error fetching job for ownership:', error)
    return false
  }
}

// Helper: Check if task belongs to job
function taskBelongsToJob(task: Record<string, unknown>, jobId: string): boolean {
  const taskJobIds = task[TASK_FIELDS.job] as string[] | string | undefined
  if (!taskJobIds) return false
  const jobIds = Array.isArray(taskJobIds) ? taskJobIds : [taskJobIds]
  return jobIds.includes(jobId)
}

// Helper: Extract status value from SmartSuite format
function extractStatus(statusValue: unknown): string {
  if (!statusValue) return 'pending'
  
  // If it's an object with a label property
  if (typeof statusValue === 'object' && statusValue !== null) {
    const obj = statusValue as Record<string, unknown>
    if (obj.label && typeof obj.label === 'string') {
      return obj.label.toLowerCase().replace(/\s+/g, '_')
    }
    if (obj.value && typeof obj.value === 'string') {
      // Check if value looks like a field ID (5-6 char alphanumeric)
      if (/^[a-zA-Z0-9]{5,6}$/.test(obj.value)) {
        return 'pending'
      }
      return obj.value.toLowerCase().replace(/\s+/g, '_')
    }
  }
  
  // If it's a string
  if (typeof statusValue === 'string') {
    // Check if it looks like a SmartSuite field ID
    if (/^[a-zA-Z0-9]{5,6}$/.test(statusValue)) {
      return 'pending'
    }
    return statusValue.toLowerCase().replace(/\s+/g, '_')
  }
  
  return 'pending'
}

// Helper: Extract task type value
function extractTaskType(typeValue: unknown): string {
  if (!typeValue) return 'general'
  
  if (typeof typeValue === 'object' && typeValue !== null) {
    const obj = typeValue as Record<string, unknown>
    if (obj.label && typeof obj.label === 'string') {
      return obj.label.toLowerCase().replace(/\s+/g, '_')
    }
    if (obj.value && typeof obj.value === 'string') {
      if (/^[a-zA-Z0-9]{5,6}$/.test(obj.value)) {
        return 'general'
      }
      return obj.value.toLowerCase().replace(/\s+/g, '_')
    }
  }
  
  if (typeof typeValue === 'string') {
    if (/^[a-zA-Z0-9]{5,6}$/.test(typeValue)) {
      return 'general'
    }
    return typeValue.toLowerCase().replace(/\s+/g, '_')
  }
  
  return 'general'
}

// Helper: Transform SmartSuite task record to readable format
function transformTask(record: Record<string, unknown>): Record<string, unknown> {
  const jobValue = record[TASK_FIELDS.job] as string[] | string | undefined
  const jobId = Array.isArray(jobValue) ? jobValue[0] : jobValue

  const orderValue = record[TASK_FIELDS.order]
  const order = typeof orderValue === 'string' ? parseFloat(orderValue) : (orderValue || 0)

  return {
    id: record.id,
    title: record.title,
    jobId: jobId || '',
    taskType: extractTaskType(record[TASK_FIELDS.task_type]),
    status: extractStatus(record[TASK_FIELDS.status]),
    order: order,
    notes: record[TASK_FIELDS.notes] || '',
    startedAt: record[TASK_FIELDS.started_at],
    completedAt: record[TASK_FIELDS.completed_at],
    evidenceCount: 0,
    requiredEvidenceCount: 5
  }
}

// List tasks - supports both /tasks?job_id=xxx and /tasks/job/:jobId
tasks.get('/', async (c) => {
  const auth = getAuth(c)
  const jobId = c.req.query('job_id')
  const client = getSmartSuiteClient()

  console.log('[TASKS] GET / called - job_id:', jobId)

  if (!jobId) {
    return c.json({ error: 'Missing job_id parameter' }, 400)
  }

  try {
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      console.error('[TASKS] Ownership check failed for GET /')
      return c.json({ error: 'Forbidden' }, 403)
    }

    const result = await withRetry(() => 
      client.listRecords<Task>(TABLES.TASKS, { limit: 200 })
    )

    let filteredItems = result.items.filter(item =>
      taskBelongsToJob(item as unknown as Record<string, unknown>, jobId)
    )

    const status = c.req.query('status')
    if (status) {
      filteredItems = filteredItems.filter(item => {
        const taskStatus = extractStatus((item as unknown as Record<string, unknown>)[TASK_FIELDS.status])
        return taskStatus === status
      })
    }

    filteredItems.sort((a, b) => {
      const aOrder = ((a as unknown as Record<string, unknown>)[TASK_FIELDS.order] as number) || 0
      const bOrder = ((b as unknown as Record<string, unknown>)[TASK_FIELDS.order] as number) || 0
      return aOrder - bOrder
    })

    const transformedItems = filteredItems.map(item =>
      transformTask(item as unknown as Record<string, unknown>)
    )

    console.log('[TASKS] Returning', transformedItems.length, 'tasks')
    return c.json({
      items: transformedItems,
      total: transformedItems.length
    })
  } catch (error) {
    console.error('[TASKS] Error listing tasks:', error)
    return c.json({ error: 'Failed to list tasks' }, 500)
  }
})

// List tasks for a job (alternative route)
tasks.get('/job/:jobId', async (c) => {
  const auth = getAuth(c)
  const jobId = c.req.param('jobId')
  const client = getSmartSuiteClient()

  console.log('[TASKS] GET /job/:jobId called - jobId:', jobId)

  try {
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      console.error('[TASKS] Ownership check failed for GET /job/:jobId')
      return c.json({ error: 'Forbidden' }, 403)
    }

    const result = await withRetry(() =>
      client.listRecords<Task>(TABLES.TASKS, { limit: 200 })
    )

    let filteredItems = result.items.filter(item =>
      taskBelongsToJob(item as unknown as Record<string, unknown>, jobId)
    )

    const status = c.req.query('status')
    if (status) {
      filteredItems = filteredItems.filter(item => {
        const taskStatus = extractStatus((item as unknown as Record<string, unknown>)[TASK_FIELDS.status])
        return taskStatus === status
      })
    }

    filteredItems.sort((a, b) => {
      const aOrder = ((a as unknown as Record<string, unknown>)[TASK_FIELDS.order] as number) || 0
      const bOrder = ((b as unknown as Record<string, unknown>)[TASK_FIELDS.order] as number) || 0
      return aOrder - bOrder
    })

    const transformedItems = filteredItems.map(item =>
      transformTask(item as unknown as Record<string, unknown>)
    )

    return c.json({
      items: transformedItems,
      total: transformedItems.length
    })
  } catch (error) {
    console.error('[TASKS] Error listing tasks:', error)
    return c.json({ error: 'Failed to list tasks' }, 500)
  }
})

// Get single task by ID
tasks.get('/:id', async (c) => {
  const auth = getAuth(c)
  const taskId = c.req.param('id')
  const client = getSmartSuiteClient()

  console.log('[TASKS] GET /:id called - taskId:', taskId, 'userId:', auth.userId)

  try {
    const task = await withRetry(() =>
      client.getRecord<Task>(TABLES.TASKS, taskId)
    )

    console.log('[TASKS] Task fetched successfully')

    const taskJobIds = task[TASK_FIELDS.job as keyof Task] as string[] | string | undefined
    const jobId = Array.isArray(taskJobIds) ? taskJobIds[0] : taskJobIds

    console.log('[TASKS] Extracted jobId from task:', jobId)

    if (!jobId) {
      console.error('[TASKS] Task has no associated job')
      return c.json({ error: 'Task has no associated job' }, 400)
    }

    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      console.error('[TASKS] Ownership verification failed for task:', taskId)
      return c.json({ error: 'Forbidden' }, 403)
    }

    const transformed = transformTask(task as unknown as Record<string, unknown>)
    console.log('[TASKS] Returning transformed task')

    return c.json(transformed)
  } catch (error) {
    console.error('[TASKS] Error fetching task:', error)
    return c.json({ error: 'Failed to fetch task' }, 500)
  }
})

// Create new task
tasks.post('/', async (c) => {
  const auth = getAuth(c)
  const client = getSmartSuiteClient()

  console.log('[TASKS] POST / called')

  try {
    const body = await c.req.json() as Record<string, unknown>

    const jobId = (body.job || body.job_id) as string
    const taskType = (body.task_type || body.taskType) as string

    if (!jobId || !taskType) {
      return c.json({ error: 'Missing required fields: job_id, task_type' }, 400)
    }

    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      console.error('[TASKS] Ownership check failed for POST /')
      return c.json({ error: 'Forbidden' }, 403)
    }

    const tasksResult = await client.listRecords<Task>(TABLES.TASKS, { limit: 200 })
    const jobTasks = tasksResult.items.filter(item =>
      taskBelongsToJob(item as unknown as Record<string, unknown>, jobId)
    )
    const nextOrder = jobTasks.length + 1

    const title = (body.title as string) || `${taskType} - Task ${nextOrder}`

    const createData: Record<string, unknown> = {
      title,
      [TASK_FIELDS.job]: [jobId],
      [TASK_FIELDS.task_type]: taskType,
      [TASK_FIELDS.status]: 'pending',
      [TASK_FIELDS.order]: nextOrder,
      [TASK_FIELDS.notes]: (body.notes as string) || ''
    }

    const newTask = await withRetry(() =>
      client.createRecord<Task>(TABLES.TASKS, createData as Partial<Task>)
    )

    const transformed = transformTask(newTask as unknown as Record<string, unknown>)

    return c.json(transformed, 201)
  } catch (error) {
    console.error('[TASKS] Error creating task:', error)
    return c.json({ error: 'Failed to create task' }, 500)
  }
})

// Bulk create tasks
tasks.post('/bulk', async (c) => {
  const auth = getAuth(c)
  const client = getSmartSuiteClient()

  console.log('[TASKS] POST /bulk called')

  try {
    const body = await c.req.json() as Record<string, unknown>
    const jobId = (body.job_id || body.job) as string
    const taskTypes = (body.task_types || body.taskTypes) as string[]

    if (!jobId || !taskTypes || !Array.isArray(taskTypes) || taskTypes.length === 0) {
      return c.json({ error: 'Missing required fields: job_id, task_types array' }, 400)
    }

    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      console.error('[TASKS] Ownership check failed for POST /bulk')
      return c.json({ error: 'Forbidden' }, 403)
    }

    const tasksResult = await client.listRecords<Task>(TABLES.TASKS, { limit: 200 })
    const existingTasks = tasksResult.items.filter(item =>
      taskBelongsToJob(item as unknown as Record<string, unknown>, jobId)
    )
    let nextOrder = existingTasks.length + 1

    const createdTasks: Record<string, unknown>[] = []

    for (const taskType of taskTypes) {
      const title = `${taskType.replace(/_/g, ' ')} - Task ${nextOrder}`

      const createData: Record<string, unknown> = {
        title,
        [TASK_FIELDS.job]: [jobId],
        [TASK_FIELDS.task_type]: taskType,
        [TASK_FIELDS.status]: 'pending',
        [TASK_FIELDS.order]: nextOrder,
        [TASK_FIELDS.notes]: ''
      }

      const newTask = await withRetry(() =>
        client.createRecord<Task>(TABLES.TASKS, createData as Partial<Task>)
      )

      createdTasks.push(transformTask(newTask as unknown as Record<string, unknown>))
      nextOrder++
    }

    return c.json({
      items: createdTasks,
      total: createdTasks.length
    }, 201)
  } catch (error) {
    console.error('[TASKS] Error bulk creating tasks:', error)
    return c.json({ error: 'Failed to create tasks' }, 500)
  }
})

// Update task
tasks.put('/:id', async (c) => {
  const auth = getAuth(c)
  const taskId = c.req.param('id')
  const client = getSmartSuiteClient()

  console.log('[TASKS] PUT /:id called - taskId:', taskId)

  try {
    const existingTask = await withRetry(() =>
      client.getRecord<Task>(TABLES.TASKS, taskId)
    )

    const taskJobIds = existingTask[TASK_FIELDS.job as keyof Task] as string[] | string | undefined
    const jobId = Array.isArray(taskJobIds) ? taskJobIds[0] : taskJobIds

    if (!jobId) {
      return c.json({ error: 'Task has no associated job' }, 400)
    }

    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      console.error('[TASKS] Ownership check failed for PUT /:id')
      return c.json({ error: 'Forbidden' }, 403)
    }

    const body = await c.req.json() as Record<string, unknown>
    const updateData: Record<string, unknown> = {}

    if (body.status !== undefined) {
      updateData[TASK_FIELDS.status] = body.status
    }
    if (body.notes !== undefined) {
      updateData[TASK_FIELDS.notes] = body.notes
    }
    if (body.started_at !== undefined || body.startedAt !== undefined) {
      updateData[TASK_FIELDS.started_at] = body.started_at || body.startedAt
    }
    if (body.completed_at !== undefined || body.completedAt !== undefined) {
      updateData[TASK_FIELDS.completed_at] = body.completed_at || body.completedAt
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'No valid fields to update' }, 400)
    }

    console.log('[TASKS] Updating task with:', updateData)

    const updatedTask = await withRetry(() =>
      client.updateRecord<Task>(TABLES.TASKS, taskId, updateData as Partial<Task>)
    )

    const transformed = transformTask(updatedTask as unknown as Record<string, unknown>)

    return c.json(transformed)
  } catch (error) {
    console.error('[TASKS] Error updating task:', error)
    return c.json({ error: 'Failed to update task' }, 500)
  }
})

// Delete task
tasks.delete('/:id', async (c) => {
  const auth = getAuth(c)
  const taskId = c.req.param('id')
  const client = getSmartSuiteClient()

  console.log('[TASKS] DELETE /:id called - taskId:', taskId)

  try {
    const task = await withRetry(() =>
      client.getRecord<Task>(TABLES.TASKS, taskId)
    )

    const taskJobIds = task[TASK_FIELDS.job as keyof Task] as string[] | string | undefined
    const jobId = Array.isArray(taskJobIds) ? taskJobIds[0] : taskJobIds

    if (!jobId) {
      return c.json({ error: 'Task has no associated job' }, 400)
    }

    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      console.error('[TASKS] Ownership check failed for DELETE /:id')
      return c.json({ error: 'Forbidden' }, 403)
    }

    await withRetry(() =>
      client.deleteRecord(TABLES.TASKS, taskId)
    )

    return c.json({ success: true })
  } catch (error) {
    console.error('[TASKS] Error deleting task:', error)
    return c.json({ error: 'Failed to delete task' }, 500)
  }
})

// Reorder tasks
tasks.post('/reorder', async (c) => {
  const auth = getAuth(c)
  const client = getSmartSuiteClient()

  console.log('[TASKS] POST /reorder called')

  try {
    const body = await c.req.json() as Record<string, unknown>
    const jobId = (body.job_id || body.job) as string
    const taskIds = (body.task_ids || body.taskIds) as string[]

    if (!jobId || !taskIds || !Array.isArray(taskIds)) {
      return c.json({ error: 'Missing required fields: job_id, task_ids array' }, 400)
    }

    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      console.error('[TASKS] Ownership check failed for POST /reorder')
      return c.json({ error: 'Forbidden' }, 403)
    }

    const updates = taskIds.map((taskId, index) =>
      withRetry(() =>
        client.updateRecord<Task>(TABLES.TASKS, taskId, {
          [TASK_FIELDS.order]: index + 1
        } as Partial<Task>)
      )
    )

    await Promise.all(updates)

    return c.json({ success: true })
  } catch (error) {
    console.error('[TASKS] Error reordering tasks:', error)
    return c.json({ error: 'Failed to reorder tasks' }, 500)
  }
})

export default tasks
