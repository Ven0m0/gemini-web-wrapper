import { create } from 'zustand';
import {
  createDefaultProviders,
  DEFAULT_MODEL_ID,
  DEFAULT_PROVIDER_ID,
  type ProviderConfig,
} from './services/providers';
import { createDefaultShellState, type ShellState } from './services/shell';
import type { RepoIndexStatus } from './services/repoIndex';

export interface FileState {
  original: string;
  current: string;
  sha: string;
  dirty: boolean;
}

export interface AIState {
  lastInstruction: string;
  lastAIContent: string;
  pending: boolean;
}

export interface ConfigState {
  githubToken: string;
  /** Server gateway API key sent in Authorization header. */
  openaiKey: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  model: string;
  temperature: number;
  /** Selected provider ID used for the current model request. */
  provider: string;
  /** User-managed provider definitions and credentials. */
  providers: ProviderConfig[];
}

export interface WebSocketState {
  connected: boolean;
  url: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  messages: Array<{
    type:
      | 'stdin'
      | 'stdout'
      | 'stderr'
      | 'command'
      | 'status'
      | 'error'
      | 'file_upload'
      | 'file_download'
      | 'file_data';
    data: string;
    timestamp: number;
    filename?: string;
    fileSize?: number;
    isBase64?: boolean;
  }>;
}

export type AppMode = 'shell' | 'editor' | 'tool' | 'chat-demo' | 'chat' | 'settings' | 'agent';

export interface AppState {
  mode: AppMode;
  file: FileState;
  ai: AIState;
  config: ConfigState;
  shell: ShellState;
  repoIndexStatus: RepoIndexStatus | null;
  history: string[];
  showConfig: boolean;
  websocket: WebSocketState;
  webShell: {
    prepared?: string;
  };
}

interface AppStore extends AppState {
  setMode: (mode: AppMode) => void;
  setFile: (file: Partial<FileState>) => void;
  setAI: (ai: Partial<AIState>) => void;
  setConfig: (config: Partial<ConfigState>) => void;
  setShell: (shell: Partial<ShellState>) => void;
  setRepoIndexStatus: (status: RepoIndexStatus | null) => void;
  addHistory: (message: string) => void;
  clearHistory: () => void;
  setShowConfig: (show: boolean) => void;
  resetFile: () => void;
  setWebSocket: (ws: Partial<WebSocketState>) => void;
  addWebSocketMessage: (message: WebSocketState['messages'][0]) => void;
  clearWebSocketMessages: () => void;
  setWebShell: (ws: Partial<AppState['webShell']>) => void;
}

const initialFile: FileState = {
  original: '',
  current: '',
  sha: '',
  dirty: false,
};

const initialAI: AIState = {
  lastInstruction: '',
  lastAIContent: '',
  pending: false,
};

const initialConfig: ConfigState = {
  githubToken: '',
  openaiKey: '',
  owner: '',
  repo: '',
  branch: 'main',
  path: '',
  model: DEFAULT_MODEL_ID,
  temperature: 0.3,
  provider: DEFAULT_PROVIDER_ID,
  providers: createDefaultProviders(),
};

const initialShell = createDefaultShellState();

const initialWebSocket: WebSocketState = {
  connected: false,
  url: '',
  status: 'disconnected',
  messages: [],
};

export const useStore = create<AppStore>((set) => ({
  mode: 'chat',
  file: initialFile,
  ai: initialAI,
  config: initialConfig,
  shell: initialShell,
  repoIndexStatus: null,
  history: [],
  showConfig: false,
  websocket: initialWebSocket,
  webShell: {},

  setMode: (mode) => set({ mode }),

  setFile: (file) =>
    set((state) => ({
      file: { ...state.file, ...file },
    })),

  setAI: (ai) =>
    set((state) => ({
      ai: { ...state.ai, ...ai },
    })),

  setConfig: (config) =>
    set((state) => ({
      config: { ...state.config, ...config },
    })),

  setShell: (shell) =>
    set((state) => ({
      shell: {
        ...state.shell,
        ...shell,
        profiles: shell.profiles ?? state.shell.profiles,
        preferences: { ...state.shell.preferences, ...shell.preferences },
      },
    })),

  setRepoIndexStatus: (repoIndexStatus) => set({ repoIndexStatus }),

  addHistory: (message) =>
    set((state) => ({
      history: [...state.history, message],
    })),

  clearHistory: () => set({ history: [] }),

  setShowConfig: (show) => set({ showConfig: show }),

  resetFile: () =>
    set({
      file: initialFile,
    }),

  setWebSocket: (ws) =>
    set((state) => ({
      websocket: { ...state.websocket, ...ws },
    })),

  addWebSocketMessage: (message) =>
    set((state) => ({
      websocket: {
        ...state.websocket,
        messages: [...state.websocket.messages.slice(-99), message], // Keep last 100 messages
      },
    })),

  clearWebSocketMessages: () =>
    set((state) => ({
      websocket: { ...state.websocket, messages: [] },
    })),

  setWebShell: (ws) =>
    set((state) => ({
      webShell: { ...state.webShell, ...ws },
    })),
}));
