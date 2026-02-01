import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import { 
  USER_FIELDS, 
  JOB_FIELDS, 
  TASK_FIELDS,
  EVIDENCE_FIELDS
} from '../lib/smartsuite-fields.js'
import { authMiddleware, getAuth } from '../middleware/auth.js'
import { rateLimitMiddleware } from '../middleware/rateLimit.js'
import { cacheGet, cacheSet, CACHE_KEYS, CACHE_TTL } from '../lib/redis.js'
import type { Task, Job, User } from '../types/index.js'

const tasks = new Hono()

// Apply middleware to all routes
tasks.use('*', rateLimitMiddleware)
tasks.use('*', authMiddleware)

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

// Helper: Get user record ID from Clerk ID (with Redis + memory caching)
async function getUserRecordId(clerkId: string): Promise<string | null> {
  const cacheKey = CACHE_KEYS.userRecord(clerkId)
  
  // 1. Try Redis cache first
  const cached = await cacheGet<string>(cacheKey)
  if (cached) {
    return cached
  }
  
  // 2. Cache miss - fetch from SmartSuite
  const client = getSmartSuiteClient()
  
  try {
    const user = await withRetry(() => 
      client.findByField<User>(TABLES.USERS, USER_FIELDS.clerk_id, clerkId)
    )
    
    if (user?.id) {
      // 3. Store in Redis (fire-and-forget)
      cacheSet(cacheKey, user.id, CACHE_TTL.userRecord)
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

// Helper: Verify user owns the job (with caching)
async function verifyJobOwnership(jobId: string, clerkId: string): Promise<boolean> {
  console.log('[TASKS] verifyJobOwnership called - jobId:', jobId, 'clerkId:', clerkId)
  
  const userRecordId = await getUserRecordId(clerkId)
  
  if (!userRecordId) {
    console.error('[TASKS] Failed to get user record ID - returning 403')
    return false
  }

  // Check ownership cache
  const ownershipKey = CACHE_KEYS.jobOwnership(jobId, userRecordId)
  const cachedOwnership = await cacheGet<boolean>(ownershipKey)
  if (cachedOwnership !== null) {
    console.log('[TASKS] Ownership from cache:', cachedOwnership)
    return cachedOwnership
  }

  const client = getSmartSuiteClient()

  try {
    const job = await withRetry(() => 
      client.getRecord<Job>(TABLES.JOBS, jobId)
    )
    
    console.log('[TASKS] Fetched job for ownership check')
    const isOwner = userOwnsJob(job as unknown as Record<string, unknown>, userRecordId)
    
    // Cache ownership result (fire-and-forget)
    cacheSet(ownershipKey, isOwner, CACHE_TTL.jobOwnership)
    
    return isOwner
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

// Task status option ID to label mapping (for READING from SmartSuite)
const TASK_STATUS_OPTIONS: Record<string, string> = {
  '6lyBx': 'pending',
  '99zi7': 'in_progress',
  'Tp5LB': 'completed',
  'QyMRS': 'skipped',
}

// Reverse mapping: status string to option ID (for WRITING to SmartSuite)
const TASK_STATUS_TO_OPTION_ID: Record<string, string> = {
  'pending': '6lyBx',
  'in_progress': '99zi7',
  'completed': 'Tp5LB',
  'skipped': 'QyMRS',
}

// Helper: Extract status value from SmartSuite format
function extractStatus(statusValue: unknown): string {
  if (!statusValue) return 'pending'
  
  if (typeof statusValue === 'object' && statusValue !== null) {
    const obj = statusValue as Record<string, unknown>
    if (obj.value && typeof obj.value === 'string') {
      // Check option mapping first
      if (TASK_STATUS_OPTIONS[obj.value]) {
        return TASK_STATUS_OPTIONS[obj.value]
      }
    }
    if (obj.label && typeof obj.label === 'string') {
      return obj.label.toLowerCase().replace(/\s+/g, '_')
    }
  }
  
  if (typeof statusValue === 'string') {
    // Check option mapping first
    if (TASK_STATUS_OPTIONS[statusValue]) {
      return TASK_STATUS_OPTIONS[statusValue]
    }
    if (/^[a-zA-Z0-9]{5,6}$/.test(statusValue)) {
      return 'pending'
    }
    return statusValue.toLowerCase().replace(/\s+/g, '_')
  }
  
  return 'pending'
}

// Task type option ID to label mapping (for READING from SmartSuite)
const TASK_TYPE_OPTIONS: Record<string, string> = {
  'GZf84': 'consumer_unit_replacement',
  '8WuQU': 'eicr_inspection',
  'QYJ13': 'new_circuit_installation',
  'faGqR': 'emergency_lighting_test',
  'xT6A4': 'fire_alarm_test',
  'hSv6P': 'ev_charger_install',
  'zVX12': 'fault_finding',
  'EDcwW': 'pat_testing',
  'HVNT7': 'smoke_co_alarm_install',
  'OPEoa': 'solar_pv_install',
  'YbUD2': 'rewire_full',
  'n74B8': 'rewire_partial',
  'ZTbWj': 'outdoor_lighting',
  'nvHim': 'data_cabling',
  'LC7ux': 'general_maintenance',
  'THmsG': 'bathroom_installation',
  'fjAYt': 'kitchen_installation',
  'h1OT7': 'electric_shower_install',
  'SWJDB': 'socket_installation',
  'cTo69': 'lighting_installation',
  'rGASu': 'extractor_fan_install',
  'OrwYU': 'storage_heater_install',
  '13rm4': 'immersion_heater_install',
  'dlV0y': 'security_system_install',
  'J7NUh': 'cctv_installation',
  'keBdW': 'landlord_certificate',
  'Ag6yQ': 'minor_works',
  'OSi8A': 'custom',
}

// Reverse mapping: task type string to option ID (for WRITING to SmartSuite)
const TASK_TYPE_TO_OPTION_ID: Record<string, string> = {
  'consumer_unit_replacement': 'GZf84',
  'eicr_inspection': '8WuQU',
  'new_circuit_installation': 'QYJ13',
  'emergency_lighting_test': 'faGqR',
  'fire_alarm_test': 'xT6A4',
  'ev_charger_install': 'hSv6P',
  'fault_finding': 'zVX12',
  'pat_testing': 'EDcwW',
  'smoke_co_alarm_install': 'HVNT7',
  'solar_pv_install': 'OPEoa',
  'rewire_full': 'YbUD2',
  'rewire_partial': 'n74B8',
  'outdoor_lighting': 'ZTbWj',
  'data_cabling': 'nvHim',
  'general_maintenance': 'LC7ux',
  'bathroom_installation': 'THmsG',
  'kitchen_installation': 'fjAYt',
  'electric_shower_install': 'h1OT7',
  'socket_installation': 'SWJDB',
  'lighting_installation': 'cTo69',
  'extractor_fan_install': 'rGASu',
  'storage_heater_install': 'OrwYU',
  'immersion_heater_install': '13rm4',
  'security_system_install': 'dlV0y',
  'cctv_installation': 'J7NUh',
  'landlord_certificate': 'keBdW',
  'minor_works': 'Ag6yQ',
  'custom': 'OSi8A',
}

// Helper: Convert task type string to SmartSuite option ID
function getTaskTypeOptionId(taskType: string): string {
  const optionId = TASK_TYPE_TO_OPTION_ID[taskType]
  if (optionId) {
    return optionId
  }
  // Log unknown task type and default to general_maintenance
  console.log('[TASKS] Unknown task type for creation:', taskType, '- defaulting to general_maintenance')
  return TASK_TYPE_TO_OPTION_ID['general_maintenance'] || 'LC7ux'
}

// Helper: Extract task type value
function extractTaskType(typeValue: unknown): string {
  if (!typeValue) return 'general_maintenance'
  
  let rawValue: string | null = null
  
  if (typeof typeValue === 'object' && typeValue !== null) {
    const obj = typeValue as Record<string, unknown>
    if (obj.value && typeof obj.value === 'string') {
      rawValue = obj.value
    } else if (obj.label && typeof obj.label === 'string') {
      return obj.label.toLowerCase().replace(/[\s/]+/g, '_')
    }
  } else if (typeof typeValue === 'string') {
    rawValue = typeValue
  }
  
  if (!rawValue) return 'general_maintenance'
  
  // Check option mapping
  if (TASK_TYPE_OPTIONS[rawValue]) {
    return TASK_TYPE_OPTIONS[rawValue]
  }
  
  // If it's an option ID we don't know, log it
  if (/^[a-zA-Z0-9]{5,6}$/.test(rawValue)) {
    console.log('[TASKS] Unknown task type option ID:', rawValue, '- please add to mapping')
    return 'general_maintenance'
  }
  
  return rawValue.toLowerCase().replace(/[\s/]+/g, '_')
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

// Evidence type option ID to normalized label mapping (for READING from SmartSuite)
// Complete mapping with all 51 evidence types
const EVIDENCE_TYPE_OPTIONS: Record<string, string> = {
  'mVsNo': 'existing_board_condition',
  'FTVO5': 'isolation_confirmation',
  'RvRbr': 'new_board_installed',
  '3jYOf': 'main_earth_bonding',
  'Q5wfk': 'completed_installation',
  'nLeez': 'cable_route',
  'YFZBw': 'containment',
  'cN18H': 'connection_points',
  '1YrTO': 'db_photo',
  'F826r': 'sample_circuit_tests',
  'E2lOv': 'defects_found',
  'sMhQ9': 'luminaire_photo',
  '1M3gg': 'battery_test_readings',
  'nZKk1': 'logbook_entry',
  'XNwfW': 'panel_photo',
  'jSpIt': 'device_test_log',
  'CxWPt': 'call_point_activation',
  'gLnR1': 'location_photo',
  'XMyuc': 'protective_device',
  'SfzfC': 'dno_notification',
  '3FyTK': 'initial_fault_indication',
  'dvGWa': 'investigation_photos',
  '8aZOR': 'resolution',
  'zHfbD': 'test_confirmation',
  'x0eqD': 'equipment_photo',
  'hRjl8': 'location_compliance',
  'xaQrd': 'alarm_photo',
  'xKIP1': 'test_activation',
  'fDfmf': 'array_location',
  'YO3iv': 'inverter',
  '708g2': 'ac_dc_isolators',
  'OJe8U': 'g98_g99_submission',
  'KtV9n': 'dno_acceptance',
  '537Fm': 'zone_identification',
  '5ZTN3': 'rcd_protection',
  'ShjqB': 'bonding_connections',
  'fCB6P': 'circuit_layout',
  'SivU5': 'isolation_switch',
  'XjFcs': 'device_locations',
  '42Gf9': 'camera_locations',
  's4R4Q': 'recorder_location',
  '4hldz': 'before_photo',
  'bPV1p': 'after_photo',
  'uR5fB': 'test_meter_readings',
  'yoJ7D': 'test_result',
  '1VlrY': 'certificate_photo',
  'c7LhE': 'label_applied',
  'X3Lrf': 'test_instrument_calibration',
  'qytQX': 'earthing_arrangement',
  'f2QeD': 'wiring_photo',
  'Dxpai': 'additional_evidence',
}

// Photo stage option ID to label mapping
// NEW (correct)
const PHOTO_STAGE_OPTIONS: Record<string, string> = {
  'DZX3Z': 'before',
  'U6zl3': 'after',
  'cDYca': 'during',
}

// Helper: Extract single select value with option ID mapping
function extractSingleSelectValue(
  value: unknown,
  optionMap?: Record<string, string>
): string | null {
  if (!value) return null

  let rawValue: string | null = null

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>
    if (obj.value && typeof obj.value === 'string') {
      rawValue = obj.value
    } else if (obj.label && typeof obj.label === 'string') {
      return obj.label.toLowerCase().replace(/\s+/g, '_')
    }
  } else if (typeof value === 'string') {
    rawValue = value
  }

  if (!rawValue) return null

  if (optionMap && optionMap[rawValue]) {
    return optionMap[rawValue]
  }

  if (/^[a-zA-Z0-9]{5,6}$/.test(rawValue)) {
    console.log('[TASKS] Unknown option ID:', rawValue, '- please add to mapping')
    return null
  }

  return rawValue.toLowerCase().replace(/\s+/g, '_')
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

// Get task with evidence - combined endpoint for faster loading
tasks.get('/:id/with-evidence', async (c) => {
  const auth = getAuth(c)
  const taskId = c.req.param('id')
  const client = getSmartSuiteClient()

  console.log('[TASKS] GET /:id/with-evidence called - taskId:', taskId)

  try {
    // 1. Get task
    const task = await withRetry(() =>
      client.getRecord<Task>(TABLES.TASKS, taskId)
    )

    const taskJobIds = task[TASK_FIELDS.job as keyof Task] as string[] | string | undefined
    const jobId = Array.isArray(taskJobIds) ? taskJobIds[0] : taskJobIds

    if (!jobId) {
      return c.json({ error: 'Task has no associated job' }, 400)
    }

    // 2. Verify ownership ONCE (uses cache)
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // 3. Fetch evidence for this task (no separate ownership check needed)
    const evidenceResult = await withRetry(() =>
      client.listRecords(TABLES.EVIDENCE, { limit: 100 })
    )

    // Filter evidence by task_id
    const taskEvidence = evidenceResult.items.filter((item: Record<string, unknown>) => {
      const evTaskIds = item[EVIDENCE_FIELDS.task] as string[] | string | undefined
      if (!evTaskIds) return false
      const ids = Array.isArray(evTaskIds) ? evTaskIds : [evTaskIds]
      return ids.includes(taskId)
    })

    // Transform task
    const transformedTask = transformTask(task as unknown as Record<string, unknown>)

    // Transform evidence
    const transformedEvidence = taskEvidence.map((ev: Record<string, unknown>) => {
      const evType = ev[EVIDENCE_FIELDS.evidence_type]
      const evStage = ev[EVIDENCE_FIELDS.photo_stage]
      console.log('[TASKS] Evidence photo_stage raw:', evStage)
      const photoUrl = ev[EVIDENCE_FIELDS.photo_url] as string | undefined

      return {
        id: ev.id,
        taskId: taskId,
        evidenceType: extractSingleSelectValue(evType, EVIDENCE_TYPE_OPTIONS),
        photoStage: extractSingleSelectValue(evStage, PHOTO_STAGE_OPTIONS),
        photoUrl: photoUrl || null
      }
    })

    console.log('[TASKS] Returning task with', transformedEvidence.length, 'evidence items')

    return c.json({
      task: transformedTask,
      evidence: {
        items: transformedEvidence,
        total: transformedEvidence.length
      }
    })
  } catch (error) {
    console.error('[TASKS] Error fetching task with evidence:', error)
    return c.json({ error: 'Failed to fetch task' }, 500)
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
    // Generate unique title with job ID suffix and timestamp
    const title = (body.title as string) || `${taskType.replace(/_/g, ' ')} - ${jobId.slice(-6)}-${Date.now()}`

    // Convert task type string to SmartSuite option ID
    const taskTypeOptionId = getTaskTypeOptionId(taskType)
    console.log('[TASKS] Creating task with type:', taskType, '-> option ID:', taskTypeOptionId)

    const createData: Record<string, unknown> = {
      title,
      [TASK_FIELDS.job]: [jobId],
      [TASK_FIELDS.task_type]: taskTypeOptionId,
      [TASK_FIELDS.status]: TASK_STATUS_TO_OPTION_ID['pending'],
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
    const customTaskName = (body.custom_task_name || body.customTaskName) as string | undefined

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
      // Use custom name for 'custom' type, otherwise generate standard title
      let title: string
      if (taskType === 'custom' && customTaskName) {
        title = customTaskName
      } else {
        title = `${taskType.replace(/_/g, ' ')} - ${jobId.slice(-6)}-${Date.now()}`
      }

      // Convert task type string to SmartSuite option ID
      const taskTypeOptionId = getTaskTypeOptionId(taskType)
      console.log('[TASKS] Bulk creating task with type:', taskType, '-> option ID:', taskTypeOptionId, 'title:', title)

      const createData: Record<string, unknown> = {
        title,
        [TASK_FIELDS.job]: [jobId],
        [TASK_FIELDS.task_type]: taskTypeOptionId,
        [TASK_FIELDS.status]: TASK_STATUS_TO_OPTION_ID['pending'],
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
      const statusStr = body.status as string
      // Convert status string to option ID
      const statusOptionId = TASK_STATUS_TO_OPTION_ID[statusStr]
      updateData[TASK_FIELDS.status] = statusOptionId || body.status
      
      // Auto-set completed_at when status changes to completed
      if (statusStr === 'completed') {
        updateData[TASK_FIELDS.completed_at] = new Date().toISOString()
        console.log('[TASKS] Auto-setting completed_at for status change to completed')
      }
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
