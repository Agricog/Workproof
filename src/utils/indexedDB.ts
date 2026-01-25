/**
 * WorkProof IndexedDB Storage
 * Offline-first evidence storage with sync queue
 */

const DB_NAME = 'workproof'
const DB_VERSION = 1

export interface StoredEvidence {
  id: string
  taskId: string
  jobId: string
  evidenceType: string
  photoData: string
  thumbnailData: string
  hash: string
  capturedAt: string
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  workerId: string
  synced: boolean
  syncedAt: string | null
  createdAt: string
}

export interface SyncQueueItem {
  id: string
  type: 'evidence' | 'job' | 'task'
  action: 'create' | 'update' | 'delete'
  data: Record<string, unknown>
  attempts: number
  lastAttempt: string | null
  createdAt: string
}

let dbInstance: IDBDatabase | null = null

/**
 * Open or create the database
 */
export async function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('Failed to open database'))
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const target = event.target as IDBOpenDBRequest
      const newDb = target.result

      // Evidence store
      if (!newDb.objectStoreNames.contains('evidence')) {
        const evidenceStore = newDb.createObjectStore('evidence', { keyPath: 'id' })
        evidenceStore.createIndex('taskId', 'taskId', { unique: false })
        evidenceStore.createIndex('jobId', 'jobId', { unique: false })
        evidenceStore.createIndex('synced', 'synced', { unique: false })
        evidenceStore.createIndex('createdAt', 'createdAt', { unique: false })
      }

      // Sync queue store
      if (!newDb.objectStoreNames.contains('syncQueue')) {
        const syncStore = newDb.createObjectStore('syncQueue', { keyPath: 'id' })
        syncStore.createIndex('type', 'type', { unique: false })
        syncStore.createIndex('createdAt', 'createdAt', { unique: false })
      }

      // Jobs cache store
      if (!newDb.objectStoreNames.contains('jobs')) {
        const jobsStore = newDb.createObjectStore('jobs', { keyPath: 'id' })
        jobsStore.createIndex('status', 'status', { unique: false })
      }

      // Tasks cache store
      if (!newDb.objectStoreNames.contains('tasks')) {
        const tasksStore = newDb.createObjectStore('tasks', { keyPath: 'id' })
        tasksStore.createIndex('jobId', 'jobId', { unique: false })
      }
    }
  })
}

/**
 * Save evidence to IndexedDB
 */
export async function saveEvidence(evidence: StoredEvidence): Promise<void> {
  const localDb = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = localDb.transaction(['evidence'], 'readwrite')
    const store = transaction.objectStore('evidence')
    const request = store.put(evidence)

    request.onerror = () => reject(new Error('Failed to save evidence'))
    request.onsuccess = () => resolve()
  })
}

/**
 * Get evidence by ID
 */
export async function getEvidence(id: string): Promise<StoredEvidence | null> {
  const localDb = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = localDb.transaction(['evidence'], 'readonly')
    const store = transaction.objectStore('evidence')
    const request = store.get(id)

    request.onerror = () => reject(new Error('Failed to get evidence'))
    request.onsuccess = () => resolve(request.result || null)
  })
}

/**
 * Get all evidence for a task
 */
export async function getEvidenceByTask(taskId: string): Promise<StoredEvidence[]> {
  const localDb = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = localDb.transaction(['evidence'], 'readonly')
    const store = transaction.objectStore('evidence')
    const index = store.index('taskId')
    const request = index.getAll(taskId)

    request.onerror = () => reject(new Error('Failed to get evidence'))
    request.onsuccess = () => resolve(request.result || [])
  })
}

/**
 * Get unsynced evidence
 */
export async function getUnsyncedEvidence(): Promise<StoredEvidence[]> {
  const localDb = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = localDb.transaction(['evidence'], 'readonly')
    const store = transaction.objectStore('evidence')
    const index = store.index('synced')
    const request = index.getAll(false)

    request.onerror = () => reject(new Error('Failed to get unsynced evidence'))
    request.onsuccess = () => resolve(request.result || [])
  })
}

/**
 * Mark evidence as synced
 */
export async function markEvidenceSynced(id: string): Promise<void> {
  const localDb = await openDatabase()
  const evidence = await getEvidence(id)

  if (!evidence) {
    throw new Error('Evidence not found')
  }

  evidence.synced = true
  evidence.syncedAt = new Date().toISOString()

  return saveEvidence(evidence)
}

/**
 * Delete evidence
 */
export async function deleteEvidence(id: string): Promise<void> {
  const localDb = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = localDb.transaction(['evidence'], 'readwrite')
    const store = transaction.objectStore('evidence')
    const request = store.delete(id)

    request.onerror = () => reject(new Error('Failed to delete evidence'))
    request.onsuccess = () => resolve()
  })
}

/**
 * Add item to sync queue
 */
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'attempts' | 'lastAttempt' | 'createdAt'>): Promise<string> {
  const localDb = await openDatabase()
  const id = crypto.randomUUID()

  const queueItem: SyncQueueItem = {
    ...item,
    id,
    attempts: 0,
    lastAttempt: null,
    createdAt: new Date().toISOString(),
  }

  return new Promise((resolve, reject) => {
    const transaction = localDb.transaction(['syncQueue'], 'readwrite')
    const store = transaction.objectStore('syncQueue')
    const request = store.put(queueItem)

    request.onerror = () => reject(new Error('Failed to add to sync queue'))
    request.onsuccess = () => resolve(id)
  })
}

/**
 * Get all sync queue items
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const localDb = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = localDb.transaction(['syncQueue'], 'readonly')
    const store = transaction.objectStore('syncQueue')
    const request = store.getAll()

    request.onerror = () => reject(new Error('Failed to get sync queue'))
    request.onsuccess = () => resolve(request.result || [])
  })
}

/**
 * Remove item from sync queue
 */
export async function removeFromSyncQueue(id: string): Promise<void> {
  const localDb = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = localDb.transaction(['syncQueue'], 'readwrite')
    const store = transaction.objectStore('syncQueue')
    const request = store.delete(id)

    request.onerror = () => reject(new Error('Failed to remove from sync queue'))
    request.onsuccess = () => resolve()
  })
}

/**
 * Update sync queue item attempt count
 */
export async function updateSyncAttempt(id: string): Promise<void> {
  const localDb = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = localDb.transaction(['syncQueue'], 'readwrite')
    const store = transaction.objectStore('syncQueue')
    const getRequest = store.get(id)

    getRequest.onerror = () => reject(new Error('Failed to get sync item'))
    getRequest.onsuccess = () => {
      const item = getRequest.result
      if (!item) {
        reject(new Error('Sync item not found'))
        return
      }

      item.attempts += 1
      item.lastAttempt = new Date().toISOString()

      const putRequest = store.put(item)
      putRequest.onerror = () => reject(new Error('Failed to update sync item'))
      putRequest.onsuccess = () => resolve()
    }
  })
}

/**
 * Get storage usage estimate
 */
export async function getStorageUsage(): Promise<{ used: number; quota: number }> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate()
    return {
      used: estimate.usage || 0,
      quota: estimate.quota || 0,
    }
  }
  return { used: 0, quota: 0 }
}

/**
 * Clear all local data
 */
export async function clearAllData(): Promise<void> {
  const localDb = await openDatabase()

  const stores = ['evidence', 'syncQueue', 'jobs', 'tasks']

  for (const storeName of stores) {
    await new Promise<void>((resolve, reject) => {
      const transaction = localDb.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.clear()

      request.onerror = () => reject(new Error(`Failed to clear ${storeName}`))
      request.onsuccess = () => resolve()
    })
  }
}

/**
 * Get count of items in a store
 */
export async function getStoreCount(storeName: string): Promise<number> {
  const localDb = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = localDb.transaction([storeName], 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.count()

    request.onerror = () => reject(new Error(`Failed to count ${storeName}`))
    request.onsuccess = () => resolve(request.result)
  })
}
