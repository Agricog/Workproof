/**
 * WorkProof Task Type Configurations
 * Defines required and optional evidence for each electrical task type
 * This is the "trade intelligence" that differentiates WorkProof
 */
import type { TaskType, TaskTypeConfig, EvidenceType } from './models'
import { EVIDENCE_TYPE_LABELS } from './models'

// ============================================================================
// TASK TYPE CONFIGURATIONS
// ============================================================================

export const TASK_TYPE_CONFIGS: Record<TaskType, TaskTypeConfig> = {
  consumer_unit_replacement: {
    id: 'consumer_unit_replacement',
    label: 'Consumer Unit Replacement',
    description: 'Full or partial consumer unit upgrade including main switch, RCDs, and MCBs',
    niceicRelevance: 'high',
    partPNotifiable: true,
    requiredEvidence: [
      'existing_board_condition',
      'isolation_confirmation',
      'new_board_installed',
      'main_earth_bonding',
      'test_meter_readings',
      'completed_installation',
      'certificate_photo',
    ],
    optionalEvidence: [
      'cable_route',
      'labelling',
      'test_instrument_calibration',
    ],
  },

  eicr_inspection: {
    id: 'eicr_inspection',
    label: 'EICR Inspection',
    description: 'Electrical Installation Condition Report - 5 year mandatory inspection',
    niceicRelevance: 'high',
    partPNotifiable: false,
    requiredEvidence: [
      'db_photo',
      'sample_circuit_tests',
      'test_meter_readings',
      'test_instrument_calibration',
    ],
    optionalEvidence: [
      'defects_found',
      'certificate_photo',
    ],
  },

  new_circuit_installation: {
    id: 'new_circuit_installation',
    label: 'New Circuit Installation',
    description: 'Installation of new electrical circuit from consumer unit',
    niceicRelevance: 'medium',
    partPNotifiable: true,
    requiredEvidence: [
      'cable_route',
      'containment',
      'connection_points',
      'test_meter_readings',
      'labelling',
    ],
    optionalEvidence: [
      'certificate_photo',
      'completed_installation',
    ],
  },

  emergency_lighting_test: {
    id: 'emergency_lighting_test',
    label: 'Emergency Lighting Test',
    description: 'BS 5266 compliant emergency lighting inspection and test',
    niceicRelevance: 'medium',
    partPNotifiable: false,
    requiredEvidence: [
      'luminaire_photo',
      'battery_test_readings',
      'logbook_entry',
    ],
    optionalEvidence: [
      'defects_found',
      'certificate_photo',
    ],
  },

  fire_alarm_test: {
    id: 'fire_alarm_test',
    label: 'Fire Alarm Test',
    description: 'BS 5839 compliant fire alarm inspection and test',
    niceicRelevance: 'medium',
    partPNotifiable: false,
    requiredEvidence: [
      'panel_photo',
      'device_test_log',
      'call_point_activation',
    ],
    optionalEvidence: [
      'defects_found',
      'certificate_photo',
      'logbook_entry',
    ],
  },

  ev_charger_install: {
    id: 'ev_charger_install',
    label: 'EV Charger Installation',
    description: 'Electric vehicle charger installation per IET Code of Practice',
    niceicRelevance: 'high',
    partPNotifiable: true,
    requiredEvidence: [
      'location_photo',
      'earthing_arrangement',
      'protective_device',
      'test_meter_readings',
      'dno_notification',
      'completed_installation',
    ],
    optionalEvidence: [
      'cable_route',
      'certificate_photo',
    ],
  },

  fault_finding: {
    id: 'fault_finding',
    label: 'Fault Finding',
    description: 'Diagnosis and repair of electrical faults',
    niceicRelevance: 'low',
    partPNotifiable: false,
    requiredEvidence: [
      'initial_fault_indication',
      'investigation_photos',
      'resolution',
      'test_confirmation',
    ],
    optionalEvidence: [
      'test_meter_readings',
      'before_photo',
      'after_photo',
    ],
  },

  pat_testing: {
    id: 'pat_testing',
    label: 'PAT Testing',
    description: 'Portable appliance testing and labelling',
    niceicRelevance: 'low',
    partPNotifiable: false,
    requiredEvidence: [
      'equipment_photo',
      'label_applied',
      'test_result',
    ],
    optionalEvidence: [
      'defects_found',
    ],
  },

  smoke_co_alarm_install: {
    id: 'smoke_co_alarm_install',
    label: 'Smoke/CO Alarm Installation',
    description: 'Smoke and carbon monoxide detector installation per Building Regs',
    niceicRelevance: 'medium',
    partPNotifiable: false,
    requiredEvidence: [
      'location_compliance',
      'alarm_photo',
      'test_activation',
    ],
    optionalEvidence: [
      'certificate_photo',
    ],
  },

  solar_pv_install: {
    id: 'solar_pv_install',
    label: 'Solar PV Installation',
    description: 'Photovoltaic panel installation per MCS/NICEIC requirements',
    niceicRelevance: 'high',
    partPNotifiable: true,
    requiredEvidence: [
      'array_location',
      'inverter',
      'ac_dc_isolators',
      'test_meter_readings',
      'g98_g99_submission',
      'dno_acceptance',
    ],
    optionalEvidence: [
      'earthing_arrangement',
      'certificate_photo',
      'completed_installation',
    ],
  },

  rewire_full: {
    id: 'rewire_full',
    label: 'Full Rewire',
    description: 'Complete property rewire including consumer unit',
    niceicRelevance: 'high',
    partPNotifiable: true,
    requiredEvidence: [
      'existing_board_condition',
      'cable_route',
      'containment',
      'connection_points',
      'new_board_installed',
      'main_earth_bonding',
      'test_meter_readings',
      'certificate_photo',
    ],
    optionalEvidence: [
      'before_photo',
      'after_photo',
      'labelling',
    ],
  },

  rewire_partial: {
    id: 'rewire_partial',
    label: 'Partial Rewire',
    description: 'Partial property rewire - specific circuits or areas',
    niceicRelevance: 'medium',
    partPNotifiable: true,
    requiredEvidence: [
      'cable_route',
      'connection_points',
      'test_meter_readings',
    ],
    optionalEvidence: [
      'before_photo',
      'after_photo',
      'containment',
      'certificate_photo',
    ],
  },

  outdoor_lighting: {
    id: 'outdoor_lighting',
    label: 'Outdoor Lighting',
    description: 'External lighting installation including garden and security lights',
    niceicRelevance: 'low',
    partPNotifiable: true,
    requiredEvidence: [
      'location_photo',
      'cable_route',
      'connection_points',
      'test_meter_readings',
    ],
    optionalEvidence: [
      'completed_installation',
      'protective_device',
    ],
  },

  data_cabling: {
    id: 'data_cabling',
    label: 'Data Cabling',
    description: 'Structured cabling installation for data/network',
    niceicRelevance: 'low',
    partPNotifiable: false,
    requiredEvidence: [
      'cable_route',
      'connection_points',
      'labelling',
    ],
    optionalEvidence: [
      'test_result',
      'completed_installation',
    ],
  },

  general_maintenance: {
    id: 'general_maintenance',
    label: 'General Maintenance',
    description: 'Routine maintenance, repairs, and minor works',
    niceicRelevance: 'low',
    partPNotifiable: false,
    requiredEvidence: [
      'before_photo',
      'after_photo',
    ],
    optionalEvidence: [
      'test_meter_readings',
      'additional_evidence',
    ],
  },

  // ============================================================================
  // NEW TASK TYPES
  // ============================================================================

  bathroom_installation: {
    id: 'bathroom_installation',
    label: 'Bathroom Installation',
    description: 'Electrical work in bathrooms including zones, SELV, and IP ratings',
    niceicRelevance: 'high',
    partPNotifiable: true,
    requiredEvidence: [
      'zone_identification',
      'rcd_protection',
      'bonding_connections',
      'test_meter_readings',
      'completed_installation',
    ],
    optionalEvidence: [
      'before_photo',
      'after_photo',
      'certificate_photo',
      'additional_evidence',
    ],
  },

  kitchen_installation: {
    id: 'kitchen_installation',
    label: 'Kitchen Installation',
    description: 'Kitchen electrical including cooker circuits, sockets, and appliances',
    niceicRelevance: 'medium',
    partPNotifiable: true,
    requiredEvidence: [
      'circuit_layout',
      'connection_points',
      'protective_device',
      'test_meter_readings',
      'completed_installation',
    ],
    optionalEvidence: [
      'before_photo',
      'after_photo',
      'certificate_photo',
      'additional_evidence',
    ],
  },

  electric_shower_install: {
    id: 'electric_shower_install',
    label: 'Electric Shower Installation',
    description: 'Electric shower installation including dedicated circuit and isolation',
    niceicRelevance: 'medium',
    partPNotifiable: true,
    requiredEvidence: [
      'isolation_switch',
      'cable_route',
      'connection_points',
      'test_meter_readings',
      'completed_installation',
    ],
    optionalEvidence: [
      'before_photo',
      'after_photo',
      'certificate_photo',
      'additional_evidence',
    ],
  },

  socket_installation: {
    id: 'socket_installation',
    label: 'Socket Installation',
    description: 'Adding or relocating socket outlets',
    niceicRelevance: 'low',
    partPNotifiable: false,
    requiredEvidence: [
      'before_photo',
      'connection_points',
      'test_meter_readings',
      'after_photo',
    ],
    optionalEvidence: [
      'cable_route',
      'additional_evidence',
    ],
  },

  lighting_installation: {
    id: 'lighting_installation',
    label: 'Lighting Installation',
    description: 'Interior lighting installation and modifications',
    niceicRelevance: 'low',
    partPNotifiable: false,
    requiredEvidence: [
      'before_photo',
      'connection_points',
      'test_meter_readings',
      'after_photo',
    ],
    optionalEvidence: [
      'cable_route',
      'additional_evidence',
    ],
  },

  extractor_fan_install: {
    id: 'extractor_fan_install',
    label: 'Extractor Fan Installation',
    description: 'Extractor and ventilation fan installation',
    niceicRelevance: 'low',
    partPNotifiable: false,
    requiredEvidence: [
      'location_photo',
      'connection_points',
      'test_meter_readings',
      'completed_installation',
    ],
    optionalEvidence: [
      'before_photo',
      'after_photo',
      'additional_evidence',
    ],
  },

  storage_heater_install: {
    id: 'storage_heater_install',
    label: 'Storage Heater Installation',
    description: 'Storage heater installation including dedicated circuits',
    niceicRelevance: 'low',
    partPNotifiable: false,
    requiredEvidence: [
      'location_photo',
      'circuit_layout',
      'connection_points',
      'test_meter_readings',
      'completed_installation',
    ],
    optionalEvidence: [
      'before_photo',
      'after_photo',
      'additional_evidence',
    ],
  },

  immersion_heater_install: {
    id: 'immersion_heater_install',
    label: 'Immersion Heater Installation',
    description: 'Immersion heater installation and replacement',
    niceicRelevance: 'low',
    partPNotifiable: false,
    requiredEvidence: [
      'location_photo',
      'connection_points',
      'test_meter_readings',
      'completed_installation',
    ],
    optionalEvidence: [
      'before_photo',
      'after_photo',
      'additional_evidence',
    ],
  },

  security_system_install: {
    id: 'security_system_install',
    label: 'Security System Installation',
    description: 'Intruder alarm and security system installation',
    niceicRelevance: 'low',
    partPNotifiable: false,
    requiredEvidence: [
      'panel_photo',
      'device_locations',
      'test_activation',
      'completed_installation',
    ],
    optionalEvidence: [
      'cable_route',
      'certificate_photo',
      'additional_evidence',
    ],
  },

  cctv_installation: {
    id: 'cctv_installation',
    label: 'CCTV Installation',
    description: 'CCTV camera and recording system installation',
    niceicRelevance: 'low',
    partPNotifiable: false,
    requiredEvidence: [
      'camera_locations',
      'recorder_location',
      'cable_route',
      'completed_installation',
    ],
    optionalEvidence: [
      'test_result',
      'certificate_photo',
      'additional_evidence',
    ],
  },

  landlord_certificate: {
    id: 'landlord_certificate',
    label: 'Landlord Certificate',
    description: 'Landlord electrical safety inspection (EICR for rental properties)',
    niceicRelevance: 'high',
    partPNotifiable: false,
    requiredEvidence: [
      'db_photo',
      'sample_circuit_tests',
      'test_meter_readings',
      'test_instrument_calibration',
    ],
    optionalEvidence: [
      'defects_found',
      'certificate_photo',
      'additional_evidence',
    ],
  },

  minor_works: {
    id: 'minor_works',
    label: 'Minor Works',
    description: 'BS 7671 Minor Works - small additions and alterations',
    niceicRelevance: 'low',
    partPNotifiable: false,
    requiredEvidence: [
      'before_photo',
      'connection_points',
      'test_meter_readings',
      'after_photo',
    ],
    optionalEvidence: [
      'certificate_photo',
      'additional_evidence',
    ],
  },

  custom: {
    id: 'custom',
    label: 'Custom',
    description: 'Custom or other electrical work',
    niceicRelevance: 'low',
    partPNotifiable: false,
    requiredEvidence: [
      'before_photo',
      'after_photo',
    ],
    optionalEvidence: [
      'test_meter_readings',
      'certificate_photo',
      'additional_evidence',
    ],
  },
}

// ============================================================================
// DEFAULT CONFIG FOR UNKNOWN TASK TYPES
// ============================================================================

const DEFAULT_TASK_CONFIG: TaskTypeConfig = {
  id: 'unknown' as TaskType,
  label: 'Unknown Task',
  description: 'Task type not recognized',
  niceicRelevance: 'low',
  partPNotifiable: false,
  requiredEvidence: ['before_photo', 'after_photo'],
  optionalEvidence: ['additional_evidence'],
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getTaskTypeConfig(taskType: TaskType | string): TaskTypeConfig {
  // Return config if found, otherwise return default with the taskType as label
  const config = TASK_TYPE_CONFIGS[taskType as TaskType]
  if (config) {
    return config
  }
  
  // Return a default config with the task type formatted as label
  const formattedLabel = String(taskType)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
  
  return {
    ...DEFAULT_TASK_CONFIG,
    id: taskType as TaskType,
    label: formattedLabel,
  }
}

export function getRequiredEvidence(taskType: TaskType): EvidenceType[] {
  const config = TASK_TYPE_CONFIGS[taskType]
  return config?.requiredEvidence || DEFAULT_TASK_CONFIG.requiredEvidence
}

export function getOptionalEvidence(taskType: TaskType): EvidenceType[] {
  const config = TASK_TYPE_CONFIGS[taskType]
  return config?.optionalEvidence || DEFAULT_TASK_CONFIG.optionalEvidence
}

export function getAllEvidence(taskType: TaskType): EvidenceType[] {
  const config = TASK_TYPE_CONFIGS[taskType] || DEFAULT_TASK_CONFIG
  return [...config.requiredEvidence, ...config.optionalEvidence]
}

export function getEvidenceLabel(evidenceType: EvidenceType): string {
  return EVIDENCE_TYPE_LABELS[evidenceType] || String(evidenceType).replace(/_/g, ' ')
}

export function isPartPNotifiable(taskType: TaskType): boolean {
  const config = TASK_TYPE_CONFIGS[taskType]
  return config?.partPNotifiable || false
}

export function getHighNiceicRelevanceTasks(): TaskType[] {
  return Object.values(TASK_TYPE_CONFIGS)
    .filter((config) => config.niceicRelevance === 'high')
    .map((config) => config.id)
}

export function getTaskTypeOptions(): Array<{ value: TaskType; label: string }> {
  return Object.values(TASK_TYPE_CONFIGS).map((config) => ({
    value: config.id,
    label: config.label,
  }))
}
