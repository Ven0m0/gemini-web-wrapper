import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

type TreeNodeType = 'file' | 'dir' | 'root'

const ROOT_PATH = ''

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function joinPath(parent: string, child: string): string {
  return parent ? `${parent}/${child}` : child
}

function getParentPath(path: string): string {
  const segments = path.split('/').filter(Boolean)
  segments.pop()
  return segments.join('/')
}

function getAncestorDirectories(path: string): string[] {
  const segments = path.split('/').filter(Boolean)
  const directories: string[] = [ROOT_PATH]

  for (let index = 0; index < segments.length - 1; index += 1) {
    directories.push(segments.slice(0, index + 1).join('/'))
  }

  return directories
}

function sortTreeItems(items: GitHubDirectoryItem[]): GitHubDirectoryItem[] {
  return [...items].sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'dir' ? -1 : 1
    }
    return left.name.localeCompare(right.name)
  })
}

export const Tool: React.FC = () => {
  const [toolMode, setToolMode] = useState<ToolMode>('github')
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [wsUploadFilename, setWsUploadFilename] = useState('')
  const [wsDownloadFilename, setWsDownloadFilename] = useState('')
  const [wsUrlInput, setWsUrlInput] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [searchPattern, setSearchPattern] = useState('')
  const [searchContext, setSearchContext] = useState('2')
  const [searchResults, setSearchResults] = useState('')
  const [editStartLine, setEditStartLine] = useState('')
  const [editEndLine, setEditEndLine] = useState('')
  const [editCode, setEditCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingDownload, setPendingDownload] = useState<string | null>(null)
  const [directoryEntries, setDirectoryEntries] = useState<Record<string, GitHubDirectoryItem[]>>({})
  const [expandedDirectories, setExpandedDirectories] = useState<string[]>([ROOT_PATH])
  const [loadingDirectories, setLoadingDirectories] = useState<string[]>([])
  const [selectedNodePath, setSelectedNodePath] = useState('')
  const [selectedNodeType, setSelectedNodeType] = useState<TreeNodeType>('root')

  const githubUploadInputRef = useRef<HTMLInputElement>(null)
  const wsFileInputRef = useRef<HTMLInputElement>(null)
  const wsServiceRef = useRef<WebSocketService | null>(null)

  const {
    setMode,
    config,
    setConfig,
    file,
    setFile,
    websocket,
    addWebSocketMessage,
    clearWebSocketMessages,
    setWebSocket,
  } = useStore()

  const githubService = useMemo(
    () => (config.githubToken && config.owner && config.repo
      ? new GitHubService(config.githubToken, config.owner, config.repo)
      : null),
    [config.githubToken, config.owner, config.repo],
  )

  const activeFilePath = config.path.trim()
  const rootItems = directoryEntries[ROOT_PATH] ?? []
  const expandedDirectoriesSet = useMemo(() => new Set(expandedDirectories), [expandedDirectories])
  const loadingDirectoriesSet = useMemo(() => new Set(loadingDirectories), [loadingDirectories])
  const hasGitHubConfig = Boolean(githubService)
  const annotatedContent = activeFilePath ? readAnnotatedContent(file.current) : ''
  const hasUnsavedChanges = Boolean(activeFilePath) && file.original !== file.current

  const currentDirectoryPath = useMemo(() => {
    if (selectedNodeType === 'dir') {
      return selectedNodePath
    }
    if (selectedNodeType === 'file' && selectedNodePath) {
      return getParentPath(selectedNodePath)
    }
    if (activeFilePath) {
      return getParentPath(activeFilePath)
    }
    return ROOT_PATH
  }, [activeFilePath, selectedNodePath, selectedNodeType])

  const addLog = (message: string) => {
    setLog((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const getGitHubService = (): GitHubService | null => {
    if (!githubService) {
      addLog('GitHub configuration missing')
      return null
    }
    return githubService
  }

  const readFileAsBase64 = (selectedFile: File): Promise<string> =>
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
      reader.readAsDataURL(selectedFile)
    })

  const loadDirectory = useCallback(async (path: string = ROOT_PATH, options?: { silent?: boolean }) => {
    const github = githubService
    if (!github) return []

    setLoadingDirectories((prev) => (prev.includes(path) ? prev : [...prev, path]))

    try {
      const items = sortTreeItems(await github.listDirectory(path, config.branch))
      setDirectoryEntries((prev) => ({ ...prev, [path]: items }))
      if (!options?.silent) {
        addLog(`Loaded ${path || '/'} (${items.length} item${items.length === 1 ? '' : 's'})`)
      }
      return items
    } catch (error) {
      addLog(`Tree load failed: ${error instanceof Error ? error.message : error}`)
      return []
    } finally {
      setLoadingDirectories((prev) => prev.filter((entry) => entry !== path))
    }
  }, [config.branch, githubService])

  const ensureTreePathVisible = useCallback(async (path: string) => {
    if (!path || !githubService) return

    const directories = getAncestorDirectories(path)
    for (const directory of directories) {
      if (!directoryEntries[directory]) {
        await loadDirectory(directory, { silent: true })
      }
    }

    setExpandedDirectories((prev) => Array.from(new Set([...prev, ...directories])))
  }, [directoryEntries, githubService, loadDirectory])

  useEffect(() => {
    if (!hasGitHubConfig) {
      setDirectoryEntries({})
      setExpandedDirectories([ROOT_PATH])
      setSelectedNodePath('')
      setSelectedNodeType('root')
      return
    }

    void loadDirectory(ROOT_PATH, { silent: true })
  }, [hasGitHubConfig, loadDirectory])

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
    if (!activeFilePath) return

    setSelectedNodePath(activeFilePath)
    setSelectedNodeType('file')
    void ensureTreePathVisible(activeFilePath)
  }, [activeFilePath, ensureTreePathVisible])

  useEffect(() => {
    if (!pendingDownload) return
    const latest = websocket.messages[websocket.messages.length - 1]
    if (!latest || latest.type !== 'file_data' || latest.filename !== pendingDownload) return

    try {
      const binaryString = latest.isBase64 ? atob(latest.data) : latest.data
      const bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0))
      const blob = new Blob([bytes], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = latest.filename || pendingDownload
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      setTimeout(() => {
        document.body.removeChild(anchor)
        URL.revokeObjectURL(url)
      }, 100)
      addLog(`Downloaded: ${latest.filename} (${formatFileSize(blob.size)})`)
    } catch (error) {
      addLog(`Failed to save file: ${error instanceof Error ? error.message : error}`)
    } finally {
      setPendingDownload(null)
      setDownloading(false)
    }
  }, [pendingDownload, websocket.messages])

  const handleToggleDirectory = async (path: string) => {
    if (expandedDirectoriesSet.has(path)) {
      setExpandedDirectories((prev) => prev.filter((entry) => entry !== path))
      return
    }

    if (!directoryEntries[path]) {
      await loadDirectory(path)
    }

    setExpandedDirectories((prev) => Array.from(new Set([...prev, path])))
  }

  const handleSelectDirectory = async (path: string) => {
    setSelectedNodePath(path)
    setSelectedNodeType('dir')
    if (!directoryEntries[path]) {
      await loadDirectory(path)
    }
  }

  const handleLoadFile = async (path: string) => {
    const targetPath = path.trim()
    if (!targetPath) {
      addLog('Select a file from the tree first')
      return
    }

    const github = getGitHubService()
    if (!github) return

    try {
      const { content, sha } = await github.getFile(targetPath, config.branch)
      setConfig({ path: targetPath })
      setFile({ original: content, current: content, sha, dirty: false })
      setSelectedNodePath(targetPath)
      setSelectedNodeType('file')
      setSearchResults('')
      await ensureTreePathVisible(targetPath)
      addLog(`Opened ${targetPath} (${content.split('\n').length} lines)`)
    } catch (error) {
      addLog(`Load failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  const handleSearchLoadedFile = () => {
    if (!activeFilePath) {
      addLog('Open a file first')
      return
    }

    if (!searchPattern.trim()) {
      addLog('Enter a search pattern')
      return
    }

    try {
      const results = searchAnnotatedContent(
        file.current,
        searchPattern,
        Number.parseInt(searchContext, 10) || 2,
      )
      setSearchResults(results)
      addLog(results.startsWith('No matches') ? results : `Searched ${activeFilePath}`)
    } catch (error) {
      addLog(`Search failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  const handleApplyEdit = () => {
    if (!activeFilePath) {
      addLog('Open a file first')
      return
    }

    const startLine = Number.parseInt(editStartLine, 10)
    const endLine = Number.parseInt(editEndLine || editStartLine, 10)

    if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) {
      addLog('Enter valid line numbers')
      return
    }

    try {
      const current = applyLineRangeEdit(file.current, startLine, endLine, editCode)
      setFile({ current, dirty: current !== file.original })
      addLog(`Applied edit to ${activeFilePath} (${startLine}-${endLine})`)
    } catch (error) {
      addLog(`Edit failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  const handleRepairJson = () => {
    if (!activeFilePath) {
      addLog('Open a file first')
      return
    }

    if (!isJsonPath(activeFilePath)) {
      addLog('JSON repair is available for .json files')
      return
    }

    try {
      const repaired = repairJsonContent(file.current)
      setFile({ current: repaired.content, dirty: repaired.content !== file.original })
      addLog(repaired.warnings[0] || `Repaired JSON in ${activeFilePath}`)
    } catch (error) {
      addLog(`JSON repair failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  const handleSaveLoadedFile = async () => {
    if (!activeFilePath) {
      addLog('Open a file first')
      return
    }

    const github = getGitHubService()
    if (!github) return

    setSaving(true)
    try {
      const sha = await github.updateFile(
        activeFilePath,
        file.current,
        file.sha,
        `Update ${activeFilePath} via Files tool`,
        config.branch,
      )
      setFile({ sha, original: file.current, dirty: false })
      await loadDirectory(currentDirectoryPath, { silent: true })
      addLog(`Saved ${activeFilePath}`)
    } catch (error) {
      addLog(`Save failed: ${error instanceof Error ? error.message : error}`)
    } finally {
      setSaving(false)
    }
  }

  const handleGithubUpload = async (selectedFile: File) => {
    const github = getGitHubService()
    if (!github) return

    const targetPath = joinPath(currentDirectoryPath, selectedFile.name)
    setUploading(true)

    try {
      addLog(`Uploading ${selectedFile.name} → ${targetPath}`)

      let existingSha = ''
      try {
        const existing = await github.getFile(targetPath, config.branch, true)
        existingSha = existing.sha
      } catch {
        addLog('Creating new file')
      }

      const uploadSha = await github.updateFileBase64(
        targetPath,
        await readFileAsBase64(selectedFile),
        existingSha,
        `Upload ${selectedFile.name} via Files tool`,
        config.branch,
      )

      const directoriesToRefresh = Array.from(new Set([ROOT_PATH, currentDirectoryPath, getParentPath(targetPath)]))
      await Promise.all(directoriesToRefresh.map((path) => loadDirectory(path, { silent: true })))
      setSelectedNodePath(targetPath)
      setSelectedNodeType('file')
      addLog(`Upload successful (${uploadSha.sha.substring(0, 7)})`)
    } catch (error) {
      addLog(`Upload failed: ${error instanceof Error ? error.message : error}`)
    } finally {
      setUploading(false)
      if (githubUploadInputRef.current) {
        githubUploadInputRef.current.value = ''
      }
    }
  }

  const handleDownloadCurrentFile = async () => {
    if (!activeFilePath) {
      addLog('Open a file first')
      return
    }

    setDownloading(true)

    try {
      const blob = new Blob([file.current], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = activeFilePath.split('/').pop() || 'download'
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      setTimeout(() => {
        document.body.removeChild(anchor)
        URL.revokeObjectURL(url)
      }, 100)
      addLog(`Downloaded ${anchor.download}`)
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

    if (!wsFileInputRef.current?.files?.length) {
      addLog('Please select a file')
      return
    }

    const svc = getActiveWebSocketService()
    if (!svc) {
      addLog('WebSocket service not initialised')
      return
    }

    const selectedFile = wsFileInputRef.current.files[0]
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
      if (wsFileInputRef.current) wsFileInputRef.current.value = ''
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

  const renderTree = (path: string = ROOT_PATH, depth = 0): React.ReactNode => {
    const items = directoryEntries[path] ?? []

    return items.map((item) => {
      const isDirectory = item.type === 'dir'
      const isExpanded = expandedDirectoriesSet.has(item.path)
      const isSelected = selectedNodePath === item.path || (item.type === 'file' && activeFilePath === item.path)
      const isLoading = loadingDirectoriesSet.has(item.path)

      return (
        <div key={item.path}>
          <div
            className={`tree-node ${isSelected ? 'selected' : ''}`}
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
          >
            {isDirectory ? (
              <button
                type="button"
                className="tree-node-toggle"
                onClick={() => void handleToggleDirectory(item.path)}
                aria-label={isExpanded ? 'Collapse directory' : 'Expand directory'}
              >
                <span>{isExpanded ? '▾' : '▸'}</span>
              </button>
            ) : (
              <span className="tree-node-toggle tree-node-toggle-placeholder" aria-hidden="true" />
            )}

            <button
              type="button"
              className="tree-node-label"
              onClick={() => {
                if (isDirectory) {
                  void handleSelectDirectory(item.path)
                  return
                }
                void handleLoadFile(item.path)
              }}
            >
              <span className="tree-node-icon" aria-hidden="true">{isDirectory ? '📁' : '📄'}</span>
              <span className="tree-node-name">{item.name}</span>
              {isDirectory && isLoading && <span className="tree-node-meta">…</span>}
            </button>
          </div>
          {isDirectory && isExpanded && renderTree(item.path, depth + 1)}
        </div>
      )
    })
  }

  return (
    <div className="tool-container">
      <div className="tool-header">
        <div>
          <h2>Workspace</h2>
          <p className="tool-subtitle">Browse your repo like a lightweight editor.</p>
        </div>
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
      </div>

      {toolMode === 'github' && (
        <div className="workspace-layout">
          <aside className="workspace-sidebar">
            <div className="workspace-sidebar-header">
              <div>
                <h3>Explorer</h3>
                <div className="workspace-caption">
                  {config.owner && config.repo ? `${config.owner}/${config.repo}` : 'Configure GitHub access'}
                  {config.branch ? ` · ${config.branch}` : ''}
                </div>
              </div>
              <div className="workspace-sidebar-actions">
                <button
                  type="button"
                  className="download-btn"
                  onClick={() => void loadDirectory(currentDirectoryPath || ROOT_PATH)}
                  disabled={!hasGitHubConfig}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  className="upload-btn"
                  onClick={() => githubUploadInputRef.current?.click()}
                  disabled={!hasGitHubConfig || uploading}
                >
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
                <input
                  ref={githubUploadInputRef}
                  type="file"
                  className="file-input-hidden"
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0]
                    if (selectedFile) {
                      void handleGithubUpload(selectedFile)
                    }
                  }}
                />
              </div>
            </div>

            <div className="workspace-target">Uploads go to {currentDirectoryPath || '/'}</div>

            <div className="workspace-tree">
              {!hasGitHubConfig ? (
                <div className="workspace-empty-state">Add your GitHub token, owner, and repo in Settings to load the tree.</div>
              ) : rootItems.length === 0 && loadingDirectoriesSet.has(ROOT_PATH) ? (
                <div className="workspace-empty-state">Loading repository tree…</div>
              ) : rootItems.length === 0 ? (
                <div className="workspace-empty-state">No files found at the repository root.</div>
              ) : (
                renderTree()
              )}
            </div>
          </aside>

          <section className="workspace-main">
            <div className="workspace-editor-header">
              <div>
                <div className="workspace-file-path">{activeFilePath || 'No file selected'}</div>
                <div className="workspace-caption">
                  {activeFilePath
                    ? `${file.current.split('\n').length} lines · ${hasUnsavedChanges ? 'unsaved changes' : 'saved'}`
                    : 'Select a file in the explorer to inspect or edit it.'}
                </div>
              </div>
              <div className="workspace-toolbar">
                <button type="button" className="download-btn" onClick={() => setMode('editor')} disabled={!activeFilePath}>
                  Open in Editor
                </button>
                <button type="button" className="download-btn" onClick={handleRepairJson} disabled={!activeFilePath || !isJsonPath(activeFilePath)}>
                  Repair JSON
                </button>
                <button
                  type="button"
                  className="download-btn"
                  onClick={() => setFile({ current: file.original, dirty: false })}
                  disabled={!activeFilePath || !hasUnsavedChanges}
                >
                  Revert
                </button>
                <button type="button" className="download-btn" onClick={handleDownloadCurrentFile} disabled={!activeFilePath || downloading}>
                  {downloading ? 'Downloading…' : 'Download'}
                </button>
                <button type="button" className="upload-btn" onClick={() => void handleSaveLoadedFile()} disabled={!activeFilePath || !hasUnsavedChanges || saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            <div className="workspace-main-grid">
              <div className="workspace-panel">
                <div className="workspace-panel-header">Buffer</div>
                <textarea
                  value={file.current}
                  onChange={(event) => setFile({ current: event.target.value, dirty: event.target.value !== file.original })}
                  className="workspace-buffer"
                  placeholder="Select a file from the explorer to start editing."
                  disabled={!activeFilePath}
                />
              </div>

              <div className="workspace-tools-column">
                <div className="workspace-panel">
                  <div className="workspace-panel-header">Search</div>
                  <div className="form-group">
                    <input
                      type="text"
                      value={searchPattern}
                      onChange={(event) => setSearchPattern(event.target.value)}
                      placeholder="TODO or /TODO/i"
                      className="text-input"
                      disabled={!activeFilePath}
                    />
                  </div>
                  <div className="workspace-inline-actions">
                    <input
                      type="number"
                      value={searchContext}
                      onChange={(event) => setSearchContext(event.target.value)}
                      placeholder="2"
                      className="text-input workspace-small-input"
                      disabled={!activeFilePath}
                    />
                    <button type="button" className="download-btn" onClick={handleSearchLoadedFile} disabled={!activeFilePath}>
                      Search
                    </button>
                  </div>
                  <pre className="workspace-output">{searchResults || 'No search run yet'}</pre>
                </div>

                <div className="workspace-panel">
                  <div className="workspace-panel-header">Line edit</div>
                  <div className="workspace-inline-actions">
                    <input
                      type="number"
                      value={editStartLine}
                      onChange={(event) => setEditStartLine(event.target.value)}
                      placeholder="start"
                      className="text-input workspace-small-input"
                      disabled={!activeFilePath}
                    />
                    <input
                      type="number"
                      value={editEndLine}
                      onChange={(event) => setEditEndLine(event.target.value)}
                      placeholder="end"
                      className="text-input workspace-small-input"
                      disabled={!activeFilePath}
                    />
                    <button type="button" className="upload-btn" onClick={handleApplyEdit} disabled={!activeFilePath}>
                      Apply
                    </button>
                  </div>
                  <textarea
                    value={editCode}
                    onChange={(event) => setEditCode(event.target.value)}
                    placeholder="Replacement text"
                    className="workspace-snippet-editor"
                    disabled={!activeFilePath}
                  />
                </div>

                <div className="workspace-panel workspace-panel-grow">
                  <div className="workspace-panel-header">Annotated view</div>
                  <pre className="workspace-output workspace-output-grow">{annotatedContent || 'Empty file'}</pre>
                </div>
              </div>
            </div>
          </section>
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
              onChange={(event) => setWsUrlInput(event.target.value)}
              placeholder="ws://localhost:8080"
              className="text-input"
              disabled={websocket.status === 'connecting'}
            />
          </div>
          <div className="tool-mode-switch">
            <button onClick={() => void handleWebSocketConnect()} disabled={websocket.status === 'connecting' || websocket.connected}>
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
              <input ref={wsFileInputRef} type="file" className="file-input" disabled={uploading || !websocket.connected} />
            </div>
            <div className="form-group">
              <label>Filename:</label>
              <input
                type="text"
                value={wsUploadFilename}
                onChange={(event) => setWsUploadFilename(event.target.value)}
                placeholder="document.pdf"
                className="text-input"
                disabled={uploading || !websocket.connected}
              />
            </div>
            <button onClick={() => void handleWebSocketUpload()} disabled={uploading || !websocket.connected} className="upload-btn">
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
                onChange={(event) => setWsDownloadFilename(event.target.value)}
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
              <div key={`${entry}-${index}`} className="log-entry">{entry}</div>
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
