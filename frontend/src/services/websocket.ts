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

// WebSocket server creation utility (for documentation/example)
export const createWebSocketServer = (port: number = 8080): string => {
  return `
# WebSocket Server with File Transfer Support (Node.js)
# Save as websocket-server.js and run with: node websocket-server.js

const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const wss = new WebSocket.Server({ port: ${port} });

console.log(\`WebSocket server running on ws://localhost:${port}\`);
console.log('Supports: Commands, File Upload/Download');

// File storage directory
const filesDir = './websocket_files';
if (!fs.existsSync(filesDir)) {
  fs.mkdirSync(filesDir);
}

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  let currentProcess = null;
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'command') {
        // Kill existing process
        if (currentProcess) {
          currentProcess.kill();
        }
        
        // Start new process
        const [cmd, ...args] = data.data.split(' ');
        currentProcess = spawn(cmd, args, { 
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true 
        });
        
        // Forward stdout
        currentProcess.stdout.on('data', (chunk) => {
          ws.send(JSON.stringify({
            type: 'stdout',
            data: chunk.toString(),
            timestamp: Date.now()
          }));
        });
        
        // Forward stderr
        currentProcess.stderr.on('data', (chunk) => {
          ws.send(JSON.stringify({
            type: 'stderr',
            data: chunk.toString(),
            timestamp: Date.now()
          }));
        });
        
        // Handle process exit
        currentProcess.on('close', (code) => {
          ws.send(JSON.stringify({
            type: 'status',
            data: \`Process exited with code \${code}\`,
            timestamp: Date.now()
          }));
          currentProcess = null;
        });
        
      } else if (data.type === 'stdin' && currentProcess) {
        // Send input to process
        currentProcess.stdin.write(data.data);
        
      } else if (data.type === 'file_upload') {
        // Handle file upload
        const filename = data.filename || 'uploaded_file';
        const filepath = path.join(filesDir, filename);
        
        try {
          let fileContent;
          if (data.isBase64) {
            // Binary file - decode base64
            fileContent = Buffer.from(data.data, 'base64');
          } else {
            // Text file
            fileContent = data.data;
          }
          
          fs.writeFileSync(filepath, fileContent);
          
          ws.send(JSON.stringify({
            type: 'status',
            data: \`File uploaded: \${filename} (\${data.fileSize} bytes)\`,
            timestamp: Date.now()
          }));
          
          console.log(\`File uploaded: \${filepath}\`);
          
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            data: \`Upload failed: \${error.message}\`,
            timestamp: Date.now()
          }));
        }
        
      } else if (data.type === 'file_download') {
        // Handle file download request
        const filename = data.data;
        const filepath = path.join(filesDir, filename);
        
        try {
          if (fs.existsSync(filepath)) {
            const stats = fs.statSync(filepath);
            let content;
            let isBase64 = false;
            
            // Determine if file is binary
            const ext = path.extname(filename).toLowerCase();
            const textExtensions = ['.txt', '.md', '.json', '.js', '.ts', '.css', '.html', '.xml', '.csv'];
            const isTextFile = textExtensions.includes(ext);
            
            if (isTextFile) {
              content = fs.readFileSync(filepath, 'utf8');
            } else {
              // Binary file - encode as base64
              content = fs.readFileSync(filepath).toString('base64');
              isBase64 = true;
            }
            
            ws.send(JSON.stringify({
              type: 'file_data',
              data: content,
              filename: filename,
              fileSize: stats.size,
              isBase64: isBase64,
              timestamp: Date.now()
            }));
            
            console.log(\`File downloaded: \${filename}\`);
            
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              data: \`File not found: \${filename}\`,
              timestamp: Date.now()
            }));
          }
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            data: \`Download failed: \${error.message}\`,
            timestamp: Date.now()
          }));
        }
      }
      
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        data: error.message,
        timestamp: Date.now()
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    if (currentProcess) {
      currentProcess.kill();
    }
  });
});
`;
}