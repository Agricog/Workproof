/**
 * WorkProof Input Validation
 * OWASP-compliant input validation and sanitization
 */

export interface ValidationResult {
  isValid: boolean
  errors: Record<string, string>
  sanitized: string
}

// Validation patterns
const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[\d\s\-+()]+$/,
  postcode: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i,
  alphanumeric: /^[a-zA-Z0-9\s]+$/,
  numeric: /^\d+$/,
  currency: /^\d+(\.\d{1,2})?$/,
}

/**
 * Validate and sanitize user input
 */
export function validateInput(
  input: string,
  type: 'email' | 'phone' | 'text' | 'postcode' | 'numeric' | 'currency' | 'alphanumeric',
  maxLength: number = 255
): ValidationResult {
  const errors: Record<string, string> = {}
  let sanitized = input.trim()

  // Length validation
  if (sanitized.length === 0) {
    errors.required = 'This field is required'
  } else if (sanitized.length > maxLength) {
    errors.length = `Maximum ${maxLength} characters allowed`
    sanitized = sanitized.substring(0, maxLength)
  }

  // Type-specific validation
  switch (type) {
    case 'email':
      if (sanitized && !PATTERNS.email.test(sanitized)) {
        errors.format = 'Invalid email format'
      }
      break

    case 'phone':
      if (sanitized && !PATTERNS.phone.test(sanitized)) {
        errors.format = 'Invalid phone number format'
      }
      break

    case 'postcode':
      if (sanitized && !PATTERNS.postcode.test(sanitized)) {
        errors.format = 'Invalid UK postcode format'
      }
      break

    case 'numeric':
      if (sanitized && !PATTERNS.numeric.test(sanitized)) {
        errors.format = 'Must contain only numbers'
      }
      break

    case 'currency':
      if (sanitized && !PATTERNS.currency.test(sanitized)) {
        errors.format = 'Invalid currency format (e.g., 123.45)'
      }
      break

    case 'alphanumeric':
      if (sanitized && !PATTERNS.alphanumeric.test(sanitized)) {
        errors.format = 'Must contain only letters and numbers'
      }
      break

    case 'text':
    default:
      // Basic text - just sanitize
      break
  }

  // XSS Protection: Escape dangerous characters
  sanitized = escapeHtml(sanitized)

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  }
}

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  }

  return str.replace(/[&<>"'/]/g, (char) => htmlEscapes[char] || char)
}

/**
 * Validate address input
 */
export function validateAddress(address: string): ValidationResult {
  const errors: Record<string, string> = {}
  let sanitized = address.trim()

  if (!sanitized) {
    errors.required = 'Address is required'
  } else if (sanitized.length < 10) {
    errors.length = 'Address seems too short'
  } else if (sanitized.length > 500) {
    errors.length = 'Address is too long'
    sanitized = sanitized.substring(0, 500)
  }

  // Check for suspicious patterns (potential injection)
  const suspiciousPatterns = [/<script/i, /javascript:/i, /on\w+=/i]
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(sanitized)) {
      errors.security = 'Invalid characters detected'
      sanitized = sanitized.replace(pattern, '')
    }
  }

  sanitized = escapeHtml(sanitized)

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  }
}

/**
 * Validate client name
 */
export function validateClientName(name: string): ValidationResult {
  const errors: Record<string, string> = {}
  let sanitized = name.trim()

  if (!sanitized) {
    errors.required = 'Client name is required'
  } else if (sanitized.length < 2) {
    errors.length = 'Name is too short'
  } else if (sanitized.length > 100) {
    errors.length = 'Name is too long'
    sanitized = sanitized.substring(0, 100)
  }

  // Only allow letters, spaces, hyphens, apostrophes
  const namePattern = /^[a-zA-Z\s\-']+$/
  if (sanitized && !namePattern.test(sanitized)) {
    errors.format = 'Name contains invalid characters'
  }

  sanitized = escapeHtml(sanitized)

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  }
}

/**
 * Validate file upload
 */
export interface FileValidationResult {
  isValid: boolean
  error?: string
}

export function validateFile(
  file: File,
  allowedTypes: string[],
  maxSizeMB: number
): FileValidationResult {
  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `File type not allowed. Allowed: ${allowedTypes.join(', ')}`,
    }
  }

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024
  if (file.size > maxSizeBytes) {
    return {
      isValid: false,
      error: `File too large. Maximum size: ${maxSizeMB}MB`,
    }
  }

  // Check filename for suspicious patterns
  const filename = file.name.toLowerCase()
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.php', '.js']
  for (const ext of dangerousExtensions) {
    if (filename.endsWith(ext)) {
      return {
        isValid: false,
        error: 'File type not allowed for security reasons',
      }
    }
  }

  return { isValid: true }
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts
  let safe = filename.replace(/\.\./g, '')

  // Remove special characters
  safe = safe.replace(/[^a-zA-Z0-9.\-_]/g, '_')

  // Limit length
  if (safe.length > 100) {
    const ext = safe.substring(safe.lastIndexOf('.'))
    const name = safe.substring(0, 100 - ext.length)
    safe = name + ext
  }

  return safe
}
