# Open WebUI Integration

This project has been enhanced with key features inspired by [Open WebUI](https://github.com/open-webui/open-webui), integrating the best aspects of both systems.

## Features Added

### Backend Enhancements
- **API Endpoints**: Added Open WebUI-compatible API endpoints:
  - `/api/config` - Configuration settings
  - `/api/models` - Available models listing
  - `/api/version` - Version information
  - `/api/user` - User information
  - `/api/chat/history` - Chat history management
  - `/api/document/upload` - Document upload for RAG
  - `/api/documents` - Document listing
  - `/api/tools` - Tools management

### Frontend Enhancements
- **Modern UI**: Enhanced interface with sidebar navigation similar to Open WebUI
- **Multi-tab Interface**: Chat, Documents, Tools, and History sections
- **Model Selection**: Dropdown to choose between different Gemini models
- **Document Management**: Upload and manage documents for RAG
- **Tool Integration**: Framework for AI tools integration
- **Chat History**: View and manage previous conversations

## Key Differences from Open WebUI

While maintaining the core functionality of your Gemini Web Wrapper, this integration adds:

1. **Gemini Focus**: Unlike Open WebUI which supports multiple backends, this focuses on optimizing Gemini models
2. **Cookie Authentication**: Maintains your existing gemini-webapi cookie authentication system
3. **OpenAI Compatibility**: Keeps your OpenAI-compatible API endpoints
4. **Enhanced UI**: Combines Open WebUI's modern interface with your existing features

## Usage

Start the server normally:
```bash
python server.py
```

Access the enhanced UI at `http://localhost:9000` (or your configured port).

## API Compatibility

All original endpoints remain functional:
- `/v1/chat/completions` - OpenAI-compatible chat
- `/chat`, `/chatbot` - Original chat endpoints
- `/gemini/chat` - Cookie-authenticated chat
- All profile management endpoints

New Open WebUI-compatible endpoints:
- `/api/config` - Get configuration
- `/api/models` - List available models
- `/api/chat/history` - Manage chat history
- `/api/document/upload` - Upload documents for RAG

## Architecture

The integration follows these principles:
1. **Non-invasive**: Existing functionality preserved
2. **API-first**: New features accessible via standard APIs
3. **Modular**: Easy to extend with additional Open WebUI features
4. **Performance**: Maintains the high-performance characteristics of the original

## Future Extensions

Potential areas for further integration:
- Full RAG pipeline with vector databases
- User authentication and permissions
- Advanced tool building capabilities
- Conversation threading
- Multi-modal support