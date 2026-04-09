import React, { useState } from 'react'
import { CLI } from './CLI'
import { PythonRunner } from './PythonRunner'
import { WebShell } from './WebShell'

type ShellTab = 'terminal' | 'python' | 'wasm'

const TAB_LABELS: Record<ShellTab, string> = {
  terminal: '⌨ Terminal',
  python: '🐍 Python',
  wasm: '🧪 WASM Shell',
}

export const UnifiedShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ShellTab>('terminal')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--color-border, #333)',
        background: 'var(--color-bg-surface, #1e1e1e)',
        flexShrink: 0,
      }}>
        {(Object.keys(TAB_LABELS) as ShellTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 16px',
              fontSize: 13,
              fontWeight: activeTab === tab ? 600 : 400,
              background: activeTab === tab
                ? 'var(--color-bg, #121212)'
                : 'transparent',
              color: activeTab === tab
                ? 'var(--color-text, #ddd)'
                : 'var(--color-text-muted, #888)',
              border: 'none',
              borderBottom: activeTab === tab
                ? '2px solid var(--color-accent, #007acc)'
                : '2px solid transparent',
              cursor: 'pointer',
              outline: 'none',
              transition: 'color 0.15s, border-bottom 0.15s',
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content — keep all panels mounted to preserve state (e.g. Pyodide runtime) */}
      <div style={{ flex: 1, overflow: 'hidden', display: activeTab === 'terminal' ? 'flex' : 'none', flexDirection: 'column' }}>
        <CLI />
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: activeTab === 'python' ? 'flex' : 'none', flexDirection: 'column' }}>
        <PythonRunner />
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: activeTab === 'wasm' ? 'flex' : 'none', flexDirection: 'column' }}>
        <WebShell />
      </div>
    </div>
  )
}
