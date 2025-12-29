import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { GitHubService } from '../services/github'
import { AIService } from '../services/ai'
import { DiffService } from '../services/diff'
import { WebSocketService, createWebSocketServer } from '../services/websocket'
import { VersionService } from '../services/version'

const getDefaultFileContent = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase()
  const filename = path.split('/').pop() || 'file'
  
  switch (ext) {
    case 'md':
    case 'markdown':
      return `# ${filename.replace(/\.(md|markdown)$/, '')}\n\nAdd your content here...\n`
    case 'js':
      return `// ${filename}\n\nconsole.log('Hello from ${filename}');\n`
    case 'jsx':
      return `// ${filename}\nimport React from 'react';\n\nconst Component = () => {\n  return (\n    <div>\n      <h1>New Component</h1>\n    </div>\n  );\n};\n\nexport default Component;\n`
    case 'ts':
      return `// ${filename}\n\ninterface Config {\n  message: string;\n}\n\nconst config: Config = {\n  message: 'Hello from ${filename}'\n};\n\nconsole.log(config.message);\n`
    case 'tsx':
      return `// ${filename}\nimport React from 'react';\n\ninterface Props {\n  title?: string;\n}\n\nconst Component: React.FC<Props> = ({ title = 'New Component' }) => {\n  return (\n    <div>\n      <h1>{title}</h1>\n    </div>\n  );\n};\n\nexport default Component;\n`
    case 'json':
      return `{\n  "name": "${filename.replace(/\.json$/, '')}",\n  "version": "1.0.0",\n  "description": "Add description here"\n}\n`
    case 'css':
      return `/* ${filename} */\n\n.container {\n  display: flex;\n  flex-direction: column;\n  gap: 1rem;\n}\n`
    case 'html':
      return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${filename.replace(/\.html$/, '')}</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>\n`
    case 'py':
      return `# ${filename}\n\ndef main():\n    print("Hello from ${filename}")\n\nif __name__ == "__main__":\n    main()\n`
    case 'txt':
      return `${filename}\n${'='.repeat(filename.length)}\n\nAdd your text content here...\n`
    default:
      return `# ${filename}\n\n# Add your content here...\n`
  }
}

export const CLI: React.FC = () => {
  const [input, setInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)
  const [wsService, setWsService] = useState<WebSocketService | null>(null)
  
  const {
    history,
    addHistory,
    clearHistory,
    file,
    setFile,
    ai,
    setAI,
    config,
    setConfig,
    setMode,
    setShowConfig,
    websocket,
    setWebSocket,
    addWebSocketMessage,
    clearWebSocketMessages,
    setWebShell
  } = useStore()

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight
    }
  }, [history])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const executeCommand = async (command: string) => {
    if (!command.trim()) return
    
    addHistory(`> ${command}`)
    setProcessing(true)

    try {
      if (command.startsWith('/')) {
        await handleSlashCommand(command.slice(1))
      } else {
        await handleAIInstruction(command)
      }
    } catch (error) {
      addHistory(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setProcessing(false)
    }
  }

  const handleSlashCommand = async (cmd: string) => {
    const [command, ...args] = cmd.split(' ')
    const arg = args.join(' ')

    switch (command) {
      case 'open':
        await openFile(arg)
        break
      case 'new':
        await createNewFile(arg)
        break
      case 'ls':
        await listFiles(arg || '')
        break
      case 'cat':
        await showFileContent(arg)
        break
      case 'socket':
        await handleSocketCommand(arg)
        break
      case 'upload':
        await handleUploadCommand(arg)
        break
      case 'download':
        await handleDownloadCommand(arg)
        break
      case 'img':
      case 'image':
        await handleImageCommand(arg)
        break
      case 'wsh':
      case 'wasmer':
        await handleWasmerShellCommand(arg)
        break
      case 'preload':
        await handlePreloadCommand(arg)
        break
      case 'python':
        await handlePythonCommand(arg)
        break
      case 'pip': {
        const [sub, ...rest] = arg.split(' ').filter(Boolean)
        if (sub === 'install') {
          await handlePipInstall(rest)
        } else {
          addHistory('Usage: /pip install <pkg1> [pkg2 ...]')
        }
        break
      }
      case 'apply':
        applyAIChanges()
        break
      case 'diff':
        showDiff()
        break
      case 'revert':
        revertChanges()
        break
      case 'commit':
        await commitChanges(arg.replace(/^["']|["']$/g, ''))
        break
      case 'branch':
        await switchBranch(arg)
        break
      case 'model':
        switchModel(arg)
        break
      case 'config':
        setShowConfig(true)
        addHistory('Configuration overlay opened')
        break
      case 'save':
        saveLocal()
        break
      case 'tokens':
        await estimateTokens()
        break
      case 'update':
        await handleUpdateCommand()
        break
      case 'help':
        showHelp()
        break
      case 'editor':
        setMode('editor')
        addHistory('Switched to editor mode')
        break
      case 'cli':
        addHistory('Already in CLI mode')
        break
      case 'tool':
        if (arg === 'upload' || arg === 'download') {
          setMode('tool')
          addHistory(`Switched to tool mode (${arg})`)
        } else {
          setMode('tool')
          addHistory('Switched to tool mode')
        }
        break
      case 'clear':
        clearHistory()
        break
      case 'ai':
        await handleAIInstruction(arg)
        break
      default:
        addHistory(`Unknown command: ${command}`)
    }
  }

  const handleAIInstruction = async (instruction: string) => {
    if (!instruction.trim()) {
      addHistory('Please provide an instruction')
      return
    }

    if (!config.openaiKey) {
      addHistory('OpenAI API key not configured. Use /config to set it up.')
      return
    }

    if (!file.current) {
      addHistory('No file loaded. Use /open <path> to load a file first.')
      return
    }

    setAI({ lastInstruction: instruction, pending: true })
    addHistory(`AI instruction: ${instruction}`)

    try {
      const aiService = new AIService(config.openaiKey, config.model, config.temperature)
      const result = await aiService.transformFile(instruction, file.current)
      
      setAI({ lastAIContent: result, pending: false })
      addHistory('AI transformation completed. Use /apply to apply changes.')
    } catch (error) {
      setAI({ pending: false })
      throw error
    }
  }

  const handleImageCommand = async (raw: string) => {
    // Parse optional size flag: -s 256|512|1024
    let size: '256x256' | '512x512' | '1024x1024' = '1024x1024'
    let prompt = raw
    const m = raw.match(/^-s\s*(256|512|1024)\s+([\s\S]+)/)
    if (m) {
      size = (m[1] + 'x' + m[1]) as any
      prompt = m[2]
    }
    if (!prompt.trim()) {
      addHistory('Usage: /img [-s 256|512|1024] <prompt>')
      return
    }
    if (!config.openaiKey) {
      addHistory('OpenAI API key not configured. Use /config to set it up.')
      return
    }
    if (!config.githubToken || !config.owner || !config.repo) {
      addHistory('GitHub configuration missing. Use /config to set it up.')
      return
    }

    try {
      addHistory(`🎨 Generating image: ${prompt} ${size !== '1024x1024' ? `(size ${size})` : ''}`)
      const aiService = new AIService(config.openaiKey)
      const b64 = await aiService.generateImage(prompt, size)
      addHistory('🖼️ Image generated. Uploading to repository...')

      const github = new GitHubService(config.githubToken, config.owner, config.repo)
      const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 12) // to minutes
      const safePrompt = prompt.trim().slice(0, 40).replace(/[^a-zA-Z0-9._-]+/g, '_') || 'image'
      const path = `assets/${timestamp}-${safePrompt}.png`

      const { sha } = await github.updateFileBase64(
        path,
        b64,
        '',
        `chore: add AI image for prompt: ${prompt}`,
        config.branch
      )
      const url = `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/${path}`
      addHistory(`✅ Uploaded: ${path} (sha ${sha.substring(0,7)})`)
      addHistory(`🔗 ${url}`)

      // If current file is markdown, append image reference and mark dirty
      const isMarkdown = /\.(md|markdown)$/i.test(config.path || '')
      if (isMarkdown) {
        const md = `\n\n![${safePrompt}](${url})\n`
        setFile({ current: file.current + md, dirty: true })
        addHistory('✍️ Inserted image reference into current Markdown file.')
      } else {
        addHistory('ℹ️ Open a Markdown file to insert image reference automatically.')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      addHistory(`❌ Image generation failed: ${msg}`)
      const details = (e as any)?.body || (e as any)?.details
      if (details) {
        const snippet = String(details).slice(0, 1000)
        addHistory('— OpenAI error details (truncated) —')
        addHistory(snippet)
      }
      addHistory('💡 Tips:')
      addHistory('- Ensure OpenAI key is valid and has access to gpt-image-1')
      addHistory('- Try a different prompt (may violate content policy)')
      addHistory('- If using Chrome, check DevTools → Network for response details')
    }
  }

  const handleWasmerShellCommand = async (arg: string) => {
    // Open webassembly.sh and prepare a ready-to-paste compile command
    const cPath = (arg && arg.trim()) ? arg.trim() : (config.path || '')
    if (!cPath) {
      addHistory('Usage: /wsh <path/to/file.c> (or open a .c file and run /wsh)')
      addHistory('Entering Web Shell. Use the Copy button to paste prepared commands.')
      setMode('wsh' as any)
      return
    }
    if (!/\.c$/i.test(cPath)) {
      addHistory(`❌ Not a C source file: ${cPath}`)
      return
    }

    // Obtain source content
    let source = ''
    try {
      if (config.path && cPath === config.path) {
        source = file.current
      } else {
        if (!config.githubToken || !config.owner || !config.repo) {
          addHistory('❌ GitHub configuration missing for fetching file. Use /config.')
          return
        }
        const github = new GitHubService(config.githubToken, config.owner, config.repo)
        const { content } = await github.getFile(cPath, config.branch)
        source = content
      }
    } catch (e) {
      addHistory(`❌ Failed to load source file: ${e instanceof Error ? e.message : String(e)}`)
      return
    }

    const base = cPath.split('/').pop() || 'program.c'
    const wasmName = base.replace(/\.c$/i, '.wasm')
    // Escape EOF block safely
    const heredoc = `cat <<'EOF' > ${base}\n${source}\nEOF`
    const compileCmd = `clang --target=wasm32-wasi -O3 -Wl,--export-all -Wl,--no-entry -o ${wasmName} ${base}`
    const runCmd = `ls -la ${wasmName}`
    const full = `${heredoc}\n${compileCmd}\n${runCmd}`

    // Save prepared commands in store and switch to embedded shell
    try { await navigator.clipboard.writeText(full); addHistory('📋 Copied commands to clipboard.') } catch {}
    setWebShell({ prepared: full })
    setMode('wsh' as any)
  }

  const handlePreloadCommand = async (arg: string) => {
    const target = (arg || '').trim().toLowerCase()
    if (!target || (target !== 'wasmer' && target !== 'python' && target !== 'wsh' && target !== 'webshell')) {
      addHistory('Usage: /preload wasmer | python | wsh')
      return
    }
    if (target === 'wasmer') {
      addHistory('⏳ Preloading local Wasmer SDK (no network)...')
      const local = (window as any).__WASMER_SDK_URL || '/Chat_github/vendor/wasmer-sdk/index.esm.js'
      try { await fetch(local, { mode: 'no-cors' }); addHistory(`✅ Cached SDK: ${local}`) } catch { addHistory(`❌ Could not cache local SDK at ${local}. Place the SDK ESM there or set window.__WASMER_SDK_URL.`) }
      addHistory('ℹ️ Registry packages are not downloaded in this mode. Use /wsh or server fallback for toolchains.')
      return
    }
    if (target === 'python') {
      addHistory('⏳ Preloading Pyodide core files for offline use...')
      const base = (window as any).__PYODIDE_BASE || 'https://cdn.jsdelivr.net/pyodide/v0.28.2/full'
      const assets = [
        'pyodide.js', 'pyodide.mjs', 'pyodide.asm.wasm',
        'repodata.json', 'pyodide-lock.json', 'python_stdlib.zip'
      ]
      let count = 0
      for (const a of assets) {
        try {
          await fetch(`${base}/${a}`, { mode: 'no-cors' })
          addHistory(`✅ Cached ${a}`)
          count++
        } catch {}
      }
      if (count === 0) addHistory('ℹ️ Could not fetch Pyodide assets now; they may still be cached when a Python runtime is added.')
      return
    }
    if (target === 'wsh' || target === 'webshell') {
      addHistory('⏳ Preloading WebAssembly.sh shell for offline usage...')
      try {
        await fetch('https://webassembly.sh/', { mode: 'no-cors' })
        addHistory('✅ Cached https://webassembly.sh/')
      } catch {}
      // Optionally try common static paths (best-effort; site may change)
      const guesses = [
        'https://webassembly.sh/favicon.ico'
      ]
      for (const url of guesses) {
        try { await fetch(url, { mode: 'no-cors' }); addHistory(`✅ Cached ${url}`) } catch {}
      }
      addHistory('ℹ️ The shell itself controls its internal assets; main page is now cached with CacheFirst.')
      return
    }
  }

  const handlePythonCommand = async (arg: string) => {
    // Run a Python .py file via Pyodide and show its output
    const pPath = (arg && arg.trim()) ? arg.trim() : (config.path || '')
    if (!pPath) {
      addHistory('Opening Python Runner panel…')
      setMode('python' as any)
      return
    }
    if (!/\.py$/i.test(pPath)) {
      addHistory(`❌ Not a Python source file: ${pPath}`)
      return
    }
    let source = ''
    try {
      if (config.path && pPath === config.path) {
        source = file.current
      } else {
        if (!config.githubToken || !config.owner || !config.repo) {
          addHistory('❌ GitHub configuration missing for fetching file. Use /config.')
          return
        }
        const github = new GitHubService(config.githubToken, config.owner, config.repo)
        const { content } = await github.getFile(pPath, config.branch)
        source = content
      }
    } catch (e) {
      addHistory(`❌ Failed to load Python file: ${e instanceof Error ? e.message : String(e)}`)
      return
    }
    addHistory('🐍 Running Python via Pyodide...')
    try {
      const { runPythonCode } = await import('../services/python')
      const res = await runPythonCode(source)
      if (res.stdout) {
        addHistory('— Python stdout —')
        res.stdout.split('\n').forEach((line) => line && addHistory(line))
      }
      if (res.stderr) {
        addHistory('— Python stderr —')
        res.stderr.split('\n').forEach((line) => line && addHistory(line))
      }
      if (typeof res.result !== 'undefined') {
        addHistory(`Result: ${String(res.result)}`)
      }
      addHistory('✅ Python execution complete')
    } catch (e) {
      addHistory(`❌ Python run failed: ${e instanceof Error ? e.message : String(e)}`)
      addHistory('Tip: Run /preload python once to cache Pyodide assets for offline use.')
      addHistory('You can also open the Python Runner panel with /python and run code interactively.')
    }
  }

  const handlePipInstall = async (pkgs: string[]) => {
    if (pkgs.length === 0) {
      addHistory('Usage: /pip install <pkg1> [pkg2 ...]')
      return
    }
    addHistory(`📦 Installing: ${pkgs.join(', ')}`)
    try {
      const { installMicropipPackages } = await import('../services/python')
      const res = await installMicropipPackages(pkgs)
      if (res.stdout) {
        addHistory('— pip stdout —')
        res.stdout.split('\n').forEach(l => l && addHistory(l))
      }
      if (res.stderr) {
        addHistory('— pip stderr —')
        res.stderr.split('\n').forEach(l => l && addHistory(l))
      }
      addHistory('✅ Installation complete (Pyodide/micropip)')
    } catch (e) {
      addHistory(`❌ pip install failed: ${e instanceof Error ? e.message : String(e)}`)
      addHistory('Tip: Only pure-Python packages are supported; run /preload python first for faster installs.')
    }
  }

  const openFile = async (path: string) => {
    if (!path) {
      addHistory('Usage: /open <path>')
      return
    }

    if (!config.githubToken || !config.owner || !config.repo) {
      addHistory('GitHub configuration missing. Use /config to set up.')
      return
    }

    try {
      const github = new GitHubService(config.githubToken, config.owner, config.repo)
      const { content, sha } = await github.getFile(path, config.branch)
      
      setFile({
        original: content,
        current: content,
        sha,
        dirty: false
      })
      
      setConfig({
        path: path
      })
      
      addHistory(`Opened ${path} (sha: ${sha.substring(0, 7)})`)
    } catch (error) {
      throw new Error(`Failed to open file: ${error}`)
    }
  }

  const createNewFile = async (path: string) => {
    if (!path) {
      addHistory('Usage: /new <path>')
      return
    }

    if (!config.githubToken || !config.owner || !config.repo) {
      addHistory('GitHub configuration missing. Use /config to set up.')
      return
    }

    try {
      // Check if file already exists
      const github = new GitHubService(config.githubToken, config.owner, config.repo)
      
      try {
        await github.getFile(path, config.branch)
        addHistory(`File ${path} already exists. Use /open to edit it.`)
        return
      } catch (error) {
        // File doesn't exist, which is what we want for creating new file
        // This is expected behavior
      }

      // Create new file with default content based on extension
      const defaultContent = getDefaultFileContent(path)
      
      setFile({
        original: '',
        current: defaultContent,
        sha: '', // Empty SHA for new file
        dirty: true
      })
      
      setConfig({
        path: path
      })
      
      addHistory(`Created new file: ${path}`)
      addHistory('Content loaded in editor. Use /editor to view/edit, then /commit to save.')
    } catch (error) {
      addHistory(`Error creating file: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const listFiles = async (path: string) => {
    if (!config.githubToken || !config.owner || !config.repo) {
      addHistory('GitHub configuration missing. Use /config to set up.')
      return
    }

    try {
      const github = new GitHubService(config.githubToken, config.owner, config.repo)
      const items = await github.listDirectory(path, config.branch)
      
      addHistory(`Contents of ${path || 'root'}:`)
      
      // Sort directories first, then files
      const sorted = items.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name)
        }
        return a.type === 'dir' ? -1 : 1
      })
      
      sorted.forEach(item => {
        const icon = item.type === 'dir' ? '📁' : '📄'
        const size = item.size ? ` (${formatFileSize(item.size)})` : ''
        addHistory(`${icon} ${item.name}${size}`)
      })
      
      addHistory(`\nFound ${items.length} items`)
    } catch (error) {
      throw new Error(`Failed to list files: ${error}`)
    }
  }

  const showFileContent = async (path: string) => {
    if (!path) {
      addHistory('Usage: /cat <path>')
      return
    }

    if (!config.githubToken || !config.owner || !config.repo) {
      addHistory('GitHub configuration missing. Use /config to set up.')
      return
    }

    try {
      const github = new GitHubService(config.githubToken, config.owner, config.repo)
      const { content } = await github.getFile(path, config.branch)
      
      addHistory(`Content of ${path}:`)
      addHistory('─'.repeat(50))
      
      // Limit content display to prevent overwhelming the CLI
      const lines = content.split('\n')
      if (lines.length > 50) {
        lines.slice(0, 50).forEach(line => addHistory(line))
        addHistory('─'.repeat(50))
        addHistory(`... (showing first 50 lines of ${lines.length})`)
        addHistory('Use /open to load the full file for editing')
      } else {
        lines.forEach(line => addHistory(line))
        addHistory('─'.repeat(50))
      }
      
    } catch (error) {
      throw new Error(`Failed to show file content: ${error}`)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const handleSocketCommand = async (arg: string) => {
    const [subCommand, ...params] = arg.split(' ')
    
    switch (subCommand) {
      case 'connect':
        await connectWebSocket(params.join(' '))
        break
      case 'disconnect':
        disconnectWebSocket()
        break
      case 'status':
        showWebSocketStatus()
        break
      case 'send':
        sendWebSocketMessage(params.join(' '))
        break
      case 'exec':
        executeRemoteCommand(params.join(' '))
        break
      case 'server':
        showServerTemplate(params[0] ? parseInt(params[0]) : 8080)
        break
      case 'clear':
        clearWebSocketMessages()
        addHistory('WebSocket message history cleared')
        break
      default:
        addHistory('Usage: /socket <command>')
        addHistory('Commands:')
        addHistory('  connect <url>     - Connect to WebSocket server')
        addHistory('  disconnect        - Disconnect from server')
        addHistory('  status           - Show connection status')
        addHistory('  send <message>   - Send raw message')
        addHistory('  exec <command>   - Execute command on remote server')
        addHistory('  server [port]    - Show server template code')
        addHistory('  clear           - Clear message history')
    }
  }

  const connectWebSocket = async (url: string) => {
    if (!url) {
      addHistory('Usage: /socket connect <ws://localhost:8080>')
      return
    }

    if (wsService) {
      wsService.disconnect()
    }

    try {
      const newWsService = new WebSocketService(
        url,
        (message) => {
          addWebSocketMessage(message)
          
          // Display messages in CLI
          const timestamp = new Date(message.timestamp).toLocaleTimeString()
          switch (message.type) {
            case 'stdout':
              addHistory(`[${timestamp}] STDOUT: ${message.data.trim()}`)
              break
            case 'stderr':
              addHistory(`[${timestamp}] STDERR: ${message.data.trim()}`)
              break
            case 'status':
              addHistory(`[${timestamp}] STATUS: ${message.data}`)
              break
            case 'error':
              addHistory(`[${timestamp}] ERROR: ${message.data}`)
              break
            case 'file_data':
              handleFileDataReceived(message)
              break
          }
        },
        (status) => {
          setWebSocket({ status, connected: status === 'connected' })
          if (status === 'connected') {
            addHistory(`WebSocket connected: ${url}`)
          } else if (status === 'connecting') {
            addHistory(`WebSocket connecting: ${url}`)
          } else if (status === 'error') {
            addHistory(`WebSocket error: ${url}`)
          } else if (status === 'disconnected') {
            addHistory(`WebSocket disconnected: ${url}`)
          }
        }
      )

      setWsService(newWsService)
      setWebSocket({ url })
      await newWsService.connect()
      
    } catch (error) {
      addHistory(`Failed to connect: ${error instanceof Error ? error.message : error}`)
    }
  }

  const disconnectWebSocket = () => {
    if (wsService) {
      wsService.disconnect()
      setWsService(null)
      setWebSocket({ connected: false, status: 'disconnected' })
      addHistory('WebSocket disconnected')
    } else {
      addHistory('No active WebSocket connection')
    }
  }

  const showWebSocketStatus = () => {
    if (wsService) {
      addHistory(`WebSocket Status: ${websocket.status.toUpperCase()}`)
      addHistory(`URL: ${websocket.url}`)
      addHistory(`Ready State: ${wsService.getReadyState()}`)
      addHistory(`Messages: ${websocket.messages.length}`)
    } else {
      addHistory('No WebSocket connection')
    }
  }

  const sendWebSocketMessage = (message: string) => {
    if (!message) {
      addHistory('Usage: /socket send <message>')
      return
    }

    if (!wsService || !wsService.isConnected()) {
      addHistory('Not connected to WebSocket server')
      return
    }

    try {
      wsService.sendStdin(message)
      addHistory(`Sent: ${message}`)
    } catch (error) {
      addHistory(`Failed to send message: ${error instanceof Error ? error.message : error}`)
    }
  }

  const executeRemoteCommand = (command: string) => {
    if (!command) {
      addHistory('Usage: /socket exec <command>')
      return
    }

    if (!wsService || !wsService.isConnected()) {
      addHistory('Not connected to WebSocket server')
      return
    }

    try {
      wsService.sendCommand(command)
      addHistory(`Executing: ${command}`)
    } catch (error) {
      addHistory(`Failed to execute command: ${error instanceof Error ? error.message : error}`)
    }
  }

  const showServerTemplate = (port: number) => {
    addHistory('WebSocket Server Template:')
    addHistory('─'.repeat(50))
    const template = createWebSocketServer(port)
    const lines = template.split('\n')
    lines.forEach(line => addHistory(line))
    addHistory('─'.repeat(50))
    addHistory(`Save as websocket-server.js and run: node websocket-server.js`)
  }

  const handleUploadCommand = async (filename: string) => {
    if (!filename) {
      addHistory('Usage: /upload <filename>')
      addHistory('This will send a file from the local device to the WebSocket server')
      return
    }

    if (!wsService || !wsService.isConnected()) {
      addHistory('Not connected to WebSocket server. Use /socket connect <url> first.')
      return
    }

    try {
      // Create file input element
      const fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.multiple = false
      fileInput.style.display = 'none'
      
      // Add to DOM temporarily
      document.body.appendChild(fileInput)
      
      // Create promise to handle file selection
      const fileSelected = new Promise<File | null>((resolve) => {
        fileInput.onchange = (event) => {
          const target = event.target as HTMLInputElement
          const file = target.files?.[0] || null
          resolve(file)
        }
        
        fileInput.oncancel = () => {
          resolve(null)
        }
      })
      
      // Trigger file picker
      addHistory('Opening file picker for upload')
      fileInput.click()
      
      // Wait for file selection
      const selectedFile = await fileSelected
      
      // Clean up
      document.body.removeChild(fileInput)
      
      if (!selectedFile) {
        addHistory('Upload cancelled')
        return
      }
      
      addHistory(`Selected: ${selectedFile.name} (${formatFileSize(selectedFile.size)})`)
      
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
        // Read as text
        content = await selectedFile.text()
        addHistory('Processing as text file...')
      } else {
        // Read as binary and base64 encode
        const arrayBuffer = await selectedFile.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        content = btoa(String.fromCharCode(...uint8Array))
        addHistory('Processing as binary file (base64 encoded)...')
      }
      
      // Send via WebSocket
      wsService.sendFileUpload(filename, content, !isTextFile)
      addHistory(`📤 Uploading ${filename} to server...`)
      
    } catch (error) {
      addHistory(`Upload failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  const handleDownloadCommand = async (filename: string) => {
    if (!filename) {
      addHistory('Usage: /download <filename>')
      addHistory('This will request a file from the WebSocket server')
      return
    }

    if (!wsService || !wsService.isConnected()) {
      addHistory('Not connected to WebSocket server. Use /socket connect <url> first.')
      return
    }

    try {
      wsService.requestFileDownload(filename)
      addHistory(`Requesting download: ${filename}`)
      addHistory('Waiting for server response')
      
    } catch (error) {
      addHistory(`Download failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  const handleFileDataReceived = (message: any) => {
    try {
      const filename = message.filename || 'downloaded_file'
      const fileSize = message.fileSize || 0
      const isBase64 = message.isBase64 || false
      
      addHistory(`📥 Received file: ${filename} (${formatFileSize(fileSize)})`)
      
      let blob: Blob
      let mimeType = 'application/octet-stream'
      
      if (isBase64) {
        // Binary file - decode base64
        const binaryString = atob(message.data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        blob = new Blob([bytes], { type: mimeType })
      } else {
        // Text file
        mimeType = 'text/plain'
        blob = new Blob([message.data], { type: mimeType })
      }
      
      // Create download link
      const url = URL.createObjectURL(blob)
      const downloadLink = document.createElement('a')
      downloadLink.href = url
      downloadLink.download = filename
      downloadLink.style.display = 'none'
      
      // Add to DOM and trigger download
      document.body.appendChild(downloadLink)
      downloadLink.click()
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(downloadLink)
        URL.revokeObjectURL(url)
      }, 100)
      
      addHistory(`✅ Download complete: ${filename}`)
      addHistory(`📁 Check your Downloads folder`)
      
    } catch (error) {
      addHistory(`File processing failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  /* Removed: /cc compile command - superseded by /wsh and server workflows
  const handleCompileC = async (arg: string) => {
    // Compile a C source file to WebAssembly in-browser via Wasmer SDK
    // Usage: /cc [path/to/file.c]  (defaults to current config.path)
    const cPath = (arg && arg.trim()) ? arg.trim() : (config.path || '')
    if (!cPath) {
      addHistory('Usage: /cc <path/to/file.c> (or open a .c file and run /cc)')
      return
    }
    if (!/\.c$/i.test(cPath)) {
      addHistory(`❌ Not a C source file: ${cPath}`)
      return
    }
    // Always use in-browser Wasmer compile; no server needed

    // Obtain source content
    let source = ''
    try {
      if (config.path && cPath === config.path) {
        // Use current buffer
        source = file.current
      } else {
        // Fetch from GitHub
        if (!config.githubToken || !config.owner || !config.repo) {
          addHistory('❌ GitHub configuration missing for fetching file. Use /config.')
          return
        }
        const github = new GitHubService(config.githubToken, config.owner, config.repo)
        const { content } = await github.getFile(cPath, config.branch)
        source = content
      }
    } catch (e) {
      addHistory(`❌ Failed to load source file: ${e instanceof Error ? e.message : String(e)}`)
      return
    }

    // Compile in browser using Wasmer SDK
    addHistory('🧪 Using Wasmer SDK (LLVM/Clang latest) to compile in browser...')
    try {
      const { compileCWithWasmer } = await import('../services/wasmer')
      const stageIcon: Record<string, string> = {
        sdk: '⏳', pkg: '⬇️', fs: '📁', compile: '🛠️', result: '📦', done: '✅'
      }
      const res = await compileCWithWasmer(
        source,
        cPath.split('/').pop() || 'program.c',
        (stage, message) => {
          const icon = stageIcon[stage] || '•'
          addHistory(`${icon} ${message}`)
        }
      )
      if (res.stdout?.trim()) addHistory(res.stdout.trim())
      if (res.stderr?.trim()) addHistory(res.stderr.trim())

      const outName = (cPath.split('/').pop() || 'program.c').replace(/\.c$/i, '.wasm')
      const blob = new Blob([res.wasm], { type: 'application/wasm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = outName
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 100)
      addHistory(`✅ Downloaded ${outName} (in-browser compile)`) 
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      addHistory(`❌ Wasmer compile failed: ${errMsg}`)
      addHistory('Note: This feature requires network access to fetch the LLVM/Clang package from Wasmer registry.')
      // iOS/PWA environments may block dynamic ESM imports; try server fallback if available
      if (wsService && wsService.isConnected()) {
        try {
          const base = cPath.split('/').pop() || 'program.c'
          const wasmName = base.replace(/\.c$/i, '.wasm')
          addHistory('↩️ Falling back to server-side compile using emscripten (emcc)...')
          // Upload source to server workspace
          wsService.sendFileUpload(base, source, false)
          addHistory(`📤 Uploaded ${base} to server workspace`)
          // Build with emcc
          const compileCmd = [
            'bash -lc',
            `"set -e; cd websocket_files; ` +
            `if command -v emcc >/dev/null 2>&1; then ` +
            `emcc '${base}' -O3 -s WASM=1 -s STANDALONE_WASM=1 -s EXPORTED_FUNCTIONS=\\\"['_main']\\\" -o '${wasmName}'; ` +
            `else echo 'Emscripten (emcc) not found on server. Install emsdk and activate it.' >&2; exit 127; fi"`
          ].join(' ')
          addHistory('🛠️ Compiling on server (emcc)...')
          wsService.sendCommand(compileCmd)
          // Try to fetch the artifact a few times
          let attempts = 0
          const tryDownload = () => {
            attempts++
            try {
              wsService.requestFileDownload(wasmName)
              addHistory(`⬇️ Requesting ${wasmName} (attempt ${attempts})`)
            } catch {}
            if (attempts < 8) setTimeout(tryDownload, 1000)
          }
          setTimeout(tryDownload, 2000)
          return
        } catch (se) {
          addHistory(`❌ Server fallback failed: ${se instanceof Error ? se.message : String(se)}`)
        }
      } else {
        addHistory('💡 You can connect a WebSocket server with emscripten installed and retry:')
        addHistory('   /socket connect ws://localhost:8080  then /cc c.c')
      }
    }
    return

    // (server compile path removed)
  }
  */

  const applyAIChanges = () => {
    if (!ai.lastAIContent) {
      addHistory('No AI changes to apply')
      return
    }

    setFile({
      current: ai.lastAIContent,
      dirty: true
    })
    
    addHistory('AI changes applied to editor')
  }

  const showDiff = () => {
    if (!file.original || !file.current) {
      addHistory('No file loaded to show diff')
      return
    }

    if (!DiffService.hasChanges(file.original, file.current)) {
      addHistory('No changes to show')
      return
    }

    const diffText = DiffService.formatDiffText(file.original, file.current)
    addHistory('Diff:')
    addHistory(diffText)
  }

  const revertChanges = () => {
    if (!file.original) {
      addHistory('No original content to revert to')
      return
    }

    setFile({
      current: file.original,
      dirty: false
    })
    
    addHistory('Changes reverted to original content')
  }

  const commitChanges = async (message: string) => {
    if (!message) {
      addHistory('Usage: /commit "commit message"')
      return
    }

    if (!file.current) {
      addHistory('No content to commit')
      return
    }

    if (!config.path) {
      addHistory('No file path set. Use /open or /new first.')
      return
    }

    if (!config.githubToken || !config.owner || !config.repo) {
      addHistory('GitHub configuration missing')
      return
    }

    try {
      const github = new GitHubService(config.githubToken, config.owner, config.repo)
      
      // updateFile handles both new files (no SHA) and existing files (with SHA)
      const newSha = await github.updateFile(
        config.path, 
        file.current, 
        file.sha, // Will be empty string for new files
        message, 
        config.branch
      )
      
      const action = file.sha ? 'Updated' : 'Created'
      addHistory(`${action}: ${message} (sha: ${newSha.substring(0, 7)})`)
      
      setFile({
        original: file.current,
        sha: newSha,
        dirty: false
      })
      
    } catch (error) {
      throw new Error(`Commit failed: ${error}`)
    }
  }

  const switchBranch = async (branch: string) => {
    if (!branch) {
      addHistory('Usage: /branch <branch-name>')
      return
    }

    addHistory(`Switched to branch: ${branch}`)
    // Note: Branch switching would need additional GitHub API calls to check if branch exists
  }

  const switchModel = (model: string) => {
    if (!model) {
      addHistory(`Current model: ${config.model}`)
      return
    }

    addHistory(`Switched to model: ${model}`)
  }

  const saveLocal = () => {
    if (!file.current) {
      addHistory('No file content to save')
      return
    }

    if (!config.path) {
      addHistory('No file path set. Use /open or /new first.')
      return
    }

    try {
      // Create blob with file content
      const blob = new Blob([file.current], { type: 'text/plain;charset=utf-8' })
      
      // Create download link
      const url = URL.createObjectURL(blob)
      const downloadLink = document.createElement('a')
      downloadLink.href = url
      downloadLink.download = config.path.split('/').pop() || 'saved_file.txt'
      downloadLink.style.display = 'none'
      
      // Add to DOM and trigger download
      document.body.appendChild(downloadLink)
      downloadLink.click()
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(downloadLink)
        URL.revokeObjectURL(url)
      }, 100)
      
      // Also save to localStorage as backup
      localStorage.setItem('chat-github-draft', JSON.stringify({
        content: file.current,
        path: config.path,
        timestamp: Date.now()
      }))
      
      addHistory(`✅ File saved locally: ${downloadLink.download}`)
      addHistory('📁 Check your Downloads folder')
      addHistory('💾 Also backed up to localStorage')
      
    } catch (error) {
      addHistory(`Save failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  const estimateTokens = async () => {
    if (!file.current) {
      addHistory('No file loaded')
      return
    }

    if (!config.openaiKey) {
      addHistory('OpenAI API key needed for token estimation')
      return
    }

    const aiService = new AIService(config.openaiKey)
    const tokens = await aiService.estimateTokens(file.current)
    addHistory(`Estimated tokens: ${tokens}`)
  }

  const handleUpdateCommand = async () => {
    // Show current build time (Taipei) and attempt a live update
    try {
      const currentVersion = VersionService.getCurrentVersion()
      const minutesAgo = (ms: number) => Math.max(0, Math.floor(ms / 60000))
      let line = `📦 Current version: ${currentVersion}`
      try {
        let dt: Date | null = null
        const mTpe = currentVersion.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) Taipei$/)
        if (mTpe) dt = new Date(`${mTpe[1]}T${mTpe[2]}:00+08:00`)
        const mUtc = !dt && currentVersion.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) UTC$/)
        if (!dt && mUtc) dt = new Date(`${(mUtc as RegExpMatchArray)[1]}T${(mUtc as RegExpMatchArray)[2]}:00Z`)
        if (dt) line += `  (built ${minutesAgo(Date.now() - dt.getTime())} min ago)`
      } catch {}
      addHistory(line)
      addHistory('🔄 Attempting live update...')

      if ('serviceWorker' in navigator) {
        let reloaded = false
        const onControllerChange = () => {
          if (reloaded) return
          reloaded = true
          addHistory('✅ Update applied. Reloading...')
          setTimeout(() => window.location.reload(), 200)
        }
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange, { once: true } as any)
        const regs = await navigator.serviceWorker.getRegistrations()
        if (!regs.length) {
          addHistory('ℹ️ No service worker registration found. Please refresh manually.')
        } else {
          await Promise.allSettled(regs.map(r => r.update()))
          regs.forEach(r => r.waiting && r.waiting.postMessage({ type: 'SKIP_WAITING' }))
          setTimeout(() => {
            if (!reloaded) addHistory('ℹ️ If not reloaded, please refresh or relaunch the app.')
          }, 3000)
        }
      } else {
        addHistory('ℹ️ Service worker not supported; please refresh the page.')
      }
    } catch (error) {
      addHistory(`❌ Update failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const showHelp = () => {
    const commands = [
      '/open <path> - Load file from GitHub',
      '/new <path> - Create new file with template',
      '/ls [path] - List files in directory',
      '/cat <path> - Show file contents',
      '/upload <filename> - Upload file via WebSocket',
      '/download <filename> - Download file via WebSocket',
      '/socket <cmd> - WebSocket console operations',
      '/apply - Apply AI changes to editor',
      '/diff - Show differences',
      '/revert - Revert to original',
      '/commit "msg" - Commit changes',
      '/branch <name> - Switch branch',
      '/model <id> - Switch AI model',
      '/config - Open configuration',
      '/save - Save current file to local Downloads',
      '/tokens - Estimate token usage',
      '/preload wasmer|python - Pre-cache SDK/registry or Pyodide assets for offline',
      '/preload wsh - Pre-cache webassembly.sh shell page for offline',
      '/python <file.py> - Run a Python file via Pyodide and show output',
      '/pip install <pkg...> - Install pure-Python packages via micropip (Pyodide)',
      '/img <prompt> - Generate image via AI and upload',
      '/update - Check for application updates',
      '/editor - Switch to editor',
      '/tool [upload|download] - Switch to file transfer tools',
      '/clear - Clear history',
      '/help - Show this help'
    ]
    
    addHistory('Available commands:')
    commands.forEach(cmd => addHistory(cmd))
    addHistory('')
    addHistory('WebSocket commands: /socket <subcommand>')
    addHistory('  connect <url> - Connect to WebSocket server')
    addHistory('  exec <cmd>    - Execute remote command')
    addHistory('  send <msg>    - Send message to stdin')
    addHistory('  server [port] - Show server template with file support')
    addHistory('')
    addHistory('File Transfer (requires WebSocket connection):')
    addHistory('  /upload <filename>   - Send file to server')
    addHistory('  /download <filename> - Receive file from server')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || processing) return
    
    executeCommand(input)
    setInput('')
  }

  return (
    <div className="cli-container">
      <div className="cli-history" ref={historyRef}>
        {history.map((line, index) => (
          <div key={index} className="cli-line">
            {line}
          </div>
        ))}
        {processing && <div className="cli-line processing">Processing...</div>}
      </div>
      
      <form onSubmit={handleSubmit} className="cli-input-form">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={processing}
          className="cli-input"
          placeholder="輸入指令或AI指示... (以/開始指令) / Enter command (start with /) or AI instruction..."
          autoComplete="off"
          lang="zh-TW"
          spellCheck={false}
        />
      </form>
    </div>
  )
}
