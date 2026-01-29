/**
 * WorkProof Sync Service
 * Background sync for offline evidence
 */
import { 
  getSyncQueue, 
  removeFromSyncQueue, 
  updateSyncAttempt,
  getUnsyncedEvidence,
  markEvidenceSynced,
  type SyncQueueItem 
} from '../utils/indexedDB'
import { evidenceApi } from './api'
import { captureSyncError } from '../utils/errorTracking'
import { trackEvidenceSynced } from '../utils/analytics'

const MAX_RETRY_ATTEMPTS = 5
const SYNC_INTERVAL_MS = 60 * 1000 // 1 minute

let syncInProgress = false
let syncIntervalId: ReturnType<typeof setInterval> | null = null
let getTokenFn: (() => Promise<string | null>) | null = null

/**
 * Start the background sync service
 * @param getToken - Function to get Clerk auth token
 */
export function startSyncService(getToken: () => Promise<string | null>): void {
  if (syncIntervalId) {
    return // Already running
  }

  // Store token getter for use in sync operations
  getTokenFn = getToken

  // Initial sync
  triggerSync()

  // Set up interval
  syncIntervalId = setInterval(() => {
    if (navigator.onLine) {
      triggerSync()
    }
  }, SYNC_INTERVAL_MS)

  // Listen for online events
  window.addEventListener('online', handleOnline)
  
  // Listen for manual sync triggers
  window.addEventListener('workproof:sync', handleManualSync)
}

/**
 * Stop the background sync service
 */
export function stopSyncService(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId)
    syncIntervalId = null
  }
  getTokenFn = null
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('workproof:sync', handleManualSync)
}

/**
 * Handle coming back online
 */
function handleOnline(): void {
  console.log('Back online - triggering sync')
  triggerSync()
}

/**
 * Handle manual sync trigger
 */
function handleManualSync(): void {
  triggerSync()
}

/**
 * Trigger a sync cycle
 */
export async function triggerSync(): Promise<void> {
  if (syncInProgress || !navigator.onLine || !getTokenFn) {
    return
  }

  syncInProgress = true

  try {
    // Get fresh token
    const token = await getTokenFn()
    if (!token) {
      console.warn('No auth token available for sync')
      return
    }

    // Sync evidence first
    await syncEvidence(token)

    // Then process sync queue
    await processSyncQueue(token)
  } catch (error) {
    captureSyncError(error, 'triggerSync')
  } finally {
    syncInProgress = false
  }
}

/**
 * Sync unsynced evidence to server
 */
async function syncEvidence(token: string): Promise<void> {
  const unsyncedItems = await getUnsyncedEvidence()
  
  if (unsyncedItems.length === 0) {
    return
  }

  console.log(`Syncing ${unsyncedItems.length} evidence items`)
  
  let syncedCount = 0

  for (const item of unsyncedItems) {
    if (!item) continue
    
    try {
      const response = await evidenceApi.upload(
        item.taskId,
        {
          evidenceType: item.evidenceType,
          photoStage: item.photoStage,
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
        syncedCount++
        console.log(`Evidence ${item.id} synced successfully`)
      } else {
        console.error(`Failed to sync evidence ${item.id}:`, response.error)
      }
    } catch (error) {
      captureSyncError(error, 'syncEvidence')
    }
  }

  // Track analytics
  if (syncedCount > 0) {
    trackEvidenceSynced(syncedCount)
  }
}

/**
 * Process items in the sync queue
 */
async function processSyncQueue(token: string): Promise<void> {
  const queue = await getSyncQueue()
  
  if (queue.length === 0) {
    return
  }

  console.log(`Processing ${queue.length} sync queue items`)

  for (const item of queue) {
    if (!item) continue
    
    if (item.attempts >= MAX_RETRY_ATTEMPTS) {
      console.warn(`Max retries exceeded for sync item ${item.id}`)
      continue
    }

    try {
      const success = await processSyncItem(item, token)
      
      if (success) {
        await removeFromSyncQueue(item.id)
        console.log(`Sync item ${item.id} processed successfully`)
      } else {
        await updateSyncAttempt(item.id)
      }
    } catch (error) {
      captureSyncError(error, 'processSyncQueue')
      await updateSyncAttempt(item.id)
    }
  }
}

/**
 * Process a single sync queue item
 */
async function processSyncItem(item: SyncQueueItem, token: string): Promise<boolean> {
  switch (item.type) {
    case 'evidence':
      return processEvidenceSync(item, token)
    case 'job':
      return processJobSync(item, token)
    case 'task':
      return processTaskSync(item, token)
    default:
      console.warn(`Unknown sync item type: ${item.type}`)
      return false
  }
}

/**
 * Process evidence sync item
 */
async function processEvidenceSync(item: SyncQueueItem, token: string): Promise<boolean> {
  const data = item.data as {
    taskId: string
    evidenceType: string
    photoStage?: string
    photoData: string
    thumbnailData: string
    hash: string
    capturedAt: string
    latitude: number | null
    longitude: number | null
    accuracy: number | null
  }

  const response = await evidenceApi.upload(
    data.taskId,
    {
      evidenceType: data.evidenceType,
      photoStage: data.photoStage,
      photoData: data.photoData,
      thumbnailData: data.thumbnailData,
      hash: data.hash,
      capturedAt: data.capturedAt,
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy,
    },
    token
  )

  return !!response.data
}

/**
 * Process job sync item
 */
async function processJobSync(item: SyncQueueItem, _token: string): Promise<boolean> {
  // TODO: Implement job sync when needed
  console.log('Job sync not yet implemented', item)
  return true
}

/**
 * Process task sync item
 */
async function processTaskSync(item: SyncQueueItem, _token: string): Promise<boolean> {
  // TODO: Implement task sync when needed
  console.log('Task sync not yet implemented', item)
  return true
}

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
 * Force sync now (for manual trigger)
 * @param getToken - Function to get Clerk auth token
 */
export async function forceSyncNow(
  getToken: () => Promise<string | null>
): Promise<{ success: boolean; synced: number; failed: number }> {
  if (!navigator.onLine) {
    return { success: false, synced: 0, failed: 0 }
  }

  const token = await getToken()
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
            photoStage: item.photoStage,
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

    // Track analytics
    if (synced > 0) {
      trackEvidenceSynced(synced)
    }

    return { success: true, synced, failed }
  } finally {
    syncInProgress = false
  }
}
