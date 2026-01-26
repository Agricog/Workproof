import { Context, Next } from 'hono'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Rate limiter instance - lazy loaded
let ratelimit: Ratelimit | null = null

function getRateLimiter(): Ratelimit {
  if (!ratelimit) {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!redisUrl || !redisToken) {
      throw new Error('Upstash Redis credentials not configured')
    }

    const redis = new Redis({
      url: redisUrl,
      token: redisToken
    })

    // 60 requests per minute per IP/user
    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      analytics: true,
      prefix: 'workproof:ratelimit'
    })
  }

  return ratelimit
}

// Get identifier for rate limiting (user ID or IP)
function getIdentifier(c: Context): string {
  // Try to get authenticated user ID first
  const auth = c.get('auth') as { userId?: string } | undefined
  if (auth?.userId) {
    return `user:${auth.userId}`
  }

  // Fall back to IP address
  const forwarded = c.req.header('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 
             c.req.header('x-real-ip') || 
             'unknown'
  
  return `ip:${ip}`
}

// Standard rate limit middleware
export async function rateLimitMiddleware(c: Context, next: Next) {
  try {
    const limiter = getRateLimiter()
    const identifier = getIdentifier(c)

    const { success, limit, reset, remaining } = await limiter.limit(identifier)

    // Set rate limit headers
    c.header('X-RateLimit-Limit', limit.toString())
    c.header('X-RateLimit-Remaining', remaining.toString())
    c.header('X-RateLimit-Reset', reset.toString())

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)
      c.header('Retry-After', retryAfter.toString())

      return c.json({
        error: 'Too many requests',
        retryAfter
      }, 429)
    }

    await next()
  } catch (error) {
    // If rate limiting fails, log but allow request through
    console.error('Rate limit error:', error)
    await next()
  }
}

// Stricter rate limit for sensitive operations (auth, uploads)
let strictRatelimit: Ratelimit | null = null

function getStrictRateLimiter(): Ratelimit {
  if (!strictRatelimit) {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!redisUrl || !redisToken) {
      throw new Error('Upstash Redis credentials not configured')
    }

    const redis = new Redis({
      url: redisUrl,
      token: redisToken
    })

    // 10 requests per minute for sensitive operations
    strictRatelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: 'workproof:ratelimit:strict'
    })
  }

  return strictRatelimit
}

export async function strictRateLimitMiddleware(c: Context, next: Next) {
  try {
    const limiter = getStrictRateLimiter()
    const identifier = getIdentifier(c)

    const { success, limit, reset, remaining } = await limiter.limit(identifier)

    c.header('X-RateLimit-Limit', limit.toString())
    c.header('X-RateLimit-Remaining', remaining.toString())
    c.header('X-RateLimit-Reset', reset.toString())

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)
      c.header('Retry-After', retryAfter.toString())

      return c.json({
        error: 'Too many requests',
        retryAfter
      }, 429)
    }

    await next()
  } catch (error) {
    console.error('Strict rate limit error:', error)
    await next()
  }
}
