/**
 * WorkProof API Service
 * Secure API calls with CSRF protection
 */

import { captureError } from '../utils/errorTracking'
import type { Job, Task, Evidence } from '../types/models'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface ApiResponse<T> {
  data?: T
  error?: string
  status: number
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE}${endpoint}`

    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        status: response.status,
        error: errorData.message || `Request failed with status ${response.status}`,
      }
    }

    const data = await response.json()
    return { data, status: response.status }
  } catch (error) {
    captureError(error, 'apiRequest')
    return {
      status: 0,
      error: 'Network error. Please check your connection.',
    }
  }
}

// Jobs API
export const jobsApi = {
  list: async (): Promise<ApiResponse<Job[]>> => {
    return apiRequest<Job[]>('/api/jobs')
  },

  get: async (id: string): Promise<ApiResponse<Job>> => {
    return apiRequest<Job>(`/api/jobs/${id}`)
  },

  create: async (data: Partial<Job>): Promise<ApiResponse<Job>> => {
    return apiRequest<Job>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update: async (id: string, data: Partial<Job>): Promise<ApiResponse<Job>> => {
    return apiRequest<Job>(`/api/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    return apiRequest<void>(`/api/jobs/${id}`, {
      method: 'DELETE',
    })
  },
}

// Tasks API
export const tasksApi = {
  listByJob: async (jobId: string): Promise<ApiResponse<Task[]>> => {
    return apiRequest<Task[]>(`/api/jobs/${jobId}/tasks`)
  },

  get: async (jobId: string, taskId: string): Promise<ApiResponse<Task>> => {
    return apiRequest<Task>(`/api/jobs/${jobId}/tasks/${taskId}`)
  },

  create: async (jobId: string, data: Partial<Task>): Promise<ApiResponse<Task>> => {
    return apiRequest<Task>(`/api/jobs/${jobId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update: async (
    jobId: string,
    taskId: string,
    data: Partial<Task>
  ): Promise<ApiResponse<Task>> => {
    return apiRequest<Task>(`/api/jobs/${jobId}/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
}

// Evidence API
export const evidenceApi = {
  listByTask: async (taskId: string): Promise<ApiResponse<Evidence[]>> => {
    return apiRequest<Evidence[]>(`/api/tasks/${taskId}/evidence`)
  },

  upload: async (
    taskId: string,
    data: {
      evidenceType: string
      photoData: string
      thumbnailData: string
      hash: string
      capturedAt: string
      latitude: number | null
      longitude: number | null
      accuracy: number | null
    }
  ): Promise<ApiResponse<Evidence>> => {
    return apiRequest<Evidence>(`/api/tasks/${taskId}/evidence`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  delete: async (taskId: string, evidenceId: string): Promise<ApiResponse<void>> => {
    return apiRequest<void>(`/api/tasks/${taskId}/evidence/${evidenceId}`, {
      method: 'DELETE',
    })
  },
}

// Audit Pack API
export const auditPackApi = {
  generate: async (params: {
    jobIds?: string[]
    taskIds?: string[]
    dateFrom?: string
    dateTo?: string
  }): Promise<ApiResponse<{ url: string; expiresAt: string }>> => {
    return apiRequest('/api/audit-packs', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  },

  list: async (): Promise<ApiResponse<Array<{
    id: string
    createdAt: string
    jobCount: number
    evidenceCount: number
    url: string
  }>>> => {
    return apiRequest('/api/audit-packs')
  },
}

// User/Org API
export const userApi = {
  getProfile: async (): Promise<ApiResponse<{
    id: string
    email: string
    name: string
    orgId: string
    role: string
  }>> => {
    return apiRequest('/api/user/profile')
  },

  updateProfile: async (data: {
    name?: string
  }): Promise<ApiResponse<void>> => {
    return apiRequest('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
}
