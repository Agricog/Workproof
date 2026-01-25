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

const MAX_RETRY_ATTEMPTS = 5
const SYNC_INTERVAL_MS = 60 * 1000 // 1 minute

let syncInProgress = false
let syncIntervalId: ReturnType<typeof setInterval> | null = null

/**
 * Start the background sync service
 */
export function startSyncService(): void {
  if (syncIntervalId) {
    return // Already running
  }

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
}

/**
 * Handle coming back online
 */
function handleOnline(): void {
  console.log('Back online - triggering sync')
  triggerSync()
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
    // Sync evidence first
    await syncEvidence()

    // Then process sync queue
    await processSyncQueue()
  } catch (error) {
    captureSyncError(error, 'triggerSync')
  } finally {
    syncInProgress = false
  }
}

/**
 * Sync unsynced evidence to server
 */
async function syncEvidence(): Promise<void> {
  const unsyncedItems = await getUnsyncedEvidence()

  if (unsyncedItems.length === 0) {
    return
  }

  console.log(`Syncing ${unsyncedItems.length} evidence items`)

  for (const item of unsyncedItems) {
    if (!item) continue
    
    try {
      const response = await evidenceApi.upload(item.taskId, {
        evidenceType: item.evidenceType,
        photoData: item.photoData,
        thumbnailData: item.thumbnailData,
        hash: item.hash,
        capturedAt: item.capturedAt,
        latitude: item.latitude,
        longitude: item.longitude,
        accuracy: item.accuracy,
      })

      if (response.data) {
        await markEvidenceSynced(item.id)
        console.log(`Evidence ${item.id} synced successfully`)
      } else {
        console.error(`Failed to sync evidence ${item.id}:`, response.error)
      }
    } catch (error) {
      captureSyncError(error, 'syncEvidence')
    }
  }
}

/**
 * Process items in the sync queue
 */
async function processSyncQueue(): Promise<void> {
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
      const success = await processSyncItem(item)

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
async function processSyncItem(item: SyncQueueItem): Promise<boolean> {
  switch (item.type) {
    case 'evidence':
      return processEvidenceSync(item)
    case 'job':
      return processJobSync(item)
    case 'task':
      return processTaskSync(item)
    default:
      console.warn(`Unknown sync item type: ${item.type}`)
      return false
  }
}

/**
 * Process evidence sync item
 */
async function processEvidenceSync(item: SyncQueueItem): Promise<boolean> {
  const data = item.data as {
    taskId: string
    evidenceType: string
    photoData: string
    thumbnailData: string
    hash: string
    capturedAt: string
    latitude: number | null
    longitude: number | null
    accuracy: number | null
  }

  const response = await evidenceApi.upload(data.taskId, {
    evidenceType: data.evidenceType,
    photoData: data.photoData,
    thumbnailData: data.thumbnailData,
    hash: data.hash,
    capturedAt: data.capturedAt,
    latitude: data.latitude,
    longitude: data.longitude,
    accuracy: data.accuracy,
  })

  return !!response.data
}

/**
 * Process job sync item
 */
async function processJobSync(item: SyncQueueItem): Promise<boolean> {
  // TODO: Implement job sync when backend is ready
  console.log('Job sync not yet implemented', item)
  return true
}

/**
 * Process task sync item
 */
async function processTaskSync(item: SyncQueueItem): Promise<boolean> {
  // TODO: Implement task sync when backend is ready
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
 */
export async function forceSyncNow(): Promise<{ success: boolean; synced: number; failed: number }> {
  if (!navigator.onLine) {
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
        const response = await evidenceApi.upload(item.taskId, {
          evidenceType: item.evidenceType,
          photoData: item.photoData,
          thumbnailData: item.thumbnailData,
          hash: item.hash,
          capturedAt: item.capturedAt,
          latitude: item.latitude,
          longitude: item.longitude,
          accuracy: item.accuracy,
        })

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
