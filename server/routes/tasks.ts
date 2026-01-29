import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import { USER_FIELDS, JOB_FIELDS, TASK_FIELDS } from '../lib/smartsuite-fields.js'
import { authMiddleware, getAuth } from '../middleware/auth.js'
import { rateLimitMiddleware } from '../middleware/rateLimit.js'
import type { Task, Job, User } from '../types/index.js'

const tasks = new Hono()

// Apply middleware to all routes
tasks.use('*', rateLimitMiddleware)
tasks.use('*', authMiddleware)

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

// Helper: Verify user owns the job
async function verifyJobOwnership(jobId: string, clerkId: string): Promise<boolean> {
  const client = getSmartSuiteClient()
  const userRecordId = await getUserRecordId(clerkId)
  
  if (!userRecordId) return false

  try {
    const job = await client.getRecord<Job>(TABLES.JOBS, jobId)
    return userOwnsJob(job as unknown as Record<string, unknown>, userRecordId)
  } catch {
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

// Helper: Extract status from SmartSuite format
function extractStatus(statusRaw: unknown): string {
  if (!statusRaw) return 'pending'
  
  // Plain string
  if (typeof statusRaw === 'string') {
    // If it looks like a SmartSuite ID (alphanumeric, 5-6 chars), return default
    if (/^[a-zA-Z0-9]{5,6}$/.test(statusRaw)) {
      return 'pending'
    }
    return statusRaw.toLowerCase()
  }
  
  // Object with label (preferred) or value
  if (typeof statusRaw === 'object' && statusRaw !== null) {
    const statusObj = statusRaw as { label?: string; value?: string }
    if (statusObj.label) {
      return statusObj.label.toLowerCase().replace(/\s+/g, '_')
    }
  }
  
  return 'pending'
}

// Helper: Transform SmartSuite task record to readable format
function transformTask(record: Record<string, unknown>): Record<string, unknown> {
  // Job field may be array (linked record)
  const jobValue = record[TASK_FIELDS.job] as string[] | string | undefined
  const jobId = Array.isArray(jobValue) ? jobValue[0] : jobValue

  // Task type might be string, object with value, or from title
  let taskType = record[TASK_FIELDS.task_type]
  
  // Handle different formats SmartSuite might return
  if (typeof taskType === 'object' && taskType !== null) {
    // Might be { value: 'type' } or { label: 'type' }
    taskType = (taskType as Record<string, unknown>).value || 
               (taskType as Record<string, unknown>).label || 
               'unknown'
  }
  
  // If still no taskType, try to extract from title
  if (!taskType || taskType === 'unknown') {
    const title = record.title as string
    if (title && title.includes(' - Task')) {
      taskType = title.split(' - Task')[0]
    }
  }

  // Extract status properly
  const status = extractStatus(record[TASK_FIELDS.status])

  return {
    id: record.id,
    title: record.title,
    jobId: jobId || '',
    taskType: taskType || 'unknown',
    status: status,
    order: record[TASK_FIELDS.order] || 0,
    notes: record[TASK_FIELDS.notes],
    startedAt: record[TASK_FIELDS.started_at],
    completedAt: record[TASK_FIELDS.completed_at],
    // Default evidence counts (will be updated when evidence is loaded)
    evidenceCount: 0,
    requiredEvidenceCount: 5
  }
}

// List tasks - supports both /tasks?job_id=xxx and /tasks/job/:jobId
tasks.get('/', async (c) => {
  const auth = getAuth(c)
  const jobId = c.req.query('job_id')
  const client = getSmartSuiteClient()

  if (!jobId) {
    return c.json({ error: 'Missing job_id parameter' }, 400)
  }

  try {
    // Verify ownership
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Fetch all tasks (SmartSuite linked record fields don't support comparison operators)
    // Then filter in memory by job ID
    const result = await client.listRecords<Task>(TABLES.TASKS, {
      limit: 200
    })

    // Filter by job ID in memory
    let filteredItems = result.items.filter(item =>
      taskBelongsToJob(item as unknown as Record<string, unknown>, jobId)
    )

    // Apply status filter if provided
    const status = c.req.query('status')
    if (status) {
      filteredItems = filteredItems.filter(item => {
        const taskStatus = extractStatus((item as unknown as Record<string, unknown>)[TASK_FIELDS.status])
        return taskStatus === status
      })
    }

    // Sort by order ascending
    filteredItems.sort((a, b) => {
      const aOrder = ((a as unknown as Record<string, unknown>)[TASK_FIELDS.order] as number) || 0
      const bOrder = ((b as unknown as Record<string, unknown>)[TASK_FIELDS.order] as number) || 0
      return aOrder - bOrder
    })

    // Transform each task to readable format
    const transformedItems = filteredItems.map(item =>
      transformTask(item as unknown as Record<string, unknown>)
    )

    return c.json({
      items: transformedItems,
      total: transformedItems.length
    })
  } catch (error) {
    console.error('Error listing tasks:', error)
    return c.json({ error: 'Failed to list tasks' }, 500)
  }
})

// List tasks for a job (alternative route)
tasks.get('/job/:jobId', async (c) => {
  const auth = getAuth(c)
  const jobId = c.req.param('jobId')
  const client = getSmartSuiteClient()

  try {
    // Verify ownership
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Fetch all tasks and filter in memory
    const result = await client.listRecords<Task>(TABLES.TASKS, {
      limit: 200
    })

    // Filter by job ID in memory
    let filteredItems = result.items.filter(item =>
      taskBelongsToJob(item as unknown as Record<string, unknown>, jobId)
    )

    // Apply status filter if provided
    const status = c.req.query('status')
    if (status) {
      filteredItems = filteredItems.filter(item => {
        const taskStatus = extractStatus((item as unknown as Record<string, unknown>)[TASK_FIELDS.status])
        return taskStatus === status
      })
    }

    // Sort by order ascending
    filteredItems.sort((a, b) => {
      const aOrder = ((a as unknown as Record<string, unknown>)[TASK_FIELDS.order] as number) || 0
      const bOrder = ((b as unknown as Record<string, unknown>)[TASK_FIELDS.order] as number) || 0
      return aOrder - bOrder
    })

    // Transform each task to readable format
    const transformedItems = filteredItems.map(item =>
      transformTask(item as unknown as Record<string, unknown>)
    )

    return c.json({
      items: transformedItems,
      total: transformedItems.length
    })
  } catch (error) {
    console.error('Error listing tasks:', error)
    return c.json({ error: 'Failed to list tasks' }, 500)
  }
})

// Get single task by ID
tasks.get('/:id', async (c) => {
  const auth = getAuth(c)
  const taskId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    const task = await client.getRecord<Task>(TABLES.TASKS, taskId)

    // Get job ID from task (may be array for linked record)
    const taskJobIds = task[TASK_FIELDS.job as keyof Task] as string[] | string
    const jobId = Array.isArray(taskJobIds) ? taskJobIds[0] : taskJobIds

    // Verify ownership through job
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Transform to readable format
    const transformed = transformTask(task as unknown as Record<string, unknown>)

    return c.json(transformed)
  } catch (error) {
    console.error('Error fetching task:', error)
    return c.json({ error: 'Failed to fetch task' }, 500)
  }
})

// Create new task
tasks.post('/', async (c) => {
  const auth = getAuth(c)
  const client = getSmartSuiteClient()

  try {
    const body = await c.req.json() as Record<string, unknown>

    // Support both formats
    const jobId = (body.job || body.job_id) as string
    const taskType = (body.task_type || body.taskType) as string

    // Validate required fields
    if (!jobId || !taskType) {
      return c.json({ error: 'Missing required fields: job_id, task_type' }, 400)
    }

    // Verify ownership
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Get existing tasks for order number
    const allTasks = await client.listRecords<Task>(TABLES.TASKS, { limit: 200 })
    const jobTasks = allTasks.items.filter(item =>
      taskBelongsToJob(item as unknown as Record<string, unknown>, jobId)
    )
    const order = jobTasks.length + 1

    // Create task with SmartSuite field IDs
    // Linked record fields need array value
    const taskData: Record<string, unknown> = {
      title: `${taskType} - Task ${order}`,
      [TASK_FIELDS.job]: [jobId],
      [TASK_FIELDS.task_type]: taskType,
      [TASK_FIELDS.status]: 'pending',
      [TASK_FIELDS.order]: order
    }

    if (body.notes) {
      taskData[TASK_FIELDS.notes] = body.notes
    }

    const task = await client.createRecord<Task>(TABLES.TASKS, taskData as Omit<Task, 'id'>)

    // Transform to readable format
    const transformed = transformTask(task as unknown as Record<string, unknown>)

    return c.json(transformed, 201)
  } catch (error) {
    console.error('Error creating task:', error)
    return c.json({ error: 'Failed to create task' }, 500)
  }
})

// Bulk create tasks for a job
// Frontend sends: { job_id: string, task_types: string[] }
tasks.post('/bulk', async (c) => {
  const auth = getAuth(c)
  const client = getSmartSuiteClient()

  try {
    const body = await c.req.json() as Record<string, unknown>

    // Support both formats from frontend
    const jobId = (body.job_id || body.job) as string
    const taskTypes = (body.task_types || body.tasks) as string[] | Array<{ task_type: string }>

    if (!jobId) {
      return c.json({ error: 'Missing required field: job_id' }, 400)
    }

    if (!taskTypes || !Array.isArray(taskTypes) || taskTypes.length === 0) {
      return c.json({ error: 'Missing required field: task_types array' }, 400)
    }

    // Verify ownership
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Normalize task types - handle both string[] and {task_type}[]
    const normalizedTypes = taskTypes.map(t => 
      typeof t === 'string' ? t : t.task_type
    )

    // Prepare tasks with SmartSuite field IDs
    const tasksData = normalizedTypes.map((taskType, index) => ({
      title: `${taskType} - Task ${index + 1}`,
      [TASK_FIELDS.job]: [jobId],
      [TASK_FIELDS.task_type]: taskType,
      [TASK_FIELDS.status]: 'pending',
      [TASK_FIELDS.order]: index + 1
    }))

    const createdTasks = await client.bulkCreate<Task>(TABLES.TASKS, tasksData as Array<Omit<Task, 'id'>>)

    // Transform each task to readable format
    const transformedItems = createdTasks.map(item =>
      transformTask(item as unknown as Record<string, unknown>)
    )

    return c.json({ items: transformedItems }, 201)
  } catch (error) {
    console.error('Error bulk creating tasks:', error)
    return c.json({ error: 'Failed to create tasks' }, 500)
  }
})

// Update task
tasks.patch('/:id', async (c) => {
  const auth = getAuth(c)
  const taskId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    // Get existing task
    const existingTask = await client.getRecord<Task>(TABLES.TASKS, taskId)

    // Get job ID from task
    const taskJobIds = existingTask[TASK_FIELDS.job as keyof Task] as string[] | string
    const jobId = Array.isArray(taskJobIds) ? taskJobIds[0] : taskJobIds

    // Verify ownership through job
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const body = await c.req.json() as Record<string, unknown>

    // Map request fields to SmartSuite field IDs
    const updateData: Record<string, unknown> = {}

    if (body.status !== undefined) updateData[TASK_FIELDS.status] = body.status
    if (body.notes !== undefined) updateData[TASK_FIELDS.notes] = body.notes
    if (body.started_at !== undefined) updateData[TASK_FIELDS.started_at] = body.started_at
    if (body.startedAt !== undefined) updateData[TASK_FIELDS.started_at] = body.startedAt
    if (body.completed_at !== undefined) updateData[TASK_FIELDS.completed_at] = body.completed_at
    if (body.completedAt !== undefined) updateData[TASK_FIELDS.completed_at] = body.completedAt

    // Auto-set timestamps based on status
    const currentStarted = existingTask[TASK_FIELDS.started_at as keyof Task]
    const currentCompleted = existingTask[TASK_FIELDS.completed_at as keyof Task]

    if (body.status === 'in_progress' && !currentStarted) {
      updateData[TASK_FIELDS.started_at] = new Date().toISOString()
    }

    if (body.status === 'completed' && !currentCompleted) {
      updateData[TASK_FIELDS.completed_at] = new Date().toISOString()
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'No valid fields to update' }, 400)
    }

    const updatedTask = await client.updateRecord<Task>(
      TABLES.TASKS,
      taskId,
      updateData as Partial<Task>
    )

    // Transform to readable format
    const transformed = transformTask(updatedTask as unknown as Record<string, unknown>)

    return c.json(transformed)
  } catch (error) {
    console.error('Error updating task:', error)
    return c.json({ error: 'Failed to update task' }, 500)
  }
})

// Also support PUT for updates
tasks.put('/:id', async (c) => {
  const auth = getAuth(c)
  const taskId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    // Get existing task
    const existingTask = await client.getRecord<Task>(TABLES.TASKS, taskId)

    // Get job ID from task
    const taskJobIds = existingTask[TASK_FIELDS.job as keyof Task] as string[] | string
    const jobId = Array.isArray(taskJobIds) ? taskJobIds[0] : taskJobIds

    // Verify ownership through job
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const body = await c.req.json() as Record<string, unknown>

    // Map request fields to SmartSuite field IDs
    const updateData: Record<string, unknown> = {}

    if (body.status !== undefined) updateData[TASK_FIELDS.status] = body.status
    if (body.notes !== undefined) updateData[TASK_FIELDS.notes] = body.notes
    if (body.started_at !== undefined) updateData[TASK_FIELDS.started_at] = body.started_at
    if (body.startedAt !== undefined) updateData[TASK_FIELDS.started_at] = body.startedAt
    if (body.completed_at !== undefined) updateData[TASK_FIELDS.completed_at] = body.completed_at
    if (body.completedAt !== undefined) updateData[TASK_FIELDS.completed_at] = body.completedAt

    // Auto-set timestamps based on status
    const currentStarted = existingTask[TASK_FIELDS.started_at as keyof Task]
    const currentCompleted = existingTask[TASK_FIELDS.completed_at as keyof Task]

    if (body.status === 'in_progress' && !currentStarted) {
      updateData[TASK_FIELDS.started_at] = new Date().toISOString()
    }

    if (body.status === 'completed' && !currentCompleted) {
      updateData[TASK_FIELDS.completed_at] = new Date().toISOString()
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'No valid fields to update' }, 400)
    }

    const updatedTask = await client.updateRecord<Task>(
      TABLES.TASKS,
      taskId,
      updateData as Partial<Task>
    )

    // Transform to readable format
    const transformed = transformTask(updatedTask as unknown as Record<string, unknown>)

    return c.json(transformed)
  } catch (error) {
    console.error('Error updating task:', error)
    return c.json({ error: 'Failed to update task' }, 500)
  }
})

// Delete task
tasks.delete('/:id', async (c) => {
  const auth = getAuth(c)
  const taskId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    // Get existing task
    const existingTask = await client.getRecord<Task>(TABLES.TASKS, taskId)

    // Get job ID from task
    const taskJobIds = existingTask[TASK_FIELDS.job as keyof Task] as string[] | string
    const jobId = Array.isArray(taskJobIds) ? taskJobIds[0] : taskJobIds

    // Verify ownership through job
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await client.deleteRecord(TABLES.TASKS, taskId)

    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    return c.json({ error: 'Failed to delete task' }, 500)
  }
})

// Reorder tasks
tasks.post('/reorder', async (c) => {
  const auth = getAuth(c)
  const client = getSmartSuiteClient()

  try {
    const body = await c.req.json() as Record<string, unknown>
    const jobId = (body.job_id || body.job) as string
    const taskIds = (body.task_ids || body.taskIds) as string[]

    if (!jobId || !taskIds || !Array.isArray(taskIds)) {
      return c.json({ error: 'Missing required fields: job_id, task_ids array' }, 400)
    }

    // Verify ownership
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Update order for each task using field ID
    const updates = taskIds.map((taskId, index) =>
      client.updateRecord<Task>(TABLES.TASKS, taskId, { 
        [TASK_FIELDS.order]: index + 1 
      } as Partial<Task>)
    )

    await Promise.all(updates)

    return c.json({ success: true })
  } catch (error) {
    console.error('Error reordering tasks:', error)
    return c.json({ error: 'Failed to reorder tasks' }, 500)
  }
})

export default tasks
