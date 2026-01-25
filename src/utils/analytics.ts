/**
 * WorkProof Analytics Utilities
 * Google Analytics 4 event tracking (Non-PII only)
 * AUTAIMATE BUILD STANDARD v2
 */

// ============================================================================
// GA4 EVENT TRACKING
// ============================================================================

type GTagEvent = {
  action: string
  category: string
  label?: string
  value?: number
  [key: string]: string | number | undefined
}

/**
 * Track custom event in GA4
 * NEVER include PII (emails, names, personal data)
 */
export function trackEvent({ action, category, label, value, ...rest }: GTagEvent): void {
  if (typeof window === 'undefined') return
  
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag
  
  if (!gtag) {
    if (import.meta.env.DEV) {
      console.log('[Analytics]', { action, category, label, value, ...rest })
    }
    return
  }

  gtag('event', action, {
    event_category: category,
    event_label: label,
    value,
    ...rest,
  })
}

// ============================================================================
// CALCULATOR/JOB EVENTS
// ============================================================================

export function trackJobCreated(taskCount: number): void {
  trackEvent({
    action: 'job_created',
    category: 'jobs',
    value: taskCount,
  })
}

export function trackJobCompleted(taskCount: number, evidenceCount: number): void {
  trackEvent({
    action: 'job_completed',
    category: 'jobs',
    value: evidenceCount,
    task_count: taskCount,
  })
}

export function trackTaskStarted(taskType: string): void {
  trackEvent({
    action: 'task_started',
    category: 'tasks',
    label: taskType,
  })
}

export function trackTaskCompleted(taskType: string, evidenceCount: number): void {
  trackEvent({
    action: 'task_completed',
    category: 'tasks',
    label: taskType,
    value: evidenceCount,
  })
}

// ============================================================================
// EVIDENCE EVENTS
// ============================================================================

export function trackEvidenceCaptured(evidenceType: string, hasGps: boolean): void {
  trackEvent({
    action: 'evidence_captured',
    category: 'evidence',
    label: evidenceType,
    has_gps: hasGps ? 1 : 0,
  })
}

export function trackEvidenceSynced(count: number): void {
  trackEvent({
    action: 'evidence_synced',
    category: 'sync',
    value: count,
  })
}

// ============================================================================
// AUDIT PACK EVENTS
// ============================================================================

export function trackAuditPackGenerated(evidenceCount: number): void {
  trackEvent({
    action: 'audit_pack_generated',
    category: 'audit',
    value: evidenceCount,
  })
}

export function trackAuditPackDownloaded(): void {
  trackEvent({
    action: 'audit_pack_downloaded',
    category: 'audit',
  })
}

// ============================================================================
// ERROR EVENTS (Non-sensitive)
// ============================================================================

export function trackError(errorType: string, context: string): void {
  trackEvent({
    action: 'error',
    category: 'errors',
    label: `${errorType}:${context}`,
  })
}

// ============================================================================
// PAGE VIEW
// ============================================================================

export function trackPageView(pagePath: string, pageTitle: string): void {
  if (typeof window === 'undefined') return
  
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag
  
  if (!gtag) return

  gtag('config', import.meta.env.VITE_GA_MEASUREMENT_ID, {
    page_path: pagePath,
    page_title: pageTitle,
  })
}
