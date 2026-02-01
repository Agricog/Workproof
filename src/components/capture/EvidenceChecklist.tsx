/**
 * Evidence Checklist with Photo Stage Selection
 * Shows required/custom/optional evidence with before/during/after stage picker
 */
import { useState } from 'react'
import { Camera, CheckCircle, Circle, X, Plus } from 'lucide-react'
import { getTaskTypeConfig, getEvidenceLabel } from '../../types/taskConfigs'
import { PHOTO_STAGE_LABELS, PHOTO_STAGE_COLORS } from '../../types/models'
import type { TaskType, EvidenceType, PhotoStage } from '../../types/models'

interface CapturedEvidenceInfo {
  captured: boolean
  stage?: PhotoStage
}

interface CustomEvidenceItem {
  id: string
  name: string
}

interface EvidenceChecklistProps {
  taskType: TaskType
  capturedEvidence: Record<string, CapturedEvidenceInfo>
  onCaptureStart: (evidenceType: EvidenceType, stage: PhotoStage, customName?: string) => void
}

export default function EvidenceChecklist({
  taskType,
  capturedEvidence,
  onCaptureStart,
}: EvidenceChecklistProps) {
  const config = getTaskTypeConfig(taskType)
  const requiredEvidence = config.requiredEvidence || []
  const optionalEvidence = config.optionalEvidence || []

  // Track which item has stage selector open
  const [selectingStageFor, setSelectingStageFor] = useState<string | null>(null)
  
  // Custom evidence items
  const [customEvidence, setCustomEvidence] = useState<CustomEvidenceItem[]>([])
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customNameError, setCustomNameError] = useState('')

  const isComplete = (evidenceType: string): boolean => {
    const evidence = capturedEvidence[evidenceType]
    return evidence?.captured === true
  }

  const getStage = (evidenceType: string): PhotoStage | undefined => {
    const evidence = capturedEvidence[evidenceType]
    return evidence?.stage
  }

  const handleItemClick = (evidenceType: string) => {
    if (isComplete(evidenceType)) return
    setSelectingStageFor(evidenceType)
  }

  const handleStageSelect = (evidenceType: string, stage: PhotoStage, customName?: string) => {
    setSelectingStageFor(null)
    onCaptureStart(evidenceType as EvidenceType, stage, customName)
  }

  const handleCancelStageSelect = () => {
    setSelectingStageFor(null)
  }

  // Custom evidence handlers
  const handleAddCustomClick = () => {
    setShowCustomModal(true)
    setCustomName('')
    setCustomNameError('')
  }

  const handleCustomModalCancel = () => {
    setShowCustomModal(false)
    setCustomName('')
    setCustomNameError('')
  }

  const handleCustomModalSubmit = () => {
    const trimmed = customName.trim()
    
    // Validation
    if (trimmed.length < 3) {
      setCustomNameError('Name must be at least 3 characters')
      return
    }
    if (trimmed.length > 50) {
      setCustomNameError('Name must be 50 characters or less')
      return
    }

    // Create unique ID for this custom item
    const id = `custom_${Date.now()}_${trimmed.toLowerCase().replace(/\s+/g, '_')}`
    
    // Add to custom evidence list
    setCustomEvidence(prev => [...prev, { id, name: trimmed }])
    
    // Close modal and immediately open stage selector
    setShowCustomModal(false)
    setCustomName('')
    setSelectingStageFor(id)
  }

  const handleCustomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCustomModalSubmit()
    }
  }

  const renderEvidenceItem = (evidenceType: string, customName?: string) => {
    const label = customName || getEvidenceLabel(evidenceType as EvidenceType)
    const completed = isComplete(evidenceType)
    const stage = getStage(evidenceType)
    const isSelectingStage = selectingStageFor === evidenceType

    if (isSelectingStage) {
      return (
        <div
          key={evidenceType}
          className="p-4 rounded-lg border-2 border-green-300 bg-green-50"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-gray-900">{label}</span>
            <button
              onClick={handleCancelStageSelect}
              className="p-1 text-gray-400 hover:text-gray-600"
              aria-label="Cancel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-3">When was this photo taken?</p>
          <div className="grid grid-cols-3 gap-2">
            {(['before', 'during', 'after'] as PhotoStage[]).map((stageOption) => (
              <button
                key={stageOption}
                onClick={() => handleStageSelect(evidenceType, stageOption, customName)}
                className={`
                  py-3 px-4 rounded-lg border-2 font-medium text-center
                  transition-all hover:scale-[1.02]
                  ${PHOTO_STAGE_COLORS[stageOption]}
                `}
              >
                {PHOTO_STAGE_LABELS[stageOption]}
              </button>
            ))}
          </div>
        </div>
      )
    }

    return (
      <button
        key={evidenceType}
        onClick={() => handleItemClick(evidenceType)}
        disabled={completed}
        className={`
          w-full flex items-center justify-between p-3 rounded-lg border
          transition-colors
          ${completed
            ? 'border-green-200 bg-green-50'
            : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
          }
        `}
      >
        <div className="flex items-center gap-3">
          {completed ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <Circle className="w-5 h-5 text-gray-300" />
          )}
          <div className="text-left">
            <span className={`font-medium ${completed ? 'text-green-700' : 'text-gray-900'}`}>
              {label}
            </span>
            {completed && stage && (
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${PHOTO_STAGE_COLORS[stage]}`}>
                {PHOTO_STAGE_LABELS[stage]}
              </span>
            )}
          </div>
        </div>
        {!completed && <Camera className="w-5 h-5 text-gray-400" />}
      </button>
    )
  }

  const capturedCustomCount = customEvidence.filter(item => isComplete(item.id)).length

  return (
    <div className="space-y-6">
      {/* Required Evidence */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">
          Required Evidence ({requiredEvidence.filter((e) => isComplete(e)).length}/
          {requiredEvidence.length})
        </h2>

        <div className="space-y-2">
          {requiredEvidence.map((evidenceType) => renderEvidenceItem(evidenceType))}
        </div>
      </div>

      {/* Custom Evidence */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">
          Custom Evidence ({capturedCustomCount}/{customEvidence.length})
        </h2>

        <div className="space-y-2">
          {customEvidence.map((item) => renderEvidenceItem(item.id, item.name))}
          
          {/* Add Custom Button */}
          <button
            onClick={handleAddCustomClick}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-gray-300 text-gray-600 hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Add Custom Evidence</span>
          </button>
        </div>
      </div>

      {/* Optional Evidence */}
      {optionalEvidence.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">
            Optional Evidence ({optionalEvidence.filter((e) => isComplete(e)).length}/
            {optionalEvidence.length})
          </h2>

          <div className="space-y-2">
            {optionalEvidence.map((evidenceType) => renderEvidenceItem(evidenceType))}
          </div>
        </div>
      )}

      {/* Custom Evidence Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-fade-in">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Add Custom Evidence
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              What evidence do you need to capture?
            </p>
            
            <input
              type="text"
              value={customName}
              onChange={(e) => {
                setCustomName(e.target.value)
                setCustomNameError('')
              }}
              onKeyDown={handleCustomKeyDown}
              placeholder="e.g., Damaged cable close-up"
              className={`w-full px-4 py-3 rounded-lg border ${
                customNameError ? 'border-red-300 bg-red-50' : 'border-gray-300'
              } focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent`}
              autoFocus
              maxLength={50}
            />
            
            {customNameError && (
              <p className="mt-2 text-sm text-red-600">{customNameError}</p>
            )}
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCustomModalCancel}
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomModalSubmit}
                className="flex-1 px-4 py-3 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
