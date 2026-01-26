import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'

// Routes
import users from './routes/users.js'
import jobs from './routes/jobs.js'
import tasks from './routes/tasks.js'
import evidence from './routes/evidence.js'
import auditPacks from './routes/audit-packs.js'
import clerkWebhook from './webhooks/clerk.js'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', secureHeaders())
app.use('*', cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}))

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
app.route('/api/users', users)
app.route('/api/jobs', jobs)
app.route('/api/tasks', tasks)
app.route('/api/evidence', evidence)
app.route('/api/audit-packs', auditPacks)

// Webhooks
app.route('/webhooks', clerkWebhook)

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

// Start server
const port = parseInt(process.env.PORT || '3001')

console.log(`🚀 Server running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})

export default app
