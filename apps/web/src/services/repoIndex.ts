export interface RepoIndexStatus {
  owner: string
  repo: string
  branch: string
  status: 'idle' | 'indexing' | 'indexed' | 'error'
  indexed_files: number
  skipped_files: number
  symbol_count: number
  last_indexed_at: string | null
  last_error: string | null
  lsp_servers: Record<string, boolean>
}

export interface RepoSearchResult {
  path: string
  language: string | null
  kind: string
  name: string
  start_line: number
  end_line: number
  score: number
  snippet: string
}

export interface RepoSearchResponse {
  owner: string
  repo: string
  branch: string
  query: string
  indexed: boolean
  results: RepoSearchResult[]
}

export class RepoIndexService {
  private apiKey: string
  private apiBase = '/v1/repo'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private headers(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
  }

  async getStatus(owner: string, repo: string, branch: string): Promise<RepoIndexStatus | null> {
    const params = new URLSearchParams({ owner, repo, branch })
    const response = await fetch(`${this.apiBase}/index/status?${params.toString()}`, {
      headers: this.headers(),
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      throw new Error(`Index status error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async indexRepository(owner: string, repo: string, branch: string, githubToken: string): Promise<RepoIndexStatus> {
    const response = await fetch(`${this.apiBase}/index`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ owner, repo, branch, github_token: githubToken, force: true }),
    })

    if (!response.ok) {
      throw new Error(`Index request failed: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async searchRepository(owner: string, repo: string, branch: string, query: string, path?: string): Promise<RepoSearchResponse> {
    const response = await fetch(`${this.apiBase}/search`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ owner, repo, branch, query, path: path || undefined }),
    })

    if (!response.ok) {
      throw new Error(`Repo search failed: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }
}
