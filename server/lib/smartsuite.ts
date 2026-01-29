// SmartSuite API Client for WorkProof
// Docs: https://developers.smartsuite.com/docs/api

const SMARTSUITE_API_URL = 'https://app.smartsuite.com/api/v1'

// Table IDs
export const TABLES = {
  USERS: '69776b238003f094edf63c5e',
  JOBS: '69776c237933fb532cf1a266',
  TASKS: '69776d7ec97bc897843317c3',
  EVIDENCE: '697771e023594a6597b31691',
  AUDIT_PACKS: '697773951a191cf51d09c279'
} as const

interface SmartSuiteConfig {
  apiKey: string
  workspaceId: string
}

interface QueryOptions {
  filter?: Record<string, unknown>
  sort?: Array<{ field: string; direction: 'asc' | 'desc' }>
  limit?: number
  offset?: number
}

interface SmartSuiteRecord {
  id: string
  [key: string]: unknown
}

interface ListResponse<T> {
  items: T[]
  total: number
}

// Retry configuration
const MAX_RETRIES = 3
const INITIAL_DELAY_MS = 1000  // 1 second
const MAX_DELAY_MS = 10000     // 10 seconds

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay with jitter
 */
function getBackoffDelay(attempt: number): number {
  const exponentialDelay = INITIAL_DELAY_MS * Math.pow(2, attempt)
  const jitter = Math.random() * 500  // Add up to 500ms jitter
  return Math.min(exponentialDelay + jitter, MAX_DELAY_MS)
}

class SmartSuiteClient {
  private apiKey: string
  private workspaceId: string

  constructor(config: SmartSuiteConfig) {
    this.apiKey = config.apiKey
    this.workspaceId = config.workspaceId
  }

  private async request(
    endpoint: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<unknown> {
    const url = `${SMARTSUITE_API_URL}${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Token ${this.apiKey}`,
        'Account-Id': this.workspaceId,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    // Handle rate limiting with retry
    if (response.status === 429) {
      if (retryCount < MAX_RETRIES) {
        const delay = getBackoffDelay(retryCount)
        console.log(`SmartSuite rate limited (429). Retrying in ${Math.round(delay)}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`)
        await sleep(delay)
        return this.request(endpoint, options, retryCount + 1)
      } else {
        console.error('SmartSuite rate limit: Max retries exceeded')
        throw new Error('SmartSuite API rate limit exceeded after retries')
      }
    }

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('SmartSuite API error:', {
        status: response.status,
        body: errorBody
      })
      throw new Error(`SmartSuite API error: ${response.status}`)
    }

    return response.json()
  }

  // Get single record by ID
  async getRecord<T extends SmartSuiteRecord>(
    tableId: string,
    recordId: string
  ): Promise<T> {
    const result = await this.request(`/applications/${tableId}/records/${recordId}/`)
    return result as T
  }

  // List records with optional filtering
  async listRecords<T extends SmartSuiteRecord>(
    tableId: string,
    options: QueryOptions = {}
  ): Promise<ListResponse<T>> {
    const body: Record<string, unknown> = {}

    if (options.filter) {
      body.filter = options.filter
    }
    if (options.sort) {
      body.sort = options.sort
    }
    if (options.limit) {
      body.limit = options.limit
    }
    if (options.offset) {
      body.offset = options.offset
    }

    const result = await this.request(
      `/applications/${tableId}/records/list/`,
      {
        method: 'POST',
        body: JSON.stringify(body)
      }
    )

    return result as ListResponse<T>
  }

  // Create new record
  async createRecord<T extends SmartSuiteRecord>(
    tableId: string,
    data: Omit<T, 'id'>
  ): Promise<T> {
    const result = await this.request(
      `/applications/${tableId}/records/`,
      {
        method: 'POST',
        body: JSON.stringify(data)
      }
    )
    return result as T
  }

  // Update existing record
  async updateRecord<T extends SmartSuiteRecord>(
    tableId: string,
    recordId: string,
    data: Partial<T>
  ): Promise<T> {
    const result = await this.request(
      `/applications/${tableId}/records/${recordId}/`,
      {
        method: 'PATCH',
        body: JSON.stringify(data)
      }
    )
    return result as T
  }

  // Delete record
  async deleteRecord(
    tableId: string,
    recordId: string
  ): Promise<void> {
    await this.request(
      `/applications/${tableId}/records/${recordId}/`,
      {
        method: 'DELETE'
      }
    )
  }

  // Bulk create records
  async bulkCreate<T extends SmartSuiteRecord>(
    tableId: string,
    records: Array<Omit<T, 'id'>>
  ): Promise<T[]> {
    const result = await this.request(
      `/applications/${tableId}/records/bulk/`,
      {
        method: 'POST',
        body: JSON.stringify({ items: records })
      }
    )
    return result as T[]
  }

  // Find record by field value
  async findByField<T extends SmartSuiteRecord>(
    tableId: string,
    field: string,
    value: string | number
  ): Promise<T | null> {
    const result = await this.listRecords<T>(tableId, {
      filter: {
        operator: 'and',
        fields: [
          {
            field,
            comparison: 'is',
            value
          }
        ]
      },
      limit: 1
    })

    return result.items[0] || null
  }
}

// Singleton instance
let client: SmartSuiteClient | null = null

export function getSmartSuiteClient(): SmartSuiteClient {
  if (!client) {
    const apiKey = process.env.SMARTSUITE_API_KEY
    const workspaceId = process.env.SMARTSUITE_WORKSPACE_ID

    if (!apiKey || !workspaceId) {
      throw new Error('SmartSuite credentials not configured')
    }

    client = new SmartSuiteClient({
      apiKey,
      workspaceId
    })
  }

  return client
}

export type { SmartSuiteRecord, QueryOptions, ListResponse }

