import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@clerk/clerk-react'
import {
  ArrowLeft,
  Plus,
  Check,
  Save,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { TASK_TYPE_CONFIGS } from '../types/taskConfigs'
import type { TaskType } from '../types/models'
import { trackPageView, trackEvent } from '../utils/analytics'
import { captureError } from '../utils/errorTracking'
import { jobsApi, tasksApi } from '../services/api'
import type { Job, Task } from '../types/models'

export default function AddTasks() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { getToken } = useAuth()

  const [job, setJob] = useState<Job | null>(null)
  const [existingTasks, setExistingTasks] = useState<Task[]>([])
  const [selectedTypes, setSelectedTypes] = useState<Set<TaskType>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    trackPageView('/jobs/add-tasks', 'Add Tasks')
    loadData()
  }, [jobId])

  const loadData = async () => {
    if (!jobId) return

    setIsLoading(true)
    setError(null)

    try {
      const token = await getToken()

      // Load job details
      const jobResponse = await jobsApi.get(jobId, token)
      if (jobResponse.data) {
        setJob(jobResponse.data)
      }

      // Load existing tasks
      const tasksResponse = await tasksApi.listByJob(jobId, token)
      if (tasksResponse.data) {
        setExistingTasks(tasksResponse.data)
      }
    } catch (err) {
      const errorMessage = 'Failed to load job data'
      setError(errorMessage)
      captureError(err, 'AddTasks.loadData')
    } finally {
      setIsLoading(false)
    }
  }

  const existingTaskTypes = new Set(existingTasks.map(t => t.taskType as TaskType))

  const toggleTaskType = (taskType: TaskType) => {
    setSelectedTypes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskType)) {
        newSet.delete(taskType)
      } else {
        newSet.add(taskType)
      }
      return newSet
    })
  }

  const handleSave = async () => {
    if (selectedTypes.size === 0 || !jobId) return

    setIsSaving(true)
    setError(null)

    try {
      const token = await getToken()

      // Create tasks for each selected type
      const taskTypesArray = Array.from(selectedTypes)

      const response = await tasksApi.bulkCreate(jobId, taskTypesArray, token)

      if (response.error) {
        setError(response.error)
        return
      }

      trackEvent('tasks_added')

      // Navigate back to job detail
      navigate(`/jobs/${jobId}`)
    } catch (err) {
      const errorMessage = 'Failed to add tasks'
      setError(errorMessage)
      captureError(err, 'AddTasks.handleSave')
    } finally {
      setIsSaving(false)
    }
  }

  // Get all task types as entries
  const allTaskTypes = Object.entries(TASK_TYPE_CONFIGS) as [TaskType, typeof TASK_TYPE_CONFIGS[TaskType]][]

  // Filter out already existing tasks
  const availableTaskTypes = allTaskTypes.filter(([key]) => !existingTaskTypes.has(key))

  // Group by Part P notifiable vs not
  const partPTasks = availableTaskTypes.filter(([, config]) => config.partPNotifiable)
  const otherTasks = availableTaskTypes.filter(([, config]) => !config.partPNotifiable)

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-12 bg-gray-200 rounded"></div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600">Job not found</p>
        <Link to="/jobs" className="text-green-600 hover:underline mt-2 inline-block">
          Back to Jobs
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Helmet>
        <title>Add Tasks | WorkProof</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            to={`/jobs/${jobId}`}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to job"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Add Tasks</h1>
            <p className="text-sm text-gray-500">{job.clientName} - {job.address}</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Info */}
        <p className="text-sm text-gray-600 mb-4">
          Select the task types to add to this job. {availableTaskTypes.length} task types available.
        </p>

        {/* Task Type Selection */}
        <div className="space-y-6 mb-24">
          {/* Part P Notifiable Tasks */}
          {partPTasks.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Part P Notifiable
              </h2>
              <div className="space-y-2">
                {partPTasks.map(([key, config]) => {
                  const isSelected = selectedTypes.has(key)
                  return (
                    <button
                      key={key}
                      onClick={() => toggleTaskType(key)}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        isSelected
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                      aria-pressed={isSelected}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {config.label}
                            </span>
                            <span className="badge badge-warning text-xs">Part P</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {config.requiredEvidence.length} required photos
                            {config.optionalEvidence.length > 0 && 
                              ` + ${config.optionalEvidence.length} optional`}
                          </p>
                        </div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          isSelected
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          {isSelected ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Other Tasks */}
          {otherTasks.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Other Tasks
              </h2>
              <div className="space-y-2">
                {otherTasks.map(([key, config]) => {
                  const isSelected = selectedTypes.has(key)
                  return (
                    <button
                      key={key}
                      onClick={() => toggleTaskType(key)}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        isSelected
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                      aria-pressed={isSelected}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-gray-900">
                            {config.label}
                          </span>
                          <p className="text-sm text-gray-500 mt-1">
                            {config.requiredEvidence.length} required photos
                            {config.optionalEvidence.length > 0 && 
                              ` + ${config.optionalEvidence.length} optional`}
                          </p>
                        </div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          isSelected
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          {isSelected ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {availableTaskTypes.length === 0 && (
            <div className="text-center py-8">
              <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-600">All task types have been added to this job.</p>
            </div>
          )}
        </div>

        {/* Fixed Bottom Save Button */}
        {selectedTypes.size > 0 && (
          <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t border-gray-200 safe-area-bottom">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Adding Tasks...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Add {selectedTypes.size} Task{selectedTypes.size !== 1 ? 's' : ''}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
