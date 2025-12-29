export class VersionService {
  // In a real application, this would be injected at build time
  // For now, we'll hardcode it but make it easy to update
  static getCurrentVersion(): string {
    // Build timestamp injected by Vite define in vite.config.ts
    // Example: 2025-08-19 22:43 UTC
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    declare const __BUILD_TIME__: string
    try {
      // @ts-ignore - defined at build time
      return __BUILD_TIME__ || 'dev'
    } catch {
      return 'dev'
    }
  }
  
  static async getLatestRelease(owner: string, repo: string) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`
    
    const response = await fetch(apiUrl)
    if (!response.ok) {
      if (response.status === 404) {
        // No releases found, try to get repository info instead
        return await this.getRepositoryInfo(owner, repo)
      }
      throw new Error(`GitHub API error: ${response.status}`)
    }
    
    return await response.json()
  }
  
  static async getRepositoryInfo(owner: string, repo: string) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`
    
    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }
    
    const repoData = await response.json()
    
    // Return a release-like object for consistency
    return {
      tag_name: 'main',
      name: 'Latest Development Version',
      body: 'No formal releases available. This is the latest development version from the main branch.',
      published_at: repoData.updated_at || repoData.created_at,
      html_url: repoData.html_url,
      isDevelopment: true
    }
  }
  
  static compareVersions(current: string, latest: string): 'outdated' | 'latest' | 'newer' {
    // Remove 'v' prefix if present
    const cleanCurrent = current.replace(/^v/, '')
    const cleanLatest = latest.replace(/^v/, '')
    
    if (cleanCurrent === cleanLatest) {
      return 'latest'
    }
    
    const currentParts = cleanCurrent.split('.').map(Number)
    const latestParts = cleanLatest.split('.').map(Number)
    
    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
      const currentPart = currentParts[i] || 0
      const latestPart = latestParts[i] || 0
      
      if (currentPart < latestPart) {
        return 'outdated'
      }
      if (currentPart > latestPart) {
        return 'newer'
      }
    }
    
    return 'latest'
  }
  
  static formatReleaseNotes(notes: string, maxLines: number = 10): string[] {
    if (!notes) return ['No release notes available']
    
    const lines = notes.split('\n')
    const relevantLines = lines
      .filter(line => line.trim()) // Remove empty lines
      .slice(0, maxLines)
    
    return relevantLines.length > 0 ? relevantLines : ['No release notes available']
  }
}
