#!/usr/bin/env node

// WebSocket Server with File Transfer Support
// Usage: node server.js
// Connect from PWA: /socket connect ws://localhost:8080

import WebSocket, { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

console.log(`🚀 WebSocket server running on ws://localhost:${PORT}`);
console.log('📁 Supports: Commands, File Upload/Download');
console.log('🔧 Use Ctrl+C to stop server\n');

// File storage directory
const filesDir = './websocket_files';
if (!fs.existsSync(filesDir)) {
  fs.mkdirSync(filesDir);
  console.log(`📂 Created files directory: ${filesDir}`);
}

let clientCount = 0;

wss.on('connection', (ws, request) => {
  clientCount++;
  const clientId = `Client-${clientCount}`;
  const clientIP = request.socket.remoteAddress;
  
  console.log(`✅ ${clientId} connected from ${clientIP}`);
  
  let currentProcess = null;
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'status',
    data: `Connected to WebSocket server. Client ID: ${clientId}`,
    timestamp: Date.now()
  }));
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`📨 ${clientId} -> ${data.type}: ${data.data?.substring(0, 50)}${data.data?.length > 50 ? '...' : ''}`);
      
      if (data.type === 'command') {
        // Handle command execution
        if (currentProcess) {
          currentProcess.kill();
        }
        
        const [cmd, ...args] = data.data.split(' ');
        console.log(`🔧 ${clientId} executing: ${data.data}`);
        
        currentProcess = spawn(cmd, args, { 
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true 
        });
        
        // Forward stdout
        currentProcess.stdout.on('data', (chunk) => {
          const output = chunk.toString();
          ws.send(JSON.stringify({
            type: 'stdout',
            data: output,
            timestamp: Date.now()
          }));
        });
        
        // Forward stderr
        currentProcess.stderr.on('data', (chunk) => {
          const output = chunk.toString();
          ws.send(JSON.stringify({
            type: 'stderr',
            data: output,
            timestamp: Date.now()
          }));
        });
        
        // Handle process exit
        currentProcess.on('close', (code) => {
          ws.send(JSON.stringify({
            type: 'status',
            data: `Process "${data.data}" exited with code ${code}`,
            timestamp: Date.now()
          }));
          currentProcess = null;
          console.log(`🏁 ${clientId} process exited: ${code}`);
        });
        
      } else if (data.type === 'stdin' && currentProcess) {
        // Send input to running process
        currentProcess.stdin.write(data.data);
        
      } else if (data.type === 'file_upload') {
        // Handle file upload from client
        const filename = data.filename || 'uploaded_file';
        const filepath = path.join(filesDir, filename);
        
        try {
          let fileContent;
          if (data.isBase64) {
            // Binary file - decode base64
            fileContent = Buffer.from(data.data, 'base64');
            console.log(`📤 ${clientId} uploading binary: ${filename} (${data.fileSize} bytes)`);
          } else {
            // Text file
            fileContent = data.data;
            console.log(`📤 ${clientId} uploading text: ${filename} (${data.fileSize} bytes)`);
          }
          
          fs.writeFileSync(filepath, fileContent);
          
          ws.send(JSON.stringify({
            type: 'status',
            data: `File uploaded successfully: ${filename} (${data.fileSize} bytes)`,
            timestamp: Date.now()
          }));
          
          console.log(`✅ ${clientId} upload complete: ${filepath}`);
          
        } catch (error) {
          const errorMsg = `Upload failed: ${error.message}`;
          ws.send(JSON.stringify({
            type: 'error',
            data: errorMsg,
            timestamp: Date.now()
          }));
          console.error(`❌ ${clientId} upload error: ${error.message}`);
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
            
            // Determine if file is binary based on extension
            const ext = path.extname(filename).toLowerCase();
            const textExtensions = [
              '.txt', '.md', '.json', '.js', '.ts', '.tsx', '.jsx', 
              '.css', '.html', '.xml', '.csv', '.yml', '.yaml', 
              '.conf', '.ini', '.log', '.py', '.java', '.cpp', '.c', '.h'
            ];
            const isTextFile = textExtensions.includes(ext);
            
            if (isTextFile) {
              content = fs.readFileSync(filepath, 'utf8');
              console.log(`📥 ${clientId} downloading text: ${filename} (${stats.size} bytes)`);
            } else {
              // Binary file - encode as base64
              content = fs.readFileSync(filepath).toString('base64');
              isBase64 = true;
              console.log(`📥 ${clientId} downloading binary: ${filename} (${stats.size} bytes)`);
            }
            
            ws.send(JSON.stringify({
              type: 'file_data',
              data: content,
              filename: filename,
              fileSize: stats.size,
              isBase64: isBase64,
              timestamp: Date.now()
            }));
            
            console.log(`✅ ${clientId} download complete: ${filename}`);
            
          } else {
            const errorMsg = `File not found: ${filename}`;
            ws.send(JSON.stringify({
              type: 'error',
              data: errorMsg,
              timestamp: Date.now()
            }));
            console.log(`❌ ${clientId} file not found: ${filename}`);
          }
        } catch (error) {
          const errorMsg = `Download failed: ${error.message}`;
          ws.send(JSON.stringify({
            type: 'error',
            data: errorMsg,
            timestamp: Date.now()
          }));
          console.error(`❌ ${clientId} download error: ${error.message}`);
        }
      } else if (data.type === 'list_files') {
        // Handle file listing request
        try {
          const files = fs.readdirSync(filesDir).map(filename => {
            const filepath = path.join(filesDir, filename);
            const stats = fs.statSync(filepath);
            return {
              name: filename,
              size: stats.size,
              modified: stats.mtime.toISOString(),
              type: stats.isDirectory() ? 'directory' : 'file'
            };
          });
          
          ws.send(JSON.stringify({
            type: 'file_list',
            data: JSON.stringify(files),
            timestamp: Date.now()
          }));
          
          console.log(`📋 ${clientId} listed ${files.length} files`);
          
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            data: `Failed to list files: ${error.message}`,
            timestamp: Date.now()
          }));
        }
      }
      
    } catch (error) {
      const errorMsg = `Message parsing error: ${error.message}`;
      ws.send(JSON.stringify({
        type: 'error',
        data: errorMsg,
        timestamp: Date.now()
      }));
      console.error(`❌ ${clientId} parse error: ${error.message}`);
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`❌ ${clientId} disconnected (${code}): ${reason}`);
    if (currentProcess) {
      currentProcess.kill();
      console.log(`🔪 ${clientId} killed running process`);
    }
  });
  
  ws.on('error', (error) => {
    console.error(`💥 ${clientId} error: ${error.message}`);
  });
});

wss.on('error', (error) => {
  console.error('💥 WebSocket server error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down WebSocket server...');
  
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'status',
        data: 'Server shutting down',
        timestamp: Date.now()
      }));
      ws.close();
    }
  });
  
  wss.close(() => {
    console.log('✅ WebSocket server closed');
    process.exit(0);
  });
});

// Server info
console.log(`📊 Server Info:`);
console.log(`   Port: ${PORT}`);
console.log(`   Files: ${path.resolve(filesDir)}`);
console.log(`   PID: ${process.pid}`);
console.log(`   Node: ${process.version}\n`);

// Show available files on startup
try {
  const existingFiles = fs.readdirSync(filesDir);
  if (existingFiles.length > 0) {
    console.log(`📁 Existing files (${existingFiles.length}):`);
    existingFiles.forEach(file => {
      const stats = fs.statSync(path.join(filesDir, file));
      const size = (stats.size / 1024).toFixed(1);
      console.log(`   📄 ${file} (${size} KB)`);
    });
    console.log();
  }
} catch (error) {
  console.log('📁 Files directory empty\n');
}