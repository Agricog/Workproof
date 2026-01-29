/**
 * WorkProof Sync Service
 * Background sync for offline evidence with photo stage support
 * 
 * Security: Uses Clerk token getter for authenticated API calls
 * Tokens are fetched fresh for each sync to handle expiration
 */
import {
  getSyncQueue,
  removeFromSyncQueue,
  updateSyncAttempt,
  getUnsyncedEvidence,
  markEvidenceSynced,
  type SyncQueueItem,
} from '../utils/indexedDB'
import { evidenceApi } from './api'
import { captureSyncError } from '../utils/errorTracking'

// ============================================================================
// TYPES
// ============================================================================

/** Function type for getting auth token from Clerk */
type GetTokenFn = () => Promise<string | null>

// ============================================================================
// MODULE STATE
// ============================================================================

const MAX_RETRY_ATTEMPTS = 5
const SYNC_INTERVAL_MS = 60 * 1000 // 1 minute

let syncInProgress = false
let syncIntervalId: ReturnType<typeof setInterval> | null = null

/** Stored reference to Clerk's getToken function */
let tokenGetter: GetTokenFn | null = null

// ============================================================================
// SERVICE LIFECYCLE
// ============================================================================

/**
 * Start the background sync service
 * @param getToken - Clerk's getToken function for authenticated API calls
 */
export function startSyncService(getToken: GetTokenFn): void {
  if (syncIntervalId) {
    return // Already running
  }

  // Store token getter for use in sync operations
  tokenGetter = getToken

  // Initial sync after short delay to let auth settle
  setTimeout(() => triggerSync(), 2000)

  // Set up interval
  syncIntervalId = setInterval(() => {
    if (navigator.onLine) {
      triggerSync()
    }
  }, SYNC_INTERVAL_MS)

  // Listen for online events
  window.addEventListener('online', handleOnline)

  // Listen for manual sync trigger
  window.addEventListener('workproof:sync', () => triggerSync())

  console.log('Sync service started')
}

/**
 * Stop the background sync service
 */
export function stopSyncService(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId)
    syncIntervalId = null
  }
  window.removeEventListener('online', handleOnline)
  tokenGetter = null
  console.log('Sync service stopped')
}

/**
 * Handle coming back online
 */
function handleOnline(): void {
  console.log('Back online - triggering sync')
  triggerSync()
}

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

/**
 * Get fresh auth token
 * @returns Promise resolving to token or null if unavailable
 */
async function getAuthToken(): Promise<string | null> {
  if (!tokenGetter) {
    console.warn('Sync: No token getter available')
    return null
  }

  try {
    return await tokenGetter()
  } catch (error) {
    captureSyncError(error, 'getAuthToken')
    return null
  }
}

/**
 * Trigger a sync cycle
 */
export async function triggerSync(): Promise<void> {
  if (syncInProgress || !navigator.onLine) {
    return
  }

  syncInProgress = true

  try {
    // Get fresh token for this sync cycle
    const token = await getAuthToken()
    if (!token) {
      console.log('Sync: No auth token available, skipping')
      return
    }

    // Sync evidence first
    await syncEvidence(token)

    // Then process queue
    await processQueue(token)
  } catch (error) {
    captureSyncError(error, 'triggerSync')
  } finally {
    syncInProgress = false
  }
}

/**
 * Sync unsynced evidence to server
 * @param token - Auth token for API calls
 */
async function syncEvidence(token: string): Promise<void> {
  const unsyncedItems = await getUnsyncedEvidence()

  if (unsyncedItems.length === 0) {
    return
  }

  console.log(`Syncing ${unsyncedItems.length} evidence items`)

  for (const item of unsyncedItems) {
    if (!item) continue

    try {
      // Upload evidence with auth token
      const response = await evidenceApi.upload(
        item.taskId,
        {
          evidenceType: item.evidenceType,
          photoStage: item.photoStage || undefined,
          photoData: item.photoData,
          thumbnailData: item.thumbnailData,
          hash: item.hash,
          capturedAt: item.capturedAt,
          latitude: item.latitude,
          longitude: item.longitude,
          accuracy: item.accuracy,
        },
        token
      )

      if (response.data) {
        await markEvidenceSynced(item.id)
        console.log(`Synced evidence ${item.id}`)
      } else {
        console.warn(`Failed to sync evidence ${item.id}:`, response.error)
      }
    } catch (error) {
      captureSyncError(error, 'syncEvidence')
    }
  }
}

/**
 * Process sync queue items
 * @param token - Auth token for API calls
 */
async function processQueue(token: string): Promise<void> {
  const queue = await getSyncQueue()

  if (queue.length === 0) {
    return
  }

  console.log(`Processing ${queue.length} queue items`)

  for (const item of queue) {
    if (item.attempts >= MAX_RETRY_ATTEMPTS) {
      console.warn(`Max retries reached for ${item.id}, removing from queue`)
      await removeFromSyncQueue(item.id)
      continue
    }

    try {
      let success = false

      switch (item.type) {
        case 'evidence':
          success = await processEvidenceSync(item, token)
          break
        case 'job':
          success = await processJobSync(item, token)
          break
        case 'task':
          success = await processTaskSync(item, token)
          break
        default:
          console.warn(`Unknown sync type: ${item.type}`)
          success = true // Remove unknown items
      }

      if (success) {
        await removeFromSyncQueue(item.id)
      } else {
        await updateSyncAttempt(item.id)
      }
    } catch (error) {
      captureSyncError(error, `processQueue.${item.type}`)
      await updateSyncAttempt(item.id)
    }
  }
}

/**
 * Process evidence sync item
 * @param item - Queue item to process
 * @param token - Auth token for API calls
 */
async function processEvidenceSync(item: SyncQueueItem, token: string): Promise<boolean> {
  const taskId = String(item.id || '')
  const data = item.data || {}

  const response = await evidenceApi.upload(
    taskId,
    {
      evidenceType: String(data.evidenceType || ''),
      photoStage: data.photoStage ? String(data.photoStage) : undefined,
      photoData: String(data.photoData || ''),
      thumbnailData: String(data.thumbnailData || ''),
      hash: String(data.hash || ''),
      capturedAt: String(data.capturedAt || ''),
      latitude: typeof data.latitude === 'number' ? data.latitude : null,
      longitude: typeof data.longitude === 'number' ? data.longitude : null,
      accuracy: typeof data.accuracy === 'number' ? data.accuracy : null,
    },
    token
  )

  return !!response.data && !response.error
}

/**
 * Process job sync item (placeholder)
 */
async function processJobSync(_item: SyncQueueItem, _token: string): Promise<boolean> {
  // TODO: Implement job sync when needed
  return true
}

/**
 * Process task sync item (placeholder)
 */
async function processTaskSync(_item: SyncQueueItem, _token: string): Promise<boolean> {
  // TODO: Implement task sync when needed
  return true
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get sync status
 */
export async function getSyncStatus(): Promise<{
  pendingEvidence: number
  pendingQueue: number
  isOnline: boolean
  isSyncing: boolean
}> {
  const unsyncedEvidence = await getUnsyncedEvidence()
  const queue = await getSyncQueue()

  return {
    pendingEvidence: unsyncedEvidence.length,
    pendingQueue: queue.length,
    isOnline: navigator.onLine,
    isSyncing: syncInProgress,
  }
}

/**
 * Force sync now (for manual trigger from Settings)
 * @returns Sync result with counts
 */
export async function forceSyncNow(): Promise<{
  success: boolean
  synced: number
  failed: number
}> {
  if (!navigator.onLine) {
    return { success: false, synced: 0, failed: 0 }
  }

  // Get fresh token
  const token = await getAuthToken()
  if (!token) {
    return { success: false, synced: 0, failed: 0 }
  }

  let synced = 0
  let failed = 0

  syncInProgress = true

  try {
    const unsyncedItems = await getUnsyncedEvidence()

    for (const item of unsyncedItems) {
      if (!item) continue

      try {
        const response = await evidenceApi.upload(
          item.taskId,
          {
            evidenceType: item.evidenceType,
            photoStage: item.photoStage || undefined,
            photoData: item.photoData,
            thumbnailData: item.thumbnailData,
            hash: item.hash,
            capturedAt: item.capturedAt,
            latitude: item.latitude,
            longitude: item.longitude,
            accuracy: item.accuracy,
          },
          token
        )

        if (response.data) {
          await markEvidenceSynced(item.id)
          synced++
        } else {
          failed++
        }
      } catch (error) {
        failed++
        captureSyncError(error, 'forceSyncNow')
      }
    }

    return { success: true, synced, failed }
  } finally {
    syncInProgress = false
  }
}
