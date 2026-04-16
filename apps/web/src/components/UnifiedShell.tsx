import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useStore } from '../store';
import { persistShellState, createShellProfile, type ShellProfile, type ShellState } from '../services/shell';
import { WebSocketService, type WebSocketMessage } from '../services/websocket';
import { GhosttyTerminal, type GhosttyTerminalChunk } from './GhosttyTerminal';
import { WebShell } from './WebShell';
import './UnifiedShell.css';

interface ShellDraft {
  name: string;
  url: string;
  description: string;
}

interface ShellMessage {
  id: number;
  preview: string;
  terminalText: string;
  timestamp: number;
  tone: 'default' | 'error' | 'status';
}

interface ShellSession {
  profileId: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  messages: ShellMessage[];
  preview: string;
  input: string;
  needsAttention: boolean;
}

const MAX_GRID_PANES = 4;

const QUICK_ACTIONS = [
  { id: 'enter', label: '↵', payload: '\n' },
  { id: 'esc', label: 'Esc', payload: '\u001B' },
  { id: 'tab', label: 'Tab', payload: '\t' },
  { id: 'up', label: '↑', payload: '\u001B[A' },
  { id: 'down', label: '↓', payload: '\u001B[B' },
  { id: 'ctrlc', label: 'Ctrl+C', payload: '\u0003' },
  { id: 'git-status', label: 'git status', payload: 'git status\n' },
];

function createDraft(values?: Partial<ShellDraft>): ShellDraft {
  return {
    name: values?.name ?? '',
    url: values?.url ?? '',
    description: values?.description ?? '',
  };
}

function createEmptySession(profileId: string): ShellSession {
  return {
    profileId,
    status: 'disconnected',
    messages: [],
    preview: 'No output yet',
    input: '',
    needsAttention: false,
  };
}

function sanitizePreview(value: string): string {
  const flattened = value.replace(/\s+/g, ' ').trim();
  if (!flattened) {
    return 'Waiting for output';
  }

  return flattened.slice(0, 100);
}

function formatTerminalText(type: WebSocketMessage['type'] | 'local-status', value: string): string {
  switch (type) {
    case 'status':
    case 'local-status':
      return `\r\n[status] ${value}\r\n`;
    case 'error':
      return `\r\n[error] ${value}\r\n`;
    default:
      return value;
  }
}

function buildGridClassName(count: number): string {
  if (count <= 1) return 'shell-grid shell-grid-single';
  if (count === 2) return 'shell-grid shell-grid-double';
  return 'shell-grid shell-grid-quad';
}

function clampFontSize(value: number): number {
  return Math.min(22, Math.max(12, value));
}

export function UnifiedShell() {
  const { shell, setShell, config, websocket } = useStore();
  const [draft, setDraft] = useState<ShellDraft>(createDraft());
  const [draftError, setDraftError] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [gridProfileIds, setGridProfileIds] = useState<string[]>([]);
  const [sessionState, setSessionState] = useState<Record<string, ShellSession>>({});
  const [showWasmShell, setShowWasmShell] = useState(false);
  const serviceRefs = useRef<Record<string, WebSocketService>>({});
  const nextMessageIdRef = useRef(0);

  const repoLabel = config.owner && config.repo ? `${config.owner}/${config.repo}` : 'Workspace';

  const updatePersistedShell = useCallback(
    (nextShell: ShellState) => {
      setShell(nextShell);
      persistShellState(nextShell);
    },
    [setShell]
  );

  const updateShellPreferences = useCallback(
    (preferences: Partial<ShellState['preferences']>) => {
      updatePersistedShell({
        ...shell,
        preferences: {
          ...shell.preferences,
          ...preferences,
        },
      });
    },
    [shell, updatePersistedShell]
  );

  const updateSession = useCallback((profileId: string, updater: (current: ShellSession) => ShellSession) => {
    setSessionState((current) => ({
      ...current,
      [profileId]: updater(current[profileId] ?? createEmptySession(profileId)),
    }));
  }, []);

  const clearAttention = useCallback(
    (profileId: string) => {
      updateSession(profileId, (current) => ({ ...current, needsAttention: false }));
    },
    [updateSession]
  );

  const addSessionMessage = useCallback(
    (profileId: string, type: WebSocketMessage['type'] | 'local-status', value: string) => {
      const preview = sanitizePreview(value);
      const tone =
        type === 'error' || type === 'stderr'
          ? 'error'
          : type === 'status' || type === 'local-status'
            ? 'status'
            : 'default';
      const message: ShellMessage = {
        id: nextMessageIdRef.current,
        preview,
        terminalText: formatTerminalText(type, value),
        timestamp: Date.now(),
        tone,
      };

      nextMessageIdRef.current += 1;
      updateSession(profileId, (current) => ({
        ...current,
        messages: [...current.messages.slice(-399), message],
        preview,
        needsAttention: current.needsAttention || tone === 'error',
      }));
    },
    [updateSession]
  );

  const triggerHaptics = useCallback(() => {
    if (shell.preferences.enableHaptics && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(8);
    }
  }, [shell.preferences.enableHaptics]);

  const disconnectProfile = useCallback(
    (profileId: string, quiet = false) => {
      serviceRefs.current[profileId]?.disconnect();
      delete serviceRefs.current[profileId];
      updateSession(profileId, (current) => ({
        ...current,
        status: 'disconnected',
        needsAttention: quiet ? current.needsAttention : false,
      }));
      if (!quiet) {
        addSessionMessage(profileId, 'local-status', 'Disconnected');
      }
    },
    [addSessionMessage, updateSession]
  );

  const connectProfile = useCallback(
    async (profile: ShellProfile) => {
      disconnectProfile(profile.id, true);
      updateSession(profile.id, (current) => ({
        ...current,
        status: 'connecting',
        needsAttention: false,
      }));

      const service = new WebSocketService(
        profile.url,
        (message) => {
          if (message.type === 'file_upload' || message.type === 'file_download' || message.type === 'file_data') {
            return;
          }

          addSessionMessage(profile.id, message.type, message.data);
        },
        (status, errorContext) => {
          updateSession(profile.id, (current) => ({
            ...current,
            status,
            needsAttention: status === 'error' ? true : current.needsAttention,
          }));

          if (status === 'connected') {
            addSessionMessage(profile.id, 'local-status', `Connected to ${profile.url}`);
          } else if (status === 'disconnected' && serviceRefs.current[profile.id]) {
            addSessionMessage(profile.id, 'local-status', `Connection dropped for ${profile.name}`);
          } else if (status === 'error' && errorContext) {
            addSessionMessage(
              profile.id,
              'error',
              errorContext instanceof Error ? errorContext.message : String(errorContext)
            );
          }
        }
      );

      serviceRefs.current[profile.id] = service;

      try {
        await service.connect();
        clearAttention(profile.id);
      } catch (error) {
        delete serviceRefs.current[profile.id];
        updateSession(profile.id, (current) => ({
          ...current,
          status: 'error',
          needsAttention: true,
        }));
        addSessionMessage(profile.id, 'error', error instanceof Error ? error.message : String(error));
      }
    },
    [addSessionMessage, clearAttention, disconnectProfile, updateSession]
  );

  const sendInput = useCallback(
    (profileId: string, payload: string) => {
      const service = serviceRefs.current[profileId];
      if (!service) {
        addSessionMessage(profileId, 'error', 'Connect this session before sending input.');
        return;
      }

      try {
        service.sendStdin(payload);
        triggerHaptics();
      } catch (error) {
        addSessionMessage(profileId, 'error', error instanceof Error ? error.message : String(error));
      }
    },
    [addSessionMessage, triggerHaptics]
  );

  const activeProfiles = useMemo(
    () =>
      gridProfileIds
        .map((profileId) => shell.profiles.find((profile) => profile.id === profileId))
        .filter((profile): profile is ShellProfile => profile !== undefined),
    [gridProfileIds, shell.profiles]
  );

  useEffect(() => {
    setGridProfileIds((current) => {
      const valid = current.filter((profileId) => shell.profiles.some((profile) => profile.id === profileId));
      if (valid.length > 0) {
        return valid.slice(0, MAX_GRID_PANES);
      }

      return shell.profiles[0] ? [shell.profiles[0].id] : [];
    });
  }, [shell.profiles]);

  useEffect(
    () => () => {
      Object.values(serviceRefs.current).forEach((service) => service.disconnect());
    },
    []
  );

  useEffect(() => {
    setSessionState((current) => {
      const nextEntries = Object.entries(current).filter(([profileId]) =>
        shell.profiles.some((profile) => profile.id === profileId)
      );
      return Object.fromEntries(nextEntries);
    });
  }, [shell.profiles]);

  const beginNewProfile = () => {
    setEditingProfileId(null);
    setDraft(
      createDraft({
        name: repoLabel,
        url: websocket.url,
        description: config.path ? `Working path: ${config.path}` : '',
      })
    );
    setDraftError('');
  };

  const beginEditProfile = (profile: ShellProfile) => {
    setEditingProfileId(profile.id);
    setDraft(createDraft(profile));
    setDraftError('');
  };

  const resetDraft = () => {
    setEditingProfileId(null);
    setDraft(createDraft());
    setDraftError('');
  };

  const saveProfile = () => {
    const url = draft.url.trim();
    if (!url) {
      setDraftError('Enter a WebSocket URL to save a shell profile.');
      return;
    }

    const duplicateProfile = shell.profiles.find((profile) => profile.url === url && profile.id !== editingProfileId);
    if (duplicateProfile) {
      setDraftError(`"${duplicateProfile.name}" already uses ${url}.`);
      return;
    }

    if (editingProfileId) {
      const nextProfiles = shell.profiles.map((profile) =>
        profile.id === editingProfileId
          ? { ...profile, name: draft.name.trim() || profile.name, url, description: draft.description.trim() }
          : profile
      );
      updatePersistedShell({ ...shell, profiles: nextProfiles });
      resetDraft();
      return;
    }

    const nextProfile = createShellProfile({
      name: draft.name || repoLabel,
      url,
      description: draft.description,
    });
    updatePersistedShell({
      ...shell,
      profiles: [...shell.profiles, nextProfile],
    });
    setGridProfileIds((current) => [...current, nextProfile.id].slice(0, MAX_GRID_PANES));
    resetDraft();
  };

  const removeProfile = (profileId: string) => {
    disconnectProfile(profileId, true);
    updatePersistedShell({
      ...shell,
      profiles: shell.profiles.filter((profile) => profile.id !== profileId),
    });
    setGridProfileIds((current) => current.filter((id) => id !== profileId));
    if (editingProfileId === profileId) {
      resetDraft();
    }
  };

  const toggleGridPane = (profileId: string) => {
    setGridProfileIds((current) => {
      if (current.includes(profileId)) {
        return current.filter((id) => id !== profileId);
      }

      return [...current, profileId].slice(0, MAX_GRID_PANES);
    });
  };

  const setSessionInput = (profileId: string, value: string) => {
    updateSession(profileId, (current) => ({ ...current, input: value }));
  };

  const submitCommand = (profileId: string) => {
    const currentSession = sessionState[profileId] ?? createEmptySession(profileId);
    const command = currentSession.input.trim();
    if (!command) {
      return;
    }

    sendInput(profileId, `${command}\n`);
    updateSession(profileId, (current) => ({
      ...current,
      input: '',
    }));
  };

  const clearTranscript = (profileId: string) => {
    updateSession(profileId, (current) => ({
      ...current,
      messages: [],
      preview: 'Transcript cleared',
      needsAttention: false,
    }));
  };

  return (
    <div className="shell-workspace">
      <div className="shell-toolbar">
        <div className="shell-toolbar-group">
          <button
            type="button"
            className={`shell-chip ${shell.preferences.terminalMode === 'ghostty' ? 'active' : ''}`}
            onClick={() => updateShellPreferences({ terminalMode: 'ghostty' })}
          >
            Ghostty mode
          </button>
          <button
            type="button"
            className={`shell-chip ${shell.preferences.terminalMode === 'classic' ? 'active' : ''}`}
            onClick={() => updateShellPreferences({ terminalMode: 'classic' })}
          >
            Classic mode
          </button>
          <button
            type="button"
            className="shell-chip"
            onClick={() => updateShellPreferences({ fontSize: clampFontSize(shell.preferences.fontSize - 1) })}
          >
            A-
          </button>
          <span className="shell-toolbar-text">{shell.preferences.fontSize}px</span>
          <button
            type="button"
            className="shell-chip"
            onClick={() => updateShellPreferences({ fontSize: clampFontSize(shell.preferences.fontSize + 1) })}
          >
            A+
          </button>
        </div>

        <div className="shell-toolbar-group">
          <button
            type="button"
            className={`shell-chip ${shell.preferences.showAccessoryBar ? 'active' : ''}`}
            onClick={() => updateShellPreferences({ showAccessoryBar: !shell.preferences.showAccessoryBar })}
          >
            Accessory bar
          </button>
          <button
            type="button"
            className={`shell-chip ${shell.preferences.enableHaptics ? 'active' : ''}`}
            onClick={() => updateShellPreferences({ enableHaptics: !shell.preferences.enableHaptics })}
          >
            Haptics
          </button>
          <button
            type="button"
            className={`shell-chip ${showWasmShell ? 'active' : ''}`}
            onClick={() => setShowWasmShell((current) => !current)}
          >
            {showWasmShell ? 'Hide' : 'Show'} webassembly.sh
          </button>
        </div>
      </div>

      <div className="shell-layout">
        <aside className="shell-sidebar">
          <div className="shell-sidebar-header">
            <div>
              <h2>Saved shells</h2>
              <p>Wolfpack-style launch cards with reconnect and grid controls.</p>
            </div>
            <button type="button" className="shell-primary-button" onClick={beginNewProfile}>
              New shell
            </button>
          </div>

          <div className="shell-profile-form">
            <input
              type="text"
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="Profile name"
            />
            <input
              type="text"
              value={draft.url}
              onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
              placeholder="ws://localhost:8080"
            />
            <textarea
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder="Optional notes"
            />
            {draftError && <div className="shell-inline-error">{draftError}</div>}
            <div className="shell-profile-form-actions">
              <button type="button" className="shell-primary-button" onClick={saveProfile}>
                {editingProfileId ? 'Update profile' : 'Save profile'}
              </button>
              <button type="button" className="shell-secondary-button" onClick={resetDraft}>
                Reset
              </button>
            </div>
          </div>

          {shell.profiles.length === 0 ? (
            <div className="shell-empty-state">
              <strong>No shells saved yet.</strong>
              <span>
                Save a WebSocket endpoint to get multi-session panes, Ghostty rendering, and quick mobile actions.
              </span>
            </div>
          ) : (
            <div className="shell-profile-list">
              {shell.profiles.map((profile) => {
                const session = sessionState[profile.id] ?? createEmptySession(profile.id);
                const inGrid = gridProfileIds.includes(profile.id);

                return (
                  <article
                    key={profile.id}
                    className={`shell-profile-card ${session.needsAttention ? 'attention' : ''}`}
                  >
                    <div className="shell-profile-title-row">
                      <div>
                        <strong>{profile.name}</strong>
                        <span>{profile.url}</span>
                      </div>
                      <span className={`shell-status-badge shell-status-${session.status}`}>{session.status}</span>
                    </div>
                    {profile.description && <p>{profile.description}</p>}
                    <div className="shell-profile-preview">{session.preview}</div>
                    <div className="shell-profile-actions">
                      <button
                        type="button"
                        className="shell-secondary-button"
                        onClick={() => toggleGridPane(profile.id)}
                      >
                        {inGrid ? 'Remove from grid' : 'Add to grid'}
                      </button>
                      {session.status === 'connected' || session.status === 'connecting' ? (
                        <button
                          type="button"
                          className="shell-secondary-button"
                          onClick={() => disconnectProfile(profile.id)}
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="shell-primary-button"
                          onClick={() => void connectProfile(profile)}
                        >
                          Connect
                        </button>
                      )}
                      <button
                        type="button"
                        className="shell-secondary-button"
                        onClick={() => beginEditProfile(profile)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="shell-secondary-button"
                        onClick={() => removeProfile(profile.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </aside>

        <section className="shell-main">
          <div className="shell-main-header">
            <div>
              <h2>Session grid</h2>
              <p>Pin up to four saved shells side-by-side and switch between lightweight and Ghostty terminals.</p>
            </div>
            <div className="shell-toolbar-text">
              {activeProfiles.length} / {MAX_GRID_PANES} panes active
            </div>
          </div>

          {activeProfiles.length === 0 ? (
            <div className="shell-empty-state shell-empty-state-large">
              <strong>No shell panes selected.</strong>
              <span>Add a saved shell to the grid to start a Wolfpack-style session board.</span>
            </div>
          ) : (
            <div className={buildGridClassName(activeProfiles.length)}>
              {activeProfiles.map((profile) => {
                const session = sessionState[profile.id] ?? createEmptySession(profile.id);
                const terminalChunks: GhosttyTerminalChunk[] = session.messages.map((message) => ({
                  id: message.id,
                  data: message.terminalText,
                }));
                const classicTranscript = session.messages.map((message) => message.terminalText).join('');

                return (
                  <article
                    key={`${profile.id}-${shell.preferences.terminalMode}-${shell.preferences.fontSize}`}
                    className={`shell-pane ${session.needsAttention ? 'attention' : ''}`}
                    onClick={() => clearAttention(profile.id)}
                  >
                    <header className="shell-pane-header">
                      <div>
                        <h3>{profile.name}</h3>
                        <span>{profile.url}</span>
                      </div>
                      <div className="shell-pane-header-actions">
                        <span className={`shell-status-badge shell-status-${session.status}`}>{session.status}</span>
                        {session.status === 'connected' || session.status === 'connecting' ? (
                          <button
                            type="button"
                            className="shell-secondary-button"
                            onClick={() => disconnectProfile(profile.id)}
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="shell-primary-button"
                            onClick={() => void connectProfile(profile)}
                          >
                            Connect
                          </button>
                        )}
                        <button
                          type="button"
                          className="shell-secondary-button"
                          onClick={() => clearTranscript(profile.id)}
                        >
                          Clear
                        </button>
                      </div>
                    </header>

                    <div className="shell-pane-preview">
                      <span>{session.preview}</span>
                    </div>

                    <div className="shell-pane-body">
                      {shell.preferences.terminalMode === 'ghostty' ? (
                        <GhosttyTerminal
                          chunks={terminalChunks}
                          fontSize={shell.preferences.fontSize}
                          active
                          onData={(data) => sendInput(profile.id, data)}
                        />
                      ) : (
                        <pre
                          className={`shell-classic-terminal shell-font-${session.messages.length > 0 ? 'ready' : 'empty'}`}
                          style={{ fontSize: `${shell.preferences.fontSize}px` }}
                        >
                          {classicTranscript ||
                            'Connected output will appear here.\nUse the input box below or the accessory bar to interact with the session.'}
                        </pre>
                      )}
                    </div>

                    {shell.preferences.showAccessoryBar && (
                      <div className="shell-accessory-bar">
                        {QUICK_ACTIONS.map((action) => (
                          <button
                            key={action.id}
                            type="button"
                            className="shell-accessory-button"
                            disabled={session.status !== 'connected'}
                            onClick={() => sendInput(profile.id, action.payload)}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <form
                      className="shell-input-row"
                      onSubmit={(event) => {
                        event.preventDefault();
                        submitCommand(profile.id);
                      }}
                    >
                      <input
                        type="text"
                        value={session.input}
                        onChange={(event) => setSessionInput(profile.id, event.target.value)}
                        placeholder={
                          session.status === 'connected' ? 'Type a command and press Enter' : 'Connect to start typing'
                        }
                        disabled={session.status !== 'connected'}
                      />
                      <button type="submit" className="shell-primary-button" disabled={session.status !== 'connected'}>
                        Send
                      </button>
                    </form>
                  </article>
                );
              })}
            </div>
          )}

          {showWasmShell && (
            <section className="shell-wasm-panel">
              <div className="shell-main-header">
                <div>
                  <h2>webassembly.sh fallback</h2>
                  <p>
                    Keep the old browser shell available when you want a standalone sandbox tab beside the new grid.
                  </p>
                </div>
              </div>
              <WebShell />
            </section>
          )}
        </section>
      </div>
    </div>
  );
}
