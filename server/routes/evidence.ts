import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import { USER_FIELDS, TASK_FIELDS, JOB_FIELDS, EVIDENCE_FIELDS } from '../lib/smartsuite-fields.js'
import { authMiddleware, getAuth } from '../middleware/auth.js'
import { rateLimitMiddleware } from '../middleware/rateLimit.js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Evidence, Task, User } from '../types/index.js'

const evidence = new Hono()

// Apply middleware to all routes
evidence.use('*', rateLimitMiddleware)
evidence.use('*', authMiddleware)

// R2 Configuration
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'workproof-evidence'

// Simple in-memory cache for user record IDs (clerk_id -> smartsuite_id)
const userIdCache = new Map<string, { id: string; timestamp: number }>()
const USER_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// SmartSuite option ID -> normalized label (for READING from SmartSuite)
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
  'c7LhE': 'labelling',
  'X3Lrf': 'test_instrument_calibration',
  'qytQX': 'earthing_arrangement',
  'f2QeD': 'wiring_photo',
  'Dxpai': 'additional_evidence',
}

// Photo Stage option ID -> label (for READING from SmartSuite)
const PHOTO_STAGE_OPTIONS: Record<string, string> = {
  'DZX3Z': 'before',
  'U6zl3': 'after',
  'Mw4Rd': 'during',
}

// Reverse mapping: evidence type string -> SmartSuite option ID (for WRITING to SmartSuite)
const EVIDENCE_TYPE_TO_OPTION_ID: Record<string, string> = {
  'existing_board_condition': 'mVsNo',
  'isolation_confirmation': 'FTVO5',
  'new_board_installed': 'RvRbr',
  'main_earth_bonding': '3jYOf',
  'completed_installation': 'Q5wfk',
  'cable_route': 'nLeez',
  'containment': 'YFZBw',
  'connection_points': 'cN18H',
  'db_photo': '1YrTO',
  'sample_circuit_tests': 'F826r',
  'defects_found': 'E2lOv',
  'luminaire_photo': 'sMhQ9',
  'battery_test_readings': '1M3gg',
  'logbook_entry': 'nZKk1',
  'panel_photo': 'XNwfW',
  'device_test_log': 'jSpIt',
  'call_point_activation': 'CxWPt',
  'location_photo': 'gLnR1',
  'protective_device': 'XMyuc',
  'dno_notification': 'SfzfC',
  'initial_fault_indication': '3FyTK',
  'investigation_photos': 'dvGWa',
  'resolution': '8aZOR',
  'test_confirmation': 'zHfbD',
  'equipment_photo': 'x0eqD',
  'location_compliance': 'hRjl8',
  'alarm_photo': 'xaQrd',
  'test_activation': 'xKIP1',
  'array_location': 'fDfmf',
  'inverter': 'YO3iv',
  'ac_dc_isolators': '708g2',
  'g98_g99_submission': 'OJe8U',
  'dno_acceptance': 'KtV9n',
  'zone_identification': '537Fm',
  'rcd_protection': '5ZTN3',
  'bonding_connections': 'ShjqB',
  'circuit_layout': 'fCB6P',
  'isolation_switch': 'SivU5',
  'device_locations': 'XjFcs',
  'camera_locations': '42Gf9',
  'recorder_location': 's4R4Q',
  'before_photo': '4hldz',
  'after_photo': 'bPV1p',
  'test_meter_readings': 'uR5fB',
  'test_result': 'yoJ7D',
  'certificate_photo': '1VlrY',
  'labelling': 'c7LhE',
  'label_applied': 'c7LhE',
  'test_instrument_calibration': 'X3Lrf',
  'earthing_arrangement': 'qytQX',
  'wiring_photo': 'f2QeD',
  'additional_evidence': 'Dxpai',
}

// Reverse mapping: photo stage string -> SmartSuite option ID (for WRITING to SmartSuite)
const PHOTO_STAGE_TO_OPTION_ID: Record<string, string> = {
  'before': 'DZX3Z',
  'after': 'U6zl3',
  'during': 'Mw4Rd',
}

// Helper: Convert evidence type string to SmartSuite option ID
function getEvidenceTypeOptionId(evidenceType: string): string {
  const normalized = evidenceType.toLowerCase().replace(/\s+/g, '_')
  const optionId = EVIDENCE_TYPE_TO_OPTION_ID[normalized]
  if (optionId) {
    console.log('[EVIDENCE] Mapped evidence type:', evidenceType, '->', optionId)
    return optionId
  }
  // Log unknown type and default to Additional Evidence
  console.log('[EVIDENCE] Unknown evidence type:', evidenceType, '- defaulting to additional_evidence')
  return EVIDENCE_TYPE_TO_OPTION_ID['additional_evidence'] || 'Dxpai'
}

// Helper: Convert photo stage string to SmartSuite option ID
function getPhotoStageOptionId(photoStage: string): string {
  const normalized = photoStage.toLowerCase()
  const optionId = PHOTO_STAGE_TO_OPTION_ID[normalized]
  if (optionId) {
    return optionId
  }
  console.log('[EVIDENCE] Unknown photo stage:', photoStage, '- defaulting to before')
  return PHOTO_STAGE_TO_OPTION_ID['before'] || 'DZX3Z'
}

// Initialize S3 client for R2
function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
    }
  })
}

// Helper: Retry wrapper for SmartSuite calls with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      const errorMessage = String(error)
      
      // If it's a 429, use longer delays
      const is429 = errorMessage.includes('429')
      const delay = is429 ? baseDelayMs * Math.pow(2, i) : baseDelayMs * (i + 1)
      
      console.error(`[EVIDENCE] Retry ${i + 1}/${retries + 1} failed (waiting ${delay}ms):`, errorMessage.slice(0, 100))
      
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, delay))
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
    console.error('[EVIDENCE] Error finding user:', error)
    return null
  }
}

// Helper: Extract task IDs from linked record field
function extractTaskIds(taskValue: unknown): string[] {
  if (!taskValue) return []
  if (Array.isArray(taskValue)) {
    return taskValue.flatMap(item => {
      if (typeof item === 'string') return [item]
      if (typeof item === 'object' && item !== null && 'id' in item) {
        return [(item as { id: string }).id]
      }
      return []
    })
  }
  if (typeof taskValue === 'string') return [taskValue]
  if (typeof taskValue === 'object' && taskValue !== null && 'id' in taskValue) {
    return [(taskValue as { id: string }).id]
  }
  return []
}

// Helper: Verify user owns the task (through job ownership)
async function verifyTaskOwnership(taskId: string, clerkId: string): Promise<boolean> {
  console.log('[EVIDENCE] verifyTaskOwnership called - taskId:', taskId, 'clerkId:', clerkId)
  
  const client = getSmartSuiteClient()
  const userRecordId = await getUserRecordId(clerkId)
  
  if (!userRecordId) {
    console.error('[EVIDENCE] Failed to get user record ID')
    return false
  }

  try {
    // Get task to find job
    const task = await withRetry(() => 
      client.getRecord<Task>(TABLES.TASKS, taskId)
    )
    
    const taskJobIds = task[TASK_FIELDS.job as keyof Task] as string[] | string
    const jobId = Array.isArray(taskJobIds) ? taskJobIds[0] : taskJobIds

    if (!jobId) {
      console.error('[EVIDENCE] Task has no job')
      return false
    }

    // Get job to verify ownership
    const job = await withRetry(async () => {
      const result = await client.getRecord(TABLES.JOBS, jobId)
      return result as unknown as Record<string, unknown>
    })
    
    const jobUserIds = job[JOB_FIELDS.user] as string[] | string | undefined
    if (!jobUserIds) {
      console.error('[EVIDENCE] Job has no user')
      return false
    }
    
    const userIds = Array.isArray(jobUserIds) ? jobUserIds : [jobUserIds]
    const isOwner = userIds.includes(userRecordId)
    
    console.log('[EVIDENCE] Ownership check:', isOwner)
    return isOwner
  } catch (error) {
    console.error('[EVIDENCE] Error verifying ownership:', error)
    return false
  }
}

// Helper: Extract single select value from SmartSuite format (option ID -> normalized string)
function extractSingleSelectValue(field: unknown, optionMap: Record<string, string>): string | null {
  if (!field) return null
  
  // If it's a string, check if it's an option ID we can look up
  if (typeof field === 'string') {
    // Try to look up in option map first
    if (optionMap[field]) {
      return optionMap[field]
    }
    // Log unknown option IDs so we can add them
    if (/^[a-zA-Z0-9]{5,6}$/.test(field)) {
      console.log('[EVIDENCE] Unknown option ID:', field, '- please add to mapping')
      return null
    }
    // It's already a readable label - normalize it
    return field.toLowerCase().replace(/\s+/g, '_')
  }
  
  // If it's an object with label/value
  if (typeof field === 'object' && field !== null) {
    const obj = field as Record<string, unknown>
    if (obj.label && typeof obj.label === 'string') {
      return obj.label.toLowerCase().replace(/\s+/g, '_')
    }
    if (obj.value && typeof obj.value === 'string') {
      // Try to look up value in option map
      if (optionMap[obj.value]) {
        return optionMap[obj.value]
      }
      if (!/^[a-zA-Z0-9]{5,6}$/.test(obj.value)) {
        return obj.value.toLowerCase().replace(/\s+/g, '_')
      }
    }
  }
  
  return null
}

// Helper: Transform evidence record to readable format
function transformEvidence(item: Record<string, unknown>): Record<string, unknown> {
  const taskIds = extractTaskIds(item[EVIDENCE_FIELDS.task])
  const taskId = taskIds.length > 0 ? taskIds[0] : taskIds

  // Handle captured_at date format
  let capturedAt = item[EVIDENCE_FIELDS.captured_at]
  if (capturedAt && typeof capturedAt === 'object' && 'date' in (capturedAt as Record<string, unknown>)) {
    capturedAt = (capturedAt as Record<string, unknown>).date
  }

  // Handle synced_at date format
  let syncedAt = item[EVIDENCE_FIELDS.synced_at]
  if (syncedAt && typeof syncedAt === 'object' && 'date' in (syncedAt as Record<string, unknown>)) {
    syncedAt = (syncedAt as Record<string, unknown>).date
  }

  // Handle isSynced checkbox field
  let isSynced = false
  const isSyncedField = item[EVIDENCE_FIELDS.is_synced]
  if (typeof isSyncedField === 'boolean') {
    isSynced = isSyncedField
  } else if (isSyncedField && typeof isSyncedField === 'object') {
    const obj = isSyncedField as Record<string, unknown>
    isSynced = (obj.completed_items as number) > 0
  }

  const evidenceType = extractSingleSelectValue(item[EVIDENCE_FIELDS.evidence_type], EVIDENCE_TYPE_OPTIONS)
  console.log('[EVIDENCE] Transform - raw:', item[EVIDENCE_FIELDS.evidence_type], '-> normalized:', evidenceType)

  return {
    id: item.id,
    taskId: taskId || null,
    evidenceType: evidenceType,
    photoStage: extractSingleSelectValue(item[EVIDENCE_FIELDS.photo_stage], PHOTO_STAGE_OPTIONS),
    photoUrl: item[EVIDENCE_FIELDS.photo_url] || null,
    photoHash: item[EVIDENCE_FIELDS.photo_hash] || null,
    notes: item[EVIDENCE_FIELDS.notes] || null,
    latitude: item[EVIDENCE_FIELDS.latitude] || null,
    longitude: item[EVIDENCE_FIELDS.longitude] || null,
    gpsAccuracy: item[EVIDENCE_FIELDS.gps_accuracy] || null,
    capturedAt: capturedAt || null,
    syncedAt: syncedAt || null,
    isSynced: isSynced
  }
}

// Get evidence by task ID
evidence.get('/task/:taskId', async (c) => {
  const auth = getAuth(c)
  const taskId = c.req.param('taskId')
  const client = getSmartSuiteClient()

  console.log('[EVIDENCE] GET /task/:taskId called - taskId:', taskId)

  try {
    const isOwner = await verifyTaskOwnership(taskId, auth.userId)
    if (!isOwner) {
      console.error('[EVIDENCE] Ownership check failed')
      return c.json({ error: 'Forbidden' }, 403)
    }

    const result = await withRetry(() => 
      client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 500 })
    )

    const filteredItems = result.items.filter((item) => {
      const evidenceTaskIds = extractTaskIds(item[EVIDENCE_FIELDS.task as keyof Evidence])
      return evidenceTaskIds.includes(taskId)
    })

    const transformedItems = filteredItems.map(item =>
      transformEvidence(item as unknown as Record<string, unknown>)
    )

    console.log('[EVIDENCE] Returning', transformedItems.length, 'items')
    return c.json({
      items: transformedItems,
      total: transformedItems.length
    })
  } catch (error) {
    console.error('[EVIDENCE] Error listing evidence:', error)
    return c.json({ error: 'Failed to list evidence' }, 500)
  }
})

// List evidence (query param version)
evidence.get('/', async (c) => {
  const auth = getAuth(c)
  const taskId = c.req.query('task_id')
  const client = getSmartSuiteClient()

  console.log('[EVIDENCE] GET / called - task_id:', taskId)

  if (!taskId) {
    return c.json({ error: 'Missing task_id parameter' }, 400)
  }

  try {
    const isOwner = await verifyTaskOwnership(taskId, auth.userId)
    if (!isOwner) {
      console.error('[EVIDENCE] Ownership check failed')
      return c.json({ error: 'Forbidden' }, 403)
    }

    const result = await withRetry(() => 
      client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 500 })
    )

    const filteredItems = result.items.filter((item) => {
      const evidenceTaskIds = extractTaskIds(item[EVIDENCE_FIELDS.task as keyof Evidence])
      return evidenceTaskIds.includes(taskId)
    })

    const transformedItems = filteredItems.map(item =>
      transformEvidence(item as unknown as Record<string, unknown>)
    )

    console.log('[EVIDENCE] Returning', transformedItems.length, 'items')
    return c.json({
      items: transformedItems,
      total: transformedItems.length
    })
  } catch (error) {
    console.error('[EVIDENCE] Error listing evidence:', error)
    return c.json({ error: 'Failed to list evidence' }, 500)
  }
})

// Get evidence counts by job
evidence.get('/counts-by-job', async (c) => {
  const auth = getAuth(c)
  const jobId = c.req.query('job_id')
  const client = getSmartSuiteClient()

  console.log('[EVIDENCE] GET /counts-by-job called - jobId:', jobId)

  if (!jobId) {
    return c.json({ error: 'Missing job_id parameter' }, 400)
  }

  try {
    // Get user record ID for ownership check
    const userRecordId = await getUserRecordId(auth.userId)
    if (!userRecordId) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Verify job ownership
    const job = await withRetry(async () => {
      const result = await client.getRecord(TABLES.JOBS, jobId)
      return result as unknown as Record<string, unknown>
    })
    
    const jobUserIds = job[JOB_FIELDS.user] as string[] | string | undefined
    const userIds = Array.isArray(jobUserIds) ? jobUserIds : [jobUserIds || '']
    
    if (!userIds.includes(userRecordId)) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Get all tasks for this job
    const tasksResult = await withRetry(() => 
      client.listRecords<Task>(TABLES.TASKS, { limit: 200 })
    )
    
    const jobTasks = tasksResult.items.filter(task => {
      const taskJobIds = task[TASK_FIELDS.job as keyof Task] as string[] | string
      const ids = Array.isArray(taskJobIds) ? taskJobIds : [taskJobIds]
      return ids.includes(jobId)
    })

    const taskIds = jobTasks.map(t => t.id)

    // Get all evidence
    const evidenceResult = await withRetry(() => 
      client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 500 })
    )

    // Count evidence per task
    const counts: Record<string, number> = {}
    taskIds.forEach(id => { counts[id] = 0 })

    evidenceResult.items.forEach(item => {
      const record = item as unknown as Record<string, unknown>
      const evidenceTaskIds = extractTaskIds(record[EVIDENCE_FIELDS.task])
      
      evidenceTaskIds.forEach(taskId => {
        if (taskIds.includes(taskId)) {
          counts[taskId] = (counts[taskId] || 0) + 1
        }
      })
    })

    return c.json({ counts })
  } catch (error) {
    console.error('[EVIDENCE] Error getting evidence counts:', error)
    return c.json({ error: 'Failed to get evidence counts' }, 500)
  }
})

// Get single evidence by ID
evidence.get('/:id', async (c) => {
  const auth = getAuth(c)
  const evidenceId = c.req.param('id')
  const client = getSmartSuiteClient()

  console.log('[EVIDENCE] GET /:id called - evidenceId:', evidenceId)

  try {
    const evidenceRecord = await withRetry(() => 
      client.getRecord<Evidence>(TABLES.EVIDENCE, evidenceId)
    )

    const taskIds = extractTaskIds(evidenceRecord[EVIDENCE_FIELDS.task as keyof Evidence])
    const taskId = taskIds[0]

    if (!taskId) {
      return c.json({ error: 'Evidence has no task' }, 400)
    }

    const isOwner = await verifyTaskOwnership(taskId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const transformed = transformEvidence(evidenceRecord as unknown as Record<string, unknown>)
    return c.json(transformed)
  } catch (error) {
    console.error('[EVIDENCE] Error fetching evidence:', error)
    return c.json({ error: 'Failed to fetch evidence' }, 500)
  }
})

// Get signed upload URL for R2
evidence.post('/upload-url', async (c) => {
  const auth = getAuth(c)

  console.log('[EVIDENCE] POST /upload-url called')

  try {
    const body = await c.req.json() as Record<string, unknown>
    const filename = body.filename as string
    const contentType = (body.content_type || body.contentType || 'image/jpeg') as string
    const taskId = (body.task_id || body.taskId) as string | undefined
    const jobId = (body.job_id || body.jobId) as string | undefined

    if (!filename) {
      return c.json({ error: 'Missing filename' }, 400)
    }

    // Generate unique key with better organization
    const timestamp = Date.now()
    const safeTaskId = taskId || 'unknown'
    const safeJobId = jobId || 'unknown'
    const key = `evidence/${auth.userId}/${safeJobId}/${safeTaskId}/${timestamp}-${filename}`

    const r2Client = getR2Client()
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType
    })

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 })

    const publicUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL}/${key}`
      : `https://${R2_BUCKET}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`

    console.log('[EVIDENCE] Generated upload URL for key:', key)

    return c.json({
      upload_url: uploadUrl,
      photo_url: publicUrl,
      key
    })
  } catch (error) {
    console.error('[EVIDENCE] Error generating upload URL:', error)
    return c.json({ error: 'Failed to generate upload URL' }, 500)
  }
})

// Create new evidence record
evidence.post('/', async (c) => {
  const auth = getAuth(c)
  const client = getSmartSuiteClient()

  console.log('[EVIDENCE] POST / called')

  try {
    const body = await c.req.json() as Record<string, unknown>
    
    console.log('[EVIDENCE] Request body:', JSON.stringify(body, null, 2))

    // Support both formats
    const taskId = (body.task_id || body.taskId) as string
    const evidenceTypeRaw = (body.evidence_type || body.evidenceType) as string
    const photoStageRaw = (body.photo_stage || body.photoStage) as string | undefined
    const notes = (body.notes as string | undefined)?.trim() || null
    const photoUrl = (body.photo_url || body.photoUrl) as string
    const photoHash = (body.photo_hash || body.photoHash) as string

    // Convert to SmartSuite option IDs
    const evidenceTypeOptionId = getEvidenceTypeOptionId(evidenceTypeRaw)
    const photoStageOptionId = photoStageRaw ? getPhotoStageOptionId(photoStageRaw) : undefined

    console.log('[EVIDENCE] Creating with:', { 
      taskId, 
      evidenceTypeRaw, 
      evidenceTypeOptionId,
      photoStageRaw, 
      photoStageOptionId
    })

    // Validate required fields
    if (!taskId || !evidenceTypeRaw || !photoUrl) {
      return c.json({ error: 'Missing required fields: task_id, evidence_type, photo_url' }, 400)
    }

    // Verify ownership
    const isOwner = await verifyTaskOwnership(taskId, auth.userId)
    if (!isOwner) {
      console.error('[EVIDENCE] Ownership check failed')
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Build evidence data with SmartSuite field IDs and option IDs
    const evidenceData: Record<string, unknown> = {
      title: `${evidenceTypeRaw} - ${Date.now()}`,
      [EVIDENCE_FIELDS.task]: [taskId],
      [EVIDENCE_FIELDS.evidence_type]: evidenceTypeOptionId,
      [EVIDENCE_FIELDS.photo_url]: photoUrl,
      [EVIDENCE_FIELDS.photo_hash]: photoHash || '',
      [EVIDENCE_FIELDS.captured_at]: (body.captured_at || body.capturedAt) as string || new Date().toISOString(),
      [EVIDENCE_FIELDS.synced_at]: new Date().toISOString(),
      [EVIDENCE_FIELDS.is_synced]: { checked: true }
    }

    // Add photo_stage if provided
    if (photoStageOptionId) {
      evidenceData[EVIDENCE_FIELDS.photo_stage] = photoStageOptionId
    }

    // Add notes if provided
    if (notes) {
      evidenceData[EVIDENCE_FIELDS.notes] = notes
      console.log('[EVIDENCE] Adding notes:', notes.slice(0, 50) + (notes.length > 50 ? '...' : ''))
    }

    // Add optional GPS fields
    if (body.latitude !== undefined || body.lat !== undefined) {
      evidenceData[EVIDENCE_FIELDS.latitude] = body.latitude || body.lat
    }
    if (body.longitude !== undefined || body.lng !== undefined || body.lon !== undefined) {
      evidenceData[EVIDENCE_FIELDS.longitude] = body.longitude || body.lng || body.lon
    }
    if (body.gps_accuracy !== undefined || body.gpsAccuracy !== undefined) {
      evidenceData[EVIDENCE_FIELDS.gps_accuracy] = body.gps_accuracy || body.gpsAccuracy
    }

    console.log('[EVIDENCE] Creating record with data:', JSON.stringify(evidenceData, null, 2))

    const newEvidence = await withRetry(() => 
      client.createRecord<Evidence>(TABLES.EVIDENCE, evidenceData as Partial<Evidence>)
    )

    const transformed = transformEvidence(newEvidence as unknown as Record<string, unknown>)
    
    console.log('[EVIDENCE] Created evidence:', transformed.id, 'with type:', transformed.evidenceType)
    return c.json(transformed, 201)
  } catch (error) {
    console.error('[EVIDENCE] Error creating evidence:', error)
    return c.json({ error: 'Failed to create evidence' }, 500)
  }
})

// Delete evidence
evidence.delete('/:id', async (c) => {
  const auth = getAuth(c)
  const evidenceId = c.req.param('id')
  const client = getSmartSuiteClient()

  console.log('[EVIDENCE] DELETE /:id called - evidenceId:', evidenceId)

  try {
    const evidenceRecord = await withRetry(() => 
      client.getRecord<Evidence>(TABLES.EVIDENCE, evidenceId)
    )

    const taskIds = extractTaskIds(evidenceRecord[EVIDENCE_FIELDS.task as keyof Evidence])
    const taskId = taskIds[0]

    if (!taskId) {
      return c.json({ error: 'Evidence has no task' }, 400)
    }

    const isOwner = await verifyTaskOwnership(taskId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await withRetry(() => 
      client.deleteRecord(TABLES.EVIDENCE, evidenceId)
    )

    return c.json({ success: true })
  } catch (error) {
    console.error('[EVIDENCE] Error deleting evidence:', error)
    return c.json({ error: 'Failed to delete evidence' }, 500)
  }
})

export default evidence
