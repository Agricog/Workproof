/**
 * WorkProof Evidence Checklist
 * Shows required and optional evidence for a task
 */

import { useState, useEffect } from 'react'
import { Camera, Check, AlertCircle, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react'
import { getEvidenceByTask } from '../../utils/indexedDB'
import { getTaskTypeConfig, getEvidenceLabel } from '../../types/taskConfigs'
import { getTipsForTaskType } from '../../types/api'
import type { TaskType, EvidenceType } from '../../types/models'
import type { OfflineEvidenceItem } from '../../types/api'

interface EvidenceChecklistProps {
  taskId: string
  taskType: TaskType
  onCaptureClick: (evidenceType: EvidenceType) => void
  onViewClick: (evidence: OfflineEvidenceItem) => void
}

export default function EvidenceChecklist({
  taskId,
  taskType,
  onCaptureClick,
  onViewClick,
}: EvidenceChecklistProps) {
  const [capturedEvidence, setCapturedEvidence] = useState<OfflineEvidenceItem[]>([])
  const [showOptional, setShowOptional] = useState(false)
  const [showTips, setShowTips] = useState(true)

  const config = getTaskTypeConfig(taskType)
  const tips = getTipsForTaskType(taskType)

  useEffect(() => {
    loadEvidence()
  }, [taskId])

  const loadEvidence = async () => {
    const evidence = await getEvidenceByTask(taskId)
    setCapturedEvidence(evidence)
  }

  const getEvidenceForType = (type: EvidenceType): OfflineEvidenceItem | undefined => {
    return capturedEvidence.find((e) => e.evidenceType === type)
  }

  const requiredCount = config.requiredEvidence.length
  const capturedRequiredCount = config.requiredEvidence.filter(
    (type) => getEvidenceForType(type)
  ).length

  const isComplete = capturedRequiredCount === requiredCount

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">Evidence Required</h3>
          <span
            className={`text-sm font-medium px-2 py-1 rounded-full ${
              isComplete
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {capturedRequiredCount}/{requiredCount}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              isComplete ? 'bg-green-500' : 'bg-amber-500'
            }`}
            style={{ width: `${(capturedRequiredCount / requiredCount) * 100}%` }}
          />
        </div>
      </div>

      {/* NICEIC Tips */}
      {tips.length > 0 && showTips && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 text-sm">NICEIC Tip</h4>
                <p className="text-blue-700 text-sm mt-1">{tips[0].tip}</p>
              </div>
            </div>
            <button
              onClick={() => setShowTips(false)}
              className="text-blue-400 hover:text-blue-600"
              aria-label="Dismiss tip"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Required Evidence */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h4 className="font-medium text-gray-900">Required Evidence</h4>
        </div>
        <ul className="divide-y divide-gray-100">
          {config.requiredEvidence.map((evidenceType) => {
            const evidence = getEvidenceForType(evidenceType)
            const isCaptured = !!evidence

            return (
              <li key={evidenceType} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isCaptured
                          ? 'bg-green-100 text-green-600'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isCaptured ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Camera className="w-4 h-4" />
                      )}
                    </div>
                    <span
                      className={`text-sm ${
                        isCaptured ? 'text-gray-500' : 'text-gray-900'
                      }`}
                    >
                      {getEvidenceLabel(evidenceType)}
                    </span>
                  </div>

                  {isCaptured ? (
                    <button
                      onClick={() => onViewClick(evidence)}
                      className="text-sm text-green-600 font-medium hover:text-green-700"
                    >
                      View
                    </button>
                  ) : (
                    <button
                      onClick={() => onCaptureClick(evidenceType)}
                      className="flex items-center gap-1 text-sm text-white bg-green-600 px-3 py-1.5 rounded-lg font-medium hover:bg-green-700 transition-colors"
                    >
                      <Camera className="w-3 h-3" />
                      Capture
                    </button>
                  )}
                </div>

                {/* Sync status indicator */}
                {evidence && evidence.syncStatus !== 'synced' && (
                  <div className="mt-2 ml-11 flex items-center gap-1 text-xs text-amber-600">
                    <AlertCircle className="w-3 h-3" />
                    <span>
                      {evidence.syncStatus === 'pending'
                        ? 'Pending upload'
                        : evidence.syncStatus === 'uploading'
                        ? 'Uploading...'
                        : 'Upload failed'}
                    </span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {/* Optional Evidence */}
      {config.optionalEvidence.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setShowOptional(!showOptional)}
            className="w-full px-4 py-3 flex items-center justify-between text-left"
          >
            <h4 className="font-medium text-gray-700">
              Optional Evidence ({config.optionalEvidence.length})
            </h4>
            {showOptional ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showOptional && (
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
              {config.optionalEvidence.map((evidenceType) => {
                const evidence = getEvidenceForType(evidenceType)
                const isCaptured = !!evidence

                return (
                  <li key={evidenceType} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isCaptured
                              ? 'bg-green-100 text-green-600'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {isCaptured ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Camera className="w-4 h-4" />
                          )}
                        </div>
                        <span className="text-sm text-gray-600">
                          {getEvidenceLabel(evidenceType)}
                        </span>
                      </div>

                      {isCaptured ? (
                        <button
                          onClick={() => onViewClick(evidence)}
                          className="text-sm text-green-600 font-medium"
                        >
                          View
                        </button>
                      ) : (
                        <button
                          onClick={() => onCaptureClick(evidenceType)}
                          className="text-sm text-gray-600 font-medium hover:text-gray-900"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* Add Extra Evidence */}
      <button
        onClick={() => onCaptureClick('additional_evidence')}
        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 font-medium hover:border-gray-400 hover:text-gray-700 transition-colors"
      >
        + Add Extra Evidence
      </button>
    </div>
  )
}
