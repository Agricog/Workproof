/**
 * WorkProof Add Tasks Page
 * Add task types to an existing job
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@clerk/clerk-react'
import {
  ArrowLeft,
  Plus,
  Check,
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
  const [existingTaskTypes, setExistingTaskTypes] = useState<Set<string>>(new Set())
  const [selectedTypes, setSelectedTypes] = useState<Set<TaskType>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    trackPageView(`/jobs/${jobId}/add-tasks`, 'Add Tasks')
    loadJobData()
  }, [jobId])

  const loadJobData = async () => {
    if (!jobId) return

    setIsLoading(true)
    setError(null)

    try {
      const token = await getToken()

      // Fetch job details
      const jobResponse = await jobsApi.get(jobId, token)
      if (jobResponse.error || !jobResponse.data) {
        setError(jobResponse.error || 'Failed to load job')
        return
      }
      setJob(jobResponse.data)

      // Fetch existing tasks to know which types are already added
      const tasksResponse = await tasksApi.listByJob(jobId, token)
      if (tasksResponse.data) {
        const taskData = tasksResponse.data as unknown
        let taskItems: Task[] = []
        
        if (Array.isArray(taskData)) {
          taskItems = taskData
        } else if (taskData && typeof taskData === 'object' && 'items' in taskData) {
          taskItems = (taskData as { items: Task[] }).items || []
        }

        const existingTypes = new Set(taskItems.map(t => t.taskType))
        setExistingTaskTypes(existingTypes)
      }
    } catch (err) {
      captureError(err, 'AddTasks.loadJobData')
      setError('Failed to load job details')
    } finally {
      setIsLoading(false)
    }
  }

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
    if (!jobId || selectedTypes.size === 0) return

    setIsSaving(true)
    setError(null)

    try {
      const token = await getToken()
      const taskTypesArray = Array.from(selectedTypes)

      const response = await tasksApi.bulkCreate(jobId, taskTypesArray, token)
      if (response.error) {
        setError(response.error)
        return
      }

      trackEvent({
        action: 'tasks_added',
        category: 'job',
        label: jobId,
        value: taskTypesArray.length,
      })

      navigate(`/jobs/${jobId}`)
    } catch (err) {
      captureError(err, 'AddTasks.handleSave')
      setError('Failed to add tasks. Please try again.')
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
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="space-y-3 mt-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden="true" />
        <p className="text-gray-500 mb-4">Job not found</p>
        <button
          onClick={() => navigate('/jobs')}
          className="text-green-600 font-medium"
        >
          Back to jobs
        </button>
      </div>
    )
  }

  return (
    <div>
      <Helmet>
        <title>Add Tasks | {job.clientName || 'Job'} | WorkProof</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(`/jobs/${jobId}`)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Add Tasks</h1>
            <p className="text-sm text-gray-500">{job.clientName}</p>
          </div>
        </div>

        {/* Error State */}
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

        {/* Fixed Bottom Bar */}
        {selectedTypes.size > 0 && (
          <div className="fixed bottom-20 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
            <div className="max-w-lg mx-auto">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Adding Tasks...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Add {selectedTypes.size} Task{selectedTypes.size !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
