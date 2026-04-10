import { useEffect } from 'react'
import { useStore } from './store'
import type { AppMode } from './store'
import { UnifiedShell } from './components/UnifiedShell'
import { Editor } from './components/Editor'
import { Tool } from './components/Tool'
import { ConfigOverlay } from './components/ConfigOverlay'
import { InstallPrompt } from './components/InstallPrompt'
import { ChatDemo } from './components/ChatDemo'
import { OpenRouterChat } from './components/OpenRouterChat'
import { migrateSavedConfig } from './services/providers'
import './App.css'

/** Settings gear icon — extracted so it can be reused in both the sidebar
 *  button and the mobile nav without duplicating the SVG markup. */
const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

interface NavItem {
  id: AppMode
  label: string
  icon: React.ReactNode
  /** Whether this item appears in the mobile bottom nav bar. */
  mobileVisible: boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'chat',
    label: 'Chat',
    mobileVisible: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: 'shell',
    label: 'Shell',
    mobileVisible: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
  },
  {
    id: 'editor',
    label: 'Editor',
    mobileVisible: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  {
    id: 'tool',
    label: 'Files',
    mobileVisible: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
]

const MODE_LABELS: Record<AppMode, string> = {
  chat: 'chat',
  shell: 'shell',
  editor: 'editor',
  tool: 'files',
  'chat-demo': 'chat-demo',
  settings: 'settings',
}

function App() {
  const { mode, setMode, setConfig, config, repoIndexStatus } = useStore()
  const repoLabel = config.owner && config.repo ? `${config.owner}/${config.repo}` : ''
  const repoIndexClassName = repoIndexStatus?.status === 'indexed'
    ? 'success'
    : repoIndexStatus?.status === 'error'
      ? 'error'
      : repoIndexStatus?.status === 'indexing'
        ? 'primary'
        : ''

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    const savedConfig = localStorage.getItem('chat-github-config')
    if (savedConfig) {
      try {
        setConfig(migrateSavedConfig(JSON.parse(savedConfig)))
      } catch {
        // silently ignore invalid config JSON in localStorage
      }
    }
  }, [setConfig])

  const renderContent = () => {
    switch (mode) {
      case 'shell':       return <UnifiedShell />
      case 'editor':     return <Editor />
      case 'tool':       return <Tool />
      case 'chat-demo':  return <ChatDemo />
      case 'settings':   return <ConfigOverlay inline />
      case 'chat':
      default:           return <OpenRouterChat />
    }
  }

  /** Items shown in the mobile bottom nav — the mobileVisible subset + Settings. */
  const mobileNavItems = NAV_ITEMS.filter((item) => item.mobileVisible)

  return (
    <div className="app">
      {/* ── Activity Bar (narrow left icon rail, desktop only) ── */}
      <aside className="activity-bar" role="navigation" aria-label="Main navigation">
        {NAV_ITEMS.map(({ id, label, icon }) => (
          <button
            key={id}
            className={`activity-btn ${mode === id ? 'active' : ''}`}
            onClick={() => setMode(id)}
            aria-label={label}
            aria-current={mode === id ? 'page' : undefined}
            title={label}
          >
            {icon}
          </button>
        ))}

        {/* Settings pinned to bottom of sidebar */}
        <div className="activity-spacer" />
        <button
          className={`activity-btn ${mode === 'settings' ? 'active' : ''}`}
          onClick={() => setMode('settings')}
          aria-label="Settings"
          aria-current={mode === 'settings' ? 'page' : undefined}
          title="Settings"
        >
          <SettingsIcon />
        </button>
      </aside>

      {/* ── Main content ──────────────────────────────────────── */}
      <div className="app-main">
        <div className="app-content">
          {renderContent()}
        </div>

        {/* ── Mobile navigation bar (hidden on desktop via CSS) ─ */}
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {mobileNavItems.map(({ id, label, icon }) => (
            <button
              key={id}
              className={`mobile-nav-btn ${mode === id ? 'active' : ''}`}
              onClick={() => setMode(id)}
              aria-label={label}
              aria-current={mode === id ? 'page' : undefined}
            >
              {icon}
              <span className="mobile-nav-label">{label}</span>
            </button>
          ))}
          {/* Settings always visible in the mobile nav */}
          <button
            className={`mobile-nav-btn ${mode === 'settings' ? 'active' : ''}`}
            onClick={() => setMode('settings')}
            aria-label="Settings"
            aria-current={mode === 'settings' ? 'page' : undefined}
          >
            <SettingsIcon />
            <span className="mobile-nav-label">Settings</span>
          </button>
        </nav>

        {/* ── Status Bar (22px strip, hidden on mobile) ─────── */}
        <div className="app-status-bar" role="status" aria-live="polite">
          <div className="status-item accent">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="5" r="4" />
            </svg>
            gemini-web-wrapper
          </div>
          <div className="status-divider" />
          <div className="status-item">
            {MODE_LABELS[mode as AppMode] ?? mode}
          </div>
          {repoLabel && (
            <>
              <div className="status-divider" />
              <div className="status-item">
                {repoLabel} · {config.branch}
              </div>
            </>
          )}
          {repoIndexStatus && (
            <>
              <div className="status-divider" />
              <div className={`status-item ${repoIndexClassName}`.trim()}>
                index {repoIndexStatus.status} · {repoIndexStatus.indexed_files} files
              </div>
            </>
          )}
          <div className="status-spacer" />
          <div className="status-item">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            PWA
          </div>
        </div>
      </div>

      {/* Modal overlay — kept for programmatic setShowConfig(true) calls */}
      <ConfigOverlay />
      <InstallPrompt />
    </div>
  )
}

export default App
