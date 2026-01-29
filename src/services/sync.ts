/**
 * WorkProof Sync Service
 * Background sync for offline evidence with photo stage support
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

  // Listen for manual sync trigger
  window.addEventListener('workproof:sync', () => triggerSync())
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

    // Then process queue
    await processQueue()
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
      // Upload evidence with stage support
      const response = await evidenceApi.upload(item.taskId, {
        evidenceType: item.evidenceType,
        photoStage: item.photoStage || undefined,  // NEW: Include photo stage
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
 */
async function processQueue(): Promise<void> {
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
          success = await processEvidenceSync(item)
          break
        case 'job':
          success = await processJobSync(item)
          break
        case 'task':
          success = await processTaskSync(item)
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
 */
async function processEvidenceSync(item: SyncQueueItem): Promise<boolean> {
  // Cast item data to expected shape
  const data = item as unknown as {
    entityId: string
    data: {
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
  }
  
  const response = await evidenceApi.upload(data.entityId, {
    evidenceType: data.data.evidenceType,
    photoStage: data.data.photoStage,
    photoData: data.data.photoData,
    thumbnailData: data.data.thumbnailData,
    hash: data.data.hash,
    capturedAt: data.data.capturedAt,
    latitude: data.data.latitude,
    longitude: data.data.longitude,
    accuracy: data.data.accuracy,
  })

  return !!response.data && !response.error
}

/**
 * Process job sync item
 */
async function processJobSync(item: SyncQueueItem): Promise<boolean> {
  // TODO: Implement job sync when needed
  console.log('Job sync not yet implemented', item)
  return true
}

/**
 * Process task sync item
 */
async function processTaskSync(item: SyncQueueItem): Promise<boolean> {
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
 */
export async function forceSyncNow(): Promise<{
  success: boolean
  synced: number
  failed: number
}> {
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
          photoStage: item.photoStage || undefined,  // NEW: Include photo stage
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
