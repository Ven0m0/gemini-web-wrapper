# AI Assistant App
>[![Maintainability](https://qlty.sh/gh/Ven0m0/projects/gemini-web-wrapper/maintainability.svg)](https://qlty.sh/gh/Ven0m0/projects/gemini-web-wrapper)

A mobile-first Progressive Web App (PWA) for AI-assisted development with GitHub integration. Built with React, TypeScript, FastAPI, and Google's Gemini AI.

## Features

- **Multi-AI Support**: Google Gemini, Anthropic Claude
- **PWA**: Installable on mobile/desktop with offline support
- **GitHub Integration**: Edit files directly in repositories
- **Multiple Interfaces**: CLI, Editor, Tool modes
- **WebSocket Support**: Real-time file transfer
- **Dark/light themes, responsive design**
- **Environment-based configuration**

## Quick Start

### Prerequisites

- Node.js 24 LTS+, Bun 1.3.12+, and uv
- Python 3.14+
- Git
- Optional: [mise](https://mise.jdx.dev/) to install the pinned project toolchain from `mise.toml`

### 1. Clone & Setup

```bash
git clone <your-repo>
cd <your-repo>
mise install  # Optional: installs the pinned Node, Bun, Python, and uv toolchain
cp .env.example .env
# Edit .env with your API keys
```

### 2. Install & Build

**Frontend:**

```bash
cd apps/web
bun install
bun run build
```

**Backend:**

```bash
cd apps/api
uv sync --all-extras
```

### 3. Start Development

```bash
# Start the API
cd apps/api && PYTHONPATH=src:../../packages/config/src uv run uvicorn affine.api.server:app --reload

# Start the frontend (in another terminal)
cd apps/web && bun run dev
```

Visit: http://localhost:9000

## Usage Modes

### CLI Mode

Interactive command-line interface for AI conversations

### Editor Mode

Code editor with syntax highlighting and AI assistance

### Tool Mode

File transfer and GitHub repository management

## Configuration

### Environment Variables

```bash
GOOGLE_API_KEY=your_google_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here  # Optional
COPILOT_API_KEY=your_github_copilot_token_here  # Optional
MODEL_PROVIDER=gemini  # or anthropic or copilot
MODEL_NAME=gemini-3.1-pro-preview
PORT=9000
```

### Model Support

- **Google Gemini**: gemini-3.1-pro-preview, gemini-3-flash-preview, gemini-3.1-flash-lite-preview
- **Anthropic Claude**: claude-sonnet-4-6, claude-opus-4-6, claude-haiku-4-5
- **GitHub Copilot**: claude-sonnet-4.6, claude-opus-4.6, gemini-3.1-pro
- **OpenAI Compatible**: drop-in replacement for GPT models

## Deployment

### Vercel

```bash
npm i -g vercel
vercel --prod
```

### Render

- Connect GitHub repo
- Build: `cd apps/api && uv sync --all-extras`
- Start: `cd apps/api && PYTHONPATH=src:../../packages/config/src uv run uvicorn affine.api.server:app --host 0.0.0.0 --port 9000`

### Railway

- Deploy from GitHub
- Automatic build and deploy

See [DEPLOYMENT.md](docs/deployment.md) for detailed deployment instructions.

## PWA Features

- Offline functionality
- Installable on mobile/desktop
- Responsive design

## API Endpoints

- `GET /health` - Health check
- `GET /v1/models` - List available models
- `POST /v1/chat/completions` - OpenAI-compatible chat completions (streaming supported)

## Development

### Frontend

```bash
cd apps/web
bun run dev        # Development server
bun run build      # Production build
bun run lint       # Lint code
bun run typecheck  # Type checking
```

### Backend

```bash
cd apps/api
PYTHONPATH=src:../../packages/config/src uv run uvicorn affine.api.server:app --reload
PYTHONPATH=src:../../packages/config/src uv run pytest
```

### Project Structure

```
├── apps/
│   ├── web/              # React TypeScript frontend (Vite PWA)
│   │   ├── src/
│   │   │   ├── components/  # UI components
│   │   │   ├── services/    # API services
│   │   │   └── store.ts     # Zustand state management
│   │   └── dist/           # Built frontend
│   └── api/              # FastAPI backend
│       └── src/affine/api/
├── packages/
│   ├── config/           # Typed settings (Pydantic)
│   ├── llm-core/         # LLM provider interfaces & factory
│   └── shared/           # Shared Python models & schemas
├── package.json          # Bun workspace scripts
└── vercel.json           # Deployment config
```

## Security

- Input validation with Pydantic
- CORS protection
- Environment-based secrets

## Monitoring

- Vercel Analytics integration
- Speed Insights
- Health check endpoint

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- Check [DEPLOYMENT.md](docs/deployment.md) for deployment issues
- Review logs for error details
- Ensure API keys are valid
- Check quota limits
