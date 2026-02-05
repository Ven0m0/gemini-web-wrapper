case 'help':
        const commands = [
          '/open <path> - Load file from GitHub',
          '/new <path> - Create new file with template',
          '/ls [path] - List files in directory',
          '/cat <path> - Show file contents',
          '/socket <cmd> - WebSocket console operations',
          '/upload <filename> - Upload file via WebSocket',
          '/download <filename> - Download file via WebSocket',
          '/img <prompt> - Generate image via AI and upload',
          '/wsh <file.c> - Open WebAssembly shell for C compilation',
          '/preload wasmer|python - Pre-cache SDK/registry or Pyodide assets for offline',
          '/preload wsh - Pre-cache webassembly.sh shell page for offline',
          '/python <file.py> - Run a Python file via Pyodide and show output',
          '/pip install <pkg...> - Install pure-Python packages via micropip (Pyodide)',
          '/chat demo - Open chat widget customization demo',
          '/apply - Apply AI changes to editor',
          '/diff - Show differences',
          '/revert - Revert to original',
          '/commit "msg" - Commit changes',
          '/branch <name> - Switch branch',
          '/model <id> - Switch AI model',
          '/config - Open configuration',
          '/save - Save current file to local Downloads',
          '/tokens - Estimate token usage',
          '/update - Check for application updates',
          '/editor - Switch to editor',
          '/tool [upload|download] - Switch to file transfer tools',
          '/clear - Clear history',
          '/help - Show this help'
        ]
        
        addHistory('Available commands:')
        commands.forEach(cmd => addHistory(cmd))
        addHistory('')
        addHistory('WebSocket commands: /socket <subcommand>')
        addHistory('  connect <url> - Connect to WebSocket server')
        addHistory('  exec <cmd>    - Execute remote command')
        addHistory('  send <msg>    - Send raw message')
        addHistory('  server [port] - Show server template code')
        addHistory('  clear           - Clear message history')
        addHistory('')
        addHistory('File Transfer (requires WebSocket connection):')
        addHistory('  /upload <filename>   - Send file to server')
        addHistory('  /download <filename> - Receive file from server')
        addHistory('')
        addHistory('Chat Widget:')
        addHistory('  /chat demo - Open chat widget customization demo')
        addHistory('  Global chat widget available in bottom-right corner')