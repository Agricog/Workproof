import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import { authMiddleware, getAuth } from '../middleware/auth.js'
import { rateLimitMiddleware } from '../middleware/rateLimit.js'
import type { Task, Job, User, CreateTaskRequest, UpdateTaskRequest } from '../types/index.js'

const tasks = new Hono()

// Apply middleware to all routes
tasks.use('*', rateLimitMiddleware)
tasks.use('*', authMiddleware)

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

// List tasks for a job
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

    // Get query params
    const status = c.req.query('status')

    // Build filter
    const filterFields: Array<{ field: string; comparison: string; value: unknown }> = [
      { field: 'job', comparison: 'is', value: jobId }
    ]

    if (status) {
      filterFields.push({ field: 'status', comparison: 'is', value: status })
    }

    const result = await client.listRecords<Task>(TABLES.TASKS, {
      filter: {
        operator: 'and',
        fields: filterFields
      },
      sort: [{ field: 'order', direction: 'asc' }]
    })

    return c.json({
      items: result.items,
      total: result.total
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

    // Verify ownership through job
    const isOwner = await verifyJobOwnership(task.job, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    return c.json(task)
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
    const body = await c.req.json() as CreateTaskRequest

    // Validate required fields
    if (!body.job || !body.task_type) {
      return c.json({ error: 'Missing required fields: job, task_type' }, 400)
    }

    // Verify ownership
    const isOwner = await verifyJobOwnership(body.job, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Get next order number if not provided
    let order = body.order
    if (order === undefined) {
      const existingTasks = await client.listRecords<Task>(TABLES.TASKS, {
        filter: {
          operator: 'and',
          fields: [{ field: 'job', comparison: 'is', value: body.job }]
        }
      })
      order = existingTasks.total + 1
    }

    // Create task
    const taskData: Omit<Task, 'id'> = {
      job: body.job,
      task_type: body.task_type,
      status: 'pending',
      order,
      notes: body.notes || undefined
    }

    const task = await client.createRecord<Task>(TABLES.TASKS, taskData)

    return c.json(task, 201)
  } catch (error) {
    console.error('Error creating task:', error)
    return c.json({ error: 'Failed to create task' }, 500)
  }
})

// Bulk create tasks for a job
tasks.post('/bulk', async (c) => {
  const auth = getAuth(c)
  const client = getSmartSuiteClient()

  try {
    const body = await c.req.json() as { job: string; tasks: Array<{ task_type: string; order?: number; notes?: string }> }

    if (!body.job || !body.tasks || !Array.isArray(body.tasks)) {
      return c.json({ error: 'Missing required fields: job, tasks array' }, 400)
    }

    // Verify ownership
    const isOwner = await verifyJobOwnership(body.job, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Prepare tasks with order
    const tasksData = body.tasks.map((t, index) => ({
      job: body.job,
      task_type: t.task_type,
      status: 'pending' as const,
      order: t.order ?? index + 1,
      notes: t.notes || undefined
    }))

    const createdTasks = await client.bulkCreate<Task>(TABLES.TASKS, tasksData)

    return c.json({ items: createdTasks }, 201)
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

    // Verify ownership through job
    const isOwner = await verifyJobOwnership(existingTask.job, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const body = await c.req.json() as UpdateTaskRequest

    // Only allow updating specific fields
    const allowedFields = ['status', 'notes', 'started_at', 'completed_at']

    const updateData: Partial<Task> = {}
    for (const field of allowedFields) {
      if (body[field as keyof UpdateTaskRequest] !== undefined) {
        updateData[field as keyof Task] = body[field as keyof UpdateTaskRequest]
      }
    }

    // Auto-set timestamps based on status
    if (body.status === 'in_progress' && !existingTask.started_at) {
      updateData.started_at = new Date().toISOString()
    }
    if (body.status === 'completed' && !existingTask.completed_at) {
      updateData.completed_at = new Date().toISOString()
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'No valid fields to update' }, 400)
    }

    const updatedTask = await client.updateRecord<Task>(
      TABLES.TASKS,
      taskId,
      updateData
    )

    return c.json(updatedTask)
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

    // Verify ownership through job
    const isOwner = await verifyJobOwnership(existingTask.job, auth.userId)
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
    const body = await c.req.json() as { job: string; taskIds: string[] }

    if (!body.job || !body.taskIds || !Array.isArray(body.taskIds)) {
      return c.json({ error: 'Missing required fields: job, taskIds array' }, 400)
    }

    // Verify ownership
    const isOwner = await verifyJobOwnership(body.job, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Update order for each task
    const updates = body.taskIds.map((taskId, index) =>
      client.updateRecord<Task>(TABLES.TASKS, taskId, { order: index + 1 })
    )

    await Promise.all(updates)

    return c.json({ success: true })
  } catch (error) {
    console.error('Error reordering tasks:', error)
    return c.json({ error: 'Failed to reorder tasks' }, 500)
  }
})

export default tasks
