interface GitHubFileResponse {
  content: string
  sha: string
}

interface GitHubCommitResponse {
  content: {
    sha: string
    path?: string
    download_url?: string
  }
}

interface GitHubDirectoryItem {
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
  sha: string
}

export class GitHubService {
  private token: string
  private owner: string
  private repo: string

  constructor(token: string, owner: string, repo: string) {
    this.token = token
    this.owner = owner
    this.repo = repo
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async getFile(path: string, branch: string = 'main'): Promise<{ content: string; sha: string }> {
    try {
      const data: GitHubFileResponse = await this.request(`contents/${path}?ref=${branch}`)
      const content = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))))
      return { content, sha: data.sha }
    } catch (error) {
      throw new Error(`Failed to fetch file: ${error}`)
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
      const encodedContent = btoa(unescape(encodeURIComponent(content)))
      
      const requestBody: any = {
        message,
        content: encodedContent,
        branch,
      }
      
      // Only include SHA if it exists (for updating existing files)
      if (sha && sha.trim() !== '') {
        requestBody.sha = sha
      }
      
      const data: GitHubCommitResponse = await this.request(`contents/${path}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      })

      return data.content.sha
    } catch (error) {
      throw new Error(`Failed to commit file: ${error}`)
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
      }
      if (sha && sha.trim() !== '') requestBody.sha = sha
      const data: GitHubCommitResponse = await this.request(`contents/${path}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      })
      return { sha: data.content.sha, download_url: (data.content as any)?.download_url }
    } catch (error) {
      throw new Error(`Failed to commit binary file: ${error}`)
    }
  }


  async createBranch(newBranch: string, fromBranch: string = 'main'): Promise<void> {
    try {
      const { data: ref } = await this.request(`git/ref/heads/${fromBranch}`)
      const sha = ref.object.sha

      await this.request(`git/refs`, {
        method: 'POST',
        body: JSON.stringify({
          ref: `refs/heads/${newBranch}`,
          sha,
        }),
      })
    } catch (error) {
      throw new Error(`Failed to create branch: ${error}`)
    }
  }

  async listBranches(): Promise<string[]> {
    try {
      const branches = await this.request(`branches`)
      return branches.map((branch: { name: string }) => branch.name)
    } catch (error) {
      throw new Error(`Failed to list branches: ${error}`)
    }
  }

  async listDirectory(path: string = '', branch: string = 'main'): Promise<GitHubDirectoryItem[]> {
    try {
      const data = await this.request(`contents/${path}?ref=${branch}`)
      
      // GitHub API returns array for directories, single object for files
      if (Array.isArray(data)) {
        return data.map((item: any) => ({
          name: item.name,
          path: item.path,
          type: item.type === 'dir' ? 'dir' : 'file',
          size: item.size,
          sha: item.sha
        }))
      } else {
        // Single file
        return [{
          name: data.name,
          path: data.path,
          type: 'file',
          size: data.size,
          sha: data.sha
        }]
      }
    } catch (error) {
      throw new Error(`Failed to list directory: ${error}`)
    }
  }
}
