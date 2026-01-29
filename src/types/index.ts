/**
 * WorkProof Types Index
 * Central export point for all type definitions
 */
// Core data models
export * from './models'

// Task configurations and evidence types (exclude duplicate)
export { 
  TASK_CONFIGS,
  getTaskTypeConfig,
  getEvidenceLabel,
  type TaskTypeConfig 
} from './taskConfigs'

// API types, sync, and offline support
export * from './api'

// Security types
export * from './security'
