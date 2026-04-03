import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { GitHubService } from '../services/github'
import {
  WebSocketService,
  getActiveWebSocketService,
  setActiveWebSocketService,
} from '../services/websocket'

type ToolMode = 'github' | 'websocket'

export const Tool: React.FC = () => {
  const [toolMode, setToolMode] = useState<ToolMode>('github')
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [uploadPath, setUploadPath] = useState('')
  const [downloadPath, setDownloadPath] = useState('')
  const [wsUploadFilename, setWsUploadFilename] = useState('')
  const [wsDownloadFilename, setWsDownloadFilename] = useState('')
  const [wsUrlInput, setWsUrlInput] = useState('')
  const [log, setLog] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const wsServiceRef = useRef<WebSocketService | null>(null)
  
  const {
    setMode,
    config,
    websocket,
    addWebSocketMessage,
    clearWebSocketMessages,
    setWebSocket,
  } = useStore()

  // Track a pending download so the useEffect below can match incoming file_data messages
  const [pendingDownload, setPendingDownload] = useState<string | null>(null)

  useEffect(() => {
    setWsUrlInput(websocket.url)
  }, [websocket.url])

  useEffect(() => {
    return () => {
      wsServiceRef.current?.disconnect()
      wsServiceRef.current = null
      setActiveWebSocketService(null)
    }
  }, [])

  // Consume file_data messages that arrive in response to a download request
  useEffect(() => {
    if (!pendingDownload) return
    const latest = websocket.messages[websocket.messages.length - 1]
    if (!latest || latest.type !== 'file_data' || latest.filename !== pendingDownload) return

    try {
      const binaryString = latest.isBase64 ? atob(latest.data) : latest.data
      const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = latest.filename || pendingDownload
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }, 100)
      addLog(`✅ Downloaded: ${latest.filename} (${formatFileSize(blob.size)})`)
    } catch (err) {
      addLog(`❌ Failed to save file: ${err instanceof Error ? err.message : err}`)
    } finally {
      setPendingDownload(null)
      setDownloading(false)
    }
  }, [websocket.messages, pendingDownload])

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

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('Failed to encode file'))
          return
        }

        const parts = reader.result.split(',', 2)
        resolve(parts[1] || '')
      }
      reader.onerror = () => {
        reject(reader.error ?? new Error('Failed to read file'))
      }
      reader.readAsDataURL(file)
    })

  const handleWebSocketConnect = async () => {
    const url = wsUrlInput.trim()
    if (!url) {
      addLog('❌ Please enter a WebSocket URL')
      return
    }

    wsServiceRef.current?.disconnect()
    clearWebSocketMessages()

    const service = new WebSocketService(
      url,
      (message) => {
        addWebSocketMessage(message)
      },
      (status) => {
        setWebSocket({
          url,
          status,
          connected: status === 'connected',
        })
      },
    )

    wsServiceRef.current = service
    setActiveWebSocketService(service)

    try {
      await service.connect()
      addLog(`✅ Connected to ${url}`)
    } catch (error) {
      wsServiceRef.current = null
      setActiveWebSocketService(null)
      setWebSocket({
        url,
        status: 'error',
        connected: false,
      })
      addLog(`❌ WebSocket connection failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  const handleWebSocketDisconnect = () => {
    wsServiceRef.current?.disconnect()
    wsServiceRef.current = null
    setActiveWebSocketService(null)
    setWebSocket({
      connected: false,
      status: 'disconnected',
    })
    addLog('🔌 Disconnected from WebSocket server')
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
        content = await readFileAsBase64(selectedFile)
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

  // WebSocket Upload – reads the selected file and sends it over the active connection
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

    const svc = getActiveWebSocketService()
    if (!svc) {
      addLog('❌ WebSocket service not initialised')
      return
    }

    const selectedFile = fileInputRef.current.files[0]
    setUploading(true)

    try {
      addLog(`📤 Uploading ${selectedFile.name} (${formatFileSize(selectedFile.size)}) via WebSocket`)

      const base64 = await readFileAsBase64(selectedFile)

      const targetFilename = wsUploadFilename.trim() || selectedFile.name
      svc.sendFileUpload(targetFilename, base64, true)
      addWebSocketMessage({
        type: 'file_upload',
        data: base64,
        filename: targetFilename,
        fileSize: selectedFile.size,
        isBase64: true,
        timestamp: Date.now(),
      })

      addLog(`✅ Sent ${targetFilename} via WebSocket`)
      setWsUploadFilename('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (error) {
      addLog(`❌ Upload failed: ${error instanceof Error ? error.message : error}`)
    } finally {
      setUploading(false)
    }
  }

  // WebSocket Download – requests a file and waits for a file_data response message
  const handleWebSocketDownload = () => {
    if (!wsDownloadFilename.trim()) {
      addLog('❌ Please enter filename')
      return
    }

    if (!websocket.connected) {
      addLog('❌ Not connected to WebSocket server')
      return
    }

    const svc = getActiveWebSocketService()
    if (!svc) {
      addLog('❌ WebSocket service not initialised')
      return
    }

    const targetFilename = wsDownloadFilename.trim()

    try {
      setDownloading(true)
      setPendingDownload(targetFilename)
      addLog(`📥 Requesting ${targetFilename} via WebSocket`)
      svc.requestFileDownload(targetFilename)
      addWebSocketMessage({
        type: 'file_download',
        data: targetFilename,
        filename: targetFilename,
        timestamp: Date.now(),
      })
      setWsDownloadFilename('')
    } catch (error) {
      addLog(`❌ Download request failed: ${error instanceof Error ? error.message : error}`)
      setDownloading(false)
      setPendingDownload(null)
    }
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
          <div className="form-group">
            <label>WebSocket URL:</label>
            <input
              type="text"
              value={wsUrlInput}
              onChange={(e) => setWsUrlInput(e.target.value)}
              placeholder="ws://localhost:8080"
              className="text-input"
              disabled={websocket.status === 'connecting'}
            />
          </div>
          <div className="tool-mode-switch">
            <button
              onClick={handleWebSocketConnect}
              disabled={websocket.status === 'connecting' || websocket.connected}
            >
              {websocket.status === 'connecting' ? '⏳ Connecting...' : 'Connect'}
            </button>
            <button
              onClick={handleWebSocketDisconnect}
              disabled={!websocket.connected}
            >
              Disconnect
            </button>
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
