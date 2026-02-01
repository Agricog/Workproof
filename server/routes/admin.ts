import { Hono } from 'hono'
import { authMiddleware, getAuth } from '../middleware/auth.js'
import { clearAllCache, cacheHealthCheck } from '../lib/redis.js'

const admin = new Hono()

admin.use('*', authMiddleware)

// Clear cache - POST /api/admin/clear-cache
admin.post('/clear-cache', async (c) => {
  const auth = getAuth(c)
  console.log('[ADMIN] Cache clear requested by:', auth.userId)
  
  const success = await clearAllCache()
  
  if (success) {
    return c.json({ success: true, message: 'Cache cleared' })
  } else {
    return c.json({ success: false, message: 'Cache clear failed or Redis unavailable' })
  }
})

// Cache health check - GET /api/admin/cache-health
admin.get('/cache-health', async (c) => {
  const healthy = await cacheHealthCheck()
  
  return c.json({ 
    healthy,
    status: healthy ? 'connected' : 'unavailable'
  })
})

export default admin
