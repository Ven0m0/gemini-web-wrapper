import React, { useState } from 'react'
import { useStore } from '../store'

export const ConfigOverlay: React.FC = () => {
  const { config, setConfig, setShowConfig, showConfig } = useStore()
  const [localConfig, setLocalConfig] = useState(config)
  const [showTokens, setShowTokens] = useState(false)

  const handleSave = () => {
    setConfig(localConfig)
    
    if (localConfig.githubToken || localConfig.openaiKey) {
      const shouldSave = window.confirm(
        'Save credentials to localStorage for future sessions? ' +
        '(Not recommended on shared devices)'
      )
      
      if (shouldSave) {
        localStorage.setItem('chat-github-config', JSON.stringify({
          githubToken: localConfig.githubToken,
          openaiKey: localConfig.openaiKey,
          owner: localConfig.owner,
          repo: localConfig.repo,
          branch: localConfig.branch,
          model: localConfig.model,
          temperature: localConfig.temperature
        }))
      }
    }
    
    setShowConfig(false)
  }

  const handleCancel = () => {
    setLocalConfig(config)
    setShowConfig(false)
  }

  const handleLoadFromStorage = () => {
    const saved = localStorage.getItem('chat-github-config')
    if (saved) {
      try {
        const parsedConfig = JSON.parse(saved)
        setLocalConfig({ ...localConfig, ...parsedConfig })
      } catch (error) {
        alert('Failed to load saved configuration')
      }
    } else {
      alert('No saved configuration found')
    }
  }

  const handleClearStorage = () => {
    if (window.confirm('Clear all saved configuration?')) {
      localStorage.removeItem('chat-github-config')
      alert('Configuration cleared from storage')
    }
  }

  if (!showConfig) return null

  return (
    <div className="config-overlay">
      <div className="config-modal">
        <div className="config-header">
          <h2>Configuration</h2>
          <button onClick={handleCancel} className="config-close">×</button>
        </div>

        <div className="config-content">
          <div className="config-section">
            <h3>GitHub Settings</h3>
            <div className="config-field">
              <label>GitHub Token</label>
              <input
                type={showTokens ? 'text' : 'password'}
                value={localConfig.githubToken}
                onChange={(e) => setLocalConfig({ ...localConfig, githubToken: e.target.value })}
                placeholder="ghp_xxxx... (fine-grained token with contents:write)"
              />
            </div>
            
            <div className="config-field">
              <label>Owner</label>
              <input
                type="text"
                value={localConfig.owner}
                onChange={(e) => setLocalConfig({ ...localConfig, owner: e.target.value })}
                placeholder="username or organization"
              />
            </div>
            
            <div className="config-field">
              <label>Repository</label>
              <input
                type="text"
                value={localConfig.repo}
                onChange={(e) => setLocalConfig({ ...localConfig, repo: e.target.value })}
                placeholder="repository-name"
              />
            </div>
            
            <div className="config-field">
              <label>Branch</label>
              <input
                type="text"
                value={localConfig.branch}
                onChange={(e) => setLocalConfig({ ...localConfig, branch: e.target.value })}
                placeholder="main"
              />
            </div>
          </div>

          <div className="config-section">
            <h3>AI Settings</h3>
            <div className="config-field">
              <label>OpenAI API Key</label>
              <input
                type={showTokens ? 'text' : 'password'}
                value={localConfig.openaiKey}
                onChange={(e) => setLocalConfig({ ...localConfig, openaiKey: e.target.value })}
                placeholder="sk-xxxx..."
              />
            </div>
            
            <div className="config-field">
              <label>Model</label>
              <select
                value={localConfig.model}
                onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
              >
                <option value="gpt-5">GPT-5 (Latest)</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini (Recommended)</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </select>
            </div>
            
            <div className="config-field">
              <label>Temperature</label>
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={localConfig.temperature}
                onChange={(e) => setLocalConfig({ ...localConfig, temperature: parseFloat(e.target.value) })}
              />
              <small>0 = deterministic, 2 = very creative</small>
            </div>
          </div>

          <div className="config-section">
            <h3>Current Session</h3>
            <div className="config-field">
              <label>File Path</label>
              <input
                type="text"
                value={localConfig.path}
                onChange={(e) => setLocalConfig({ ...localConfig, path: e.target.value })}
                placeholder="src/index.ts"
              />
            </div>
          </div>

          <div className="config-section">
            <h3>Privacy & Security</h3>
            <div className="config-field">
              <label>
                <input
                  type="checkbox"
                  checked={showTokens}
                  onChange={(e) => setShowTokens(e.target.checked)}
                />
                Show tokens in plain text
              </label>
            </div>
            
            <div className="config-actions">
              <button onClick={handleLoadFromStorage} className="config-action-btn">
                Load from Storage
              </button>
              <button onClick={handleClearStorage} className="config-action-btn danger">
                Clear Storage
              </button>
            </div>
          </div>

          <div className="config-help">
            <h4>Security Notes:</h4>
            <ul>
              <li>GitHub token needs "Contents: Write" permission for your repository</li>
              <li>Use fine-grained tokens when possible (limited to specific repos)</li>
              <li>Never share your tokens or commit them to code</li>
              <li>Tokens are sent only to official APIs (GitHub/OpenAI)</li>
              <li>Clear storage when using shared devices</li>
            </ul>
          </div>
        </div>

        <div className="config-footer">
          <button onClick={handleCancel} className="config-btn secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="config-btn primary">
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  )
}