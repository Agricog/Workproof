/**
 * WorkProof Core Data Models
 * All types follow strict TypeScript - no 'any' types
 */

// ============================================================================
// BASE RECORD
// ============================================================================

export interface BaseRecord {
  id: string
  createdAt?: string
}

// ============================================================================
// USER
// ============================================================================

export interface User extends BaseRecord {
  clerkId: string
  email: string
  fullName: string
  companyName?: string
  niceicNumber?: string
  phone?: string
  subscriptionStatus: 'free' | 'pro' | 'enterprise'
  stripeCustomerId?: string
  lastLogin?: string
}

// ============================================================================
// JOB
// ============================================================================

export type JobStatus = 'draft' | 'in_progress' | 'completed' | 'archived'

export interface Job extends BaseRecord {
  userId: string
  title: string
  address: string
  postcode: string
  clientName: string
  clientPhone?: string
  clientEmail?: string
  status: JobStatus
  startDate: string
  completionDate?: string
  notes?: string
  // Computed
  taskCount?: number
  evidenceCount?: number
  completedTaskCount?: number
}

export interface CreateJobInput {
  title: string
  address: string
  postcode: string
  clientName: string
  clientPhone?: string
  clientEmail?: string
  startDate: string
  notes?: string
}

export interface UpdateJobInput {
  title?: string
  address?: string
  postcode?: string
  clientName?: string
  clientPhone?: string
  clientEmail?: string
  status?: JobStatus
  completionDate?: string
  notes?: string
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
// PHOTO STAGE - When the photo was taken
// ============================================================================

export type PhotoStage = 'before' | 'during' | 'after'

export const PHOTO_STAGE_LABELS: Record<PhotoStage, string> = {
  before: 'Before',
  during: 'During',
  after: 'After'
}

export const PHOTO_STAGE_COLORS: Record<PhotoStage, string> = {
  before: 'bg-amber-100 text-amber-800 border-amber-300',
  during: 'bg-blue-100 text-blue-800 border-blue-300',
  after: 'bg-green-100 text-green-800 border-green-300'
}

// ============================================================================
// TASK
// ============================================================================

export type TaskStatus = 'pending' | 'in_progress' | 'complete' | 'signed_off'

export interface Task extends BaseRecord {
  jobId: string
  taskType: TaskType
  status: TaskStatus
  order?: number
  notes?: string
  startedAt?: string
  completedAt?: string
  // Computed
  evidenceCount?: number
  requiredEvidenceCount?: number
}

export interface CreateTaskInput {
  jobId: string
  taskType: TaskType
  order?: number
  notes?: string
}

export interface UpdateTaskInput {
  status?: TaskStatus
  notes?: string
  startedAt?: string
  completedAt?: string
}

// ============================================================================
// EVIDENCE
// ============================================================================

export interface Evidence extends BaseRecord {
  taskId: string
  evidenceType: EvidenceType
  photoStage?: PhotoStage  // NEW: before, during, after
  photoUrl: string
  photoHash: string
  latitude?: number
  longitude?: number
  gpsAccuracy?: number
  capturedAt: string
  syncedAt?: string
  isSynced: boolean
  notes?: string
}

export interface CreateEvidenceInput {
  taskId: string
  evidenceType: EvidenceType
  photoStage?: PhotoStage  // NEW
  photoUrl: string
  photoHash: string
  latitude?: number
  longitude?: number
  gpsAccuracy?: number
  capturedAt: string
  notes?: string
}

// ============================================================================
// AUDIT PACK
// ============================================================================

export interface AuditPack extends BaseRecord {
  jobId: string
  generatedAt: string
  pdfUrl?: string
  evidenceCount: number
  hash: string
  downloadedAt?: string
}

// ============================================================================
// EVIDENCE TYPE LABELS
// ============================================================================

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  // Consumer Unit
  existing_board_condition: 'Existing Board Condition',
  isolation_confirmation: 'Isolation Confirmation',
  new_board_installed: 'New Board Installed',
  main_earth_bonding: 'Main Earth Bonding',
  test_meter_readings: 'Test Meter Readings',
  completed_installation: 'Completed Installation',
  certificate_photo: 'Certificate Photo',
  // EICR
  db_photo: 'Distribution Board',
  sample_circuit_tests: 'Sample Circuit Tests',
  defects_found: 'Defects Found',
  test_instrument_calibration: 'Test Instrument Calibration',
  // General
  cable_route: 'Cable Route',
  containment: 'Containment',
  connection_points: 'Connection Points',
  labelling: 'Labelling',
  // Emergency Lighting
  luminaire_photo: 'Luminaire Photo',
  battery_test_readings: 'Battery Test Readings',
  logbook_entry: 'Logbook Entry',
  // Fire Alarm
  panel_photo: 'Panel Photo',
  device_test_log: 'Device Test Log',
  call_point_activation: 'Call Point Activation',
  // EV Charger
  location_photo: 'Location Photo',
  earthing_arrangement: 'Earthing Arrangement',
  protective_device: 'Protective Device',
  dno_notification: 'DNO Notification',
  // Fault Finding
  initial_fault_indication: 'Initial Fault Indication',
  investigation_photos: 'Investigation Photos',
  resolution: 'Resolution',
  test_confirmation: 'Test Confirmation',
  // PAT
  equipment_photo: 'Equipment Photo',
  label_applied: 'Label Applied',
  test_result: 'Test Result',
  // Smoke/CO
  location_compliance: 'Location Compliance',
  alarm_photo: 'Alarm Photo',
  test_activation: 'Test Activation',
  // Solar
  array_location: 'Array Location',
  inverter: 'Inverter',
  ac_dc_isolators: 'AC/DC Isolators',
  g98_g99_submission: 'G98/G99 Submission',
  dno_acceptance: 'DNO Acceptance',
  // General
  before_photo: 'Before Photo',
  after_photo: 'After Photo',
  additional_evidence: 'Additional Evidence'
}
