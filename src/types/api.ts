/**
 * WorkProof API Types
 * Types for API responses, errors, pagination, and sync operations
 */

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: never
}

export interface ApiError {
  success: false
  data?: never
  error: {
    code: string
    message: string
    details?: Record<string, string>
  }
}

export type ApiResult<T> = ApiResponse<T> | ApiError

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface PaginationParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// ============================================================================
// AUTH TYPES
// ============================================================================

export interface AuthUser {
  id: string
  email: string
  name: string
  orgId: string
  workerId: string
  role: 'admin' | 'worker'
}

export interface AuthSession {
  user: AuthUser
  token: string
  expiresAt: string
}

// ============================================================================
// SYNC TYPES - Critical for PWA Offline Support
// ============================================================================

export type SyncOperation = 'create' | 'update' | 'delete'

export interface SyncQueueItem {
  id: string
  operation: SyncOperation
  entityType: 'job' | 'task' | 'evidence'
  entityId: string
  payload: Record<string, unknown>
  timestamp: number
  retryCount: number
  lastError?: string
  status: 'pending' | 'syncing' | 'failed'
}

export interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncAt: string | null
  lastError: string | null
}

export interface SyncResult {
  success: boolean
  syncedCount: number
  failedCount: number
  errors: Array<{
    itemId: string
    error: string
  }>
}

// ============================================================================
// OFFLINE STORAGE TYPES
// ============================================================================

export interface OfflineEvidenceItem {
  id: string
  taskId: string
  evidenceType: string
  photoBlob: Blob
  photoBytesHash: string
  capturedAt: string
  capturedLat: number | null
  capturedLng: number | null
  workerId: string
  deviceId: string
  syncStatus: 'pending' | 'uploading' | 'synced' | 'failed'
  retryCount: number
  lastError?: string
  createdAt: string
}

export interface OfflineStorageStats {
  totalItems: number
  totalSizeBytes: number
  oldestItemAt: string | null
  pendingUploadCount: number
}

// iOS has a 50MB limit for PWA storage
export const STORAGE_LIMITS = {
  MAX_TOTAL_BYTES: 45 * 1024 * 1024, // 45MB (leaving buffer)
  MAX_PHOTO_BYTES: 300 * 1024, // 300KB per photo
  WARNING_THRESHOLD_BYTES: 35 * 1024 * 1024, // 35MB
  MAX_QUEUE_ITEMS: 150, // ~150 photos at 300KB each
} as const

// ============================================================================
// PHOTO CAPTURE TYPES
// ============================================================================

export interface CaptureMetadata {
  timestamp: string
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  deviceId: string
  workerId: string
}

export interface PhotoCaptureResult {
  blob: Blob
  hash: string
  metadata: CaptureMetadata
  thumbnailDataUrl: string
}

export interface CompressionOptions {
  maxWidth: number
  maxHeight: number
  quality: number
  format: 'image/jpeg' | 'image/webp'
}

export const DEFAULT_COMPRESSION: CompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.7,
  format: 'image/jpeg',
}

// ============================================================================
// GEOLOCATION TYPES
// ============================================================================

export interface GeoLocation {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

export interface GeoLocationError {
  code: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNKNOWN'
  message: string
}

// ============================================================================
// AUDIT PACK GENERATION
// ============================================================================

export interface AuditPackGenerationRequest {
  dateRangeStart: string
  dateRangeEnd: string
  filters?: {
    taskTypes?: string[]
    workerIds?: string[]
    siteAddresses?: string[]
  }
  includeHashVerification: boolean
}

export interface AuditPackPreview {
  jobCount: number
  evidenceCount: number
  dateRange: {
    start: string
    end: string
  }
  taskTypeSummary: Record<string, number>
  estimatedPages: number
}

export interface AuditPackGenerationResult {
  packId: string
  pdfUrl: string
  generatedAt: string
  jobsIncluded: number
  evidenceIncluded: number
  hashVerificationIncluded: boolean
}

// ============================================================================
// NICEIC PROMPTS - AI Suggestions
// ============================================================================

export interface NiceicTip {
  id: string
  taskType: string
  tip: string
  importance: 'high' | 'medium' | 'low'
}

export const NICEIC_TIPS: NiceicTip[] = [
  {
    id: 'tip_calibration',
    taskType: 'consumer_unit_replacement',
    tip: 'Photograph test instrument calibration certificate if >12 months since last calibration',
    importance: 'high',
  },
  {
    id: 'tip_earthing',
    taskType: 'consumer_unit_replacement',
    tip: 'Include 25mm² main earth bonding conductor in photo',
    importance: 'high',
  },
  {
    id: 'tip_eicr_schedule',
    taskType: 'eicr_inspection',
    tip: 'Photograph schedule of inspections and test results pages',
    importance: 'high',
  },
  {
    id: 'tip_ev_dno',
    taskType: 'ev_charger_install',
    tip: 'Screenshot DNO notification confirmation email',
    importance: 'high',
  },
  {
    id: 'tip_solar_mcs',
    taskType: 'solar_pv_install',
    tip: 'Include MCS certificate number in completion photo',
    importance: 'high',
  },
]

export function getTipsForTaskType(taskType: string): NiceicTip[] {
  return NICEIC_TIPS.filter((tip) => tip.taskType === taskType)
}
