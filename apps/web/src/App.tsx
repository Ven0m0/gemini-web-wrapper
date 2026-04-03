import { useEffect } from 'react'
import { useStore } from './store'
import type { AppMode } from './store'
import { CLI } from './components/CLI'
import { Editor } from './components/Editor'
import { Tool } from './components/Tool'
import { ConfigOverlay } from './components/ConfigOverlay'
import { InstallPrompt } from './components/InstallPrompt'
import { WebShell } from './components/WebShell'
import { PythonRunner } from './components/PythonRunner'
import { ChatDemo } from './components/ChatDemo'
import { OpenRouterChat } from './components/OpenRouterChat'
import './App.css'

const NAV_ITEMS: { id: AppMode; label: string; icon: React.ReactNode }[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: 'cli',
    label: 'Terminal',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
  },
  {
    id: 'editor',
    label: 'Editor',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  {
    id: 'tool',
    label: 'Files',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  {
    id: 'python',
    label: 'Python',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  {
    id: 'wsh',
    label: 'Shell',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
]

const MODE_LABELS: Record<AppMode, string> = {
  chat: 'chat',
  cli: 'terminal',
  editor: 'editor',
  tool: 'files',
  python: 'python',
  wsh: 'shell',
  'chat-demo': 'chat-demo',
}

function App() {
  const { mode, setMode, setConfig } = useStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    const savedConfig = localStorage.getItem('chat-github-config')
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig))
      } catch {
        // silently ignore invalid config JSON in localStorage
      }
    }
  }, [setConfig])

  const renderContent = () => {
    switch (mode) {
      case 'cli':        return <CLI />
      case 'editor':     return <Editor />
      case 'tool':       return <Tool />
      case 'wsh':        return <WebShell />
      case 'python':     return <PythonRunner />
      case 'chat-demo':  return <ChatDemo />
      case 'chat':
      default:           return <OpenRouterChat />
    }
  }

  return (
    <div className="app">
      {/* Activity Bar */}
      <aside className="activity-bar" role="navigation" aria-label="Main navigation">
        {NAV_ITEMS.map(({ id, label, icon }) => (
          <button
            key={id}
            className={`activity-btn ${mode === id ? 'active' : ''}`}
            onClick={() => setMode(id)}
            aria-label={label}
            title={label}
          >
            {icon}
          </button>
        ))}
        <div className="activity-spacer" />
        <button
          className="activity-btn"
          onClick={() => useStore.getState().setShowConfig(true)}
          aria-label="Settings"
          title="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </aside>

      {/* Main content */}
      <div className="app-main">
        <div className="app-content">
          {renderContent()}
        </div>

        {/* Status Bar */}
        <div className="app-status-bar" role="status" aria-live="polite">
          <div className="status-item accent">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <circle cx="5" cy="5" r="4" />
            </svg>
            gemini-web-wrapper
          </div>
          <div className="status-divider" />
          <div className="status-item">
            {MODE_LABELS[mode as AppMode] ?? mode}
          </div>
          <div className="status-spacer" />
          <div className="status-item">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            PWA
          </div>
        </div>
      </div>

      <ConfigOverlay />
      <InstallPrompt />
    </div>
  )
}

export default App
