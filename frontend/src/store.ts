import { create } from 'zustand'

export interface FileState {
  original: string
  current: string
  sha: string
  dirty: boolean
}

export interface AIState {
  lastInstruction: string
  lastAIContent: string
  pending: boolean
}

export interface ConfigState {
  githubToken: string
  openaiKey: string
  owner: string
  repo: string
  branch: string
  path: string
  model: string
  temperature: number
}

export interface WebSocketState {
  connected: boolean
  url: string
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  messages: Array<{
    type: 'stdin' | 'stdout' | 'stderr' | 'command' | 'status' | 'error' | 'file_upload' | 'file_download' | 'file_data'
    data: string
    timestamp: number
    filename?: string
    fileSize?: number
    isBase64?: boolean
  }>
}

export interface AppState {
  mode: 'cli' | 'editor' | 'tool'
  file: FileState
  ai: AIState
  config: ConfigState
  history: string[]
  showConfig: boolean
  websocket: WebSocketState
  webShell: {
    prepared?: string
  }
}

interface AppStore extends AppState {
  setMode: (mode: 'cli' | 'editor' | 'tool') => void
  setFile: (file: Partial<FileState>) => void
  setAI: (ai: Partial<AIState>) => void
  setConfig: (config: Partial<ConfigState>) => void
  addHistory: (message: string) => void
  clearHistory: () => void
  setShowConfig: (show: boolean) => void
  resetFile: () => void
  setWebSocket: (ws: Partial<WebSocketState>) => void
  addWebSocketMessage: (message: WebSocketState['messages'][0]) => void
  clearWebSocketMessages: () => void
  setWebShell: (ws: Partial<AppState['webShell']>) => void
}

const initialFile: FileState = {
  original: '',
  current: '',
  sha: '',
  dirty: false
}

const initialAI: AIState = {
  lastInstruction: '',
  lastAIContent: '',
  pending: false
}

const initialConfig: ConfigState = {
  githubToken: '',
  openaiKey: '',
  owner: '',
  repo: '',
  branch: 'main',
  path: '',
  model: 'gpt-4o-mini',
  temperature: 0.3
}

const initialWebSocket: WebSocketState = {
  connected: false,
  url: '',
  status: 'disconnected',
  messages: []
}

export const useStore = create<AppStore>((set) => ({
  mode: 'cli',
  file: initialFile,
  ai: initialAI,
  config: initialConfig,
  history: [],
  showConfig: false,
  websocket: initialWebSocket,
  webShell: {},

  setMode: (mode) => set({ mode }),
  
  setFile: (file) => set((state) => ({
    file: { ...state.file, ...file }
  })),
  
  setAI: (ai) => set((state) => ({
    ai: { ...state.ai, ...ai }
  })),
  
  setConfig: (config) => set((state) => ({
    config: { ...state.config, ...config }
  })),
  
  addHistory: (message) => set((state) => ({
    history: [...state.history, message]
  })),
  
  clearHistory: () => set({ history: [] }),
  
  setShowConfig: (show) => set({ showConfig: show }),
  
  resetFile: () => set({
    file: initialFile
  }),

  setWebSocket: (ws) => set((state) => ({
    websocket: { ...state.websocket, ...ws }
  })),

  addWebSocketMessage: (message) => set((state) => ({
    websocket: {
      ...state.websocket,
      messages: [...state.websocket.messages.slice(-99), message] // Keep last 100 messages
    }
  })),

  clearWebSocketMessages: () => set((state) => ({
    websocket: { ...state.websocket, messages: [] }
  })),

  setWebShell: (ws) => set((state) => ({
    webShell: { ...state.webShell, ...ws }
  }))
}))
