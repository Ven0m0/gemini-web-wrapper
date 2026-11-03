import { errorMessage } from '../utils/error';
export interface WebSocketMessage {
  type: 'stdin' | 'stdout' | 'stderr' | 'command' | 'status' | 'error' | 'file_upload' | 'file_download' | 'file_data';
  data: string;
  timestamp: number;
  filename?: string;
  fileSize?: number;
  isBase64?: boolean;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private shouldReconnect: boolean = true;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private onMessage: (message: WebSocketMessage) => void;
  private onStatusChange: (
    status: 'connecting' | 'connected' | 'disconnected' | 'error',
    errorContext?: Error | string
  ) => void;

  constructor(
    url: string,
    onMessage: (message: WebSocketMessage) => void,
    onStatusChange: (
      status: 'connecting' | 'connected' | 'disconnected' | 'error',
      errorContext?: Error | string
    ) => void
  ) {
    this.url = url;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.shouldReconnect = true;
        this.onStatusChange('connecting');
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.onStatusChange('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.onMessage(message);
          } catch (error) {
            const detail = errorMessage(error);
            this.onMessage({
              type: 'error',
              data: `Invalid message format: ${event.data}. Error: ${detail}`,
              timestamp: Date.now(),
            });
          }
        };

        this.ws.onclose = () => {
          this.onStatusChange('disconnected');
          if (this.shouldReconnect) {
            this.attemptReconnect();
          }
        };

        this.ws.onerror = (error) => {
          this.onStatusChange('error', error instanceof Error ? error : String(error));
          reject(new Error(`WebSocket connection failed: ${error}`));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    if (!this.shouldReconnect || this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (!this.shouldReconnect) return;
      this.connect().catch((error) => {
        this.onStatusChange(
          'error',
          `Reconnect attempt ${this.reconnectAttempts} failed: ${errorMessage(error)}`
        );
      });
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  sendStdin(data: string): void {
    this.sendMessage({
      type: 'stdin',
      data,
      timestamp: Date.now(),
    });
  }

  sendCommand(command: string): void {
    this.sendMessage({
      type: 'command',
      data: command,
      timestamp: Date.now(),
    });
  }

  sendFileUpload(filename: string, content: string, isBase64: boolean = false): void {
    this.sendMessage({
      type: 'file_upload',
      data: content,
      filename,
      fileSize: content.length,
      isBase64,
      timestamp: Date.now(),
    });
  }

  requestFileDownload(filename: string): void {
    this.sendMessage({
      type: 'file_download',
      data: filename,
      filename,
      timestamp: Date.now(),
    });
  }

  private sendMessage(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket is not connected');
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getReadyState(): string {
    if (!this.ws) return 'CLOSED';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'OPEN';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }
}

type StatusHandler = ConstructorParameters<typeof WebSocketService>[2];

/** Keyed set of WebSocketService connections; a single-connection caller just uses one fixed id. */
export class WebSocketConnections {
  private services = new Map<string, WebSocketService>();

  get(id: string): WebSocketService | undefined {
    return this.services.get(id);
  }

  has(id: string): boolean {
    return this.services.has(id);
  }

  /** Replaces any existing connection for `id`; on failure the entry is dropped and the error rethrown. */
  async connect(
    id: string,
    url: string,
    onMessage: (message: WebSocketMessage) => void,
    onStatusChange: StatusHandler
  ): Promise<void> {
    this.disconnect(id);
    const service = new WebSocketService(url, onMessage, onStatusChange);
    this.services.set(id, service);
    try {
      await service.connect();
    } catch (error) {
      if (this.services.get(id) === service) this.services.delete(id);
      throw error;
    }
  }

  disconnect(id: string): void {
    // Delete first so status callbacks fired by close() see the id as already removed.
    const service = this.services.get(id);
    this.services.delete(id);
    service?.disconnect();
  }

  disconnectAll(): void {
    for (const id of Array.from(this.services.keys())) this.disconnect(id);
  }
}
