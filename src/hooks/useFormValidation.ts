/**
 * WorkProof Form Validation Hook
 * Integrates with validation.ts for consistent form handling
 * AUTAIMATE BUILD STANDARD v2 - OWASP Compliant
 */

import { useState, useCallback } from 'react'
import { validateInput, type ValidationResult } from '../utils/validation'
import { sanitizeInput } from '../utils/sanitization'

type FieldType = 'email' | 'numeric' | 'text' | 'currency' | 'phone' | 'postcode' | 'alphanumeric'

interface FieldConfig {
  type: FieldType
  required?: boolean
  maxLength?: number
  minLength?: number
  min?: number
  max?: number
}

interface FormConfig {
  [fieldName: string]: FieldConfig
}

interface FormState<T> {
  values: T
  errors: Record<string, string>
  touched: Record<string, boolean>
  isValid: boolean
  isSubmitting: boolean
}

interface UseFormValidationReturn<T> {
  values: T
  errors: Record<string, string>
  touched: Record<string, boolean>
  isValid: boolean
  isSubmitting: boolean
  handleChange: (field: keyof T, value: string) => void
  handleBlur: (field: keyof T) => void
  validateField: (field: keyof T, value: string) => string
  validateAll: () => boolean
  setSubmitting: (submitting: boolean) => void
  reset: () => void
  setFieldError: (field: keyof T, error: string) => void
}

export function useFormValidation<T extends Record<string, string>>(
  initialValues: T,
  config: FormConfig
): UseFormValidationReturn<T> {
  const [state, setState] = useState<FormState<T>>({
    values: initialValues,
    errors: {},
    touched: {},
    isValid: false,
    isSubmitting: false,
  })

  const validateField = useCallback(
    (field: keyof T, value: string): string => {
      const fieldConfig = config[field as string]
      if (!fieldConfig) return ''

      // Required check
      if (fieldConfig.required && !value.trim()) {
        return 'This field is required'
      }

      // Skip further validation if empty and not required
      if (!value.trim()) return ''

      // Min length check
      if (fieldConfig.minLength && value.length < fieldConfig.minLength) {
        return `Minimum ${fieldConfig.minLength} characters required`
      }

      // Map field type to validation type
      const validationType = fieldConfig.type
      // Use validateInput for type-specific validation
      const result: ValidationResult = validateInput(
        value,
        validationType,
        fieldConfig.maxLength || 255
      )

      if (!result.isValid) {
        return Object.values(result.errors)[0] || 'Invalid input'
      }

      // Additional type-specific validation
      if (fieldConfig.type === 'phone') {
        const phoneRegex = /^(\+44|0)[0-9]{10,11}$/
        if (!phoneRegex.test(value.replace(/\s/g, ''))) {
          return 'Invalid UK phone number'
        }
      }

      if (fieldConfig.type === 'postcode') {
        const postcodeRegex = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i
        if (!postcodeRegex.test(value.trim())) {
          return 'Invalid UK postcode'
        }
      }

      // Number range checks
      if (fieldConfig.type === 'numeric' || fieldConfig.type === 'currency') {
        const num = parseFloat(value)
        if (fieldConfig.min !== undefined && num < fieldConfig.min) {
          return `Minimum value is ${fieldConfig.min}`
        }
        if (fieldConfig.max !== undefined && num > fieldConfig.max) {
          return `Maximum value is ${fieldConfig.max}`
        }
      }

      return ''
    },
    [config]
  )

  const handleChange = useCallback(
    (field: keyof T, value: string) => {
      // Sanitize input
      const sanitized = sanitizeInput(value)

      // Validate
      const error = validateField(field, sanitized)

      setState((prev) => {
        const newErrors = { ...prev.errors, [field]: error }
        const newValues = { ...prev.values, [field]: sanitized }

        // Check overall validity
        const isValid = Object.values(newErrors).every((e) => !e) &&
          Object.keys(config).every((key) => {
            const cfg = config[key]
            if (cfg && cfg.required) {
              return !!newValues[key as keyof T]?.trim()
            }
            return true
          })

        return {
          ...prev,
          values: newValues,
          errors: newErrors,
          isValid,
        }
      })
    },
    [validateField, config]
  )

  const handleBlur = useCallback((field: keyof T) => {
    setState((prev) => ({
      ...prev,
      touched: { ...prev.touched, [field]: true },
    }))
  }, [])

  const validateAll = useCallback((): boolean => {
    const newErrors: Record<string, string> = {}
    const newTouched: Record<string, boolean> = {}

    for (const field of Object.keys(config)) {
      newTouched[field] = true
      const error = validateField(field as keyof T, state.values[field as keyof T] || '')
      if (error) {
        newErrors[field] = error
      }
    }

    const isValid = Object.keys(newErrors).length === 0

    setState((prev) => ({
      ...prev,
      errors: newErrors,
      touched: newTouched,
      isValid,
    }))

    return isValid
  }, [config, state.values, validateField])

  const setSubmitting = useCallback((submitting: boolean) => {
    setState((prev) => ({ ...prev, isSubmitting: submitting }))
  }, [])

  const reset = useCallback(() => {
    setState({
      values: initialValues,
      errors: {},
      touched: {},
      isValid: false,
      isSubmitting: false,
    })
  }, [initialValues])

  const setFieldError = useCallback((field: keyof T, error: string) => {
    setState((prev) => ({
      ...prev,
      errors: { ...prev.errors, [field]: error },
      isValid: false,
    }))
  }, [])

  return {
    values: state.values,
    errors: state.errors,
    touched: state.touched,
    isValid: state.isValid,
    isSubmitting: state.isSubmitting,
    handleChange,
    handleBlur,
    validateField,
    validateAll,
    setSubmitting,
    reset,
    setFieldError,
  }
}
