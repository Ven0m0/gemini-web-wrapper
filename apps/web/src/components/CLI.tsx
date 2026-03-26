import React, { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'

export const CLI: React.FC = () => {
  const [history, setHistory] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [historyIndex, setHistoryIndex] = useState(-1)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const { setMode } = useStore()

  useEffect(() => {
    terminalRef.current?.scrollTo(0, terminalRef.current.scrollHeight)
  }, [history])

  useEffect(() => {
    // Welcome message
    if (history.length === 0) {
      addHistory('Welcome to Gemini Web Wrapper')
      addHistory('Type /help for available commands')
      addHistory('')
    }
  }, [])

  const addHistory = (line: string) => {
    setHistory(prev => [...prev, line])
  }

  const handleCommand = (cmd: string) => {
    addHistory(`$ ${cmd}`)
    
    const trimmed = cmd.trim()
    if (!trimmed) return

    const [command, ...args] = trimmed.split(/\s+/)

    switch (command) {
      case '/help':
        showHelp()
        break
      
      case '/clear':
        setHistory([])
        break
      
      case '/editor':
        setMode('editor')
        break
      
      case '/tool':
        setMode('tool')
        break
      
      case '/config':
        // Open config overlay
        addHistory('Opening configuration...')
        break
      
      case '/chat':
        if (args[0] === 'demo') {
          (setMode as (mode: 'chat-demo') => void)('chat-demo')
        }
        break
      
      default:
        addHistory(`Unknown command: ${command}`)
        addHistory('Type /help for available commands')
    }
  }

  const showHelp = () => {
    const commands = [
      { cmd: '/help', desc: 'Show this help message' },
      { cmd: '/clear', desc: 'Clear terminal history' },
      { cmd: '/editor', desc: 'Switch to code editor mode' },
      { cmd: '/tool', desc: 'Switch to file transfer tools' },
      { cmd: '/config', desc: 'Open configuration panel' },
      { cmd: '/chat demo', desc: 'Open chat widget demo' },
      { cmd: '/open <path>', desc: 'Load file from GitHub' },
      { cmd: '/new <path>', desc: 'Create new file with template' },
      { cmd: '/ls [path]', desc: 'List files in directory' },
      { cmd: '/cat <path>', desc: 'Show file contents' },
      { cmd: '/apply', desc: 'Apply AI changes to editor' },
      { cmd: '/diff', desc: 'Show differences' },
      { cmd: '/revert', desc: 'Revert to original' },
      { cmd: '/commit "msg"', desc: 'Commit changes to GitHub' },
      { cmd: '/branch <name>', desc: 'Switch Git branch' },
      { cmd: '/model <id>', desc: 'Switch AI model' },
      { cmd: '/save', desc: 'Save current file locally' },
      { cmd: '/tokens', desc: 'Estimate token usage' },
    ]

    addHistory('━━━ Available Commands ━━━')
    addHistory('')
    commands.forEach(({ cmd, desc }) => {
      addHistory(`  ${cmd.padEnd(20)} ${desc}`)
    })
    addHistory('')
    addHistory('━━━━━━━━━━━━━━━━━━━━━━━━━')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (input.trim()) {
        handleCommand(input)
        setInput('')
        setHistoryIndex(-1)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        // Would need to store command history separately
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > -1) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        if (newIndex === -1) {
          setInput('')
        }
      }
    }
  }

  return (
    <div className="cli-container">
      {/* Header */}
      <div className="cli-header">
        <div className="cli-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4 17 10 11 4 5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
          </svg>
          Gemini Terminal
        </div>
        <div className="cli-actions">
          <button 
            onClick={() => setMode('editor')} 
            className="btn btn-secondary"
            title="Switch to Editor"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Editor
          </button>
          <button 
            onClick={() => setHistory([])} 
            className="btn btn-ghost"
            title="Clear Terminal"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <div 
        ref={terminalRef}
        className="terminal-output"
        onClick={() => inputRef.current?.focus()}
      >
        {history.map((line, i) => (
          <div key={i} className="terminal-line">
            {line}
          </div>
        ))}
        
        {/* Cursor */}
        <div className="terminal-line" style={{ display: 'flex', alignItems: 'center', marginTop: '0.5rem' }}>
          <span className="terminal-prompt">$</span>
          <span style={{ marginLeft: '0.75rem', opacity: 0.7 }}>{input}</span>
          <span 
            style={{ 
              display: 'inline-block',
              width: '0.5rem',
              height: '1rem',
              backgroundColor: 'var(--color-primary)',
              marginLeft: '0.125rem',
              animation: 'blink 1s infinite'
            }} 
          />
        </div>
      </div>

      {/* Input */}
      <div className="terminal-input-container">
        <span className="terminal-prompt">$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="terminal-input"
          placeholder="Type a command... (try /help)"
          autoFocus
        />
      </div>

      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
