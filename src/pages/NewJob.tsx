/**
 * WorkProof New Job Form
 * Create job with validation and API integration
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@clerk/clerk-react'
import { ArrowLeft, MapPin, User, Calendar, Plus, AlertCircle, Phone, Mail, FileText, X } from 'lucide-react'
import { validateAddress, validateClientName, validateInput } from '../utils/validation'
import { sanitizeInput } from '../utils/sanitization'
import { TASK_TYPE_CONFIGS } from '../types/taskConfigs'
import type { TaskType } from '../types/models'
import { captureError } from '../utils/errorTracking'
import { trackJobCreated } from '../utils/analytics'
import { jobsApi, tasksApi } from '../services/api'

interface FormData {
  address: string
  postcode: string
  clientName: string
  clientPhone: string
  clientEmail: string
  startDate: string
  notes: string
  selectedTasks: TaskType[]
  customTaskName: string
}

interface FormErrors {
  address?: string
  postcode?: string
  clientName?: string
  clientPhone?: string
  clientEmail?: string
  startDate?: string
  notes?: string
  tasks?: string
  submit?: string
  customTaskName?: string
}

export default function NewJob() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [tempCustomName, setTempCustomName] = useState('')
  const [formData, setFormData] = useState<FormData>({
    address: '',
    postcode: '',
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    startDate: new Date().toISOString().split('T')[0] || '',
    notes: '',
    selectedTasks: [],
    customTaskName: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})

  const handleAddressChange = (value: string) => {
    const sanitized = sanitizeInput(value)
    setFormData((prev) => ({ ...prev, address: sanitized }))
    const validation = validateAddress(sanitized)
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

  const handlePostcodeChange = (value: string) => {
    const sanitized = sanitizeInput(value).toUpperCase()
    setFormData((prev) => ({ ...prev, postcode: sanitized }))
    
    if (sanitized) {
      const validation = validateInput(sanitized, 'postcode', 10)
      if (!validation.isValid) {
        const errorKeys = Object.keys(validation.errors)
        const errorKey = errorKeys[0]
        if (errorKey) {
          setErrors((prev) => ({ ...prev, postcode: validation.errors[errorKey] }))
        }
      } else {
        setErrors((prev) => ({ ...prev, postcode: undefined }))
      }
    } else {
      setErrors((prev) => ({ ...prev, postcode: undefined }))
    }
  }

  const handleClientNameChange = (value: string) => {
    const sanitized = sanitizeInput(value)
    setFormData((prev) => ({ ...prev, clientName: sanitized }))
    const validation = validateClientName(sanitized)
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

  const handlePhoneChange = (value: string) => {
    const sanitized = sanitizeInput(value)
    setFormData((prev) => ({ ...prev, clientPhone: sanitized }))
    
    if (sanitized) {
      const validation = validateInput(sanitized, 'phone', 20)
      if (!validation.isValid) {
        const errorKeys = Object.keys(validation.errors)
        const errorKey = errorKeys[0]
        if (errorKey) {
          setErrors((prev) => ({ ...prev, clientPhone: validation.errors[errorKey] }))
        }
      } else {
        setErrors((prev) => ({ ...prev, clientPhone: undefined }))
      }
    } else {
      setErrors((prev) => ({ ...prev, clientPhone: undefined }))
    }
  }

  const handleEmailChange = (value: string) => {
    const sanitized = sanitizeInput(value)
    setFormData((prev) => ({ ...prev, clientEmail: sanitized }))
    
    if (sanitized) {
      const validation = validateInput(sanitized, 'email', 100)
      if (!validation.isValid) {
        const errorKeys = Object.keys(validation.errors)
        const errorKey = errorKeys[0]
        if (errorKey) {
          setErrors((prev) => ({ ...prev, clientEmail: validation.errors[errorKey] }))
        }
      } else {
        setErrors((prev) => ({ ...prev, clientEmail: undefined }))
      }
    } else {
      setErrors((prev) => ({ ...prev, clientEmail: undefined }))
    }
  }

  const handleNotesChange = (value: string) => {
    const sanitized = sanitizeInput(value)
    setFormData((prev) => ({ ...prev, notes: sanitized }))
    
    if (sanitized.length > 1000) {
      setErrors((prev) => ({ ...prev, notes: 'Notes must be under 1000 characters' }))
    } else {
      setErrors((prev) => ({ ...prev, notes: undefined }))
    }
  }

  const toggleTask = (taskType: TaskType) => {
    // Special handling for custom task type
    if (taskType === 'custom') {
      if (formData.selectedTasks.includes('custom')) {
        // Deselecting custom - remove it and clear the name
        setFormData((prev) => ({
          ...prev,
          selectedTasks: prev.selectedTasks.filter((t) => t !== 'custom'),
          customTaskName: '',
        }))
      } else {
        // Selecting custom - show modal
        setTempCustomName('')
        setShowCustomModal(true)
      }
    } else {
      // Normal task toggle
      setFormData((prev) => ({
        ...prev,
        selectedTasks: prev.selectedTasks.includes(taskType)
          ? prev.selectedTasks.filter((t) => t !== taskType)
          : [...prev.selectedTasks, taskType],
      }))
    }
    setErrors((prev) => ({ ...prev, tasks: undefined }))
  }

  const handleCustomModalSubmit = () => {
    const trimmed = tempCustomName.trim()
    if (!trimmed) {
      setErrors((prev) => ({ ...prev, customTaskName: 'Please enter a description' }))
      return
    }
    if (trimmed.length < 3) {
      setErrors((prev) => ({ ...prev, customTaskName: 'Description must be at least 3 characters' }))
      return
    }
    if (trimmed.length > 100) {
      setErrors((prev) => ({ ...prev, customTaskName: 'Description must be under 100 characters' }))
      return
    }

    setFormData((prev) => ({
      ...prev,
      selectedTasks: [...prev.selectedTasks, 'custom'],
      customTaskName: sanitizeInput(trimmed),
    }))
    setErrors((prev) => ({ ...prev, customTaskName: undefined }))
    setShowCustomModal(false)
    setTempCustomName('')
  }

  const handleCustomModalCancel = () => {
    setShowCustomModal(false)
    setTempCustomName('')
    setErrors((prev) => ({ ...prev, customTaskName: undefined }))
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

    if (formData.postcode) {
      const postcodeValidation = validateInput(formData.postcode, 'postcode', 10)
      if (!postcodeValidation.isValid) {
        const errorKeys = Object.keys(postcodeValidation.errors)
        const errorKey = errorKeys[0]
        if (errorKey) {
          newErrors.postcode = postcodeValidation.errors[errorKey]
        }
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

    if (formData.clientPhone) {
      const phoneValidation = validateInput(formData.clientPhone, 'phone', 20)
      if (!phoneValidation.isValid) {
        const errorKeys = Object.keys(phoneValidation.errors)
        const errorKey = errorKeys[0]
        if (errorKey) {
          newErrors.clientPhone = phoneValidation.errors[errorKey]
        }
      }
    }

    if (formData.clientEmail) {
      const emailValidation = validateInput(formData.clientEmail, 'email', 100)
      if (!emailValidation.isValid) {
        const errorKeys = Object.keys(emailValidation.errors)
        const errorKey = errorKeys[0]
        if (errorKey) {
          newErrors.clientEmail = emailValidation.errors[errorKey]
        }
      }
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required'
    }

    if (formData.selectedTasks.length === 0) {
      newErrors.tasks = 'Select at least one task type'
    }

    if (formData.notes && formData.notes.length > 1000) {
      newErrors.notes = 'Notes must be under 1000 characters'
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
    setErrors((prev) => ({ ...prev, submit: undefined }))

    try {
      const token = await getToken()

      const jobResponse = await jobsApi.create({
        address: formData.address,
        postcode: formData.postcode || undefined,
        clientName: formData.clientName,
        clientPhone: formData.clientPhone || undefined,
        clientEmail: formData.clientEmail || undefined,
        startDate: formData.startDate,
        notes: formData.notes || undefined,
        status: 'draft',
      }, token)

      if (jobResponse.error || !jobResponse.data) {
        setErrors({ submit: jobResponse.error || 'Failed to create job' })
        return
      }

      const jobId = jobResponse.data.id

      // Create tasks for the job
      if (formData.selectedTasks.length > 0) {
        const tasksResponse = await tasksApi.bulkCreate(
          jobId,
          formData.selectedTasks,
          token,
          formData.customTaskName || undefined
        )

        if (tasksResponse.error) {
          captureError(new Error(tasksResponse.error), 'NewJob.createTasks')
        }
      }

      trackJobCreated(formData.selectedTasks.length)
      navigate(`/jobs/${jobId}`)
    } catch (error) {
      captureError(error, 'NewJob.handleSubmit')
      setErrors({ submit: 'Failed to create job. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const taskTypes = Object.entries(TASK_TYPE_CONFIGS) as Array<[TaskType, (typeof TASK_TYPE_CONFIGS)[TaskType]]>

  // Get display label for custom task
  const getTaskLabel = (type: TaskType, config: (typeof TASK_TYPE_CONFIGS)[TaskType]) => {
    if (type === 'custom' && formData.customTaskName) {
      return formData.customTaskName
    }
    return config.label
  }

  return (
    <div>
      <Helmet>
        <title>New Job | WorkProof</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Custom Task Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Custom Task</h3>
              <button
                onClick={handleCustomModalCancel}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              What type of work is this?
            </p>
            
            <input
              type="text"
              value={tempCustomName}
              onChange={(e) => {
                setTempCustomName(e.target.value)
                setErrors((prev) => ({ ...prev, customTaskName: undefined }))
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCustomModalSubmit()
                }
              }}
              className={`input-field w-full ${errors.customTaskName ? 'border-red-500' : ''}`}
              placeholder="e.g. EV Charger Installation"
              maxLength={100}
              autoFocus
            />
            
            {errors.customTaskName && (
              <p className="text-red-600 text-sm mt-2">{errors.customTaskName}</p>
            )}
            
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={handleCustomModalCancel}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCustomModalSubmit}
                className="flex-1 btn-primary"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

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

        {errors.submit && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm">{errors.submit}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Site Details</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                  Site Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
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
                  <p id="address-error" className="text-red-600 text-sm mt-1" role="alert">
                    {errors.address}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="postcode" className="block text-sm font-medium text-gray-700 mb-1">
                  Postcode
                </label>
                <input
                  id="postcode"
                  type="text"
                  value={formData.postcode}
                  onChange={(e) => handlePostcodeChange(e.target.value)}
                  className={`input-field ${errors.postcode ? 'border-red-500' : ''}`}
                  placeholder="e.g. SW1A 1AA"
                  maxLength={10}
                  aria-invalid={!!errors.postcode}
                  aria-describedby={errors.postcode ? 'postcode-error' : undefined}
                />
                {errors.postcode && (
                  <p id="postcode-error" className="text-red-600 text-sm mt-1" role="alert">
                    {errors.postcode}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Client Details</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 mb-1">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
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
                  <p id="client-error" className="text-red-600 text-sm mt-1" role="alert">
                    {errors.clientName}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="clientPhone" className="block text-sm font-medium text-gray-700 mb-1">
                  Client Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
                  <input
                    id="clientPhone"
                    type="tel"
                    value={formData.clientPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className={`input-field pl-10 ${errors.clientPhone ? 'border-red-500' : ''}`}
                    placeholder="e.g. 07700 900000"
                    aria-invalid={!!errors.clientPhone}
                    aria-describedby={errors.clientPhone ? 'phone-error' : undefined}
                  />
                </div>
                {errors.clientPhone && (
                  <p id="phone-error" className="text-red-600 text-sm mt-1" role="alert">
                    {errors.clientPhone}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="clientEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Client Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
                  <input
                    id="clientEmail"
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className={`input-field pl-10 ${errors.clientEmail ? 'border-red-500' : ''}`}
                    placeholder="client@example.com"
                    aria-invalid={!!errors.clientEmail}
                    aria-describedby={errors.clientEmail ? 'email-error' : undefined}
                  />
                </div>
                {errors.clientEmail && (
                  <p id="email-error" className="text-red-600 text-sm mt-1" role="alert">
                    {errors.clientEmail}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Job Details</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
                  <input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                    className={`input-field pl-10 ${errors.startDate ? 'border-red-500' : ''}`}
                    aria-invalid={!!errors.startDate}
                    aria-describedby={errors.startDate ? 'date-error' : undefined}
                  />
                </div>
                {errors.startDate && (
                  <p id="date-error" className="text-red-600 text-sm mt-1" role="alert">
                    {errors.startDate}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" aria-hidden="true" />
                  <textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    className={`input-field pl-10 min-h-[100px] ${errors.notes ? 'border-red-500' : ''}`}
                    placeholder="Any additional notes about this job..."
                    maxLength={1000}
                    aria-invalid={!!errors.notes}
                    aria-describedby={errors.notes ? 'notes-error' : 'notes-hint'}
                  />
                </div>
                <p id="notes-hint" className="text-gray-500 text-xs mt-1">
                  {formData.notes.length}/1000 characters
                </p>
                {errors.notes && (
                  <p id="notes-error" className="text-red-600 text-sm mt-1" role="alert">
                    {errors.notes}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Task Types</h2>
            <p className="text-sm text-gray-600 mb-4">
              Select the types of work for this job <span className="text-red-500">*</span>
            </p>

            {errors.tasks && (
              <p className="text-red-600 text-sm mb-3" role="alert">{errors.tasks}</p>
            )}

            <div className="space-y-2" role="group" aria-label="Select task types">
              {taskTypes.map(([type, config]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleTask(type)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                    formData.selectedTasks.includes(type)
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  aria-pressed={formData.selectedTasks.includes(type)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        formData.selectedTasks.includes(type)
                          ? 'border-green-500 bg-green-500'
                          : 'border-gray-300'
                      }`}
                      aria-hidden="true"
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
                    <span className="font-medium text-gray-900">{getTaskLabel(type, config)}</span>
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
                <Plus className="w-5 h-5" aria-hidden="true" />
                <span>Create Job</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
