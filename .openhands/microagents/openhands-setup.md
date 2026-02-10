---
name: openhands-setup
type: knowledge
version: 1.0.0
agent: CodeActAgent
---

# OpenHands Setup Guide

This microagent provides guidance for setting up the gemini-web-wrapper repository for use with OpenHands.

## Overview

This repository is a modern, mobile-first Progressive Web App (PWA) for AI-assisted development with GitHub integration. Setting it up for OpenHands requires understanding the project structure, dependencies, and configuration requirements.

## Prerequisites

Before using OpenHands with this repository, ensure you have:

1. **API Keys** (at least one required):
   - `GOOGLE_API_KEY` - Required for Gemini models
   - `ANTHROPIC_API_KEY` - Optional for Claude models

2. **Runtime Requirements**:
   - Python 3.10+
   - Node.js 18+ (for frontend development)
   - npm or pnpm package manager

## Initial Setup Steps

### 1. Environment Configuration

Create a `.env` file from the example template:

```bash
cp .env.example .env
```

Required environment variables:
- `GOOGLE_API_KEY` - Your Google AI API key
- `MODEL_PROVIDER` - Set to "gemini" or "anthropic" (default: gemini)
- `MODEL_NAME` - Model identifier (e.g., gemini-2.5-flash)
- `PORT` - Server port (default: 9000)

### 2. Install Dependencies

**Quick Setup (Recommended):**
```bash
./deploy.sh
```

This script will:
- Install Python dependencies
- Install Node.js dependencies
- Build the frontend
- Verify the setup

**Manual Setup:**
```bash
# Backend dependencies
pip install -r requirements.txt

# Frontend dependencies
cd frontend
npm install
npm run build
cd ..
```

### 3. Verify Installation

Run the verification script:
```bash
./verify.sh
```

## Development Workflow

### Starting the Development Server

```bash
# Start backend server (default port 9000)
python server.py

# Or use the convenience script
./start.sh
```

### Frontend Development

For hot-reload frontend development:
```bash
cd frontend
npm run dev
```

### Running Tests

The project uses pytest for backend testing:

```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run all tests
python -m pytest

# Run with verbose output
python -m pytest -v
```

## Project Structure

Key directories and files:
- `frontend/` - React TypeScript PWA application
- `llm_core/` - LLM provider abstraction layer
- `server.py` - Main FastAPI server
- `session_manager.py` - Chat session management
- `github_service.py` - GitHub API integration
- `requirements.txt` - Python dependencies
- `package.json` - Node.js dependencies

## Common Tasks

### Adding New Dependencies

**Python:**
```bash
# Add to requirements.txt, then:
pip install -r requirements.txt
```

**Node.js:**
```bash
cd frontend
npm install <package-name>
```

### Building for Production

```bash
./build.sh
```

This will:
- Build the frontend for production
- Prepare static assets
- Optimize the bundle

### Testing Changes

Before committing changes:
1. Run backend tests: `python -m pytest`
2. Build frontend: `cd frontend && npm run build`
3. Verify functionality: `./verify.sh`

## Troubleshooting

### Missing API Keys
If you see authentication errors, ensure your `.env` file contains valid API keys.

### Port Already in Use
If port 9000 is occupied, change the `PORT` variable in `.env`.

### Frontend Build Failures
Try clearing the cache and rebuilding:
```bash
cd frontend
rm -rf node_modules dist
npm install
npm run build
```

### Python Dependency Conflicts
Use a virtual environment to isolate dependencies:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## OpenHands-Specific Notes

When using OpenHands with this repository:

1. **Environment Variables**: OpenHands can access environment variables. Ensure sensitive keys are properly configured.

2. **Testing**: Use `python -m pytest` to run tests before making commits.

3. **Build Process**: Always rebuild the frontend after making changes to React components:
   ```bash
   cd frontend && npm run build && cd ..
   ```

4. **Server Management**: The FastAPI server runs on port 9000 by default. Make sure this port is available.

5. **GitHub Integration**: The repository includes GitHub service integration. Ensure proper authentication when working with GitHub APIs.

## Additional Resources

- See `README.md` for general project documentation
- See `DEPLOYMENT.md` for deployment instructions
- See `AI_RULES.md` for AI assistant guidelines
- See `.openhands/microagents/repo.md` for detailed repository structure

## Support

For issues specific to OpenHands integration, check:
- [OpenHands Documentation](https://docs.all-hands.dev)
- Repository issues on GitHub
