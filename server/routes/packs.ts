import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import { TASK_FIELDS, EVIDENCE_FIELDS } from '../lib/smartsuite-fields.js'
import { authMiddleware, getAuth } from '../middleware/auth.js'
import { rateLimitMiddleware } from '../middleware/rateLimit.js'
import type { Job, Task, Evidence } from '../types/index.js'

const packs = new Hono()

// Apply middleware
packs.use('*', rateLimitMiddleware)
packs.use('*', authMiddleware)

// Helper: Get user record ID by fetching all and filtering in memory
async function getUserRecordId(clerkId: string): Promise<string | null> {
  const client = getSmartSuiteClient()
  // Fetch users and filter in memory to avoid SmartSuite filter format issues
  const result = await client.listRecords(TABLES.USERS, { limit: 100 })
  const user = result.items.find((u: Record<string, unknown>) => {
    return u['sca232a6e1'] === clerkId
  })
  return user?.id || null
}

// Helper: Verify job ownership
async function verifyJobOwnership(jobId: string, clerkId: string): Promise<boolean> {
  const client = getSmartSuiteClient()
  const userRecordId = await getUserRecordId(clerkId)
  
  if (!userRecordId) {
    console.log('[PACKS] User not found for clerk ID:', clerkId)
    return false
  }

  try {
    const job = await client.getRecord(TABLES.JOBS, jobId) as unknown as Record<string, unknown>
    const jobUserIds = job['s11e8c3905'] as string[] | string | undefined
    if (!jobUserIds) return false
    
    const userIds = Array.isArray(jobUserIds) ? jobUserIds : [jobUserIds]
    return userIds.includes(userRecordId)
  } catch {
    return false
  }
}

// Helper: Extract task IDs from linked record
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

// Generate PDF audit pack - test version returns JSON
packs.get('/:jobId/pdf', async (c) => {
  console.log('[PACKS] PDF endpoint hit')
  
  const auth = getAuth(c)
  const jobId = c.req.param('jobId')

  console.log('[PACKS] Job ID:', jobId)
  console.log('[PACKS] User ID:', auth.userId)

  try {
    // Verify ownership
    console.log('[PACKS] Verifying ownership...')
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      console.log('[PACKS] Ownership failed')
      return c.json({ error: 'Forbidden' }, 403)
    }

    console.log('[PACKS] Ownership verified, returning test response')
    
    // For now, just return JSON to confirm the route works
    return c.json({ 
      message: 'PDF endpoint working',
      jobId,
      userId: auth.userId,
      note: 'PDFKit will be added once route is confirmed working'
    })

  } catch (error) {
    console.error('[PACKS] Error:', error)
    return c.json({ error: 'Failed to generate PDF', details: String(error) }, 500)
  }
})

// Get pack summary (for preview)
packs.get('/:jobId', async (c) => {
  const auth = getAuth(c)
  const jobId = c.req.param('jobId')
  const client = getSmartSuiteClient()

  try {
    // Verify ownership
    const isOwner = await verifyJobOwnership(jobId, auth.userId)
    if (!isOwner) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Get job details
    const job = await client.getRecord<Job>(TABLES.JOBS, jobId)

    // Get tasks
    const tasksResult = await client.listRecords<Task>(TABLES.TASKS, { limit: 100 })
    const jobTasks = tasksResult.items.filter(task => {
      const taskRecord = task as unknown as Record<string, unknown>
      const taskJobIds = taskRecord[TASK_FIELDS.job] as string[] | string | undefined
      if (!taskJobIds) return false
      const jobIds = Array.isArray(taskJobIds) ? taskJobIds : [taskJobIds]
      return jobIds.includes(jobId)
    })

    // Get evidence counts
    const evidenceResult = await client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 500 })
    const taskIds = jobTasks.map(t => t.id)
    
    let totalEvidence = 0
    evidenceResult.items.forEach(item => {
      const record = item as unknown as Record<string, unknown>
      const evidenceTaskIds = extractTaskIds(record[EVIDENCE_FIELDS.task])
      evidenceTaskIds.forEach(taskId => {
        if (taskIds.includes(taskId)) {
          totalEvidence++
        }
      })
    })

    return c.json({
      job,
      taskCount: jobTasks.length,
      evidenceCount: totalEvidence
    })
  } catch (error) {
    console.error('Error getting pack summary:', error)
    return c.json({ error: 'Failed to get pack summary' }, 500)
  }
})

export default packs
