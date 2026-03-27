export interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'symlink';
  sha: string;
  size?: number;
  downloadUrl?: string;
}

export interface GitHubBranch {
  name: string;
  commitSha: string;
  protected: boolean;
}

export interface GitHubServiceConfig {
  token?: string;
}

export class GitHubService {
  private token: string | undefined;
  private baseUrl = 'https://api.github.com';

  constructor(config: GitHubServiceConfig) {
    this.token = config.token;
  }

  private async request(
    owner: string,
    repo: string,
    path: string,
    options: {
      method?: string;
      body?: unknown;
      branch?: string;
    } = {}
  ): Promise<Response> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}${path}`;
    
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    
    return response;
  }

  async readFile(
    owner: string,
    repo: string,
    path: string,
    branch?: string
  ): Promise<{ content: string; sha: string } | null> {
    const ref = branch ? `?ref=${branch}` : '';
    const response = await this.request(owner, repo, `/contents/${path}${ref}`);
    
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const data = await response.json() as { type: string; content: string; sha: string };
    
    if (data.type !== 'file') {
      throw new Error('Path is not a file');
    }
    
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    
    return {
      content,
      sha: data.sha,
    };
  }

  async writeFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch?: string,
    sha?: string
  ): Promise<{ sha: string }> {
    const body: Record<string, unknown> = {
      message,
      content: Buffer.from(content).toString('base64'),
    };
    
    if (branch) body.branch = branch;
    if (sha) body.sha = sha;
    
    const response = await this.request(owner, repo, `/contents/${path}`, {
      method: 'PUT',
      body,
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json() as { content: { sha: string } };
    return { sha: data.content.sha };
  }

  async listFiles(
    owner: string,
    repo: string,
    path: string = '',
    branch?: string
  ): Promise<GitHubFile[]> {
    const ref = branch ? `?ref=${branch}` : '';
    const response = await this.request(owner, repo, `/contents/${path}${ref}`);
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const data = await response.json() as Array<Record<string, unknown>>;
    
    return data.map((item) => ({
      name: item.name as string,
      path: item.path as string,
      type: item.type as 'file' | 'dir' | 'symlink',
      sha: item.sha as string,
      size: item.size as number | undefined,
      downloadUrl: item.download_url as string | undefined,
    }));
  }

  async listBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    const response = await this.request(owner, repo, '/branches');
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const data = await response.json() as Array<{ name: string; commit: { sha: string }; protected: boolean }>;
    
    return data.map((branch) => ({
      name: branch.name as string,
      commitSha: (branch.commit as Record<string, unknown>).sha as string,
      protected: branch.protected as boolean,
    }));
  }
}

let gitHubService: GitHubService | null = null;

export function getGitHubService(token?: string): GitHubService {
  if (!gitHubService || token) {
    gitHubService = new GitHubService({ token });
  }
  return gitHubService;
}
  if (!gitHubService) {
    gitHubService = new GitHubService({ token });
  }
  return gitHubService;
}
