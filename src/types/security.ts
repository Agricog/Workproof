/**
 * WorkProof Security Types
 * Types for validation, CSRF protection, rate limiting, and audit logging
 */

// ============================================================================
// INPUT VALIDATION
// ============================================================================

export interface ValidationResult {
  isValid: boolean
  errors: Record<string, string>
  sanitized: string
}

export type InputType =
  | 'email'
  | 'phone'
  | 'text'
  | 'number'
  | 'currency'
  | 'postcode'
  | 'niceic_number'
  | 'jib_card'

export interface ValidationRule {
  type: InputType
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  customValidator?: (value: string) => string | null
}

// ============================================================================
// CSRF PROTECTION
// ============================================================================

export interface CsrfToken {
  token: string
  expiresAt: number
}

export interface CsrfValidation {
  isValid: boolean
  reason?: 'missing' | 'invalid' | 'expired'
}

// ============================================================================
// RATE LIMITING
// ============================================================================

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyPrefix: string
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  general: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
    keyPrefix: 'rl:general',
  },
  auth: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'rl:auth',
  },
  upload: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 200,
    keyPrefix: 'rl:upload',
  },
  sync: {
    windowMs: 60 * 1000,
    maxRequests: 50,
    keyPrefix: 'rl:sync',
  },
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export type AuditAction =
  | 'login'
  | 'logout'
  | 'job_create'
  | 'job_update'
  | 'job_delete'
  | 'task_create'
  | 'task_update'
  | 'task_complete'
  | 'task_sign_off'
  | 'evidence_capture'
  | 'evidence_upload'
  | 'evidence_delete'
  | 'audit_pack_generate'
  | 'audit_pack_download'
  | 'worker_create'
  | 'worker_update'
  | 'settings_update'

export interface AuditLogEntry {
  id: string
  userId: string
  orgId: string
  action: AuditAction
  resourceType: 'job' | 'task' | 'evidence' | 'audit_pack' | 'worker' | 'settings'
  resourceId: string | null
  ipAddress: string | null
  userAgent: string | null
  details: Record<string, unknown>
  timestamp: string
}

export interface CreateAuditLogInput {
  action: AuditAction
  resourceType: AuditLogEntry['resourceType']
  resourceId?: string
  details?: Record<string, unknown>
}

// ============================================================================
// HASH VERIFICATION
// ============================================================================

export interface HashVerification {
  evidenceId: string
  originalHash: string
  currentHash: string
  isValid: boolean
  verifiedAt: string
}

export interface EvidenceChain {
  evidenceId: string
  capturedAt: string
  capturedBy: string
  deviceId: string
  gpsCoordinates: {
    lat: number | null
    lng: number | null
  }
  originalHash: string
  syncedAt: string | null
  verificationStatus: 'pending' | 'verified' | 'hash_mismatch'
  verificationHistory: HashVerification[]
}

// ============================================================================
// SESSION SECURITY
// ============================================================================

export interface SessionConfig {
  absoluteTimeout: number
  idleTimeout: number
  refreshThreshold: number
}

export const SESSION_CONFIG: SessionConfig = {
  absoluteTimeout: 8 * 60 * 60 * 1000, // 8 hours
  idleTimeout: 30 * 60 * 1000, // 30 minutes (longer for field work)
  refreshThreshold: 5 * 60 * 1000, // 5 minutes before expiry
}

// ============================================================================
// FILE UPLOAD SECURITY
// ============================================================================

export interface FileConstraints {
  maxSize: number
  allowedTypes: string[]
  allowedExtensions: string[]
}

export const FILE_CONSTRAINTS: Record<string, FileConstraints> = {
  evidence_photo: {
    maxSize: 5 * 1024 * 1024,
    allowedTypes: ['image/jpeg', 'image/png', 'image/heic', 'image/heif'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.heic', '.heif'],
  },
  certificate_upload: {
    maxSize: 10 * 1024 * 1024,
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
  },
}

export interface FileValidationResult {
  valid: boolean
  error?: string
}

// ============================================================================
// DEVICE FINGERPRINTING
// ============================================================================

export interface DeviceFingerprint {
  deviceId: string
  userAgent: string
  platform: string
  screenResolution: string
  timezone: string
  language: string
  createdAt: string
}

// ============================================================================
// SENSITIVE DATA PATTERNS
// ============================================================================

export const SENSITIVE_PATTERNS: RegExp[] = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  /\b\d{6,8}\b/g,
]

export function redactSensitiveData(text: string): string {
  let redacted = text
  SENSITIVE_PATTERNS.forEach((pattern) => {
    redacted = redacted.replace(pattern, '[REDACTED]')
  })
  return redacted
}
