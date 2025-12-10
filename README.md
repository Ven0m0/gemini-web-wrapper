# 🚀 Gemini Web Wrapper

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Code style: ruff](https://img.shields.io/badge/code%20style-ruff-000000.svg)](https://github.com/astral-sh/ruff)
[![Type checked: mypy](https://img.shields.io/badge/type%20checked-mypy-blue.svg)](http://mypy-lang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**High-performance LAN-accessible web UI for Google's Gemini API**

Lightweight FastAPI backend with static HTML/JS frontend providing conversational chat and code assistance. Built for speed, type safety, and ease of deployment.

---

## ✨ Features

- **🔥 High Performance**
  - `orjson` for 6x faster JSON serialization
  - `uvloop` for Node.js-level event loop performance
  - Async/await throughout with thread pool offloading for blocking I/O

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

### 2. Start the Backend

```bash
# Development mode with auto-reload
uvicorn server:app --host 0.0.0.0 --port 9000 --reload

# Production mode with uvloop
python server.py
```

The server will be available at: `http://localhost:9000`

### 3. Access API Documentation

- **Interactive docs**: http://localhost:9000/docs
- **ReDoc**: http://localhost:9000/redoc
- **Health check**: http://localhost:9000/health

---

## 📡 API Endpoints

### Health Check
```bash
GET /health
```
Returns: `{"ok": true}`

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

Then open: http://localhost:8000

Configure the backend host and optional token in the UI.

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
- ✅ Code assistance formatting
- ✅ Input validation (empty strings, missing fields)
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
│  │ Endpoints: /chat, /code, /health          │  │
│  └─────────────┬─────────────────────────────┘  │
│                │                                 │
│  ┌─────────────▼─────────────────────────────┐  │
│  │ Pydantic Models: Validation               │  │
│  │ • ChatReq, CodeReq, GenResponse           │  │
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
        │  Genkit Client  │
        │  + Gemini API   │
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

### For Production Deployment:

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

## 🙏 Acknowledgments

- **FastAPI** - Modern Python web framework
- **Ruff** - Fast Python linter and formatter
- **Google Gemini** - Powerful language model API
- **Genkit** - Streamlined LLM integration

---

## 📞 Support

- **Issues**: [GitHub Issues](../../issues)
- **Discussions**: [GitHub Discussions](../../discussions)

---

**Built with ❤️ using Python, FastAPI, and modern tooling.**
