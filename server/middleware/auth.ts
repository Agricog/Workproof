import { Context, Next } from 'hono'
import { createClerkClient } from '@clerk/backend'

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY
})

// Extended context with user info
export interface AuthContext {
  userId: string
  sessionId: string
  userRecord?: string // SmartSuite user record ID
}

// Verify Clerk session token
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization header' }, 401)
  }

  const token = authHeader.replace('Bearer ', '')

  try {
    // Verify the session token with Clerk
    const session = await clerk.verifyToken(token)

    if (!session) {
      return c.json({ error: 'Invalid session' }, 401)
    }

    // Attach user info to context
    c.set('auth', {
      userId: session.sub,
      sessionId: session.sid
    } as AuthContext)

    await next()
  } catch (error) {
    console.error('Auth error:', error)
    return c.json({ error: 'Authentication failed' }, 401)
  }
}

// Get auth context from request
export function getAuth(c: Context): AuthContext {
  const auth = c.get('auth') as AuthContext | undefined

  if (!auth) {
    throw new Error('Auth context not found - is authMiddleware applied?')
  }

  return auth
}

// Optional auth - doesn't fail if no token
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '')

    try {
      const session = await clerk.verifyToken(token)

      if (session) {
        c.set('auth', {
          userId: session.sub,
          sessionId: session.sid
        } as AuthContext)
      }
    } catch (error) {
      // Ignore auth errors for optional auth
      console.warn('Optional auth failed:', error)
    }
  }

  await next()
}
