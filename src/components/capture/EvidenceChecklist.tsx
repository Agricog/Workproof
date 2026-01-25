import { Camera, CheckCircle, Circle } from 'lucide-react'
import { getTaskTypeConfig, getEvidenceLabel } from '../../types/taskConfigs'
import type { TaskType } from '../../types/models'

interface EvidenceChecklistProps {
  taskType: TaskType
  capturedEvidence: Record<string, boolean>
  onCaptureStart: (evidenceType: string) => void
}

export default function EvidenceChecklist({
  taskType,
  capturedEvidence,
  onCaptureStart,
}: EvidenceChecklistProps) {
  const config = getTaskTypeConfig(taskType)
  const requiredEvidence = config.requiredEvidence || []
  const optionalEvidence = config.optionalEvidence || []

  const isComplete = (evidenceType: string) => capturedEvidence[evidenceType] === true

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">
          Required Evidence ({requiredEvidence.filter(e => isComplete(e)).length}/{requiredEvidence.length})
        </h2>

        <div className="space-y-2">
          {requiredEvidence.map((evidenceType) => {
            const label = getEvidenceLabel(evidenceType)
            const completed = isComplete(evidenceType)

            return (
              <button
                key={evidenceType}
                onClick={() => !completed && onCaptureStart(evidenceType)}
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
                  <span className={`font-medium ${completed ? 'text-green-700' : 'text-gray-900'}`}>
                    {label}
                  </span>
                </div>
                {!completed && (
                  <Camera className="w-5 h-5 text-gray-400" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {optionalEvidence.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">
            Optional Evidence ({optionalEvidence.filter(e => isComplete(e)).length}/{optionalEvidence.length})
          </h2>

          <div className="space-y-2">
            {optionalEvidence.map((evidenceType) => {
              const label = getEvidenceLabel(evidenceType)
              const completed = isComplete(evidenceType)

              return (
                <button
                  key={evidenceType}
                  onClick={() => !completed && onCaptureStart(evidenceType)}
                  disabled={completed}
                  className={`
                    w-full flex items-center justify-between p-3 rounded-lg border
                    transition-colors
                    ${completed 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    {completed ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-300" />
                    )}
                    <span className={`font-medium ${completed ? 'text-green-700' : 'text-gray-700'}`}>
                      {label}
                    </span>
                  </div>
                  {!completed && (
                    <Camera className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
