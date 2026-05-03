export interface GitHubFileResponse {
  content: string;
  sha: string;
}

interface GitHubCommitResponse {
  content: {
    sha: string;
    path?: string;
    download_url?: string;
  };
}

export interface GitHubDirectoryItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  sha: string;
}

export class GitHubService {
  private static fileCache = new Map<string, GitHubFileResponse>();

  private token: string;
  private owner: string;
  private repo: string;

  constructor(token: string, owner: string, repo: string) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
  }

  private cacheKey(path: string, branch: string): string {
    return `${this.owner}/${this.repo}:${branch}:${path}`;
  }

  private setCachedFile(path: string, branch: string, file: GitHubFileResponse) {
    GitHubService.fileCache.set(this.cacheKey(path, branch), file);
  }

  invalidateFile(path: string, branch: string = 'main') {
    GitHubService.fileCache.delete(this.cacheKey(path, branch));
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getFile(path: string, branch: string = 'main', force: boolean = false): Promise<GitHubFileResponse> {
    const cacheKey = this.cacheKey(path, branch);
    if (!force) {
      const cached = GitHubService.fileCache.get(cacheKey);
      if (cached) return cached;
    }

    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}?ref=${branch}`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `token ${this.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const binaryString = atob(data.content);
      const bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0));
      const content = new TextDecoder('utf-8').decode(bytes);
      const file = { content, sha: data.sha };
      this.setCachedFile(path, branch, file);
      return file;
    } catch (error) {
      throw new Error(`Failed to fetch file: ${error}`, { cause: error });
    }
  }

  async updateFile(
    path: string,
    content: string,
    sha: string,
    message: string,
    branch: string = 'main'
  ): Promise<string> {
    try {
      const encodedContent = btoa(unescape(encodeURIComponent(content)));

      const requestBody: any = {
        message,
        content: encodedContent,
        branch,
      };

      if (sha && sha.trim() !== '') {
        requestBody.sha = sha;
      }

      const data: GitHubCommitResponse = await this.request(`contents/${path}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      });

      this.invalidateFile(path, branch);
      return data.content.sha;
    } catch (error) {
      throw new Error(`Failed to commit file: ${error}`, { cause: error });
    }
  }

  async updateFileBase64(
    path: string,
    base64Content: string,
    sha: string,
    message: string,
    branch: string = 'main'
  ): Promise<{ sha: string; download_url?: string }> {
    try {
      const requestBody: any = {
        message,
        content: base64Content,
        branch,
      };
      if (sha && sha.trim() !== '') requestBody.sha = sha;
      const data: GitHubCommitResponse = await this.request(`contents/${path}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      });
      this.invalidateFile(path, branch);
      return { sha: data.content.sha, download_url: (data.content as any)?.download_url };
    } catch (error) {
      throw new Error(`Failed to commit binary file: ${error}`, { cause: error });
    }
  }

  async createBranch(newBranch: string, fromBranch: string = 'main'): Promise<void> {
    try {
      const { data: ref } = await this.request(`git/ref/heads/${fromBranch}`);
      const sha = ref.object.sha;

      await this.request(`git/refs`, {
        method: 'POST',
        body: JSON.stringify({
          ref: `refs/heads/${newBranch}`,
          sha,
        }),
      });
    } catch (error) {
      throw new Error(`Failed to create branch: ${error}`, { cause: error });
    }
  }

  async listBranches(): Promise<string[]> {
    try {
      const branches = await this.request(`branches`);
      return branches.map((branch: { name: string }) => branch.name);
    } catch (error) {
      throw new Error(`Failed to list branches: ${error}`, { cause: error });
    }
  }

  async listDirectory(path: string = '', branch: string = 'main'): Promise<GitHubDirectoryItem[]> {
    try {
      const data = await this.request(`contents/${path}?ref=${branch}`);

      if (Array.isArray(data)) {
        return data.map((item: any) => ({
          name: item.name,
          path: item.path,
          type: item.type === 'dir' ? 'dir' : 'file',
          size: item.size,
          sha: item.sha,
        }));
      }

      return [
        {
          name: data.name,
          path: data.path,
          type: 'file',
          size: data.size,
          sha: data.sha,
        },
      ];
    } catch (error) {
      throw new Error(`Failed to list directory: ${error}`, { cause: error });
    }
  }
}
