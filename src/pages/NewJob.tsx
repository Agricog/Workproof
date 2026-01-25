import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowLeft, MapPin, User, Calendar, Plus } from 'lucide-react'
import { validateAddress, validateClientName } from '../utils/validation'
import { TASK_TYPE_CONFIGS } from '../types/taskConfigs'
import type { TaskType } from '../types/models'
import { captureError } from '../utils/errorTracking'

interface FormData {
  address: string
  clientName: string
  startDate: string
  selectedTasks: TaskType[]
}

interface FormErrors {
  address?: string
  clientName?: string
  startDate?: string
  tasks?: string
}

export default function NewJob() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    address: '',
    clientName: '',
    startDate: new Date().toISOString().split('T')[0] || '',
    selectedTasks: [],
  })
  const [errors, setErrors] = useState<FormErrors>({})

  const handleAddressChange = (value: string) => {
    setFormData((prev) => ({ ...prev, address: value }))
    const validation = validateAddress(value)
    if (!validation.isValid) {
      const errorKeys = Object.keys(validation.errors)
      const errorKey = errorKeys[0]
      if (errorKey) {
        setErrors((prev) => ({ ...prev, address: validation.errors[errorKey] }))
      }
    } else {
      setErrors((prev) => ({ ...prev, address: undefined }))
    }
  }

  const handleClientNameChange = (value: string) => {
    setFormData((prev) => ({ ...prev, clientName: value }))
    const validation = validateClientName(value)
    if (!validation.isValid) {
      const errorKeys = Object.keys(validation.errors)
      const errorKey = errorKeys[0]
      if (errorKey) {
        setErrors((prev) => ({ ...prev, clientName: validation.errors[errorKey] }))
      }
    } else {
      setErrors((prev) => ({ ...prev, clientName: undefined }))
    }
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

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    const addressValidation = validateAddress(formData.address)
    if (!addressValidation.isValid) {
      const errorKeys = Object.keys(addressValidation.errors)
      const errorKey = errorKeys[0]
      if (errorKey) {
        newErrors.address = addressValidation.errors[errorKey]
      }
    }

    const clientValidation = validateClientName(formData.clientName)
    if (!clientValidation.isValid) {
      const errorKeys = Object.keys(clientValidation.errors)
      const errorKey = errorKeys[0]
      if (errorKey) {
        newErrors.clientName = clientValidation.errors[errorKey]
      }
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required'
    }

    if (formData.selectedTasks.length === 0) {
      newErrors.tasks = 'Select at least one task type'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      // TODO: API call to create job
      // For now, simulate success
      await new Promise((resolve) => setTimeout(resolve, 500))

      navigate('/jobs')
    } catch (error) {
      captureError(error, 'NewJob.handleSubmit')
      setErrors({ address: 'Failed to create job. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const taskTypes = Object.entries(TASK_TYPE_CONFIGS) as Array<[TaskType, (typeof TASK_TYPE_CONFIGS)[TaskType]]>

  return (
    <div>
      <Helmet>
        <title>New Job | WorkProof</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">New Job</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Job Details</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                  Site Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="address"
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleAddressChange(e.target.value)}
                    className={`input-field pl-10 ${errors.address ? 'border-red-500' : ''}`}
                    placeholder="Enter full address"
                    aria-invalid={!!errors.address}
                    aria-describedby={errors.address ? 'address-error' : undefined}
                  />
                </div>
                {errors.address && (
                  <p id="address-error" className="text-red-600 text-sm mt-1">
                    {errors.address}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 mb-1">
                  Client Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="clientName"
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => handleClientNameChange(e.target.value)}
                    className={`input-field pl-10 ${errors.clientName ? 'border-red-500' : ''}`}
                    placeholder="Enter client name"
                    aria-invalid={!!errors.clientName}
                    aria-describedby={errors.clientName ? 'client-error' : undefined}
                  />
                </div>
                {errors.clientName && (
                  <p id="client-error" className="text-red-600 text-sm mt-1">
                    {errors.clientName}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                    className={`input-field pl-10 ${errors.startDate ? 'border-red-500' : ''}`}
                    aria-invalid={!!errors.startDate}
                  />
                </div>
                {errors.startDate && (
                  <p className="text-red-600 text-sm mt-1">{errors.startDate}</p>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Task Types</h2>
            <p className="text-sm text-gray-600 mb-4">
              Select the types of work for this job
            </p>

            {errors.tasks && (
              <p className="text-red-600 text-sm mb-3">{errors.tasks}</p>
            )}

            <div className="space-y-2">
              {taskTypes.map(([type, config]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleTask(type)}
                  className={`
                    w-full flex items-center justify-between p-3 rounded-lg border
                    transition-colors text-left
                    ${
                      formData.selectedTasks.includes(type)
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`
                        w-5 h-5 rounded border-2 flex items-center justify-center
                        ${
                          formData.selectedTasks.includes(type)
                            ? 'border-green-500 bg-green-500'
                            : 'border-gray-300'
                        }
                      `}
                    >
                      {formData.selectedTasks.includes(type) && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="font-medium text-gray-900">{config.label}</span>
                  </div>
                  {config.partPNotifiable && (
                    <span className="badge badge-warning text-xs">Part P</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span>Creating...</span>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                <span>Create Job</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
