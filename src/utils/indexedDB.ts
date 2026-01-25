/**
 * WorkProof IndexedDB Storage
 * Offline-first evidence storage for PWA
 * iOS limit: 50MB - we target 45MB max
 */

import type { OfflineEvidenceItem, OfflineStorageStats } from '../types/api'
import { STORAGE_LIMITS } from '../types/api'

const DB_NAME = 'workproof'
const DB_VERSION = 1

// Store names
const STORES = {
  EVIDENCE: 'evidence',
  SYNC_QUEUE: 'sync_queue',
  METADATA: 'metadata',
} as const

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

let dbInstance: IDBDatabase | null = null

export async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Evidence store
      if (!db.objectStoreNames.contains(STORES.EVIDENCE)) {
        const evidenceStore = db.createObjectStore(STORES.EVIDENCE, {
          keyPath: 'id',
        })
        evidenceStore.createIndex('taskId', 'taskId', { unique: false })
        evidenceStore.createIndex('syncStatus', 'syncStatus', { unique: false })
        evidenceStore.createIndex('createdAt', 'createdAt', { unique: false })
      }

      // Sync queue store
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, {
          keyPath: 'id',
        })
        syncStore.createIndex('status', 'status', { unique: false })
        syncStore.createIndex('timestamp', 'timestamp', { unique: false })
      }

      // Metadata store
      if (!db.objectStoreNames.contains(STORES.METADATA)) {
        db.createObjectStore(STORES.METADATA, { keyPath: 'key' })
      }
    }
  })
}

// ============================================================================
// EVIDENCE OPERATIONS
// ============================================================================

export async function saveEvidence(
  evidence: OfflineEvidenceItem
): Promise<void> {
  const db = await initDB()

  // Check storage limits first
  const stats = await getStorageStats()
  if (stats.totalItems >= STORAGE_LIMITS.MAX_QUEUE_ITEMS) {
    throw new Error('Storage limit reached. Please sync pending evidence.')
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EVIDENCE, 'readwrite')
    const store = tx.objectStore(STORES.EVIDENCE)
    const request = store.put(evidence)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getEvidence(id: string): Promise<OfflineEvidenceItem | null> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EVIDENCE, 'readonly')
    const store = tx.objectStore(STORES.EVIDENCE)
    const request = store.get(id)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function getEvidenceByTask(
  taskId: string
): Promise<OfflineEvidenceItem[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EVIDENCE, 'readonly')
    const store = tx.objectStore(STORES.EVIDENCE)
    const index = store.index('taskId')
    const request = index.getAll(taskId)

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

export async function getPendingEvidence(): Promise<OfflineEvidenceItem[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EVIDENCE, 'readonly')
    const store = tx.objectStore(STORES.EVIDENCE)
    const index = store.index('syncStatus')
    const request = index.getAll('pending')

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

export async function updateEvidenceStatus(
  id: string,
  status: OfflineEvidenceItem['syncStatus'],
  error?: string
): Promise<void> {
  const db = await initDB()
  const evidence = await getEvidence(id)

  if (!evidence) {
    throw new Error(`Evidence not found: ${id}`)
  }

  evidence.syncStatus = status
  if (error) {
    evidence.lastError = error
    evidence.retryCount = (evidence.retryCount || 0) + 1
  }

  return saveEvidence(evidence)
}

export async function deleteEvidence(id: string): Promise<void> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EVIDENCE, 'readwrite')
    const store = tx.objectStore(STORES.EVIDENCE)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function clearSyncedEvidence(): Promise<number> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EVIDENCE, 'readwrite')
    const store = tx.objectStore(STORES.EVIDENCE)
    const index = store.index('syncStatus')
    const request = index.openCursor(IDBKeyRange.only('synced'))

    let deleted = 0

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor) {
        cursor.delete()
        deleted++
        cursor.continue()
      } else {
        resolve(deleted)
      }
    }

    request.onerror = () => reject(request.error)
  })
}

// ============================================================================
// STORAGE STATS
// ============================================================================

export async function getStorageStats(): Promise<OfflineStorageStats> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EVIDENCE, 'readonly')
    const store = tx.objectStore(STORES.EVIDENCE)
    const request = store.getAll()

    request.onsuccess = () => {
      const items = request.result as OfflineEvidenceItem[]
      let totalSize = 0
      let pendingCount = 0
      let oldestAt: string | null = null

      items.forEach((item) => {
        if (item.photoBlob) {
          totalSize += item.photoBlob.size
        }
        if (item.syncStatus === 'pending') {
          pendingCount++
        }
        if (!oldestAt || item.createdAt < oldestAt) {
          oldestAt = item.createdAt
        }
      })

      resolve({
        totalItems: items.length,
        totalSizeBytes: totalSize,
        oldestItemAt: oldestAt,
        pendingUploadCount: pendingCount,
      })
    }

    request.onerror = () => reject(request.error)
  })
}

export async function isStorageNearLimit(): Promise<boolean> {
  const stats = await getStorageStats()
  return stats.totalSizeBytes >= STORAGE_LIMITS.WARNING_THRESHOLD_BYTES
}

// ============================================================================
// METADATA
// ============================================================================

export async function setMetadata(
  key: string,
  value: unknown
): Promise<void> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.METADATA, 'readwrite')
    const store = tx.objectStore(STORES.METADATA)
    const request = store.put({ key, value, updatedAt: new Date().toISOString() })

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getMetadata<T>(key: string): Promise<T | null> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.METADATA, 'readonly')
    const store = tx.objectStore(STORES.METADATA)
    const request = store.get(key)

    request.onsuccess = () => {
      const result = request.result
      resolve(result ? result.value : null)
    }
    request.onerror = () => reject(request.error)
  })
}
