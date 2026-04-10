import React, { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import {
  ensureModelSelection,
  ensureProviderSelection,
  getProviderById,
  migrateProviderSelections,
  migrateSavedConfig,
  type ProviderConfig,
} from '../services/providers'

interface ConfigOverlayProps {
  /**
   * When true, renders as a full-page inline settings view instead of a
   * floating modal overlay.  Use this for the dedicated Settings tab.
   */
  inline?: boolean
}

function formatRepositoryInput(owner: string, repo: string): string {
  return [owner.trim(), repo.trim()].filter(Boolean).join('/')
}

function parseRepositoryInput(value: string): { owner: string; repo: string } {
  const normalized = value
    .trim()
    .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/^\/+|\/+$/g, '')

  const [owner = '', repo = ''] = normalized.split('/').filter(Boolean)
  return { owner, repo }
}

function createProviderId(providers: ProviderConfig[]): string {
  let counter = providers.filter((provider) => !provider.builtin).length + 1
  let providerId = `custom-provider-${counter}`

  while (providers.some((provider) => provider.id === providerId)) {
    counter += 1
    providerId = `custom-provider-${counter}`
  }

  return providerId
}

export const ConfigOverlay: React.FC<ConfigOverlayProps> = ({ inline = false }) => {
  const { config, setConfig, setShowConfig, showConfig } = useStore()
  const [localConfig, setLocalConfig] = useState(() => migrateSavedConfig(config))
  const [temperatureInput, setTemperatureInput] = useState(() => String(config.temperature))
  const [repoInput, setRepoInput] = useState(() => formatRepositoryInput(config.owner, config.repo))
  const [showTokens, setShowTokens] = useState(false)
  const [rememberCredentials, setRememberCredentials] = useState(() => Boolean(localStorage.getItem('chat-github-config')))
  /** Brief confirmation shown in inline mode after a successful save. */
  const [showSavedMessage, setShowSavedMessage] = useState(false)
  const [storageMessage, setStorageMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const migratedConfig = migrateSavedConfig(config)
    setLocalConfig(migratedConfig)
    setTemperatureInput(String(migratedConfig.temperature))
    setRepoInput(formatRepositoryInput(migratedConfig.owner, migratedConfig.repo))
  }, [config])

  const selectedProvider = useMemo(
    () => getProviderById(localConfig.providers, localConfig.provider),
    [localConfig.provider, localConfig.providers]
  )
  const otherProviderIds = useMemo(
    () => new Set(
      localConfig.providers
        .filter((provider) => provider.id !== selectedProvider?.id)
        .map((provider) => provider.id)
    ),
    [localConfig.providers, selectedProvider?.id]
  )

  const setProviders = (providers: ProviderConfig[], nextProviderId = localConfig.provider, nextModelId = localConfig.model) => {
    const provider = ensureProviderSelection(nextProviderId, providers)
    const model = ensureModelSelection(provider, nextModelId, providers)
    setLocalConfig({ ...localConfig, providers, provider, model })
  }

  const updateProvider = (providerId: string, updater: (provider: ProviderConfig) => ProviderConfig) => {
    const providers = localConfig.providers.map((provider) =>
      provider.id === providerId ? updater(provider) : provider
    )
    setProviders(providers)
  }

  const handleSelectProvider = (providerId: string) => {
    const provider = getProviderById(localConfig.providers, providerId)
    setProviders(localConfig.providers, providerId, provider?.models[0]?.id)
  }

  const handleAddProvider = () => {
    const providerId = createProviderId(localConfig.providers)
    const providers = [
      ...localConfig.providers,
      {
        id: providerId,
        name: `Custom Provider ${localConfig.providers.filter((provider) => !provider.builtin).length + 1}`,
        apiKey: '',
        baseUrl: '',
        models: [{ id: 'gpt-4o-mini', name: 'Default Model', uid: crypto.randomUUID() }],
      },
    ]
    setProviders(providers, providerId, 'gpt-4o-mini')
  }

  const handleRemoveProvider = () => {
    if (!selectedProvider || selectedProvider.builtin) {
      return
    }

    if (!window.confirm(`Remove provider "${selectedProvider.name}"?`)) {
      return
    }

    const providers = localConfig.providers.filter((provider) => provider.id !== selectedProvider.id)
    setProviders(providers)
  }

  const handleSave = () => {
    const parsedRepo = parseRepositoryInput(repoInput)
    if (repoInput.trim() && (!parsedRepo.owner || !parsedRepo.repo)) {
      setStorageMessage({ tone: 'error', text: 'Invalid repository format. Expected owner/repo, for example facebook/react.' })
      return
    }

    const normalized = migrateProviderSelections({
      ...localConfig,
      owner: parsedRepo.owner,
      repo: parsedRepo.repo,
      branch: localConfig.branch.trim() || 'main',
    })
    setConfig(normalized)

    if (rememberCredentials) {
      localStorage.setItem('chat-github-config', JSON.stringify({
        githubToken: normalized.githubToken,
        openaiKey: normalized.openaiKey,
        providers: normalized.providers,
        provider: normalized.provider,
        owner: normalized.owner,
        repo: normalized.repo,
        branch: normalized.branch,
        model: normalized.model,
        temperature: normalized.temperature,
      }))
    } else {
      localStorage.removeItem('chat-github-config')
    }

    setStorageMessage({
      tone: 'success',
      text: normalized.owner && normalized.repo
        ? `Saved ${normalized.owner}/${normalized.repo}. The file tree and repo index will refresh automatically.`
        : 'Configuration saved for this session.',
    })

    if (inline) {
      setShowSavedMessage(true)
      setTimeout(() => setShowSavedMessage(false), 2000)
    } else {
      setShowConfig(false)
    }
  }

  const handleCancel = () => {
    const migratedConfig = migrateSavedConfig(config)
    setLocalConfig(migratedConfig)
    setTemperatureInput(String(migratedConfig.temperature))
    setRepoInput(formatRepositoryInput(migratedConfig.owner, migratedConfig.repo))
    setStorageMessage(null)
    if (!inline) {
      setShowConfig(false)
    }
  }

  const handleLoadFromStorage = () => {
    const saved = localStorage.getItem('chat-github-config')
    if (saved) {
      try {
        const parsedConfig = migrateSavedConfig({
          ...localConfig,
          ...JSON.parse(saved),
        })
        setLocalConfig(parsedConfig)
        setTemperatureInput(String(parsedConfig.temperature))
        setRepoInput(formatRepositoryInput(parsedConfig.owner, parsedConfig.repo))
        setRememberCredentials(true)
        setStorageMessage({ tone: 'success', text: 'Loaded saved configuration from local storage.' })
      } catch {
        setStorageMessage({ tone: 'error', text: 'Failed to load the saved configuration.' })
      }
    } else {
      setStorageMessage({ tone: 'error', text: 'No saved configuration found in local storage.' })
    }
  }

  const handleClearStorage = () => {
    localStorage.removeItem('chat-github-config')
    setRememberCredentials(false)
    setStorageMessage({ tone: 'success', text: 'Cleared the saved configuration from local storage.' })
  }

  const availableModels = selectedProvider?.models ?? []

  if (!inline && !showConfig) return null

  const formBody = (
    <div className="config-content">
      <div className="config-section">
        <h3>GitHub Settings</h3>
        <div className="config-field">
          <label>Repository</label>
          <input
            type="text"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="owner/repository"
          />
          <small>Pick a repo once and the workspace will load its tree and start indexing automatically.</small>
        </div>

        <div className="config-field-row">
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

        <div className="config-field">
          <label>GitHub Token</label>
          <input
            type={showTokens ? 'text' : 'password'}
            value={localConfig.githubToken}
            onChange={(e) => setLocalConfig({ ...localConfig, githubToken: e.target.value })}
            placeholder="ghp_xxxx... (fine-grained token with contents:write)"
          />
          <small>Needed for browsing private repos and for backend indexing through the GitHub API.</small>
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={localConfig.provider}
              onChange={(e) => handleSelectProvider(e.target.value)}
              style={{ flex: 1 }}
            >
              {localConfig.providers.map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.name}</option>
              ))}
            </select>
            <button type="button" onClick={handleAddProvider} className="config-action-btn">
              Add Provider
            </button>
          </div>
          <small>
            Built-in providers include native adapters plus preset gateway endpoints like OpenCode Zen and
            Kilo Gateway. Custom providers use OpenAI-compatible
            <code style={{ marginLeft: 4 }}>/chat/completions</code>
            endpoints, similar to OpenCode custom providers.
          </small>
        </div>

        {selectedProvider && (
          <>
            {!selectedProvider.builtin && (
              <>
                <div className="config-field">
                  <label>Provider Name</label>
                  <input
                    type="text"
                    value={selectedProvider.name}
                    onChange={(e) => updateProvider(selectedProvider.id, (provider) => ({
                      ...provider,
                      name: e.target.value,
                    }))}
                    placeholder="My AI Provider"
                  />
                </div>

                <div className="config-field">
                  <label>Provider ID</label>
                  <input
                    type="text"
                    value={selectedProvider.id}
                    onChange={(e) => {
                      const nextId = e.target.value.trim()
                      if (!nextId || otherProviderIds.has(nextId)) {
                        return
                      }

                      const providers = localConfig.providers.map((provider) =>
                        provider.id === selectedProvider.id ? { ...provider, id: nextId } : provider
                      )
                      setProviders(providers, nextId)
                    }}
                    placeholder="myprovider"
                  />
                  <small>Used as the provider identifier sent to the backend.</small>
                </div>
              </>
            )}

            <div className="config-field">
              <label>{selectedProvider.builtin ? 'Custom Base URL (optional)' : 'Base URL'}</label>
              <input
                type="text"
                value={selectedProvider.baseUrl}
                onChange={(e) => updateProvider(selectedProvider.id, (provider) => ({
                  ...provider,
                  baseUrl: e.target.value,
                }))}
                placeholder={selectedProvider.builtin ? 'https://proxy.example.com/v1' : 'https://api.myprovider.com/v1'}
              />
              <small>
                {selectedProvider.builtin
                  ? 'Leave blank to use the provider default endpoint.'
                  : 'Required for custom OpenAI-compatible providers.'}
              </small>
            </div>

            <div className="config-field">
              <label>{selectedProvider.name} API Key</label>
              <input
                type={showTokens ? 'text' : 'password'}
                value={selectedProvider.apiKey}
                onChange={(e) => updateProvider(selectedProvider.id, (provider) => ({
                  ...provider,
                  apiKey: e.target.value,
                }))}
                placeholder={selectedProvider.builtin ? 'Provider API key' : 'Optional for local/open endpoints'}
              />
            </div>

            <div className="config-field">
              <label>Model</label>
              <select
                value={localConfig.model}
                onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
              >
                {availableModels.map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </div>

            {!selectedProvider.builtin && (
              <div className="config-field">
                <label>Custom Models</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedProvider.models.map((model, index) => (
                    <div key={model.uid ?? `${selectedProvider.id}-${model.id}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        value={model.id}
                        onChange={(e) => updateProvider(selectedProvider.id, (provider) => ({
                          ...provider,
                          models: provider.models.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, id: e.target.value } : entry
                          ),
                        }))}
                        placeholder="model-id"
                      />
                      <input
                        type="text"
                        value={model.name}
                        onChange={(e) => updateProvider(selectedProvider.id, (provider) => ({
                          ...provider,
                          models: provider.models.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, name: e.target.value } : entry
                          ),
                        }))}
                        placeholder="Display name"
                      />
                      <button
                        type="button"
                        className="config-action-btn danger"
                        onClick={() => updateProvider(selectedProvider.id, (provider) => {
                          const models = provider.models.filter((_, entryIndex) => entryIndex !== index)
                          return {
                            ...provider,
                            models: models.length > 0 ? models : [{ id: 'gpt-4o-mini', name: 'Default Model', uid: crypto.randomUUID() }],
                          }
                        })}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="config-action-btn"
                      onClick={() => updateProvider(selectedProvider.id, (provider) => ({
                        ...provider,
                        models: [
                          ...provider.models,
                          {
                            id: `model-${provider.models.length + 1}`,
                            name: `Model ${provider.models.length + 1}`,
                            uid: crypto.randomUUID(),
                          },
                        ],
                      }))}
                    >
                      Add Model
                    </button>
                    <button
                      type="button"
                      className="config-action-btn danger"
                      onClick={handleRemoveProvider}
                    >
                      Remove Provider
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="config-field">
          <label>Temperature</label>
          <input
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={temperatureInput}
            onChange={(e) => {
              const nextValue = e.target.value
              setTemperatureInput(nextValue)
              if (nextValue.trim() === '') {
                return
              }
              const nextTemperature = Number.parseFloat(nextValue)
              if (!Number.isNaN(nextTemperature)) {
                setLocalConfig({
                  ...localConfig,
                  temperature: nextTemperature,
                })
              }
            }}
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
              checked={rememberCredentials}
              onChange={(e) => setRememberCredentials(e.target.checked)}
            />
            Remember credentials in local storage on this device
          </label>
        </div>
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
        {storageMessage && (
          <div className={`config-status ${storageMessage.tone}`}>
            {storageMessage.text}
          </div>
        )}
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
  )

  if (inline) {
    return (
      <div className="settings-view">
        <div className="settings-view-header">
          <h2 className="settings-view-title">Settings</h2>
          {showSavedMessage && <span className="settings-saved-badge">✓ Saved</span>}
        </div>

        <div className="settings-view-body">
          {formBody}
        </div>

        <div className="settings-view-footer">
          <button onClick={handleSave} className="config-btn primary">
            Save Configuration
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="config-overlay">
      <div className="config-modal">
        <div className="config-header">
          <h2>Configuration</h2>
          <button onClick={handleCancel} className="config-close">×</button>
        </div>

        {formBody}

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
