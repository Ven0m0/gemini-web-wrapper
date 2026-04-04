import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { GitHubService, type GitHubDirectoryItem } from '../services/github'
import {
  WebSocketService,
  getActiveWebSocketService,
  setActiveWebSocketService,
} from '../services/websocket'
import {
  applyLineRangeEdit,
  isJsonPath,
  readAnnotatedContent,
  repairJsonContent,
  searchAnnotatedContent,
} from '../services/fileTools'

type ToolMode = 'github' | 'websocket'

interface LoadedGitHubFile {
  path: string
  sha: string
  original: string
  current: string
}

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
  const [directoryPath, setDirectoryPath] = useState('')
  const [directoryItems, setDirectoryItems] = useState<GitHubDirectoryItem[]>([])
  const [inspectPath, setInspectPath] = useState('')
  const [loadedFile, setLoadedFile] = useState<LoadedGitHubFile | null>(null)
  const [searchPattern, setSearchPattern] = useState('')
  const [searchContext, setSearchContext] = useState('2')
  const [searchResults, setSearchResults] = useState('')
  const [editStartLine, setEditStartLine] = useState('')
  const [editEndLine, setEditEndLine] = useState('')
  const [editCode, setEditCode] = useState('')
  const [saving, setSaving] = useState(false)
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

  const [pendingDownload, setPendingDownload] = useState<string | null>(null)
  const githubService = useMemo(
    () => (config.githubToken && config.owner && config.repo
      ? new GitHubService(config.githubToken, config.owner, config.repo)
      : null),
    [config.githubToken, config.owner, config.repo],
  )

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

  useEffect(() => {
    if (!pendingDownload) return
    const latest = websocket.messages[websocket.messages.length - 1]
    if (!latest || latest.type !== 'file_data' || latest.filename !== pendingDownload) return

    try {
      const binaryString = latest.isBase64 ? atob(latest.data) : latest.data
      const bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0))
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
      addLog(`Downloaded: ${latest.filename} (${formatFileSize(blob.size)})`)
    } catch (err) {
      addLog(`Failed to save file: ${err instanceof Error ? err.message : err}`)
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

  const getGitHubService = (): GitHubService | null => {
    if (!githubService) {
      addLog('GitHub configuration missing')
      return null
    }
    return githubService
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

  const handleListDirectory = async (path = directoryPath) => {
    const github = getGitHubService()
    if (!github) return

    try {
      const items = await github.listDirectory(path.trim(), config.branch)
      setDirectoryItems(items)
      setDirectoryPath(path.trim())
      addLog(`Listed ${path.trim() || '/'} (${items.length} item${items.length === 1 ? '' : 's'})`)
    } catch (error) {
      addLog(`List failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  const handleLoadFile = async (path = inspectPath) => {
    const targetPath = path.trim()
    if (!targetPath) {
      addLog('Please enter a file path')
      return
    }

    const github = getGitHubService()
    if (!github) return

    try {
      const { content, sha } = await github.getFile(targetPath, config.branch)
      setInspectPath(targetPath)
      setLoadedFile({ path: targetPath, sha, original: content, current: content })
      setSearchResults('')
      addLog(`Loaded ${targetPath} (${content.split('\n').length} lines)`)
    } catch (error) {
      addLog(`Load failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  const handleSearchLoadedFile = () => {
    if (!loadedFile) {
      addLog('Load a file first')
      return
    }

    if (!searchPattern.trim()) {
      addLog('Enter a search pattern')
      return
    }

    try {
      const results = searchAnnotatedContent(
        loadedFile.current,
        searchPattern,
        Number.parseInt(searchContext, 10) || 2,
      )
      setSearchResults(results)
      addLog(results.startsWith('No matches') ? results : `Searched ${loadedFile.path}`)
    } catch (error) {
      addLog(`Search failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  const handleApplyEdit = () => {
    if (!loadedFile) {
      addLog('Load a file first')
      return
    }

    const startLine = Number.parseInt(editStartLine, 10)
    const endLine = Number.parseInt(editEndLine || editStartLine, 10)

    if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) {
      addLog('Enter valid line numbers')
      return
    }

    try {
      const current = applyLineRangeEdit(loadedFile.current, startLine, endLine, editCode)
      setLoadedFile({ ...loadedFile, current })
      addLog(`Applied edit to ${loadedFile.path} (${startLine}-${endLine})`)
    } catch (error) {
      addLog(`Edit failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  const handleRepairJson = () => {
    if (!loadedFile) {
      addLog('Load a file first')
      return
    }

    if (!isJsonPath(loadedFile.path)) {
      addLog('JSON repair is available for .json files')
      return
    }

    try {
      const repaired = repairJsonContent(loadedFile.current)
      setLoadedFile({ ...loadedFile, current: repaired.content })
      addLog(repaired.warnings[0] || `Repaired JSON in ${loadedFile.path}`)
    } catch (error) {
      addLog(`JSON repair failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  const handleSaveLoadedFile = async () => {
    if (!loadedFile) {
      addLog('Load a file first')
      return
    }

    const github = getGitHubService()
    if (!github) return

    setSaving(true)
    try {
      const sha = await github.updateFile(
        loadedFile.path,
        loadedFile.current,
        loadedFile.sha,
        `Update ${loadedFile.path} via Files tool`,
        config.branch,
      )
      setLoadedFile({ ...loadedFile, sha, original: loadedFile.current })
      addLog(`Saved ${loadedFile.path}`)
    } catch (error) {
      addLog(`Save failed: ${error instanceof Error ? error.message : error}`)
    } finally {
      setSaving(false)
    }
  }

  const handleGithubUpload = async () => {
    if (!uploadPath.trim()) {
      addLog('Please enter upload path')
      return
    }

    const github = getGitHubService()
    if (!github) return

    if (!fileInputRef.current?.files?.length) {
      addLog('Please select a file')
      return
    }

    const selectedFile = fileInputRef.current.files[0]
    setUploading(true)

    try {
      addLog(`Uploading ${selectedFile.name} (${formatFileSize(selectedFile.size)})`)

      const isTextFile = isTextPath(selectedFile.name, selectedFile.type)

      let existingSha = ''
      try {
        // Bypass the read cache here so we use the latest SHA before attempting the write.
        const existing = await github.getFile(uploadPath, config.branch, true)
        existingSha = existing.sha
      } catch {
        addLog('Creating new file')
      }

      const newSha = isTextFile
        ? await github.updateFile(
            uploadPath,
            await selectedFile.text(),
            existingSha,
            `Upload ${selectedFile.name} via Files tool`,
            config.branch,
          )
        : (
            await github.updateFileBase64(
              uploadPath,
              await readFileAsBase64(selectedFile),
              existingSha,
              `Upload ${selectedFile.name} via Files tool`,
              config.branch,
            )
          ).sha

      addLog(`Upload successful (${newSha.substring(0, 7)})`)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setUploadPath('')
    } catch (error) {
      addLog(`Upload failed: ${error instanceof Error ? error.message : error}`)
    } finally {
      setUploading(false)
    }
  }

  const handleGithubDownload = async () => {
    if (!downloadPath.trim()) {
      addLog('Please enter download path')
      return
    }

    const github = getGitHubService()
    if (!github) return

    setDownloading(true)

    try {
      addLog(`Downloading ${downloadPath}`)

      const { content, sha } = await github.getFile(downloadPath, config.branch)

      const isTextFile = isTextPath(downloadPath)

      let blob: Blob
      if (isTextFile) {
        blob = new Blob([content], { type: 'text/plain' })
      } else {
        try {
          const binaryString = atob(content)
          const bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0))
          blob = new Blob([bytes], { type: 'application/octet-stream' })
        } catch {
          blob = new Blob([content], { type: 'text/plain' })
        }
      }

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

      addLog(`Download complete: ${downloadLink.download} (${sha.substring(0, 7)})`)
      setDownloadPath('')
    } catch (error) {
      addLog(`Download failed: ${error instanceof Error ? error.message : error}`)
    } finally {
      setDownloading(false)
    }
  }

  const handleWebSocketConnect = async () => {
    const url = wsUrlInput.trim()
    if (!url) {
      addLog('Please enter a WebSocket URL')
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
      addLog(`Connected to ${url}`)
    } catch (error) {
      wsServiceRef.current = null
      setActiveWebSocketService(null)
      setWebSocket({
        url,
        status: 'error',
        connected: false,
      })
      addLog(`WebSocket connection failed: ${error instanceof Error ? error.message : error}`)
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
    addLog('Disconnected from WebSocket server')
  }

  const handleWebSocketUpload = async () => {
    if (!wsUploadFilename.trim()) {
      addLog('Please enter filename')
      return
    }

    if (!websocket.connected) {
      addLog('Not connected to WebSocket server')
      return
    }

    if (!fileInputRef.current?.files?.length) {
      addLog('Please select a file')
      return
    }

    const svc = getActiveWebSocketService()
    if (!svc) {
      addLog('WebSocket service not initialised')
      return
    }

    const selectedFile = fileInputRef.current.files[0]
    setUploading(true)

    try {
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

      addLog(`Sent ${targetFilename} via WebSocket`)
      setWsUploadFilename('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (error) {
      addLog(`Upload failed: ${error instanceof Error ? error.message : error}`)
    } finally {
      setUploading(false)
    }
  }

  const handleWebSocketDownload = () => {
    if (!wsDownloadFilename.trim()) {
      addLog('Please enter filename')
      return
    }

    if (!websocket.connected) {
      addLog('Not connected to WebSocket server')
      return
    }

    const svc = getActiveWebSocketService()
    if (!svc) {
      addLog('WebSocket service not initialised')
      return
    }

    const targetFilename = wsDownloadFilename.trim()

    try {
      setDownloading(true)
      setPendingDownload(targetFilename)
      addLog(`Requesting ${targetFilename} via WebSocket`)
      svc.requestFileDownload(targetFilename)
      addWebSocketMessage({
        type: 'file_download',
        data: targetFilename,
        filename: targetFilename,
        timestamp: Date.now(),
      })
      setWsDownloadFilename('')
    } catch (error) {
      addLog(`Download request failed: ${error instanceof Error ? error.message : error}`)
      setDownloading(false)
      setPendingDownload(null)
    }
  }

  const annotatedContent = loadedFile ? readAnnotatedContent(loadedFile.current) : ''
  const hasUnsavedChanges = loadedFile ? loadedFile.original !== loadedFile.current : false

  return (
    <div className="tool-container">
      <div className="tool-header">
        <h2>File Tools</h2>
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
        <button onClick={() => setMode('cli')} className="back-btn">
          ← CLI
        </button>
      </div>

      {toolMode === 'github' && (
        <div className="tool-section" style={{ display: 'grid', gap: 16 }}>
          <h3>GitHub file workflow</h3>

          <div className="download-section">
            <h4>Browse repository</h4>
            <div className="form-group">
              <label>Directory path:</label>
              <input
                type="text"
                value={directoryPath}
                onChange={(e) => setDirectoryPath(e.target.value)}
                placeholder="src"
                className="text-input"
              />
            </div>
            <button onClick={() => handleListDirectory()} className="download-btn">
              List directory
            </button>
            {directoryItems.length > 0 && (
              <div className="log-content" style={{ maxHeight: 180 }}>
                {directoryItems.map((item) => (
                  <div key={item.path} className="log-entry" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>{item.type === 'dir' ? '📁' : '📄'} {item.path}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {item.type === 'dir' ? (
                        <button onClick={() => handleListDirectory(item.path)}>Open</button>
                      ) : (
                        <button onClick={() => handleLoadFile(item.path)}>Load</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="upload-section">
            <h4>Inspect and edit file</h4>
            <div className="form-group">
              <label>File path:</label>
              <input
                type="text"
                value={inspectPath}
                onChange={(e) => setInspectPath(e.target.value)}
                placeholder="src/App.tsx"
                className="text-input"
              />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => handleLoadFile()} className="download-btn">Load file</button>
              <button
                onClick={handleRepairJson}
                className="download-btn"
                disabled={!loadedFile || !isJsonPath(loadedFile.path)}
              >
                Repair JSON
              </button>
              <button
                onClick={() => loadedFile && setLoadedFile({ ...loadedFile, current: loadedFile.original })}
                className="download-btn"
                disabled={!loadedFile || !hasUnsavedChanges}
              >
                Revert buffer
              </button>
              <button
                onClick={handleSaveLoadedFile}
                className="upload-btn"
                disabled={!loadedFile || !hasUnsavedChanges || saving}
              >
                {saving ? 'Saving...' : 'Save to GitHub'}
              </button>
            </div>
            {loadedFile && (
              <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                <div style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12, color: 'var(--color-text-subtle)' }}>
                  {loadedFile.path} · {loadedFile.current.split('\n').length} lines · {hasUnsavedChanges ? 'unsaved changes' : 'saved'}
                </div>

                <div className="form-group">
                  <label>Search pattern:</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={searchPattern}
                      onChange={(e) => setSearchPattern(e.target.value)}
                      placeholder="TODO or /TODO/i"
                      className="text-input"
                    />
                    <input
                      type="number"
                      value={searchContext}
                      onChange={(e) => setSearchContext(e.target.value)}
                      placeholder="2"
                      className="text-input"
                      style={{ width: 96 }}
                    />
                    <button onClick={handleSearchLoadedFile} className="download-btn">Search</button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Line-range edit:</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <input
                      type="number"
                      value={editStartLine}
                      onChange={(e) => setEditStartLine(e.target.value)}
                      placeholder="start"
                      className="text-input"
                      style={{ width: 120 }}
                    />
                    <input
                      type="number"
                      value={editEndLine}
                      onChange={(e) => setEditEndLine(e.target.value)}
                      placeholder="end"
                      className="text-input"
                      style={{ width: 120 }}
                    />
                    <button onClick={handleApplyEdit} className="upload-btn">Apply edit</button>
                  </div>
                  <textarea
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    placeholder="Replacement text. Use start=end+1 to insert before a line, or leave blank to delete."
                    className="text-input"
                    style={{ minHeight: 100, width: '100%' }}
                  />
                </div>

                <div className="form-group">
                  <label>Editable buffer:</label>
                  <textarea
                    value={loadedFile.current}
                    onChange={(e) => setLoadedFile({ ...loadedFile, current: e.target.value })}
                    className="text-input"
                    style={{ minHeight: 180, width: '100%', fontFamily: 'var(--font-family-mono)' }}
                  />
                </div>

                <div className="form-group">
                  <label>Annotated read view:</label>
                  <pre className="log-content" style={{ maxHeight: 240, margin: 0 }}>{annotatedContent || 'Empty file'}</pre>
                </div>

                <div className="form-group">
                  <label>Search results:</label>
                  <pre className="log-content" style={{ maxHeight: 180, margin: 0 }}>{searchResults || 'No search run yet'}</pre>
                </div>
              </div>
            )}
          </div>

          <div className="upload-section">
            <h4>Upload file</h4>
            <div className="form-group">
              <label>Select File:</label>
              <input ref={fileInputRef} type="file" className="file-input" disabled={uploading} />
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
            <button onClick={handleGithubUpload} disabled={uploading} className="upload-btn">
              {uploading ? 'Uploading...' : 'Upload to GitHub'}
            </button>
          </div>

          <div className="download-section">
            <h4>Download file</h4>
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
            <button onClick={handleGithubDownload} disabled={downloading} className="download-btn">
              {downloading ? 'Downloading...' : 'Download from GitHub'}
            </button>
          </div>
        </div>
      )}

      {toolMode === 'websocket' && (
        <div className="tool-section">
          <h3>WebSocket File Transfer</h3>
          <div className="ws-status">
            Status: <span className={websocket.connected ? 'connected' : 'disconnected'}>
              {websocket.connected ? 'Connected' : 'Disconnected'}
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
            <button onClick={handleWebSocketConnect} disabled={websocket.status === 'connecting' || websocket.connected}>
              {websocket.status === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>
            <button onClick={handleWebSocketDisconnect} disabled={!websocket.connected}>
              Disconnect
            </button>
          </div>

          <div className="upload-section">
            <h4>Upload File</h4>
            <div className="form-group">
              <label>Select File:</label>
              <input ref={fileInputRef} type="file" className="file-input" disabled={uploading || !websocket.connected} />
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
            <button onClick={handleWebSocketUpload} disabled={uploading || !websocket.connected} className="upload-btn">
              {uploading ? 'Uploading...' : 'Upload via WebSocket'}
            </button>
          </div>

          <div className="download-section">
            <h4>Download File</h4>
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
            <button onClick={handleWebSocketDownload} disabled={downloading || !websocket.connected} className="download-btn">
              {downloading ? 'Downloading...' : 'Download via WebSocket'}
            </button>
          </div>
        </div>
      )}

      <div className="tool-log">
        <h4>Activity Log</h4>
        <div className="log-content">
          {log.length === 0 ? (
            <div className="log-empty">No activity yet</div>
          ) : (
            log.map((entry, index) => (
              <div key={index} className="log-entry">{entry}</div>
            ))
          )}
        </div>
        <button onClick={() => setLog([])} className="clear-log-btn">
          Clear Log
        </button>
      </div>
    </div>
  )
}
