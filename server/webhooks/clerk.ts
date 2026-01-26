import { Hono } from 'hono'
import { Webhook } from 'svix'
import { getSmartSuiteClient, TABLES } from '../lib/smartsuite.js'
import type { User } from '../types/index.js'

const clerkWebhook = new Hono()

interface ClerkWebhookEvent {
  type: string
  data: {
    id: string
    email_addresses?: Array<{ email_address: string; id: string }>
    first_name?: string | null
    last_name?: string | null
    image_url?: string
    created_at?: number
    updated_at?: number
  }
}

// Clerk webhook endpoint
clerkWebhook.post('/clerk', async (c) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('CLERK_WEBHOOK_SECRET not configured')
    return c.json({ error: 'Webhook not configured' }, 500)
  }

  // Get Svix headers
  const svixId = c.req.header('svix-id')
  const svixTimestamp = c.req.header('svix-timestamp')
  const svixSignature = c.req.header('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: 'Missing Svix headers' }, 400)
  }

  // Get raw body
  const body = await c.req.text()

  // Verify webhook signature
  const wh = new Webhook(webhookSecret)
  let event: ClerkWebhookEvent

  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature
    }) as ClerkWebhookEvent
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return c.json({ error: 'Invalid signature' }, 400)
  }

  // Process event
  try {
    switch (event.type) {
      case 'user.created':
        await handleUserCreated(event.data)
        break
      case 'user.updated':
        await handleUserUpdated(event.data)
        break
      case 'user.deleted':
        await handleUserDeleted(event.data)
        break
      case 'session.created':
        await handleSessionCreated(event.data)
        break
      default:
        console.log(`Unhandled webhook event: ${event.type}`)
    }

    return c.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return c.json({ error: 'Webhook processing failed' }, 500)
  }
})

// Handle user.created event
async function handleUserCreated(data: ClerkWebhookEvent['data']) {
  const client = getSmartSuiteClient()

  const primaryEmail = data.email_addresses?.[0]?.email_address
  if (!primaryEmail) {
    console.error('No email found for user:', data.id)
    return
  }

  const fullName = [data.first_name, data.last_name]
    .filter(Boolean)
    .join(' ') || 'Unknown'

  // Check if user already exists
  const existingUser = await client.findByField<User>(
    TABLES.USERS,
    'clerk_id',
    data.id
  )

  if (existingUser) {
    console.log('User already exists:', data.id)
    return
  }

  // Create new user in SmartSuite
  const userData: Omit<User, 'id'> = {
    clerk_id: data.id,
    email: primaryEmail,
    full_name: fullName,
    subscription_status: 'free',
    last_login: new Date().toISOString()
  }

  const user = await client.createRecord<User>(TABLES.USERS, userData)
  console.log('User created in SmartSuite:', user.id)
}

// Handle user.updated event
async function handleUserUpdated(data: ClerkWebhookEvent['data']) {
  const client = getSmartSuiteClient()

  // Find existing user
  const existingUser = await client.findByField<User>(
    TABLES.USERS,
    'clerk_id',
    data.id
  )

  if (!existingUser) {
    // User doesn't exist, create them
    await handleUserCreated(data)
    return
  }

  const primaryEmail = data.email_addresses?.[0]?.email_address
  const fullName = [data.first_name, data.last_name]
    .filter(Boolean)
    .join(' ')

  // Update user in SmartSuite
  const updateData: Partial<User> = {}

  if (primaryEmail && primaryEmail !== existingUser.email) {
    updateData.email = primaryEmail
  }

  if (fullName && fullName !== existingUser.full_name) {
    updateData.full_name = fullName
  }

  if (Object.keys(updateData).length > 0) {
    await client.updateRecord<User>(TABLES.USERS, existingUser.id, updateData)
    console.log('User updated in SmartSuite:', existingUser.id)
  }
}

// Handle user.deleted event
async function handleUserDeleted(data: ClerkWebhookEvent['data']) {
  const client = getSmartSuiteClient()

  // Find existing user
  const existingUser = await client.findByField<User>(
    TABLES.USERS,
    'clerk_id',
    data.id
  )

  if (!existingUser) {
    console.log('User not found for deletion:', data.id)
    return
  }

  // Soft delete - update subscription status
  // We keep the record for audit purposes
  await client.updateRecord<User>(TABLES.USERS, existingUser.id, {
    subscription_status: 'free' // Downgrade to free
  })

  console.log('User soft-deleted in SmartSuite:', existingUser.id)
}

// Handle session.created event - update last login
async function handleSessionCreated(data: ClerkWebhookEvent['data']) {
  const client = getSmartSuiteClient()

  // Find existing user
  const existingUser = await client.findByField<User>(
    TABLES.USERS,
    'clerk_id',
    data.id
  )

  if (!existingUser) {
    console.log('User not found for session update:', data.id)
    return
  }

  // Update last login
  await client.updateRecord<User>(TABLES.USERS, existingUser.id, {
    last_login: new Date().toISOString()
  })
}

export default clerkWebhook
