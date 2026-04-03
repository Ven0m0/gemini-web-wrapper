import React, { useState } from 'react'
import { useStore } from '../store'
import type { ProviderName } from '../store'

const PROVIDER_MODELS: Record<ProviderName, { id: string; name: string }[]> = {
  gemini: [
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Recommended)' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Recommended)' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
  ],
}

export const ConfigOverlay: React.FC = () => {
  const { config, setConfig, setShowConfig, showConfig } = useStore()
  const [localConfig, setLocalConfig] = useState(config)
  const [showTokens, setShowTokens] = useState(false)

  const handleSave = () => {
    setConfig(localConfig)

    const hasCredentials =
      localConfig.githubToken ||
      localConfig.openaiKey ||
      localConfig.geminiKey ||
      localConfig.anthropicKey

    if (hasCredentials) {
      const shouldSave = window.confirm(
        'Save credentials to localStorage for future sessions? ' +
        '(Not recommended on shared devices)'
      )

      if (shouldSave) {
        localStorage.setItem('chat-github-config', JSON.stringify({
          githubToken: localConfig.githubToken,
          openaiKey: localConfig.openaiKey,
          geminiKey: localConfig.geminiKey,
          anthropicKey: localConfig.anthropicKey,
          provider: localConfig.provider,
          owner: localConfig.owner,
          repo: localConfig.repo,
          branch: localConfig.branch,
          model: localConfig.model,
          temperature: localConfig.temperature,
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
      } catch {
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

  const availableModels = PROVIDER_MODELS[localConfig.provider] ?? PROVIDER_MODELS.gemini

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
            <h3>AI Provider Settings</h3>

            <div className="config-field">
              <label>Server API Key</label>
              <input
                type={showTokens ? 'text' : 'password'}
                value={localConfig.openaiKey}
                onChange={(e) => setLocalConfig({ ...localConfig, openaiKey: e.target.value })}
                placeholder="Backend gateway key (leave blank if server is in open mode)"
              />
              <small>Only needed when the server requires gateway authentication.</small>
            </div>

            <div className="config-field">
              <label>Provider</label>
              <select
                value={localConfig.provider}
                onChange={(e) => {
                  const p = e.target.value as ProviderName
                  // Always reset model to the first option for the new provider
                  // to avoid carrying over an incompatible model from the prior provider.
                  const firstModel = PROVIDER_MODELS[p]?.[0]?.id ?? 'gemini-2.0-flash-exp'
                  setLocalConfig({ ...localConfig, provider: p, model: firstModel })
                }}
              >
                <option value="gemini">Google Gemini</option>
                <option value="anthropic">Anthropic Claude</option>
              </select>
            </div>

            {localConfig.provider === 'gemini' && (
              <div className="config-field">
                <label>Gemini API Key</label>
                <input
                  type={showTokens ? 'text' : 'password'}
                  value={localConfig.geminiKey}
                  onChange={(e) => setLocalConfig({ ...localConfig, geminiKey: e.target.value })}
                  placeholder="AIza..."
                />
                <small>
                  Get a key at{' '}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                    aistudio.google.com/apikey
                  </a>
                </small>
              </div>
            )}

            {localConfig.provider === 'anthropic' && (
              <div className="config-field">
                <label>Anthropic API Key</label>
                <input
                  type={showTokens ? 'text' : 'password'}
                  value={localConfig.anthropicKey}
                  onChange={(e) => setLocalConfig({ ...localConfig, anthropicKey: e.target.value })}
                  placeholder="sk-ant-..."
                />
                <small>
                  Get a key at{' '}
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">
                    console.anthropic.com
                  </a>
                </small>
              </div>
            )}

            <div className="config-field">
              <label>Model</label>
              <select
                value={localConfig.model}
                onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
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
            <h3>Privacy &amp; Security</h3>
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
              <li>Provider API keys are sent only to this app's backend, never to third parties directly</li>
              <li>GitHub token needs "Contents: Write" permission for your repository</li>
              <li>Use fine-grained tokens when possible (limited to specific repos)</li>
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
