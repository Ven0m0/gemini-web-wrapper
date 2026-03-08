// WebSocket Server with File Transfer Support (Node.js)
// Save as websocket-server.js and run with: node websocket-server.js

const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port });

console.log(`WebSocket server running on ws://localhost:${port}`);
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
            data: `Process exited with code ${code}`,
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
            data: `File uploaded: ${filename} (${data.fileSize} bytes)`,
            timestamp: Date.now()
          }));

          console.log(`File uploaded: ${filepath}`);

        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            data: `Upload failed: ${error.message}`,
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

            console.log(`File downloaded: ${filename}`);

          } else {
            ws.send(JSON.stringify({
              type: 'error',
              data: `File not found: ${filename}`,
              timestamp: Date.now()
            }));
          }
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            data: `Download failed: ${error.message}`,
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
