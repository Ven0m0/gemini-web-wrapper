# 🤖 AI Assistant App

A modern, mobile-first Progressive Web App (PWA) for AI-assisted development with GitHub integration. Built with React, TypeScript, FastAPI, and Google's Gemini AI.

## ✨ Features

- **🤖 Multi-AI Support**: Google Gemini, Anthropic Claude
- **📱 PWA Ready**: Installable on mobile/desktop with offline support
- **🔧 GitHub Integration**: Edit files directly in repositories
- **💬 Multiple Interfaces**: CLI, Editor, Tool modes
- **🌐 WebSocket Support**: Real-time file transfer
- **🎨 Modern UI**: Dark/light themes, responsive design
- **⚡ Fast & Lightweight**: Optimized for performance
- **🔒 Secure**: Environment-based configuration

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- Git

### 1. Clone & Setup
```bash
git clone <your-repo>
cd <your-repo>
cp .env.example .env
# Edit .env with your API keys
```

### 2. Install & Build
```bash
# One-command setup
./deploy.sh
```

### 3. Start Development
```bash
# Start server
python server.py

# Or use the start script
./start.sh
```

Visit: http://localhost:9000

## 🎯 Usage Modes

### CLI Mode 💬
Interactive command-line interface for AI conversations

### Editor Mode ✏️
Code editor with syntax highlighting and AI assistance

### Tool Mode 🛠️
File transfer and GitHub repository management

## 🔧 Configuration

### Environment Variables
```bash
GOOGLE_API_KEY=your_google_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here  # Optional
MODEL_PROVIDER=gemini  # or anthropic
MODEL_NAME=gemini-2.5-flash
PORT=9000
```

### Model Support
- **Google Gemini**: gemini-2.5-flash, gemini-2.5-pro, gemini-3.0-pro
- **Anthropic Claude**: claude-3-5-sonnet-20241022
- **OpenAI Compatible**: Drop-in replacement for GPT models

## 🌐 Deployment

### Vercel (Recommended)
```bash
npm i -g vercel
vercel --prod
```

### Render
- Connect GitHub repo
- Build: `./build.sh`
- Start: `python server.py`

### Railway
- Deploy from GitHub
- Automatic build and deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## 📱 PWA Features

- ✅ Offline functionality
- ✅ Installable on mobile/desktop
- ✅ Push notifications ready
- ✅ Fast loading
- ✅ Responsive design

## 🔌 API Endpoints

### Core APIs
- `POST /chat` - Simple chat
- `POST /code` - Code assistance
- `POST /chatbot` - Chat with history
- `POST /chatbot/stream` - Streaming responses
- `POST /v1/chat/completions` - OpenAI compatible

### GitHub Integration
- `POST /github/file/read` - Read repository files
- `POST /github/file/write` - Write repository files
- `POST /github/list` - List directory contents

### Profile Management
- `GET /profiles/list` - List AI profiles
- `POST /profiles/create` - Create new profile
- `POST /profiles/switch` - Switch profiles

## 🛠️ Development

### Frontend
```bash
cd frontend
npm run dev        # Development server
npm run build      # Production build
npm run lint       # Lint code
npm run typecheck  # Type checking
```

### Backend
```bash
python server.py   # Start server
python -m pytest   # Run tests
```

### Project Structure
```
├── frontend/          # React TypeScript frontend
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── services/   # API services
│   │   └── store.ts    # State management
│   └── dist/          # Built frontend
├── llm_core/          # LLM provider abstractions
├── server.py          # FastAPI backend
├── requirements.txt   # Python dependencies
└── vercel.json        # Deployment config
```

## 🔒 Security

- Environment-based configuration
- Input validation with Pydantic
- CORS protection
- Secure cookie handling
- Rate limiting ready

## 📊 Monitoring

- Vercel Analytics integration
- Speed Insights
- Health check endpoint
- Error tracking ready

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- Check [DEPLOYMENT.md](DEPLOYMENT.md) for deployment issues
- Review logs for error details
- Ensure API keys are valid
- Check quota limits

---

**Made with ❤️ using React, TypeScript, FastAPI, and Google's Gemini AI**