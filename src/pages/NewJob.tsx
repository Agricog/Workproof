/**
 * WorkProof New Job Form
 * Create a new job with address and tasks
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowLeft, MapPin, User, Calendar, Plus, X, Check } from 'lucide-react'
import { validateAddress, validateName } from '../utils/validation'
import { captureError } from '../utils/errorTracking'
import { generateId } from '../utils/crypto'
import { getTaskTypeOptions, TASK_TYPE_CONFIGS } from '../types/taskConfigs'
import type { TaskType } from '../types/models'

interface FormData {
  clientName: string
  address: string
  startDate: string
  selectedTasks: TaskType[]
}

interface FormErrors {
  clientName?: string
  address?: string
  startDate?: string
  tasks?: string
}

export default function NewJob() {
  const navigate = useNavigate()
  const taskOptions = getTaskTypeOptions()

  const [formData, setFormData] = useState<FormData>({
    clientName: '',
    address: '',
    startDate: new Date().toISOString().split('T')[0],
    selectedTasks: [],
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showTaskPicker, setShowTaskPicker] = useState(false)

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const toggleTask = (taskType: TaskType) => {
    setFormData((prev) => ({
      ...prev,
      selectedTasks: prev.selectedTasks.includes(taskType)
        ? prev.selectedTasks.filter((t) => t !== taskType)
        : [...prev.selectedTasks, taskType],
    }))
    setErrors((prev) => ({ ...prev, tasks: undefined }))
  }

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    // Validate client name
    const nameResult = validateName(formData.clientName)
    if (!formData.clientName.trim()) {
      newErrors.clientName = 'Client name is required'
    } else if (!nameResult.isValid) {
      newErrors.clientName = Object.values(nameResult.errors)[0]
    }

    // Validate address
    const addressResult = validateAddress(formData.address)
    if (!formData.address.trim()) {
      newErrors.address = 'Address is required'
    } else if (!addressResult.isValid) {
      newErrors.address = Object.values(addressResult.errors)[0]
    }

    // Validate date
    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required'
    }

    // Validate tasks
    if (formData.selectedTasks.length === 0) {
      newErrors.tasks = 'Select at least one task'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    setIsSubmitting(true)

    try {
      // TODO: Save to API
      // For now, just generate ID and navigate
      const jobId = generateId()

      // Placeholder: would save to IndexedDB/API here
      console.log('Creating job:', { id: jobId, ...formData })

      navigate(`/jobs/${jobId}`)
    } catch (error) {
      captureError(error, 'NewJob.handleSubmit')
      setErrors({ address: 'Failed to create job. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>New Job | WorkProof</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">New Job</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client Name */}
          <div>
            <label
              htmlFor="clientName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Client Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="clientName"
                type="text"
                value={formData.clientName}
                onChange={(e) => handleInputChange('clientName', e.target.value)}
                placeholder="Mrs Johnson"
                className={`input-field pl-10 ${errors.clientName ? 'border-red-500' : ''}`}
                aria-invalid={!!errors.clientName}
                aria-describedby={errors.clientName ? 'clientName-error' : undefined}
              />
            </div>
            {errors.clientName && (
              <p id="clientName-error" className="mt-1 text-sm text-red-600">
                {errors.clientName}
              </p>
            )}
          </div>

          {/* Address */}
          <div>
            <label
              htmlFor="address"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Site Address
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="42 High Street, Bristol BS1 2AW"
                rows={3}
                className={`input-field pl-10 resize-none ${errors.address ? 'border-red-500' : ''}`}
                aria-invalid={!!errors.address}
                aria-describedby={errors.address ? 'address-error' : undefined}
              />
            </div>
            {errors.address && (
              <p id="address-error" className="mt-1 text-sm text-red-600">
                {errors.address}
              </p>
            )}
          </div>

          {/* Start Date */}
          <div>
            <label
              htmlFor="startDate"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Start Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                className={`input-field pl-10 ${errors.startDate ? 'border-red-500' : ''}`}
                aria-invalid={!!errors.startDate}
              />
            </div>
            {errors.startDate && (
              <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
            )}
          </div>

          {/* Tasks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tasks
            </label>

            {/* Selected tasks */}
            {formData.selectedTasks.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.selectedTasks.map((taskType) => {
                  const config = TASK_TYPE_CONFIGS[taskType]
                  return (
                    <span
                      key={taskType}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm"
                    >
                      {config.label}
                      <button
                        type="button"
                        onClick={() => toggleTask(taskType)}
                        className="hover:bg-green-200 rounded-full p-0.5"
                        aria-label={`Remove ${config.label}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}

            {/* Add task button */}
            <button
              type="button"
              onClick={() => setShowTaskPicker(true)}
              className={`w-full py-3 border-2 border-dashed rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                errors.tasks
                  ? 'border-red-300 text-red-600'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
            >
              <Plus className="w-4 h-4" />
              Add Task
            </button>
            {errors.tasks && (
              <p className="mt-1 text-sm text-red-600">{errors.tasks}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Create Job
              </>
            )}
          </button>
        </form>

        {/* Task Picker Modal */}
        {showTaskPicker && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden animate-slide-up">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Select Tasks</h3>
                <button
                  onClick={() => setShowTaskPicker(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[60vh]">
                {taskOptions.map(({ value, label }) => {
                  const isSelected = formData.selectedTasks.includes(value)
                  const config = TASK_TYPE_CONFIGS[value]

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleTask(value)}
                      className={`w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors ${
                        isSelected ? 'bg-green-50' : ''
                      }`}
                    >
                      <div>
                        <p className="font-medium text-gray-900">{label}</p>
                        <p className="text-sm text-gray-500">
                          {config.requiredEvidence.length} required photos
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
              <div className="px-4 py-3 border-t border-gray-200">
                <button
                  onClick={() => setShowTaskPicker(false)}
                  className="btn-primary w-full"
                >
                  Done ({formData.selectedTasks.length} selected)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
