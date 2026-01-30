/**
 * WorkProof Profile Page
 * User can update Company Name, NICEIC Number, Phone
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@clerk/clerk-react'
import { ArrowLeft, Building2, CreditCard, Phone, Save, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { validateInput } from '../utils/validation'
import { sanitizeInput } from '../utils/sanitization'
import { captureError } from '../utils/errorTracking'

interface ProfileData {
  companyName: string
  niceicNumber: string
  phone: string
}

interface FormErrors {
  companyName?: string
  niceicNumber?: string
  phone?: string
  submit?: string
}

export default function Profile() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [formData, setFormData] = useState<ProfileData>({
    companyName: '',
    niceicNumber: '',
    phone: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})

  // Fetch current user data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = await getToken()
        const response = await fetch('/api/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch profile')
        }

        const data = await response.json()
        
        // Map SmartSuite field IDs to readable names
        setFormData({
          companyName: data.sd3553da44 || data.company_name || '',
          niceicNumber: data.s9a8533fc1 || data.niceic_number || '',
          phone: data.s6b9c05836 || data.phone || '',
        })
      } catch (error) {
        captureError(error, 'Profile.fetchProfile')
        setErrors({ submit: 'Failed to load profile data' })
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [getToken])

  const handleCompanyNameChange = (value: string) => {
    const sanitized = sanitizeInput(value)
    setFormData((prev) => ({ ...prev, companyName: sanitized }))
    setSaveSuccess(false)
    
    if (sanitized && sanitized.length > 100) {
      setErrors((prev) => ({ ...prev, companyName: 'Company name must be under 100 characters' }))
    } else {
      setErrors((prev) => ({ ...prev, companyName: undefined }))
    }
  }

  const handleNiceicNumberChange = (value: string) => {
    // NICEIC numbers are typically alphanumeric
    const sanitized = sanitizeInput(value).toUpperCase()
    setFormData((prev) => ({ ...prev, niceicNumber: sanitized }))
    setSaveSuccess(false)
    
    if (sanitized && sanitized.length > 20) {
      setErrors((prev) => ({ ...prev, niceicNumber: 'NICEIC number must be under 20 characters' }))
    } else {
      setErrors((prev) => ({ ...prev, niceicNumber: undefined }))
    }
  }

  const handlePhoneChange = (value: string) => {
    const sanitized = sanitizeInput(value)
    setFormData((prev) => ({ ...prev, phone: sanitized }))
    setSaveSuccess(false)
    
    if (sanitized) {
      const validation = validateInput(sanitized, 'phone', 20)
      if (!validation.isValid) {
        const errorKeys = Object.keys(validation.errors)
        const errorKey = errorKeys[0]
        if (errorKey) {
          setErrors((prev) => ({ ...prev, phone: validation.errors[errorKey] }))
        }
      } else {
        setErrors((prev) => ({ ...prev, phone: undefined }))
      }
    } else {
      setErrors((prev) => ({ ...prev, phone: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (formData.companyName && formData.companyName.length > 100) {
      newErrors.companyName = 'Company name must be under 100 characters'
    }

    if (formData.niceicNumber && formData.niceicNumber.length > 20) {
      newErrors.niceicNumber = 'NICEIC number must be under 20 characters'
    }

    if (formData.phone) {
      const phoneValidation = validateInput(formData.phone, 'phone', 20)
      if (!phoneValidation.isValid) {
        const errorKeys = Object.keys(phoneValidation.errors)
        const errorKey = errorKeys[0]
        if (errorKey) {
          newErrors.phone = phoneValidation.errors[errorKey]
        }
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSaving(true)
    setErrors((prev) => ({ ...prev, submit: undefined }))
    setSaveSuccess(false)

    try {
      const token = await getToken()

      // Format phone as UK number if it starts with 0
      let formattedPhone = formData.phone
      if (formattedPhone) {
        formattedPhone = formattedPhone.replace(/\s+/g, '')
        if (formattedPhone.startsWith('0')) {
          formattedPhone = '+44' + formattedPhone.substring(1)
        } else if (!formattedPhone.startsWith('+')) {
          formattedPhone = '+44' + formattedPhone
        }
      }

      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: formData.companyName || '',
          niceicNumber: formData.niceicNumber || '',
          phone: formattedPhone || '',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update profile')
      }

      setSaveSuccess(true)
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      captureError(error, 'Profile.handleSubmit')
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to save profile' })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <Helmet>
        <title>Profile | WorkProof</title>
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
          <h1 className="text-xl font-bold text-gray-900">Profile</h1>
        </div>

        {/* Success Message */}
        {saveSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-green-800 text-sm">Profile saved successfully!</p>
          </div>
        )}

        {/* Error Message */}
        {errors.submit && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm">{errors.submit}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Business Details</h2>
            <p className="text-sm text-gray-600 mb-4">
              This information appears on your audit packs and compliance documents.
            </p>

            <div className="space-y-4">
              {/* Company Name */}
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
                  <input
                    id="companyName"
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => handleCompanyNameChange(e.target.value)}
                    className={`input-field pl-10 ${errors.companyName ? 'border-red-500' : ''}`}
                    placeholder="Your company or trading name"
                    maxLength={100}
                    aria-invalid={!!errors.companyName}
                    aria-describedby={errors.companyName ? 'company-error' : undefined}
                  />
                </div>
                {errors.companyName && (
                  <p id="company-error" className="text-red-600 text-sm mt-1" role="alert">
                    {errors.companyName}
                  </p>
                )}
              </div>

              {/* NICEIC Number */}
              <div>
                <label htmlFor="niceicNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  NICEIC Registration Number
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
                  <input
                    id="niceicNumber"
                    type="text"
                    value={formData.niceicNumber}
                    onChange={(e) => handleNiceicNumberChange(e.target.value)}
                    className={`input-field pl-10 ${errors.niceicNumber ? 'border-red-500' : ''}`}
                    placeholder="e.g. ABC12345"
                    maxLength={20}
                    aria-invalid={!!errors.niceicNumber}
                    aria-describedby={errors.niceicNumber ? 'niceic-error' : 'niceic-hint'}
                  />
                </div>
                <p id="niceic-hint" className="text-gray-500 text-xs mt-1">
                  Your NICEIC contractor registration number
                </p>
                {errors.niceicNumber && (
                  <p id="niceic-error" className="text-red-600 text-sm mt-1" role="alert">
                    {errors.niceicNumber}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Business Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className={`input-field pl-10 ${errors.phone ? 'border-red-500' : ''}`}
                    placeholder="e.g. 07700 900000"
                    maxLength={20}
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? 'phone-error' : undefined}
                  />
                </div>
                {errors.phone && (
                  <p id="phone-error" className="text-red-600 text-sm mt-1" role="alert">
                    {errors.phone}
                  </p>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" aria-hidden="true" />
                <span>Save Profile</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
