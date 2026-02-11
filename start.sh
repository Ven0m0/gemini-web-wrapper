#!/bin/bash
set -e

echo "🚀 Starting AI Assistant App..."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found, creating from .env.example"
    cp .env.example .env
    echo "📝 Please update .env with your API keys"
    echo "   Required: GOOGLE_API_KEY"
    echo "   Optional: ANTHROPIC_API_KEY"
fi

# Check if frontend is built
if [ ! -d "frontend/dist" ]; then
    echo "🔨 Building frontend..."
    cd frontend
    npm install
    npm run build
    cd ..
fi

# Install Python dependencies if needed
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

echo "📦 Installing Python dependencies..."
source venv/bin/activate || . venv/Scripts/activate 2>/dev/null || true
pip install -r requirements.txt

echo "🌐 Starting server..."
python server.py