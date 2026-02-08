# AI Assistant App - Repository Guide

## Project Description

This is a modern, mobile-first Progressive Web App (PWA) for AI-assisted development with GitHub integration. The application provides a comprehensive interface for interacting with multiple AI providers (Google Gemini, Anthropic Claude) through various modes: CLI, Editor, and Tool interfaces. Built with React/TypeScript on the frontend and FastAPI/Python on the backend, it supports real-time WebSocket communication, GitHub repository file management, and can be installed as a PWA on mobile and desktop devices.

The project implements OpenAI-compatible APIs, making it a drop-in replacement for GPT models while leveraging Google's Gemini and Anthropic's Claude models. It features session management, profile switching, streaming responses, and secure environment-based configuration.

## File Structure Overview

```
├── frontend/                    # React TypeScript PWA frontend
│   ├── src/
│   │   ├── components/         # UI components (Editor, Chat, Tools)
│   │   ├── services/           # API client services
│   │   └── store.ts            # Zustand state management
│   ├── public/                 # Static assets and manifest
│   ├── dist/                   # Production build output
│   └── vite.config.ts          # Vite bundler configuration
│
├── llm_core/                    # LLM provider abstraction layer
│   ├── interfaces.py           # Abstract base classes for providers
│   ├── factory.py              # Provider factory and initialization
│   └── providers/              # Concrete provider implementations
│       ├── gemini.py           # Google Gemini integration
│       ├── anthropic.py        # Anthropic Claude integration
│       └── copilot.py          # GitHub Copilot support
│
├── server.py                    # Main FastAPI application server
├── session_manager.py           # Chat session and history management
├── cookie_manager.py            # Browser cookie handling
├── github_service.py            # GitHub API integration
├── openai_transforms.py         # OpenAI API compatibility layer
├── openai_schemas.py            # Pydantic models for API validation
├── utils.py                     # Shared utility functions
├── websocket_server.js          # Node.js WebSocket server
│
├── requirements.txt             # Python dependencies
├── pyproject.toml               # Python project config with dev deps
├── package.json                 # Node.js dependencies and scripts
├── vercel.json                  # Vercel deployment configuration
│
├── test_server.py               # Backend API tests
├── test_session_manager.py      # Session management tests
│
├── build.sh                     # Build script for production
├── deploy.sh                    # One-command setup and deployment
├── start.sh                     # Development server startup
├── setup_dev.sh                 # Development environment setup
└── verify.sh                    # Verification script
```

## Running Tests

The project uses pytest for backend testing:

```bash
# Install test dependencies
pip install -r requirements.txt
pip install pytest pytest-asyncio

# Run all tests
python -m pytest

# Run specific test file
python -m pytest test_server.py

# Run with verbose output
python -m pytest -v

# Run with coverage (if installed)
python -m pytest --cov=. --cov-report=html
```

## Development Setup

**Quick Start:**
```bash
# 1. Clone and configure environment
cp .env.example .env
# Edit .env with your API keys (GOOGLE_API_KEY required)

# 2. One-command setup (installs all dependencies and builds frontend)
./deploy.sh

# 3. Start development server
python server.py
# Or use: ./start.sh
```

**Manual Setup:**
```bash
# Backend dependencies
pip install -r requirements.txt

# Frontend dependencies
cd frontend
npm install
npm run build
cd ..

# Start server (default port 9000)
python server.py
```

**Frontend Development:**
```bash
cd frontend
npm run dev          # Vite dev server with hot reload
npm run build        # Production build
npm run typecheck    # TypeScript type checking
npm run preview      # Preview production build
```

## Key Configuration

Environment variables in `.env`:
- `GOOGLE_API_KEY` - Required for Gemini models
- `ANTHROPIC_API_KEY` - Optional for Claude models
- `MODEL_PROVIDER` - Choose "gemini" or "anthropic" (default: gemini)
- `MODEL_NAME` - Model to use (e.g., gemini-2.5-flash)
- `PORT` - Server port (default: 9000)

## Architecture Notes

- **LLM Abstraction**: The `llm_core` module provides a unified interface for different AI providers, making it easy to add new models or switch between providers.
- **OpenAI Compatibility**: The server implements OpenAI-compatible endpoints at `/v1/chat/completions`, allowing it to work with tools expecting the OpenAI API.
- **Session Management**: Conversations are tracked with session IDs and stored in SQLite via the `session_manager` module.
- **PWA Features**: The frontend is a fully functional PWA with offline support, installability, and service worker caching.
- **GitHub Integration**: Direct file reading/writing to GitHub repositories through authenticated API calls.
