// SmartSuite record types for WorkProof

// Base record - all SmartSuite records have these
export interface BaseRecord {
  id: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown // Index signature for SmartSuite compatibility
}

// User record
export interface User extends BaseRecord {
  clerk_id: string
  email: string
  full_name: string
  company_name?: string
  niceic_number?: string
  phone?: string
  subscription_status: 'free' | 'pro' | 'enterprise'
  stripe_customer_id?: string
  last_login?: string
}

// Job record
export interface Job extends BaseRecord {
  user: string // Linked record ID
  title: string
  address: string
  postcode: string
  client_name: string
  client_phone?: string
  client_email?: string
  status: 'draft' | 'in_progress' | 'completed' | 'archived'
  start_date: string
  completion_date?: string
  notes?: string
}

// Task types
export type TaskType =
  | 'pre_inspection'
  | 'isolation_verification'
  | 'consumer_unit_before'
  | 'consumer_unit_after'
  | 'circuit_identification'
  | 'earthing_bonding'
  | 'rcd_testing'
  | 'insulation_resistance'
  | 'continuity_testing'
  | 'polarity_check'
  | 'labelling'
  | 'final_inspection'
  | 'certification'
  | 'client_handover'
  | 'custom'

// Task record
export interface Task extends BaseRecord {
  job: string // Linked record ID
  task_type: TaskType
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  order: number
  notes?: string
  started_at?: string
  completed_at?: string
}

// Evidence types
export type EvidenceType =
  | 'before_photo'
  | 'after_photo'
  | 'meter_reading'
  | 'test_result'
  | 'label_photo'
  | 'certificate_photo'
  | 'client_signature'
  | 'wiring_photo'
  | 'distribution_board'
  | 'earthing_arrangement'
  | 'bonding_connection'
  | 'rcd_test_reading'
  | 'insulation_test_reading'
  | 'continuity_reading'
  | 'zs_reading'
  | 'ze_reading'
  | 'r1_r2_reading'
  | 'ring_continuity'
  | 'polarity_confirmation'
  | 'voltage_reading'
  | 'current_reading'
  | 'power_factor'
  | 'cable_size'
  | 'mcb_rating'
  | 'rcd_type'
  | 'circuit_breaker'
  | 'fuse_rating'
  | 'cable_route'
  | 'containment'
  | 'junction_box'
  | 'accessory_installation'
  | 'socket_outlet'
  | 'switch_installation'
  | 'light_fitting'
  | 'smoke_detector'
  | 'consumer_unit_schedule'
  | 'warning_notice'
  | 'completion_certificate'
  | 'minor_works'
  | 'eicr_observation'
  | 'custom'

// Evidence record
export interface Evidence extends BaseRecord {
  task: string // Linked record ID
  evidence_type: EvidenceType
  photo_url: string
  photo_hash: string
  latitude?: number
  longitude?: number
  gps_accuracy?: number
  captured_at: string
  synced_at?: string
  is_synced: boolean
  notes?: string
}

// Audit Pack record
export interface AuditPack extends BaseRecord {
  job: string // Linked record ID
  generated_at: string
  pdf_url?: string
  evidence_count: number
  hash: string
  downloaded_at?: string
  shared_with?: string
}

// API request/response types
export interface CreateJobRequest {
  title: string
  address: string
  postcode: string
  client_name: string
  client_phone?: string
  client_email?: string
  start_date: string
  notes?: string
}

export interface UpdateJobRequest {
  title?: string
  address?: string
  postcode?: string
  client_name?: string
  client_phone?: string
  client_email?: string
  status?: 'draft' | 'in_progress' | 'completed' | 'archived'
  completion_date?: string
  notes?: string
}

export interface CreateTaskRequest {
  job: string
  task_type: TaskType
  order?: number
  notes?: string
}

export interface UpdateTaskRequest {
  status?: 'pending' | 'in_progress' | 'completed' | 'skipped'
  notes?: string
  started_at?: string
  completed_at?: string
}

export interface CreateEvidenceRequest {
  task: string
  evidence_type: EvidenceType
  photo_url: string
  photo_hash: string
  latitude?: number
  longitude?: number
  gps_accuracy?: number
  captured_at: string
  notes?: string
}

export interface GenerateAuditPackRequest {
  job: string
}

// API error response
export interface ApiError {
  error: string
  details?: string
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}
