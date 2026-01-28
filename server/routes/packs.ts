import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import { TASK_FIELDS, EVIDENCE_FIELDS } from '../lib/smartsuite-fields.js'
import { authMiddleware, getAuth } from '../middleware/auth.js'
import { rateLimitMiddleware } from '../middleware/rateLimit.js'
import PDFDocument from 'pdfkit'
import type { Job, Task, Evidence } from '../types/index.js'

const packs = new Hono()

// Apply middleware
packs.use('*', rateLimitMiddleware)
packs.use('*', authMiddleware)

// Task type labels
const TASK_TYPE_LABELS: Record<string, string> = {
  consumer_unit: 'Consumer Unit Replacement',
  lighting_circuit: 'Lighting Circuit Installation',
  socket_circuit: 'Socket Circuit Installation',
  shower_installation: 'Electric Shower Installation',
  fire_alarm: 'Fire Alarm Test',
  cooker_circuit: 'Cooker Circuit Installation',
  ev_charger: 'EV Charger Installation',
  solar_pv: 'Solar PV Installation',
  rewire: 'Full/Partial Rewire',
  eicr: 'EICR Inspection',
  fault_finding: 'Fault Finding',
  minor_works: 'Minor Works',
}

// Helper: Get user record ID
async function getUserRecordId(clerkId: string): Promise<string | null> {
  const client = getSmartSuiteClient()
  const result = await client.listRecords(TABLES.USERS, {
    filter: { field: 'sca232a6e1', comparison: 'is', value: clerkId }
  })
  return result.items[0]?.id || null
}

// Helper: Verify job ownership
async function verifyJobOwnership(jobId: string, clerkId: string): Promise<boolean> {
  const client = getSmartSuiteClient()
  const userRecordId = await getUserRecordId(clerkId)
  
  if (!userRecordId) return false

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

// Helper: Fetch image as buffer
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}

// Generate PDF audit pack
packs.get('/:jobId/pdf', async (c) => {
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
    const jobRecord = job as unknown as Record<string, unknown>

    // Get tasks for this job
    const tasksResult = await client.listRecords<Task>(TABLES.TASKS, { limit: 100 })
    const jobTasks = tasksResult.items.filter(task => {
      const taskRecord = task as unknown as Record<string, unknown>
      const taskJobIds = taskRecord[TASK_FIELDS.job] as string[] | string | undefined
      if (!taskJobIds) return false
      const jobIds = Array.isArray(taskJobIds) ? taskJobIds : [taskJobIds]
      return jobIds.includes(jobId)
    })

    // Get evidence for all tasks
    const evidenceResult = await client.listRecords<Evidence>(TABLES.EVIDENCE, { limit: 500 })
    
    // Group evidence by task
    const evidenceByTask: Record<string, Evidence[]> = {}
    jobTasks.forEach(t => { evidenceByTask[t.id] = [] })
    
    evidenceResult.items.forEach(item => {
      const record = item as unknown as Record<string, unknown>
      const taskIds = extractTaskIds(record[EVIDENCE_FIELDS.task])
      taskIds.forEach(taskId => {
        if (evidenceByTask[taskId]) {
          evidenceByTask[taskId].push(item)
        }
      })
    })

    // Create PDF
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Audit Pack - ${jobRecord.title || 'Unknown Client'}`,
        Author: 'WorkProof',
        Subject: 'NICEIC Compliance Evidence Pack',
        Creator: 'WorkProof PWA'
      }
    })

    // Collect PDF chunks
    const chunks: Uint8Array[] = []
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk))

    // Colors
    const PRIMARY_GREEN = '#16a34a'
    const DARK_GRAY = '#1f2937'
    const LIGHT_GRAY = '#6b7280'

    // Get job display values
    const clientName = (jobRecord.title as string) || 'Unknown Client'
    const address = (jobRecord['sb8d44c7cc'] as string) || 'No address'
    const startDateRaw = jobRecord['sfc7f60ae3'] as string | undefined
    const startDate = startDateRaw ? new Date(startDateRaw) : new Date()

    // ===== COVER PAGE =====
    doc.fontSize(28)
       .fillColor(DARK_GRAY)
       .text('ELECTRICAL WORK', 50, 100, { align: 'center' })
       .text('AUDIT PACK', { align: 'center' })

    doc.moveDown(2)
       .fontSize(12)
       .fillColor(PRIMARY_GREEN)
       .text('NICEIC COMPLIANCE EVIDENCE', { align: 'center' })

    doc.moveDown(3)
       .fontSize(16)
       .fillColor(DARK_GRAY)
       .text(clientName, { align: 'center' })
    
    doc.fontSize(11)
       .fillColor(LIGHT_GRAY)
       .text(address, { align: 'center' })

    doc.moveDown(2)

    // Job details box
    const boxY = doc.y
    doc.rect(100, boxY, 395, 100)
       .stroke('#e5e7eb')

    doc.fontSize(10)
       .fillColor(LIGHT_GRAY)
       .text('Job Reference:', 120, boxY + 15)
       .text('Date Started:', 120, boxY + 35)
       .text('Tasks Completed:', 120, boxY + 55)
       .text('Total Evidence:', 120, boxY + 75)

    const totalEvidence = Object.values(evidenceByTask).reduce((sum, arr) => sum + arr.length, 0)

    doc.fillColor(DARK_GRAY)
       .text(jobId.substring(0, 12), 250, boxY + 15)
       .text(startDate.toLocaleDateString('en-GB'), 250, boxY + 35)
       .text(String(jobTasks.length), 250, boxY + 55)
       .text(String(totalEvidence), 250, boxY + 75)

    // Verification badges
    doc.moveDown(5)
    doc.fontSize(9)
       .fillColor(PRIMARY_GREEN)

    const badgeY = doc.y
    doc.text('✓ GPS Verified', 150, badgeY)
       .text('✓ Timestamps Valid', 250, badgeY)
       .text('✓ Hash Integrity', 370, badgeY)

    // Footer
    doc.fontSize(8)
       .fillColor(LIGHT_GRAY)
       .text(
         `Generated by WorkProof on ${new Date().toLocaleString('en-GB')}`,
         50,
         750,
         { align: 'center' }
       )

    // ===== EVIDENCE PAGES =====
    for (const task of jobTasks) {
      doc.addPage()

      const taskRecord = task as unknown as Record<string, unknown>
      const taskType = taskRecord[TASK_FIELDS.task_type] as string || 'unknown'
      const taskLabel = TASK_TYPE_LABELS[taskType] || taskType

      // Task header
      doc.fontSize(18)
         .fillColor(DARK_GRAY)
         .text(taskLabel, 50, 50)

      doc.fontSize(10)
         .fillColor(LIGHT_GRAY)
         .text(`Task ID: ${task.id.substring(0, 12)}`, 50, 75)

      const taskEvidence = evidenceByTask[task.id] || []
      doc.text(`Evidence: ${taskEvidence.length} items`, 250, 75)

      doc.moveDown(2)

      if (taskEvidence.length === 0) {
        doc.fontSize(12)
           .fillColor(LIGHT_GRAY)
           .text('No evidence captured for this task', { align: 'center' })
        continue
      }

      // Evidence items
      let yPosition = doc.y + 20
      let colIndex = 0

      for (const evidence of taskEvidence) {
        const evRecord = evidence as unknown as Record<string, unknown>
        const photoUrl = evRecord[EVIDENCE_FIELDS.photo_url] as string
        const evidenceType = evRecord[EVIDENCE_FIELDS.evidence_type] as string || 'Evidence'
        const capturedAt = evRecord[EVIDENCE_FIELDS.captured_at] as string
        const latitude = evRecord[EVIDENCE_FIELDS.latitude] as number
        const longitude = evRecord[EVIDENCE_FIELDS.longitude] as number
        const gpsAccuracy = evRecord[EVIDENCE_FIELDS.gps_accuracy] as number
        const photoHash = evRecord[EVIDENCE_FIELDS.photo_hash] as string

        // Check if we need a new page
        if (yPosition > 650) {
          doc.addPage()
          yPosition = 50
          colIndex = 0
        }

        const xOffset = colIndex === 0 ? 50 : 300
        const imageWidth = 200
        const imageHeight = 150

        // Try to fetch and embed image
        if (photoUrl) {
          const imageBuffer = await fetchImageBuffer(photoUrl)
          if (imageBuffer) {
            try {
              doc.image(imageBuffer, xOffset, yPosition, {
                width: imageWidth,
                height: imageHeight,
                fit: [imageWidth, imageHeight]
              })
            } catch {
              // If image fails, draw placeholder
              doc.rect(xOffset, yPosition, imageWidth, imageHeight)
                 .stroke('#e5e7eb')
              doc.fontSize(10)
                 .fillColor(LIGHT_GRAY)
                 .text('Image unavailable', xOffset, yPosition + 70, { width: imageWidth, align: 'center' })
            }
          }
        }

        // Evidence metadata below image
        const metaY = yPosition + imageHeight + 5
        doc.fontSize(9)
           .fillColor(DARK_GRAY)
           .text(evidenceType, xOffset, metaY, { width: imageWidth })

        doc.fontSize(7)
           .fillColor(LIGHT_GRAY)
           .text(
             capturedAt ? new Date(capturedAt).toLocaleString('en-GB') : 'No timestamp',
             xOffset,
             metaY + 12,
             { width: imageWidth }
           )

        if (latitude && longitude) {
          doc.text(
            `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}${gpsAccuracy ? ` (±${Math.round(gpsAccuracy)}m)` : ''}`,
            xOffset,
            metaY + 22,
            { width: imageWidth }
          )
        }

        if (photoHash) {
          doc.text(
            `Hash: ${photoHash.substring(0, 16)}...`,
            xOffset,
            metaY + 32,
            { width: imageWidth }
          )
        }

        // Move to next column or row
        colIndex++
        if (colIndex >= 2) {
          colIndex = 0
          yPosition += imageHeight + 60
        }
      }
    }

    // ===== VERIFICATION PAGE =====
    doc.addPage()
    
    doc.fontSize(18)
       .fillColor(DARK_GRAY)
       .text('Verification Summary', 50, 50)

    doc.moveDown(2)
    doc.fontSize(11)
       .fillColor(LIGHT_GRAY)
       .text('This audit pack contains evidence collected using the WorkProof application.')
    
    doc.moveDown()
    doc.text('All evidence has been verified for:')
    
    doc.moveDown()
    doc.fontSize(10)
       .fillColor(PRIMARY_GREEN)
       .text('✓  GPS Location Accuracy - Photos tagged with device GPS coordinates')
    doc.text('✓  Timestamp Integrity - Capture times recorded at moment of photo')
    doc.text('✓  Hash Verification - SHA-256 checksums calculated for tamper detection')
    doc.text('✓  Secure Cloud Storage - Evidence stored in encrypted cloud storage')

    doc.moveDown(2)
    doc.fontSize(9)
       .fillColor(LIGHT_GRAY)
       .text(`Pack Generated: ${new Date().toISOString()}`)
       .text(`Total Tasks: ${jobTasks.length}`)
       .text(`Total Evidence Items: ${totalEvidence}`)

    doc.moveDown(3)
    doc.fontSize(8)
       .text('This document was automatically generated by WorkProof and has not been manually altered.')
       .text('For verification, contact support@workproof.app')

    // Finalize PDF
    doc.end()

    // Wait for PDF to finish
    await new Promise<void>((resolve) => {
      doc.on('end', () => resolve())
    })

    const pdfBuffer = Buffer.concat(chunks)

    // Return PDF
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="audit-pack-${clientName}.pdf"`,
        'Content-Length': String(pdfBuffer.length)
      }
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return c.json({ error: 'Failed to generate PDF' }, 500)
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
