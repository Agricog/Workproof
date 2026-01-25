/**
 * WorkProof Sync Service
 * Background sync for offline evidence uploads
 */

import {
  getPendingEvidence,
  updateEvidenceStatus,
  deleteEvidence,
  getStorageStats,
} from '../utils/indexedDB'
import { api, isApiError } from './api'
import { captureError, captureSyncError } from '../utils/errorTracking'
import type { OfflineEvidenceItem, SyncResult } from '../types/api'

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 5000
const BATCH_SIZE = 5

// ============================================================================
// SYNC SERVICE
// ============================================================================

class SyncService {
  private isSyncing = false
  private syncListeners: Set<(state: SyncState) => void> = new Set()

  // Subscribe to sync state changes
  subscribe(listener: (state: SyncState) => void): () => void {
    this.syncListeners.add(listener)
    return () => this.syncListeners.delete(listener)
  }

  private notifyListeners(state: SyncState): void {
    this.syncListeners.forEach((listener) => listener(state))
  }

  // Main sync function
  async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errors: [{ itemId: '', error: 'Sync already in progress' }],
      }
    }

    if (!navigator.onLine) {
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errors: [{ itemId: '', error: 'No internet connection' }],
      }
    }

    this.isSyncing = true
    this.notifyListeners({ isSyncing: true, progress: 0 })

    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: [],
    }

    try {
      const pending = await getPendingEvidence()

      if (pending.length === 0) {
        return result
      }

      // Process in batches
      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE)
        const batchResults = await Promise.allSettled(
          batch.map((item) => this.uploadEvidence(item))
        )

        batchResults.forEach((batchResult, index) => {
          const item = batch[index]

          if (batchResult.status === 'fulfilled' && batchResult.value) {
            result.syncedCount++
          } else {
            result.failedCount++
            result.errors.push({
              itemId: item.id,
              error:
                batchResult.status === 'rejected'
                  ? batchResult.reason?.message || 'Unknown error'
                  : 'Upload failed',
            })
          }
        })

        // Update progress
        const progress = Math.round(((i + BATCH_SIZE) / pending.length) * 100)
        this.notifyListeners({ isSyncing: true, progress: Math.min(progress, 100) })
      }

      result.success = result.failedCount === 0
    } catch (error) {
      captureError(error, 'SyncService.sync')
      result.success = false
      result.errors.push({ itemId: '', error: 'Sync failed unexpectedly' })
    } finally {
      this.isSyncing = false
      this.notifyListeners({ isSyncing: false, progress: 100 })
    }

    return result
  }

  // Upload single evidence item
  private async uploadEvidence(item: OfflineEvidenceItem): Promise<boolean> {
    // Skip if max retries exceeded
    if (item.retryCount >= MAX_RETRIES) {
      await updateEvidenceStatus(item.id, 'failed', 'Max retries exceeded')
      return false
    }

    try {
      await updateEvidenceStatus(item.id, 'uploading')

      // Convert blob to base64 for upload
      const base64 = await blobToBase64(item.photoBlob)

      const response = await api.post('/evidence/upload', {
        id: item.id,
        taskId: item.taskId,
        evidenceType: item.evidenceType,
        photo: base64,
        photoBytesHash: item.photoBytesHash,
        capturedAt: item.capturedAt,
        capturedLat: item.capturedLat,
        capturedLng: item.capturedLng,
        workerId: item.workerId,
        deviceId: item.deviceId,
      })

      if (isApiError(response)) {
        throw new Error(response.error.message)
      }

      // Success - mark as synced and optionally delete local copy
      await updateEvidenceStatus(item.id, 'synced')

      // Clean up local storage after successful sync
      const stats = await getStorageStats()
      if (stats.totalSizeBytes > 30 * 1024 * 1024) {
        // If over 30MB, delete synced items
        await deleteEvidence(item.id)
      }

      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      await updateEvidenceStatus(item.id, 'pending', errorMessage)
      captureSyncError(error, 'evidence', item.id)
      return false
    }
  }

  // Retry failed uploads
  async retryFailed(): Promise<SyncResult> {
    const pending = await getPendingEvidence()
    const failed = pending.filter(
      (item) => item.syncStatus === 'failed' || item.retryCount > 0
    )

    // Reset retry counts
    for (const item of failed) {
      item.retryCount = 0
      await updateEvidenceStatus(item.id, 'pending')
    }

    return this.sync()
  }

  // Get sync status
  async getStatus(): Promise<SyncStatus> {
    const stats = await getStorageStats()

    return {
      pendingCount: stats.pendingUploadCount,
      totalItems: stats.totalItems,
      totalSizeBytes: stats.totalSizeBytes,
      isSyncing: this.isSyncing,
    }
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface SyncState {
  isSyncing: boolean
  progress: number
}

interface SyncStatus {
  pendingCount: number
  totalItems: number
  totalSizeBytes: number
  isSyncing: boolean
}

// ============================================================================
// HELPERS
// ============================================================================

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove data URL prefix
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const syncService = new SyncService()

// ============================================================================
// AUTO SYNC SETUP
// ============================================================================

export function setupAutoSync(): void {
  // Sync when coming online
  window.addEventListener('online', () => {
    setTimeout(() => syncService.sync(), 1000)
  })

  // Listen for custom sync events
  window.addEventListener('workproof:sync', () => {
    syncService.sync()
  })

  // Periodic sync every 60 seconds when online
  setInterval(() => {
    if (navigator.onLine) {
      syncService.sync()
    }
  }, 60000)

  // Initial sync if online
  if (navigator.onLine) {
    setTimeout(() => syncService.sync(), 3000)
  }
}
