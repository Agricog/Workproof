/**
 * WorkProof Core Data Models
 * Based on the WorkProof product brief data model
 * All types follow strict TypeScript - no 'any' types
 */

// ============================================================================
// ORGANISATION
// ============================================================================

export interface Organisation {
  id: string
  name: string
  logoUrl: string | null
  niceicNumber: string | null
  address: string
  createdAt: string // ISO timestamp
}

export interface CreateOrganisationInput {
  name: string
  logoUrl?: string
  niceicNumber?: string
  address: string
}

// ============================================================================
// WORKER
// ============================================================================

export interface Worker {
  id: string
  orgId: string
  name: string
  email: string
  jibCardNumber: string | null
  qualifications: string[]
  createdAt: string
}

export interface CreateWorkerInput {
  name: string
  email: string
  jibCardNumber?: string
  qualifications?: string[]
}

// ============================================================================
// JOB
// ============================================================================

export type JobStatus = 'active' | 'completed' | 'archived'

export interface Job {
  id: string
  orgId: string
  address: string
  clientName: string
  startDate: string // ISO date (YYYY-MM-DD)
  status: JobStatus
  equipmentId: string | null // EquipSafety link
  createdAt: string
  // Computed fields (from queries)
  taskCount?: number
  evidenceCount?: number
  completedEvidenceCount?: number
}

export interface CreateJobInput {
  address: string
  clientName: string
  startDate: string
  equipmentId?: string
}

export interface UpdateJobInput {
  address?: string
  clientName?: string
  startDate?: string
  status?: JobStatus
  equipmentId?: string
}

// ============================================================================
// TASK TYPES - Electrical Specific
// ============================================================================

export type TaskType =
  | 'consumer_unit_replacement'
  | 'eicr_inspection'
  | 'new_circuit_installation'
  | 'emergency_lighting_test'
  | 'fire_alarm_test'
  | 'ev_charger_install'
  | 'fault_finding'
  | 'pat_testing'
  | 'smoke_co_alarm_install'
  | 'solar_pv_install'
  | 'rewire_full'
  | 'rewire_partial'
  | 'outdoor_lighting'
  | 'data_cabling'
  | 'general_maintenance'

export interface TaskTypeConfig {
  id: TaskType
  label: string
  description: string
  niceicRelevance: 'high' | 'medium' | 'low'
  requiredEvidence: EvidenceType[]
  optionalEvidence: EvidenceType[]
  partPNotifiable: boolean
}

// ============================================================================
// EVIDENCE TYPES - Per Task Type
// ============================================================================

export type EvidenceType =
  // Consumer Unit
  | 'existing_board_condition'
  | 'isolation_confirmation'
  | 'new_board_installed'
  | 'main_earth_bonding'
  | 'test_meter_readings'
  | 'completed_installation'
  | 'certificate_photo'
  // EICR
  | 'db_photo'
  | 'sample_circuit_tests'
  | 'defects_found'
  | 'test_instrument_calibration'
  // General
  | 'cable_route'
  | 'containment'
  | 'connection_points'
  | 'labelling'
  // Emergency Lighting
  | 'luminaire_photo'
  | 'battery_test_readings'
  | 'logbook_entry'
  // Fire Alarm
  | 'panel_photo'
  | 'device_test_log'
  | 'call_point_activation'
  // EV Charger
  | 'location_photo'
  | 'earthing_arrangement'
  | 'protective_device'
  | 'dno_notification'
  // Fault Finding
  | 'initial_fault_indication'
  | 'investigation_photos'
  | 'resolution'
  | 'test_confirmation'
  // PAT
  | 'equipment_photo'
  | 'label_applied'
  | 'test_result'
  // Smoke/CO
  | 'location_compliance'
  | 'alarm_photo'
  | 'test_activation'
  // Solar
  | 'array_location'
  | 'inverter'
  | 'ac_dc_isolators'
  | 'g98_g99_submission'
  | 'dno_acceptance'
  // General purpose
  | 'before_photo'
  | 'after_photo'
  | 'additional_evidence'

// ============================================================================
// TASK
// ============================================================================

export type TaskStatus = 'pending' | 'in_progress' | 'complete' | 'signed_off'

export interface Task {
  id: string
  jobId: string
  taskType: TaskType
  workerId: string
  status: TaskStatus
  startedAt: string | null
  completedAt: string | null
  signedOffAt: string | null
  signedOffBy: string | null
  notes: string | null
  createdAt: string
  // Computed
  evidenceCount?: number
  requiredEvidenceCount?: number
}

export interface CreateTaskInput {
  jobId: string
  taskType: TaskType
  workerId: string
  notes?: string
}

export interface UpdateTaskInput {
  status?: TaskStatus
  notes?: string
  signedOffBy?: string
}

// ============================================================================
// EVIDENCE
// ============================================================================

export type SyncStatus = 'pending' | 'uploading' | 'synced' | 'failed'
export type VerificationStatus = 'pending' | 'verified' | 'hash_mismatch'

export interface Evidence {
  id: string
  taskId: string
  evidenceType: EvidenceType
  photoUrl: string | null // null until synced
  photoBytesHash: string // SHA-256 hash
  capturedAt: string // Device timestamp when taken
  capturedLat: number | null
  capturedLng: number | null
  syncedAt: string | null // When uploaded to server
  workerId: string
  deviceId: string
  syncStatus: SyncStatus
  verificationStatus: VerificationStatus
  createdAt: string
}

export interface CreateEvidenceInput {
  taskId: string
  evidenceType: EvidenceType
  photoBlob: Blob // Local storage before upload
  capturedAt: string
  capturedLat: number | null
  capturedLng: number | null
  workerId: string
  deviceId: string
}

// Local-only evidence (before sync)
export interface LocalEvidence extends Omit<Evidence, 'photoUrl' | 'syncedAt' | 'verificationStatus'> {
  photoBlob: Blob
  photoUrl: null
  syncedAt: null
  verificationStatus: 'pending'
}

// ============================================================================
// AUDIT PACK
// ============================================================================

export interface AuditPack {
  id: string
  orgId: string
  generatedAt: string
  dateRangeStart: string
  dateRangeEnd: string
  filtersApplied: AuditPackFilters
  pdfUrl: string | null
  jobsIncluded: string[]
  createdAt: string
}

export interface AuditPackFilters {
  taskTypes?: TaskType[]
  workerIds?: string[]
  siteAddresses?: string[]
  equipmentIds?: string[]
}

export interface CreateAuditPackInput {
  dateRangeStart: string
  dateRangeEnd: string
  filters?: AuditPackFilters
}

// ============================================================================
// EQUIPMENTS SAFETY INTEGRATION
// ============================================================================

export interface EquipmentLink {
  equipmentId: string
  equipmentName: string
  equipmentType: string
  lastTestDate: string | null
  nextTestDue: string | null
}
