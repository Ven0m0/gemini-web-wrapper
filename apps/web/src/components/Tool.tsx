import React, { useState, useRef } from 'react'
import { useStore } from '../store'
import { GitHubService } from '../services/github'

type ToolMode = 'github' | 'websocket'

export const Tool: React.FC = () => {
  const [toolMode, setToolMode] = useState<ToolMode>('github')
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [uploadPath, setUploadPath] = useState('')
  const [downloadPath, setDownloadPath] = useState('')
  const [wsUploadFilename, setWsUploadFilename] = useState('')
  const [wsDownloadFilename, setWsDownloadFilename] = useState('')
  const [log, setLog] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const {
    setMode,
    config,
    websocket
  } = useStore()

  const addLog = (message: string) => {
    setLog(prev => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // GitHub Upload
  const handleGithubUpload = async () => {
    if (!uploadPath.trim()) {
      addLog('❌ Please enter upload path')
      return
    }

    if (!config.githubToken || !config.owner || !config.repo) {
      addLog('❌ GitHub configuration missing')
      return
    }

    if (!fileInputRef.current?.files?.length) {
      addLog('❌ Please select a file')
      return
    }

    const selectedFile = fileInputRef.current.files[0]
    setUploading(true)
    
    try {
      addLog(`📤 Uploading ${selectedFile.name} (${formatFileSize(selectedFile.size)})`)
      
      // Check if it's a text file or binary
      const isTextFile = selectedFile.type.startsWith('text/') || 
                        selectedFile.name.endsWith('.md') ||
                        selectedFile.name.endsWith('.json') ||
                        selectedFile.name.endsWith('.js') ||
                        selectedFile.name.endsWith('.ts') ||
                        selectedFile.name.endsWith('.tsx') ||
                        selectedFile.name.endsWith('.jsx') ||
                        selectedFile.name.endsWith('.css') ||
                        selectedFile.name.endsWith('.html') ||
                        selectedFile.name.endsWith('.txt')

      let content: string
      
      if (isTextFile) {
        content = await selectedFile.text()
        addLog('📄 Processing as text file')
      } else {
        const arrayBuffer = await selectedFile.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        content = btoa(String.fromCharCode(...uint8Array))
        addLog('🔧 Processing as binary file (base64)')
      }
      
      const github = new GitHubService(config.githubToken, config.owner, config.repo)
      
      // Check if file exists
      let existingSha = ''
      try {
        const existing = await github.getFile(uploadPath, config.branch)
        existingSha = existing.sha
        addLog(`🔄 File exists, updating (${existingSha.substring(0, 7)})`)
      } catch (error) {
        addLog('✨ Creating new file')
      }
      
      const newSha = await github.updateFile(
        uploadPath,
        content,
        existingSha,
        `Upload ${selectedFile.name} via Tool UI`,
        config.branch
      )
      
      addLog(`✅ Upload successful!`)
      addLog(`📁 Path: ${uploadPath}`)
      addLog(`🔗 SHA: ${newSha.substring(0, 7)}`)
      
      // Clear form
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setUploadPath('')
      
    } catch (error) {
      addLog(`❌ Upload failed: ${error instanceof Error ? error.message : error}`)
    } finally {
      setUploading(false)
    }
  }

  // GitHub Download
  const handleGithubDownload = async () => {
    if (!downloadPath.trim()) {
      addLog('❌ Please enter download path')
      return
    }

    if (!config.githubToken || !config.owner || !config.repo) {
      addLog('❌ GitHub configuration missing')
      return
    }

    setDownloading(true)
    
    try {
      addLog(`📥 Downloading ${downloadPath}`)
      
      const github = new GitHubService(config.githubToken, config.owner, config.repo)
      const { content, sha } = await github.getFile(downloadPath, config.branch)
      
      // Determine if it's a text file
      const isTextFile = downloadPath.endsWith('.md') ||
                        downloadPath.endsWith('.txt') ||
                        downloadPath.endsWith('.json') ||
                        downloadPath.endsWith('.js') ||
                        downloadPath.endsWith('.ts') ||
                        downloadPath.endsWith('.tsx') ||
                        downloadPath.endsWith('.jsx') ||
                        downloadPath.endsWith('.css') ||
                        downloadPath.endsWith('.html') ||
                        downloadPath.endsWith('.py') ||
                        downloadPath.endsWith('.java')

      let blob: Blob
      
      if (isTextFile) {
        blob = new Blob([content], { type: 'text/plain' })
        addLog('📄 Processing as text file')
      } else {
        try {
          const binaryString = atob(content)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          blob = new Blob([bytes], { type: 'application/octet-stream' })
          addLog('🔧 Processing as binary file')
        } catch (error) {
          blob = new Blob([content], { type: 'text/plain' })
          addLog('📄 Fallback to text processing')
        }
      }
      
      // Create download
      const url = URL.createObjectURL(blob)
      const downloadLink = document.createElement('a')
      downloadLink.href = url
      downloadLink.download = downloadPath.split('/').pop() || 'download'
      downloadLink.style.display = 'none'
      
      document.body.appendChild(downloadLink)
      downloadLink.click()
      
      setTimeout(() => {
        document.body.removeChild(downloadLink)
        URL.revokeObjectURL(url)
      }, 100)
      
      addLog(`✅ Download complete: ${downloadLink.download}`)
      addLog(`💾 Size: ${formatFileSize(blob.size)}`)
      addLog(`🔗 SHA: ${sha.substring(0, 7)}`)
      addLog(`📁 Check Downloads folder`)
      
      setDownloadPath('')
      
    } catch (error) {
      addLog(`❌ Download failed: ${error instanceof Error ? error.message : error}`)
    } finally {
      setDownloading(false)
    }
  }

  // WebSocket Upload (placeholder - would need WebSocket service integration)
  const handleWebSocketUpload = async () => {
    if (!wsUploadFilename.trim()) {
      addLog('❌ Please enter filename')
      return
    }

    if (!websocket.connected) {
      addLog('❌ Not connected to WebSocket server')
      return
    }

    if (!fileInputRef.current?.files?.length) {
      addLog('❌ Please select a file')
      return
    }

    const selectedFile = fileInputRef.current.files[0]
    setUploading(true)
    
    try {
      addLog(`📤 Uploading ${selectedFile.name} via WebSocket`)
      
      // This would integrate with existing WebSocket file upload logic
      addLog('🔄 WebSocket upload functionality coming soon')
      
    } catch (error) {
      addLog(`❌ Upload failed: ${error instanceof Error ? error.message : error}`)
    } finally {
      setUploading(false)
    }
  }

  // WebSocket Download (placeholder)
  const handleWebSocketDownload = () => {
    if (!wsDownloadFilename.trim()) {
      addLog('❌ Please enter filename')
      return
    }

    if (!websocket.connected) {
      addLog('❌ Not connected to WebSocket server')
      return
    }

    addLog(`📥 Requesting ${wsDownloadFilename} via WebSocket`)
    addLog('🔄 WebSocket download functionality coming soon')
  }

  return (
    <div className="tool-container">
      {/* Header */}
      <div className="tool-header">
        <h2>🔧 File Transfer Tools</h2>
        <div className="tool-mode-switch">
          <button 
            className={toolMode === 'github' ? 'active' : ''}
            onClick={() => setToolMode('github')}
            data-testid="tool-github-btn"
          >
            GitHub
          </button>
          <button 
            className={toolMode === 'websocket' ? 'active' : ''}
            onClick={() => setToolMode('websocket')}
            data-testid="tool-websocket-btn"
          >
            WebSocket
          </button>
        </div>
        <button 
          onClick={() => setMode('cli')}
          className="back-btn"
        >
          ← CLI
        </button>
      </div>

      {/* GitHub Mode */}
      {toolMode === 'github' && (
        <div className="tool-section">
          <h3>📁 GitHub File Operations</h3>
          
          {/* Upload Section */}
          <div className="upload-section">
            <h4>📤 Upload File</h4>
            <div className="form-group">
              <label>Select File:</label>
              <input 
                ref={fileInputRef}
                type="file" 
                className="file-input"
                disabled={uploading}
              />
            </div>
            <div className="form-group">
              <label>GitHub Path:</label>
              <input 
                type="text" 
                value={uploadPath}
                onChange={(e) => setUploadPath(e.target.value)}
                placeholder="assets/image.png"
                className="text-input"
                disabled={uploading}
              />
            </div>
            <button 
              onClick={handleGithubUpload}
              disabled={uploading}
              className="upload-btn"
            >
              {uploading ? '⏳ Uploading...' : '📤 Upload to GitHub'}
            </button>
          </div>

          {/* Download Section */}
          <div className="download-section">
            <h4>📥 Download File</h4>
            <div className="form-group">
              <label>GitHub Path:</label>
              <input 
                type="text" 
                value={downloadPath}
                onChange={(e) => setDownloadPath(e.target.value)}
                placeholder="src/App.tsx"
                className="text-input"
                disabled={downloading}
              />
            </div>
            <button 
              onClick={handleGithubDownload}
              disabled={downloading}
              className="download-btn"
            >
              {downloading ? '⏳ Downloading...' : '📥 Download from GitHub'}
            </button>
          </div>
        </div>
      )}

      {/* WebSocket Mode */}
      {toolMode === 'websocket' && (
        <div className="tool-section">
          <h3>🔌 WebSocket File Transfer</h3>
          <div className="ws-status">
            Status: <span className={websocket.connected ? 'connected' : 'disconnected'}>
              {websocket.connected ? '✅ Connected' : '❌ Disconnected'}
            </span>
            {websocket.url && <span className="ws-url">({websocket.url})</span>}
          </div>
          
          {/* Upload Section */}
          <div className="upload-section">
            <h4>📤 Upload File</h4>
            <div className="form-group">
              <label>Select File:</label>
              <input 
                ref={fileInputRef}
                type="file" 
                className="file-input"
                disabled={uploading || !websocket.connected}
              />
            </div>
            <div className="form-group">
              <label>Filename:</label>
              <input 
                type="text" 
                value={wsUploadFilename}
                onChange={(e) => setWsUploadFilename(e.target.value)}
                placeholder="document.pdf"
                className="text-input"
                disabled={uploading || !websocket.connected}
              />
            </div>
            <button 
              onClick={handleWebSocketUpload}
              disabled={uploading || !websocket.connected}
              className="upload-btn"
            >
              {uploading ? '⏳ Uploading...' : '📤 Upload via WebSocket'}
            </button>
          </div>

          {/* Download Section */}
          <div className="download-section">
            <h4>📥 Download File</h4>
            <div className="form-group">
              <label>Filename:</label>
              <input 
                type="text" 
                value={wsDownloadFilename}
                onChange={(e) => setWsDownloadFilename(e.target.value)}
                placeholder="data.json"
                className="text-input"
                disabled={downloading || !websocket.connected}
              />
            </div>
            <button 
              onClick={handleWebSocketDownload}
              disabled={downloading || !websocket.connected}
              className="download-btn"
            >
              {downloading ? '⏳ Downloading...' : '📥 Download via WebSocket'}
            </button>
          </div>
        </div>
      )}

      {/* Activity Log */}
      <div className="tool-log">
        <h4>📋 Activity Log</h4>
        <div className="log-content">
          {log.length === 0 ? (
            <div className="log-empty">No activity yet</div>
          ) : (
            log.map((entry, index) => (
              <div key={index} className="log-entry">{entry}</div>
            ))
          )}
        </div>
        <button 
          onClick={() => setLog([])}
          className="clear-log-btn"
        >
          Clear Log
        </button>
      </div>
    </div>
  )
}