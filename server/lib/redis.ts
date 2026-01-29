/**
 * Redis Client with Graceful Fallback
 * Uses Upstash Redis REST API - fails silently if unavailable
 */

import { Redis } from '@upstash/redis'

// Singleton instance
let redisClient: Redis | null = null
let redisAvailable = true

/**
 * Get Redis client instance
 * Returns null if Redis is not configured or unavailable
 */
function getRedisClient(): Redis | null {
  if (!redisAvailable) return null
  
  if (redisClient) return redisClient

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    console.log('[REDIS] Not configured - caching disabled')
    redisAvailable = false
    return null
  }

  try {
    redisClient = new Redis({ url, token })
    console.log('[REDIS] Client initialized')
    return redisClient
  } catch (error) {
    console.error('[REDIS] Failed to initialize:', error)
    redisAvailable = false
    return null
  }
}

/**
 * Cache key prefixes for different data types
 */
export const CACHE_KEYS = {
  userRecord: (clerkId: string) => `user:${clerkId}`,
  jobOwnership: (jobId: string, userId: string) => `job_owner:${jobId}:${userId}`,
} as const

/**
 * Cache TTL values in seconds
 */
export const CACHE_TTL = {
  userRecord: 10 * 60,    // 10 minutes - user ID rarely changes
  jobOwnership: 5 * 60,   // 5 minutes - ownership rarely changes
} as const

/**
 * Get value from cache
 * Returns null on miss or error (graceful fallback)
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient()
  if (!client) return null

  try {
    const value = await client.get<T>(key)
    if (value !== null) {
      console.log('[REDIS] Cache HIT:', key)
    }
    return value
  } catch (error) {
    console.error('[REDIS] Get error:', key, error)
    return null
  }
}

/**
 * Set value in cache (fire-and-forget)
 * Never throws - errors are logged and swallowed
 */
export function cacheSet(key: string, value: unknown, ttlSeconds: number): void {
  const client = getRedisClient()
  if (!client) return

  // Fire-and-forget - don't await, don't block
  client.set(key, value, { ex: ttlSeconds })
    .then(() => {
      console.log('[REDIS] Cache SET:', key, `TTL=${ttlSeconds}s`)
    })
    .catch((error) => {
      console.error('[REDIS] Set error:', key, error)
    })
}

/**
 * Delete value from cache (fire-and-forget)
 */
export function cacheDelete(key: string): void {
  const client = getRedisClient()
  if (!client) return

  client.del(key).catch((error) => {
    console.error('[REDIS] Delete error:', key, error)
  })
}

/**
 * Health check - test Redis connection
 */
export async function cacheHealthCheck(): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false

  try {
    await client.ping()
    return true
  } catch (error) {
    console.error('[REDIS] Health check failed:', error)
    return false
  }
}

export default {
  get: cacheGet,
  set: cacheSet,
  delete: cacheDelete,
  healthCheck: cacheHealthCheck,
  KEYS: CACHE_KEYS,
  TTL: CACHE_TTL,
}
