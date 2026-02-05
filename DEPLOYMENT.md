# AI Assistant App - Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- Git

### 1. Clone and Setup
```bash
git clone <your-repo>
cd <your-repo>
```

### 2. Environment Configuration
```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Install Dependencies
```bash
# Install frontend dependencies
cd frontend && npm install && cd ..

# Install Python dependencies
pip install -r requirements.txt
```

### 4. Build Frontend
```bash
cd frontend && npm run build && cd ..
```

### 5. Start Server
```bash
python server.py
```

## 📋 Deployment Options

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI**
```bash
npm i -g vercel
```

2. **Deploy**
```bash
vercel --prod
```

3. **Environment Variables**
Add these to your Vercel project settings:
- `GOOGLE_API_KEY`: Your Google AI API key
- `ANTHROPIC_API_KEY`: Your Anthropic API key (optional)
- `MODEL_PROVIDER`: `gemini` or `anthropic`
- `MODEL_NAME`: Model name (e.g., `gemini-2.5-flash`)

### Option 2: Render

1. **Create Web Service**
- Connect your GitHub repo
- Build command: `./build.sh`
- Start command: `python server.py`
- Environment variables: Add from `.env.example`

2. **Deploy**
- Automatic deployments on push to main branch

### Option 3: Railway

1. **Create New Project**
- Deploy from GitHub
- Build command: `./build.sh`
- Start command: `python server.py`

### Option 4: Heroku

1. **Create App**
```bash
heroku create your-app-name
```

2. **Deploy**
```bash
git push heroku main
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | ✅ | Google AI API key |
| `ANTHROPIC_API_KEY` | ❌ | Anthropic API key (for Claude models) |
| `MODEL_PROVIDER` | ❌ | `gemini` (default) or `anthropic` |
| `MODEL_NAME` | ❌ | Specific model name |
| `PORT` | ❌ | Server port (default: 9000) |
| `DEBUG` | ❌ | Debug mode (default: false) |

### Model Aliases
The app supports OpenAI-compatible model names:
- `gpt-4o-mini` → `gemini-2.5-flash`
- `gpt-4o` → `gemini-2.5-pro`
- `gpt-4.1-mini` → `gemini-3.0-pro`
- `gemini-flash` → `gemini-2.5-flash`
- `gemini-pro` → `gemini-2.5-pro`
- `claude-3-5-sonnet` → `claude-3-5-sonnet-20241022`

## 🌐 API Endpoints

### Core Endpoints
- `POST /chat` - Simple chat
- `POST /code` - Code assistance
- `POST /chatbot` - Chat with history
- `POST /chatbot/stream` - Streaming chat
- `GET /health` - Health check

### OpenAI Compatible
- `POST /v1/chat/completions` - OpenAI API compatible

### Profile Management
- `GET /profiles/list` - List profiles
- `POST /profiles/create` - Create profile
- `POST /profiles/switch` - Switch profile
- `DELETE /profiles/{name}` - Delete profile

### GitHub Integration
- `POST /github/file/read` - Read file
- `POST /github/file/write` - Write file
- `POST /github/list` - List directory
- `POST /github/branches` - List branches

### Gemini WebAPI
- `POST /gemini/chat` - Chat with cookies
- `GET /gemini/conversations` - List conversations

## 📱 PWA Features

The app is a Progressive Web App with:
- ✅ Offline support
- ✅ Installable on mobile/desktop
- ✅ Push notifications ready
- ✅ Responsive design
- ✅ Fast loading

## 🔒 Security

- CORS configured for production
- Input validation with Pydantic
- Rate limiting ready
- Secure cookie handling
- Environment variable protection

## 🐛 Troubleshooting

### Common Issues

1. **Build fails**
```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json
npm install
cd frontend && npm install && npm run build
```

2. **Python dependencies fail**
```bash
# Use virtual environment
python3 -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

3. **API key issues**
- Ensure your API key is valid
- Check quota limits
- Verify model availability

4. **CORS errors**
- Check your deployment URL is in CORS origins
- Verify environment variables are set

### Logs
Check deployment logs in:
- Vercel: Dashboard → Functions → Logs
- Render: Dashboard → Services → Logs
- Railway: Dashboard → Deployments → Logs

## 📊 Monitoring

The app includes:
- Vercel Analytics integration
- Speed Insights
- Health check endpoint
- Error tracking ready

## 🔄 Updates

To update your deployment:
1. Push changes to your repository
2. Automatic deployment will trigger
3. Monitor deployment status
4. Test the updated application

## 🆘 Support

For issues:
1. Check the logs
2. Verify environment variables
3. Test locally first
4. Check API quotas
5. Review configuration

## 📄 License

MIT License - See LICENSE file for details.