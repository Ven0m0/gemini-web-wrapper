# 🚀 Gemini Web Wrapper

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Code style: ruff](https://img.shields.io/badge/code%20style-ruff-000000.svg)](https://github.com/astral-sh/ruff)
[![Type checked: mypy](https://img.shields.io/badge/type%20checked-mypy-blue.svg)](http://mypy-lang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![autofix enabled](https://shields.io/badge/autofix.ci-yes-success?logo=data:image/svg+xml;base64,PHN2ZyBmaWxsPSIjZmZmIiB2aWV3Qm94PSIwIDAgMTI4IDEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCB0cmFuc2Zvcm09InNjYWxlKDAuMDYxLC0wLjA2MSkgdHJhbnNsYXRlKC0yNTAsLTE3NTApIiBkPSJNMTMyNSAtMzQwcS0xMTUgMCAtMTY0LjUgMzIuNXQtNDkuNSAxMTQuNXEwIDMyIDUgNzAuNXQxMC41IDcyLjV0NS41IDU0djIyMHEtMzQgLTkgLTY5LjUgLTE0dC03MS41IC01cS0xMzYgMCAtMjUxLjUgNjJ0LTE5MSAxNjl0LTkyLjUgMjQxcS05MCAxMjAgLTkwIDI2NnEwIDEwOCA0OC41IDIwMC41dDEzMiAxNTUuNXQxODguNSA4MXExNSA5OSAxMDAuNSAxODAuNXQyMTcgMTMwLjV0MjgyLjUgNDlxMTM2IDAgMjU2LjUgLTQ2IHQyMDkgLTEyNy41dDEyOC41IC0xODkuNXExNDkgLTgyIDIyNyAtMjEzLjV0NzggLTI5OS41cTAgLTEzNiAtNTggLTI0NnQtMTY1LjUgLTE4NC41dC0yNTYuNSAtMTAzLjVsLTI0MyAtMzAwdi01MnEwIC0yNyAzLjUgLTU2LjV0Ni41IC01Ny41dDMgLTUycTAgLTg1IC00MS41IC0xMTguNXQtMTU3LjUgLTMzLjV6TTEzMjUgLTI2MHE3NyAwIDk4IDE0LjV0MjEgNTcuNXEwIDI5IC0zIDY4dC02LjUgNzN0LTMuNSA0OHY2NGwyMDcgMjQ5IHEtMzEgMCAtNjAgNS41dC01NCAxMi41bC0xMDQgLTEyM3EtMSAzNCAtMiA2My41dC0xIDU0LjVxMCA2OSA5IDEyM2wzMSAyMDBsLTExNSAtMjhsLTQ2IC0yNzFsLTIwNSAyMjZxLTE5IC0xNSAtNDMgLTI4LjV0LTU1IC0yNi41bDIxOSAtMjQydi0yNzZxMCAtMjAgLTUuNSAtNjB0LTEwLjUgLTc5dC01IC01OHEwIC00MCAzMCAtNTMuNXQxMDQgLTEzLjV6TTEyNjIgNjE2cS0xMTkgMCAtMjI5LjUgMzQuNXQtMTkzLjUgOTYuNWw0OCA2NCBxNzMgLTU1IDE3MC41IC04NXQyMDQuNSAtMzBxMTM3IDAgMjQ5IDQ1LjV0MTc5IDEyMXQ2NyAxNjUuNWg4MHEwIC0xMTQgLTc3LjUgLTIwNy41dC0yMDggLTE0OXQtMjg5LjUgLTU1LjV6TTgwMyA1OTVxODAgMCAxNDkgMjkuNXQxMDggNzIuNWwyMjEgLTY3bDMwOSA4NnE0NyAtMzIgMTA0LjUgLTUwdDExNy41IC0xOHE5MSAwIDE2NSAzOHQxMTguNSAxMDMuNXQ0NC41IDE0Ni41cTAgNzYgLTM0LjUgMTQ5dC05NS41IDEzNHQtMTQzIDk5IHEtMzcgMTA3IC0xMTUuNSAxODMuNXQtMTg2IDExNy41dC0yMzAuNSA0MXEtMTAzIDAgLTE5Ny41IC0yNnQtMTY5IC03Mi41dC0xMTcuNSAtMTA4dC00MyAtMTMxLjVxMCAtMzQgMTQuNSAtNjIuNXQ0MC41IC01MC41bC01NSAtNTlxLTM0IDI5IC01NCA2NS41dC0yNSA4MS41cS04MSAtMTggLTE0NSAtNzB0LTEwMSAtMTI1LjV0LTM3IC0xNTguNXEwIC0xMDIgNDguNSAtMTgwLjV0MTI5LjUgLTEyM3QxNzkgLTQ0LjV6Ii8+PC9zdmc+)](https://autofix.ci)

**High-performance LAN-accessible web UI for Google's Gemini API**

Lightweight FastAPI backend with static HTML/JS frontend providing conversational chat and code assistance. Built for speed, type safety, and ease of deployment.

---

## ✨ Features

- **🔥 High Performance**
  - `orjson` for 6x faster JSON serialization
  - `uvloop` for Node.js-level event loop performance
  - Async/await throughout with thread pool offloading for blocking I/O

- **🤖 Triple AI Backends**
  - **Genkit Integration**: Production-ready Google AI with flows and observability
  - **Gemini WebAPI**: Direct web interface access with cookie authentication
  - **OpenAI-Compatible API**: Drop-in replacement for `/v1/chat/completions`
  - Conversation history support with stateless server pattern
  - Streaming responses for real-time interactions (SSE format)
  - Customizable system instructions per conversation
  - Tool calling support via prompt injection (works with MCP tools)

- **🍪 Advanced Cookie Management**
  - Multi-profile support for different Google accounts
  - Automatic cookie extraction from Chrome, Firefox, Edge, Safari
  - Persistent cookie storage with SQLite (aiosqlite)
  - Cookie refresh and validation
  - Browser-cookie3 auto-import support
  - Profile switching and management

- **🎯 Strict Type Safety**
  - 100% type-annotated with Protocol definitions
  - Mypy strict mode compliance
  - Pydantic models with validation

- **🛠️ Modern Tooling**
  - Formatted with `ruff` (Black-compatible)
  - Linted with comprehensive rule set
  - Comprehensive test suite with edge cases

- **🌐 Simple Deployment**
  - No frontend frameworks or build steps
  - Works on Arch, Raspbian, Termux
  - LAN-visible with optional token auth
  - FastAPI auto-generated OpenAPI docs
  - Hosted through [Render](render.com) (backend) and [Vercel](vercel.com) (frontend)

- **🔌 OpenAI Compatibility**
  - Works with VS Code Copilot, Continue.dev, and any OpenAI-compatible client
  - Model aliasing (e.g., `gpt-4o-mini` → `gemini-2.5-flash`)
  - SSE streaming for real-time responses
  - Function calling / tool use support

- **🎨 Chainlit UI Integration**
  - Modern conversational UI powered by Chainlit
  - Interactive chat interface with settings
  - Conversation history management
  - Real-time streaming responses
  - Model switching on the fly

---

## 📋 Requirements

- **Python 3.10+**
- **Environment**: `GOOGLE_API_KEY` set in environment or `.env` file

### Installation

```bash
# Using pip
pip install -r requirements.txt

# Or using uv (recommended for faster installs)
uv pip install -r requirements.txt
```

**Key Dependencies:**

- `fastapi>=0.110.0` - Modern async web framework
- `uvicorn[standard]>=0.29.0` - ASGI server with uvloop
- `orjson>=3.10.0` - Fast JSON serialization
- `pydantic>=2.7.0` - Data validation with type hints
- `genkit` + `google-generativeai` - Gemini API client

---

## 🚀 Quick Start

### 1. Configure API Key

```bash
export GOOGLE_API_KEY="your_gemini_api_key_here"
# Or create a .env file:
echo "GOOGLE_API_KEY=your_key" > .env
```

### 2. Start the Application

**Option A: FastAPI Backend (for API access)**

```bash
# Development mode with auto-reload
uvicorn server:app --host 0.0.0.0 --port 9000 --reload

# Production mode with uvloop
python server.py
```

The server will be available at: `http://localhost:9000`

**Option B: Chainlit UI (for chat interface)**

```bash
# Start the Chainlit chat interface
uv run chainlit run chainlit_app.py
```

The Chainlit interface will be available at: `http://localhost:8000`

### 3. Access API Documentation

- **Interactive docs**: <http://localhost:9000/docs>
- **ReDoc**: <http://localhost:9000/redoc>
- **Health check**: <http://localhost:9000/health>

---

## 🍪 Cookie Management & Multi-Profile Support

The wrapper now supports extracting cookies from your browser and managing multiple Google accounts as profiles.

### Quick Start with Cookies

1. **Login to Gemini**: Open <https://gemini.google.com> in your browser and login
2. **Create a profile** (extracts cookies automatically):

```bash
curl -X POST http://localhost:9000/profiles/create \
  -H "Content-Type: application/json" \
  -d '{"name": "my-account", "browser": "chrome"}'
```

3. **Use the profile** for chatting:

```bash
curl -X POST http://localhost:9000/gemini/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "profile": "my-account"}'
```

### Supported Browsers

- `chrome` - Google Chrome
- `firefox` - Mozilla Firefox
- `edge` - Microsoft Edge
- `safari` - Apple Safari (macOS only)
- `chromium` - Chromium
- `all` - Try all browsers and merge cookies

### Profile Management

**List profiles:**

```bash
curl http://localhost:9000/profiles/list
```

**Switch profile:**

```bash
curl -X POST http://localhost:9000/profiles/switch \
  -H "Content-Type: application/json" \
  -d '{"name": "my-account"}'
```

**Refresh cookies:**

```bash
curl -X POST http://localhost:9000/profiles/my-account/refresh
```

**Delete profile:**

```bash
curl -X DELETE http://localhost:9000/profiles/my-account
```

### Auto Cookie Import

You can also use automatic cookie import without creating profiles:

```bash
# Just make sure you're logged into gemini.google.com in your browser
curl -X POST http://localhost:9000/gemini/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!"}'
```

The system will automatically import cookies via browser-cookie3.

---

## 🔧 VS Code Copilot Integration

You can use this server as a backend for GitHub Copilot by configuring custom model providers.

### Configure Custom Model Provider

Add to your VS Code `settings.json`:

```json
{
  "github.copilot.chat.models": [
    {
      "id": "gemini-flash",
      "vendor": "copilot",
      "family": "gemini-flash",
      "url": "http://localhost:9000/v1/chat/completions",
      "modelOverride": "gemini-flash",
      "toolCalling": true
    },
    {
      "id": "gemini-pro",
      "vendor": "copilot",
      "family": "gemini-pro",
      "url": "http://localhost:9000/v1/chat/completions",
      "modelOverride": "gemini-pro",
      "toolCalling": true
    },
    {
      "id": "gemini-3-pro",
      "vendor": "copilot",
      "family": "gemini-3-pro",
      "url": "http://localhost:9000/v1/chat/completions",
      "modelOverride": "gemini-3.0-pro",
      "toolCalling": true
    }
  ]
}
```

### Using Tools in Chat

Copilot will automatically use tools when needed. You can also force tool usage with `#` references:

```text
#fetch https://example.com - Summarize this page
#file:app/main.py - Explain this file
#codebase - Search for X in the codebase
```

---

## 📡 API Endpoints

### Health Check

```bash
GET /health
```

Returns: `{"ok": true}`

### OpenAI-Compatible Chat Completions

```bash
POST /v1/chat/completions
Content-Type: application/json

{
  "model": "gemini-flash",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ]
}
```

**Streaming Request:**

```bash
POST /v1/chat/completions
Content-Type: application/json

{
  "model": "gemini-flash",
  "messages": [{"role": "user", "content": "Tell me a story"}],
  "stream": true
}
```

**Tool Calling Request:**

```bash
POST /v1/chat/completions
Content-Type: application/json

{
  "model": "gemini-pro",
  "messages": [{"role": "user", "content": "What time is it in Tokyo?"}],
  "tools": [{
    "type": "function",
    "function": {
      "name": "get_time",
      "description": "Get current time in a timezone",
      "parameters": {
        "type": "object",
        "properties": {
          "timezone": {"type": "string"}
        },
        "required": ["timezone"]
      }
    }
  }]
}
```

**Supported Models:**

| Model Name | Alias | Description |
|------------|-------|-------------|
| `gemini-3.0-pro` | `gpt-4.1-mini` | **Gemini 3.0 Pro** - Latest and most capable |
| `gemini-2.5-pro` | `gpt-4o`, `gemini-pro` | Gemini 2.5 Pro - Advanced reasoning |
| `gemini-2.5-flash` | `gpt-4o-mini`, `gemini-flash` | Gemini 2.5 Flash - Fast and efficient (default) |

### Chat Endpoint

```bash
POST /chat
Content-Type: application/json

{
  "prompt": "Explain async/await in Python",
  "system": "You are a helpful Python tutor"  // optional
}
```

**Response:**

```json
{
  "text": "Async/await in Python allows..."
}
```

### Chatbot Endpoint (with History)

```bash
POST /chatbot
Content-Type: application/json

{
  "message": "What else should I know?",
  "history": [
    {"role": "user", "content": "Tell me about Python"},
    {"role": "model", "content": "Python is a high-level programming language..."}
  ],
  "system": "You are a helpful assistant"  // optional
}
```

**Response:**

```json
{
  "text": "You should also know that Python has..."
}
```

**Note:** This endpoint follows the Genkit chatbot pattern where the client maintains conversation history and sends it with each request (stateless server pattern).

### Chatbot Streaming Endpoint

```bash
POST /chatbot/stream
Content-Type: application/json

{
  "message": "Tell me a story",
  "history": [],  // optional
  "system": "You are a creative storyteller"  // optional
}
```

**Response:** Streams the response as `text/plain` for real-time output.

### Gemini WebAPI Chat (with Cookie Auth)

```bash
POST /gemini/chat
Content-Type: application/json

{
  "message": "Hello, how are you?",
  "conversation_id": "abc123",  // optional, for continuing conversations
  "profile": "my-account"  // optional, profile to use
}
```

**Response:**

```json
{
  "text": "I'm doing well, thank you for asking!",
  "conversation_id": "abc123",
  "profile": "my-account"
}
```

**Note:** This endpoint uses gemini-webapi with cookie-based authentication. It supports:

- Auto cookie import from browser (if logged into gemini.google.com)
- Profile-based authentication
- Conversation continuity via conversation_id

### List Gemini Conversations

```bash
GET /gemini/conversations
```

**Response:**

```json
{
  "conversations": [...],
  "count": 5
}
```

### Delete Gemini Conversation

```bash
DELETE /gemini/conversations/{conversation_id}
```

**Response:**

```json
{
  "status": "success",
  "message": "Conversation 'abc123' deleted"
}
```

### Code Assistance

```bash
POST /code
Content-Type: application/json

{
  "code": "def calculate(x, y):\n    return x + y",
  "instruction": "Add type hints and docstring"
}
```

**Response:**

```json
{
  "text": "def calculate(x: int, y: int) -> int:\n    \"\"\"Add two numbers...\"\"\""
}
```

---

## 🎨 Frontend

Static files in `web/` provide a minimal UI:

- `index.html` - Main chat interface
- `app.js` - Client-side logic
- `style.css` - Styling

**To serve the frontend:**

```bash
cd web
python3 -m http.server 8000
```

Then open: <http://localhost:8000>

Configure the backend host and optional token in the UI.

---

## 🎨 Chainlit UI

For a modern, production-ready chat interface, you can use the integrated Chainlit UI.

### Starting the Chainlit Interface

```bash
# Make sure you have your GOOGLE_API_KEY configured
export GOOGLE_API_KEY="your_gemini_api_key_here"

# Run the Chainlit app
uv run chainlit run chainlit_app.py
```

The Chainlit interface will be available at: <http://localhost:8000>

### Features

- **Interactive Chat**: Beautiful, responsive chat interface
- **Settings Panel**:
  - Switch between Gemini models (flash, pro, 3.0-pro)
  - Enable/disable streaming
  - Control conversation history length
- **Conversation Management**: Automatic history tracking
- **Welcome Screen**: Informative README when starting a new chat
- **Real-time Responses**: See AI responses as they're generated

### Configuration

The Chainlit configuration is stored in `.chainlit/config.toml`. You can customize:
- UI theme (light/dark mode colors)
- Session timeout
- Feature flags (LaTeX, HTML rendering, etc.)
- Assistant name and description

### Development Mode

For auto-reload during development:

```bash
uv run chainlit run chainlit_app.py --watch
```

---

## 🧪 Development

### Running Tests

```bash
# Run all tests with timing
pytest test_server.py -v --durations=0

# Run with coverage
pytest test_server.py --cov=server --cov-report=html
```

**Test Coverage:**

- ✅ Health check endpoint
- ✅ Chat with system/user messages
- ✅ Chatbot with conversation history
- ✅ Chatbot streaming responses
- ✅ Code assistance formatting
- ✅ Input validation (empty strings, missing fields, invalid roles)
- ✅ Model initialization errors (503 handling)
- ✅ Long prompts and special characters
- ✅ Unicode and XSS-like input handling

### Code Quality Checks

```bash
# Format code
ruff format .

# Lint code
ruff check .

# Type check
mypy server.py test_server.py

# Run all checks
ruff format . && ruff check . && mypy server.py test_server.py && pytest
```

### Pre-commit Hooks

```bash
# Install pre-commit
pip install pre-commit

# Set up hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│  Frontend (Static HTML/JS)                      │
│  • index.html: Chat interface                   │
│  • app.js: Fetch API calls                      │
└────────────┬────────────────────────────────────┘
             │ HTTP POST
             ▼
┌─────────────────────────────────────────────────┐
│  FastAPI Backend (server.py)                    │
│  ┌───────────────────────────────────────────┐  │
│  │ Endpoints:                                │  │
│  │ • /chat, /code, /health                   │  │
│  │ • /chatbot (with history)                 │  │
│  │ • /chatbot/stream (streaming)             │  │
│  └─────────────┬─────────────────────────────┘  │
│                │                                 │
│  ┌─────────────▼─────────────────────────────┐  │
│  │ Pydantic Models: Validation               │  │
│  │ • ChatReq, ChatbotReq, CodeReq            │  │
│  │ • ChatMessage, GenResponse                │  │
│  └─────────────┬─────────────────────────────┘  │
│                │                                 │
│  ┌─────────────▼─────────────────────────────┐  │
│  │ Genkit Flows: Structured AI Operations   │  │
│  │ • chatbot_flow() with @ai.flow()          │  │
│  │ • Type-safe inputs/outputs                │  │
│  │ • Built-in tracing & observability        │  │
│  └─────────────┬─────────────────────────────┘  │
│                │                                 │
│  ┌─────────────▼─────────────────────────────┐  │
│  │ run_generate(): Async thread pool         │  │
│  │ • asyncio.to_thread() for blocking I/O    │  │
│  └─────────────┬─────────────────────────────┘  │
└────────────────┼─────────────────────────────────┘
                 │
                 ▼
        ┌─────────────────┐
        │  Genkit + GoogleAI Plugin              │
        │  • Gemini 2.5 Flash Model              │
        │  • Conversation history management     │
        │  • Streaming support                   │
        └─────────────────┘
```

**Performance Optimizations:**

- **ORJSONResponse**: 6x faster JSON serialization
- **uvloop**: High-performance event loop
- **Thread pool**: Blocking Genkit calls don't block async server
- **Lifespan context**: Efficient resource initialization/cleanup

---

## 🔒 Security

⚠️ **Important**: This application is designed for **LAN/local development only**.

### For Production Deployment

1. **Add authentication** (JWT, OAuth, API keys)
2. **Enable CORS** properly with allowed origins
3. **Use HTTPS** with valid certificates
4. **Rate limiting** to prevent abuse
5. **Input sanitization** (already basic validation via Pydantic)
6. **Environment variables** for secrets (never commit `.env`)

### Optional Token Header

To add simple token-based auth, check for header in middleware:

```python
X-API-KEY: your_secret_token
```

Implement validation in `server.py` using FastAPI dependencies.

---

## 📦 Dependency Management

### Using `uv` (Recommended)

```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
uv pip install -r requirements.txt

# Update dependencies
uv pip compile pyproject.toml -o requirements.txt
```

### Using `pip`

```bash
pip install -r requirements.txt
```

---

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Format** code: `ruff format .`
4. **Lint** code: `ruff check .`
5. **Type check**: `mypy server.py test_server.py`
6. **Test**: `pytest test_server.py -v`
7. **Commit** changes: `git commit -m 'Add amazing feature'`
8. **Push**: `git push origin feature/amazing-feature`
9. **Open** a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🔄 Improvements Integrated from Other Projects

This project has integrated patterns and features from:

### From [racaes/rev_gemini_api](https://github.com/racaes/rev_gemini_api)

- **OpenAI-compatible API**: Drop-in replacement for `/v1/chat/completions` endpoint
- **SSE streaming support**: Real-time response streaming compatible with VS Code Copilot
- **Tool calling support**: Function calling via prompt injection (works with MCP tools)
- **Model aliasing**: Map OpenAI model names to Gemini models (e.g., `gpt-4o-mini` → `gemini-2.5-flash`)
- **Message transforms**: Collapse OpenAI-style messages into Gemini prompts
- **Tool call parsing**: Extract and format tool calls from model responses

### From [odomcl22/gemini-web-wrapper](https://github.com/odomcl22/gemini-web-wrapper) (Electron)

- **Multi-profile cookie persistence**: Store and manage multiple Google account profiles
- **Cookie persistence architecture**: Inspired session management patterns
- **Profile switching**: Quick switching between different authenticated accounts

### From [levish0/gemini-desktop](https://github.com/levish0/gemini-desktop) (Tauri)

- **Desktop wrapper patterns**: Cross-platform considerations

### Additional Enhancements

- **aiosqlite integration**: Async SQLite for high-performance cookie storage
- **browser-cookie3 integration**: Automatic cookie extraction from all major browsers
- **Triple backend support**: Genkit (API-based), gemini-webapi (cookie-based), and OpenAI-compatible
- **Cookie refresh mechanism**: Automatic cookie validation and refresh
- **Thread-safe operations**: Async locks for concurrent profile management

---

## 🙏 Acknowledgments

- **FastAPI** - Modern Python web framework
- **Ruff** - Fast Python linter and formatter
- **Google Gemini** - Powerful language model API
- **Genkit** - Streamlined LLM integration
- **gemini-webapi** - Reverse-engineered Gemini web interface
- **browser-cookie3** - Browser cookie extraction
- **aiosqlite** - Async SQLite operations

---

## 📞 Support

- **Issues**: [GitHub Issues](../../issues)
- **Discussions**: [GitHub Discussions](../../discussions)

---

**Built with ❤️ using Python, FastAPI, and modern tooling.**
