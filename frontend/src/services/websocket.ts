interface WebSocketMessage {
  type: 'stdin' | 'stdout' | 'stderr' | 'command' | 'status' | 'error' | 'file_upload' | 'file_download' | 'file_data'
  data: string
  timestamp: number
  filename?: string
  fileSize?: number
  isBase64?: boolean
}

export class WebSocketService {
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private reconnectDelay: number = 1000
  private onMessage: (message: WebSocketMessage) => void
  private onStatusChange: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void

  constructor(
    url: string,
    onMessage: (message: WebSocketMessage) => void,
    onStatusChange: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void
  ) {
    this.url = url
    this.onMessage = onMessage
    this.onStatusChange = onStatusChange
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.onStatusChange('connecting')
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          this.reconnectAttempts = 0
          this.onStatusChange('connected')
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data)
            this.onMessage(message)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
            this.onMessage({
              type: 'error',
              data: `Invalid message format: ${event.data}`,
              timestamp: Date.now()
            })
          }
        }

        this.ws.onclose = () => {
          this.onStatusChange('disconnected')
          this.attemptReconnect()
        }

        this.ws.onerror = (error) => {
          this.onStatusChange('error')
          console.error('WebSocket error:', error)
          reject(new Error(`WebSocket connection failed: ${error}`))
        }

      } catch (error) {
        reject(error)
      }
    })
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      setTimeout(() => {
        this.connect().catch(error => {
          console.error(`Reconnect attempt ${this.reconnectAttempts} failed:`, error)
        })
      }, this.reconnectDelay * this.reconnectAttempts)
    }
  }

  sendStdin(data: string): void {
    this.sendMessage({
      type: 'stdin',
      data,
      timestamp: Date.now()
    })
  }

  sendCommand(command: string): void {
    this.sendMessage({
      type: 'command',
      data: command,
      timestamp: Date.now()
    })
  }

  sendFileUpload(filename: string, content: string, isBase64: boolean = false): void {
    this.sendMessage({
      type: 'file_upload',
      data: content,
      filename,
      fileSize: content.length,
      isBase64,
      timestamp: Date.now()
    })
  }

  requestFileDownload(filename: string): void {
    this.sendMessage({
      type: 'file_download',
      data: filename,
      filename,
      timestamp: Date.now()
    })
  }

  private sendMessage(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      throw new Error('WebSocket is not connected')
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  getReadyState(): string {
    if (!this.ws) return 'CLOSED'
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING'
      case WebSocket.OPEN: return 'OPEN'
      case WebSocket.CLOSING: return 'CLOSING'
      case WebSocket.CLOSED: return 'CLOSED'
      default: return 'UNKNOWN'
    }
  }
}

