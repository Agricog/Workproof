/**
 * WorkProof API Service
 * Secure API calls with Clerk authentication
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
  options: RequestInit = {},
  token?: string | null
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE}${endpoint}`
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        status: response.status,
        error: errorData.message || errorData.error || `Request failed with status ${response.status}`,
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
  list: async (token: string | null): Promise<ApiResponse<Job[]>> => {
    return apiRequest<Job[]>('/api/jobs', {}, token)
  },

  get: async (id: string, token: string | null): Promise<ApiResponse<Job>> => {
    return apiRequest<Job>(`/api/jobs/${id}`, {}, token)
  },

  create: async (data: Partial<Job>, token: string | null): Promise<ApiResponse<Job>> => {
    return apiRequest<Job>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token)
  },

  update: async (id: string, data: Partial<Job>, token: string | null): Promise<ApiResponse<Job>> => {
    return apiRequest<Job>(`/api/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, token)
  },

  delete: async (id: string, token: string | null): Promise<ApiResponse<void>> => {
    return apiRequest<void>(`/api/jobs/${id}`, {
      method: 'DELETE',
    }, token)
  },
}

// Tasks API
export const tasksApi = {
  listByJob: async (jobId: string, token: string | null): Promise<ApiResponse<Task[]>> => {
    return apiRequest<Task[]>(`/api/tasks?job_id=${jobId}`, {}, token)
  },

  get: async (taskId: string, token: string | null): Promise<ApiResponse<Task>> => {
    return apiRequest<Task>(`/api/tasks/${taskId}`, {}, token)
  },

  create: async (data: { job_id: string; task_type: string; notes?: string }, token: string | null): Promise<ApiResponse<Task>> => {
    return apiRequest<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token)
  },

  bulkCreate: async (jobId: string, taskTypes: string[], token: string | null): Promise<ApiResponse<Task[]>> => {
    return apiRequest<Task[]>('/api/tasks/bulk', {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId, task_types: taskTypes }),
    }, token)
  },

  update: async (taskId: string, data: Partial<Task>, token: string | null): Promise<ApiResponse<Task>> => {
    return apiRequest<Task>(`/api/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, token)
  },

  reorder: async (jobId: string, taskIds: string[], token: string | null): Promise<ApiResponse<{ success: boolean }>> => {
    return apiRequest<{ success: boolean }>('/api/tasks/reorder', {
      method: 'PUT',
      body: JSON.stringify({ job_id: jobId, task_ids: taskIds }),
    }, token)
  },

  delete: async (taskId: string, token: string | null): Promise<ApiResponse<void>> => {
    return apiRequest<void>(`/api/tasks/${taskId}`, {
      method: 'DELETE',
    }, token)
  },
}

// Evidence API
export const evidenceApi = {
  listByTask: async (taskId: string, token: string | null): Promise<ApiResponse<Evidence[]>> => {
    return apiRequest<Evidence[]>(`/api/evidence?task_id=${taskId}`, {}, token)
  },

  getUploadUrl: async (
    filename: string,
    contentType: string,
    token: string | null
  ): Promise<ApiResponse<{ upload_url: string; photo_url: string; key: string }>> => {
    return apiRequest('/api/evidence/upload-url', {
      method: 'POST',
      body: JSON.stringify({ filename, content_type: contentType }),
    }, token)
  },

  create: async (data: {
    task_id: string
    evidence_type: string
    photo_url: string
    photo_hash: string
    latitude?: number | null
    longitude?: number | null
    gps_accuracy?: number | null
    captured_at: string
  }, token: string | null): Promise<ApiResponse<Evidence>> => {
    return apiRequest<Evidence>('/api/evidence', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token)
  },

  delete: async (evidenceId: string, token: string | null): Promise<ApiResponse<void>> => {
    return apiRequest<void>(`/api/evidence/${evidenceId}`, {
      method: 'DELETE',
    }, token)
  },
}

// Audit Pack API
export const auditPackApi = {
  listByJob: async (jobId: string, token: string | null): Promise<ApiResponse<Array<{
    id: string
    job_id: string
    generated_at: string
    pdf_url?: string
    evidence_count: number
    hash: string
  }>>> => {
    return apiRequest(`/api/audit-packs?job_id=${jobId}`, {}, token)
  },

  generate: async (jobId: string, token: string | null): Promise<ApiResponse<{
    id: string
    job_id: string
    generated_at: string
    evidence_count: number
    hash: string
  }>> => {
    return apiRequest('/api/audit-packs/generate', {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId }),
    }, token)
  },

  share: async (id: string, email: string, token: string | null): Promise<ApiResponse<{ success: boolean }>> => {
    return apiRequest(`/api/audit-packs/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }, token)
  },
}

// User API
export const userApi = {
  getProfile: async (token: string | null): Promise<ApiResponse<{
    id: string
    email: string
    full_name: string
    company_name?: string
    niceic_number?: string
  }>> => {
    return apiRequest('/api/users/me', {}, token)
  },

  updateProfile: async (data: {
    full_name?: string
    company_name?: string
    niceic_number?: string
    phone?: string
  }, token: string | null): Promise<ApiResponse<void>> => {
    return apiRequest('/api/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    }, token)
  },
}
