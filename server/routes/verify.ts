import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import { AUDIT_PACK_FIELDS, JOB_FIELDS, EVIDENCE_FIELDS, TASK_FIELDS } from '../lib/smartsuite-fields.js'
import type { AuditPack, Job, Evidence, Task } from '../types/index.js'

const verify = new Hono()

// NO AUTH MIDDLEWARE - This route is intentionally public

// Photo Stage option ID -> label mapping
const PHOTO_STAGE_OPTIONS: Record<string, string> = {
  'DZX3Z': 'before',
  'U6zl3': 'after',
  'cDYca': 'during',
}

// Helper: Extract linked record ID
function extractLinkedId(field: unknown): string | null {
  if (!field) return null
  if (Array.isArray(field) && field.length > 0) {
    const first = field[0]
    if (typeof first === 'string') return first
    if (typeof first === 'object' && first !== null && 'id' in first) {
      return (first as { id: string }).id
    }
  }
  if (typeof field === 'string') return field
  return null
}

// Helper: Extract photo stage from evidence
function extractPhotoStage(evidence: Record<string, unknown>): string | null {
  const stageField = evidence[EVIDENCE_FIELDS.photo_stage]
  if (!stageField) return null
  
  if (typeof stageField === 'string') {
    return PHOTO_STAGE_OPTIONS[stageField] || stageField.toLowerCase()
  }
  
  if (typeof stageField === 'object' && stageField !== null) {
    const obj = stageField as Record<string, unknown>
    if (obj.value && typeof obj.value === 'string') {
      return PHOTO_STAGE_OPTIONS[obj.value] || null
    }
  }
  
  return null
}

// Helper: Calculate GPS summary from evidence
function calculateGpsSummary(evidenceItems: Record<string, unknown>[]): {
  latitude: number
  longitude: number
  radius: number
} | null {
  const coords: { lat: number; lng: number }[] = []
  
  evidenceItems.forEach(ev => {
    const lat = ev[EVIDENCE_FIELDS.latitude]
    const lng = ev[EVIDENCE_FIELDS.longitude]
    
    if (typeof lat === 'number' && typeof lng === 'number') {
      coords.push({ lat, lng })
    }
  })
  
  if (coords.length === 0) return null
  
  // Calculate centroid
  const sumLat = coords.reduce((sum, c) => sum + c.lat, 0)
  const sumLng = coords.reduce((sum, c) => sum + c.lng, 0)
  const centerLat = sumLat / coords.length
  const centerLng = sumLng / coords.length
  
  // Calculate max distance from centroid (in meters)
  let maxDistance = 0
  coords.forEach(c => {
    const distance = haversineDistance(centerLat, centerLng, c.lat, c.lng)
    if (distance > maxDistance) maxDistance = distance
  })
  
  return {
    latitude: centerLat,
    longitude: centerLng,
    radius: Math.ceil(maxDistance)
  }
}

// Haversine formula for distance in meters
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Helper: Generate verification hash from evidence
async function generateVerificationHash(evidenceItems: Record<string, unknown>[]): Promise<string> {
  // Concatenate all evidence hashes in order
  const hashes = evidenceItems
    .map(ev => ev[EVIDENCE_FIELDS.photo_hash] as string || '')
    .filter(h => h)
    .sort()
    .join('|')
  
  // Hash the combined string
  const encoder = new TextEncoder()
  const data = encoder.encode(hashes)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// GET /api/verify/:packId - Public verification endpoint
verify.get('/:packId', async (c) => {
  const packId = c.req.param('packId')
  const client = getSmartSuiteClient()

  console.log('[VERIFY] Verification request for pack:', packId)

  try {
    // Get audit pack
    const pack = await client.getRecord<AuditPack>(TABLES.AUDIT_PACKS, packId)
    
    if (!pack) {
      return c.json({ error: 'Pack not found' }, 404)
    }

    // Get linked job
    const jobId = extractLinkedId(pack[AUDIT_PACK_FIELDS.job as keyof AuditPack])
    if (!jobId) {
      return c.json({ error: 'Pack has no associated job' }, 404)
    }

    const job = await client.getRecord<Job>(TABLES.JOBS, jobId)
    if (!job) {
      return c.json({ error: 'Job not found' }, 404)
    }

    // Get all tasks for this job
    const tasksResult = await client.listRecords<Task>(TABLES.TASKS, { limit: 100 })
    const jobTasks = tasksResult.items.filter(task => {
      const taskJobId = extractLinkedId(task[TASK_FIELDS.job as keyof Task])
      return taskJobId === jobId
    })
    const taskIds = jobTasks.map(t => t.id)

    // Get all evidence for these tasks
    const evidenceResult = await client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 500 })
    const jobEvidence = evidenceResult.items.filter(ev => {
      const evTaskId = extractLinkedId(ev[EVIDENCE_FIELDS.task as keyof Evidence])
      return evTaskId && taskIds.includes(evTaskId)
    })

    // Calculate evidence summary
    const evidenceSummary = {
      beforeCount: 0,
      duringCount: 0,
      afterCount: 0,
      customCount: 0
    }

    jobEvidence.forEach(ev => {
      const stage = extractPhotoStage(ev as unknown as Record<string, unknown>)
      
      if (stage === 'before') evidenceSummary.beforeCount++
      else if (stage === 'during') evidenceSummary.duringCount++
      else if (stage === 'after') evidenceSummary.afterCount++
      
      // Check for custom/additional evidence
      const evidenceType = ev[EVIDENCE_FIELDS.evidence_type as keyof Evidence]
      if (evidenceType === 'Dxpai' || evidenceType === 'additional_evidence') {
        evidenceSummary.customCount++
      }
    })

    // Calculate GPS summary
    const gpsSummary = calculateGpsSummary(jobEvidence as unknown as Record<string, unknown>[])
    
    // Check GPS verification (all photos have GPS)
    const gpsVerified = jobEvidence.every(ev => {
      const lat = ev[EVIDENCE_FIELDS.latitude as keyof Evidence]
      const lng = ev[EVIDENCE_FIELDS.longitude as keyof Evidence]
      return lat !== null && lat !== undefined && lng !== null && lng !== undefined
    })

    // Generate verification hash
    const computedHash = await generateVerificationHash(jobEvidence as unknown as Record<string, unknown>[])
    const storedHash = pack[AUDIT_PACK_FIELDS.hash as keyof AuditPack] as string || ''
    
    // Hash is valid if stored hash matches computed, or if no stored hash (legacy packs)
    const hashValid = !storedHash || storedHash === computedHash

    // Extract generation date
    let generatedAt = pack[AUDIT_PACK_FIELDS.generated_at as keyof AuditPack]
    if (generatedAt && typeof generatedAt === 'object' && 'date' in (generatedAt as Record<string, unknown>)) {
      generatedAt = (generatedAt as Record<string, unknown>).date as string
    }

    // Get job title - SmartSuite stores title directly, not via field ID
    const jobRecord = job as unknown as Record<string, unknown>
    const jobTitle = (jobRecord.title as string) || 
                     (job[JOB_FIELDS.client_name as keyof Job] as string) || 
                     'Untitled Job'

    // Build response
    const response = {
      verified: hashValid && gpsVerified,
      packId: pack.id,
      jobTitle: jobTitle,
      clientName: job[JOB_FIELDS.client_name as keyof Job] || 'Unknown Client',
      address: job[JOB_FIELDS.address as keyof Job] || '',
      postcode: job[JOB_FIELDS.postcode as keyof Job] || '',
      generatedAt: generatedAt || new Date().toISOString(),
      evidenceCount: jobEvidence.length,
      hashValid,
      packHash: computedHash.slice(0, 16) + '...' + computedHash.slice(-16),
      gpsVerified,
      gpsSummary,
      evidenceSummary
    }

    console.log('[VERIFY] Verification complete:', response.verified ? 'VALID' : 'INVALID')
    return c.json(response)

  } catch (error) {
    console.error('[VERIFY] Error verifying pack:', error)
    return c.json({ error: 'Verification failed' }, 500)
  }
})

export default verify
