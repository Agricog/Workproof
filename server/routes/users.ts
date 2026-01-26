import { Hono } from 'hono'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import { authMiddleware, getAuth } from '../middleware/auth.js'
import { rateLimitMiddleware } from '../middleware/rateLimit.js'
import type { User } from '../types/index.js'

const users = new Hono()

// Apply middleware to all routes
users.use('*', rateLimitMiddleware)
users.use('*', authMiddleware)

// Get current user profile
users.get('/me', async (c) => {
  const auth = getAuth(c)
  const client = getSmartSuiteClient()

  try {
    const user = await client.findByField<User>(
      TABLES.USERS,
      'clerk_id',
      auth.userId
    )

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    return c.json(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    return c.json({ error: 'Failed to fetch user' }, 500)
  }
})

// Update current user profile
users.patch('/me', async (c) => {
  const auth = getAuth(c)
  const client = getSmartSuiteClient()

  try {
    // Find existing user
    const existingUser = await client.findByField<User>(
      TABLES.USERS,
      'clerk_id',
      auth.userId
    )

    if (!existingUser) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Get update data from request body
    const body = await c.req.json()

    // Only allow updating specific fields
    const allowedFields = [
      'full_name',
      'company_name',
      'niceic_number',
      'phone'
    ]

    const updateData: Partial<User> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field as keyof User] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'No valid fields to update' }, 400)
    }

    const updatedUser = await client.updateRecord<User>(
      TABLES.USERS,
      existingUser.id,
      updateData
    )

    return c.json(updatedUser)
  } catch (error) {
    console.error('Error updating user:', error)
    return c.json({ error: 'Failed to update user' }, 500)
  }
})

// Get user by ID (admin only - future use)
users.get('/:id', async (c) => {
  const auth = getAuth(c)
  const userId = c.req.param('id')
  const client = getSmartSuiteClient()

  try {
    const user = await client.getRecord<User>(TABLES.USERS, userId)

    // For now, users can only view their own profile
    if (user.clerk_id !== auth.userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    return c.json(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    return c.json({ error: 'Failed to fetch user' }, 500)
  }
})

export default users
