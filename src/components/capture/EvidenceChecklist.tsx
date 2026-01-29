/**
 * Evidence Checklist with Photo Stage Selection
 * Shows required/optional evidence with before/during/after stage picker
 */
import { useState } from 'react'
import { Camera, CheckCircle, Circle, X } from 'lucide-react'
import { getTaskTypeConfig, getEvidenceLabel } from '../../types/taskConfigs'
import { PHOTO_STAGE_LABELS, PHOTO_STAGE_COLORS } from '../../types/models'
import type { TaskType, EvidenceType, PhotoStage } from '../../types/models'

interface CapturedEvidenceInfo {
  captured: boolean
  stage?: PhotoStage
}

interface EvidenceChecklistProps {
  taskType: TaskType
  capturedEvidence: Record<string, CapturedEvidenceInfo>
  onCaptureStart: (evidenceType: EvidenceType, stage: PhotoStage) => void
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

  const handleStageSelect = (evidenceType: string, stage: PhotoStage) => {
    setSelectingStageFor(null)
    onCaptureStart(evidenceType as EvidenceType, stage)
  }

  const handleCancelStageSelect = () => {
    setSelectingStageFor(null)
  }

  const renderEvidenceItem = (evidenceType: string) => {
    const label = getEvidenceLabel(evidenceType as EvidenceType)
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
                onClick={() => handleStageSelect(evidenceType, stageOption)}
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
    </div>
  )
}
