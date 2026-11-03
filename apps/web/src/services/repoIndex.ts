export interface RepoIndexStatus {
  owner: string;
  repo: string;
  branch: string;
  status: 'idle' | 'indexing' | 'indexed' | 'error';
  indexed_files: number;
  skipped_files: number;
  symbol_count: number;
  last_indexed_at: string | null;
  last_error: string | null;
  lsp_servers: Record<string, boolean>;
}

export interface RepoSearchResult {
  path: string;
  language: string | null;
  kind: string;
  name: string;
  start_line: number;
  end_line: number;
  score: number;
  snippet: string;
}

export interface RepoSearchResponse {
  owner: string;
  repo: string;
  branch: string;
  query: string;
  indexed: boolean;
  results: RepoSearchResult[];
}

import { API_BASE_REPO } from '../constants/api';
import { HttpError, requestJson } from './http';

export class RepoIndexService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async getStatus(owner: string, repo: string, branch: string): Promise<RepoIndexStatus | null> {
    const params = new URLSearchParams({ owner, repo, branch });
    try {
      return await requestJson<RepoIndexStatus>(`${API_BASE_REPO}/index/status?${params.toString()}`, {
        headers: this.headers(),
      });
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return null;
      throw error;
    }
  }

  async indexRepository(
    owner: string,
    repo: string,
    branch: string,
    githubToken: string,
    force = true
  ): Promise<RepoIndexStatus> {
    return requestJson<RepoIndexStatus>(`${API_BASE_REPO}/index`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ owner, repo, branch, github_token: githubToken, force }),
    });
  }

  async searchRepository(
    owner: string,
    repo: string,
    branch: string,
    query: string,
    path?: string
  ): Promise<RepoSearchResponse> {
    return requestJson<RepoSearchResponse>(`${API_BASE_REPO}/search`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ owner, repo, branch, query, path: path || undefined }),
    });
  }
}
