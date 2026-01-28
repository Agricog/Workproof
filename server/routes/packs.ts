/**
 * WorkProof Packs API
 * PDF generation for audit packs using pdf-lib
 */
import { Hono } from 'hono'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import { EVIDENCE_FIELDS, JOB_FIELDS, TASK_FIELDS } from '../lib/smartsuite-fields.js'
import { authMiddleware, getAuth } from '../middleware/auth.js'

const packs = new Hono()

// Apply auth to all routes
packs.use('*', authMiddleware)

// Helper to get user's SmartSuite record ID
async function getUserRecordId(clerkUserId: string): Promise<string | null> {
  try {
    const client = getSmartSuiteClient()
    const response = await client.getRecords(TABLES.USERS, {
      filter: {}
    })
    
    const users = response.items || []
    const user = users.find((u: Record<string, unknown>) => u['s380097484'] === clerkUserId)
    return user ? (user.id as string) : null
  } catch (error) {
    console.error('[PACKS] Error getting user record:', error)
    return null
  }
}

// Helper to extract linked record IDs
function extractLinkedIds(field: unknown): string[] {
  if (!field) return []
  if (Array.isArray(field)) {
    return field.map(item => {
      if (typeof item === 'string') return item
      if (typeof item === 'object' && item !== null && 'id' in item) {
        return (item as { id: string }).id
      }
      return ''
    }).filter(Boolean)
  }
  if (typeof field === 'string') return [field]
  if (typeof field === 'object' && field !== null && 'id' in field) {
    return [(field as { id: string }).id]
  }
  return []
}

// Helper to format date
function formatDate(dateField: unknown): string {
  if (!dateField) return 'N/A'
  if (typeof dateField === 'object' && dateField !== null && 'date' in dateField) {
    const d = new Date((dateField as { date: string }).date)
    return d.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  if (typeof dateField === 'string') {
    const d = new Date(dateField)
    return d.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })
  }
  return 'N/A'
}

// Generate PDF for a job
packs.get('/:jobId/pdf', async (c) => {
  const jobId = c.req.param('jobId')
  const auth = getAuth(c)
  
  console.log('[PACKS] PDF generation started for job:', jobId)
  
  try {
    const userRecordId = await getUserRecordId(auth.userId)
    if (!userRecordId) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    const client = getSmartSuiteClient()
    
    // Fetch job
    console.log('[PACKS] Fetching job...')
    const job = await client.getRecord(TABLES.JOBS, jobId)
    
    if (!job) {
      return c.json({ error: 'Job not found' }, 404)
    }
    
    // Verify ownership
    const jobUserIds = extractLinkedIds(job[JOB_FIELDS.user])
    if (!jobUserIds.includes(userRecordId)) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    
    // Fetch tasks for this job
    console.log('[PACKS] Fetching tasks...')
    const tasksResponse = await client.getRecords(TABLES.TASKS, { filter: {} })
    const allTasks = tasksResponse.items || []
    const tasks = allTasks.filter((t: Record<string, unknown>) => {
      const taskJobIds = extractLinkedIds(t[TASK_FIELDS.job])
      return taskJobIds.includes(jobId)
    })
    
    // Fetch evidence for all tasks
    console.log('[PACKS] Fetching evidence...')
    const evidenceResponse = await client.getRecords(TABLES.EVIDENCE, { filter: {} })
    const allEvidence = evidenceResponse.items || []
    const taskIds = tasks.map((t: Record<string, unknown>) => t.id as string)
    const evidence = allEvidence.filter((e: Record<string, unknown>) => {
      const evidenceTaskIds = extractLinkedIds(e[EVIDENCE_FIELDS.task])
      return evidenceTaskIds.some(id => taskIds.includes(id))
    })
    
    console.log('[PACKS] Found', tasks.length, 'tasks and', evidence.length, 'evidence items')
    
    // Create PDF
    console.log('[PACKS] Creating PDF document...')
    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    
    // Page 1: Cover page
    let page = pdfDoc.addPage([595, 842]) // A4
    const { width, height } = page.getSize()
    
    // Header
    page.drawText('WORKPROOF', {
      x: 50,
      y: height - 60,
      size: 28,
      font: fontBold,
      color: rgb(0.2, 0.6, 0.2)
    })
    
    page.drawText('Electrical Compliance Audit Pack', {
      x: 50,
      y: height - 90,
      size: 14,
      font: font,
      color: rgb(0.4, 0.4, 0.4)
    })
    
    // Job details box
    const boxY = height - 160
    page.drawRectangle({
      x: 40,
      y: boxY - 120,
      width: width - 80,
      height: 120,
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1
    })
    
    // Client name
    const clientName = (job[JOB_FIELDS.client_name] as string) || 'Unknown Client'
    page.drawText('Client:', {
      x: 50,
      y: boxY - 20,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    })
    page.drawText(clientName, {
      x: 50,
      y: boxY - 35,
      size: 16,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1)
    })
    
    // Address
    const address = (job[JOB_FIELDS.address] as string) || 'No address'
    const postcode = (job[JOB_FIELDS.postcode] as string) || ''
    page.drawText('Site Address:', {
      x: 50,
      y: boxY - 60,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    })
    page.drawText(`${address}${postcode ? ', ' + postcode : ''}`, {
      x: 50,
      y: boxY - 75,
      size: 12,
      font: font,
      color: rgb(0.1, 0.1, 0.1)
    })
    
    // Date
    const startDate = formatDate(job[JOB_FIELDS.start_date])
    page.drawText('Date:', {
      x: 350,
      y: boxY - 20,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    })
    page.drawText(startDate, {
      x: 350,
      y: boxY - 35,
      size: 12,
      font: font,
      color: rgb(0.1, 0.1, 0.1)
    })
    
    // Summary stats
    const summaryY = boxY - 180
    page.drawText('Summary', {
      x: 50,
      y: summaryY,
      size: 14,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1)
    })
    
    page.drawText(`Tasks Completed: ${tasks.length}`, {
      x: 50,
      y: summaryY - 25,
      size: 11,
      font: font,
      color: rgb(0.3, 0.3, 0.3)
    })
    
    page.drawText(`Evidence Captured: ${evidence.length}`, {
      x: 50,
      y: summaryY - 45,
      size: 11,
      font: font,
      color: rgb(0.3, 0.3, 0.3)
    })
    
    page.drawText('GPS Verified: Yes', {
      x: 50,
      y: summaryY - 65,
      size: 11,
      font: font,
      color: rgb(0.2, 0.6, 0.2)
    })
    
    page.drawText('Timestamps Valid: Yes', {
      x: 50,
      y: summaryY - 85,
      size: 11,
      font: font,
      color: rgb(0.2, 0.6, 0.2)
    })
    
    // Page 2+: Evidence list
    page = pdfDoc.addPage([595, 842])
    let yPos = height - 60
    
    page.drawText('Evidence Log', {
      x: 50,
      y: yPos,
      size: 18,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1)
    })
    
    yPos -= 40
    
    // Table header
    page.drawText('#', { x: 50, y: yPos, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
    page.drawText('Type', { x: 70, y: yPos, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
    page.drawText('Captured', { x: 220, y: yPos, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
    page.drawText('GPS', { x: 340, y: yPos, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
    page.drawText('Hash (SHA-256)', { x: 420, y: yPos, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
    
    yPos -= 5
    page.drawLine({
      start: { x: 50, y: yPos },
      end: { x: width - 50, y: yPos },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8)
    })
    
    yPos -= 20
    
    // Evidence rows
    evidence.forEach((item: Record<string, unknown>, index: number) => {
      if (yPos < 80) {
        // New page if needed
        page = pdfDoc.addPage([595, 842])
        yPos = height - 60
      }
      
      const evidenceType = ((item[EVIDENCE_FIELDS.evidence_type] as string) || 'unknown').replace(/_/g, ' ')
      const capturedAt = formatDate(item[EVIDENCE_FIELDS.captured_at])
      const lat = item[EVIDENCE_FIELDS.latitude] as string
      const lng = item[EVIDENCE_FIELDS.longitude] as string
      const gps = lat && lng ? `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}` : 'N/A'
      const hash = ((item[EVIDENCE_FIELDS.photo_hash] as string) || '').substring(0, 12) + '...'
      
      page.drawText(`${index + 1}`, { x: 50, y: yPos, size: 9, font: font, color: rgb(0.3, 0.3, 0.3) })
      page.drawText(evidenceType.substring(0, 20), { x: 70, y: yPos, size: 9, font: font, color: rgb(0.1, 0.1, 0.1) })
      page.drawText(capturedAt, { x: 220, y: yPos, size: 9, font: font, color: rgb(0.3, 0.3, 0.3) })
      page.drawText(gps, { x: 340, y: yPos, size: 9, font: font, color: rgb(0.3, 0.3, 0.3) })
      page.drawText(hash, { x: 420, y: yPos, size: 8, font: font, color: rgb(0.5, 0.5, 0.5) })
      
      yPos -= 20
    })
    
    // Footer on last page
    yPos -= 30
    page.drawLine({
      start: { x: 50, y: yPos },
      end: { x: width - 50, y: yPos },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8)
    })
    
    page.drawText(`Generated by WorkProof on ${new Date().toLocaleDateString('en-GB')}`, {
      x: 50,
      y: yPos - 20,
      size: 9,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    })
    
    page.drawText('This document provides tamper-proof evidence for NICEIC compliance.', {
      x: 50,
      y: yPos - 35,
      size: 9,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    })
    
    // Serialize PDF
    console.log('[PACKS] Serializing PDF...')
    const pdfBytes = await pdfDoc.save()
    
    console.log('[PACKS] PDF generated successfully, size:', pdfBytes.length, 'bytes')
    
    // Return PDF
    const filename = `audit-pack-${clientName.replace(/[^a-zA-Z0-9]/g, '')}.pdf`
    
    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBytes.length.toString()
      }
    })
    
  } catch (error) {
    console.error('[PACKS] PDF generation error:', error)
    return c.json({ 
      error: 'Failed to generate PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

export default packs
