/**
 * WorkProof Sanitization Utilities
 * XSS protection using DOMPurify
 * AUTAIMATE BUILD STANDARD v2 - OWASP Compliant
 */

import DOMPurify from 'dompurify'

// ============================================================================
// HTML SANITIZATION
// ============================================================================

/**
 * Sanitize HTML content - removes all dangerous tags/attributes
 * Use for any user-generated content that might contain HTML
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [], // No HTML tags allowed by default
    ALLOWED_ATTR: [],
  })
}

/**
 * Sanitize HTML but allow safe formatting tags
 * Use for rich text content (e.g., notes, descriptions)
 */
export function sanitizeRichText(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
  })
}

// ============================================================================
// TEXT SANITIZATION
// ============================================================================

/**
 * Escape HTML entities in plain text
 * Use before displaying any user input in the DOM
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  }
  return text.replace(/[&<>"'`=/]/g, (char) => map[char] || char)
}

/**
 * Remove all HTML tags from text
 * Use when you need plain text only
 */
export function stripHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] })
}

// ============================================================================
// INPUT SANITIZATION
// ============================================================================

/**
 * Sanitize user input for safe storage/display
 * Trims whitespace, normalizes unicode, removes control characters
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .normalize('NFC') // Normalize unicode
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' ') // Normalize whitespace
}

/**
 * Sanitize filename - remove dangerous characters
 * Use before storing/displaying uploaded filenames
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.\-_\s]/g, '_') // Only safe chars
    .replace(/_{2,}/g, '_') // No double underscores
    .replace(/^\.+/, '') // No leading dots
    .substring(0, 100) // Max length
}

/**
 * Sanitize URL - prevent javascript: and data: protocols
 * Use before rendering any user-provided URLs
 */
export function sanitizeUrl(url: string): string {
  const trimmed = url.trim().toLowerCase()
  
  // Block dangerous protocols
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:')
  ) {
    return ''
  }
  
  // Allow relative URLs and safe protocols
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:')
  ) {
    return url.trim()
  }
  
  // Default: treat as relative URL
  return url.trim()
}

// ============================================================================
// OBJECT SANITIZATION
// ============================================================================

/**
 * Deep sanitize all string values in an object
 * Use before storing form data
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj }
  
  for (const key in result) {
    const value = result[key]
    
    if (typeof value === 'string') {
      (result as Record<string, unknown>)[key] = sanitizeInput(escapeHtml(value))
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = sanitizeObject(value as Record<string, unknown>)
    }
  }
  
  return result
}
