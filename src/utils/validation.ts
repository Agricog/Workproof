/**
 * WorkProof Input Validation
 * OWASP-compliant input validation and sanitization
 * NEVER trust user input - always validate AND sanitize
 */

import type { ValidationResult, InputType } from '../types/security'

// ============================================================================
// VALIDATION PATTERNS
// ============================================================================

const VALIDATION_PATTERNS: Record<InputType, RegExp> = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^(?:\+44|0)[1-9]\d{8,9}$/,
  text: /^[\w\s\-.,!?'"()\[\]{}:;@#£$%&*+=<>\/\\|~`^]+$/,
  number: /^-?\d+(\.\d+)?$/,
  currency: /^\d+(\.\d{1,2})?$/,
  postcode: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i,
  niceic_number: /^[A-Z0-9]{5,10}$/i,
  jib_card: /^[A-Z0-9]{6,8}$/i,
}

// ============================================================================
// CORE VALIDATION FUNCTION
// ============================================================================

export function validateInput(
  input: string,
  type: InputType,
  maxLength: number = 255
): ValidationResult {
  const errors: Record<string, string> = {}
  let sanitized = input.trim()

  if (sanitized.length === 0) {
    return { isValid: true, errors: {}, sanitized: '' }
  }

  if (sanitized.length > maxLength) {
    errors.length = `Maximum ${maxLength} characters allowed`
  }

  const pattern = VALIDATION_PATTERNS[type]
  if (pattern && !pattern.test(sanitized)) {
    switch (type) {
      case 'email':
        errors.format = 'Invalid email format'
        break
      case 'phone':
        errors.format = 'Invalid UK phone number'
        break
      case 'number':
        errors.format = 'Must be a valid number'
        break
      case 'currency':
        errors.format = 'Invalid currency format (e.g., 123.45)'
        break
      case 'postcode':
        errors.format = 'Invalid UK postcode'
        break
      case 'niceic_number':
        errors.format = 'Invalid NICEIC number format'
        break
      case 'jib_card':
        errors.format = 'Invalid JIB card number format'
        break
      default:
        errors.format = 'Invalid format'
    }
  }

  sanitized = escapeHtml(sanitized)

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  }
}

// ============================================================================
// HTML ESCAPING
// ============================================================================

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

export function unescapeHtml(safe: string): string {
  return safe
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
}

// ============================================================================
// FIELD VALIDATORS
// ============================================================================

export function validateEmail(email: string): ValidationResult {
  return validateInput(email, 'email', 254)
}

export function validatePhone(phone: string): ValidationResult {
  const cleaned = phone.replace(/[\s-]/g, '')
  return validateInput(cleaned, 'phone', 15)
}

export function validatePostcode(postcode: string): ValidationResult {
  return validateInput(postcode.toUpperCase(), 'postcode', 10)
}

export function validateNiceicNumber(number: string): ValidationResult {
  return validateInput(number.toUpperCase(), 'niceic_number', 10)
}

export function validateJibCard(number: string): ValidationResult {
  return validateInput(number.toUpperCase(), 'jib_card', 10)
}

export function validateCurrency(amount: string): ValidationResult {
  return validateInput(amount, 'currency', 15)
}

// ============================================================================
// OBJECT VALIDATION
// ============================================================================

export interface FieldValidation {
  field: string
  type: InputType
  required?: boolean
  maxLength?: number
}

export function validateObject(
  obj: Record<string, string>,
  fields: FieldValidation[]
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  for (const field of fields) {
    const value = obj[field.field] ?? ''

    if (field.required && !value.trim()) {
      errors[field.field] = 'This field is required'
      continue
    }

    if (!value.trim()) continue

    const result = validateInput(value, field.type, field.maxLength)
    if (!result.isValid) {
      errors[field.field] = Object.values(result.errors)[0]
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

// ============================================================================
// URL VALIDATION (SSRF Prevention)
// ============================================================================

export function validateRelativeUrl(url: string): boolean {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return false
  }
  if (url.startsWith('//')) {
    return false
  }
  if (url.includes('://')) {
    return false
  }
  return true
}

// ============================================================================
// FILENAME SANITIZATION
// ============================================================================

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^\.+/, '')
    .substring(0, 100)
}

// ============================================================================
// ADDRESS VALIDATION
// ============================================================================

export function validateAddress(address: string): ValidationResult {
  const errors: Record<string, string> = {}
  const sanitized = escapeHtml(address.trim())

  if (sanitized.length < 10) {
    errors.length = 'Address too short'
  }

  if (sanitized.length > 500) {
    errors.length = 'Address too long (max 500 characters)'
  }

  const hasNumber = /\d/.test(sanitized)
  const hasLetters = /[a-zA-Z]/.test(sanitized)

  if (!hasNumber || !hasLetters) {
    errors.format = 'Please enter a valid UK address'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  }
}

// ============================================================================
// NAME VALIDATION
// ============================================================================

export function validateName(name: string): ValidationResult {
  const errors: Record<string, string> = {}
  let sanitized = escapeHtml(name.trim())

  if (sanitized.length < 2) {
    errors.length = 'Name too short'
  }

  if (sanitized.length > 100) {
    errors.length = 'Name too long (max 100 characters)'
  }

  if (!/^[a-zA-Z\s\-']+$/.test(name)) {
    errors.format = 'Name contains invalid characters'
    sanitized = sanitized.replace(/[^a-zA-Z\s\-']/g, '')
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  }
}
