/**
 * Packs API Route
 * Server-side aggregation with Redis caching for fast pack listing
 * Single endpoint replaces multiple client-side API calls
 */
import { Hono } from 'hono'
import { Redis } from '@upstash/redis'

const packsApi = new Hono()

// Initialize Redis (uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || ''
})

// SmartSuite config
const SMARTSUITE_API = 'https://app.smartsuite.com/api/v1'
const SMARTSUITE_KEY = process.env.SMARTSUITE_API_KEY || ''
const SMARTSUITE_ACCOUNT = process.env.SMARTSUITE_ACCOUNT_ID || ''

// Table IDs
const JOBS_TABLE_ID = process.env.SMARTSUITE_JOBS_TABLE_ID || ''
const TASKS_TABLE_ID = process.env.SMARTSUITE_TASKS_TABLE_ID || ''
const EVIDENCE_TABLE_ID = process.env.SMARTSUITE_EVIDENCE_TABLE_ID || ''

// Cache TTL in seconds (5 minutes - balances freshness with speed)
const CACHE_TTL = 300

interface PackJob {
  id: string
  clientName: string
  address: string
  startDate: string
  status: string
  tasks: Array<{
    id: string
    taskType: string
  }>
  totalEvidence: number
  totalRequired: number
  isComplete: boolean
}

// Task type config for required evidence counts
const TASK_REQUIRED_EVIDENCE: Record<string, number> = {
  'consumer_unit_upgrade': 7,
  'socket_outlet': 4,
  'lighting_circuit': 4,
  'shower_installation': 5,
  'ev_charger': 6,
  'smoke_alarm': 4,
  'full_rewire': 8,
  'eicr_inspection': 5,
  'fault_finding': 4,
  'default': 5
}

// Helper to call SmartSuite API
async function smartSuiteRequest(
  endpoint: string, 
  method: string = 'POST', 
  body?: Record<string, unknown>
): Promise<unknown> {
  const response = await fetch(`${SMARTSUITE_API}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Token ${SMARTSUITE_KEY}`,
      'Account-Id': SMARTSUITE_ACCOUNT,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })

  if (!response.ok) {
    throw new Error(`SmartSuite API error: ${response.status}`)
  }

  return response.json()
}

// Get all packs with full details
packsApi.get('/list', async (c) => {
  try {
    // Check auth
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401 as const)
    }

    // Extract user ID from token for user-specific cache key
    // For now, use a general cache key (can be enhanced for multi-user)
    const cacheKey = 'packs:list:all'

    // Try to get from cache first
    try {
      const cached = await redis.get<PackJob[]>(cacheKey)
      if (cached) {
        console.log('[Packs API] Cache hit')
        return c.json({ 
          items: cached, 
          cached: true,
          cachedAt: new Date().toISOString()
        })
      }
    } catch (cacheError) {
      console.error('[Packs API] Cache read error:', cacheError)
      // Continue without cache
    }

    console.log('[Packs API] Cache miss - fetching from SmartSuite')

    // Fetch all jobs
    const jobsResponse = await smartSuiteRequest(
      `/applications/${JOBS_TABLE_ID}/records/list/`,
      'POST',
      { 
        sort: [{ field: 'first_created', direction: 'desc' }],
        limit: 100
      }
    ) as { items: Array<Record<string, unknown>> }

    const jobs = jobsResponse.items || []

    if (jobs.length === 0) {
      return c.json({ items: [], cached: false })
    }

    // Get all job IDs
    const jobIds = jobs.map(j => j.id as string)

    // Fetch all tasks for these jobs in one call
    const tasksResponse = await smartSuiteRequest(
      `/applications/${TASKS_TABLE_ID}/records/list/`,
      'POST',
      {
        filter: {
          operator: 'or',
          fields: jobIds.map(id => ({
            field: 'job_id',
            comparison: 'is',
            value: id
          }))
        },
        limit: 500
      }
    ) as { items: Array<Record<string, unknown>> }

    const tasks = tasksResponse.items || []

    // Get all task IDs
    const taskIds = tasks.map(t => t.id as string)

    // Fetch evidence counts for all tasks in one call
    let evidenceCounts: Record<string, number> = {}
    
    if (taskIds.length > 0) {
      const evidenceResponse = await smartSuiteRequest(
        `/applications/${EVIDENCE_TABLE_ID}/records/list/`,
        'POST',
        {
          filter: {
            operator: 'or',
            fields: taskIds.map(id => ({
              field: 'task_id',
              comparison: 'is',
              value: id
            }))
          },
          limit: 1000
        }
      ) as { items: Array<Record<string, unknown>> }

      const evidence = evidenceResponse.items || []
      
      // Count evidence per task
      evidence.forEach(e => {
        // Handle linked record format - task_id might be array or string
        let taskId: string | undefined
        const taskIdField = e.task_id
        
        if (Array.isArray(taskIdField) && taskIdField.length > 0) {
          taskId = taskIdField[0] as string
        } else if (typeof taskIdField === 'string') {
          taskId = taskIdField
        }
        
        if (taskId) {
          evidenceCounts[taskId] = (evidenceCounts[taskId] || 0) + 1
        }
      })
    }

    // Group tasks by job
    const tasksByJob: Record<string, Array<{ id: string; taskType: string }>> = {}
    tasks.forEach(t => {
      // Handle linked record format for job_id
      let jobId: string | undefined
      const jobIdField = t.job_id
      
      if (Array.isArray(jobIdField) && jobIdField.length > 0) {
        jobId = jobIdField[0] as string
      } else if (typeof jobIdField === 'string') {
        jobId = jobIdField
      }
      
      if (jobId) {
        if (!tasksByJob[jobId]) {
          tasksByJob[jobId] = []
        }
        tasksByJob[jobId].push({
          id: t.id as string,
          taskType: (t.task_type as string) || 'default'
        })
      }
    })

    // Build pack list
    const packs: PackJob[] = jobs.map(job => {
      const jobId = job.id as string
      const jobTasks = tasksByJob[jobId] || []
      
      // Calculate totals
      let totalEvidence = 0
      let totalRequired = 0
      
      jobTasks.forEach(task => {
        totalEvidence += evidenceCounts[task.id] || 0
        totalRequired += TASK_REQUIRED_EVIDENCE[task.taskType] || TASK_REQUIRED_EVIDENCE.default
      })

      const isComplete = totalRequired > 0 && totalEvidence >= totalRequired

      // Extract client name from structured field
      let clientName = 'Unknown Client'
      const clientField = job.client_name
      if (clientField) {
        if (typeof clientField === 'object' && clientField !== null) {
          const cf = clientField as Record<string, unknown>
          clientName = (cf.first_name || cf.full_name || cf.title || 'Unknown Client') as string
        } else if (typeof clientField === 'string') {
          clientName = clientField
        }
      }

      // Extract date
      let startDate = ''
      const dateField = job.start_date
      if (dateField) {
        if (typeof dateField === 'object' && dateField !== null) {
          startDate = ((dateField as Record<string, unknown>).date as string) || ''
        } else if (typeof dateField === 'string') {
          startDate = dateField
        }
      }

      return {
        id: jobId,
        clientName,
        address: (job.address as string) || '',
        startDate,
        status: (job.status as string) || 'active',
        tasks: jobTasks,
        totalEvidence,
        totalRequired,
        isComplete
      }
    })

    // Cache the result
    try {
      await redis.set(cacheKey, packs, { ex: CACHE_TTL })
      console.log('[Packs API] Cached result for', CACHE_TTL, 'seconds')
    } catch (cacheError) {
      console.error('[Packs API] Cache write error:', cacheError)
      // Continue without caching
    }

    return c.json({ 
      items: packs, 
      cached: false,
      fetchedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Packs API] Error:', error)
    return c.json({ error: 'Failed to fetch packs' }, 500 as const)
  }
})

// Invalidate cache (call after job/task/evidence changes)
packsApi.post('/invalidate-cache', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401 as const)
    }

    await redis.del('packs:list:all')
    console.log('[Packs API] Cache invalidated')
    
    return c.json({ success: true, message: 'Cache invalidated' })
  } catch (error) {
    console.error('[Packs API] Cache invalidation error:', error)
    return c.json({ error: 'Failed to invalidate cache' }, 500 as const)
  }
})

export default packsApi
