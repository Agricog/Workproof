/**
 * WorkProof Packs API - MINIMAL TEST VERSION
 * Testing if route loads without pdfkit
 */
import { Hono } from 'hono'

console.log('[PACKS] Module loading...')

const packs = new Hono()

console.log('[PACKS] Routes initializing...')

// Test endpoint
packs.get('/test', (c) => {
  console.log('[PACKS] Test endpoint hit')
  return c.json({ status: 'packs route working' })
})

// PDF endpoint - just returns JSON for now
packs.get('/:jobId/pdf', async (c) => {
  const jobId = c.req.param('jobId')
  console.log('[PACKS] PDF endpoint hit for job:', jobId)
  
  return c.json({ 
    message: 'PDF endpoint reached',
    jobId,
    note: 'pdfkit removed for testing'
  })
})

console.log('[PACKS] Routes registered')

export default packs
